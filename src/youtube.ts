import { load } from "cheerio";
import { fetchText } from "./http.js";
import { OFFICIAL_YOUTUBE_FEED_URL } from "./sources.js";
import { cleanText } from "./text.js";

export type YouTubeVideo = {
  videoId: string;
  title: string;
  url: string;
  publishedAt?: string;
  updatedAt?: string;
  author?: string;
  thumbnailUrl?: string;
};

export function parseYouTubeFeed(xml: string, limit = 20): YouTubeVideo[] {
  const $ = load(xml, { xmlMode: true });
  return $("entry")
    .toArray()
    .slice(0, Math.max(1, Math.min(limit, 50)))
    .map((entry) => {
      const $entry = $(entry);
      const videoId = cleanText($entry.find("yt\\:videoId").first().text());
      const link = $entry.find("link[rel='alternate']").attr("href") ?? (videoId ? `https://www.youtube.com/watch?v=${videoId}` : "");
      return {
        videoId,
        title: cleanText($entry.find("title").first().text()),
        url: link,
        publishedAt: cleanText($entry.find("published").first().text()) || undefined,
        updatedAt: cleanText($entry.find("updated").first().text()) || undefined,
        author: cleanText($entry.find("author name").first().text()) || undefined,
        thumbnailUrl: $entry.find("media\\:thumbnail").first().attr("url")
      };
    })
    .filter((video) => video.videoId && video.title && video.url);
}

export async function getOfficialYouTubeVideos(limit = 20): Promise<YouTubeVideo[]> {
  const xml = await fetchText(OFFICIAL_YOUTUBE_FEED_URL, { cacheTtlMs: 5 * 60_000 });
  return parseYouTubeFeed(xml, limit);
}
