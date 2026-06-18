import { describe, expect, it } from "vitest";
import { parseYouTubeFeed } from "../src/youtube.js";

describe("YouTube feed parsing", () => {
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
});
