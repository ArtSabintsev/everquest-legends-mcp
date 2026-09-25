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
// Alternate Advancement is the exception to "bundle hash == freshness".
// eqlbuilds.com vendors one wiki revision inside the bundle and does not
// republish when https://eqlwiki.com/Alternate_Advancement moves. After the
// bundle is classified, this script reads the live wiki revision and, when it
// is newer, overlays availability, costs, and descriptions onto the bundled
// abilities (keeping client-enriched rank spells and dbstr ids for abilities
// the bundle already knew).
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

  const bundleWikiRevisionId = classified.meta?.revisionId ?? null;
  await refreshAlternateAdvancementFromWiki(classified, bundleWikiRevisionId);

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

const FETCH_ATTEMPTS = 3;
const FETCH_TIMEOUT_MS = 30_000;

async function get(url) {
  let lastError;
  for (let attempt = 1; attempt <= FETCH_ATTEMPTS; attempt += 1) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
    try {
      const res = await fetch(url, {
        signal: controller.signal,
        headers: { "user-agent": USER_AGENT }
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return await res.text();
    } catch (error) {
      lastError = error;
      if (attempt < FETCH_ATTEMPTS) {
        console.error(`[extract-eqlbuilds] GET ${url} attempt ${attempt} failed: ${error.message}; retrying`);
        await new Promise((resolve) => setTimeout(resolve, 1000 * attempt));
      }
    } finally {
      clearTimeout(timeout);
    }
  }
  fail(`GET ${url} failed after ${FETCH_ATTEMPTS} attempts: ${lastError?.message ?? lastError}`);
}

function fail(message) {
  console.error(`[extract-eqlbuilds] ${message}`);
  process.exit(1);
}

// Live EQL Wiki Alternate Advancement page. The eqlbuilds.com bundle embeds one
// revision (apiUrl oldid=...) and will not change until that site rebuilds.
const AA_WIKI_TITLE = "Alternate Advancement";
const ALL_CLASSES = [
  "warrior",
  "cleric",
  "paladin",
  "ranger",
  "shadowKnight",
  "druid",
  "monk",
  "bard",
  "rogue",
  "shaman",
  "necromancer",
  "wizard",
  "magician",
  "enchanter",
  "beastlord",
  "berserker"
];
const CLASS_IDS = {
  bard: "bard",
  beastlord: "beastlord",
  berserker: "berserker",
  cleric: "cleric",
  druid: "druid",
  enchanter: "enchanter",
  magician: "magician",
  monk: "monk",
  necromancer: "necromancer",
  paladin: "paladin",
  ranger: "ranger",
  rogue: "rogue",
  "shadow knight": "shadowKnight",
  shaman: "shaman",
  warrior: "warrior",
  wizard: "wizard"
};
// Snapshot typos / renames that should update the existing row instead of
// inserting a second ability.
const WIKI_NAME_ALIASES = {
  "innate metabolism": "innate metablolism"
};
// The archetype table does not list eligible classes. Brand-new archetype AAs
// with no prior snapshot row use the class list from the official notes.
const NEW_ARCHETYPE_CLASSES = {
  "point blank fire": {
    classes: ["ranger", "monk", "rogue", "berserker"],
    // Official September 22, 2026 update: auto-granted for these classes.
    // The wiki row gives the effect and a 0 cost, not the class list or grant flag.
    autoGranted: true
  }
};

async function refreshAlternateAdvancementFromWiki(classified, bundleWikiRevisionId) {
  const live = await fetchLiveAlternateAdvancement();
  if (bundleWikiRevisionId !== null && live.revisionId === bundleWikiRevisionId) {
    console.log(`[extract-eqlbuilds] wiki AA rev ${live.revisionId} matches the eqlbuilds.com bundle; leaving bundled abilities.`);
    return;
  }
  if (bundleWikiRevisionId !== null && live.revisionId < bundleWikiRevisionId) {
    console.log(
      `[extract-eqlbuilds] live wiki AA rev ${live.revisionId} is older than bundled rev ${bundleWikiRevisionId}; leaving bundled abilities.`
    );
    return;
  }

  const parsed = parseAaWikiRows(live.wikitext).filter(isAaDataRow);
  const removedNorms = new Set(parsed.filter((row) => row.removed).map((row) => row.norm));
  const merged = mergeAaRows(parsed.filter((row) => !row.removed));
  if (merged.length < 100) {
    fail(`Parsed only ${merged.length} Alternate Advancement row(s); the wiki table layout likely changed.`);
  }

  const catalog = classified.generalAbilities;
  const before = catalog.length;
  const byNorm = new Map(catalog.map((ability) => [normalizeAaName(ability.wikiName || ability.name), ability]));
  const matched = new Set();
  let added = 0;

  for (const wiki of merged) {
    const existing = byNorm.get(wiki.norm) ?? byNorm.get(WIKI_NAME_ALIASES[wiki.norm] ?? "");
    if (existing) {
      Object.assign(existing, mergeAbility(existing, wiki, live.revisionId));
      matched.add(existing);
    } else {
      const created = mergeAbility(null, wiki, live.revisionId);
      catalog.push(created);
      byNorm.set(wiki.norm, created);
      matched.add(created);
      added += 1;
    }
  }

  const removeIds = new Set();
  for (const ability of catalog) {
    const norm = normalizeAaName(ability.wikiName || ability.name);
    if (removedNorms.has(norm)) removeIds.add(ability.id);
  }
  const unmatched = catalog.filter((ability) => !matched.has(ability) && !removeIds.has(ability.id));
  if (unmatched.length > 5) {
    fail(
      `${unmatched.length} bundled abilities were absent from wiki rev ${live.revisionId} ` +
        `(${unmatched.slice(0, 8).map((ability) => ability.wikiName).join(", ")}). ` +
        `Refusing to keep a parse that does not cover the catalog.`
    );
  }
  for (const ability of unmatched) {
    console.error(`[extract-eqlbuilds] keeping bundled AA absent from the live wiki: ${ability.wikiName}`);
  }

  classified.generalAbilities = catalog.filter((ability) => !removeIds.has(ability.id));
  const byId = new Map(classified.generalAbilities.map((ability) => [ability.id, ability]));
  for (const [classId, cls] of Object.entries(classified.classes)) {
    const present = new Set();
    const next = [];
    for (const ability of cls.alternateAbilityList) {
      const updated = byId.get(ability.id);
      if (!updated || present.has(updated.id)) continue;
      if (!updated.classes.includes(classId)) continue;
      present.add(updated.id);
      next.push(updated);
    }
    for (const ability of classified.generalAbilities) {
      if (present.has(ability.id) || !ability.classes.includes(classId)) continue;
      present.add(ability.id);
      next.push(ability);
    }
    cls.alternateAbilityList = next;
  }

  const removed = removeIds.size;
  classified.meta = {
    ...classified.meta,
    apiUrl: live.apiUrl,
    comment: live.comment,
    pageId: live.pageId,
    parentId: live.parentId,
    revisionId: live.revisionId,
    timestamp: live.timestamp,
    title: live.title,
    url: live.url,
    user: live.user,
    rowCount: parsed.length,
    uniqueAbilityCount: classified.generalAbilities.length
  };
  const note =
    `Alternate Advancement availability and costs are refreshed from the live EQL Wiki Alternate Advancement page revision ${live.revisionId}` +
    `${bundleWikiRevisionId ? ` (eqlbuilds.com still vendors revision ${bundleWikiRevisionId})` : ""}. ` +
    `Descriptions follow the wiki. Rank-spell metadata and dbstr ids for abilities already in the bundle are kept.`;
  const notes = classified.notes ?? [];
  const noteIndex = notes.findIndex((line) => line.startsWith("Alternate Advancement availability and costs are extracted"));
  if (noteIndex >= 0) notes[noteIndex] = note;
  else notes.push(note);
  classified.notes = notes;

  console.log(
    `[extract-eqlbuilds] wiki AA rev ${bundleWikiRevisionId ?? "none"} -> ${live.revisionId}; ` +
      `catalog ${before} -> ${classified.generalAbilities.length} (${added} added, ${removed} removed).`
  );
}

async function fetchLiveAlternateAdvancement() {
  const queryUrl =
    "https://eqlwiki.com/api.php?action=query&prop=revisions&titles=" +
    `${encodeURIComponent(AA_WIKI_TITLE)}&rvprop=ids%7Ctimestamp%7Cuser%7Ccomment&rvlimit=1&format=json&formatversion=2`;
  const query = JSON.parse(await get(queryUrl));
  const page = query?.query?.pages?.[0];
  const rev = page?.revisions?.[0];
  if (!rev?.revid) fail("EQL Wiki did not return an Alternate Advancement revision.");
  const apiUrl = `https://eqlwiki.com/api.php?action=parse&oldid=${rev.revid}&prop=wikitext&format=json&formatversion=2`;
  const parsed = JSON.parse(await get(apiUrl));
  const wikitext = parsed?.parse?.wikitext;
  if (typeof wikitext !== "string" || wikitext.length < 1000) {
    fail("EQL Wiki Alternate Advancement wikitext was missing or too short.");
  }
  return {
    revisionId: rev.revid,
    parentId: rev.parentid ?? 0,
    timestamp: rev.timestamp,
    user: rev.user ?? "",
    comment: rev.comment ?? "",
    pageId: page.pageid,
    title: page.title ?? AA_WIKI_TITLE,
    wikitext,
    apiUrl,
    url: `https://eqlwiki.com/Alternate_Advancement?oldid=${rev.revid}`
  };
}

function parseAaWikiRows(wikitext) {
  const lines = wikitext.split(/\r?\n/);
  let category = null;
  let classId = null;
  let inTable = false;
  let cells = null;
  const rows = [];

  const flush = () => {
    if (!cells) return;
    rows.push({
      category,
      classId,
      cells: cells.map(cleanWikiText),
      rawName: cells[0] ?? ""
    });
    cells = null;
  };

  for (const line of lines) {
    const heading = line.match(/^(=+)\s*(.*?)\s*=+\s*$/);
    if (heading && !inTable) {
      const title = heading[2].trim();
      if (title === "General AAs") {
        category = "general";
        classId = null;
      } else if (title === "Archetype AAs") {
        category = "archetype";
        classId = null;
      } else if (title === "Class AAs") {
        category = "class";
        classId = null;
      } else if (title === "Special AAs") {
        category = "special";
        classId = null;
      } else {
        const classHeading = title.match(/^(.+?) Class AAs$/);
        if (classHeading) {
          category = "class";
          classId = CLASS_IDS[classHeading[1].toLowerCase()] ?? null;
        }
      }
      continue;
    }
    if (line.startsWith("{|")) {
      inTable = true;
      cells = null;
      continue;
    }
    if (line.startsWith("|}") && inTable) {
      flush();
      inTable = false;
      continue;
    }
    if (!inTable) continue;
    if (line.startsWith("|-")) {
      flush();
      cells = [];
      continue;
    }
    if (line.startsWith("!") || line.startsWith("|")) {
      if (!cells) cells = [];
      for (const part of line.split(/\|\||!!/)) cells.push(part.replace(/^[|!]+\s*/, ""));
      continue;
    }
    if (cells && cells.length > 0) cells[cells.length - 1] += `\n${line}`;
  }
  flush();
  return rows;
}

function isAaDataRow(row) {
  if (!row.category || row.cells.length < 4) return false;
  const name = row.cells[0];
  if (!name) return false;
  if (/^(name|ranks|cost|description)$/i.test(name)) return false;
  if (/aas$/i.test(name)) return false;
  row.norm = normalizeAaName(name);
  row.removed = /<s>/i.test(row.rawName) || /this aa has been removed/i.test(row.cells[3] ?? "");
  return true;
}

function mergeAaRows(rows) {
  const merged = new Map();
  const order = [];
  for (const row of rows) {
    const name = row.cells[0];
    const norm = normalizeAaName(name);
    let entry = merged.get(norm);
    if (!entry) {
      entry = {
        norm,
        name,
        category: row.category,
        classIds: [],
        ranks: parseRankCount(row.cells[1]),
        cost: row.cells[2],
        description: row.cells[3]
      };
      merged.set(norm, entry);
      order.push(norm);
    }
    if (row.classId && !entry.classIds.includes(row.classId)) entry.classIds.push(row.classId);
    if (row.category === "class") entry.category = "class";
    else if (row.category === "general") entry.category = "general";
    else if (row.category === "special" && entry.category !== "general" && entry.category !== "class") entry.category = "special";
    const costParts = row.cells[2].split("/").length;
    if (costParts > entry.cost.split("/").length) {
      entry.cost = row.cells[2];
      entry.ranks = parseRankCount(row.cells[1]);
    }
    if (row.cells[3].length > entry.description.length) entry.description = row.cells[3];
    if (row.cells[0].length > entry.name.length) entry.name = row.cells[0];
    entry.ranks = Math.max(entry.ranks, parseRankCount(row.cells[1]));
  }
  return order.map((norm) => merged.get(norm));
}

function mergeAbility(existing, wiki, revisionId) {
  const description = cleanWikiText(wiki.description);
  const requirements = parseRequirements(description);
  const maxRank = Math.max(wiki.ranks || 1, 1);
  const costs = parseAaCosts(wiki.cost, maxRank, existing?.isAutoGranted === true);
  const category = existing && wiki.category === "archetype" ? existing.category : wiki.category;
  const { classes, group } = resolveAaClasses(existing, { ...wiki, category });
  const base = existing ?? {
    category,
    classes,
    costLabel: costs.costLabel,
    costStatus: costs.costStatus,
    dbstrId: 0,
    description,
    group,
    id: `${category}-${slugAaName(wiki.name)}`,
    isActivated: /when activated|toggleable|ability activation id/i.test(description),
    isAutoGranted: /auto-?granted/i.test(description),
    maxRank,
    name: wiki.name,
    rankCosts: costs.rankCosts,
    rankSpells: [],
    requirements,
    sourceRevisionId: revisionId,
    wikiName: wiki.name
  };
  if (!existing) {
    if (base.isAutoGranted || NEW_ARCHETYPE_CLASSES[wiki.norm]?.autoGranted) {
      base.isAutoGranted = true;
      base.costStatus = "auto";
      base.costLabel = "Auto-granted";
    }
    return base;
  }
  return {
    ...existing,
    category,
    classes,
    group,
    costLabel: existing.isAutoGranted ? "Auto-granted" : costs.costLabel,
    costStatus: existing.isAutoGranted ? "auto" : costs.costStatus,
    description,
    maxRank: costs.rankCosts.length,
    name: wiki.name,
    rankCosts: costs.rankCosts,
    requirements,
    sourceRevisionId: revisionId,
    wikiName: wiki.name
  };
}

function resolveAaClasses(existing, wiki) {
  if (wiki.category === "general" || wiki.category === "special") {
    return {
      classes: ALL_CLASSES.slice(),
      group: wiki.category === "general" ? "General" : existing?.group || "Special"
    };
  }
  if (wiki.category === "class") {
    const classes = ALL_CLASSES.filter((id) => wiki.classIds.includes(id));
    if (classes.length === 0 && existing) return { classes: existing.classes, group: existing.group };
    if (existing && sameMembers(existing.classes, classes)) {
      return { classes: existing.classes, group: existing.group };
    }
    return { classes, group: classes.map(prettifyClassId).join(" / ") || existing?.group || "Class" };
  }
  if (existing) return { classes: existing.classes, group: existing.group };
  const classes = NEW_ARCHETYPE_CLASSES[wiki.norm]?.classes ?? [];
  if (classes.length === 0) {
    console.error(`[extract-eqlbuilds] new archetype AA "${wiki.name}" has no class list; searchable only by name.`);
  }
  return { classes, group: "Archetype" };
}

function parseAaCosts(costRaw, maxRank, autoGranted) {
  const raw = costRaw.trim();
  let tokens;
  if (/for all ranks/i.test(raw)) {
    const value = raw.match(/\d+/);
    tokens = Array(maxRank).fill(value ? value[0] : "?");
  } else {
    tokens = raw.split("/").map((part) => part.trim()).filter(Boolean);
    if (tokens.length === 1 && /^\d+$/.test(tokens[0]) && maxRank > 1) {
      tokens = Array(maxRank).fill(tokens[0]);
    }
  }
  let rankCosts = tokens.map((token) => (/^\d+$/.test(token) ? Number(token) : null));
  if (rankCosts.length === 0) rankCosts = Array(maxRank).fill(null);
  while (rankCosts.length < maxRank) rankCosts.push(null);
  if (rankCosts.length > maxRank) rankCosts = rankCosts.slice(0, Math.max(maxRank, rankCosts.filter((cost) => cost !== null).length));
  const known = rankCosts.filter((cost) => cost !== null).length;
  let costStatus = "known";
  if (known === 0) costStatus = "unknown";
  else if (known < rankCosts.length) costStatus = "partial";
  let costLabel =
    costStatus === "unknown" ? "Unknown" : rankCosts.map((cost) => (cost === null ? "Unknown" : String(cost))).join(" / ");
  if (autoGranted) {
    costStatus = "auto";
    costLabel = "Auto-granted";
  }
  return { rankCosts, costLabel, costStatus };
}

function parseRequirements(description) {
  const requirements = [];
  const clauses = description.split(/requirements:\s*/i).slice(1);
  for (const clause of clauses) {
    const sentence = clause.split(/(?<=\.)\s+/)[0].replace(/\.$/, "").trim();
    if (!sentence) continue;
    for (const piece of sentence.split(/\s*,\s*/)) {
      const level = piece.match(/^level\s+([\d/?]+)/i);
      if (level && !/\bat level\b/i.test(piece)) {
        if (level[1] !== "1") requirements.push(level[1].includes("/") ? `Level ${level[1]}` : `Level ${level[1]}+`);
        const rest = piece.replace(/^level\s+[\d/?]+\s*/i, "").trim();
        if (rest) requirements.push(rest);
      } else if (piece && !/^level\s*1$/i.test(piece)) {
        requirements.push(piece);
      }
    }
  }
  return [...new Set(requirements)];
}

function parseRankCount(value) {
  const match = String(value).match(/\d+/);
  return match ? Number(match[0]) : 1;
}

function cleanWikiText(value) {
  return value
    .replace(/<br\s*\/?>/gi, " ")
    .replace(/''+/g, "")
    .replace(/<\/?s>/gi, "")
    .replace(/<[^>]+>/g, "")
    .replace(/&amp;/g, "&")
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeAaName(name) {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\bmastery\b/g, "master");
}

function slugAaName(name) {
  return name
    .toLowerCase()
    .replace(/['’]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function prettifyClassId(id) {
  const spaced = id.replace(/([a-z0-9])([A-Z])/g, "$1 $2");
  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
}

function sameMembers(left, right) {
  if (!Array.isArray(left) || left.length !== right.length) return false;
  const rightSet = new Set(right);
  return left.every((id) => rightSet.has(id));
}

main().catch((error) => {
  console.error(`[extract-eqlbuilds] unexpected error: ${error?.stack ?? error}`);
  process.exit(1);
});
