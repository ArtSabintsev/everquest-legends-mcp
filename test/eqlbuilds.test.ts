import { describe, expect, it } from "vitest";
import {
  getEqlBuildsClass,
  getEqlBuildsProvenance,
  getEqlBuildsRace,
  listEqlBuildsClasses,
  listEqlBuildsModes,
  listEqlBuildsRaces,
  listEqlBuildsSkills,
  prettifyId,
  searchEqlBuildsAbilities,
  searchEqlBuildsSpells
} from "../src/eqlbuilds.js";

// These tests read the committed eqlbuilds.com snapshot (src/data/eqlbuilds/*),
// so they run offline and also guard the extractor's output shape.

describe("eqlbuilds dataset accessors", () => {
  it("prettifies camelCase and lowercase ids", () => {
    expect(prettifyId("shadowKnight")).toBe("Shadow Knight");
    expect(prettifyId("highElf")).toBe("High Elf");
    expect(prettifyId("warrior")).toBe("Warrior");
  });

  it("lists all 16 classes with counts", () => {
    const { classes } = listEqlBuildsClasses();
    expect(classes).toHaveLength(16);
    const warrior = classes.find((c) => c.id === "warrior");
    expect(warrior).toBeDefined();
    expect(warrior?.name).toBe("Warrior");
    expect(warrior?.armor).toContain("plate");
    expect(warrior?.spellCount).toBeGreaterThan(0);
    expect(warrior?.skillCount).toBeGreaterThan(0);
    expect(warrior?.alternateAbilityCount).toBeGreaterThan(0);
  });

  it("returns class detail with heavy lists gated behind flags", () => {
    const summary = getEqlBuildsClass("wizard");
    expect(summary).toBeDefined();
    expect(summary?.spellList).toBeUndefined();
    expect(summary?.spellCount).toBeGreaterThan(0);

    const withSpells = getEqlBuildsClass("wizard", { includeSpells: true });
    expect(withSpells?.spellList?.length).toBe(withSpells?.spellCount);
  });

  it("resolves classes case-insensitively and returns undefined for unknown ids", () => {
    expect(getEqlBuildsClass("SHADOWKNIGHT")?.id).toBe("shadowKnight");
    expect(getEqlBuildsClass("bogus")).toBeUndefined();
  });

  it("lists active races and includes inactive races on request", () => {
    const active = listEqlBuildsRaces();
    expect(active.races.length).toBeGreaterThanOrEqual(15);
    expect(active.inactive).toHaveLength(0);

    const withInactive = listEqlBuildsRaces(true);
    expect(withInactive.inactive.some((r) => r.id === "drakkin")).toBe(true);
  });

  it("reads a race by id, case-insensitively, and inactive races too", () => {
    expect(getEqlBuildsRace("human")?.name).toBe("Human");
    expect(getEqlBuildsRace("HIGHELF")?.id).toBe("highElf");
    expect(getEqlBuildsRace("drakkin")?.name).toBe("Drakkin");
    expect(getEqlBuildsRace("nope")).toBeUndefined();
  });

  it("searches spells and reports which classes can use them", () => {
    const { results } = searchEqlBuildsSpells("blast of cold");
    expect(results.length).toBeGreaterThan(0);
    expect(results[0].classes.length).toBeGreaterThan(0);
    expect(results[0].name.toLowerCase()).toContain("blast");
  });

  it("restricts spell search to a single class", () => {
    const { results } = searchEqlBuildsSpells("cold", { classId: "wizard", limit: 5 });
    expect(results.every((s) => s.classes.includes("wizard"))).toBe(true);
  });

  it("searches alternate advancement with rank costs and class filtering", () => {
    const { results } = searchEqlBuildsAbilities("adamant will");
    expect(results.length).toBeGreaterThan(0);
    expect(Array.isArray(results[0].rankCosts)).toBe(true);

    const filtered = searchEqlBuildsAbilities("adamant", { classId: "warrior" });
    expect(filtered.results.every((a) => a.classes.includes("warrior"))).toBe(true);
  });

  it("lists class skills", () => {
    const skills = listEqlBuildsSkills("warrior");
    expect(skills?.skills.length).toBeGreaterThan(0);
    expect(skills?.skills[0]).toHaveProperty("cap");
    expect(listEqlBuildsSkills("bogus")).toBeUndefined();
  });

  it("lists stances and invocations distinctly", () => {
    const { stances, invocations } = listEqlBuildsModes();
    expect(stances.length).toBeGreaterThan(0);
    expect(invocations.length).toBeGreaterThan(0);
    expect(stances.some((s) => /stance/i.test(s.name))).toBe(true);
    expect(invocations.some((i) => i.id === "recover")).toBe(true);
  });

  it("reports provenance with a manifest and wiki revision", () => {
    const provenance = getEqlBuildsProvenance();
    expect(provenance.manifest.source).toBe("eqlbuilds.com");
    expect(provenance.manifest.extractedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    expect(provenance.wikiSource.revisionId).toBeGreaterThan(0);
    expect(provenance.extractionNotes.length).toBeGreaterThan(0);
    expect(provenance.disclaimer).toContain("eqlbuilds.com");
  });
});
