import { describe, expect, it } from "vitest";
import {
  COMPANION_TOOLS,
  getCompanionTool,
  listCompanionTools
} from "../src/companionTools.js";
import { sourceById } from "../src/sources.js";

describe("companion tools catalog", () => {
  it("lists every catalog entry with linked source ids that exist in the registry", () => {
    const { count, tools, disclaimer } = listCompanionTools();
    expect(count).toBe(COMPANION_TOOLS.length);
    expect(disclaimer).toMatch(/not official Daybreak/i);
    expect(tools.length).toBeGreaterThanOrEqual(5);

    for (const tool of tools) {
      expect(tool.id).toBeTruthy();
      expect(tool.url.startsWith("http")).toBe(true);
      expect(tool.capabilities.length).toBeGreaterThan(0);
      expect(tool.sourceIds.length).toBeGreaterThan(0);
      for (const sourceId of tool.sourceIds) {
        expect(sourceById(sourceId), `missing source ${sourceId} for ${tool.id}`).toBeDefined();
      }
    }
  });

  it("filters by capability and access", () => {
    const gear = listCompanionTools({ capability: "gear" });
    expect(gear.tools.every((t) => t.capabilities.includes("gear"))).toBe(true);
    expect(gear.count).toBeGreaterThan(0);

    const locked = listCompanionTools({ access: "api-origin-locked" });
    expect(locked.tools.map((t) => t.id)).toEqual(["eqlegendstools"]);
  });

  it("resolves a single tool by id", () => {
    const eqltools = getCompanionTool("eqltools");
    expect(eqltools?.access).toBe("html-searchable");
    expect(getCompanionTool("nope")).toBeUndefined();
  });

  it("documents that eqlegendstools API must not be scraped", () => {
    const tool = getCompanionTool("eqlegendstools");
    expect(tool?.access).toBe("api-origin-locked");
    expect(tool?.notes.join(" ")).toMatch(/403|robots|do not scrape/i);
  });
});
