import { beforeEach, describe, expect, it, vi } from "vitest";
import { getFvLorePage, getFvLorePages, searchEqArchives } from "../src/archive.js";
import { fetchText, postJson } from "../src/http.js";

vi.mock("../src/http.js", () => ({
  fetchText: vi.fn(),
  postJson: vi.fn(),
  primeTextCache: vi.fn(),
  USER_AGENT: "everquest-legends-mcp/test (+https://github.com/ArtSabintsev/everquest-legends-mcp)"
}));

const mockedFetchText = vi.mocked(fetchText);
const mockedPostJson = vi.mocked(postJson);

describe("historical lore and archive helpers", () => {
  beforeEach(() => {
    mockedFetchText.mockReset();
    mockedPostJson.mockReset();
    vi.unstubAllGlobals();
  });

  it("lists FVProject lore category pages", async () => {
    mockedFetchText.mockResolvedValue(
      JSON.stringify({
        query: {
          categorymembers: [{ pageid: 17406, ns: 0, title: "1- Prophecy of Grozmok" }]
        }
      })
    );

    const pages = await getFvLorePages(1);

    expect(pages).toEqual([
      {
        title: "1- Prophecy of Grozmok",
        pageId: 17406,
        ns: 0,
        url: "https://fvproject.com/index.php/1-_Prophecy_of_Grozmok"
      }
    ]);
  });

  it("extracts an FVProject lore page", async () => {
    mockedFetchText.mockResolvedValue(
      JSON.stringify({
        parse: {
          title: "Innoruuk (Lore)",
          pageid: 100,
          revid: 200,
          text: "<div class=\"mw-parser-output\"><p>Innoruuk is the Prince of Hate.</p></div>",
          links: [{ title: "Norrath" }],
          categories: [{ category: "Lore" }]
        }
      })
    );

    const page = await getFvLorePage("Innoruuk (Lore)");

    expect(page.title).toBe("Innoruuk (Lore)");
    expect(page.text).toBe("Innoruuk is the Prince of Hate.");
    expect(page.links).toEqual(["Norrath"]);
    expect(page.categories).toEqual(["Lore"]);
  });

  it("searches EQArchives and strips highlight markup", async () => {
    mockedPostJson.mockResolvedValue({
      hits: {
        total: { value: 1, relation: "eq" },
        hits: [
          {
            _id: "websites/example/miragul.htm",
            _score: 9,
            _source: {
              title: "Miragul",
              url: "https://web.archive.org/web/example",
              domain_name: "example.test",
              capture_date: "2002-01-01T00:00:00"
            },
            highlight: {
              text_full: ["The lich <em>Miragul</em> appears in Everfrost."]
            }
          }
        ]
      }
    });

    const search = await searchEqArchives("Miragul", { limit: 1 });

    expect(search.total).toBe(1);
    expect(search.results[0]).toMatchObject({
      id: "websites/example/miragul.htm",
      title: "Miragul",
      snippet: "The lich Miragul appears in Everfrost."
    });

    const [url, , options] = mockedPostJson.mock.calls[0];
    expect(url).toContain("/_search");
    expect(options?.headers?.authorization).toMatch(/^Basic /);
    expect(options?.cacheTtlMs).toBe(60_000);
  });
});
