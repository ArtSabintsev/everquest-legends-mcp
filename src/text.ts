import { load } from "cheerio";

export function cleanText(value: string): string {
  return value
    .replace(/\u00a0/g, " ")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/[ \t]*\n[ \t]*/g, "\n")
    .trim();
}

export function stripHtml(html: string): string {
  const $ = load(html);
  return cleanText($.root().text());
}

export function htmlToText(html: string, selector = "body"): string {
  const $ = load(html);
  $("script, style, noscript, svg, nav, footer, form, button").remove();
  const root = $(selector);
  const text = root.length > 0 ? root.text() : $.root().text();
  return cleanText(text);
}

export function truncateText(text: string, maxCharacters: number): string {
  if (text.length <= maxCharacters) {
    return text;
  }
  return `${text.slice(0, Math.max(0, maxCharacters - 1)).trimEnd()}...`;
}

export function snippetAround(text: string, query: string, maxCharacters = 500): string {
  const normalized = cleanText(text);
  const terms = query
    .toLowerCase()
    .split(/\s+/)
    .map((term) => term.replace(/^"+|"+$/g, ""))
    .filter((term) => term.length > 2);
  const lower = normalized.toLowerCase();
  const firstMatch = terms
    .map((term) => lower.indexOf(term))
    .filter((index) => index >= 0)
    .sort((left, right) => left - right)[0];

  if (firstMatch === undefined) {
    return truncateText(normalized, maxCharacters);
  }

  const start = Math.max(0, firstMatch - Math.floor(maxCharacters / 3));
  const end = Math.min(normalized.length, start + maxCharacters);
  const prefix = start > 0 ? "..." : "";
  const suffix = end < normalized.length ? "..." : "";
  return cleanText(`${prefix}${normalized.slice(start, end)}${suffix}`);
}

export function scoreText(text: string, query: string): number {
  const lower = text.toLowerCase();
  return query
    .toLowerCase()
    .split(/\s+/)
    .map((term) => term.replace(/^"+|"+$/g, ""))
    .filter((term) => term.length > 1)
    .reduce((score, term) => {
      const escaped = term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      const matches = lower.match(new RegExp(escaped, "g"));
      return score + (matches?.length ?? 0);
    }, 0);
}
