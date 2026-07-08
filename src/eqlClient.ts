import { readFileSync } from "node:fs";
import { detectNonLaunchEra, type EraAdvisory } from "./era.js";
import { scoreText, snippetAround, truncateText } from "./text.js";

// Reference data extracted directly from a local EverQuest Legends client
// install. The snapshot under ./data/eql-client is (re)built out-of-band by
// scripts/extract-eql-reference.mjs on a machine that has the game installed
// (see that script's header). This module only reads the committed snapshot; it
// performs no network access, matching the read-only design of the rest of the
// server.
//
// This complements ./eqlbuilds.ts: eqlbuilds covers spells/skills/AAs/classes
// and playable-race descriptions; this covers the reference text those omit —
// the in-game slash-command list, the full race/model table (including NPC
// races), and the client's manual supplement.

const DATA_DIR = new URL("./data/eql-client/", import.meta.url);

export const EQL_CLIENT_DISCLAIMER =
  "Reference text extracted directly from a local EverQuest Legends client install (slash commands, race/model table, manual supplement, zone maps, storylines). This is game client data, not curated Daybreak documentation; the manual supplement in particular carries legacy EverQuest text that predates Legends. For playable-race and class build detail, prefer the eql_builds_* tools.";

export const EQL_ZONES_NOTE =
  "Raw client-shipped map inventory, NOT EverQuest Legends' confirmed zone list: the client inherits map files from classic EverQuest — including expansion zones that do not exist in EQL — alongside EQL's own custom zones. Zones with a classicExpansionHint match well-known classic expansion zone codes and are almost certainly not part of EQL; unhinted zones are likelier EQL content but still need confirmation from EQL-specific sources (wiki, official pages).";

export const EQL_STORYLINES_NOTE =
  "Narrative text shipped in the EverQuest Legends client's Storyline folder. Much of it is inherited from classic EverQuest's storyline system (including later-expansion stories), so it is lore background, NOT confirmed EQL canon — prefer EQL-specific sources, and treat entries with an eraAdvisory as classic-EverQuest material.";

export type EqlClientCommand = {
  command: string;
  aliases: string[];
  syntax: string;
  description: string;
};

export type EqlClientRaceModel = {
  gender: string;
  tag: string;
  size: number;
};

export type EqlClientRace = {
  id: number;
  name: string;
  plural: string | null;
  size: number;
  models: EqlClientRaceModel[];
};

export type EqlClientManualSection = {
  title: string;
  body: string;
};

export type EqlClientPoi = {
  label: string;
  x: number;
  y: number;
  z: number;
};

export type EqlClientZone = {
  zone: string;
  layers: number;
  poiCount: number;
  /** Set when the zone shortname matches a well-known classic-EverQuest expansion zone code. */
  classicExpansionHint: string | null;
  pois: EqlClientPoi[];
};

export type EqlClientStoryline = {
  id: string;
  title: string;
  body: string;
};

export type EqlClientSourceFile = {
  name: string;
  bytes: number;
  modifiedAt: string;
  sha256: string;
};

export type EqlClientManifest = {
  source: string;
  sourceNote: string;
  extractorVersion: number;
  extractedAt: string;
  gameDirName: string;
  sources: EqlClientSourceFile[];
  counts: Record<string, number>;
};

const cache = new Map<string, unknown>();

function load<T>(name: string): T {
  const cached = cache.get(name);
  if (cached !== undefined) {
    return cached as T;
  }
  const value = JSON.parse(readFileSync(new URL(name, DATA_DIR), "utf8")) as T;
  cache.set(name, value);
  return value;
}

const commands = () => load<EqlClientCommand[]>("commands.json");
const races = () => load<EqlClientRace[]>("races.json");
const manualSections = () => load<EqlClientManualSection[]>("manual-sections.json");
const zones = () => load<EqlClientZone[]>("zones.json");
const storylines = () => load<EqlClientStoryline[]>("storylines.json");
const manifest = () => load<EqlClientManifest>("manifest.json");

export function getEqlClientProvenance(): {
  disclaimer: string;
  manifest: EqlClientManifest;
} {
  return { disclaimer: EQL_CLIENT_DISCLAIMER, manifest: manifest() };
}

// --- Slash commands -------------------------------------------------------

// Normalize a user-supplied command to the stored form: lowercase, leading `/`.
function normalizeCommand(value: string): string {
  const trimmed = value.trim().toLowerCase();
  return trimmed.startsWith("/") ? trimmed : `/${trimmed}`;
}

export function searchEqlClientCommands(
  query: string,
  options: { limit?: number } = {}
): { query: string; results: EqlClientCommand[]; disclaimer: string } {
  const limit = options.limit ?? 15;
  const results = commands()
    .map((command) => ({
      command,
      // Weight the command token and syntax over the prose description.
      score: scoreText(
        `${command.command} ${command.command} ${command.aliases.join(" ")} ${command.syntax} ${command.description}`,
        query
      )
    }))
    .filter((entry) => entry.score > 0)
    .sort((a, b) => b.score - a.score || a.command.command.localeCompare(b.command.command))
    .slice(0, limit)
    .map((entry) => entry.command);
  return { query, results, disclaimer: EQL_CLIENT_DISCLAIMER };
}

// Look up every documented form of a slash command by name or alias. The manual
// lists many commands in several forms (e.g. /who, /who all, /who <mask>), so
// this returns all matching entries rather than a single row.
export function getEqlClientCommand(name: string): {
  command: string;
  entries: EqlClientCommand[];
  disclaimer: string;
} | undefined {
  const key = normalizeCommand(name);
  const entries = commands().filter(
    (command) => command.command === key || command.aliases.includes(key)
  );
  if (entries.length === 0) {
    return undefined;
  }
  return { command: key, entries, disclaimer: EQL_CLIENT_DISCLAIMER };
}

// --- Race / model table ---------------------------------------------------

export function searchEqlClientRaces(
  query: string,
  options: { limit?: number } = {}
): { query: string; results: EqlClientRace[]; disclaimer: string } {
  const limit = options.limit ?? 20;
  const results = races()
    .map((race) => ({
      race,
      score: scoreText(
        `${race.name} ${race.name} ${race.plural ?? ""} ${race.models.map((m) => m.tag).join(" ")}`,
        query
      )
    }))
    .filter((entry) => entry.score > 0)
    .sort((a, b) => b.score - a.score || a.race.id - b.race.id)
    .slice(0, limit)
    .map((entry) => entry.race);
  return { query, results, disclaimer: EQL_CLIENT_DISCLAIMER };
}

// Resolve a race by numeric RaceID or by name. A name can match several RaceIDs
// (a playable race and its NPC-model variants share a name), so name lookups
// return every match; an id lookup returns the single row.
export function getEqlClientRace(idOrName: string | number): {
  query: string;
  matches: EqlClientRace[];
  disclaimer: string;
} | undefined {
  const numericId = typeof idOrName === "number" ? idOrName : Number(String(idOrName).trim());
  const nameKey = typeof idOrName === "string" ? idOrName.trim().toLowerCase() : "";
  const all = races();

  let matches: EqlClientRace[];
  if (Number.isInteger(numericId) && String(idOrName).trim() !== "") {
    matches = all.filter((race) => race.id === numericId);
  } else {
    matches = all.filter((race) => race.name.toLowerCase() === nameKey);
  }
  if (matches.length === 0) {
    return undefined;
  }
  return { query: String(idOrName), matches, disclaimer: EQL_CLIENT_DISCLAIMER };
}

export function listEqlClientRaces(options: { limit?: number } = {}): {
  count: number;
  races: Array<{ id: number; name: string; tags: string[]; size: number }>;
  disclaimer: string;
} {
  const all = races();
  const limit = options.limit ?? all.length;
  const list = all.slice(0, limit).map((race) => ({
    id: race.id,
    name: race.name,
    tags: race.models.map((m) => m.tag),
    size: race.size
  }));
  return { count: all.length, races: list, disclaimer: EQL_CLIENT_DISCLAIMER };
}

// --- Manual supplement ----------------------------------------------------

export function searchEqlClientManual(
  query: string,
  options: { limit?: number } = {}
): {
  query: string;
  results: Array<{ title: string; snippet: string }>;
  disclaimer: string;
} {
  const limit = options.limit ?? 8;
  const results = manualSections()
    .map((section) => ({
      section,
      score: scoreText(`${section.title} ${section.title} ${section.body}`, query)
    }))
    .filter((entry) => entry.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map((entry) => ({
      title: entry.section.title,
      snippet: snippetAround(entry.section.body, query, 400)
    }));
  return { query, results, disclaimer: EQL_CLIENT_DISCLAIMER };
}

export function getEqlClientManualSection(title: string): {
  section: EqlClientManualSection;
  disclaimer: string;
} | undefined {
  const key = title.trim().toLowerCase();
  const exact = manualSections().find((section) => section.title.toLowerCase() === key);
  const section = exact ?? manualSections().find((s) => s.title.toLowerCase().includes(key));
  if (!section) {
    return undefined;
  }
  return { section, disclaimer: EQL_CLIENT_DISCLAIMER };
}

export function listEqlClientManualSections(): {
  count: number;
  sections: Array<{ title: string; preview: string }>;
  disclaimer: string;
} {
  const sections = manualSections().map((section) => ({
    title: section.title,
    preview: truncateText(section.body, 120)
  }));
  return { count: sections.length, sections, disclaimer: EQL_CLIENT_DISCLAIMER };
}

// --- Zones + points of interest --------------------------------------------

// List (or filter) the zones shipped in the client's map files. A query matches
// zone keys and POI labels, so "where is Pottery" style lookups surface the
// zones that contain a matching point of interest.
export function listEqlClientZones(options: { query?: string; limit?: number } = {}): {
  /** Total zones (no query) or total matches (with query) before the limit. */
  total: number;
  returned: number;
  zones: Array<{ zone: string; layers: number; poiCount: number; matchingPois?: EqlClientPoi[] }>;
  note: string;
} {
  const all = zones();
  const query = options.query?.trim();
  if (!query) {
    const limit = options.limit ?? all.length;
    const returned = all.slice(0, limit).map(({ pois, ...zone }) => zone);
    return { total: all.length, returned: returned.length, zones: returned, note: EQL_ZONES_NOTE };
  }

  const limit = options.limit ?? 20;
  const scored = all
    .map((zone) => {
      const matchingPois = zone.pois.filter((poi) => scoreText(poi.label, query) > 0);
      const score = scoreText(`${zone.zone} ${zone.zone}`, query) + matchingPois.length;
      return { zone, matchingPois, score };
    })
    .filter((entry) => entry.score > 0)
    // Genuine-EQL-first: zones matching classic expansion codes rank after
    // unhinted zones regardless of score, then by score.
    .sort(
      (a, b) =>
        Number(a.zone.classicExpansionHint !== null) - Number(b.zone.classicExpansionHint !== null) ||
        b.score - a.score ||
        a.zone.zone.localeCompare(b.zone.zone)
    );

  const limited = scored.slice(0, limit);
  return {
    total: scored.length,
    returned: limited.length,
    zones: limited.map((entry) => ({
      zone: entry.zone.zone,
      layers: entry.zone.layers,
      poiCount: entry.zone.poiCount,
      classicExpansionHint: entry.zone.classicExpansionHint,
      ...(entry.matchingPois.length > 0 ? { matchingPois: entry.matchingPois.slice(0, 25) } : {})
    })),
    note: EQL_ZONES_NOTE
  };
}

// Exact key match only: a substring fallback would silently resolve "west" to
// an arbitrary alphabetical zone. Near-misses are returned as suggestions.
export function getEqlClientZone(zoneKey: string):
  | { found: true; zone: EqlClientZone; note: string }
  | { found: false; suggestions: string[] } {
  const key = zoneKey.trim().toLowerCase();
  const all = zones();
  const zone = all.find((z) => z.zone === key);
  if (zone) {
    return { found: true, zone, note: EQL_ZONES_NOTE };
  }
  const suggestions = all.filter((z) => z.zone.includes(key)).map((z) => z.zone);
  return { found: false, suggestions };
}

// --- Storylines ---------------------------------------------------------------

export function searchEqlClientStorylines(
  query: string,
  options: { limit?: number } = {}
): {
  query: string;
  results: Array<{ id: string; title: string; snippet: string }>;
  note: string;
} {
  const limit = options.limit ?? 8;
  const results = storylines()
    .map((story) => ({
      story,
      score: scoreText(`${story.id} ${story.title} ${story.title} ${story.body}`, query)
    }))
    .filter((entry) => entry.score > 0)
    .sort((a, b) => b.score - a.score || a.story.id.localeCompare(b.story.id))
    .slice(0, limit)
    .map((entry) => {
      const eraAdvisory = detectNonLaunchEra(`${entry.story.title}\n${entry.story.body}`);
      return {
        id: entry.story.id,
        title: entry.story.title,
        snippet: snippetAround(entry.story.body, query, 400),
        ...(eraAdvisory.flagged ? { eraAdvisory } : {})
      };
    });
  return { query, results, note: EQL_STORYLINES_NOTE };
}

export function getEqlClientStoryline(idOrTitle: string): {
  storyline: EqlClientStoryline;
  eraAdvisory?: EraAdvisory;
  note: string;
} | undefined {
  const key = idOrTitle.trim().toLowerCase();
  const all = storylines();
  let storyline =
    all.find((story) => story.id.toLowerCase() === key) ??
    all.find((story) => story.title.toLowerCase() === key);
  if (!storyline) {
    // A substring match is only trusted when it is unambiguous; generic terms
    // ("dark", "the") would otherwise silently return an arbitrary story.
    const partial = all.filter((story) => story.title.toLowerCase().includes(key));
    if (partial.length === 1) storyline = partial[0];
  }
  if (!storyline) {
    return undefined;
  }
  const eraAdvisory = detectNonLaunchEra(`${storyline.title}\n${storyline.body}`);
  return {
    storyline,
    ...(eraAdvisory.flagged ? { eraAdvisory } : {}),
    note: EQL_STORYLINES_NOTE
  };
}

export function listEqlClientStorylines(): {
  count: number;
  storylines: Array<{ id: string; title: string; preview: string }>;
} {
  const all = storylines().map((story) => ({
    id: story.id,
    title: story.title,
    preview: truncateText(story.body, 120)
  }));
  return { count: all.length, storylines: all };
}
