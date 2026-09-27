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

  it("registers the September 2026 community survey additions", () => {
    const surveyIds = [
      "eqlforge",
      "everquest-companion",
      "basabots",
      "eqbuddy",
      "seqo",
      "eql-meter",
      "eql-alerts",
      "eql-maps",
      "eql-class-choice-sheet",
      "eql-class-perks-sheet",
      "eql-top-items"
    ] as const;

    for (const id of surveyIds) {
      const tool = getCompanionTool(id);
      expect(tool, id).toBeDefined();
      expect(tool?.sourceIds.length).toBeGreaterThan(0);
      for (const sourceId of tool?.sourceIds ?? []) {
        expect(sourceById(sourceId)?.searchable, sourceId).toBe(false);
      }
    }

    const forge = getCompanionTool("eqlforge");
    expect(forge?.access).toBe("interactive-spa");
    expect(forge?.capabilities).toEqual(
      expect.arrayContaining(["trio-builder", "aa", "gear", "classes", "items"])
    );
    expect(forge?.summary).toMatch(/560/);

    const basabots = getCompanionTool("basabots");
    expect(basabots?.access).toBe("pointer-only");
    expect(basabots?.notes.join(" ")).toMatch(/commercial|\$3/i);

    const eqltools = getCompanionTool("eqltools");
    expect(eqltools?.sourceIds).toEqual(expect.arrayContaining(["eqltools-osxeql", "osxeql-github"]));
    expect(sourceById("osxeql-github")?.url).toBe("https://github.com/sowoky/osxEQL");
    expect(sourceById("osxeql-github")?.searchable).toBe(false);

    const guide = sourceById("guide-pal-monk-sha");
    expect(guide?.kind).toBe("guide");
    expect(guide?.searchable).toBe(true);
    expect(guide?.url).toBe("https://xm2514-svg.github.io/sites/");
    expect(guide?.description).toMatch(/Paladin\/Monk\/Shaman/);
    expect(getCompanionTool("guide-pal-monk-sha")).toBeUndefined();

    expect(listCompanionTools({ access: "api-origin-locked" }).tools.map((tool) => tool.id)).toEqual([
      "eqlegendstools"
    ]);
  });
});
