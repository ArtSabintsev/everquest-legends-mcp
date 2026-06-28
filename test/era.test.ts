import { describe, expect, it } from "vitest";
import { detectNonLaunchEra } from "../src/era.js";

describe("era advisory", () => {
  it("flags Velious content and its landmarks", () => {
    const advisory = detectNonLaunchEra("Velious has several Tunare-only quests, and Iksar are welcome in Thurgadin.");
    expect(advisory.flagged).toBe(true);
    expect(advisory.eras).toContain("Velious");
    expect(advisory.markers).toContain("Velious");
    expect(advisory.markers).toContain("Thurgadin");
    expect(advisory.note).toMatch(/not in EverQuest Legends/i);
  });

  it("flags Kunark cities even without the word Kunark", () => {
    const advisory = detectNonLaunchEra("The Iksar live in the ancient city of Cabilis near the Lake of Ill Omen.");
    expect(advisory.flagged).toBe(true);
    expect(advisory.eras).toEqual(["Kunark"]);
  });

  it("reports multiple eras in stable Kunark/Velious/Luclin order", () => {
    const advisory = detectNonLaunchEra("Travel from Cabilis to Thurgadin and on to Shar Vahl.");
    expect(advisory.eras).toEqual(["Kunark", "Velious", "Luclin"]);
  });

  it("does not flag pure launch content", () => {
    const advisory = detectNonLaunchEra("Adventure through Qeynos, Freeport, North Ro, and the New Sebilis Expedition on Antonica.");
    expect(advisory.flagged).toBe(false);
    expect(advisory.markers).toHaveLength(0);
    expect(advisory.note).toBe("");
  });

  it("does not collide with the launch-only New Sebilis Expedition", () => {
    const advisory = detectNonLaunchEra("Iksar start in a newly created zone, the New Sebilis Expedition linked to North Ro.");
    expect(advisory.flagged).toBe(false);
  });

  it("returns an empty advisory for empty input", () => {
    expect(detectNonLaunchEra("")).toEqual({ flagged: false, eras: [], markers: [], note: "" });
  });
});
