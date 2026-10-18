# Enhancement watch

Notes for the next pass on this MCP. Add a tool when a source below becomes
real public data. Do not add it on a hunch, a scraped SPA, or a locked API.

The server stays read-only. No Daybreak login, no cookies, no private APIs,
no client automation. `eqlegendstools.com/api/*` stays out (robots.txt
disallows it).

## Where the game is

This machine launches EverQuest Legends from `~/Applications/EQLMac.app`.
The app repo is `~/Developer/EQLMac`. The client is:

```text
~/Library/Application Support/osxEQL/prefix/drive_c/users/Public/Daybreak Game Company/Installed Games/EverQuest Legends
```

Extractors already look there, then `osxEQL/prefix-cx`, then the old
CrossOver bottle. See `.grok/skills/eql-client-update/SKILL.md`.

## Check these on a real update

1. `eql_official_news` and `eql_official_patch_notes`. Pin a full page in
   `src/sources.ts` only when the body should be searchable, not for every
   Tuesday note. The live indexes already list new posts.
2. Official `creator-*` slugs from `npm run check:youtube-sources`. Add the
   news page and a YouTube row only when the recent RSS is actually EQL.
3. New EQL-specific sites: eqlwiki, eqlbuilds, eqlegendstools, eqltools,
   Gnoll Guard, Loadout Legends, EQLForge, log companions. Add a source row
   when the page is stable. Add a tool only when there is structured data
   `fetchText` can parse without a browser session.

Skip SEO wiki mirrors, empty forums, mixed TLP/EQEmu channels, and feeds
whose current videos are a different game.

## Add a tool when the data exists

These are the holes versus OSRS, Path of Exile, and FFXIV knowledge MCPs.
Each one waits on a source.

| Gap | Add it when |
| --- | --- |
| NPC, quest, drop, or recipe lookup | EQL Wiki exposes Cargo or another stable query API, or Gnoll Guard / eqlegendstools publishes a public JSON or HTML index that is allowed to be fetched. One call should return the NPC, the steps, or the drop table, with the source URL. |
| Item stats beyond the current eqlegendstools HTML search | A public item dump or a client text table shows up. Do not guess binary item-db layouts. |
| Spell effect names | `spells_us.txt` effect columns are pinned. The column window is `CLASS_LEVEL_COLUMNS` in `scripts/extract-eql-client.mjs`. Cross-check against the eqlbuilds snapshot before trusting a new layout. |
| Auction house / prices | Rulers of Kunark (announced for mid-December 2026 in the 2026-09-17 producer letter) ships an auction house and someone publishes a public price feed. There is no GE to wrap before that. |
| Player state (level, quests, gear, bank) | A public hiscores-style API appears, or Arthur explicitly asks to read local `eqlog` / character ini next to `eqgame.exe`. Do not parse character logs just because the prefix is on disk. |
| Nektropos Castle, Lake Nerius, new race, level 55, aliases, collections, artes | An official patch note or news article describes them as live. The September 17 letter only announced them. Until then, wiki pages about those names are plans or classic-EQ material, not EQL fact. |

## When you do add one

- Point the tool at one source of truth and return that source's URL.
- Tag classic-EQ material with the existing era advisory. EQL is a different game.
- Test the parser with a fixture. Do not depend on a live fetch in unit tests.
- Put the user-facing note under `## [Unreleased]` in `CHANGELOG.md`. A `feat:` commit on `main` cuts a minor release.
