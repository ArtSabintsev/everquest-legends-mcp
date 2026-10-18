// Default EverQuest Legends install discovery for local extractors.
//
// The public server does not read the game at request time. Maintainers run
// these scripts on a machine that has the client. EQLMac (osxEQL) is the
// current Mac launcher: ~/Applications/EQLMac.app, prefix under
// ~/Library/Application Support/osxEQL. A migrated CrossOver prefix
// (prefix-cx) and the old CrossOver bottle are fallbacks.

import { existsSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

const GAME_RELATIVE =
  "drive_c/users/Public/Daybreak Game Company/Installed Games/EverQuest Legends";

/**
 * @param {string} [home]
 * @returns {string[]}
 */
export function candidateGameDirs(home = homedir()) {
  const support = join(home, "Library/Application Support");
  return [
    join(support, "osxEQL", "prefix", GAME_RELATIVE),
    join(support, "osxEQL", "prefix-cx", GAME_RELATIVE),
    join(support, "CrossOver", "Bottles", "EQL", GAME_RELATIVE)
  ];
}

/**
 * @param {string | undefined} explicit --game-dir, when the caller passed one
 * @param {{ home?: string, env?: NodeJS.ProcessEnv, exists?: (path: string) => boolean }} [options]
 * @returns {string | undefined}
 */
export function resolveGameDir(explicit, options = {}) {
  if (explicit) {
    return explicit;
  }
  const env = options.env ?? process.env;
  if (env.EQL_GAME_DIR) {
    return env.EQL_GAME_DIR;
  }
  const exists = options.exists ?? existsSync;
  for (const dir of candidateGameDirs(options.home)) {
    if (exists(join(dir, "eqgame.exe"))) {
      return dir;
    }
  }
  return undefined;
}

export function missingGameDirMessage() {
  return [
    'No game dir. Pass --game-dir "/path/to/EverQuest Legends" or set EQL_GAME_DIR.',
    "Looked for eqgame.exe under the EQLMac prefix, a migrated prefix-cx, then the old CrossOver EQL bottle.",
    "EQLMac installs the client at:",
    "  ~/Library/Application Support/osxEQL/prefix/drive_c/users/Public/Daybreak Game Company/Installed Games/EverQuest Legends",
    "Launch the patcher with: open ~/Applications/EQLMac.app"
  ].join("\n");
}
