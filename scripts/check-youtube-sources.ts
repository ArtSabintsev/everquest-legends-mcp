#!/usr/bin/env npx tsx
// Maintainer report: RSS freshness for every registered YouTube source, plus
// official news `creator-*` slugs that are not yet in SOURCE_PAGES.
//
//   npm run check:youtube-sources
//
// Does not write files. STALE = no video in the last 45 days. FAIL = feed error.

import { EQL_YOUTUBE_SOURCES, SOURCE_PAGES } from "../src/sources.js";
import { parseYouTubeFeed } from "../src/youtube.js";
import { USER_AGENT } from "../src/http.js";

const STALE_DAYS = 45;
const NEWS_URL = "https://www.everquestlegends.com/news";

async function fetchText(url: string): Promise<string> {
  const response = await fetch(url, {
    headers: { "User-Agent": USER_AGENT, Accept: "*/*" }
  });
  if (!response.ok) {
    throw new Error(`${response.status} ${response.statusText}`);
  }
  return response.text();
}

function daysSince(iso: string | undefined): number | null {
  if (!iso) return null;
  const ms = Date.parse(iso);
  if (Number.isNaN(ms)) return null;
  return (Date.now() - ms) / 86_400_000;
}

async function main(): Promise<void> {
  console.log(`YouTube sources (${EQL_YOUTUBE_SOURCES.length}):`);
  let stale = 0;
  let failed = 0;
  for (const source of EQL_YOUTUBE_SOURCES) {
    try {
      const xml = await fetchText(source.feedUrl);
      const videos = parseYouTubeFeed(xml, 3);
      const latest = videos[0];
      const days = daysSince(latest?.publishedAt);
      const flag = days !== null && days > STALE_DAYS ? "STALE" : "ok";
      if (flag === "STALE") stale += 1;
      const age = days === null ? "?" : `${Math.round(days)}d`;
      const title = (latest?.title ?? "(empty feed)").slice(0, 72);
      const when = latest?.publishedAt?.slice(0, 10) ?? "none";
      console.log(`${flag.padEnd(6)} ${source.id.padEnd(32)} last=${when}  ${age.padStart(4)}  ${title}`);
    } catch (error) {
      failed += 1;
      const reason = error instanceof Error ? error.message : String(error);
      console.log(`FAIL   ${source.id.padEnd(32)} ${reason}`);
    }
  }

  const html = await fetchText(NEWS_URL);
  const pageNames = [...html.matchAll(/"pageName":"([^"]+)"/g)].map((match) => match[1]);
  const missingCreatorPages = pageNames.filter(
    (name) =>
      name.startsWith("creator-") &&
      !SOURCE_PAGES.some((page) => page.url.includes(`/news/${name}`))
  );
  console.log("");
  console.log(
    missingCreatorPages.length === 0
      ? "Official news creator-* slugs: all present in SOURCE_PAGES."
      : `NEW official creator pages: ${missingCreatorPages.join(", ")}`
  );
  console.log(`stale>${STALE_DAYS}d=${stale}  fail=${failed}`);
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
