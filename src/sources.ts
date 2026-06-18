export type SourceKind = "mediawiki" | "official" | "support" | "guide" | "community" | "press";

export type SourcePage = {
  id: string;
  kind: SourceKind;
  title: string;
  url: string;
  description: string;
  searchable: boolean;
};

export const EQL_WIKI_API_URL = "https://eqlwiki.com/api.php";
export const EQL_WIKI_BASE_URL = "https://eqlwiki.com";
export const OFFICIAL_BASE_URL = "https://www.everquestlegends.com";

export const SOURCE_PAGES: readonly SourcePage[] = [
  {
    id: "eqlwiki-main",
    kind: "mediawiki",
    title: "EverQuest Legends Wiki",
    url: "https://eqlwiki.com/Main_Page",
    description: "Community MediaWiki for EQL pages, including quests, zones, NPCs, classes, equipment, spells, tradeskills, announcements, and build guides.",
    searchable: false
  },
  {
    id: "official-home",
    kind: "official",
    title: "Official EverQuest Legends Home",
    url: "https://www.everquestlegends.com/home",
    description: "Official overview, feature list, social links, and account entry points.",
    searchable: true
  },
  {
    id: "official-news",
    kind: "official",
    title: "Official EverQuest Legends News",
    url: "https://www.everquestlegends.com/news",
    description: "Official article index. Also parsed by eql_official_news.",
    searchable: true
  },
  {
    id: "official-preorder",
    kind: "official",
    title: "Official Pre-Order Announcement",
    url: "https://www.everquestlegends.com/news/everquest-legends-preorder",
    description: "Official pre-order, beta, name reservation, launch date, and subscription details.",
    searchable: true
  },
  {
    id: "daybreak-help-preorder-beta",
    kind: "support",
    title: "Daybreak Help: Pre-Order and Beta",
    url: "https://help.daybreakgames.com/hc/en-us/articles/52413008844307-EverQuest-Legends-Pre-Order-and-Beta",
    description: "Daybreak support article with official website, preorder FAQ, and social links.",
    searchable: true
  },
  {
    id: "everquest-community-note",
    kind: "official",
    title: "EverQuest: A Note to the EverQuest Community",
    url: "https://www.everquest.com/news/eq-note-to-the-community",
    description: "Official EverQuest/Darkpaw community note about the Daybreak collaboration with Game Jawn on EverQuest Legends.",
    searchable: true
  },
  {
    id: "daybreak-press-eqlegends",
    kind: "press",
    title: "Daybreak Press Hub: EverQuest Legends",
    url: "https://www.daybreakgames.com/press/eqlegends",
    description: "Official Daybreak press announcements and tabs for EQL logos, artwork, screenshots, video, and fact sheets.",
    searchable: true
  },
  {
    id: "daybreak-press-fact-sheets",
    kind: "press",
    title: "Daybreak Press: EQL Fact Sheets",
    url: "https://www.daybreakgames.com/press/eqlegends/fact-sheets",
    description: "Official Daybreak EQL fact sheet page with public PDF metadata.",
    searchable: true
  },
  {
    id: "daybreak-press-screenshots",
    kind: "press",
    title: "Daybreak Press: EQL Screenshots",
    url: "https://www.daybreakgames.com/press/eqlegends/screenshots",
    description: "Official Daybreak EQL screenshot page with CDN image URLs.",
    searchable: true
  },
  {
    id: "eqprogression-faq",
    kind: "guide",
    title: "EQProgression: EverQuest Legends FAQ",
    url: "https://www.eqprogression.com/legends/faq/",
    description: "Unofficial FAQ aggregation for EQL launch, hardware, monetization, gameplay, races, and multiclassing.",
    searchable: true
  },
  {
    id: "eqprogression-multiclass",
    kind: "guide",
    title: "EQProgression: Multi-Class Gameplay",
    url: "https://www.eqprogression.com/legends/multi-class-gameplay/",
    description: "Unofficial multiclass gameplay explanation and class-selection notes.",
    searchable: true
  },
  {
    id: "reddit-eqlegends",
    kind: "community",
    title: "r/EQLegends",
    url: "https://www.reddit.com/r/EQLegends/",
    description: "Community subreddit for EverQuest Legends discussion. Included as a pointer, not scraped by default.",
    searchable: false
  },
  {
    id: "official-youtube",
    kind: "community",
    title: "Official YouTube Channel",
    url: "https://www.youtube.com/@EverQuestLegends",
    description: "Official video and livestream channel. Included as a pointer, not scraped by default.",
    searchable: false
  }
] as const;

export function sourceById(id: string): SourcePage | undefined {
  return SOURCE_PAGES.find((source) => source.id === id);
}
