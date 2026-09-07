#!/usr/bin/env npx tsx
// Maintainer report: RSS freshness for every registered YouTube source, plus
// official news `creator-*` slugs that are not yet in SOURCE_PAGES.
//
//   npm run check:youtube-sources
//   npm run check:youtube-sources -- --json
//
// Does not write files. STALE = no video in the last 45 days (informational).
// FAIL = feed error (non-zero exit). Missing official creator-* slugs are
// printed/JSON-visible but do not fail the process.

import { EQL_YOUTUBE_SOURCES } from "../src/sources.js";
import { parseYouTubeFeed } from "../src/youtube.js";
import { USER_AGENT } from "../src/http.js";
import {
  YOUTUBE_SOURCE_STALE_DAYS,
  buildYouTubeSourceCheckReport,
  classifyFreshness,
  daysSince,
  exitCodeForYouTubeSourceCheck,
  findMissingCreatorPages,
  formatYouTubeSourceCheckText,
  parseYouTubeSourceCheckArgs,
  type YouTubeSourceCheckRow
} from "../src/youtubeSourceCheck.js";

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

async function checkSource(source: (typeof EQL_YOUTUBE_SOURCES)[number]): Promise<YouTubeSourceCheckRow> {
  try {
    const xml = await fetchText(source.feedUrl);
    const videos = parseYouTubeFeed(xml, 3);
    const latest = videos[0];
    const days = daysSince(latest?.publishedAt);
    return {
      id: source.id,
      title: source.title,
      url: source.feedUrl,
      status: classifyFreshness(days),
      lastPublishedAt: latest?.publishedAt,
      daysSincePublish: days,
      latestTitle: latest?.title
    };
  } catch (error) {
    return {
      id: source.id,
      title: source.title,
      url: source.feedUrl,
      status: "FAIL",
      reason: error instanceof Error ? error.message : String(error)
    };
  }
}

async function main(): Promise<void> {
  const options = parseYouTubeSourceCheckArgs(process.argv.slice(2));
  const sources = await Promise.all(EQL_YOUTUBE_SOURCES.map(checkSource));

  let missingCreatorPages: string[] = [];
  try {
    const html = await fetchText(NEWS_URL);
    const pageNames = [...html.matchAll(/"pageName":"([^"]+)"/g)].map((match) => match[1]);
    missingCreatorPages = findMissingCreatorPages(pageNames);
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    console.error(`WARN   official news index unavailable: ${reason}`);
  }

  const report = buildYouTubeSourceCheckReport(sources, missingCreatorPages, YOUTUBE_SOURCE_STALE_DAYS);

  if (options.json) {
    console.log(JSON.stringify(report, null, 2));
  } else {
    console.log(formatYouTubeSourceCheckText(report));
  }

  process.exitCode = exitCodeForYouTubeSourceCheck(report);
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
