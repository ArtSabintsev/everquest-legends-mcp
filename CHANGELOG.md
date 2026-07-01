# Changelog

All notable changes to this project are documented here. The format is based on
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project adheres
to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

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

### Removed

- Cloudflare Worker chat app and Vite web frontend (`worker/`, `web/`,
  `wrangler.jsonc`), the related npm scripts (`build:web`, `dev:web`,
  `dev:worker`, `deploy`), and their dependencies (`ai`, `workers-ai-provider`,
  `wrangler`, `@cloudflare/workers-types`). This project is now a pure local
  stdio MCP server: the client performs inference, and the server only makes
  remote fetches to retrieve source data.

### Fixed

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
