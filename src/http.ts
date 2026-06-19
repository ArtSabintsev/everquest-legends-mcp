const DEFAULT_TIMEOUT_MS = 15_000;
const DEFAULT_CACHE_TTL_MS = 5 * 60_000;

type CacheEntry = {
  expiresAt: number;
  body: string;
};

const textCache = new Map<string, CacheEntry>();

export type FetchTextOptions = {
  timeoutMs?: number;
  cacheTtlMs?: number;
};

export async function fetchText(url: string, options: FetchTextOptions = {}): Promise<string> {
  const cacheTtlMs = options.cacheTtlMs ?? DEFAULT_CACHE_TTL_MS;
  const cached = textCache.get(url);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.body;
  }

  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        "accept": "text/html,application/json;q=0.9,*/*;q=0.8",
        "user-agent": "everquest-legends-mcp/1.0.0 (+https://github.com/ArtSabintsev/everquest-legends-mcp)"
      }
    });

    if (!response.ok) {
      throw new Error(`GET ${url} failed with HTTP ${response.status}`);
    }

    const body = await response.text();
    if (cacheTtlMs > 0) {
      textCache.set(url, {
        body,
        expiresAt: Date.now() + cacheTtlMs
      });
    }
    return body;
  } finally {
    clearTimeout(timeout);
  }
}

export function clearFetchCache(): void {
  textCache.clear();
}
