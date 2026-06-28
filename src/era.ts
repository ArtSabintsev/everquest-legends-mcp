// EverQuest Legends launches pre-Kunark. The community wiki this server reads
// inherits classic EverQuest data and frequently describes zones, cities,
// factions, items, and quests from later expansions (Kunark, Velious, Luclin)
// that are not in the launch game. This module detects that content so callers
// can be warned rather than treating it as launch-live.

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
  firstExpansion: "Kunark",
  laterExpansions: ["Velious", "Luclin"],
  note:
    "EverQuest Legends launches pre-Kunark: continents Antonica, Faydwer, and Odus plus the classic Planes (Sky, Hate, Fear). Kunark is the first expansion; Velious and Luclin come later. The community wiki inherits classic EverQuest data and may describe zones, cities, factions, items, and quests from those later eras that are not in the launch game."
} as const;

// High-precision landmark terms that each indicate a specific post-launch
// expansion. Terms are chosen to avoid colliding with launch content (for
// example "Sebilis" is excluded because EQL's Iksar start is the launch-only
// "New Sebilis Expedition").
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
    `This text references ${list} content, which is NOT in EverQuest Legends' pre-Kunark launch ` +
    "(continents Antonica, Faydwer, and Odus plus the classic Planes of Sky, Hate, and Fear). " +
    "Kunark is the first expansion; Velious and Luclin come later. " +
    `Treat any zones, cities, factions, items, deity quests, or gear tied to ${list} as not yet available at launch.`
  );
}

/**
 * Scan text for references to post-launch EverQuest expansions and return a
 * structured advisory. Returns an unflagged advisory when nothing is found.
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
