import { fetchText, postJson, primeTextCache, USER_AGENT } from "./http.js";
import { get as httpsGet } from "node:https";
import { detectNonLaunchEra, type EraAdvisory } from "./era.js";
import { assertNoWikiApiError, notWikiApiErrorPayload } from "./mediawiki.js";
import { EQ_ARCHIVES_REPOSITORY_URL, EQ_ARCHIVES_SEARCH_URL, FVPROJECT_API_URL, FVPROJECT_BASE_URL } from "./sources.js";
import { cleanText, htmlToText, stripHtml, truncateText } from "./text.js";

const FV_LORE_CATEGORY = "Category:Lore";
const EQ_ARCHIVES_INDEX = "eq-archive";
const EQ_ARCHIVES_ELASTIC_URL = `${EQ_ARCHIVES_SEARCH_URL}elasticsearch/${EQ_ARCHIVES_INDEX}`;
// Public readonly credential embedded by https://search.eqarchives.org/ for browser search.
const EQ_ARCHIVES_AUTHORIZATION = "Basic cmVhZG9ubHk6ZTNjYzVjNTAtZWM2YS0xMWVmLWFmNzQtMDAxNTVkNGI2MDk5";

export type FvLorePage = {
  title: string;
  pageId: number;
  ns: number;
  url: string;
};

export type FvLoreArticle = {
  title: string;
  pageId: number;
  revisionId?: number;
  url: string;
  text: string;
  links: string[];
  categories: string[];
  eraAdvisory?: EraAdvisory;
};

export type EqArchiveSearchResult = {
  id: string;
  title: string;
  url: string;
  alternateUrl?: string;
  score: number;
  snippet: string;
  summary?: string;
  captureDate?: string;
  guessedDate?: string;
  domainName?: string;
  mailingListName?: string;
  contentFlavour?: string;
  tags?: string[];
};

export type EqArchiveSearchResponse = {
  query: string;
  total: number;
  relation: "eq" | "gte";
  results: EqArchiveSearchResult[];
  source: {
    searchUrl: string;
    repositoryUrl: string;
  };
};

export type EqArchiveDocument = EqArchiveSearchResult & {
  text: string;
  eraAdvisory?: EraAdvisory;
};

type FvCategoryMembersResponse = {
  continue?: {
    cmcontinue?: string;
  };
  query?: {
    categorymembers?: Array<{
      title: string;
      pageid: number;
      ns: number;
    }>;
  };
};

type FvParseResponse = {
  parse?: {
    title: string;
    pageid: number;
    revid?: number;
    text?: string;
    links?: Array<{ title: string; exists?: boolean }>;
    categories?: Array<{ category: string; hidden?: boolean }>;
  };
  error?: {
    info: string;
  };
};

type EqArchiveHit = {
  _id: string;
  _score?: number;
  _source?: {
    title?: string;
    url?: string;
    alternate_url?: string;
    llm_summary?: string;
    text_full?: string;
    llm_image_text?: string;
    capture_date?: string;
    llm_guessed_date?: string;
    domain_name?: string;
    mailing_list_name?: string;
    llm_content_flavour?: string | null;
    llm_tags?: string[] | string | null;
  };
  highlight?: Record<string, string[]>;
};

type EqArchiveSearchApiResponse = {
  hits?: {
    total?: {
      value?: number;
      relation?: "eq" | "gte";
    };
    hits?: EqArchiveHit[];
  };
};

export function fvLorePageUrl(title: string): string {
  return `${FVPROJECT_BASE_URL}/index.php/${encodeURIComponent(title.replace(/\s+/g, "_")).replace(/%2F/g, "/")}`;
}

async function fvApi<T>(params: Record<string, string | number | boolean>): Promise<T> {
  const url = new URL(FVPROJECT_API_URL);
  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, String(value));
  }
  url.searchParams.set("format", "json");
  url.searchParams.set("formatversion", "2");
  const response = JSON.parse(await fetchFvText(url.href)) as T;
  assertNoWikiApiError(response, "FVProject", params.action);
  return response;
}

async function fetchFvText(url: string): Promise<string> {
  try {
    return await fetchText(url, { cacheTtlMs: 5 * 60_000, cacheable: notWikiApiErrorPayload });
  } catch (error) {
    if (!isCertificateError(error)) {
      throw error;
    }
    const body = await fetchNodeHttps(url, 3);
    // The TLS-workaround path bypasses fetchText, so record its result under
    // the same cache key — otherwise every FVProject call refetches.
    primeTextCache(url, body);
    return body;
  }
}

function isCertificateError(error: unknown): boolean {
  const cause = (error as { cause?: { code?: string } })?.cause;
  const message = error instanceof Error ? error.message : String(error);
  return cause?.code === "UNABLE_TO_VERIFY_LEAF_SIGNATURE" || message.includes("unable to verify");
}

async function fetchNodeHttps(url: string, redirectsRemaining: number): Promise<string> {
  return new Promise((resolve, reject) => {
    const request = httpsGet(
      url,
      {
        rejectUnauthorized: false,
        headers: {
          "accept": "application/json,text/html;q=0.9,*/*;q=0.8",
          "user-agent": USER_AGENT
        }
      },
      (response) => {
        const location = response.headers.location;
        if (location && response.statusCode && response.statusCode >= 300 && response.statusCode < 400) {
          response.resume();
          if (redirectsRemaining <= 0) {
            reject(new Error(`FVProject redirect limit exceeded for ${url}`));
            return;
          }
          fetchNodeHttps(new URL(location, url).href, redirectsRemaining - 1).then(resolve, reject);
          return;
        }

        if (!response.statusCode || response.statusCode >= 400) {
          response.resume();
          reject(new Error(`GET ${url} failed with HTTP ${response.statusCode ?? "unknown"}`));
          return;
        }

        const chunks: Buffer[] = [];
        response.on("data", (chunk: Buffer) => chunks.push(chunk));
        response.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
      }
    );
    request.setTimeout(15_000, () => {
      request.destroy(new Error(`GET ${url} timed out`));
    });
    request.on("error", reject);
  });
}

export async function getFvLorePages(limit = 50): Promise<FvLorePage[]> {
  const target = Math.max(1, Math.min(limit, 500));
  const pages: FvLorePage[] = [];
  let cmcontinue: string | undefined;

  while (pages.length < target) {
    const response = await fvApi<FvCategoryMembersResponse>({
      action: "query",
      list: "categorymembers",
      cmtitle: FV_LORE_CATEGORY,
      cmlimit: Math.min(500, target - pages.length),
      ...(cmcontinue ? { cmcontinue } : {})
    });

    pages.push(
      ...(response.query?.categorymembers ?? []).map((page) => ({
        title: page.title,
        pageId: page.pageid,
        ns: page.ns,
        url: fvLorePageUrl(page.title)
      }))
    );

    cmcontinue = response.continue?.cmcontinue;
    if (!cmcontinue) break;
  }

  return pages;
}

export async function searchFvLore(query: string, limit = 10): Promise<FvLorePage[]> {
  const normalizedQuery = query.trim().toLowerCase();
  if (normalizedQuery.length < 2) {
    throw new Error("Search query must be at least 2 characters.");
  }
  const terms = normalizedQuery.split(/\s+/).filter(Boolean);
  const pages = await getFvLorePages(500);
  return pages
    .map((page) => {
      const title = page.title.toLowerCase();
      const score = terms.reduce((total, term) => total + (title.includes(term) ? 1 : 0), 0);
      return { page, score };
    })
    .filter((entry) => entry.score > 0)
    .sort((left, right) => right.score - left.score || left.page.title.localeCompare(right.page.title))
    .slice(0, Math.max(1, Math.min(limit, 50)))
    .map((entry) => entry.page);
}

export async function getFvLorePage(title: string, maxCharacters = 12_000): Promise<FvLoreArticle> {
  const response = await fvApi<FvParseResponse>({
    action: "parse",
    page: title,
    redirects: true,
    prop: "text|links|categories|revid"
  });

  if (response.error || !response.parse) {
    throw new Error(response.error?.info ?? `FVProject lore page not found: ${title}`);
  }

  const parsed = response.parse;
  const text = truncateText(htmlToText(parsed.text ?? "", ".mw-parser-output"), maxCharacters);
  const eraAdvisory = detectNonLaunchEra(text);
  return {
    title: parsed.title,
    pageId: parsed.pageid,
    revisionId: parsed.revid,
    url: fvLorePageUrl(parsed.title),
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

async function postEqArchives(body: Record<string, unknown>, cacheTtlMs: number): Promise<EqArchiveSearchApiResponse> {
  return postJson<EqArchiveSearchApiResponse>(`${EQ_ARCHIVES_ELASTIC_URL}/_search`, body, {
    cacheTtlMs,
    headers: { authorization: EQ_ARCHIVES_AUTHORIZATION }
  });
}

function asTags(value: string[] | string | null | undefined): string[] | undefined {
  if (Array.isArray(value)) return value;
  if (typeof value === "string" && value.trim()) return value.split(",").map((tag) => tag.trim()).filter(Boolean);
  return undefined;
}

function archiveSnippet(hit: EqArchiveHit): string {
  const highlighted = Object.values(hit.highlight ?? {}).flat()[0];
  const summary = hit._source?.llm_summary;
  const text = highlighted ?? (summary && !summary.startsWith("[ Still awaiting") ? summary : hit._source?.text_full) ?? "";
  return truncateText(cleanText(stripHtml(text.replace(/<\/?em>/g, ""))), 700);
}

function archiveHitToResult(hit: EqArchiveHit): EqArchiveSearchResult {
  const source = hit._source ?? {};
  return {
    id: hit._id,
    title: source.title || hit._id,
    url: source.url || source.alternate_url || `${EQ_ARCHIVES_SEARCH_URL}?q=${encodeURIComponent(hit._id)}`,
    ...(source.alternate_url && source.alternate_url !== source.url ? { alternateUrl: source.alternate_url } : {}),
    score: hit._score ?? 0,
    snippet: archiveSnippet(hit),
    ...(source.llm_summary && !source.llm_summary.startsWith("[ Still awaiting") ? { summary: source.llm_summary } : {}),
    ...(source.capture_date ? { captureDate: source.capture_date } : {}),
    ...(source.llm_guessed_date ? { guessedDate: source.llm_guessed_date } : {}),
    ...(source.domain_name ? { domainName: source.domain_name } : {}),
    ...(source.mailing_list_name ? { mailingListName: source.mailing_list_name } : {}),
    ...(source.llm_content_flavour ? { contentFlavour: source.llm_content_flavour } : {}),
    ...(asTags(source.llm_tags) ? { tags: asTags(source.llm_tags) } : {})
  };
}

export async function searchEqArchives(query: string, options: { limit?: number } = {}): Promise<EqArchiveSearchResponse> {
  const normalizedQuery = query.trim();
  if (normalizedQuery.length < 2) {
    throw new Error("Search query must be at least 2 characters.");
  }
  if (normalizedQuery.length > 200) {
    throw new Error("Search query must be 200 characters or fewer.");
  }

  const size = Math.max(1, Math.min(options.limit ?? 10, 25));
  // Search results can shift as the archive is indexed; keep them fresh.
  const response = await postEqArchives({
    size,
    query: {
      multi_match: {
        query: normalizedQuery,
        fields: ["title^3", "llm_summary^2", "text_full", "llm_image_text"]
      }
    },
    highlight: {
      fields: {
        title: { fragment_size: 160, number_of_fragments: 1 },
        llm_summary: { fragment_size: 220, number_of_fragments: 1 },
        text_full: { fragment_size: 320, number_of_fragments: 1 },
        llm_image_text: { fragment_size: 220, number_of_fragments: 1 }
      }
    },
    _source: {
      includes: [
        "title",
        "url",
        "alternate_url",
        "llm_summary",
        "capture_date",
        "llm_guessed_date",
        "domain_name",
        "mailing_list_name",
        "llm_content_flavour",
        "llm_tags"
      ]
    }
  }, 60_000);

  const total = response.hits?.total?.value ?? 0;
  return {
    query: normalizedQuery,
    total,
    relation: response.hits?.total?.relation ?? "eq",
    results: (response.hits?.hits ?? []).map(archiveHitToResult),
    source: {
      searchUrl: EQ_ARCHIVES_SEARCH_URL,
      repositoryUrl: EQ_ARCHIVES_REPOSITORY_URL
    }
  };
}

export async function getEqArchiveDocument(id: string, maxCharacters = 12_000): Promise<EqArchiveDocument> {
  const normalizedId = id.trim();
  if (!normalizedId) {
    throw new Error("EQArchives document id is required.");
  }

  const response = await postEqArchives({
    size: 1,
    query: { ids: { values: [normalizedId] } },
    _source: {
      includes: [
        "title",
        "url",
        "alternate_url",
        "llm_summary",
        "text_full",
        "llm_image_text",
        "capture_date",
        "llm_guessed_date",
        "domain_name",
        "mailing_list_name",
        "llm_content_flavour",
        "llm_tags"
      ]
    }
    // Documents are immutable archive captures; the default 5-minute TTL is safe.
  }, 5 * 60_000);

  const hit = response.hits?.hits?.[0];
  if (!hit) {
    throw new Error(`EQArchives document not found: ${normalizedId}`);
  }

  const source = hit._source ?? {};
  const text = truncateText(cleanText(source.text_full ?? source.llm_image_text ?? source.llm_summary ?? ""), maxCharacters);
  const eraAdvisory = detectNonLaunchEra(text);
  return {
    ...archiveHitToResult(hit),
    text,
    ...(eraAdvisory.flagged ? { eraAdvisory } : {})
  };
}
