#!/usr/bin/env node
// EQL Wiki slash-command extractor.
//
// Companion to scripts/extract-eql-reference.mjs, which snapshots the
// slash-command list out of the *client's* bundled manual text
// (everquest_manual.txt). That file ships with the client install and is not
// maintained for EverQuest Legends specifically — it is legacy classic-EQ
// manual text, so it drifts from what commands actually do in EQL (see
// https://eqlwiki.com/Commands, which the community keeps current: newer
// syntax forms, commands the client manual omits entirely such as
// /bandolier, etc).
//
// This script pulls the community-maintained https://eqlwiki.com/Commands
// page instead, via the same MediaWiki action=parse API used by
// src/mediawiki.ts, and snapshots it the same way extract-eqlbuilds.mjs
// snapshots eqlbuilds.com: a committed JSON file plus a manifest recording
// the wiki revision it came from. Unlike extract-eql-reference.mjs, this
// needs no local game install and only needs network access, so it can run
// in CI on a schedule.
//
// Usage:
//   node scripts/extract-eql-wiki-commands.mjs           # write snapshot
//   node scripts/extract-eql-wiki-commands.mjs --check   # verify only; non-zero if stale
//   node scripts/extract-eql-wiki-commands.mjs --dry-run # parse + print a summary, write nothing

import { mkdir, readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

const EXTRACTOR_VERSION = 1;
const WIKI_API_URL = "https://eqlwiki.com/api.php";
const PAGE_TITLE = "Commands";
const PACKAGE_VERSION = JSON.parse(
  await readFile(new URL("../package.json", import.meta.url), "utf8")
).version;
// Same "<client>/<version> (<contact>)" convention as src/http.ts.
const USER_AGENT = `everquest-legends-mcp/${PACKAGE_VERSION} (+https://github.com/ArtSabintsev/everquest-legends-mcp)`;
const DATA_DIR = new URL("../src/data/eql-wiki/", import.meta.url);

const args = new Set(process.argv.slice(2));
const CHECK_ONLY = args.has("--check");
const DRY_RUN = args.has("--dry-run");

async function main() {
  const response = await fetchJson(
    `${WIKI_API_URL}?action=parse&page=${encodeURIComponent(PAGE_TITLE)}&prop=wikitext%7Crevid&format=json&formatversion=2`
  );
  if (response.error) {
    fail(`Wiki API error (${response.error.code}): ${response.error.info}`);
  }
  const wikitext = response.parse?.wikitext;
  if (!wikitext) {
    fail("No wikitext returned for the Commands page; the page may have moved.");
  }

  const commands = parseCommands(wikitext);
  if (commands.length < 100) {
    // The page has documented 200+ commands historically. A drop this large
    // means the wikitext layout changed under us, not that the game shrank.
    fail(`Parsed only ${commands.length} command(s); expected 200+. The wiki page layout likely changed.`);
  }

  const manifest = {
    source: "EQL Wiki (community-maintained)",
    sourceUrl: `https://eqlwiki.com/${PAGE_TITLE}`,
    sourceNote:
      "Slash-command reference parsed from https://eqlwiki.com/Commands via the MediaWiki action=parse API. Community-maintained and kept current with EQL patches, unlike the client-bundled manual text in ../eql-client (see eqlClient.ts), which ships legacy classic-EQ manual copy. The two datasets are merged at query time, preferring this one.",
    extractorVersion: EXTRACTOR_VERSION,
    extractedAt: new Date().toISOString(),
    wikiPageId: response.parse.pageid,
    wikiRevisionId: response.parse.revid ?? null,
    counts: { commands: commands.length }
  };

  if (DRY_RUN) {
    log(`Parsed ${commands.length} commands from wiki revision ${manifest.wikiRevisionId}.`);
    log(`Sample: ${JSON.stringify(commands.slice(0, 3), null, 2)}`);
    return;
  }

  const files = {
    "commands.json": commands,
    "manifest.json": manifest
  };

  if (CHECK_ONLY) {
    let stale = false;
    for (const [name, value] of Object.entries(files)) {
      const current = await readFileIfExists(new URL(name, DATA_DIR));
      const isChanged =
        name === "manifest.json" ? manifestDataChanged(current, manifest) : current !== `${JSON.stringify(value, null, 2)}\n`;
      if (isChanged) {
        stale = true;
        log(`STALE: ${name} differs from upstream.`);
      }
    }
    if (stale) {
      log(`${commands.length} commands parsed from wiki revision ${manifest.wikiRevisionId}.`);
      // Exit 10 distinguishes "data changed" from a crashed extraction (any
      // other nonzero), so a refresh workflow never mistakes an outage for a
      // real change. Mirrors scripts/extract-eqlbuilds.mjs's convention.
      process.exit(10);
    }
    log("up to date.");
    return;
  }

  await mkdir(DATA_DIR, { recursive: true });
  for (const [name, value] of Object.entries(files)) {
    await writeFile(new URL(name, DATA_DIR), `${JSON.stringify(value, null, 2)}\n`, "utf8");
  }
  log(`Wrote ${commands.length} commands (wiki revision ${manifest.wikiRevisionId}) to ${fileURLToPath(DATA_DIR)}`);
}

// manifest.json always differs by extractedAt; compare ignoring that and
// other volatile fields so an unchanged upstream doesn't look stale.
function manifestDataChanged(prevRaw, next) {
  if (!prevRaw) return true;
  let prev;
  try {
    prev = JSON.parse(prevRaw);
  } catch {
    return true;
  }
  const stable = (m) => ({
    wikiPageId: m.wikiPageId,
    wikiRevisionId: m.wikiRevisionId,
    counts: m.counts,
    extractorVersion: m.extractorVersion
  });
  return JSON.stringify(stable(prev)) !== JSON.stringify(stable(next));
}

// ---------------------------------------------------------------------------
// Wikitext parsing
// ---------------------------------------------------------------------------
// The Commands page is a MediaWiki definition list, one command per entry:
//
//   ; <code>/cast <slot# | spellname></code>: Casts the spell in the...
//   :* optional sub-bullets giving per-argument detail
//
// Section banners (`= A =`, `= B =`, ...) group entries alphabetically; they
// carry no data we keep. A handful of entries put their description on the
// following plain-text line instead of after the colon (e.g. /useitem), and
// one entry wraps its <code> in an anchor `<span id="...">` for cross-linking
// (/yell). Both are handled below.
function parseCommands(wikitext) {
  const lines = wikitext.split(/\r?\n/);
  const commands = [];
  let current = null;

  const flush = () => {
    if (!current) return;
    const description = cleanWikitext(current.descriptionParts.join(" ").trim());
    const syntax = cleanWikitext(current.syntaxRaw.trim());
    const commandToken = (syntax.match(/\/\S+/) ?? [])[0];
    if (commandToken) {
      commands.push({
        command: commandToken.toLowerCase(),
        aliases: extractAliases(description),
        syntax,
        description
      });
    }
    current = null;
  };

  for (const rawLine of lines) {
    // Strip cross-linking markup that isn't part of the command itself: named
    // anchors (`<span id="...">`, used so other pages can deep-link a
    // command) and labeled-section transclusion markers (`<section begin=
    // "..." />` / `<section end="..." />`, used to embed one entry's doc on
    // another page). Left in place, either breaks the `; <code>` entry-start
    // match below and silently merges an entry into whatever came before it.
    const line = rawLine
      .replace(/<span[^>]*>/gi, "")
      .replace(/<\/span>/gi, "")
      .replace(/<section[^>]*>/gi, "");
    const trimmed = line.trim();

    const defMatch = trimmed.match(/^;\s*<code>(.*?)<\/code>\s*:?\s*(.*)$/i);
    if (defMatch) {
      flush();
      current = { syntaxRaw: defMatch[1], descriptionParts: defMatch[2] ? [defMatch[2]] : [] };
      continue;
    }

    if (/^=+.*=+$/.test(trimmed)) {
      // Section banner (`= A =`): ends the current entry, carries no data.
      flush();
      continue;
    }

    if (trimmed.startsWith(";")) {
      // Looks like a new entry (`; ...`) but didn't match the expected
      // `<code>` shape, e.g. unrecognized markup between `;` and `<code>`.
      // Flush and drop it rather than silently appending its bullets to
      // whatever entry is still open — that would corrupt an unrelated
      // command instead of just losing this one.
      flush();
      log(`Skipped an unparseable entry line: ${trimmed.slice(0, 80)}`);
      continue;
    }

    if (!current) continue;

    const bulletMatch = trimmed.match(/^:\*+\s*(.*)$/);
    if (bulletMatch) {
      current.descriptionParts.push(`- ${bulletMatch[1]}`);
      continue;
    }

    // A plain non-blank line directly after a colon-less `; <code>...</code>`
    // line is a same-entry continuation (e.g. /useitem's second line).
    if (trimmed.length > 0 && current.descriptionParts.length === 0) {
      current.descriptionParts.push(trimmed);
    }
  }
  flush();

  return commands;
}

// Strip the small set of wiki/HTML markup this page actually uses. Order
// matters: links before generic tag stripping, since link syntax isn't HTML.
function cleanWikitext(text) {
  return text
    .replace(/\[\[([^|\]]+)\|([^\]]+)\]\]/g, "$2") // [[Target|Display]] -> Display
    .replace(/\[\[([^\]]+)\]\]/g, "$1") // [[Target]] -> Target
    .replace(/\[https?:\/\/\S+\s+([^\]]+)\]/g, "$1") // [http://url text] -> text
    .replace(/<\/?code>/gi, "") // keep <code> inner text, drop the tags
    .replace(/\s+/g, " ")
    .trim();
}

// Best-effort alias extraction from description prose, e.g. "Common
// abbreviation: /con" or "Commonly abbreviated: /alt, /alt act". Misses are
// fine — aliases here are a supplement to (not a replacement for) the client
// manual's alias data, which the merge in src/eqlClient.ts unions in.
function extractAliases(description) {
  const match = description.match(/common(?:ly)? abbreviat(?:ed|ion)s?:?\s*([^.]*)/i);
  if (!match) return [];
  return match[1]
    .split(/,| or /i)
    .map((token) => token.trim().toLowerCase())
    .filter((token) => token.startsWith("/"))
    .filter((token, index, all) => all.indexOf(token) === index);
}

// ---------------------------------------------------------------------------

async function fetchJson(url) {
  const response = await fetch(url, { headers: { "User-Agent": USER_AGENT } });
  if (!response.ok) {
    fail(`HTTP ${response.status} fetching ${url}`);
  }
  return response.json();
}

async function readFileIfExists(url) {
  try {
    return await readFile(url, "utf8");
  } catch (error) {
    if (error.code === "ENOENT") return null;
    throw error;
  }
}

function fail(message) {
  console.error(`[extract-eql-wiki-commands] ${message}`);
  process.exit(1);
}

function log(message) {
  console.error(`[extract-eql-wiki-commands] ${message}`);
}

await main();
