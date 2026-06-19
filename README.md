# EverQuest Legends MCP

[![CI](https://github.com/ArtSabintsev/everquest-legends-mcp/actions/workflows/ci.yml/badge.svg)](https://github.com/ArtSabintsev/everquest-legends-mcp/actions/workflows/ci.yml)

Read-only Model Context Protocol server for EverQuest Legends public sources.

## Status

Stable (1.0). Read-only. It does not require secrets, cookies, credentials, a Daybreak account, or private API access. The only optional moving part is the `yt-dlp` helper used by `eql_video_transcript` (see Optional Dependencies).

## Scope

This MCP is for **EverQuest Legends**. It intentionally excludes general EQ1/EQ2, P99, EQEmu, Project Quarm, and other emulator/background databases unless a specific page is about EverQuest Legends.

This server is built around public, unauthenticated sources:

- EQL Wiki: `https://eqlwiki.com/Main_Page` via MediaWiki API
- Official EQL site and news: `https://www.everquestlegends.com`
- Daybreak help and press pages
- Official EverQuest community note about the Game Jawn collaboration
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
- `eql_official_news`: parse official EQL news index
- `eql_official_article`: fetch and extract an official news article
- `eql_press_assets`: list official Daybreak press asset URLs by kind
- `eql_official_youtube_videos`: list official EQL YouTube video metadata from the channel RSS feed
- `eql_video_transcript`: fetch an existing transcript from a YouTube video's published captions (uses `yt-dlp`, auto-downloaded on first use; see Optional Dependencies)
- `eql_class_combos`: generate three-class combinations from the public 16-class list

## Resources

- `eql://sources`: source registry
- `eql://classes`: class metadata
- `eql://races`: launch race list

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

After the package is published to npm, MCP clients that accept a JSON config can run it directly with `npx`:

```json
{
  "mcpServers": {
    "everquest-legends": {
      "command": "npx",
      "args": ["-y", "everquest-legends-mcp"]
    }
  }
}
```

## Local Development

```bash
git clone https://github.com/ArtSabintsev/everquest-legends-mcp.git
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

## Tool Examples

| Tool | Required input | Typical use |
| --- | --- | --- |
| `eql_sources` | none | List every configured source and see whether each source is searchable or pointer-only. |
| `eql_source_fetch` | `id` | Fetch extracted text for a searchable source from `eql_sources`, such as `official-shop`. |
| `eql_source_search` | `query` | Search curated official, guide, and press sources for EQL-specific text; failed fetches are returned in `failedSources`. |
| `eql_wiki_search` | `query` | Search the EQL Wiki through MediaWiki full-text search. |
| `eql_wiki_page` | `title` | Read an EQL Wiki page after finding it with `eql_wiki_search`. |
| `eql_wiki_category_pages` | `category` | List pages in an EQL Wiki category. |
| `eql_official_news` | none | List official EverQuest Legends news articles. |
| `eql_official_article` | `pageNameOrUrl` | Read an official EQL news article by slug or `https://www.everquestlegends.com/news/...` URL. |
| `eql_press_assets` | `kind` | List official Daybreak press asset metadata for `logos`, `artwork`, `screenshots`, `video`, or `fact-sheets`. |
| `eql_official_youtube_videos` | none | List official EverQuest Legends YouTube video metadata from the channel RSS feed. |
| `eql_class_combos` | none | Generate EQL three-class combinations from the public 16-class list. |

Example user prompts for an MCP client:

- "Use `eql_sources`, then fetch the official shop source."
- "Search the EQL Wiki for race unlocks, then read the most relevant page."
- "List official press screenshots for EverQuest Legends."
- "Show the latest official EverQuest Legends YouTube videos."

## Source Policy

- Searchable sources should be stable public text pages about EverQuest Legends.
- Official EQL, Daybreak, Game Jawn, original interviews, hands-on previews, and EQL-specific guide pages are preferred.
- Social, Discord, forum, Twitch, and YouTube watch pages are pointer-only unless there is a stable public feed or transcript.
- Daybreak Help pages are pointer-only because direct fetches can return Cloudflare challenge HTML.
- Binary assets are exposed as metadata links; they are not downloaded by default.

## Notes

The wiki and beta coverage change quickly. For current facts, prefer `eql_wiki_page`, `eql_wiki_search`, `eql_official_news`, `eql_official_youtube_videos`, and official source pages over static assumptions.

## License

MIT
