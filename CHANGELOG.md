# Changelog

All notable changes to this project are documented here. The format is based on
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project adheres
to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

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
