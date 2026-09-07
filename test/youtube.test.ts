import { beforeEach, describe, expect, it, vi } from "vitest";
import { fetchText } from "../src/http.js";
import { EQL_YOUTUBE_SOURCES } from "../src/sources.js";
import { getYouTubeVideos, listYouTubeSources, parseYouTubeFeed, selectYouTubeSources } from "../src/youtube.js";

vi.mock("../src/http.js", () => ({
  fetchText: vi.fn()
}));

const mockedFetchText = vi.mocked(fetchText);

describe("YouTube feed parsing", () => {
  beforeEach(() => {
    mockedFetchText.mockReset();
  });

  it("extracts official channel video metadata", () => {
    const xml = `
      <feed xmlns:yt="http://www.youtube.com/xml/schemas/2015" xmlns:media="http://search.yahoo.com/mrss/">
        <entry>
          <yt:videoId>DsswWPXweW8</yt:videoId>
          <title>EverQuest Legends: Announce [Official Trailer]</title>
          <link rel="alternate" href="https://www.youtube.com/watch?v=DsswWPXweW8" />
          <author><name>EverQuest Legends</name></author>
          <published>2026-03-24T14:00:00+00:00</published>
          <updated>2026-03-24T14:00:00+00:00</updated>
          <media:group>
            <media:thumbnail url="https://i.ytimg.com/vi/DsswWPXweW8/hqdefault.jpg" />
          </media:group>
        </entry>
      </feed>
    `;

    expect(parseYouTubeFeed(xml)).toEqual([
      {
        videoId: "DsswWPXweW8",
        title: "EverQuest Legends: Announce [Official Trailer]",
        url: "https://www.youtube.com/watch?v=DsswWPXweW8",
        publishedAt: "2026-03-24T14:00:00+00:00",
        updatedAt: "2026-03-24T14:00:00+00:00",
        author: "EverQuest Legends",
        thumbnailUrl: "https://i.ytimg.com/vi/DsswWPXweW8/hqdefault.jpg"
      }
    ]);
  });

  it("lists official and creator YouTube source metadata", () => {
    expect(listYouTubeSources("official").map((source) => source.id)).toEqual(["official-youtube"]);
    expect(listYouTubeSources("creators").map((source) => source.id)).toEqual([
      "brutallstatic-youtube",
      "varietyvoid-youtube",
      "gigglemage-youtube",
      "higherthoughtgaming-youtube",
      "grimthule-youtube",
      "kestontv-youtube",
      "krause-youtube",
      "skeletane-youtube",
      "classicxp-youtube",
      "thegameis-youtube",
      "doclegendary-youtube",
      "hammackj-youtube",
      "brokenstoic-youtube",
      "jeditheq-youtube",
      "presmere-youtube",
      "eqprogression-youtube"
    ]);
  });

  it("fetches and filters selected source feeds with attribution", async () => {
    mockedFetchText.mockResolvedValue(`
      <feed xmlns:yt="http://www.youtube.com/xml/schemas/2015" xmlns:media="http://search.yahoo.com/mrss/">
        <entry>
          <yt:videoId>P1PN5mlh40M</yt:videoId>
          <title>EverQuest Legends Druid 50 Impressions</title>
          <link rel="alternate" href="https://www.youtube.com/watch?v=P1PN5mlh40M" />
          <author><name>HigherThoughtGaming</name></author>
          <published>2026-06-27T19:55:39+00:00</published>
        </entry>
        <entry>
          <yt:videoId>not-eql</yt:videoId>
          <title>Unrelated Upload</title>
          <link rel="alternate" href="https://www.youtube.com/watch?v=not-eql" />
          <author><name>HigherThoughtGaming</name></author>
          <published>2026-06-26T19:55:39+00:00</published>
        </entry>
      </feed>
    `);

    const search = await getYouTubeVideos({
      sourceIds: ["higherthoughtgaming-youtube"],
      query: "Druid",
      limitPerSource: 5
    });

    expect(search.videos).toHaveLength(1);
    expect(search.videos[0]?.sourceId).toBe("higherthoughtgaming-youtube");
    expect(search.videos[0]?.sourceAuthority).toBe("creator");
    expect(search.videos[0]?.title).toBe("EverQuest Legends Druid 50 Impressions");
  });

  it("returns missing source ids as failedSources", async () => {
    const search = await getYouTubeVideos({ sourceIds: ["missing-source"] });

    expect(search.videos).toEqual([]);
    expect(search.failedSources).toEqual([
      {
        id: "missing-source",
        title: "missing-source",
        url: "",
        reason: "Unknown YouTube source id."
      }
    ]);
    expect(mockedFetchText).not.toHaveBeenCalled();
  });

  it("lists eqlSpecific sources including official when eqlSpecificOnly is set", () => {
    const expected = EQL_YOUTUBE_SOURCES.filter((source) => source.eqlSpecific).map((source) => source.id);
    expect(listYouTubeSources("all", { eqlSpecificOnly: true }).map((source) => source.id)).toEqual(expected);
    expect(expected).toContain("official-youtube");
    expect(expected).not.toContain("gigglemage-youtube");
    expect(expected).not.toContain("thegameis-youtube");
  });

  it("selects sources before feed fetch when eqlSpecificOnly is true", async () => {
    mockedFetchText.mockResolvedValue(`
      <feed xmlns:yt="http://www.youtube.com/xml/schemas/2015" xmlns:media="http://search.yahoo.com/mrss/">
        <entry>
          <yt:videoId>official-vid</yt:videoId>
          <title>EverQuest Legends Official</title>
          <link rel="alternate" href="https://www.youtube.com/watch?v=official-vid" />
          <published>2026-09-01T00:00:00+00:00</published>
        </entry>
      </feed>
    `);

    const mixedAndOfficial = ["gigglemage-youtube", "official-youtube", "thegameis-youtube"];
    const selected = selectYouTubeSources({ sourceIds: mixedAndOfficial, eqlSpecificOnly: true });
    expect(selected.sources.map((source) => source.id)).toEqual(["official-youtube"]);

    const search = await getYouTubeVideos({
      sourceIds: mixedAndOfficial,
      eqlSpecificOnly: true,
      limitPerSource: 1
    });

    expect(search.sources.map((source) => source.id)).toEqual(["official-youtube"]);
    expect(mockedFetchText).toHaveBeenCalledTimes(1);
    expect(mockedFetchText).toHaveBeenCalledWith(
      EQL_YOUTUBE_SOURCES.find((source) => source.id === "official-youtube")?.feedUrl,
      expect.any(Object)
    );
  });

  it("keeps mixed channels when eqlSpecificOnly is omitted", () => {
    const selected = selectYouTubeSources({ sourceIds: ["gigglemage-youtube", "official-youtube"] });
    expect(selected.sources.map((source) => source.id)).toEqual(["official-youtube", "gigglemage-youtube"]);
  });

  it("exposes official X as pointer-only metadata and does not invent creator handles", () => {
    const official = EQL_YOUTUBE_SOURCES.find((source) => source.id === "official-youtube");
    expect(official?.xHandle).toBe("@EQ_Legends");
    expect(official?.xUrl).toBe("https://x.com/EQ_Legends");

    const invented = EQL_YOUTUBE_SOURCES.filter(
      (source) => source.authority === "creator" && (source.xHandle || source.xUrl)
    );
    expect(invented).toEqual([]);
  });
});
