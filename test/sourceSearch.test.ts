import { beforeEach, describe, expect, it, vi } from "vitest";
import { fetchText } from "../src/http.js";
import { searchCuratedSources } from "../src/sourceSearch.js";

vi.mock("../src/http.js", () => ({
  fetchText: vi.fn()
}));

const mockedFetchText = vi.mocked(fetchText);

describe("curated source search", () => {
  beforeEach(() => {
    mockedFetchText.mockReset();
  });

  it("returns matches and failed source metadata", async () => {
    mockedFetchText.mockImplementation(async (url) => {
      if (url === "https://www.everquestlegends.com/home") {
        return "<main><h1>EverQuest Legends</h1><p>Beta launch source text.</p></main>";
      }
      throw new Error("blocked by fixture");
    });

    const search = await searchCuratedSources("beta", {
      sourceIds: ["official-home", "official-shop"],
      limit: 5
    });

    expect(search.results.map((result) => result.id)).toEqual(["official-home"]);
    expect(search.failedSources).toEqual([
      {
        id: "official-shop",
        title: "Official EverQuest Legends Shop",
        url: "https://www.everquestlegends.com/shop",
        reason: "blocked by fixture"
      }
    ]);
  });

  it("rejects overlong queries before fetching", async () => {
    await expect(searchCuratedSources("x".repeat(121), { sourceIds: ["official-home"] })).rejects.toThrow(/120 characters/);
    expect(mockedFetchText).not.toHaveBeenCalled();
  });

  it("searches the live patch-notes index when that source is in scope", async () => {
    mockedFetchText.mockImplementation(async (url) => {
      if (url === "https://www.everquestlegends.com/patch-notes") {
        return `<script>window.EQL ??= {}; window.EQL.News ??= {}; window.EQL.News.articles = [{"subtypeArray":["eqlegends"],"start_date_epoch":"1791900000","pageName":"eql-update-notes-10-13-2026","title":"Patch Notes - October 13, 2026","summary":"<p>raid resume checkpoints</p>"}]</script>`;
      }
      throw new Error(`unexpected ${url}`);
    });

    const search = await searchCuratedSources("raid resume", { sourceIds: ["official-patch-notes"], limit: 5 });
    expect(search.failedSources).toEqual([]);
    expect(search.results.some((result) => result.url.endsWith("/patch-notes/eql-update-notes-10-13-2026"))).toBe(true);
  });
});
