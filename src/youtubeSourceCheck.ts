import { SOURCE_PAGES } from "./sources.js";

export const YOUTUBE_SOURCE_STALE_DAYS = 45;

export type YouTubeSourceCheckStatus = "ok" | "STALE" | "FAIL";

export type YouTubeSourceCheckRow = {
  id: string;
  title: string;
  url: string;
  status: YouTubeSourceCheckStatus;
  lastPublishedAt?: string;
  daysSincePublish?: number | null;
  latestTitle?: string;
  reason?: string;
};

export type YouTubeSourceCheckReport = {
  staleDays: number;
  ok: number;
  stale: number;
  fail: number;
  sources: YouTubeSourceCheckRow[];
  missingCreatorPages: string[];
};

export type YouTubeSourceCheckCliOptions = {
  json: boolean;
};

export function daysSince(iso: string | undefined, now = Date.now()): number | null {
  if (!iso) return null;
  const ms = Date.parse(iso);
  if (Number.isNaN(ms)) return null;
  return (now - ms) / 86_400_000;
}

export function classifyFreshness(days: number | null, staleDays = YOUTUBE_SOURCE_STALE_DAYS): "ok" | "STALE" {
  return days !== null && days > staleDays ? "STALE" : "ok";
}

export function findMissingCreatorPages(
  pageNames: readonly string[],
  sourcePages: readonly { url: string }[] = SOURCE_PAGES
): string[] {
  return pageNames.filter(
    (name) => name.startsWith("creator-") && !sourcePages.some((page) => page.url.includes(`/news/${name}`))
  );
}

export function buildYouTubeSourceCheckReport(
  sources: YouTubeSourceCheckRow[],
  missingCreatorPages: string[] = [],
  staleDays = YOUTUBE_SOURCE_STALE_DAYS
): YouTubeSourceCheckReport {
  return {
    staleDays,
    ok: sources.filter((row) => row.status === "ok").length,
    stale: sources.filter((row) => row.status === "STALE").length,
    fail: sources.filter((row) => row.status === "FAIL").length,
    sources,
    missingCreatorPages
  };
}

/**
 * Soft check: STALE and missing official creator-* slugs are informational.
 * Only feed errors (FAIL) produce a non-zero exit.
 */
export function exitCodeForYouTubeSourceCheck(report: YouTubeSourceCheckReport): number {
  return report.fail > 0 ? 1 : 0;
}

export function parseYouTubeSourceCheckArgs(argv: readonly string[]): YouTubeSourceCheckCliOptions {
  return {
    json: argv.includes("--json")
  };
}

export function formatYouTubeSourceCheckLine(row: YouTubeSourceCheckRow): string {
  if (row.status === "FAIL") {
    return `FAIL   ${row.id.padEnd(32)} ${row.reason ?? "unknown error"}`;
  }
  const age = row.daysSincePublish == null ? "?" : `${Math.round(row.daysSincePublish)}d`;
  const title = (row.latestTitle ?? "(empty feed)").slice(0, 72);
  const when = row.lastPublishedAt?.slice(0, 10) ?? "none";
  return `${row.status.padEnd(6)} ${row.id.padEnd(32)} last=${when}  ${age.padStart(4)}  ${title}`;
}

export function formatYouTubeSourceCheckText(report: YouTubeSourceCheckReport): string {
  const lines = [
    `YouTube sources (${report.sources.length}):`,
    ...report.sources.map(formatYouTubeSourceCheckLine),
    "",
    report.missingCreatorPages.length === 0
      ? "Official news creator-* slugs: all present in SOURCE_PAGES."
      : `NEW official creator pages: ${report.missingCreatorPages.join(", ")}`,
    `stale>${report.staleDays}d=${report.stale}  fail=${report.fail}  ok=${report.ok}`
  ];
  return lines.join("\n");
}
