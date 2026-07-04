# Local EQL client extraction

Most of the build data in this MCP (per-class spell levels, skill caps, race
strings, AA descriptions) ultimately comes from the **EverQuest Legends client
text files** on a machine that has the game installed. There are two ways that
data reaches the committed snapshot under `src/data/eqlbuilds/`:

| Path | Source | Runs where | Script |
| --- | --- | --- | --- |
| Automated | `eqlbuilds.com` (re-published client data) | CI, weekly | `scripts/extract-eqlbuilds.mjs` |
| Manual / authoritative | Your local game install | Your machine only | `scripts/extract-eql-client.mjs` |

The automated path is the default and needs no game install. The manual path
below is for a maintainer who has EQL installed and wants to extract or
cross-check data straight from the authoritative client files.

## Why it only runs locally

`scripts/extract-eql-client.mjs` reads files that exist **only inside a game
install**. It cannot run in CI or in the Claude Code cloud sandbox because:

- There is no game client there to read.
- `eqlbuilds.com` (the automated fallback source) is blocked by the sandbox's
  outbound egress policy — a request returns HTTP 403 at the proxy tunnel. That
  is expected; the automated refresh is designed to run in GitHub Actions
  (`.github/workflows/refresh-eqlbuilds.yml`), where egress is unrestricted.

## Where the client files live

After installing EverQuest Legends, the install root contains `eqgame.exe` and a
set of caret (`^`) delimited `*_us.txt` data files. Typical locations:

- Windows: `C:\Program Files\Daybreak Game Company\EverQuest Legends\`
  (or wherever the launcher installed it)

The extractor reads:

| File | Contents |
| --- | --- |
| `spells_us.txt` | One spell per row; id, name, and per-class minimum levels |
| `eqstr_us.txt` | Client string table (`<id> <text>`) |
| `dbstr_us.txt` | Typed string table (`<id>^<type>^<text>`); type 6 = AA text |
| `Resources/skillcaps.txt` | Per-class skill caps |

## Running it

```bash
# Report only — parse, print counts + samples, cross-check the snapshot, write nothing.
npm run extract:client -- --game-dir "/path/to/EverQuest Legends" --report-only

# Extract to a scratch directory (git-ignored) for review.
npm run extract:client -- --game-dir "/path/to/EverQuest Legends" --out ./eql-client-dump

# Or via environment variable.
EQL_GAME_DIR="/path/to/EverQuest Legends" npm run extract:client
```

By design the script **never writes to `src/data/eqlbuilds/`**. It writes JSON to
the `--out` directory (default `./eql-client-dump/`, git-ignored) so a bad parse
can't corrupt the shipped snapshot. Fold anything correct into the snapshot
deliberately after review.

## Validating the output

The client's `spells_us.txt` column layout drifts between game builds, so the
per-class level window is a named constant (`CLASS_LEVEL_COLUMNS`) documented
against the layout in `src/data/eqlbuilds/notes.json` ("class level columns
36-51"). On every run the script cross-checks its parsed spell levels against the
committed snapshot and prints an agreement percentage:

- **High agreement (≈100%)**: the column window still lines up; output is trustworthy.
- **Low agreement (<90%)**: the layout drifted. Adjust `CLASS_LEVEL_COLUMNS` (and
  `CLASS_ORDER` if the class column order changed) until the sanity-check passes
  before trusting or committing anything.

## Extending it

The script currently extracts the high-confidence, well-documented datasets
(spells with per-class levels, string tables, skill caps). Left as follow-ups
that need sample files to pin down precisely:

- Spell effect (SPA) decoding — `spells_us.txt` effect columns → readable names.
- Race and level-cap extraction from `Resources/Achievements/*.txt`.
- Stance / invocation descriptions from `eqgame.exe` printable strings.

Add these as new parse functions and cross-checks, keeping the "write to scratch,
never clobber the snapshot, sanity-check against committed data" discipline.

## Reference extraction (`scripts/extract-eql-reference.mjs`)

A second local-only extractor pulls the human-facing **reference** text that the
eqlbuilds snapshot does not cover, into a separate committed snapshot under
`src/data/eql-client/` (read by the `eql_client_*` tools). It has no public
mirror — the client is the only source — so it is maintainer-run and local-only,
like `extract-eql-client.mjs`. Unlike that script it writes the committed
snapshot directly, because its output is small, deterministic, and easy to review
in a diff.

```bash
npm run extract:reference     -- --game-dir "/path/to/EverQuest Legends"
npm run extract:reference:dry -- --game-dir "/path/to/EverQuest Legends"  # summarize only
EQL_GAME_DIR="/path/to/EverQuest Legends" npm run extract:reference
```

It emits `commands.json`, `races.json`, `manual-sections.json`, and a
`manifest.json` (source files with size/mtime/SHA-256, plus counts).

### Source file formats

- **`everquest_manual.txt`** — the in-game slash-command reference. An entry
  begins at column 0 with `/`; wrapped continuation lines are indented; the first
  line is `"<syntax> - <description>"` (or tab-separated in the chat section).
  Command names are taken from the portion before the first `[`/`<` parameter
  marker, so the `/` inside params like `[ON/OFF]` is not mistaken for an alias.
  ALLCAPS banners (GUILD/PET/CHAT COMMANDS) are skipped, not treated as commands.
  A command is intentionally **not** tagged with a section: general commands
  resume after those banner blocks without a reset header, so any section label
  would bleed onto unrelated commands.
- **`racedata.txt`** — caret-delimited model table, one row per (RaceID, gender).
  Columns used: `0` RaceID, `1` gender (0 male / 1 female / 2 neutral), `47` model
  size, `50` model tag (e.g. `HUM`/`HUF`). Rows are grouped by RaceID into a race
  with per-gender models. **No `playable` flag is emitted**: a playable race name
  collides with many NPC-model RaceIDs (e.g. several `Froglok`/`Kerran` rows), so
  a name-based playable flag would be unreliable. For player races use
  `eql_builds_races`.
- **`dbstr_us.txt`** — caret-delimited `<id>^<type>^<text>^`. Type `11` is the
  singular race name and type `12` the plural, both keyed by RaceID; these join
  onto `racedata.txt` to name each race.
- **`eqmanual_supplement.txt`** — opens with a `Title<TAB><page>` table of
  contents, then a body where each title reappears as a bare heading. The parser
  learns the title whitelist from the TOC, then splits the body on blank-set-off
  lines that match a whitelisted title **without** a trailing page number (so the
  TOC's own listing is skipped). Note this is legacy EverQuest manual text bundled
  with the Legends client; some content predates Legends.
