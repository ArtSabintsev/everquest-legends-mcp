export type EqlArchetype = "caster" | "priest" | "melee" | "hybrid";

export type EqlClass = {
  name: string;
  abbreviation: string;
  archetype: EqlArchetype;
  wikiTitle: string;
};

export const EQL_CLASSES: readonly EqlClass[] = [
  { name: "Bard", abbreviation: "BRD", archetype: "hybrid", wikiTitle: "Bard" },
  { name: "Beastlord", abbreviation: "BST", archetype: "hybrid", wikiTitle: "Beastlord" },
  { name: "Berserker", abbreviation: "BER", archetype: "melee", wikiTitle: "Berserker" },
  { name: "Cleric", abbreviation: "CLR", archetype: "priest", wikiTitle: "Cleric" },
  { name: "Druid", abbreviation: "DRU", archetype: "priest", wikiTitle: "Druid" },
  { name: "Enchanter", abbreviation: "ENC", archetype: "caster", wikiTitle: "Enchanter" },
  { name: "Magician", abbreviation: "MAG", archetype: "caster", wikiTitle: "Magician" },
  { name: "Monk", abbreviation: "MNK", archetype: "melee", wikiTitle: "Monk" },
  { name: "Necromancer", abbreviation: "NEC", archetype: "caster", wikiTitle: "Necromancer" },
  { name: "Paladin", abbreviation: "PAL", archetype: "hybrid", wikiTitle: "Paladin" },
  { name: "Ranger", abbreviation: "RNG", archetype: "hybrid", wikiTitle: "Ranger" },
  { name: "Rogue", abbreviation: "ROG", archetype: "melee", wikiTitle: "Rogue" },
  { name: "Shadow Knight", abbreviation: "SHD", archetype: "hybrid", wikiTitle: "Shadow_Knight" },
  { name: "Shaman", abbreviation: "SHM", archetype: "priest", wikiTitle: "Shaman" },
  { name: "Warrior", abbreviation: "WAR", archetype: "melee", wikiTitle: "Warrior" },
  { name: "Wizard", abbreviation: "WIZ", archetype: "caster", wikiTitle: "Wizard" }
] as const;

export const EQL_RACES: readonly string[] = [
  "Human",
  "Barbarian",
  "Half-Elf",
  "Wood Elf",
  "High Elf",
  "Dark Elf",
  "Dwarf",
  "Gnome",
  "Erudite",
  "Halfling",
  "Ogre",
  "Troll",
  "Kerran",
  "Iksar",
  "Froglok"
] as const;

export function normalizeClassName(input: string): EqlClass | undefined {
  const value = input.trim().toLowerCase().replace(/[_-]+/g, " ");
  return EQL_CLASSES.find((classInfo) => {
    return (
      classInfo.name.toLowerCase() === value ||
      classInfo.abbreviation.toLowerCase() === value ||
      classInfo.wikiTitle.toLowerCase().replace(/_/g, " ") === value
    );
  });
}

export type ClassComboOptions = {
  include?: string[];
  exclude?: string[];
  limit?: number;
};

export type ClassCombo = {
  classes: string[];
  abbreviations: string[];
  archetypes: EqlArchetype[];
  wikiSearch: string;
  wikiTitles: string[];
};

export function generateClassCombinations(options: ClassComboOptions = {}): ClassCombo[] {
  const include = new Set(
    (options.include ?? [])
      .map((name) => normalizeClassName(name)?.name)
      .filter((name): name is string => Boolean(name))
  );
  const exclude = new Set(
    (options.exclude ?? [])
      .map((name) => normalizeClassName(name)?.name)
      .filter((name): name is string => Boolean(name))
  );
  const limit = Math.max(1, Math.min(options.limit ?? 50, 560));
  const combos: ClassCombo[] = [];

  for (let a = 0; a < EQL_CLASSES.length - 2; a += 1) {
    for (let b = a + 1; b < EQL_CLASSES.length - 1; b += 1) {
      for (let c = b + 1; c < EQL_CLASSES.length; c += 1) {
        const classes = [EQL_CLASSES[a], EQL_CLASSES[b], EQL_CLASSES[c]];
        if (classes.some((classInfo) => exclude.has(classInfo.name))) {
          continue;
        }
        if ([...include].some((name) => !classes.some((classInfo) => classInfo.name === name))) {
          continue;
        }
        combos.push({
          classes: classes.map((classInfo) => classInfo.name),
          abbreviations: classes.map((classInfo) => classInfo.abbreviation),
          archetypes: classes.map((classInfo) => classInfo.archetype),
          wikiSearch: classes.map((classInfo) => `"${classInfo.name}"`).join(" "),
          wikiTitles: classes.map((classInfo) => classInfo.wikiTitle)
        });
      }
    }
  }

  return combos.slice(0, limit);
}
