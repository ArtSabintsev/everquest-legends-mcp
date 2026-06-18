import { load } from "cheerio";
import { fetchText } from "./http.js";
import { cleanText } from "./text.js";

export const PRESS_ASSET_KINDS = ["logos", "artwork", "screenshots", "video", "fact-sheets"] as const;

export type PressAssetKind = (typeof PRESS_ASSET_KINDS)[number];

export type PressAsset = {
  kind: PressAssetKind;
  title: string;
  url: string;
  thumbnailUrl?: string;
  format?: string;
  dimensions?: string;
  fileSize?: string;
  date?: string;
  sourcePage: string;
};

const PRESS_BASE_URL = "https://www.daybreakgames.com/press/eqlegends";

function assetPageUrl(kind: PressAssetKind): string {
  return `${PRESS_BASE_URL}/${kind}`;
}

function absoluteUrl(url: string): string {
  return new URL(url, PRESS_BASE_URL).href;
}

function backgroundImageUrl(style: string | undefined): string | undefined {
  if (!style) {
    return undefined;
  }
  const match = style.match(/url\(['"]?([^'")]+)['"]?\)/);
  return match ? absoluteUrl(match[1]) : undefined;
}

export function parsePressAssets(kind: PressAssetKind, html: string, sourcePage = assetPageUrl(kind)): PressAsset[] {
  const $ = load(html);
  const items = $(`.press-${kind}-item`).toArray();
  const assets: PressAsset[] = [];

  for (const item of items) {
    const $item = $(item);
    const firstLink = $item.find("a[href]").first();
    const url = firstLink.attr("href");
    if (!url) {
      continue;
    }

    const thumbnailUrl = backgroundImageUrl($item.find("[style*='background-image']").first().attr("style"));
    const title =
      cleanText($item.find(`[class*="press-${kind}-item-title-text"]`).first().text()) ||
      cleanText($item.find(`p[class*="press-${kind}-item-title"]`).first().text()) ||
      cleanText($item.find("p").first().text()) ||
      cleanText(firstLink.attr("title") ?? "") ||
      absoluteUrl(url);

    assets.push({
      kind,
      title,
      url: absoluteUrl(url),
      thumbnailUrl,
      format: cleanText($item.find(`[class*="press-${kind}-item-format"], [class*="file-type"]`).first().text()) || undefined,
      dimensions: cleanText($item.find(`[class*="press-${kind}-item-dimensions"]`).first().text()) || undefined,
      fileSize: cleanText($item.find(`[class*="file-size"]`).first().text()) || undefined,
      date: cleanText($item.find("time").first().attr("datetime") ?? $item.find("time").first().text()) || undefined,
      sourcePage
    });
  }

  return assets;
}

export async function listPressAssets(kind: PressAssetKind): Promise<PressAsset[]> {
  const sourcePage = assetPageUrl(kind);
  const html = await fetchText(sourcePage, { cacheTtlMs: 5 * 60_000 });
  return parsePressAssets(kind, html, sourcePage);
}
