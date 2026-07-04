import { describe, expect, it } from "vitest";
import {
  getEqlClientCommand,
  getEqlClientManualSection,
  getEqlClientProvenance,
  getEqlClientRace,
  listEqlClientManualSections,
  listEqlClientRaces,
  searchEqlClientCommands,
  searchEqlClientManual,
  searchEqlClientRaces
} from "../src/eqlClient.js";

// These tests read the committed local-client reference snapshot
// (src/data/eql-client/*), so they run offline and also guard the extractor's
// output shape (scripts/extract-eql-reference.mjs).

describe("eql client command reference", () => {
  it("searches slash commands by name and description", () => {
    const { results } = searchEqlClientCommands("anonymous");
    expect(results.length).toBeGreaterThan(0);
    expect(results.some((c) => c.command === "/anon")).toBe(true);
  });

  it("returns every documented form of a command by name", () => {
    const data = getEqlClientCommand("who");
    expect(data).toBeDefined();
    expect(data?.command).toBe("/who");
    // The manual documents /who in several forms (/who, /who all, /who <mask>).
    expect((data?.entries.length ?? 0)).toBeGreaterThan(1);
    for (const entry of data?.entries ?? []) {
      expect(entry.command).toBe("/who");
      expect(entry.description.length).toBeGreaterThan(0);
    }
  });

  it("resolves a command by alias", () => {
    const data = getEqlClientCommand("/a");
    expect(data).toBeDefined();
    expect(data?.command).toBe("/a");
    expect(data?.entries.some((e) => e.command === "/anon")).toBe(true);
  });

  it("never captures parameter fragments like [ON/OFF] as aliases", () => {
    const anon = getEqlClientCommand("/anon");
    const aliases = anon?.entries.flatMap((e) => e.aliases) ?? [];
    expect(aliases).toContain("/a");
    for (const alias of aliases) {
      expect(alias.startsWith("/")).toBe(true);
      expect(/[[\]<>]/.test(alias)).toBe(false);
    }
  });

  it("returns undefined for an unknown command", () => {
    expect(getEqlClientCommand("/definitelynotacommand")).toBeUndefined();
  });
});

describe("eql client race/model table", () => {
  it("lists the authoritative RaceID table including NPC races", () => {
    const { count, races } = listEqlClientRaces({ limit: 5 });
    expect(count).toBeGreaterThan(100); // playable + hundreds of NPC models
    expect(races[0].id).toBe(1);
    expect(races[0].name).toBe("Human");
    expect(races[0].tags).toEqual(expect.arrayContaining(["HUM", "HUF"]));
  });

  it("resolves a race by numeric RaceID", () => {
    const data = getEqlClientRace(1);
    expect(data?.matches).toHaveLength(1);
    expect(data?.matches[0].name).toBe("Human");
    expect(data?.matches[0].models.length).toBeGreaterThan(0);
  });

  it("returns every RaceID that shares a name", () => {
    const data = getEqlClientRace("Iksar");
    expect(data).toBeDefined();
    expect((data?.matches.length ?? 0)).toBeGreaterThan(0);
    expect(data?.matches.some((m) => m.id === 128)).toBe(true);
  });

  it("searches races by model tag", () => {
    const { results } = searchEqlClientRaces("HUM");
    expect(results.some((r) => r.name === "Human")).toBe(true);
  });

  it("returns undefined for an unknown race", () => {
    expect(getEqlClientRace("notarace")).toBeUndefined();
  });
});

describe("eql client manual supplement", () => {
  it("lists manual sections", () => {
    const { count, sections } = listEqlClientManualSections();
    expect(count).toBeGreaterThan(0);
    expect(sections[0].title.length).toBeGreaterThan(0);
  });

  it("searches manual sections and returns a snippet", () => {
    const { results } = searchEqlClientManual("emote");
    expect(results.length).toBeGreaterThan(0);
    expect(results[0].snippet.length).toBeGreaterThan(0);
  });

  it("reads a manual section by partial title", () => {
    const { results } = searchEqlClientManual("voice recognition");
    expect(results.length).toBeGreaterThan(0);
    const section = getEqlClientManualSection(results[0].title);
    expect(section?.section.body.length).toBeGreaterThan(0);
  });
});

describe("eql client provenance", () => {
  it("reports the source client files and counts", () => {
    const { manifest, disclaimer } = getEqlClientProvenance();
    expect(disclaimer.length).toBeGreaterThan(0);
    expect(manifest.sources.length).toBe(4);
    expect(manifest.sources.every((s) => s.sha256.length === 64)).toBe(true);
    expect(manifest.counts.commands).toBeGreaterThan(0);
    expect(manifest.counts.races).toBeGreaterThan(0);
    expect(manifest.counts.manualSections).toBeGreaterThan(0);
  });
});
