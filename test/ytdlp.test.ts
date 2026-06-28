import { describe, expect, it } from "vitest";
import { expectedChecksum, YtDlpUnavailableError, ytDlpAssetName } from "../src/ytdlp.js";

describe("yt-dlp release asset mapping", () => {
  it("maps each supported platform/arch to a standalone asset", () => {
    expect(ytDlpAssetName("darwin", "arm64")).toBe("yt-dlp_macos");
    expect(ytDlpAssetName("darwin", "x64")).toBe("yt-dlp_macos");
    expect(ytDlpAssetName("linux", "x64")).toBe("yt-dlp_linux");
    expect(ytDlpAssetName("linux", "arm64")).toBe("yt-dlp_linux_aarch64");
    expect(ytDlpAssetName("linux", "arm")).toBe("yt-dlp_linux_armv7l");
    expect(ytDlpAssetName("win32", "x64")).toBe("yt-dlp.exe");
    expect(ytDlpAssetName("win32", "ia32")).toBe("yt-dlp_x86.exe");
  });

  it("throws for unsupported platforms", () => {
    expect(() => ytDlpAssetName("aix" as NodeJS.Platform, "ppc64")).toThrow(YtDlpUnavailableError);
  });
});

describe("checksum lookup", () => {
  const sums = [
    "0000000000000000000000000000000000000000000000000000000000000000  yt-dlp",
    "1111111111111111111111111111111111111111111111111111111111111111  yt-dlp_macos",
    "2222222222222222222222222222222222222222222222222222222222222222  yt-dlp_linux"
  ].join("\n");

  it("finds the hash for a named asset", () => {
    expect(expectedChecksum(sums, "yt-dlp_macos")).toBe("1111111111111111111111111111111111111111111111111111111111111111");
  });

  it("returns undefined when the asset is absent", () => {
    expect(expectedChecksum(sums, "yt-dlp.exe")).toBeUndefined();
  });
});
