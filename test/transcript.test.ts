import { describe, expect, it } from "vitest";
import { detectPlatform, extractYouTubeVideoId, parseJson3 } from "../src/transcript.js";

describe("video id resolution", () => {
  it("accepts a raw 11-char id", () => {
    expect(extractYouTubeVideoId("DsswWPXweW8")).toBe("DsswWPXweW8");
  });

  it("parses common YouTube URL forms", () => {
    expect(extractYouTubeVideoId("https://www.youtube.com/watch?v=DsswWPXweW8")).toBe("DsswWPXweW8");
    expect(extractYouTubeVideoId("https://youtu.be/DsswWPXweW8?t=10")).toBe("DsswWPXweW8");
    expect(extractYouTubeVideoId("https://www.youtube.com/shorts/DsswWPXweW8")).toBe("DsswWPXweW8");
    expect(extractYouTubeVideoId("https://www.youtube.com/embed/DsswWPXweW8")).toBe("DsswWPXweW8");
  });

  it("rejects non-YouTube input", () => {
    expect(extractYouTubeVideoId("https://twitch.tv/videos/123456789")).toBeNull();
    expect(extractYouTubeVideoId("not a url")).toBeNull();
  });
});

describe("platform detection", () => {
  it("classifies platforms", () => {
    expect(detectPlatform("https://www.youtube.com/watch?v=DsswWPXweW8")).toBe("youtube");
    expect(detectPlatform("https://www.twitch.tv/videos/123456789")).toBe("twitch");
    expect(detectPlatform("https://example.com/page")).toBe("unknown");
  });
});

describe("json3 caption parsing", () => {
  it("parses events into timed segments and joins multi-seg lines", () => {
    const json = JSON.stringify({
      events: [
        { tStartMs: 1200, dDurationMs: 2160, segs: [{ utf8: "All right, so here we are," }, { utf8: " in front of the elephants" }] },
        { tStartMs: 5318, dDurationMs: 1000, segs: [{ utf8: "\n" }] },
        { tStartMs: 6000, dDurationMs: 1500, segs: [{ utf8: "Welcome to EverQuest Legends" }] }
      ]
    });
    expect(parseJson3(json)).toEqual([
      { start: 1.2, duration: 2.16, text: "All right, so here we are, in front of the elephants" },
      { start: 6, duration: 1.5, text: "Welcome to EverQuest Legends" }
    ]);
  });

  it("returns empty for malformed or eventless input", () => {
    expect(parseJson3("not json")).toEqual([]);
    expect(parseJson3(JSON.stringify({ wireMagic: "pb3" }))).toEqual([]);
  });
});
