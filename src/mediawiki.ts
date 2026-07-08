import { EQL_WIKI_API_URL, EQL_WIKI_BASE_URL } from "./sources.js";
import { fetchText } from "./http.js";
import { htmlToText, stripHtml, truncateText } from "./text.js";
import { detectNonLaunchEra, type EraAdvisory } from "./era.js";

export type WikiSearchResult = {
  title: string;
  pageId: number;
  size: number;
  wordCount: number;
  timestamp: string;
  snippet: string;
  url: string;
};

export type WikiPage = {
  title: string;
  pageId: number;
  revisionId?: number;
  url: string;
  text: string;
  links: string[];
  categories: string[];
  /** Present only when the page text references non-launch (Kunark/Velious/Luclin) content. */
  eraAdvisory?: EraAdvisory;
};

export type WikiRecentChange = {
  type: string;
  title: string;
  user?: string;
  timestamp: string;
  comment?: string;
  oldLength?: number;
  newLength?: number;
  url: string;
};

export type WikiCategoryPage = {
  title: string;
  pageId: number;
  ns: number;
  url: string;
};

type MediaWikiSearchResponse = {
  query?: {
    search?: Array<{
      title: string;
      pageid: number;
      size: number;
      wordcount: number;
      timestamp: string;
      snippet: string;
    }>;
  };
};

type MediaWikiParseResponse = {
  parse?: {
    title: string;
    pageid: number;
    revid?: number;
    text?: string;
    links?: Array<{ title: string; exists?: boolean }>;
    categories?: Array<{ category: string; hidden?: boolean }>;
  };
  error?: {
    code: string;
    info: string;
  };
};

type MediaWikiRecentChangesResponse = {
  query?: {
    recentchanges?: Array<{
      type: string;
      title: string;
      user?: string;
      timestamp: string;
      comment?: string;
      oldlen?: number;
      newlen?: number;
    }>;
  };
};

type MediaWikiCategoryMembersResponse = {
  query?: {
    categorymembers?: Array<{
      title: string;
      pageid: number;
      ns: number;
    }>;
  };
};

export function wikiPageUrl(title: string): string {
  return `${EQL_WIKI_BASE_URL}/${encodeURIComponent(title.replace(/\s+/g, "_")).replace(/%2F/g, "/")}`;
}

async function wikiApi<T>(params: Record<string, string | number | boolean>): Promise<T> {
  const url = new URL(EQL_WIKI_API_URL);
  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, String(value));
  }
  url.searchParams.set("format", "json");
  url.searchParams.set("formatversion", "2");

  const response = JSON.parse(
    await fetchText(url.href, { cacheTtlMs: 60_000, cacheable: notWikiApiErrorPayload })
  ) as T;
  assertNoWikiApiError(response, "EQL Wiki", params.action);
  return response;
}

// MediaWiki reports failures (rate limits, bad params) inside a 200 response;
// without this check they would surface as empty result lists. A missing page
// on action=parse is the one in-band error callers handle themselves.
export function assertNoWikiApiError(response: unknown, sourceLabel: string, action: unknown): void {
  const apiError = (response as { error?: { code?: string; info?: string } }).error;
  if (!apiError) return;
  if (action === "parse" && apiError.code === "missingtitle") return;
  throw new Error(`${sourceLabel} API error (${apiError.code ?? "unknown"}): ${apiError.info ?? "no details provided"}`);
}

// Keeps transient in-band API errors (delivered with HTTP 200) out of the
// shared cache, so a momentary rate limit is not replayed for a full TTL.
export function notWikiApiErrorPayload(body: string): boolean {
  try {
    return !(JSON.parse(body) as { error?: unknown }).error;
  } catch {
    return true;
  }
}

export async function searchWiki(query: string, limit = 10): Promise<WikiSearchResult[]> {
  const response = await wikiApi<MediaWikiSearchResponse>({
    action: "query",
    list: "search",
    srsearch: query,
    srprop: "snippet|timestamp|size|wordcount",
    srlimit: Math.max(1, Math.min(limit, 50))
  });

  return (response.query?.search ?? []).map((result) => ({
    title: result.title,
    pageId: result.pageid,
    size: result.size,
    wordCount: result.wordcount,
    timestamp: result.timestamp,
    snippet: stripHtml(result.snippet),
    url: wikiPageUrl(result.title)
  }));
}

export async function getWikiPage(title: string, maxCharacters = 12_000): Promise<WikiPage> {
  const response = await wikiApi<MediaWikiParseResponse>({
    action: "parse",
    page: title,
    redirects: true,
    prop: "text|links|categories|revid"
  });

  if (response.error || !response.parse) {
    throw new Error(response.error?.info ?? `Wiki page not found: ${title}`);
  }

  const parsed = response.parse;
  const text = truncateText(htmlToText(parsed.text ?? "", ".mw-parser-output"), maxCharacters);
  const eraAdvisory = detectNonLaunchEra(text);
  return {
    title: parsed.title,
    pageId: parsed.pageid,
    revisionId: parsed.revid,
    url: wikiPageUrl(parsed.title),
    text,
    ...(eraAdvisory.flagged ? { eraAdvisory } : {}),
    links: (parsed.links ?? [])
      .filter((link) => link.exists !== false)
      .map((link) => link.title)
      .slice(0, 200),
    categories: (parsed.categories ?? [])
      .filter((category) => !category.hidden)
      .map((category) => category.category)
  };
}

export async function getRecentChanges(limit = 10): Promise<WikiRecentChange[]> {
  const response = await wikiApi<MediaWikiRecentChangesResponse>({
    action: "query",
    list: "recentchanges",
    rcprop: "title|timestamp|comment|user|sizes|ids",
    rclimit: Math.max(1, Math.min(limit, 50))
  });

  return (response.query?.recentchanges ?? []).map((change) => ({
    type: change.type,
    title: change.title,
    user: change.user,
    timestamp: change.timestamp,
    comment: change.comment,
    oldLength: change.oldlen,
    newLength: change.newlen,
    url: wikiPageUrl(change.title)
  }));
}

export async function getCategoryPages(category: string, limit = 50): Promise<WikiCategoryPage[]> {
  const normalized = category.startsWith("Category:") ? category : `Category:${category}`;
  const response = await wikiApi<MediaWikiCategoryMembersResponse>({
    action: "query",
    list: "categorymembers",
    cmtitle: normalized,
    cmlimit: Math.max(1, Math.min(limit, 500))
  });

  return (response.query?.categorymembers ?? []).map((page) => ({
    title: page.title,
    pageId: page.pageid,
    ns: page.ns,
    url: wikiPageUrl(page.title)
  }));
}
