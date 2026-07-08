import { describe, expect, it } from "vitest";
import {
  getEqlClientCommand,
  getEqlClientManualSection,
  getEqlClientProvenance,
  getEqlClientRace,
  getEqlClientStoryline,
  getEqlClientZone,
  listEqlClientManualSections,
  listEqlClientRaces,
  listEqlClientZones,
  searchEqlClientCommands,
  searchEqlClientManual,
  searchEqlClientRaces,
  searchEqlClientStorylines
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
    expect(manifest.sources.length).toBe(6);
    expect(manifest.sources.every((s) => s.sha256.length === 64)).toBe(true);
    expect(manifest.counts.commands).toBeGreaterThan(0);
    expect(manifest.counts.races).toBeGreaterThan(0);
    expect(manifest.counts.manualSections).toBeGreaterThan(0);
    expect(manifest.counts.zones).toBeGreaterThan(100);
    expect(manifest.counts.storylines).toBeGreaterThan(40);
  });

  it("lists and searches zones with POI labels", () => {
    const all = listEqlClientZones();
    expect(all.total).toBeGreaterThan(100);
    expect(all.returned).toBe(all.total);
    expect(all.zones[0]).not.toHaveProperty("pois");

    const limited = listEqlClientZones({ limit: 5 });
    expect(limited.total).toBeGreaterThan(100);
    expect(limited.returned).toBe(5);

    const search = listEqlClientZones({ query: "Freeport" });
    expect(search.zones.some((zone) => zone.zone.startsWith("freeport"))).toBe(true);

    const poiSearch = listEqlClientZones({ query: "Pottery" });
    expect(poiSearch.zones.some((zone) => (zone.matchingPois ?? []).some((poi) => /pottery/i.test(poi.label)))).toBe(true);
  });

  it("reads one zone with full POIs and merges map layers", () => {
    const result = getEqlClientZone("freeportwest");
    expect(result.found).toBe(true);
    if (result.found) {
      expect(result.zone.pois.length).toBeGreaterThan(0);
      expect(result.zone.pois.every((poi) => Number.isFinite(poi.x) && poi.label.length > 0)).toBe(true);
    }

    // Partial keys must not silently resolve to an arbitrary zone.
    const partial = getEqlClientZone("west");
    expect(partial.found).toBe(false);
    if (!partial.found) {
      expect(partial.suggestions).toContain("freeportwest");
      expect(partial.suggestions).toContain("cabwest");
    }
    expect(getEqlClientZone("not-a-zone").found).toBe(false);
  });

  it("ranks likely-EQL zones ahead of classic-expansion map files", () => {
    // The client ships classic-expansion maps (sharvahl, poknowledge, ...);
    // a generic POI search must surface unhinted (likely-EQL) zones first.
    const search = listEqlClientZones({ query: "Pottery", limit: 30 });
    const zonesReturned = search.zones;
    const firstHinted = zonesReturned.findIndex((zone) => zone.classicExpansionHint !== null);
    const lastUnhinted = zonesReturned.map((zone) => zone.classicExpansionHint === null).lastIndexOf(true);
    if (firstHinted !== -1) {
      expect(firstHinted).toBeGreaterThan(lastUnhinted);
    }

    const kunark = getEqlClientZone("cabeast");
    expect(kunark.found && kunark.zone.classicExpansionHint).toBe("Kunark");
    const custom = getEqlClientZone("freeportacademy");
    expect(custom.found && custom.zone.classicExpansionHint).toBe(null);
  });

  it("flags inherited classic-expansion storylines with an eraAdvisory", () => {
    const buried = getEqlClientStoryline("buriedsea") ?? getEqlClientStoryline("The Buried Sea");
    expect(buried).toBeDefined();
    expect(buried?.eraAdvisory?.flagged).toBe(true);
    expect(buried?.note).toMatch(/not confirmed EQL canon/i);
  });

  it("searches and reads storylines", () => {
    const search = searchEqlClientStorylines("Firiona Vie");
    expect(search.results.length).toBeGreaterThan(0);

    const byId = getEqlClientStoryline("chosen");
    expect(byId?.storyline.title).toBe("The Search for the Chosen");
    const byTitle = getEqlClientStoryline("The Dark Amulet");
    expect(byTitle?.storyline.id).toBe("amulet");
    // Ambiguous substrings ("dark" matches several titles) must not resolve.
    expect(getEqlClientStoryline("dark")).toBeUndefined();
    expect(getEqlClientStoryline("zz-nonexistent")).toBeUndefined();
  });
});
