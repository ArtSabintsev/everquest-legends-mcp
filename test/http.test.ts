import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { clearFetchCache, fetchText, postJson, primeTextCache, USER_AGENT } from "../src/http.js";

function okResponse(body: string, finalUrl?: string): Response {
  const response = new Response(body, { status: 200 });
  if (finalUrl !== undefined) {
    Object.defineProperty(response, "url", { value: finalUrl });
  }
  return response;
}

const MAINTENANCE_PAGE =
  "<html><body><h1>We Are Currently Undergoing Maintenance</h1>" +
  "<p>Yes, you're in the right place! Unfortunately we are not, but hope to be getting there very soon.</p></body></html>";

describe("shared HTTP layer", () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    clearFetchCache();
    fetchMock.mockReset();
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("serves repeat requests from cache within the caller's TTL", async () => {
    fetchMock.mockResolvedValue(okResponse("body"));

    await fetchText("https://example.test/a");
    const second = await fetchText("https://example.test/a");

    expect(second).toBe("body");
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("judges freshness against each caller's TTL, not the first caller's", async () => {
    fetchMock.mockResolvedValueOnce(okResponse("first")).mockResolvedValueOnce(okResponse("second"));

    await fetchText("https://example.test/a");
    const fresh = await fetchText("https://example.test/a", { cacheTtlMs: 0 });

    expect(fresh).toBe("second");
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("coalesces concurrent identical requests into one upstream fetch", async () => {
    let release: (value: Response) => void = () => {};
    fetchMock.mockReturnValue(
      new Promise<Response>((resolve) => {
        release = resolve;
      })
    );

    const first = fetchText("https://example.test/a");
    const second = fetchText("https://example.test/a");
    release(okResponse("shared"));

    expect(await first).toBe("shared");
    expect(await second).toBe("shared");
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("retries once on a retryable HTTP status", async () => {
    fetchMock
      .mockResolvedValueOnce(new Response("busy", { status: 503 }))
      .mockResolvedValueOnce(okResponse("recovered"));

    const body = await fetchText("https://example.test/a");

    expect(body).toBe("recovered");
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("does not retry non-retryable HTTP errors and does not cache them", async () => {
    fetchMock.mockResolvedValueOnce(new Response("missing", { status: 404 })).mockResolvedValueOnce(okResponse("later"));

    await expect(fetchText("https://example.test/a")).rejects.toThrow("HTTP 404");
    expect(fetchMock).toHaveBeenCalledTimes(1);

    const body = await fetchText("https://example.test/a");
    expect(body).toBe("later");
  });

  it("caches POST responses keyed by URL and body", async () => {
    fetchMock
      .mockResolvedValueOnce(okResponse(JSON.stringify({ hit: "alpha" })))
      .mockResolvedValueOnce(okResponse(JSON.stringify({ hit: "beta" })));

    const alpha1 = await postJson<{ hit: string }>("https://example.test/search", { q: "alpha" });
    const alpha2 = await postJson<{ hit: string }>("https://example.test/search", { q: "alpha" });
    const beta = await postJson<{ hit: string }>("https://example.test/search", { q: "beta" });

    expect(alpha1.hit).toBe("alpha");
    expect(alpha2.hit).toBe("alpha");
    expect(beta.hit).toBe("beta");
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("sends custom headers and the shared User-Agent on POST", async () => {
    fetchMock.mockResolvedValue(okResponse("{}"));

    await postJson("https://example.test/search", { q: "x" }, { headers: { authorization: "Basic abc" } });

    const [, init] = fetchMock.mock.calls[0];
    expect(init.method).toBe("POST");
    expect(init.headers["authorization"]).toBe("Basic abc");
    expect(init.headers["user-agent"]).toBe(USER_AGENT);
    expect(USER_AGENT).toMatch(/^everquest-legends-mcp\/\d+\.\d+\.\d+ \(\+https:/);
  });

  it("rejects a redirect to the Daybreak maintenance host instead of returning its body", async () => {
    fetchMock.mockResolvedValue(okResponse(MAINTENANCE_PAGE, "http://maintenance.daybreakgames.com/"));

    await expect(fetchText("https://www.everquestlegends.com/shop")).rejects.toThrow(/in maintenance/);
  });

  it("rejects a maintenance interstitial served without a redirect, and does not cache it", async () => {
    fetchMock.mockResolvedValueOnce(okResponse(MAINTENANCE_PAGE)).mockResolvedValueOnce(okResponse("back up"));

    await expect(fetchText("https://www.everquestlegends.com/news")).rejects.toThrow(/maintenance interstitial/);
    expect(fetchMock).toHaveBeenCalledTimes(1);

    expect(await fetchText("https://www.everquestlegends.com/news")).toBe("back up");
  });

  it("does not mistake an article that merely mentions maintenance for the interstitial", async () => {
    fetchMock.mockResolvedValue(
      okResponse("<p>Servers are currently undergoing maintenance for tonight's launch patch.</p>")
    );

    await expect(fetchText("https://www.everquestlegends.com/news")).resolves.toContain("launch patch");
  });

  it("primeTextCache makes out-of-band responses visible to fetchText", async () => {
    primeTextCache("https://example.test/fallback", "primed");

    const body = await fetchText("https://example.test/fallback");

    expect(body).toBe("primed");
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
