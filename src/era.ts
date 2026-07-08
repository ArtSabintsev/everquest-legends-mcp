// EverQuest Legends is a custom reimagining of classic EverQuest, scoped to the
// original continents. The classic expansions (Kunark, Velious, Luclin) do not
// exist in this game, but the community wiki and archive sources this server
// reads inherit classic EverQuest data and frequently describe zones, cities,
// factions, items, and quests from them. This module detects that content so
// callers can be warned rather than treating it as part of EverQuest Legends.

export type EraName = "Kunark" | "Velious" | "Luclin";

export type EraAdvisory = {
  flagged: boolean;
  eras: EraName[];
  markers: string[];
  note: string;
};

export const EQL_LAUNCH_SCOPE = {
  era: "pre-Kunark",
  continents: ["Antonica", "Faydwer", "Odus"],
  includedRaidContent: ["Plane of Sky", "Plane of Hate", "Plane of Fear"],
  classicExpansionsNotInGame: ["Kunark", "Velious", "Luclin"],
  note:
    "EverQuest Legends is a custom reimagining of classic EverQuest scoped to the continents Antonica, Faydwer, and Odus plus the classic Planes (Sky, Hate, Fear). The classic expansions (Kunark, Velious, Luclin) do not exist in this game. Community wikis and archives inherit classic EverQuest data and may describe zones, cities, factions, items, and quests from those expansions — and because the game is custom, even in-scope zones, mobs, and items can differ from their classic EverQuest counterparts."
} as const;

// High-precision landmark terms that each indicate a specific classic-EverQuest
// expansion absent from EverQuest Legends. Terms are chosen to avoid colliding
// with in-game content (for example "Sebilis" is excluded because EQL's Iksar
// start is the game's own "New Sebilis Expedition").
const ERA_MARKERS: ReadonlyArray<{ era: EraName; term: string }> = [
  { era: "Kunark", term: "Kunark" },
  { era: "Kunark", term: "Cabilis" },
  { era: "Kunark", term: "Firiona Vie" },
  { era: "Kunark", term: "Overthere" },
  { era: "Kunark", term: "Lake of Ill Omen" },
  { era: "Kunark", term: "Trakanon" },
  { era: "Kunark", term: "Veeshan's Peak" },
  { era: "Kunark", term: "Chardok" },
  { era: "Kunark", term: "Karnor's Castle" },
  { era: "Velious", term: "Velious" },
  { era: "Velious", term: "Thurgadin" },
  { era: "Velious", term: "Kael Drakkal" },
  { era: "Velious", term: "Skyshrine" },
  { era: "Velious", term: "Velketor" },
  { era: "Velious", term: "Coldain" },
  { era: "Velious", term: "Kromrif" },
  { era: "Velious", term: "Kromzek" },
  { era: "Velious", term: "Siren's Grotto" },
  { era: "Velious", term: "Sleeper's Tomb" },
  { era: "Luclin", term: "Luclin" },
  { era: "Luclin", term: "Shar Vahl" },
  { era: "Luclin", term: "Vah Shir" },
  { era: "Luclin", term: "Sanctus Seru" },
  { era: "Luclin", term: "Shadow Haven" },
  { era: "Luclin", term: "Akheva" }
];

const MAX_MARKERS = 12;

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

const ERA_PATTERNS = ERA_MARKERS.map((marker) => ({
  era: marker.era,
  term: marker.term,
  pattern: new RegExp(`\\b${escapeRegExp(marker.term)}\\b`, "i")
}));

function emptyAdvisory(): EraAdvisory {
  return { flagged: false, eras: [], markers: [], note: "" };
}

function buildNote(eras: EraName[]): string {
  const list = eras.join(", ");
  return (
    `This text references ${list} content from classic EverQuest, which is NOT in EverQuest Legends ` +
    "(a custom game scoped to Antonica, Faydwer, and Odus plus the classic Planes of Sky, Hate, and Fear). " +
    `Treat any zones, cities, factions, items, deity quests, or gear tied to ${list} as absent from the game — ` +
    "and note that even in-scope content can differ from classic EverQuest, because the game is a custom reimagining."
  );
}

/**
 * Scan text for references to classic EverQuest expansion content that does
 * not exist in EverQuest Legends and return a structured advisory. Returns an
 * unflagged advisory when nothing is found.
 */
export function detectNonLaunchEra(text: string): EraAdvisory {
  if (!text) {
    return emptyAdvisory();
  }

  const eras = new Set<EraName>();
  const markers: string[] = [];
  const seen = new Set<string>();

  for (const { era, term, pattern } of ERA_PATTERNS) {
    if (pattern.test(text)) {
      eras.add(era);
      if (!seen.has(term)) {
        seen.add(term);
        markers.push(term);
      }
    }
  }

  if (markers.length === 0) {
    return emptyAdvisory();
  }

  const eraList = [...eras];
  return {
    flagged: true,
    eras: eraList,
    markers: markers.slice(0, MAX_MARKERS),
    note: buildNote(eraList)
  };
}
