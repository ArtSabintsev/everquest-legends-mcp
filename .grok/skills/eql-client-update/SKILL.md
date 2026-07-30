---
name: eql-client-update
description: >
  Check and update the local EverQuest Legends (EQL) game client in CrossOver,
  then refresh MCP data snapshots when a patch changed extractor sources.
  Use when the user says "check and update", "update the binary", "pull the
  latest", "patch the game", "check CrossOver", "EQL client", "game binary",
  "eqgame", "after the patch", "Tuesday patch", or asks whether the local EQL
  install / LaunchPad is current. Also use for /eql-client-update.
  Do NOT treat these phrases as the everquest-legends-mcp npm package binary
  unless the user explicitly says MCP, npm, dist, or package.
metadata:
  short-description: "Check/update EQL CrossOver client + snapshots"
---

# EQL CrossOver Client — Check & Update

When Arthur says things like **"check and update it"**, **"update the binary"**,
or **"pull the latest"** in an EQL context, he means the **game client** under
CrossOver — not the MCP server npm package / `dist/index.js`.

## Canonical paths (this machine)

| What | Path |
| --- | --- |
| Bottle | `~/Library/Application Support/CrossOver/Bottles/EQL` |
| Game dir (`EQL_GAME_DIR`) | `…/Bottles/EQL/drive_c/users/Public/Daybreak Game Company/Installed Games/EverQuest Legends` |
| Binary | `$EQL_GAME_DIR/eqgame.exe` |
| Patch log | `$EQL_GAME_DIR/.DownloadInfo.txt` |
| Digest / pver | `…/Bottles/EQL/drive_c/users/crossover/AppData/LocalLow/Daybreak Game Company/Digests/EverQuest New Sebilis/` |
| MCP repo | `~/Developer/everquest-legends-mcp` |
| Mac app wrapper | `~/Applications/CrossOver/EverQuest Legends.app` |

Product id in LaunchPad: `eqns` (EverQuest New Sebilis). Plugin version appears in `.DownloadInfo.txt` (e.g. `1.0.3.204`).

**There is no EverQuest 1 install on this machine.** Sibling `everquest1-mcp` is live-source only.

## Default workflow (run this end-to-end unless told otherwise)

### 1. Inspect install + last patch

```bash
GAME="$HOME/Library/Application Support/CrossOver/Bottles/EQL/drive_c/users/Public/Daybreak Game Company/Installed Games/EverQuest Legends"

# Binary + key data files
stat -f '%Sm  %z  %N' -t '%Y-%m-%d %H:%M:%S' \
  "$GAME/eqgame.exe" \
  "$GAME/spells_us.txt" \
  "$GAME/eqstr_us.txt" \
  "$GAME/dbstr_us.txt" \
  "$GAME/everquest_manual.txt" \
  "$GAME/Resources/skillcaps.txt" \
  "$GAME/racedata.txt" 2>/dev/null

# Last LaunchPad check / patch result
tail -40 "$GAME/.DownloadInfo.txt"

# Patch version markers
cat "$HOME/Library/Application Support/CrossOver/Bottles/EQL/drive_c/users/crossover/AppData/LocalLow/Daybreak Game Company/Digests/EverQuest New Sebilis/EverQuest New Sebilis.pver" 2>/dev/null
stat -f '%Sm %N' -t '%Y-%m-%d %H:%M:%S' \
  "$HOME/Library/Application Support/CrossOver/Bottles/EQL/drive_c/users/crossover/AppData/LocalLow/Daybreak Game Company/Digests/EverQuest New Sebilis/"* 2>/dev/null
```

Interpret `.DownloadInfo.txt`:

- `All files are up to date` → client is current; no LaunchPad action needed.
- `Found N file(s) to update` + `Patching` / `Replacing` + finished download → patch already applied this session.
- Stale log and user wants a pull → launch the patcher (step 2).

### 2. Trigger an update if needed

You **cannot** silently force Daybreak's CDN from the shell reliably. To pull:

1. Prefer opening CrossOver / the bottle's LaunchPad so it runs its own check:
   - Open `EverQuest Legends.app` under `~/Applications/CrossOver/`, **or**
   - Open CrossOver → bottle `EQL` → LaunchPad / Play (let it check before play).
2. Re-read `.DownloadInfo.txt` after the check completes.
3. Do **not** invent a manual file copy from another machine unless Arthur asks.

If LaunchPad is already reporting up to date, say so and skip relaunching.

### 3. Decide whether MCP snapshots need a refresh

Compare current game files to the committed client snapshot:

```bash
cd ~/Developer/everquest-legends-mcp
# Hashes in src/data/eql-client/manifest.json must match on-disk files for
# everquest_manual.txt, eqmanual_supplement.txt, racedata.txt, dbstr_us.txt, etc.
shasum -a 256 \
  "$GAME/dbstr_us.txt" \
  "$GAME/everquest_manual.txt" \
  "$GAME/racedata.txt" 2>/dev/null
```

| Patch touched… | Action |
| --- | --- |
| Only `eqgame.exe`, `*.dll`, `*.emt`, graphics, LaunchPad | **No snapshot update.** Report binary current. |
| `spells_us.txt`, `eqstr_us.txt`, `dbstr_us.txt`, `Resources/skillcaps.txt`, manual/storyline/maps/racedata, ZoneNames if extractor cares | Re-extract (step 4). |
| Unclear | Run extractors in dry/report mode; only commit if counts/hashes change. |

`eqlbuilds.com` snapshot (`src/data/eqlbuilds/`) refreshes via GitHub Actions (Tue/Thu ~8pm ET). **Do not** hand-edit that path from the game dir unless Arthur asks; use `extract:client --report-only` for cross-checks only.

### 4. Re-extract client reference data (when step 3 says so)

```bash
cd ~/Developer/everquest-legends-mcp
export EQL_GAME_DIR="$HOME/Library/Application Support/CrossOver/Bottles/EQL/drive_c/users/Public/Daybreak Game Company/Installed Games/EverQuest Legends"

# Authoritative reference snapshot (writes src/data/eql-client/)
npm run extract:reference -- --game-dir "$EQL_GAME_DIR"

# Optional dry run first:
# npm run extract:reference:dry -- --game-dir "$EQL_GAME_DIR"

# Build-data sanity check only (never writes src/data/eqlbuilds/)
npm run extract:client -- --game-dir "$EQL_GAME_DIR" --report-only
```

Then:

1. Review `git diff --stat` on `src/data/eql-client/`.
2. Rebuild if needed: `npm run build`.
3. Version / commit / push **only if Arthur asked** to ship. Conventional commits drive auto-release on `main` (`chore(release)` via CI). Prefer something like `chore(data): refresh eql-client from CrossOver patch`.

### 5. Report back (always)

Give a short status table:

- Bottle / game dir present?
- `eqgame.exe` mtime + size
- Last LaunchPad line (up to date vs files patched)
- Whether extractor sources changed (hash match Y/N)
- Whether you re-extracted / committed / pushed
- Explicit: MCP **npm** package was not the target unless they said so

## Phrase disambiguation

| User says | Target |
| --- | --- |
| binary, game, client, CrossOver, LaunchPad, patch, eqgame, EQL install | **This skill** (game under CrossOver) |
| MCP, package, npm, dist, release, version the server | `everquest-legends-mcp` git/npm release workflow |
| Ambiguous "update it" while cwd or conversation is this game/MCP repo | Prefer **game client** first; mention MCP package only if relevant |

## Cadence notes

- Daybreak patches commonly land **Tuesday mornings ET**; launch weeks can be irregular.
- After Arthur runs the patcher, assume extractors may need a pass — don't wait to be asked twice.
- Sibling memory: client path + Tuesday cadence; post-launch source sweep is separate (`src/sources.ts`).

## What not to do

- Do not confuse with `npx github:ArtSabintsev/everquest-legends-mcp` or repo `dist/`.
- Do not write extractor output into `src/data/eqlbuilds/` (client script forbids it by design).
- Do not force-push, delete the bottle, or reinstall CrossOver unless explicitly requested.
- Do not claim the game is updated without reading `.DownloadInfo.txt` or file mtimes.
