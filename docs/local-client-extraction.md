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
