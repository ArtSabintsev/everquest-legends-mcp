import { describe, expect, it } from "vitest";
import { parseOfficialNewsArticles } from "../src/official.js";

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
});
