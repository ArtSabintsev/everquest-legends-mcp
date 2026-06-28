import { load } from "cheerio";
import { fetchText } from "./http.js";
import { EQL_YOUTUBE_SOURCES, OFFICIAL_YOUTUBE_FEED_URL, type YouTubeSource, type YouTubeSourceAuthority } from "./sources.js";
import { cleanText, scoreText } from "./text.js";

export type YouTubeVideo = {
  videoId: string;
  title: string;
  url: string;
  publishedAt?: string;
  updatedAt?: string;
  author?: string;
  thumbnailUrl?: string;
};

export type EqlYouTubeVideo = YouTubeVideo & {
  sourceId: string;
  sourceTitle: string;
  sourceAuthority: YouTubeSourceAuthority;
  sourceUrl: string;
};

export type YouTubeVideoSearchOptions = {
  sourceIds?: string[];
  scope?: "official" | "creators" | "all";
  query?: string;
  limitPerSource?: number;
  maxTotal?: number;
};

export type YouTubeSourceFailure = {
  id: string;
  title: string;
  url: string;
  reason: string;
};

export type YouTubeVideoSearch = {
  sources: YouTubeSource[];
  videos: EqlYouTubeVideo[];
  failedSources: YouTubeSourceFailure[];
  query?: string;
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

export function listYouTubeSources(scope: "official" | "creators" | "all" = "all"): YouTubeSource[] {
  return EQL_YOUTUBE_SOURCES.filter((source) => {
    if (scope === "official") {
      return source.authority === "official";
    }
    if (scope === "creators") {
      return source.authority === "creator";
    }
    return true;
  });
}

export async function getYouTubeVideos(options: YouTubeVideoSearchOptions = {}): Promise<YouTubeVideoSearch> {
  const limitPerSource = Math.max(1, Math.min(options.limitPerSource ?? 10, 50));
  const maxTotal = Math.max(1, Math.min(options.maxTotal ?? 50, 200));
  const sourceIds = new Set(options.sourceIds ?? []);
  const sources =
    sourceIds.size > 0
      ? EQL_YOUTUBE_SOURCES.filter((source) => sourceIds.has(source.id))
      : listYouTubeSources(options.scope ?? "all");
  const missingSourceIds = [...sourceIds].filter((id) => !EQL_YOUTUBE_SOURCES.some((source) => source.id === id));
  const failedSources: YouTubeSourceFailure[] = missingSourceIds.map((id) => ({
    id,
    title: id,
    url: "",
    reason: "Unknown YouTube source id."
  }));
  const videos: EqlYouTubeVideo[] = [];
  const query = options.query?.trim();

  for (const source of sources) {
    try {
      const xml = await fetchText(source.feedUrl, { cacheTtlMs: 5 * 60_000 });
      const sourceVideos = parseYouTubeFeed(xml, limitPerSource)
        .filter((video) => !query || isVideoMatch(video, query))
        .map((video) => ({
          ...video,
          sourceId: source.id,
          sourceTitle: source.title,
          sourceAuthority: source.authority,
          sourceUrl: source.url
        }));
      videos.push(...sourceVideos);
    } catch (error) {
      failedSources.push({
        id: source.id,
        title: source.title,
        url: source.feedUrl,
        reason: error instanceof Error ? error.message : String(error)
      });
    }
  }

  videos.sort((left, right) => {
    const leftTime = left.publishedAt ? Date.parse(left.publishedAt) : 0;
    const rightTime = right.publishedAt ? Date.parse(right.publishedAt) : 0;
    if (rightTime !== leftTime) {
      return rightTime - leftTime;
    }
    return left.title.localeCompare(right.title);
  });

  return {
    sources,
    videos: videos.slice(0, maxTotal),
    failedSources,
    ...(query ? { query } : {})
  };
}

function isVideoMatch(video: YouTubeVideo, query: string): boolean {
  if (scoreText(video.title, query) > 0) {
    return true;
  }
  const terms = query
    .toLowerCase()
    .split(/\s+/)
    .map((term) => term.replace(/^"+|"+$/g, ""))
    .filter((term) => term.length > 1);
  const haystack = `${video.author ?? ""} ${video.url}`.toLowerCase();
  return terms.some((term) => haystack.includes(term));
}
