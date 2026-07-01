import { fetchText } from "./http.js";
import { getOfficialNews, type OfficialNewsArticle } from "./official.js";
import { SOURCE_PAGES, sourceById, type SourcePage } from "./sources.js";
import { htmlToText, scoreText, snippetAround, truncateText } from "./text.js";
import { detectNonLaunchEra, type EraAdvisory } from "./era.js";

export type SourceSearchResult = {
  id: string;
  title: string;
  kind: string;
  url: string;
  score: number;
  snippet: string;
};

export type SourceSearchFailure = {
  id: string;
  title: string;
  url: string;
  reason: string;
};

export type SourceSearchResponse = {
  query: string;
  results: SourceSearchResult[];
  failedSources: SourceSearchFailure[];
  searchedSources: number;
};

export type FetchedSource = SourcePage & {
  text: string;
  /** Present only when the fetched text references non-launch (Kunark/Velious/Luclin) content. */
  eraAdvisory?: EraAdvisory;
};

const SOURCE_SEARCH_CONCURRENCY = 4;
const MAX_QUERY_LENGTH = 120;

export async function fetchSource(id: string, maxCharacters = 12_000): Promise<FetchedSource> {
  const source = sourceById(id);
  if (!source) {
    throw new Error(`Unknown source id: ${id}`);
  }
  if (!source.searchable) {
    throw new Error(`Source is a pointer, not a searchable/fetchable page: ${id}`);
  }
  const html = await fetchText(source.url, { cacheTtlMs: 5 * 60_000 });
  const text = truncateText(sourceHtmlToText(source, html), maxCharacters);
  const eraAdvisory = detectNonLaunchEra(text);
  return {
    ...source,
    text,
    ...(eraAdvisory.flagged ? { eraAdvisory } : {})
  };
}

function sourceHtmlToText(source: SourcePage, html: string): string {
  if (source.id === "official-eq-history-1999") {
    const contentMatch = html.match(/<!-- CONTENT SECTION STARTS HERE -->([\s\S]*?)<!-- CONTENT SECTION ENDS HERE -->/i);
    return htmlToText(contentMatch?.[1] ?? html);
  }
  return htmlToText(html);
}

export async function searchCuratedSources(query: string, options: { limit?: number; sourceIds?: string[] } = {}): Promise<SourceSearchResponse> {
  const normalizedQuery = query.trim();
  if (normalizedQuery.length < 2) {
    throw new Error("Search query must be at least 2 characters.");
  }
  if (normalizedQuery.length > MAX_QUERY_LENGTH) {
    throw new Error(`Search query must be ${MAX_QUERY_LENGTH} characters or fewer.`);
  }

  const limit = Math.max(1, Math.min(options.limit ?? 10, 50));
  const allowed = new Set(options.sourceIds ?? SOURCE_PAGES.map((source) => source.id));
  const searchableSources = SOURCE_PAGES.filter((source) => source.searchable && allowed.has(source.id));

  const sourceResults = await mapWithConcurrency(
    searchableSources,
    SOURCE_SEARCH_CONCURRENCY,
    async (source) => {
      try {
        const fetched = await fetchSource(source.id, 30_000);
        const haystack = `${fetched.title}\n${fetched.description}\n${fetched.text}`;
        const score = scoreText(haystack, normalizedQuery);
        if (score <= 0) {
          return {};
        }
        const result: SourceSearchResult = {
          id: source.id,
          title: source.title,
          kind: source.kind,
          url: source.url,
          score,
          snippet: snippetAround(fetched.text, normalizedQuery)
        };
        return { result };
      } catch (error) {
        const failure: SourceSearchFailure = {
          id: source.id,
          title: source.title,
          url: source.url,
          reason: error instanceof Error ? error.message : String(error)
        };
        return { failure };
      }
    }
  );

  const officialNews = allowed.has("official-news") ? await searchOfficialNews(normalizedQuery) : { results: [], failedSource: undefined };
  const curatedResults = sourceResults
    .map((entry) => entry.result)
    .filter((result): result is SourceSearchResult => result !== undefined);
  const failedSources = sourceResults
    .map((entry) => entry.failure)
    .filter((failure): failure is SourceSearchFailure => failure !== undefined);
  if (officialNews.failedSource) {
    failedSources.push(officialNews.failedSource);
  }

  const results = [...curatedResults, ...officialNews.results]
    .sort((left, right) => right.score - left.score || left.title.localeCompare(right.title))
    .slice(0, limit);

  return {
    query: normalizedQuery,
    results,
    failedSources,
    searchedSources: searchableSources.length
  };
}

async function mapWithConcurrency<T, R>(items: T[], concurrency: number, mapper: (item: T) => Promise<R>): Promise<R[]> {
  const results: R[] = [];
  let index = 0;

  async function worker(): Promise<void> {
    while (index < items.length) {
      const currentIndex = index;
      index += 1;
      results[currentIndex] = await mapper(items[currentIndex]);
    }
  }

  const workerCount = Math.min(Math.max(1, concurrency), items.length);
  await Promise.all(Array.from({ length: workerCount }, () => worker()));
  return results;
}

async function searchOfficialNews(query: string): Promise<{ results: SourceSearchResult[]; failedSource?: SourceSearchFailure }> {
  let articles: OfficialNewsArticle[] = [];
  try {
    articles = await getOfficialNews(50);
  } catch (error) {
    return {
      results: [],
      failedSource: {
        id: "official-news:parsed-index",
        title: "Official EverQuest Legends News",
        url: "https://www.everquestlegends.com/news",
        reason: error instanceof Error ? error.message : String(error)
      }
    };
  }

  const results = articles
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

  return { results };
}
