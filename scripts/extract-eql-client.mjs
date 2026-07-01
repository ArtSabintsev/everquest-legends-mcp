#!/usr/bin/env node
// Local EverQuest Legends client extractor.
//
// The richest data in this MCP (per-class spell levels, skill caps, string
// tables) originates in the EQL *client* text files on a machine that has the
// game installed. eqlbuilds.com re-publishes a processed form of that data, but
// the authoritative source is the client itself. This script reads those local
// files directly so the snapshot can be (re)built or cross-checked without a
// third-party intermediary.
//
// It is INTENTIONALLY read-only toward the committed snapshot: by default it
// writes to a scratch --out directory and never touches src/data/eqlbuilds/, so
// a wrong parse can never corrupt shipped data. Review the report and the JSON
// it emits, then fold anything correct into the snapshot deliberately.
//
// Why this can't run in CI or the cloud sandbox: it needs a local game install.
// eqlbuilds.com is the automated path (scripts/extract-eqlbuilds.mjs +
// .github/workflows/refresh-eqlbuilds.yml); this is the manual, authoritative
// path for a maintainer who has the client.
//
// Usage:
//   node scripts/extract-eql-client.mjs --game-dir "/path/to/EverQuest Legends"
//   node scripts/extract-eql-client.mjs --game-dir <dir> --out ./eql-client-dump
//   EQL_GAME_DIR=<dir> node scripts/extract-eql-client.mjs
//
// Flags:
//   --game-dir <dir>  Root of the EQL install (contains eqgame.exe, *_us.txt).
//                     Falls back to the EQL_GAME_DIR environment variable.
//   --out <dir>       Where to write extracted JSON. Default: ./eql-client-dump
//                     (git-ignored scratch). Never src/data/eqlbuilds.
//   --report-only     Parse and print a summary + samples, write nothing.
//   --limit-samples N Number of sample rows to print per dataset (default 5).
//
// Client file formats (all caret-`^`-delimited text, latin1-ish):
//   eqstr_us.txt    Header line, then `<id> <text>` per line (space-separated).
//   dbstr_us.txt    `<id>^<type>^<text>^`  (type 6 = AA descriptions).
//   spells_us.txt   `<id>^<name>^...` one spell per row, 200+ caret fields.
//                   Per-class minimum levels live in a fixed column window; a
//                   value of 254/255 means "class cannot use this spell".
//   skillcaps.txt   `<class>^<skill>^<level>^<cap>^...`
//
// IMPORTANT: column offsets in spells_us.txt drift between client eras. The
// CLASS_LEVEL_COLUMNS window below encodes the layout documented for the EQL
// client (see src/data/eqlbuilds/notes.json: "class level columns 36-51"). This
// script prints a sanity-check against the committed snapshot so you can confirm
// the window still lines up before trusting the output. If the sanity-check
// fails, adjust CLASS_LEVEL_COLUMNS rather than shipping mis-mapped data.

import { createReadStream } from "node:fs";
import { readFile, mkdir, writeFile } from "node:fs/promises";
import { createInterface } from "node:readline";
import { access } from "node:fs/promises";
import { join } from "node:path";

// The 16 EQL classes, in the client's canonical column order. This order is what
// maps spells_us.txt level columns to classes, so it must not be reordered.
const CLASS_ORDER = [
  "warrior", "cleric", "paladin", "ranger", "shadowKnight", "druid",
  "monk", "bard", "rogue", "shaman", "necromancer", "wizard",
  "magician", "enchanter", "beastlord", "berserker"
];

// spells_us.txt: 0-indexed caret columns. "class level columns 36-51" (1-indexed,
// per notes.json) => 0-indexed 35..50 inclusive, one column per class in
// CLASS_ORDER. A level of 254 or 255 marks the spell unusable by that class.
const CLASS_LEVEL_COLUMNS = { start: 35, end: 50 };
const SPELL_ID_COL = 0;
const SPELL_NAME_COL = 1;
const UNUSABLE_LEVELS = new Set([254, 255, 0]);

// Files we know how to read, relative to the game dir.
const FILES = {
  eqstr: "eqstr_us.txt",
  dbstr: "dbstr_us.txt",
  spells: "spells_us.txt",
  skillcaps: join("Resources", "skillcaps.txt")
};

function parseArgs(argv) {
  const args = { limitSamples: 5, reportOnly: false, out: "./eql-client-dump" };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--game-dir") args.gameDir = argv[++i];
    else if (a === "--out") args.out = argv[++i];
    else if (a === "--report-only") args.reportOnly = true;
    else if (a === "--limit-samples") args.limitSamples = Number(argv[++i]) || 5;
    else fail(`Unknown argument: ${a}`);
  }
  args.gameDir ??= process.env.EQL_GAME_DIR;
  if (!args.gameDir) {
    fail("No game dir. Pass --game-dir \"/path/to/EverQuest Legends\" or set EQL_GAME_DIR.");
  }
  return args;
}

function fail(message) {
  console.error(`[extract-eql-client] ${message}`);
  process.exit(1);
}

async function exists(path) {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

// Stream a large caret-delimited file line by line so we never hold the whole
// (spells_us.txt can be tens of MB) file in memory at once.
async function* readLines(path) {
  const stream = createReadStream(path, { encoding: "latin1" });
  const rl = createInterface({ input: stream, crlfDelay: Infinity });
  for await (const line of rl) {
    if (line.length > 0) yield line;
  }
}

// eqstr_us.txt: first line is a header/count; every later line is "<id> <text>".
async function parseEqStr(path) {
  const table = {};
  let first = true;
  for await (const line of readLines(path)) {
    if (first) { first = false; continue; }
    const sp = line.indexOf(" ");
    if (sp < 0) continue;
    const id = Number(line.slice(0, sp));
    if (!Number.isFinite(id)) continue;
    table[id] = line.slice(sp + 1).trimEnd();
  }
  return table;
}

// dbstr_us.txt: "<id>^<type>^<text>^". Keyed by "id:type" because the same id is
// reused across types (spell descriptions, AA descriptions, item text, ...).
async function parseDbStr(path) {
  const table = {};
  let first = true;
  for await (const line of readLines(path)) {
    if (first) { first = false; continue; }
    const parts = line.split("^");
    if (parts.length < 3) continue;
    const id = Number(parts[0]);
    const type = Number(parts[1]);
    if (!Number.isFinite(id) || !Number.isFinite(type)) continue;
    table[`${id}:${type}`] = parts[2];
  }
  return table;
}

// spells_us.txt: extract id, name, and the per-class minimum level window.
async function parseSpells(path) {
  const spells = [];
  const window = CLASS_LEVEL_COLUMNS.end - CLASS_LEVEL_COLUMNS.start + 1;
  if (window !== CLASS_ORDER.length) {
    fail(`CLASS_LEVEL_COLUMNS window is ${window} wide but there are ${CLASS_ORDER.length} classes; fix the constant.`);
  }
  let shortRows = 0;
  for await (const line of readLines(path)) {
    const f = line.split("^");
    if (f.length <= CLASS_LEVEL_COLUMNS.end) { shortRows++; continue; }
    const id = Number(f[SPELL_ID_COL]);
    const name = f[SPELL_NAME_COL];
    if (!Number.isFinite(id) || !name) continue;
    const usableBy = [];
    for (let c = 0; c < CLASS_ORDER.length; c++) {
      const level = Number(f[CLASS_LEVEL_COLUMNS.start + c]);
      if (Number.isFinite(level) && !UNUSABLE_LEVELS.has(level)) {
        usableBy.push({ classId: CLASS_ORDER[c], level });
      }
    }
    if (usableBy.length > 0) {
      usableBy.sort((a, b) => a.level - b.level || a.classId.localeCompare(b.classId));
      spells.push({ id, name, usableBy });
    }
  }
  return { spells, shortRows };
}

// skillcaps.txt: "<classIndex>^<skillId>^<level>^<cap>". Group caps by class.
async function parseSkillCaps(path) {
  const byClass = {};
  for await (const line of readLines(path)) {
    const f = line.split("^");
    if (f.length < 4) continue;
    const classIndex = Number(f[0]);
    const skillId = Number(f[1]);
    const level = Number(f[2]);
    const cap = Number(f[3]);
    if (![classIndex, skillId, level, cap].every(Number.isFinite)) continue;
    const classId = CLASS_ORDER[classIndex - 1] ?? `class${classIndex}`;
    (byClass[classId] ??= []).push({ skillId, level, cap });
  }
  return byClass;
}

// Sanity check: does the parsed spell/level data agree with the committed
// snapshot? If the column window drifted, these will disagree loudly.
async function sanityCheckAgainstSnapshot(spellsById) {
  const snapshotUrl = new URL("../src/data/eqlbuilds/classes.json", import.meta.url);
  let snapshot;
  try {
    snapshot = JSON.parse(await readFile(snapshotUrl, "utf8"));
  } catch {
    return { ran: false, note: "no committed snapshot to compare against" };
  }
  const expected = new Map(); // spellId -> Map(classId->level)
  for (const [classId, cls] of Object.entries(snapshot)) {
    for (const s of cls.spellList ?? []) {
      if (!expected.has(s.id)) expected.set(s.id, new Map());
      expected.get(s.id).set(classId, s.level);
    }
  }
  let checked = 0, agree = 0;
  const mismatches = [];
  for (const [id, want] of expected) {
    const got = spellsById.get(id);
    if (!got) continue;
    const gotMap = new Map(got.usableBy.map((u) => [u.classId, u.level]));
    for (const [classId, level] of want) {
      checked++;
      if (gotMap.get(classId) === level) agree++;
      else if (mismatches.length < 10) {
        mismatches.push({ id, name: got.name, classId, snapshot: level, client: gotMap.get(classId) ?? null });
      }
    }
  }
  return { ran: true, checked, agree, mismatches, agreementPct: checked ? Math.round((agree / checked) * 100) : 0 };
}

function sample(arr, n) {
  return arr.slice(0, n);
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  console.error(`[extract-eql-client] game dir: ${args.gameDir}`);

  const paths = Object.fromEntries(Object.entries(FILES).map(([k, rel]) => [k, join(args.gameDir, rel)]));
  const present = {};
  for (const [k, p] of Object.entries(paths)) {
    present[k] = await exists(p);
    if (!present[k]) console.error(`[extract-eql-client] WARN missing ${FILES[k]} (${p})`);
  }
  if (!present.spells) {
    fail("spells_us.txt not found; is --game-dir the EQL install root?");
  }

  const out = {};
  const report = { gameDir: args.gameDir, files: present, counts: {}, samples: {} };

  if (present.eqstr) {
    out.strings = await parseEqStr(paths.eqstr);
    report.counts.strings = Object.keys(out.strings).length;
  }
  if (present.dbstr) {
    out.dbStrings = await parseDbStr(paths.dbstr);
    report.counts.dbStrings = Object.keys(out.dbStrings).length;
  }

  const { spells, shortRows } = await parseSpells(paths.spells);
  out.spells = spells;
  report.counts.spells = spells.length;
  report.counts.spellShortRows = shortRows;
  report.samples.spells = sample(spells, args.limitSamples);

  if (present.skillcaps) {
    out.skillCaps = await parseSkillCaps(paths.skillcaps);
    report.counts.skillClasses = Object.keys(out.skillCaps).length;
  }

  const spellsById = new Map(spells.map((s) => [s.id, s]));
  report.sanityCheck = await sanityCheckAgainstSnapshot(spellsById);

  console.error("[extract-eql-client] summary:");
  console.error(JSON.stringify(report, null, 2));

  if (report.sanityCheck.ran && report.sanityCheck.agreementPct < 90) {
    console.error(
      `[extract-eql-client] WARNING: only ${report.sanityCheck.agreementPct}% agreement with the committed snapshot. ` +
        "The spells_us.txt column layout likely drifted — review CLASS_LEVEL_COLUMNS before trusting this output."
    );
  }

  if (args.reportOnly) {
    console.error("[extract-eql-client] --report-only: no files written.");
    return;
  }

  await mkdir(args.out, { recursive: true });
  for (const [name, data] of Object.entries(out)) {
    const file = join(args.out, `${name}.json`);
    await writeFile(file, JSON.stringify(data, null, 2));
    console.error(`[extract-eql-client] wrote ${file}`);
  }
  await writeFile(join(args.out, "report.json"), JSON.stringify(report, null, 2));
  console.error(`[extract-eql-client] done. Review ${args.out} before folding into src/data/eqlbuilds.`);
}

main().catch((err) => fail(err?.stack || String(err)));
