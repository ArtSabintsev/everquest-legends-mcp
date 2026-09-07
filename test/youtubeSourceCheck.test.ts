import { describe, expect, it } from "vitest";
import { SOURCE_PAGES } from "../src/sources.js";
import {
  buildYouTubeSourceCheckReport,
  classifyFreshness,
  daysSince,
  exitCodeForYouTubeSourceCheck,
  findMissingCreatorPages,
  formatYouTubeSourceCheckText,
  parseYouTubeSourceCheckArgs
} from "../src/youtubeSourceCheck.js";

describe("YouTube source check helpers", () => {
  it("classifies freshness and only fails the process on FAIL", () => {
    expect(classifyFreshness(10)).toBe("ok");
    expect(classifyFreshness(46)).toBe("STALE");
    expect(classifyFreshness(null)).toBe("ok");

    const staleOnly = buildYouTubeSourceCheckReport([
      {
        id: "jeditheq-youtube",
        title: "Jedith EQ",
        url: "https://example.test",
        status: "STALE",
        daysSincePublish: 80
      }
    ]);
    expect(exitCodeForYouTubeSourceCheck(staleOnly)).toBe(0);

    const withFail = buildYouTubeSourceCheckReport([
      {
        id: "broken-feed",
        title: "Broken",
        url: "https://example.test",
        status: "FAIL",
        reason: "503"
      }
    ]);
    expect(exitCodeForYouTubeSourceCheck(withFail)).toBe(1);
  });

  it("computes daysSince from ISO timestamps", () => {
    const now = Date.parse("2026-09-07T00:00:00Z");
    expect(daysSince("2026-09-01T00:00:00Z", now)).toBeCloseTo(6, 5);
    expect(daysSince(undefined, now)).toBeNull();
    expect(daysSince("not-a-date", now)).toBeNull();
  });

  it("finds official creator-* slugs missing from SOURCE_PAGES", () => {
    expect(findMissingCreatorPages(["creator-brutallstatic", "getting-started-in-eql"])).toEqual([]);
    expect(findMissingCreatorPages(["creator-newperson"], SOURCE_PAGES)).toEqual(["creator-newperson"]);
    expect(findMissingCreatorPages(["labor-day-murderbee"])).toEqual([]);
  });

  it("parses --json and formats a human report", () => {
    expect(parseYouTubeSourceCheckArgs(["--json"])).toEqual({ json: true });
    expect(parseYouTubeSourceCheckArgs([])).toEqual({ json: false });

    const report = buildYouTubeSourceCheckReport(
      [
        {
          id: "official-youtube",
          title: "Official",
          url: "https://example.test/official",
          status: "ok",
          lastPublishedAt: "2026-09-01T00:00:00Z",
          daysSincePublish: 6,
          latestTitle: "Patch notes"
        }
      ],
      ["creator-newperson"]
    );
    const text = formatYouTubeSourceCheckText(report);
    expect(text).toContain("NEW official creator pages: creator-newperson");
    expect(text).toContain("stale>45d=0  fail=0  ok=1");
  });
});
