# EverQuest Legends MCP

Read-only Model Context Protocol server for EverQuest Legends public sources.

## Status

Stable (1.0). Read-only. It does not require secrets, cookies, credentials, a Daybreak account, or private API access. The only optional moving part is the `yt-dlp` helper used by `eql_video_transcript` (see Optional Dependencies).

## Scope

This MCP is for **EverQuest Legends**. It intentionally excludes general EQ1/EQ2, P99, EQEmu, Project Quarm, and other emulator/background databases unless a specific page is about EverQuest Legends.

Classic EverQuest lore and archive sources are included as historical context for Norrath, not as EverQuest Legends authority. EverQuest Legends is a custom reimagining of classic EverQuest: the classic expansions (Kunark, Velious, Luclin) do not exist in the game, and even in-scope zones, mobs, and items can differ from their classic counterparts. When a source describes expansion content — or any classic-EQ specifics — treat it as background unless an EQL-specific source (wiki, official pages, eqlbuilds/client snapshots) confirms it for Legends.

This server is built around public, unauthenticated sources:

- EQL Wiki: `https://eqlwiki.com/Main_Page` via MediaWiki API
- Official EQL site and news: `https://www.everquestlegends.com`
- Daybreak help and press pages
- Official EverQuest community note about the Game Jawn collaboration
- Original official 1999 Sony EverQuest history/lore page via Wayback
- The Firiona Vie Project lore category via MediaWiki API
- EQArchives search portal and corpus provenance
- Official EQL YouTube and Twitch channels
- EQL-specific guide/interview/preview pages from EQProgression, EverQuest Guides, and selected press outlets
- Pointer-only EQL community sources such as Reddit

It does not log into Daybreak, manipulate an account, automate a game client, or send requests to private APIs.

## Tools

- `eql_sources`: list configured public sources
- `eql_source_fetch`: fetch and extract a curated source page
- `eql_source_search`: search official/support/guide source pages
- `eql_wiki_search`: full-text search EQL Wiki
- `eql_wiki_page`: fetch an EQL Wiki page with extracted text, links, categories, and revision metadata
- `eql_wiki_recent_changes`: read recent wiki edits
- `eql_wiki_category_pages`: list MediaWiki category members
- `eql_fv_lore_category_pages`: list The Firiona Vie Project lore category pages
- `eql_fv_lore_search`: search FVProject lore page titles
- `eql_fv_lore_page`: fetch an FVProject lore page
- `eql_eqarchives_search`: search the hosted EQArchives historical corpus
- `eql_eqarchives_document`: fetch an EQArchives indexed document by id
- `eql_builds_races`: list playable races from the eqlbuilds.com dataset (optionally include inactive races)
- `eql_builds_race`: read one race (description, starting ability, racial traits) by id
- `eql_builds_classes`: list all 16 classes with armor and spell/skill/AA counts
- `eql_builds_class`: read one class; spell/skill/AA lists are opt-in
- `eql_builds_spell_search`: search spells by name/description/skill, with usable-by classes
- `eql_builds_spell`: read one spell by id or exact name, with per-class learn levels (the same spell is often learned at different levels by different classes)
- `eql_builds_ability_search`: search alternate advancement (AA) with rank costs and eligible classes
- `eql_builds_abilities`: enumerate the AA catalog (no query needed), filterable by category/group/class/activation
- `eql_builds_ability`: read one AA by id or exact name, with full per-rank costs, rank spells, and requirements
- `eql_builds_skills`: list a class's skill lines with caps and trained-at levels
- `eql_builds_modes`: list combat stances and invocations
- `eql_builds_provenance`: report the eqlbuilds.com snapshot manifest, source wiki revision, and extraction notes
- `eql_client_command_search`: search the in-game slash-command reference (name, aliases, syntax, description) from the client manual
- `eql_client_command`: read one slash command by name or alias, returning every documented form (e.g. `/who`, `/who all`, `/who <mask>`)
- `eql_client_races`: list or search the authoritative RaceID/model table (playable plus hundreds of NPC-model races) with per-gender model tags and sizes
- `eql_client_race`: read a race by RaceID or name; a name returns every RaceID that shares it (playable plus NPC-model variants)
- `eql_client_manual_search`: search the client manual supplement and return matching section titles with a snippet
- `eql_client_manual_section`: read one manual-supplement section by title, or list all section titles
- `eql_client_zones`: list/search the raw zone map inventory shipped in the client (zone keys + POI labels); zones matching classic-EverQuest expansion codes are flagged via `classicExpansionHint` and ranked last
- `eql_client_zone`: read one zone's labeled points of interest with map coordinates
- `eql_client_storyline_search`: search the storyline narratives shipped in the client (largely inherited classic-EQ storyline text; results carry an `eraAdvisory` when they reference classic expansion content)
- `eql_client_storyline`: read one full storyline by id or title
- `eql_client_provenance`: report the local-client reference snapshot manifest (source files with sizes/hashes/mtimes, counts)
- `eql_official_news`: parse official EQL news index
- `eql_official_article`: fetch and extract an official news article
- `eql_press_assets`: list official Daybreak press asset URLs by kind
- `eql_official_youtube_videos`: list official EQL YouTube video metadata from the channel RSS feed
- `eql_youtube_sources`: list official and selected creator YouTube channel feeds
- `eql_youtube_videos`: list recent official and creator YouTube videos with source attribution
- `eql_creator_program`: read structured metadata for the official Creator Legends program
- `eql_video_transcript`: fetch an existing transcript from a YouTube video's published captions (uses `yt-dlp`, auto-downloaded on first use; see Optional Dependencies)
- `eql_class_combos`: generate three-class combinations from the public 16-class list

## Resources

- `eql://sources`: source registry
- `eql://classes`: class metadata
- `eql://races`: launch race list
- `eql://youtube-sources`: official and selected creator YouTube source registry
- `eql://creator-program`: structured official Creator Legends program metadata

## Optional Dependencies

`eql_video_transcript` uses [`yt-dlp`](https://github.com/yt-dlp/yt-dlp) to read a video's published captions. Every other tool works without it, and nothing is downloaded unless you actually call this tool.

yt-dlp is required because YouTube now gates caption downloads behind a bot-check token that plain HTTP requests cannot satisfy. No video or audio is downloaded — captions only.

**How yt-dlp is resolved**, in order:

1. `YTDLP_PATH` environment variable, if set.
2. A `yt-dlp` already on your `PATH` (e.g. `brew install yt-dlp` / `pipx install yt-dlp`). A system copy you keep updated is preferred and always wins.
3. A copy previously downloaded by this server (see below).

If none of those is present, the tool does **not** download anything silently. The first call returns a short message explaining that yt-dlp is needed to pull YouTube captions and asking you to opt in. To proceed, call `eql_video_transcript` again with `installYtDlp: true`. That authorizes a one-time download of the official standalone `yt-dlp` binary from GitHub releases, **verified against the release's published SHA-256 checksum**, then cached. The macOS/Linux standalone builds are self-contained (no Python required).

Download details:

- Cache location: `~/Library/Caches/everquest-legends-mcp` (macOS), `$XDG_CACHE_HOME/everquest-legends-mcp` or `~/.cache/everquest-legends-mcp` (Linux), `%LOCALAPPDATA%\everquest-legends-mcp` (Windows).
- The cached binary is refreshed (best-effort) after 7 days to keep up with YouTube changes.
- Set `EQL_YTDLP_AUTODOWNLOAD=1` to grant standing consent so the download happens automatically without the per-call `installYtDlp` flag.

**Twitch is intentionally unsupported**: Twitch VODs do not expose retrievable captions, so the tool returns a clear "not available" result for Twitch URLs.

## Usage

Prerequisites:

- Node.js `>=22`
- npm

This is a stdio MCP server. Your MCP client starts it as a child process.

It is distributed via GitHub (not the npm registry). MCP clients that accept a JSON config can run it directly from the repository with `npx`, which clones, builds, and launches it:

Replace `<owner>` with the GitHub owner or organization that hosts this repository.

### Codex

```bash
codex mcp add everquest-legends -- npx -y github:<owner>/everquest-legends-mcp
codex mcp list
```

### Claude Code

```bash
claude mcp add --scope user everquest-legends -- npx -y github:<owner>/everquest-legends-mcp
claude mcp list
```

### Claude Desktop

Merge this into `~/Library/Application Support/Claude/claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "everquest-legends": {
      "command": "npx",
      "args": ["-y", "github:<owner>/everquest-legends-mcp"]
    }
  }
}
```

Restart Claude Desktop after changing the file.

### Grok

```bash
grok mcp add --scope user everquest-legends -- npx -y github:<owner>/everquest-legends-mcp
grok mcp list
grok mcp doctor
```

Start a new Codex, Claude, or Grok session after adding the server. Existing sessions may not pick up newly configured MCP servers.

Pin to a release tag for reproducibility, e.g. `github:<owner>/everquest-legends-mcp#v1.1.0`. For a fixed local install, see Local Development below and point your client at `dist/index.js`.

## Local Development

```bash
git clone https://github.com/<owner>/everquest-legends-mcp.git
cd everquest-legends-mcp
npm install
npm run build
```

For MCP clients that accept a JSON config:

```json
{
  "mcpServers": {
    "everquest-legends": {
      "command": "node",
      "args": ["<path-to-checkout>/dist/index.js"]
    }
  }
}
```

```bash
npm run typecheck
npm test
npm run build
```

### Refreshing the eqlbuilds.com dataset

The `eql_builds_*` tools read a committed snapshot under `src/data/eqlbuilds/`.
eqlbuilds.com is a client-rendered SPA that embeds its data in a content-hashed
JS bundle, so the snapshot is regenerated by an extractor that re-discovers the
bundle and rewrites the JSON, classifying each block by shape (so upstream
reordering does not corrupt the mapping):

```bash
npm run extract:eqlbuilds        # refresh the snapshot from eqlbuilds.com
npm run extract:eqlbuilds:check  # verify the snapshot is up to date (non-zero if stale)
```

`.github/workflows/refresh-eqlbuilds.yml` runs the extractor on a weekly
schedule (and on demand), validates it with typecheck + tests, and commits the
refreshed snapshot only when the upstream data actually changes. The build copies
`src/data` to `dist/data` so the snapshot ships with the package.

### Refreshing the local-client reference dataset

The `eql_client_*` tools read a committed snapshot under `src/data/eql-client/`
(slash commands, the RaceID/model table, and manual-supplement sections). Unlike
eqlbuilds, there is no public mirror of this text — the EverQuest Legends client
install is the source — so it is a maintainer-run, local-only extractor and
cannot run in CI. On a machine with the game installed:

```bash
# --game-dir points at the install root (the folder with eqgame.exe and *_us.txt).
npm run extract:reference -- --game-dir "/path/to/EverQuest Legends"
npm run extract:reference:dry -- --game-dir "/path/to/EverQuest Legends"  # parse + summarize, write nothing

# Or set EQL_GAME_DIR once:
EQL_GAME_DIR="/path/to/EverQuest Legends" npm run extract:reference
```

It reads `everquest_manual.txt`, `eqmanual_supplement.txt`, `racedata.txt`, and
`dbstr_us.txt`, writes the JSON to `src/data/eql-client/`, and records a manifest
with each source file's size, mtime, and SHA-256. Review the diff, run the tests,
then commit. See `docs/local-client-extraction.md` for the client file formats.

## Tool Examples

| Tool | Required input | Typical use |
| --- | --- | --- |
| `eql_sources` | none | List every configured source and see whether each source is searchable or pointer-only. |
| `eql_source_fetch` | `id` | Fetch extracted text for a searchable source from `eql_sources`, such as `official-shop`. |
| `eql_source_search` | `query` | Search curated official, guide, and press sources for EQL-specific text; failed fetches are returned in `failedSources`. |
| `eql_wiki_search` | `query` | Search the EQL Wiki through MediaWiki full-text search. |
| `eql_wiki_page` | `title` | Read an EQL Wiki page after finding it with `eql_wiki_search`. |
| `eql_wiki_category_pages` | `category` | List pages in an EQL Wiki category. |
| `eql_fv_lore_category_pages` | none | List classic EQ lore pages from The Firiona Vie Project. |
| `eql_fv_lore_search` | `query` | Search FVProject lore titles, then read with `eql_fv_lore_page`. |
| `eql_fv_lore_page` | `title` | Read a classic EQ lore page from FVProject. |
| `eql_eqarchives_search` | `query` | Search EQArchives preserved EQ websites, mailing lists, patches, logs, and historical records. |
| `eql_eqarchives_document` | `id` | Read a bounded EQArchives document from a search result id. |
| `eql_builds_classes` | none | List all 16 classes with armor and spell/skill/AA counts from the eqlbuilds.com dataset. |
| `eql_builds_class` | `id` | Read one class (e.g. `shadowKnight`); set `includeSpells`/`includeSkills`/`includeAbilities` for full lists. |
| `eql_builds_races` | none | List playable races; set `includeInactive` to also list disabled races like Drakkin. |
| `eql_builds_spell_search` | `query` | Search spells across classes (optionally scope to one `classId`). |
| `eql_builds_ability_search` | `query` | Search alternate advancement with rank costs (filter by `classId` or `category`). |
| `eql_builds_provenance` | none | See when the eqlbuilds.com snapshot was extracted and which EQL Wiki AA revision it uses. |
| `eql_official_news` | none | List official EverQuest Legends news articles. |
| `eql_official_article` | `pageNameOrUrl` | Read an official EQL news article by slug or `https://www.everquestlegends.com/news/...` URL. |
| `eql_press_assets` | `kind` | List official Daybreak press asset metadata for `logos`, `artwork`, `screenshots`, `video`, or `fact-sheets`. |
| `eql_official_youtube_videos` | none | List official EverQuest Legends YouTube video metadata from the channel RSS feed. |
| `eql_youtube_sources` | none | List official and selected creator YouTube source feeds. |
| `eql_youtube_videos` | none | List recent videos from official and selected creator YouTube feeds with source attribution. |
| `eql_creator_program` | none | Read official Creator Legends application, requirements, category, review-window, and retention metadata. |
| `eql_class_combos` | none | Generate EQL three-class combinations from the public 16-class list. |

Example user prompts for an MCP client:

- "Use `eql_sources`, then fetch the official shop source."
- "Search the EQL Wiki for race unlocks, then read the most relevant page."
- "List official press screenshots for EverQuest Legends."
- "Show the latest official EverQuest Legends YouTube videos."
- "List recent creator videos about EverQuest Legends classes."
- "Show the official Creator Legends program requirements."

## Source Policy

- Searchable sources should be stable public text pages about EverQuest Legends.
- Official EQL, Daybreak, Game Jawn, original interviews, hands-on previews, and EQL-specific guide pages are preferred.
- Social, Discord, forum, Twitch, and YouTube watch pages are pointer-only unless there is a stable public feed or transcript.
- Creator YouTube channels are unofficial community sources. Use them for coverage discovery, guides, and commentary; verify factual claims against official EQL pages, press pages, or wiki pages.
- Daybreak Help pages are pointer-only because direct fetches can return Cloudflare challenge HTML.
- Binary assets are exposed as metadata links; they are not downloaded by default.
- FVProject and EQArchives are historical/classic EverQuest context sources. They are useful for Norrath lore and archival research, but they should not override current EQL official, press, or EQL Wiki facts.
- eqlbuilds.com is an unofficial community build planner. Its data is derived from EQL Legends client files and a vendored EQL Wiki Alternate Advancement snapshot. Treat `eql_builds_*` output as community reference, and check `eql_builds_provenance` for the snapshot age; AA costs in particular may be partial.

## Notes

The wiki and beta coverage change quickly. For current facts, prefer `eql_wiki_page`, `eql_wiki_search`, `eql_official_news`, `eql_official_youtube_videos`, and official source pages over static assumptions.

EQL launches **pre-Kunark** (Antonica, Faydwer, Odus, plus the classic Planes of Sky, Hate, and Fear). The community wiki inherits classic EverQuest data, so pages routinely describe Kunark, Velious, and Luclin zones, cities, factions, items, and quests that are not in the launch game. `eql_wiki_page`, `eql_wiki_search`, and `eql_source_fetch` attach a structured `eraAdvisory` when they detect such references — check for it and do not treat flagged content as launch-live.

## License

MIT
