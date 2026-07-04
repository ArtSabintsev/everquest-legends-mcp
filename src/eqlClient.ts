import { readFileSync } from "node:fs";
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
  "Reference text extracted directly from a local EverQuest Legends client install (slash commands, race/model table, manual supplement). This is game client data, not curated Daybreak documentation; the manual supplement in particular carries legacy EverQuest text that predates Legends. For playable-race and class build detail, prefer the eql_builds_* tools.";

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
