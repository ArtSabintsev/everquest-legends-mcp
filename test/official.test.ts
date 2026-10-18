import { describe, expect, it } from "vitest";
import { parseOfficialNewsArticles, resolveOfficialArticleUrl } from "../src/official.js";

describe("official news parsing", () => {
  it("extracts official article metadata from the inline news payload", () => {
    const html = `
      <script>
        window.EQL ??= {};
        window.EQL.News ??= {};
        window.EQL.News.articles = [{"subtypeArray":["eqlegends","soe"],"start_date_epoch":"1780937400","pageName":"everquest-legends-preorder","title":"EverQuest Legends Pre-Order, Coming June 16, 2026! ","summary":"<p>EverQuest Legends Pre-Order information!</p>","poster":"https://example.test/poster.jpg"}]
      </script>
    `;

    const articles = parseOfficialNewsArticles(html);
    expect(articles).toHaveLength(1);
    expect(articles[0]).toMatchObject({
      pageName: "everquest-legends-preorder",
      title: "EverQuest Legends Pre-Order, Coming June 16, 2026!",
      summary: "EverQuest Legends Pre-Order information!",
      url: "https://www.everquestlegends.com/news/everquest-legends-preorder"
    });
    expect(articles[0]?.publishedAt).toBe("2026-06-08T16:50:00.000Z");
  });

  it("normalizes official article slugs and official news URLs", () => {
    expect(resolveOfficialArticleUrl("everquest-legends-preorder")).toBe("https://www.everquestlegends.com/news/everquest-legends-preorder");
    expect(resolveOfficialArticleUrl("/news/everquest-legends-preorder")).toBe("https://www.everquestlegends.com/news/everquest-legends-preorder");
    expect(resolveOfficialArticleUrl("https://www.everquestlegends.com/news/everquest-legends-preorder")).toBe(
      "https://www.everquestlegends.com/news/everquest-legends-preorder"
    );
    expect(resolveOfficialArticleUrl("patch-notes/eql-update-notes-10-13-2026")).toBe(
      "https://www.everquestlegends.com/patch-notes/eql-update-notes-10-13-2026"
    );
    expect(resolveOfficialArticleUrl("https://www.everquestlegends.com/patch-notes/eql-update-notes-10-13-2026")).toBe(
      "https://www.everquestlegends.com/patch-notes/eql-update-notes-10-13-2026"
    );
  });

  it("builds patch-note URLs from the patch-notes index payload", () => {
    const html = `
      <script>
        window.EQL.News.articles = [{"subtypeArray":["eqlegends"],"start_date_epoch":"1791900000","pageName":"eql-update-notes-10-13-2026","title":"Patch Notes - October 13, 2026","summary":"<p>EQL Patch Notes</p>"}]
      </script>
    `;
    const articles = parseOfficialNewsArticles(html, "patch-notes");
    expect(articles?.[0]?.url).toBe("https://www.everquestlegends.com/patch-notes/eql-update-notes-10-13-2026");
  });

  it("rejects article inputs outside official https news pages", () => {
    expect(() => resolveOfficialArticleUrl("http://127.0.0.1/news/everquest-legends-preorder")).toThrow(/https URL/);
    expect(() => resolveOfficialArticleUrl("http://localhost/news/everquest-legends-preorder")).toThrow(/https URL/);
    expect(() => resolveOfficialArticleUrl("http://169.254.169.254/latest/meta-data")).toThrow(/https URL/);
    expect(() => resolveOfficialArticleUrl("https://example.com/news/everquest-legends-preorder")).toThrow(/https URL/);
    expect(() => resolveOfficialArticleUrl("https://www.everquestlegends.com/home")).toThrow(/under \/news\//);
    expect(() => resolveOfficialArticleUrl("/news/../../home")).toThrow(/single news slug/);
  });
});
