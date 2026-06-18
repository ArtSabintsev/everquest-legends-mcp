import { fetchText } from "./http.js";
import { getOfficialNews, type OfficialNewsArticle } from "./official.js";
import { SOURCE_PAGES, sourceById, type SourcePage } from "./sources.js";
import { htmlToText, scoreText, snippetAround, truncateText } from "./text.js";

export type SourceSearchResult = {
  id: string;
  title: string;
  kind: string;
  url: string;
  score: number;
  snippet: string;
};

export type FetchedSource = SourcePage & {
  text: string;
};

export async function fetchSource(id: string, maxCharacters = 12_000): Promise<FetchedSource> {
  const source = sourceById(id);
  if (!source) {
    throw new Error(`Unknown source id: ${id}`);
  }
  if (!source.searchable) {
    throw new Error(`Source is a pointer, not a searchable/fetchable page: ${id}`);
  }
  const html = await fetchText(source.url, { cacheTtlMs: 5 * 60_000 });
  return {
    ...source,
    text: truncateText(htmlToText(html), maxCharacters)
  };
}

export async function searchCuratedSources(query: string, options: { limit?: number; sourceIds?: string[] } = {}): Promise<SourceSearchResult[]> {
  const limit = Math.max(1, Math.min(options.limit ?? 10, 50));
  const allowed = new Set(options.sourceIds ?? SOURCE_PAGES.map((source) => source.id));
  const searchableSources = SOURCE_PAGES.filter((source) => source.searchable && allowed.has(source.id));

  const sourceResults = await Promise.all(
    searchableSources.map(async (source) => {
      try {
        const fetched = await fetchSource(source.id, 30_000);
        const haystack = `${fetched.title}\n${fetched.description}\n${fetched.text}`;
        const score = scoreText(haystack, query);
        if (score <= 0) {
          return undefined;
        }
        const result: SourceSearchResult = {
          id: source.id,
          title: source.title,
          kind: source.kind,
          url: source.url,
          score,
          snippet: snippetAround(fetched.text, query)
        };
        return result;
      } catch {
        return undefined;
      }
    })
  );

  const officialNews = allowed.has("official-news") ? await searchOfficialNews(query) : [];
  const curatedResults: SourceSearchResult[] = sourceResults.filter((result): result is SourceSearchResult => result !== undefined);
  return [...curatedResults, ...officialNews]
    .sort((left, right) => right.score - left.score || left.title.localeCompare(right.title))
    .slice(0, limit);
}

async function searchOfficialNews(query: string): Promise<SourceSearchResult[]> {
  let articles: OfficialNewsArticle[] = [];
  try {
    articles = await getOfficialNews(50);
  } catch {
    return [];
  }

  return articles
    .map((article) => {
      const haystack = `${article.title}\n${article.summary}\n${article.publishedAt}`;
      const score = scoreText(haystack, query);
      if (score <= 0) {
        return undefined;
      }
      const result: SourceSearchResult = {
        id: `official-news:${article.pageName}`,
        title: article.title,
        kind: "official",
        url: article.url,
        score,
        snippet: snippetAround(`${article.summary}\nPublished: ${article.publishedAt}`, query)
      };
      return result;
    })
    .filter((result): result is SourceSearchResult => Boolean(result));
}
