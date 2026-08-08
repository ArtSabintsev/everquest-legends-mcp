import { describe, expect, it } from "vitest";
import { parseItemIndex, parseItemPage } from "../src/eqlegendstools.js";

const INDEX_FIXTURE = `
<html><body><main>
  <a href="/items/windhowl/">Windhowl</a>
  <a href="/items/amulet-of-necropotence/">Amulet of Necropotence</a>
  <a href="/items/windhowl/">Windhowl</a>
</main></body></html>
`;

const ITEM_FIXTURE = `
<html><body>
<main>
  <div class="page-title">
    <p class="eyebrow">Weapon</p>
    <h1>Windhowl</h1>
  </div>
  <aside class="tooltip-card">
    <ul class="tooltip-lines">
      <li>No Trade</li>
      <li>Slot: Primary</li>
      <li>DMG: 12</li>
      <li>Class: BST</li>
      <li>Proc Effect: Herikol&#39;s Soothing</li>
    </ul>
  </aside>
  <ul id="relatedSlotItems" class="related-item-list">
    <li><a href="/items/efreeti-war-spear/">Efreeti War Spear</a> <span>Level 46+</span></li>
  </ul>
</main>
</body></html>
`;

describe("eqlegendstools HTML parsers", () => {
  it("parses the item index and dedupes slugs", () => {
    const items = parseItemIndex(INDEX_FIXTURE);
    expect(items).toEqual([
      { name: "Windhowl", slug: "windhowl" },
      { name: "Amulet of Necropotence", slug: "amulet-of-necropotence" }
    ]);
  });

  it("parses an item detail page", () => {
    const item = parseItemPage(ITEM_FIXTURE, "windhowl");
    expect(item.name).toBe("Windhowl");
    expect(item.kind).toBe("Weapon");
    expect(item.lines).toContain("DMG: 12");
    expect(item.lines.some((line) => /Herikol's Soothing/.test(line))).toBe(true);
    expect(item.related[0]).toMatchObject({
      name: "Efreeti War Spear",
      slug: "efreeti-war-spear",
      note: "Level 46+"
    });
    expect(item.url).toBe("https://eqlegendstools.com/items/windhowl/");
  });
});
