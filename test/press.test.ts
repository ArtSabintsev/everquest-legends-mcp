import { describe, expect, it } from "vitest";
import { parsePressAssets } from "../src/press.js";

describe("press asset parsing", () => {
  it("extracts logo press assets", () => {
    const html = `
      <li class="press-logos-item">
        <a href="https://assets-cdn.daybreakgames.com/uploads/dcsclient/000/000/335/002.png?v=1.0" class="press-logos-item-link">
          <div class="press-logos-item-thumb" style="background-image: url('https://assets-cdn.daybreakgames.com/uploads/dcsclient/000/000/335/001.jpg?v=1.0')"></div>
          <p class="press-logos-item-text press-logos-item-title">EverQuest Legends Logo</p>
          <p class="press-logos-item-text press-logos-item-format">Transparent PNG</p>
          <p class="press-logos-item-text press-logos-item-dimensions">3840 x 2160, 72ppi</p>
        </a>
      </li>
    `;

    const assets = parsePressAssets("logos", html);
    expect(assets).toEqual([
      {
        kind: "logos",
        title: "EverQuest Legends Logo",
        url: "https://assets-cdn.daybreakgames.com/uploads/dcsclient/000/000/335/002.png?v=1.0",
        thumbnailUrl: "https://assets-cdn.daybreakgames.com/uploads/dcsclient/000/000/335/001.jpg?v=1.0",
        format: "Transparent PNG",
        dimensions: "3840 x 2160, 72ppi",
        fileSize: undefined,
        date: undefined,
        sourcePage: "https://www.daybreakgames.com/press/eqlegends/logos"
      }
    ]);
  });

  it("extracts fact-sheet assets", () => {
    const html = `
      <li class="press-fact-sheets-item">
        <a href="https://assets-cdn.daybreakgames.com/uploads/dcsclient/000/000/334/981.pdf?v=1.0" class="press-fact-sheets-item-link">
          <time datetime="2026-03-25 17:34:00" class="press-fact-sheets-item-title-date">03/25/2026</time>
          <p class="press-fact-sheets-item-title-text">EverQuest Legends Fact Sheet</p>
          <p class="press-fact-sheets-item-file-type">PDF</p>
          <p class="press-fact-sheets-item-file-size">128 KB</p>
        </a>
      </li>
    `;

    const assets = parsePressAssets("fact-sheets", html);
    expect(assets[0]).toMatchObject({
      kind: "fact-sheets",
      title: "EverQuest Legends Fact Sheet",
      format: "PDF",
      fileSize: "128 KB",
      date: "2026-03-25 17:34:00"
    });
  });
});
