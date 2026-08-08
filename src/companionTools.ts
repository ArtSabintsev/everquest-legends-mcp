// Catalog of post-launch community companion tools for EverQuest Legends.
// These are not official Daybreak products. Structured item/drop APIs are rare:
// several sites are interactive SPAs or deliberately lock /api/* to their own
// origin (see eqlegendstools robots.txt + 403). The MCP exposes pointers and
// searchable HTML primers; it does not bypass site-private APIs.

export const COMPANION_TOOLS_DISCLAIMER =
  "Community companion tools, not official Daybreak documentation. Prefer eqlwiki, eqlbuilds snapshots, client reference data, and official pages when sources disagree. Never scrape locked /api endpoints that robots.txt or the host forbid.";

export type CompanionAccess =
  | "html-searchable"
  | "pointer-only"
  | "interactive-spa"
  | "api-origin-locked";

export type CompanionCapability =
  | "gear"
  | "exaltations"
  | "weapons"
  | "procs"
  | "focus-effects"
  | "clickies"
  | "worn-effects"
  | "items"
  | "drops"
  | "mobs"
  | "zones"
  | "quests"
  | "plane-of-sky"
  | "spells"
  | "aa"
  | "classes"
  | "trio-builder"
  | "leveling"
  | "combat-primer"
  | "dps-parser"
  | "leaderboards"
  | "log-tools"
  | "mac-client"
  | "spreadsheet";

export type CompanionTool = {
  id: string;
  name: string;
  url: string;
  homeUrl: string;
  access: CompanionAccess;
  capabilities: CompanionCapability[];
  /** Linked ids in SOURCE_PAGES when present. */
  sourceIds: string[];
  summary: string;
  notes: string[];
};

export const COMPANION_TOOLS: CompanionTool[] = [
  {
    id: "eqlegendstools",
    name: "EQ Legends Tools",
    url: "https://eqlegendstools.com/",
    homeUrl: "https://eqlegendstools.com/",
    access: "api-origin-locked",
    capabilities: [
      "gear",
      "weapons",
      "exaltations",
      "procs",
      "focus-effects",
      "clickies",
      "worn-effects",
      "plane-of-sky",
      "items"
    ],
    sourceIds: [
      "eqlegendstools-home",
      "eqlegendstools-items",
      "eqlegendstools-weapons",
      "eqlegendstools-bis-gear",
      "eqlegendstools-procs",
      "eqlegendstools-focus",
      "eqlegendstools-clickies",
      "eqlegendstools-worn",
      "eqlegendstools-posky",
      "eqlegendstools-char-sheet"
    ],
    summary:
      "BiS/exaltation planner with weapon, proc, focus, clicky, worn-effect search and Plane of Sky quest tracking. Curated bi-weekly by FlammHammer.",
    notes: [
      "JSON /api/* is origin-locked (403) and robots.txt Disallow — do not scrape those endpoints.",
      "Public /items/ and /items/<slug>/ pages are server-rendered; use eql_eqlegendstools_item_search and eql_eqlegendstools_item.",
      "Interactive planners (BiS, exaltations, PoS tracker) still require a browser."
    ]
  },
  {
    id: "eqltools",
    name: "EQL Tools",
    url: "https://eqltools.com/",
    homeUrl: "https://eqltools.com/",
    access: "html-searchable",
    capabilities: [
      "trio-builder",
      "spells",
      "aa",
      "leveling",
      "zones",
      "combat-primer",
      "gear",
      "log-tools",
      "mac-client",
      "classes"
    ],
    sourceIds: [
      "eqltools-home",
      "eqltools-sources",
      "eqltools-learn",
      "eqltools-learn-trio",
      "eqltools-learn-difficulty",
      "eqltools-learn-experience",
      "eqltools-combat",
      "eqltools-learn-control",
      "eqltools-learn-pets",
      "eqltools-learn-upgrades",
      "eqltools-learn-motes",
      "eqltools-learn-spell-upgrades",
      "eqltools-learn-planar-gear",
      "eqltools-learn-aa",
      "eqltools-picker",
      "eqltools-spellmaster",
      "eqltools-atlas",
      "eqltools-osxeql"
    ],
    summary:
      "Player tools + primers built from client-mined and player-collected data: trio builder, spellmaster, AA planner, zone atlas, combat primers, osxEQL.",
    notes: [
      "Learn/* and /sources pages are static HTML and searchable via eql_source_search / eql_source_fetch.",
      "Interactive builders (picker, spellmaster, atlas) are client-side; registry entries may be pointer-only."
    ]
  },
  {
    id: "gnollguard",
    name: "Gnoll Guard",
    url: "https://www.gnollguard.com/",
    homeUrl: "https://www.gnollguard.com/",
    access: "interactive-spa",
    capabilities: ["items", "drops", "quests", "spells"],
    sourceIds: [
      "gnollguard-home",
      "gnollguard-items",
      "gnollguard-quests",
      "gnollguard-spells",
      "gnollguard-effects"
    ],
    summary:
      "Crowd-sourced EQL item database and log-assisted quest journal (items, drops, quests, spells, effects).",
    notes: [
      "Next.js SPA — little item text is server-rendered for agents.",
      "Best used as a human-facing companion; treat crowd data as unverified."
    ]
  },
  {
    id: "loadoutlegends",
    name: "Loadout Legends",
    url: "https://www.loadoutlegends.com/",
    homeUrl: "https://www.loadoutlegends.com/",
    access: "interactive-spa",
    capabilities: [
      "items",
      "drops",
      "mobs",
      "zones",
      "gear",
      "dps-parser",
      "leaderboards",
      "plane-of-sky",
      "log-tools"
    ],
    sourceIds: [
      "loadoutlegends-home",
      "loadoutlegends-database",
      "loadoutlegends-leaderboards",
      "loadoutlegends-parsing",
      "loadoutlegends-posky"
    ],
    summary:
      "Open-beta companion: automatic gear sync, DPS tools, leaderboards/speedruns, and a player-built zone/mob/drop database.",
    notes: [
      "Desktop sync app + log parsers are local/player-private; only public web pages are in scope.",
      "Database UI is an interactive SPA; no public unauthenticated JSON API found.",
      "Formulas and rankings may change during open beta."
    ]
  },
  {
    id: "eql-compendium",
    name: "EQL Compendium (spreadsheet)",
    url: "https://docs.google.com/spreadsheets/d/e/2PACX-1vRi6Kj604QLMm7kkkjdZSqtogtMtNgq3n9qqc2kaUS_s4LJcMoHbdTl3ph5T93_qs6awfZD0E2I5KeO/pubhtml",
    homeUrl: "https://docs.google.com/spreadsheets/d/e/2PACX-1vRi6Kj604QLMm7kkkjdZSqtogtMtNgq3n9qqc2kaUS_s4LJcMoHbdTl3ph5T93_qs6awfZD0E2I5KeO/pubhtml",
    access: "pointer-only",
    capabilities: ["leveling", "gear", "exaltations", "quests", "classes", "spreadsheet"],
    sourceIds: ["eql-compendium"],
    summary:
      "Community all-in-one Google Sheet (leveling, raiding, gear, exaltations, etc.) popularized around launch.",
    notes: [
      "Pointer-only — spreadsheet HTML is a poor machine-readable source.",
      "Author-curated community notes, not official balance data."
    ]
  }
];

export type CompanionToolsListOptions = {
  capability?: CompanionCapability;
  access?: CompanionAccess;
  query?: string;
};

export function listCompanionTools(options: CompanionToolsListOptions = {}): {
  disclaimer: string;
  count: number;
  tools: CompanionTool[];
} {
  const query = options.query?.trim().toLowerCase();
  const tools = COMPANION_TOOLS.filter((tool) => {
    if (options.capability && !tool.capabilities.includes(options.capability)) return false;
    if (options.access && tool.access !== options.access) return false;
    if (query) {
      const hay = `${tool.id} ${tool.name} ${tool.summary} ${tool.capabilities.join(" ")} ${tool.notes.join(" ")}`.toLowerCase();
      if (!hay.includes(query)) return false;
    }
    return true;
  });
  return {
    disclaimer: COMPANION_TOOLS_DISCLAIMER,
    count: tools.length,
    tools
  };
}

export function getCompanionTool(id: string): CompanionTool | undefined {
  const needle = id.trim().toLowerCase();
  return COMPANION_TOOLS.find((tool) => tool.id === needle || tool.name.toLowerCase() === needle);
}

export const COMPANION_CAPABILITIES = [
  "gear",
  "exaltations",
  "weapons",
  "procs",
  "focus-effects",
  "clickies",
  "worn-effects",
  "items",
  "drops",
  "mobs",
  "zones",
  "quests",
  "plane-of-sky",
  "spells",
  "aa",
  "classes",
  "trio-builder",
  "leveling",
  "combat-primer",
  "dps-parser",
  "leaderboards",
  "log-tools",
  "mac-client",
  "spreadsheet"
] as const satisfies readonly CompanionCapability[];

export const COMPANION_ACCESS_MODES = [
  "html-searchable",
  "pointer-only",
  "interactive-spa",
  "api-origin-locked"
] as const satisfies readonly CompanionAccess[];
