# Changelog

All notable changes to this project are documented here. The format is based on
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project adheres
to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [1.8.2] - 2026-09-09

### Changed

- Bump vitest from 4.1.11 to 5.0.0 (#26) (67017c4)
- Bump tsx from 4.23.12 to 4.23.13 (#27) (2a89429)

## [1.8.1] - 2026-09-09

### Changed

- Bump @types/node from 26.4.0 to 26.4.1 (#25) (0bc5ae5)

## [1.8.0] - 2026-09-07

### Added

- `eqlSpecificOnly` on `eql_youtube_sources` / `eql_youtube_videos` so weekday digests can skip mixed/variety channels before RSS fetch. Default remains `false` (all registered sources).
- Soft GitHub Actions job for `npm run check:youtube-sources` (weekly + PRs that touch YouTube sources). STALE stays informational; feed FAIL may fail the soft job but does not block release. `--json` summary for agents.
- Optional pointer-only `xHandle` / `xUrl` on YouTube sources. Official channel is `@EQ_Legends` (`https://x.com/EQ_Legends`). Creator handles are omitted unless verified from official/public pages.

## [1.7.0] - 2026-09-07

### Added

- add remaining EQL YouTube creators and a source-check script (01caf78)

## [1.6.0] - 2026-09-07

### Added

- add more recurring EQL creator YouTube feeds (d9520b6)

## [1.5.0] - 2026-09-07

### Added

- add post-launch EQL creator YouTube sources (38ef6ea)

## [1.4.9] - 2026-09-07

### Changed

- Bump vitest from 4.1.10 to 4.1.11 (#21) (4718c18)
- Bump zod from 4.4.3 to 4.5.4 (#23) (022e209)
- Bump @types/node from 26.2.0 to 26.4.0 (#22) (b22eb3e)

## [1.4.8] - 2026-09-07

### Changed

- refresh eql-client from CrossOver patch (518392d)

## [1.4.7] - 2026-08-26

### Changed

- refresh EQL Wiki commands data snapshot (wiki rev 172602) (34f942a)

## [1.4.6] - 2026-08-22

### Changed

- Refresh the local-client reference snapshot from the 2026-08-21 CrossOver
  patch (plugin 1.0.3.204, 59 files). Maps go 192 → 213 files and mapped zones
  133 → 138, adding Blackburrow, Solusek's Eye (soldunga), Nagafen's Lair
  (soldungb), Unrest, and The Warrens. POI totals drop 1717 → 1495: Daybreak
  rewrote the patched zone maps so geometry lives in the base file and
  labels (mostly zone connections) live in `_1.txt`, stripping inherited
  classic-EQ vendor/NPC pins from Qeynos, Rivervale, Steamfont, Toxxulia, and
  nearby zones. Verified against the raw map files. `dbstr_us.txt` also
  changed; race and command counts are unchanged.

## [1.4.5] - 2026-08-22

### Changed

- Bump @types/node from 26.1.2 to 26.2.0 (#18) (f64d916)

## [1.4.4] - 2026-08-22

### Changed

- Bump tsx from 4.23.1 to 4.23.12 (#20) (756b764)

## [1.4.3] - 2026-08-08

### Changed

- drop cross-package references from eql-client-update skill (6ef0cd6)

## [1.4.2] - 2026-08-08

### Changed

- alphabetize README sources; clarify Unreleased note rules (ce87fc4)

## [1.4.1] - 2026-08-08

### Changed

- include wiki-commands work in 1.4.0 changelog notes (fe2e8ca)

## [1.4.0] - 2026-08-08

### Added

- Blend EQL Wiki Commands into `eql_client_command` / `eql_client_command_search` (union of client-manual + wiki snapshots, tagged by source), with scheduled `refresh-eql-wiki-commands` workflow (#17).
- Post-launch community companion tools in the source registry (eqltools primers, EQ Legends Tools, Gnoll Guard, Loadout Legends, EQL Compendium) and `eql_companion_tools` catalog tool. Documents origin-locked APIs (eqlegendstools) without scraping them.
- `eql_eqlegendstools_item_search` / `eql_eqlegendstools_item` read public server-rendered item HTML on eqlegendstools.com (not the origin-locked `/api/*`).
- `VERSIONING.md` documents conventional-commit → semver → tag → GitHub Release automation.

## [1.3.10] - 2026-07-30

### Changed

- add eql-client-update skill for CrossOver client checks (e42b289)

## [1.3.9] - 2026-07-28

### Fixed

- retry the release push instead of failing on a racing merge (696f270)

## [1.3.8] - 2026-07-28

### Changed

- Bump tsx from 4.23.0 to 4.23.1 (#14) (dd6f6f3)
- Bump @types/node from 26.1.1 to 26.1.2 (#15) (60de03b)
- Bump @modelcontextprotocol/sdk from 1.29.0 to 1.30.0 (#16) (18b472e)
- Bump actions/setup-node from 6 to 7 (#13) (43d19b9)

## [1.3.7] - 2026-07-28

### Changed

- pin Dependabot to Tuesday and Thursday evenings ET (9d22328)

## [1.3.6] - 2026-07-28

### Fixed

- Detect Daybreak maintenance interstitials in the shared HTTP layer. During the
  launch-day window everquestlegends.com redirects to
  maintenance.daybreakgames.com and answers HTTP 200, so `eql_source_fetch`
  returned publisher boilerplate as official EQL source text and
  `eql_official_news` reported a page-structure change that had not happened.
  Affected fetches now fail with `UpstreamMaintenanceError`.

### Changed

- Refresh the local-client reference snapshot for the launch client (racedata
  2026-07-24, dbstr 2026-07-27, maps 2026-07-28). The patch ships 69 more map
  files: 133 mapped zones, up from 118, adding Plane of Sky, Plane of Fear,
  Befallen, Crushbone, Upper/Lower Guk, Mistmoore, Najena, Permafrost, Kedge
  Keep, Paw, Cazic-Thule, Butcherblock, East Karana, and the New Sebilis
  Expedition. POI totals drop 2436 -> 1717 because Daybreak stripped the
  inherited classic-EverQuest vendor and GM labels from city maps, which this
  snapshot had been serving as EQL locations. Kerran model size corrected to
  5.5.

## [1.3.5] - 2026-07-22

### Fixed

- make release push atomic to prevent orphaned tags (74c749e)

### Changed

- Bump typescript from 6.0.3 to 7.0.2 (#11) (1c9690a)
- Bump vitest from 4.1.9 to 4.1.10 (#12) (da9498a)
- Bump @types/node from 26.1.0 to 26.1.1 (#10) (8987b33)

## [1.3.4] - 2026-07-17

### Changed

- refresh eql-client manifest provenance for 2026-07-13 patch (09e0b78)
- refresh eqlbuilds twice weekly, Tue/Thu 8pm ET (259e229)

## [1.3.3] - 2026-07-13

### Fixed

- warrior has no spells after upstream schema change (06a675f)

### Changed

- refresh eqlbuilds.com data snapshot (wiki rev 151303) (b5f02e7)

## [1.3.2] - 2026-07-12

### Fixed

- serialize refresh with release, harden rebase-push, add fetch retry (7303372)

## [1.3.1] - 2026-07-12

### Fixed

- rebase before pushing refreshed eqlbuilds snapshot (328e75a)
- use versioned policy-compliant User-Agent in eqlbuilds extractor (6fc8de9)

## [1.3.0] - 2026-07-08

### Added

- Four client-data tools backed by new extracted datasets:
  `eql_client_zones` / `eql_client_zone` (the raw 118-zone map inventory the
  client ships, with 2,400+ labeled points of interest; zones whose shortnames
  match classic-EverQuest expansion codes carry a `classicExpansionHint` and
  rank after likely-EQL zones in search) and `eql_client_storyline_search` /
  `eql_client_storyline` (the 50 storyline narratives shipped in the client,
  with per-story `eraAdvisory` flags because much of the folder is inherited
  classic-EQ storyline text). Extracted by `scripts/extract-eql-reference.mjs`
  v2 from `maps/` and `Storyline/`. The client's `eqnews.txt` was evaluated and
  deliberately excluded: it ships legacy live-EverQuest patch notes (Laurion's
  Song, level 125), not EverQuest Legends change history.
- Era detection now also covers Planes of Power and later classic-EverQuest
  expansions (Plane of Knowledge, Abysmal Sea, Darkhollow, The Buried Sea,
  Serpent's Spine, and more), so inherited late-era content is flagged across
  wiki, source, and client-storyline tools.

### Changed

- EQL-authoritative sources are now explicitly prioritized over classic-EQ
  material: source registry entries carry an `authority` tier (`eql` vs
  `classic-eq`), `eql_sources` lists EQL-authoritative sources first, and the
  scope note tells consumers to prefer EQL sources whenever classic-EverQuest
  context (FVProject, EQArchives, 1999 history page) disagrees.

## [1.2.3] - 2026-07-08

### Fixed

- Era advisories, tool descriptions, and docs no longer imply Kunark, Velious,
  and Luclin are upcoming EverQuest Legends expansions. EQL is a custom
  reimagining of classic EverQuest: that content does not exist in the game,
  and the advisories now also warn that in-scope zones, mobs, and items can
  differ from their classic counterparts.

## [1.2.2] - 2026-07-08

### Changed

- Bump tsx from 4.22.4 to 4.23.0 (#9) (9695518)
- Bump @types/node from 26.0.1 to 26.1.0 (#8) (067bb51)

## [1.2.1] - 2026-07-08

### Fixed

- track spells_us.txt column shift from the 2026-07-06 client update (322e95f)

## [1.2.0] - 2026-07-08

### Added

- Seven `eql_client_*` tools backed by a new committed snapshot
  (`src/data/eql-client/`) extracted directly from a local EverQuest Legends
  client install — reference data the eqlbuilds snapshot does not cover:
  `eql_client_command_search` / `eql_client_command` (the in-game slash-command
  list, ~122 commands with aliases, syntax, and every documented form),
  `eql_client_races` / `eql_client_race` (the authoritative RaceID/model table,
  ~982 rows including NPC-model races, with per-gender model tags and sizes),
  `eql_client_manual_search` / `eql_client_manual_section` (~91 sections of the
  client manual supplement), and `eql_client_provenance`.
- `scripts/extract-eql-reference.mjs` (`npm run extract:reference`,
  `extract:reference:dry`): a maintainer-run, local-only extractor that reads
  `everquest_manual.txt`, `eqmanual_supplement.txt`, `racedata.txt`, and
  `dbstr_us.txt` from a game install and writes the committed `eql-client`
  snapshot with a source manifest (per-file size, mtime, SHA-256). There is no
  public mirror of this text, so it cannot run in CI. See
  `docs/local-client-extraction.md`.

- Three `eql_builds_*` tools that surface build data already in the committed
  snapshot but previously unreachable except through fuzzy search:
  `eql_builds_spell` (read one spell by id or exact name, with the per-class
  learn levels that the search tool collapses away — 235 spells are learned at
  different levels by different classes), `eql_builds_abilities` (enumerate the
  full 130-entry alternate-advancement catalog without a query, filterable by
  category/group/class/activation), and `eql_builds_ability` (read one AA by id
  or exact name with full per-rank detail).
- `scripts/extract-eql-client.mjs` (`npm run extract:client`): a maintainer-run
  extractor that reads the authoritative EverQuest Legends *client* text files
  (`spells_us.txt`, `eqstr_us.txt`, `dbstr_us.txt`, `Resources/skillcaps.txt`)
  from a local game install. It writes to a git-ignored scratch directory (never
  the committed snapshot) and cross-checks its parsed per-class spell levels
  against `src/data/eqlbuilds/` so column-layout drift surfaces loudly. See
  `docs/local-client-extraction.md`.
- eqlbuilds.com build-planner integration. Ten `eql_builds_*` tools expose a
  committed structured snapshot of the community build planner: races
  (`eql_builds_races`, `eql_builds_race`), classes (`eql_builds_classes`,
  `eql_builds_class`), spell search (`eql_builds_spell_search`), alternate
  advancement search (`eql_builds_ability_search`), class skills
  (`eql_builds_skills`), stances/invocations (`eql_builds_modes`), and snapshot
  provenance (`eql_builds_provenance`). A new `builds` source kind and the
  `eqlbuilds` registry entry are added in `src/sources.ts`.
- Continuous extraction mechanism for the eqlbuilds.com dataset. Because the
  site is a client-rendered SPA that embeds its data in a content-hashed JS
  bundle, `scripts/extract-eqlbuilds.mjs` re-discovers the bundle and rewrites
  the `src/data/eqlbuilds/` snapshot, classifying each JSON block by shape (so
  upstream reordering does not corrupt the mapping) and failing loudly if a
  required dataset is missing. Exposed via `npm run extract:eqlbuilds` and
  `npm run extract:eqlbuilds:check`, and run on a schedule by
  `.github/workflows/refresh-eqlbuilds.yml`.
- Automatic semver releases: every substantive push to `main` (including
  scheduled data refreshes) is now versioned from conventional commits by
  `.github/workflows/release.yml` + `scripts/prepare-release.mjs`, which update
  this changelog, tag the release, and publish GitHub Release notes.
- Shared HTTP layer hardening (`src/http.ts`): one conservative retry on
  transient failures (network errors and HTTP 408/5xx; rate limits and client
  timeouts are deliberately not retried), in-flight
  coalescing of concurrent identical requests, a bounded response cache, and a
  `postJson` helper that caches POST responses keyed by URL + body.
- EQArchives searches (`eql_eqarchives_search`, `eql_eqarchives_document`) now
  go through the shared HTTP layer: cached (60 s for searches, 5 min for
  immutable documents), shared User-Agent, and retry behavior — previously every
  identical query re-hit the Elasticsearch endpoint with a one-off fetch.

### Removed

- Cloudflare Worker chat app and Vite web frontend (`worker/`, `web/`,
  `wrangler.jsonc`), the related npm scripts (`build:web`, `dev:web`,
  `dev:worker`, `deploy`), and their dependencies (`ai`, `workers-ai-provider`,
  `wrangler`, `@cloudflare/workers-types`). This project is now a pure local
  stdio MCP server: the client performs inference, and the server only makes
  remote fetches to retrieve source data.

### Fixed

- Cache freshness is now judged against each caller's TTL instead of the TTL of
  whichever caller fetched first, so a 60-second read (official news, wiki API)
  can no longer be served 5-minute-old data cached by a slower surface.
- EQL Wiki and FVProject API errors (rate limits, bad params) are surfaced as
  tool failures instead of silently reading as empty result lists.
- `eql_official_news` now fails loudly when the news page's inline
  `window.EQL.News.articles` payload disappears (structure change) instead of
  reporting zero articles.
- `eql_source_search` reports mistyped `sourceIds` entries in `failedSources`
  instead of silently searching fewer sources.
- The FVProject TLS-fallback path now populates the shared cache, so a
  certificate workaround no longer refetches on every call.
- The User-Agent version is derived from `package.json` (was hardcoded to
  1.1.0 in two places) and now includes a contact URL per the MediaWiki
  User-Agent policy.
- `package-lock.json` was out of sync with `package.json` (missing `@emnapi/*`
  transitive dependencies), which broke `npm ci` in CI. Regenerated the lock.

## [1.1.0] - 2026-06-19

### Added

- Era awareness for inherited classic-EverQuest content. The EQL wiki (and some
  curated guides) carry zones, cities, factions, items, and quests from later
  expansions (Kunark, Velious, Luclin) that are **not** in EQL's pre-Kunark
  launch (Antonica, Faydwer, Odus plus the classic Planes of Sky, Hate, and
  Fear). `eql_wiki_page`, `eql_wiki_search`, and `eql_source_fetch` now detect
  such references and attach a structured `eraAdvisory` (`eras`, `markers`,
  `note`) so callers do not treat that content as launch-live. Pure launch
  content is left untouched (no advisory). Detection lives in `src/era.ts`.

## [1.0.0] - 2026-06-19

First stable release.

### Added

- `eql_video_transcript` tool — fetch a YouTube video's transcript from its
  published captions (manual or auto-generated). Accepts video ids and `watch`,
  `youtu.be`, `shorts`, `embed`, and `live` URLs. Twitch URLs return a clear
  "not available" result because Twitch VODs do not expose retrievable captions.
- yt-dlp helper resolution for caption retrieval, required because YouTube now
  gates caption downloads behind a bot-check token that plain HTTP cannot
  satisfy. Resolution order: `YTDLP_PATH`, then a `yt-dlp` on `PATH`, then a
  server-managed copy. When none exists, the tool asks the caller to opt in
  (`installYtDlp: true`, or `EQL_YTDLP_AUTODOWNLOAD=1` for standing consent)
  before downloading the official standalone binary, which is verified against
  the release's published SHA-256 checksum, cached, and refreshed after 7 days.
  Captions only — no video or audio is downloaded.
- `youtube`, `transcript`, `captions`, and `yt-dlp` package keywords.

### Notes

- No new npm dependencies. `yt-dlp` is an optional, server-managed runtime
  binary; every other tool works without it and requires no setup.
- Concurrent identical transcript requests are de-duplicated, and a single
  yt-dlp download is shared across callers.
