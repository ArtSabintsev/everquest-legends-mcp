import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { candidateGameDirs, resolveGameDir } from "../scripts/game-dir.mjs";

describe("EQL game dir discovery", () => {
  const home = "/Users/example";
  const dirs = candidateGameDirs(home);

  it("prefers the EQLMac prefix, then a migrated prefix, then the old CrossOver bottle", () => {
    expect(dirs.map((dir) => dir.replace(home, "~"))).toEqual([
      "~/Library/Application Support/osxEQL/prefix/drive_c/users/Public/Daybreak Game Company/Installed Games/EverQuest Legends",
      "~/Library/Application Support/osxEQL/prefix-cx/drive_c/users/Public/Daybreak Game Company/Installed Games/EverQuest Legends",
      "~/Library/Application Support/CrossOver/Bottles/EQL/drive_c/users/Public/Daybreak Game Company/Installed Games/EverQuest Legends"
    ]);
  });

  it("uses an explicit dir, then EQL_GAME_DIR, then the first candidate that has eqgame.exe", () => {
    const exists = (path: string) => path === join(dirs[2]!, "eqgame.exe");
    expect(resolveGameDir("/custom", { home, env: { EQL_GAME_DIR: "/from-env" }, exists })).toBe("/custom");
    expect(resolveGameDir(undefined, { home, env: { EQL_GAME_DIR: "/from-env" }, exists })).toBe("/from-env");
    expect(resolveGameDir(undefined, { home, env: {}, exists })).toBe(dirs[2]);
    expect(resolveGameDir(undefined, { home, env: {}, exists: () => false })).toBeUndefined();
  });
});
