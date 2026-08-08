// Public HTML client for eqlegendstools.com item pages.
//
// The site's /api/* routes are origin-locked (403 + robots.txt Disallow). Item
// detail pages under /items/<slug>/ and the /items/ index are server-rendered
// public HTML and are fair game for read-only extraction.

import { fetchText } from "./http.js";
import { htmlToText, scoreText } from "./text.js";

export const EQLEGENDSTOOLS_BASE_URL = "https://eqlegendstools.com";
export const EQLEGENDSTOOLS_DISCLAIMER =
  "Data extracted from public HTML on eqlegendstools.com (community BiS/exaltation tools by FlammHammer). Not official Daybreak documentation. The site's JSON /api/* endpoints are origin-locked and are not used.";

export type EqLegendsToolsItemSummary = {
  name: string;
  slug: string;
  url: string;
  score: number;
};

export type EqLegendsToolsItem = {
  name: string;
  slug: string;
  url: string;
  kind: string | null;
  lines: string[];
  related: Array<{ name: string; slug: string; url: string; note: string | null }>;
  text: string;
};

function decodeEntities(value: string): string {
  return value
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCharCode(parseInt(h, 16)))
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&nbsp;/g, " ");
}

function slugifyItemName(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .replace(/[`'']/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function itemUrl(slug: string): string {
  return `${EQLEGENDSTOOLS_BASE_URL}/items/${slug}/`;
}

/** Parse the /items/ index into name+slug pairs. */
export function parseItemIndex(html: string): Array<{ name: string; slug: string }> {
  const items: Array<{ name: string; slug: string }> = [];
  const seen = new Set<string>();
  const re = /href="\/items\/([a-z0-9-]+)\/"[^>]*>([^<]+)</gi;
  for (const match of html.matchAll(re)) {
    const slug = match[1];
    const name = decodeEntities(match[2]).trim();
    if (!slug || !name || seen.has(slug)) continue;
    seen.add(slug);
    items.push({ name, slug });
  }
  return items;
}

export function parseItemPage(html: string, slug: string): EqLegendsToolsItem {
  const kindMatch = html.match(/<p class="eyebrow">([^<]+)<\/p>/i);
  const titleMatch = html.match(/<main[\s\S]*?<h1>([^<]+)<\/h1>/i) ?? html.match(/<h1>([^<]+)<\/h1>/i);
  const name = decodeEntities((titleMatch?.[1] ?? slug).trim());

  const lines: string[] = [];
  const linesBlock = html.match(/<ul class="tooltip-lines">([\s\S]*?)<\/ul>/i)?.[1] ?? "";
  for (const li of linesBlock.matchAll(/<li>([\s\S]*?)<\/li>/gi)) {
    const text = decodeEntities(li[1].replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim());
    if (text) lines.push(text);
  }

  const related: EqLegendsToolsItem["related"] = [];
  const relatedBlock = html.match(/<ul id="relatedSlotItems"[\s\S]*?<\/ul>/i)?.[0] ?? "";
  for (const li of relatedBlock.matchAll(/<li>\s*<a href="\/items\/([a-z0-9-]+)\/">([^<]+)<\/a>\s*(?:<span>([^<]*)<\/span>)?/gi)) {
    related.push({
      name: decodeEntities(li[2].trim()),
      slug: li[1],
      url: itemUrl(li[1]),
      note: li[3] ? decodeEntities(li[3].trim()) : null
    });
  }

  const main = html.match(/<main[\s\S]*?<\/main>/i)?.[0] ?? html;
  const text = htmlToText(main).trim();

  return {
    name,
    slug,
    url: itemUrl(slug),
    kind: kindMatch ? decodeEntities(kindMatch[1].trim()) : null,
    lines,
    related,
    text
  };
}

let indexCache: { fetchedAt: number; items: Array<{ name: string; slug: string }> } | null = null;
const INDEX_TTL_MS = 15 * 60_000;

export async function loadItemIndex(options: { force?: boolean } = {}): Promise<Array<{ name: string; slug: string }>> {
  if (!options.force && indexCache && Date.now() - indexCache.fetchedAt < INDEX_TTL_MS) {
    return indexCache.items;
  }
  const html = await fetchText(`${EQLEGENDSTOOLS_BASE_URL}/items/`, { cacheTtlMs: INDEX_TTL_MS });
  const items = parseItemIndex(html);
  if (items.length < 50) {
    throw new Error(`eqlegendstools item index parsed only ${items.length} item(s); page layout may have changed.`);
  }
  indexCache = { fetchedAt: Date.now(), items };
  return items;
}

export async function searchEqLegendsToolsItems(
  query: string,
  options: { limit?: number } = {}
): Promise<{
  query: string;
  count: number;
  results: EqLegendsToolsItemSummary[];
  disclaimer: string;
  sourceUrl: string;
}> {
  const normalized = query.trim();
  if (normalized.length < 2) {
    throw new Error("Search query must be at least 2 characters.");
  }
  const limit = Math.max(1, Math.min(options.limit ?? 15, 50));
  const index = await loadItemIndex();
  const results = index
    .map((item) => ({
      name: item.name,
      slug: item.slug,
      url: itemUrl(item.slug),
      score: scoreText(`${item.name} ${item.slug.replace(/-/g, " ")}`, normalized)
    }))
    .filter((entry) => entry.score > 0)
    .sort((a, b) => b.score - a.score || a.name.localeCompare(b.name))
    .slice(0, limit);

  return {
    query: normalized,
    count: results.length,
    results,
    disclaimer: EQLEGENDSTOOLS_DISCLAIMER,
    sourceUrl: `${EQLEGENDSTOOLS_BASE_URL}/items/`
  };
}

export async function getEqLegendsToolsItem(idOrName: string): Promise<
  | { found: true; item: EqLegendsToolsItem; disclaimer: string }
  | { found: false; query: string; suggestions: string[]; disclaimer: string }
> {
  const raw = idOrName.trim();
  if (!raw) {
    throw new Error("Item id or name is required.");
  }

  const index = await loadItemIndex();
  const asSlug = raw.includes("/") ? raw.split("/").filter(Boolean).pop()! : slugifyItemName(raw);
  let slug =
    index.find((item) => item.slug === asSlug)?.slug ??
    index.find((item) => item.name.toLowerCase() === raw.toLowerCase())?.slug;

  if (!slug) {
    // Fall back to best fuzzy matches from the index rather than guessing a 404 URL.
    const scored = index
      .map((item) => ({ item, score: scoreText(`${item.name} ${item.slug.replace(/-/g, " ")}`, raw) }))
      .filter((entry) => entry.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, 8);
    if (scored.length === 1 && scored[0].score >= 8) {
      slug = scored[0].item.slug;
    } else {
      return {
        found: false,
        query: raw,
        suggestions: scored.map((entry) => entry.item.name),
        disclaimer: EQLEGENDSTOOLS_DISCLAIMER
      };
    }
  }

  const html = await fetchText(itemUrl(slug), { cacheTtlMs: 10 * 60_000 });
  if (/page not found|that page wandered/i.test(html) || /<h1>\s*404\s*<\/h1>/i.test(html)) {
    return { found: false, query: raw, suggestions: [], disclaimer: EQLEGENDSTOOLS_DISCLAIMER };
  }
  const item = parseItemPage(html, slug);
  return { found: true, item, disclaimer: EQLEGENDSTOOLS_DISCLAIMER };
}
