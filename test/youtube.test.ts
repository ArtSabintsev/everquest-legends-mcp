import { beforeEach, describe, expect, it, vi } from "vitest";
import { fetchText } from "../src/http.js";
import { getYouTubeVideos, listYouTubeSources, parseYouTubeFeed } from "../src/youtube.js";

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
      "grimthule-youtube",
      "higherthoughtgaming-youtube",
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
});
