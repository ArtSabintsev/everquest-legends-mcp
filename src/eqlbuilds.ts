import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { scoreText, truncateText } from "./text.js";

// Structured EQL Legends build data extracted from eqlbuilds.com. The snapshot
// under ./data/eqlbuilds is refreshed out-of-band by scripts/extract-eqlbuilds.mjs
// (see that file and .github/workflows/refresh-eqlbuilds.yml). This module only
// reads the committed snapshot; it performs no network access, matching the
// read-only, offline-friendly design of the rest of the server.

const DATA_DIR = new URL("./data/eqlbuilds/", import.meta.url);

export const EQLBUILDS_DISCLAIMER =
  "Data extracted from the eqlbuilds.com build planner (an unofficial community tool). Values are derived from EQL Legends client files and a vendored EQL Wiki Alternate Advancement snapshot; treat as community reference, not official Daybreak documentation.";

export type EqlBuildsManifest = {
  source: string;
  sourceUrl: string;
  bundleUrls: string[];
  bundleSha256: string;
  extractorVersion: number;
  extractedAt: string;
  wikiRevisionId: number | null;
  wikiRevisionTimestamp: string | null;
  counts: Record<string, number>;
};

export type EqlBuildsMeta = {
  apiUrl: string;
  comment: string;
  pageId: number;
  parentId: number;
  revisionId: number;
  timestamp: string;
  title: string;
  url: string;
  user: string;
  rowCount: number;
  uniqueAbilityCount: number;
};

export type EqlBuildsRace = {
  description: string;
  initialAbility: string;
  racialTraits: unknown[];
};

export type EqlBuildsInactiveRace = {
  id: string;
  name: string;
  description: string;
  initialAbility: string;
  racialTraits: unknown[];
  status: string;
};

export type EqlBuildsAbility = {
  category: string;
  classes: string[];
  costLabel: string;
  costStatus: string;
  dbstrId: number;
  description: string;
  group: string;
  id: string;
  isActivated: boolean;
  isAutoGranted: boolean;
  maxRank: number;
  name: string;
  rankCosts: Array<number | null>;
  rankSpells: unknown[];
  requirements: unknown[];
  sourceRevisionId: number;
  wikiName: string;
};

export type EqlBuildsSpell = {
  id: number;
  name: string;
  iconId: number;
  level: number;
  description: string;
  resolvedDescription: string;
  manaCost: number;
  range: number;
  castTime: string;
  recastTimeMs: number;
  durationTicks: number;
  duration: string;
  skill: string;
  targetTypeId: number;
  effects: Array<Record<string, unknown>>;
  messages: string[];
};

export type EqlBuildsSkill = {
  id: number;
  name: string;
  trainedAt: number;
  cap: number;
  description: string;
};

export type EqlBuildsClass = {
  armor: string[];
  alternateAbilityList: EqlBuildsAbility[];
  description: string;
  spellList: EqlBuildsSpell[];
  skillList: EqlBuildsSkill[];
};

export type EqlBuildsMode = {
  id: string;
  name: string;
  message: string;
  description: string;
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

const races = () => load<Record<string, EqlBuildsRace>>("races.json");
const inactiveRaces = () => load<EqlBuildsInactiveRace[]>("races-inactive.json");
const classes = () => load<Record<string, EqlBuildsClass>>("classes.json");
const generalAbilities = () => load<EqlBuildsAbility[]>("general-abilities.json");
const stances = () => load<EqlBuildsMode[]>("stances.json");
const invocations = () => load<EqlBuildsMode[]>("invocations.json");
const notes = () => load<string[]>("notes.json");
const meta = () => load<EqlBuildsMeta>("meta.json");
const manifest = () => load<EqlBuildsManifest>("manifest.json");

// camelCase / lowercase ids (shadowKnight, highElf) -> display names.
export function prettifyId(id: string): string {
  const spaced = id.replace(/([a-z0-9])([A-Z])/g, "$1 $2");
  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
}

export function getEqlBuildsProvenance(): {
  disclaimer: string;
  manifest: EqlBuildsManifest;
  wikiSource: EqlBuildsMeta;
  extractionNotes: string[];
} {
  return {
    disclaimer: EQLBUILDS_DISCLAIMER,
    manifest: manifest(),
    wikiSource: meta(),
    extractionNotes: notes()
  };
}

export function listEqlBuildsRaces(includeInactive = false): {
  races: Array<{ id: string; name: string; initialAbility: string; description: string }>;
  inactive: Array<{ id: string; name: string; status: string }>;
  disclaimer: string;
} {
  const active = Object.entries(races()).map(([id, race]) => ({
    id,
    name: prettifyId(id),
    initialAbility: race.initialAbility,
    description: truncateText(race.description, 280)
  }));
  const inactive =
    includeInactive
      ? inactiveRaces().map((race) => ({ id: race.id, name: race.name, status: race.status }))
      : [];
  return { races: active, inactive, disclaimer: EQLBUILDS_DISCLAIMER };
}

export function getEqlBuildsRace(id: string): (EqlBuildsRace & { id: string; name: string; status?: string }) | undefined {
  const key = id.trim();
  const active = races()[key];
  if (active) {
    return { id: key, name: prettifyId(key), ...active };
  }
  const lower = key.toLowerCase();
  const activeCi = Object.entries(races()).find(([raceId]) => raceId.toLowerCase() === lower);
  if (activeCi) {
    return { id: activeCi[0], name: prettifyId(activeCi[0]), ...activeCi[1] };
  }
  const inactive = inactiveRaces().find((race) => race.id.toLowerCase() === lower);
  if (inactive) {
    const { status, ...rest } = inactive;
    return { ...rest, status };
  }
  return undefined;
}

export function listEqlBuildsClasses(): {
  classes: Array<{
    id: string;
    name: string;
    armor: string[];
    spellCount: number;
    skillCount: number;
    alternateAbilityCount: number;
    description: string;
  }>;
  disclaimer: string;
} {
  const list = Object.entries(classes()).map(([id, cls]) => ({
    id,
    name: prettifyId(id),
    armor: cls.armor,
    spellCount: cls.spellList.length,
    skillCount: cls.skillList.length,
    alternateAbilityCount: cls.alternateAbilityList.length,
    description: truncateText(cls.description ?? "", 280)
  }));
  return { classes: list, disclaimer: EQLBUILDS_DISCLAIMER };
}

export type ClassDetailOptions = {
  includeSpells?: boolean;
  includeSkills?: boolean;
  includeAbilities?: boolean;
};

// Class payloads are large (dozens of spells/AAs each); heavy lists are opt-in so
// a default read stays small. Use the dedicated search tools to query spells/AAs.
export function getEqlBuildsClass(id: string, options: ClassDetailOptions = {}):
  | {
      id: string;
      name: string;
      armor: string[];
      description: string;
      spellCount: number;
      skillCount: number;
      alternateAbilityCount: number;
      spellList?: EqlBuildsSpell[];
      skillList?: EqlBuildsSkill[];
      alternateAbilityList?: EqlBuildsAbility[];
      disclaimer: string;
    }
  | undefined {
  const key = id.trim();
  const all = classes();
  const found = all[key] ?? all[Object.keys(all).find((c) => c.toLowerCase() === key.toLowerCase()) ?? ""];
  if (!found) {
    return undefined;
  }
  const resolvedId = all[key] ? key : (Object.keys(all).find((c) => c.toLowerCase() === key.toLowerCase()) as string);
  return {
    id: resolvedId,
    name: prettifyId(resolvedId),
    armor: found.armor,
    description: found.description ?? "",
    spellCount: found.spellList.length,
    skillCount: found.skillList.length,
    alternateAbilityCount: found.alternateAbilityList.length,
    ...(options.includeSpells ? { spellList: found.spellList } : {}),
    ...(options.includeSkills ? { skillList: found.skillList } : {}),
    ...(options.includeAbilities ? { alternateAbilityList: found.alternateAbilityList } : {}),
    disclaimer: EQLBUILDS_DISCLAIMER
  };
}

export function searchEqlBuildsSpells(
  query: string,
  options: { classId?: string; limit?: number } = {}
): {
  query: string;
  results: Array<EqlBuildsSpell & { classes: string[] }>;
  disclaimer: string;
} {
  const limit = options.limit ?? 15;
  const classFilter = options.classId?.trim().toLowerCase();
  const byId = new Map<number, EqlBuildsSpell & { classes: Set<string> }>();

  for (const [classId, cls] of Object.entries(classes())) {
    if (classFilter && classId.toLowerCase() !== classFilter) {
      continue;
    }
    for (const spell of cls.spellList) {
      const existing = byId.get(spell.id);
      if (existing) {
        existing.classes.add(classId);
      } else {
        byId.set(spell.id, { ...spell, classes: new Set([classId]) });
      }
    }
  }

  const results = [...byId.values()]
    .map((spell) => ({
      spell,
      score: scoreText(`${spell.name} ${spell.name} ${spell.resolvedDescription} ${spell.skill}`, query)
    }))
    .filter((entry) => entry.score > 0)
    .sort((a, b) => b.score - a.score || a.spell.level - b.spell.level)
    .slice(0, limit)
    .map(({ spell }) => ({ ...spell, classes: [...spell.classes].sort() }));

  return { query, results, disclaimer: EQLBUILDS_DISCLAIMER };
}

export function searchEqlBuildsAbilities(
  query: string,
  options: { classId?: string; category?: string; limit?: number } = {}
): {
  query: string;
  results: EqlBuildsAbility[];
  disclaimer: string;
} {
  const limit = options.limit ?? 15;
  const classFilter = options.classId?.trim().toLowerCase();
  const categoryFilter = options.category?.trim().toLowerCase();
  const byId = new Map<string, EqlBuildsAbility>();

  const consider = (ability: EqlBuildsAbility) => {
    if (!byId.has(ability.id)) {
      byId.set(ability.id, ability);
    }
  };

  for (const ability of generalAbilities()) {
    consider(ability);
  }
  for (const cls of Object.values(classes())) {
    for (const ability of cls.alternateAbilityList) {
      consider(ability);
    }
  }

  const results = [...byId.values()]
    .filter((ability) => !classFilter || ability.classes.some((c) => c.toLowerCase() === classFilter))
    .filter((ability) => !categoryFilter || ability.category.toLowerCase() === categoryFilter)
    .map((ability) => ({
      ability,
      score: scoreText(`${ability.name} ${ability.name} ${ability.description} ${ability.group}`, query)
    }))
    .filter((entry) => entry.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map(({ ability }) => ability);

  return { query, results, disclaimer: EQLBUILDS_DISCLAIMER };
}

export function listEqlBuildsSkills(classId: string): {
  classId: string;
  name: string;
  skills: EqlBuildsSkill[];
  disclaimer: string;
} | undefined {
  const all = classes();
  const resolvedId = all[classId.trim()]
    ? classId.trim()
    : Object.keys(all).find((c) => c.toLowerCase() === classId.trim().toLowerCase());
  if (!resolvedId) {
    return undefined;
  }
  return {
    classId: resolvedId,
    name: prettifyId(resolvedId),
    skills: all[resolvedId].skillList,
    disclaimer: EQLBUILDS_DISCLAIMER
  };
}

export function listEqlBuildsModes(): {
  stances: EqlBuildsMode[];
  invocations: EqlBuildsMode[];
  disclaimer: string;
} {
  return { stances: stances(), invocations: invocations(), disclaimer: EQLBUILDS_DISCLAIMER };
}
