import { describe, expect, it } from "vitest";
import { htmlToText, snippetAround, stripHtml } from "../src/text.js";

describe("text extraction", () => {
  it("strips HTML snippets", () => {
    expect(stripHtml("<p>Alpha <span>Beta</span></p>")).toBe("Alpha Beta");
  });

  it("removes noisy elements while extracting page text", () => {
    const text = htmlToText("<body><nav>Skip</nav><main><h1>Title</h1><p>Body</p></main><script>skip()</script></body>");
    expect(text).toBe("TitleBody");
  });

  it("creates snippets near query terms", () => {
    const snippet = snippetAround("alpha ".repeat(100) + "Nagafen lives here", "Nagafen", 80);
    expect(snippet).toContain("Nagafen");
    expect(snippet.length).toBeLessThanOrEqual(83);
  });
});
