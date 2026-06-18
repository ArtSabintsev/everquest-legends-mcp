import { describe, expect, it } from "vitest";
import { EQL_CLASSES, generateClassCombinations, normalizeClassName } from "../src/domain.js";

describe("domain metadata", () => {
  it("contains the sixteen public EQL classes", () => {
    expect(EQL_CLASSES).toHaveLength(16);
    expect(EQL_CLASSES.map((classInfo) => classInfo.name)).toContain("Shadow Knight");
  });

  it("normalizes common class inputs", () => {
    expect(normalizeClassName("shd")?.name).toBe("Shadow Knight");
    expect(normalizeClassName("Shadow_Knight")?.name).toBe("Shadow Knight");
    expect(normalizeClassName("MAG")?.name).toBe("Magician");
  });

  it("generates unordered three-class combinations", () => {
    const allCombos = generateClassCombinations({ limit: 560 });
    expect(allCombos).toHaveLength(560);
    expect(allCombos[0]?.classes).toEqual(["Bard", "Beastlord", "Berserker"]);
  });

  it("filters combinations by include and exclude lists", () => {
    const combos = generateClassCombinations({
      include: ["WAR", "Cleric"],
      exclude: ["Druid"],
      limit: 20
    });
    expect(combos.length).toBeGreaterThan(0);
    expect(combos.every((combo) => combo.classes.includes("Warrior"))).toBe(true);
    expect(combos.every((combo) => combo.classes.includes("Cleric"))).toBe(true);
    expect(combos.every((combo) => !combo.classes.includes("Druid"))).toBe(true);
  });
});
