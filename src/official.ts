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

export function parseOfficialNewsArticles(html: string): OfficialNewsArticle[] {
  const match = html.match(/window\.EQL\.News\.articles\s*=\s*(\[[^\n]*\])/);
  if (!match) {
    return [];
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
  return parseOfficialNewsArticles(html).slice(0, Math.max(1, Math.min(limit, 50)));
}

export async function getOfficialArticle(pageNameOrUrl: string, maxCharacters = 12_000): Promise<OfficialArticle> {
  const url = pageNameOrUrl.startsWith("http")
    ? pageNameOrUrl
    : `${OFFICIAL_BASE_URL}/news/${pageNameOrUrl.replace(/^\/?news\//, "")}`;
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
