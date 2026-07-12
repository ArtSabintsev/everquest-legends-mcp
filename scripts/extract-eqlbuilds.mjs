#!/usr/bin/env node
// Continuous extractor for eqlbuilds.com (https://eqlbuilds.com/).
//
// eqlbuilds.com is a client-rendered Vite SPA. It ships no API, sitemap, or
// server-rendered HTML: the entire build-planner dataset (races, classes,
// spells, skills, alternate advancement, stances, invocations) is embedded in
// its content-hashed JS bundle as `JSON.parse(`...`)` literals.
//
// This script re-discovers the hashed bundle(s) from index.html, extracts every
// embedded JSON block, classifies each block by its SHAPE (not by position, so
// bundle reordering does not corrupt the mapping), and rewrites the committed
// snapshot under src/data/eqlbuilds/. It fails loudly (non-zero exit) if any
// required dataset is missing so drift surfaces in CI instead of silently
// shipping empty data.
//
// Usage:
//   node scripts/extract-eqlbuilds.mjs           # write snapshot, report changes
//   node scripts/extract-eqlbuilds.mjs --check   # verify only; non-zero if stale
//
// The snapshot is what the MCP server reads at runtime (see src/eqlbuilds.ts).
// A scheduled GitHub Action (.github/workflows/refresh-eqlbuilds.yml) runs this
// on a cadence and opens a PR when the upstream data changes.

import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

const SITE_URL = "https://eqlbuilds.com/";
const EXTRACTOR_VERSION = 1;
// Same "<client>/<version> (<contact>)" User-Agent as src/http.ts — identifies
// the client and gives upstream maintainers a contact URL.
const PACKAGE_VERSION = JSON.parse(
  await readFile(new URL("../package.json", import.meta.url), "utf8")
).version;
const USER_AGENT = `everquest-legends-mcp/${PACKAGE_VERSION} (+https://github.com/ArtSabintsev/everquest-legends-mcp)`;
const DATA_DIR = new URL("../src/data/eqlbuilds/", import.meta.url);
const REQUIRED = ["races", "classes", "generalAbilities", "stances", "invocations", "notes", "meta"];

const args = new Set(process.argv.slice(2));
const CHECK_ONLY = args.has("--check");

async function main() {
  const html = await get(SITE_URL);
  const bundleUrls = discoverBundleUrls(html, SITE_URL);
  if (bundleUrls.length === 0) {
    fail("No /assets/*.js bundle URLs found in index.html; the site layout changed.");
  }

  const bundles = [];
  const seen = new Set();
  for (const url of bundleUrls) {
    if (seen.has(url)) continue;
    seen.add(url);
    const body = await get(url);
    bundles.push({ url, body });
    // Resolve one level of statically-referenced chunks in case data moves.
    for (const nested of discoverBundleUrls(body, SITE_URL)) {
      if (!seen.has(nested)) bundleUrls.push(nested);
    }
  }

  const blocks = bundles.flatMap((b) => extractJsonBlocks(b.body));
  if (blocks.length === 0) {
    fail("No JSON.parse() blocks found in bundle(s); the embedding format changed.");
  }

  const classified = classify(blocks);
  const missing = REQUIRED.filter((key) => classified[key] === undefined);
  if (missing.length > 0) {
    fail(`Missing required dataset(s): ${missing.join(", ")}. Bundle shape changed.`);
  }

  const bundleHash = createHash("sha256")
    .update(bundles.map((b) => b.body).join("\n"))
    .digest("hex");

  const manifest = {
    source: "eqlbuilds.com",
    sourceUrl: SITE_URL,
    bundleUrls: bundles.map((b) => b.url),
    bundleSha256: bundleHash,
    extractorVersion: EXTRACTOR_VERSION,
    extractedAt: new Date().toISOString(),
    wikiRevisionId: classified.meta?.revisionId ?? null,
    wikiRevisionTimestamp: classified.meta?.timestamp ?? null,
    counts: {
      races: Object.keys(classified.races).length,
      racesInactive: (classified.racesInactive ?? []).length,
      classes: Object.keys(classified.classes).length,
      generalAbilities: classified.generalAbilities.length,
      stances: classified.stances.length,
      invocations: classified.invocations.length,
      notes: classified.notes.length
    }
  };

  const files = {
    "races.json": classified.races,
    "races-inactive.json": classified.racesInactive ?? [],
    "classes.json": classified.classes,
    "general-abilities.json": classified.generalAbilities,
    "stances.json": classified.stances,
    "invocations.json": classified.invocations,
    "notes.json": classified.notes,
    "meta.json": classified.meta,
    "manifest.json": manifest
  };

  await mkdir(DATA_DIR, { recursive: true });

  let changed = 0;
  for (const [name, value] of Object.entries(files)) {
    // manifest always differs (timestamp); compare it ignoring volatile fields.
    const next = JSON.stringify(value, null, 2) + "\n";
    const prev = await readFile(new URL(name, DATA_DIR), "utf8").catch(() => null);
    const isChanged =
      name === "manifest.json" ? manifestDataChanged(prev, manifest) : prev !== next;
    if (isChanged) changed += 1;
    if (!CHECK_ONLY) await writeFile(new URL(name, DATA_DIR), next);
  }

  const summary =
    `eqlbuilds snapshot: ${manifest.counts.classes} classes, ` +
    `${manifest.counts.races} races (+${manifest.counts.racesInactive} inactive), ` +
    `${manifest.counts.generalAbilities} general AAs, ${manifest.counts.stances} stances, ` +
    `${manifest.counts.invocations} invocations; wiki rev ${manifest.wikiRevisionId}.`;

  if (CHECK_ONLY) {
    if (changed > 0) {
      console.error(`[extract-eqlbuilds] STALE: ${changed} file(s) differ from upstream.`);
      console.error(summary);
      // Exit 10 distinguishes "data changed" from a crashed extraction (any
      // other nonzero), so the refresh workflow never mistakes an outage for
      // a change.
      process.exit(10);
    }
    console.log(`[extract-eqlbuilds] up to date. ${summary}`);
    return;
  }

  console.log(`[extract-eqlbuilds] wrote ${Object.keys(files).length} file(s) to ${fileURLToPath(DATA_DIR)}`);
  console.log(summary);
}

// Compare a previously written manifest against the new one, ignoring the fields
// that change on every run (extractedAt) or with the deploy (bundle hash/urls),
// so a scheduled run only reports a change when the actual data moved.
function manifestDataChanged(prevRaw, next) {
  if (!prevRaw) return true;
  let prev;
  try {
    prev = JSON.parse(prevRaw);
  } catch {
    return true;
  }
  const stable = (m) => ({
    wikiRevisionId: m.wikiRevisionId,
    wikiRevisionTimestamp: m.wikiRevisionTimestamp,
    counts: m.counts,
    extractorVersion: m.extractorVersion
  });
  return JSON.stringify(stable(prev)) !== JSON.stringify(stable(next));
}

function discoverBundleUrls(text, base) {
  const urls = [];
  const re = /(?:src|href)=["'](\/assets\/[^"']+\.js)["']/g;
  let m;
  while ((m = re.exec(text))) urls.push(new URL(m[1], base).href);
  // Also catch bare "/assets/xxx.js" string references inside bundles.
  const re2 = /["'`](\/assets\/[A-Za-z0-9._-]+\.js)["'`]/g;
  while ((m = re2.exec(text))) urls.push(new URL(m[1], base).href);
  return [...new Set(urls)];
}

// Extract the string argument of every `JSON.parse(`...`)` template literal,
// honoring backslash escapes so embedded backticks do not end the scan early.
function extractJsonBlocks(source) {
  const blocks = [];
  const re = /JSON\.parse\(`/g;
  let m;
  while ((m = re.exec(source))) {
    let i = m.index + m[0].length;
    let buf = "";
    while (i < source.length) {
      const c = source[i];
      if (c === "\\") {
        buf += source[i] + source[i + 1];
        i += 2;
        continue;
      }
      if (c === "`") break;
      buf += c;
      i += 1;
    }
    const raw = buf.replace(/\\`/g, "`").replace(/\\\$/g, "$").replace(/\\\\/g, "\\");
    try {
      blocks.push(JSON.parse(raw));
    } catch {
      // Not a JSON payload (some JSON.parse calls wrap non-data); skip.
    }
  }
  return blocks;
}

function classify(blocks) {
  const out = {};
  const modeArrays = [];

  for (const block of blocks) {
    if (Array.isArray(block)) {
      if (block.length === 0) continue;
      const first = block[0];
      if (typeof first === "string") {
        out.notes = merge(out.notes, block);
      } else if (isRecord(first) && "rankCosts" in first && "category" in first && "maxRank" in first) {
        out.generalAbilities = merge(out.generalAbilities, block);
      } else if (isRecord(first) && "initialAbility" in first && "status" in first) {
        out.racesInactive = merge(out.racesInactive, block);
      } else if (isRecord(first) && "id" in first && "name" in first && "message" in first && !("rankCosts" in first)) {
        modeArrays.push(block);
      }
      continue;
    }
    if (!isRecord(block)) continue;
    if ("apiUrl" in block && "revisionId" in block) {
      out.meta = block;
      continue;
    }
    const values = Object.values(block);
    const sample = values.find(isRecord);
    if (sample && "spellList" in sample && "skillList" in sample) {
      out.classes = block;
    } else if (sample && "racialTraits" in sample && "description" in sample && !("spellList" in sample)) {
      out.races = block;
    }
  }

  // Disambiguate the two {id,name,message,description} arrays: the one whose
  // entries are mostly named "... Stance" is stances; the other is invocations.
  for (const arr of modeArrays) {
    const stanceish = arr.filter((x) => /stance/i.test(x.name)).length;
    if (stanceish >= 2) out.stances = arr;
    else out.invocations = arr;
  }
  // If only one array matched (e.g. neither looked stance-ish), still try to fill.
  if (out.stances && !out.invocations && modeArrays.length === 2) {
    out.invocations = modeArrays.find((a) => a !== out.stances);
  }

  return out;
}

function merge(existing, incoming) {
  return existing ? existing.concat(incoming) : incoming;
}

function isRecord(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

async function get(url) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 30_000);
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: { "user-agent": USER_AGENT }
    });
    if (!res.ok) fail(`GET ${url} failed with HTTP ${res.status}`);
    return await res.text();
  } finally {
    clearTimeout(timeout);
  }
}

function fail(message) {
  console.error(`[extract-eqlbuilds] ${message}`);
  process.exit(1);
}

main().catch((error) => {
  console.error(`[extract-eqlbuilds] unexpected error: ${error?.stack ?? error}`);
  process.exit(1);
});
