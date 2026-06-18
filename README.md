# EverQuest Legends MCP

Read-only Model Context Protocol server for EverQuest Legends public sources.

This server is built around public, unauthenticated sources:

- EQL Wiki: `https://eqlwiki.com/Main_Page` via MediaWiki API
- Official EQL site and news: `https://www.everquestlegends.com`
- Daybreak help and press pages
- Official EverQuest community note about the Game Jawn collaboration
- EQProgression EQL FAQ and multiclass guide
- Pointer-only community sources such as Reddit and YouTube

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
- `eql_class_combos`: generate three-class combinations from the public 16-class list

## Resources

- `eql://sources`: source registry
- `eql://classes`: class metadata
- `eql://races`: launch race list

## Local Usage

```bash
npm install
npm run build
node dist/index.js
```

For MCP clients that accept a JSON config:

```json
{
  "mcpServers": {
    "everquest-legends": {
      "command": "node",
      "args": ["/Users/arthur/Developer/everquest-legends-mcp/dist/index.js"]
    }
  }
}
```

## Development

```bash
npm run typecheck
npm test
npm run build
```

## Notes

The wiki is beta content and changes quickly. For current facts, prefer `eql_wiki_page`, `eql_wiki_search`, and `eql_official_news` over static assumptions.
