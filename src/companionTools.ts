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
      "eqltools-osxeql",
      "osxeql-github"
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
  },
  {
    id: "eqlforge",
    name: "EQLForge",
    url: "https://eqlforge.com/",
    homeUrl: "https://eqlforge.com/",
    access: "interactive-spa",
    capabilities: [
      "trio-builder",
      "aa",
      "gear",
      "classes",
      "items",
      "spells",
      "zones",
      "leveling",
      "exaltations",
      "plane-of-sky"
    ],
    sourceIds: ["eqlforge-home"],
    summary:
      "Unofficial trio, AA, and gear planner covering all 560 class combos, plus community builds.",
    notes: [
      "Homepage HTML introduces the trio system, but the build forge, AA planner, and gear tools are interactive.",
      "Community builds and scores are unofficial; prefer eqlwiki, eqlbuilds, and client data when they disagree."
    ]
  },
  {
    id: "everquest-companion",
    name: "EverQuest Companion",
    url: "https://github.com/jmoyers/everquest-companion",
    homeUrl: "https://github.com/jmoyers/everquest-companion",
    access: "pointer-only",
    capabilities: ["log-tools", "dps-parser", "plane-of-sky", "quests"],
    sourceIds: ["everquest-companion"],
    summary:
      "Free Windows log companion: real-time DPS meter, overlays, quest and boss tracking, and a Plane of Sky tracker.",
    notes: [
      "Pointer-only GitHub project. This MCP does not fetch releases, installers, or player logs.",
      "Reads the local game log on the player's machine."
    ]
  },
  {
    id: "basabots",
    name: "BasaBots",
    url: "https://basabots.com/",
    homeUrl: "https://basabots.com/",
    access: "pointer-only",
    capabilities: ["log-tools", "dps-parser", "zones", "items", "exaltations", "plane-of-sky"],
    sourceIds: ["basabots-home"],
    summary:
      "Paid desktop all-in-one (live maps, DPS meter, quest tracking, spoken alerts). About $3/month after a 7-day trial.",
    notes: [
      "Commercial product: 7-day free trial, then about $3/month via Stripe.",
      "Pointer-only marketing site. Do not scrape app backends, billing, or account APIs.",
      "Desktop features run locally from the player's game log."
    ]
  },
  {
    id: "eqbuddy",
    name: "EQBuddy",
    url: "https://github.com/DranakCorps-bot/EQBuddy",
    homeUrl: "https://github.com/DranakCorps-bot/EQBuddy",
    access: "pointer-only",
    capabilities: ["log-tools", "dps-parser"],
    sourceIds: ["eqbuddy"],
    summary:
      "Always-on-top session tracker: live kills, DPS, loot, money, and XP parsed from the EverQuest Legends log.",
    notes: [
      "Pointer-only GitHub project. This MCP does not install the widget or read player logs."
    ]
  },
  {
    id: "seqo",
    name: "seqo (Simple EQ Overlay)",
    url: "https://github.com/RealMaeel/seqo",
    homeUrl: "https://github.com/RealMaeel/seqo",
    access: "pointer-only",
    capabilities: ["log-tools", "dps-parser", "zones"],
    sourceIds: ["seqo"],
    summary: "Log-powered overlay companion for EverQuest Legends (Simple EQ Overlay), including zone context.",
    notes: [
      "Pointer-only GitHub project. Local log reader; not fetched or installed by this MCP."
    ]
  },
  {
    id: "eql-meter",
    name: "eql-meter",
    url: "https://github.com/kpxcoolx/eql-meter",
    homeUrl: "https://github.com/kpxcoolx/eql-meter",
    access: "pointer-only",
    capabilities: ["dps-parser", "log-tools"],
    sourceIds: ["eql-meter"],
    summary: "Live combat meter for EverQuest Legends: DPS overlay and real-time fight tracking from the game log.",
    notes: [
      "Pointer-only GitHub project. This MCP does not install the meter or read player logs."
    ]
  },
  {
    id: "eql-alerts",
    name: "eql-alerts",
    url: "https://github.com/kpxcoolx/eql-alerts",
    homeUrl: "https://github.com/kpxcoolx/eql-alerts",
    access: "pointer-only",
    capabilities: ["log-tools"],
    sourceIds: ["eql-alerts"],
    summary: "Log triggers for EverQuest Legends: overlays, timers, sounds, and voice callouts.",
    notes: [
      "Pointer-only GitHub project. Trigger rules run locally; this MCP does not fetch or execute them."
    ]
  },
  {
    id: "eql-maps",
    name: "eql-maps",
    url: "https://github.com/crande25/eql-maps",
    homeUrl: "https://github.com/crande25/eql-maps",
    access: "pointer-only",
    capabilities: ["zones"],
    sourceIds: ["eql-maps"],
    summary: "Community in-game maps for new or altered EverQuest Legends zones.",
    notes: [
      "Pointer-only GitHub map pack for EQL zones.",
      "Not the classic EverQuest Brewall / eqmaps.info map set."
    ]
  },
  {
    id: "eql-class-choice-sheet",
    name: "EQL Role Matrix (spreadsheet)",
    url: "https://docs.google.com/spreadsheets/d/1mK-uCNN9Vpd3bxaBUXurGN_pnuxYjALet2KbezJgEpc/htmlview",
    homeUrl: "https://docs.google.com/spreadsheets/d/1mK-uCNN9Vpd3bxaBUXurGN_pnuxYjALet2KbezJgEpc/htmlview",
    access: "pointer-only",
    capabilities: ["classes", "spreadsheet"],
    sourceIds: ["eql-class-choice-sheet"],
    summary: "Community Google Sheet (EQL Role Matrix) for comparing class roles when choosing a trio.",
    notes: [
      "Pointer-only — spreadsheet HTML is a poor machine-readable source.",
      "Author-curated community notes, not official balance data."
    ]
  },
  {
    id: "eql-class-perks-sheet",
    name: "EQL Class Perks (spreadsheet)",
    url: "https://docs.google.com/spreadsheets/d/1NTWuwYZrGVkLy2uldQbJlv_9piOhqWAUf7v7Qe-GO7c/edit",
    homeUrl: "https://docs.google.com/spreadsheets/d/1NTWuwYZrGVkLy2uldQbJlv_9piOhqWAUf7v7Qe-GO7c/edit",
    access: "pointer-only",
    capabilities: ["classes", "spreadsheet"],
    sourceIds: ["eql-class-perks-sheet"],
    summary: "Community Google Sheet of EverQuest Legends class perks (iamisandisnt).",
    notes: [
      "Pointer-only — the editor view needs a browser and is not a machine-readable source.",
      "Author-curated community notes, not official balance data."
    ]
  },
  {
    id: "eql-top-items",
    name: "EQ Legends Top Items",
    url: "https://github.com/lab1702/eq-legends-top-items",
    homeUrl: "https://github.com/lab1702/eq-legends-top-items",
    access: "pointer-only",
    capabilities: ["gear", "items"],
    sourceIds: ["eql-top-items"],
    summary:
      "Early community-sourced reference of recommended EverQuest Legends items: what each does and how to get it.",
    notes: [
      "Early and community-sourced — not a complete or authoritative item database.",
      "Pointer-only GitHub project. Prefer eqlwiki and client data when they disagree."
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
