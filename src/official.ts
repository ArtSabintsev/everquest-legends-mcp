import { load } from "cheerio";
import { fetchText } from "./http.js";
import { OFFICIAL_BASE_URL } from "./sources.js";
import { cleanText, htmlToText, stripHtml, truncateText } from "./text.js";

export type OfficialNewsArticle = {
  title: string;
  pageName: string;
  url: string;
  publishedAt: string;
  summary: string;
  poster?: string;
  subtypeArray: string[];
};

export type OfficialArticle = {
  title: string;
  url: string;
  publishedAt?: string;
  description?: string;
  text: string;
};

type RawOfficialNewsArticle = {
  title: string;
  pageName: string;
  start_date_epoch: string;
  summary: string;
  poster?: string;
  subtypeArray?: string[];
};

const OFFICIAL_NEWS_PATH_PREFIX = "/news/";
const OFFICIAL_HOSTNAME = new URL(OFFICIAL_BASE_URL).hostname;
const OFFICIAL_ARTICLE_PAGE_NAME_PATTERN = /^[a-z0-9][a-z0-9-]*$/i;

/** Returns null when the inline articles payload is missing entirely (page structure changed). */
export function parseOfficialNewsArticles(html: string): OfficialNewsArticle[] | null {
  const match = html.match(/window\.EQL\.News\.articles\s*=\s*(\[[^\n]*\])/);
  if (!match) {
    return null;
  }

  const rawArticles = JSON.parse(match[1]) as RawOfficialNewsArticle[];
  return rawArticles.map((article) => ({
    title: cleanText(article.title),
    pageName: article.pageName,
    url: `${OFFICIAL_BASE_URL}/news/${article.pageName}`,
    publishedAt: new Date(Number(article.start_date_epoch) * 1000).toISOString(),
    summary: stripHtml(article.summary),
    poster: article.poster,
    subtypeArray: article.subtypeArray ?? []
  }));
}

export async function getOfficialNews(limit = 10): Promise<OfficialNewsArticle[]> {
  const html = await fetchText(`${OFFICIAL_BASE_URL}/news`, { cacheTtlMs: 60_000 });
  const articles = parseOfficialNewsArticles(html);
  if (articles === null) {
    // A silent empty list would read as "no news"; a missing payload means the
    // scrape target moved and this parser needs updating.
    throw new Error("Official news page structure changed: window.EQL.News.articles payload not found.");
  }
  return articles.slice(0, Math.max(1, Math.min(limit, 50)));
}

export function resolveOfficialArticleUrl(pageNameOrUrl: string): string {
  const input = pageNameOrUrl.trim();
  if (!input) {
    throw new Error("Official article page name is required.");
  }

  let pageName: string;
  if (/^https?:\/\//i.test(input)) {
    const parsed = new URL(input);
    if (parsed.protocol !== "https:" || parsed.hostname !== OFFICIAL_HOSTNAME) {
      throw new Error(`Official article URL must be an https URL on ${OFFICIAL_HOSTNAME}.`);
    }
    if (!parsed.pathname.startsWith(OFFICIAL_NEWS_PATH_PREFIX)) {
      throw new Error("Official article URL must be under /news/.");
    }
    pageName = parsed.pathname.slice(OFFICIAL_NEWS_PATH_PREFIX.length);
  } else {
    pageName = input.replace(/^\/+/, "").replace(/^news\/+/i, "");
  }

  pageName = pageName.replace(/\/+$/, "");
  if (!OFFICIAL_ARTICLE_PAGE_NAME_PATTERN.test(pageName)) {
    throw new Error("Official article page name must be a single news slug.");
  }

  return `${OFFICIAL_BASE_URL}/news/${pageName}`;
}

export async function getOfficialArticle(pageNameOrUrl: string, maxCharacters = 12_000): Promise<OfficialArticle> {
  const url = resolveOfficialArticleUrl(pageNameOrUrl);
  const html = await fetchText(url, { cacheTtlMs: 60_000 });
  const $ = load(html);
  const title = cleanText($("meta[property='og:title']").attr("content") ?? $(".news-article-title").first().text() ?? $("title").text());
  const publishedAt = $("meta[property='article:published_time']").attr("content") ?? $(".news-article-posted-on").attr("datetime");
  const description = cleanText($("meta[property='og:description']").attr("content") ?? "");
  const articleBody = $(".news-article-body").html();
  const text = articleBody ? htmlToText(articleBody) : htmlToText(html, "article");

  return {
    title,
    url,
    publishedAt,
    description: description || undefined,
    text: truncateText(text, maxCharacters)
  };
}
