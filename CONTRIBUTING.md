# Contributing

This project is scoped to EverQuest Legends public sources only.

## Source Rules

- Include official EverQuest Legends, Daybreak, Game Jawn, and EQL-specific guide or press pages.
- Do not add generic EQ1, EQ2, P99, EQEmu, Project Quarm, or emulator/background databases unless the specific page is about EverQuest Legends.
- Mark social, forum, Discord, Twitch, YouTube watch pages, and login- or JavaScript-heavy sources as pointer-only unless there is a stable public feed or transcript.
- Prefer official pages, original interviews, hands-on previews, and EQL-specific guide pages for searchable sources.
- Label unofficial community sources clearly.

## Adding Or Changing Sources

Source registry entries live in `src/sources.ts`.

Use `searchable: true` only when the page is stable public text that `fetchSource` can extract without login, cookies, browser automation, private Discord access, or binary downloads. Use `searchable: false` for pointer-only sources, including social profiles, Discord, forums, Twitch, YouTube watch pages, Daybreak Help pages behind Cloudflare challenges, and binary assets.

When adding a parser or source client, add focused tests under `test/`. Existing examples:

- `test/official.test.ts` for official news payload parsing.
- `test/press.test.ts` for press asset parsing.
- `test/youtube.test.ts` for official YouTube RSS parsing.

Before opening a pull request, run:

```bash
npm run typecheck
npm test
npm run build
```

## Development

```bash
npm install
npm run typecheck
npm test
npm run build
```

Keep changes small and include tests for new parsers or source clients.

## Versioning

Releases are automated from conventional commits on `main`. See **[VERSIONING.md](./VERSIONING.md)** for bump rules, tags, CHANGELOG dates, and what not to hand-edit.
