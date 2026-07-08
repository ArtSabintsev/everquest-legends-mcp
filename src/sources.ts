export type SourceKind = "mediawiki" | "official" | "support" | "guide" | "community" | "press" | "archive" | "lore" | "builds";

export type SourcePage = {
  id: string;
  kind: SourceKind;
  title: string;
  url: string;
  description: string;
  searchable: boolean;
  /**
   * "eql" (default): describes EverQuest Legends itself.
   * "classic-eq": preserved classic-EverQuest material kept for historical/lore
   * context only — EQL is a custom game, so this content is not authoritative
   * for it (zones, mobs, items, and lore can all differ).
   */
  authority?: "eql" | "classic-eq";
};

export type YouTubeSourceAuthority = "official" | "creator";

export type YouTubeSource = {
  id: string;
  authority: YouTubeSourceAuthority;
  title: string;
  channelId: string;
  handle: string;
  url: string;
  feedUrl: string;
  description: string;
  eqlSpecific: boolean;
  lastVerifiedAt: string;
};

export type CreatorProgramMetadata = {
  authority: "official";
  sourceUrl: string;
  applicationUrl: string;
  discordUrl: string;
  announcedAt: string;
  lastVerifiedAt: string;
  requirements: string[];
  eligibleContentCategories: string[];
  reviewWindow: string;
  ongoingExpectation: string;
  notes: string[];
};

export const EQL_WIKI_API_URL = "https://eqlwiki.com/api.php";
export const EQL_WIKI_BASE_URL = "https://eqlwiki.com";
export const OFFICIAL_BASE_URL = "https://www.everquestlegends.com";
export const OFFICIAL_YOUTUBE_CHANNEL_ID = "UCOjj8LA6zJR3I5QFIPnyP9g";
export const OFFICIAL_YOUTUBE_FEED_URL = youtubeChannelFeedUrl(OFFICIAL_YOUTUBE_CHANNEL_ID);
export const FVPROJECT_BASE_URL = "https://fvproject.com";
export const FVPROJECT_API_URL = `${FVPROJECT_BASE_URL}/api.php`;
export const EQ_ARCHIVES_SEARCH_URL = "https://search.eqarchives.org/";
export const EQ_ARCHIVES_REPOSITORY_URL = "https://github.com/dbsanfte/eq-archives/tree/master";
export const EQLBUILDS_BASE_URL = "https://eqlbuilds.com";

export const SOURCE_SCOPE =
  "Curated sources are scoped to EverQuest Legends only. General EQ1/EQ2, P99, EQEmu, Project Quarm, and other emulator/background databases are intentionally excluded unless a page is specifically about EverQuest Legends. Sources tagged authority: classic-eq are preserved classic-EverQuest material kept for historical/lore context — EverQuest Legends is a custom game, so prefer EQL-authoritative sources (client data, eqlbuilds, EQL wiki, official pages) whenever they disagree.";

export function youtubeChannelFeedUrl(channelId: string): string {
  return `https://www.youtube.com/feeds/videos.xml?channel_id=${channelId}`;
}

export const EQL_YOUTUBE_SOURCES: readonly YouTubeSource[] = [
  {
    id: "official-youtube",
    authority: "official",
    title: "Official EverQuest Legends YouTube",
    channelId: OFFICIAL_YOUTUBE_CHANNEL_ID,
    handle: "@EverQuestLegends",
    url: "https://www.youtube.com/@EverQuestLegends",
    feedUrl: OFFICIAL_YOUTUBE_FEED_URL,
    description: "Official EverQuest Legends videos, livestream VODs, insight-series posts, trailers, and preorder videos.",
    eqlSpecific: true,
    lastVerifiedAt: "2026-06-28"
  },
  {
    id: "grimthule-youtube",
    authority: "creator",
    title: "Grimthule",
    channelId: "UCf85KLDMspTHcgF_idsdj-Q",
    handle: "@Grimthule",
    url: "https://www.youtube.com/@Grimthule",
    feedUrl: youtubeChannelFeedUrl("UCf85KLDMspTHcgF_idsdj-Q"),
    description: "Community creator channel publishing EQL beta streams, beginner tips, UI setup, guides, and short-form updates.",
    eqlSpecific: false,
    lastVerifiedAt: "2026-06-28"
  },
  {
    id: "higherthoughtgaming-youtube",
    authority: "creator",
    title: "HigherThoughtGaming",
    channelId: "UCST38DWZEL5YS8qjOl_tzsA",
    handle: "@MoProduktions",
    url: "https://www.youtube.com/@MoProduktions",
    feedUrl: youtubeChannelFeedUrl("UCST38DWZEL5YS8qjOl_tzsA"),
    description: "Community creator channel with EQL class impressions, farm routes, beta commentary, livestream-answer recaps, and systems discussion.",
    eqlSpecific: false,
    lastVerifiedAt: "2026-06-28"
  },
  {
    id: "eqprogression-youtube",
    authority: "creator",
    title: "EQProgression",
    channelId: "UCe9ME7DDqiFxTj2EyWaN8-w",
    handle: "@eqprogression3040",
    url: "https://www.youtube.com/@eqprogression3040",
    feedUrl: youtubeChannelFeedUrl("UCe9ME7DDqiFxTj2EyWaN8-w"),
    description: "EverQuest-focused community creator channel with EQL beta recaps, leveling impressions, development updates, and preview commentary.",
    eqlSpecific: false,
    lastVerifiedAt: "2026-06-28"
  }
];

export const EQL_CREATOR_PROGRAM: CreatorProgramMetadata = {
  authority: "official",
  sourceUrl: "https://www.everquestlegends.com/news/everquest-legends-creator-program",
  applicationUrl: "https://sdqk.me/partnership/69b326fd69674c002f86bf01",
  discordUrl: "https://discord.gg/everquestlegends",
  announcedAt: "2026-05-29",
  lastVerifiedAt: "2026-06-28",
  requirements: [
    "Applicants must be 18 or older.",
    "Applicants must be in good standing with the EverQuest Legends and Daybreak communities.",
    "Applicants must have created at least 15 pieces of content in the past 90 days.",
    "Applicants must meet at least three eligible content-category requirements."
  ],
  eligibleContentCategories: [
    "Streaming",
    "Short-form video content",
    "Long-form video content",
    "Writing/guides",
    "Podcasting",
    "Social media reach"
  ],
  reviewWindow: "Applications are reviewed manually; the article says responses can take 30-60 days.",
  ongoingExpectation: "Accepted creators are expected to produce at least 5 approved pieces per month to stay active.",
  notes: [
    "The program is official, but individual creator videos remain unofficial unless published by an official EQL channel.",
    "Creator rewards are described as launch-dependent and not direct cash payments in the official article."
  ]
};

export const SOURCE_PAGES: readonly SourcePage[] = [
  {
    id: "eqlwiki-main",
    kind: "mediawiki",
    title: "EverQuest Legends Wiki",
    url: "https://eqlwiki.com/Main_Page",
    description: "Unofficial community MediaWiki specifically for EQL pages, including quests, zones, NPCs, classes, equipment, spells, tradeskills, announcements, and build guides.",
    searchable: false
  },
  {
    id: "eqlwiki-guides",
    kind: "mediawiki",
    title: "EQL Wiki: Guides Category",
    url: "https://eqlwiki.com/Category:Guides",
    description: "Unofficial EQL wiki guide category. Use eql_wiki_category_pages for structured category reads.",
    searchable: false
  },
  {
    id: "eqlwiki-character",
    kind: "mediawiki",
    title: "EQL Wiki: Character Category",
    url: "https://eqlwiki.com/Category:Character",
    description: "Unofficial EQL wiki character-system category for classes, races, builds, and related pages.",
    searchable: false
  },
  {
    id: "eqlwiki-race-unlock-guide",
    kind: "mediawiki",
    title: "EQL Wiki: Alanna's Race Unlock Guide",
    url: "https://eqlwiki.com/Alanna%27s_Race_Unlock_Guide",
    description: "Unofficial EQL wiki guide for race unlock factions and achievement requirements.",
    searchable: true
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
    id: "official-shop",
    kind: "official",
    title: "Official EverQuest Legends Shop",
    url: "https://www.everquestlegends.com/shop",
    description: "Official purchase, preorder, name-reservation, subscription, and FAQ page.",
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
    id: "official-announcement",
    kind: "official",
    title: "Official EverQuest Legends Announcement",
    url: "https://www.everquestlegends.com/news/dbg-eql-announce",
    description: "Official Daybreak/Game Jawn collaboration announcement for EverQuest Legends.",
    searchable: true
  },
  {
    id: "official-producer-letter-april-2026",
    kind: "official",
    title: "Official Producer Letter: April 2026",
    url: "https://www.everquestlegends.com/news/eqlegends-producers-letter-april-2026",
    description: "Official producer letter about beta rollout, invite pacing, and development context.",
    searchable: true
  },
  {
    id: "official-40k-celebration",
    kind: "official",
    title: "Official 40,000 Beta Signup Celebration",
    url: "https://www.everquestlegends.com/news/eqlegends-40k-celebration",
    description: "Official beta signup milestone and livestream announcement.",
    searchable: true
  },
  {
    id: "official-creator-program",
    kind: "official",
    title: "Official Content Creator Program",
    url: "https://www.everquestlegends.com/news/everquest-legends-creator-program",
    description: "Official EverQuest Legends content creator program article.",
    searchable: true
  },
  {
    id: "official-creator-program-application",
    kind: "official",
    title: "Official Creator Legends Application Portal",
    url: EQL_CREATOR_PROGRAM.applicationUrl,
    description: "Official Creator Legends Sideqik application portal linked from the official creator-program article. Pointer-only because it is an application form.",
    searchable: false
  },
  {
    id: "official-youtube",
    kind: "official",
    title: "Official EverQuest Legends YouTube Channel",
    url: "https://www.youtube.com/@EverQuestLegends",
    description: "Official EverQuest Legends video and livestream channel. Use eql_official_youtube_videos or eql_youtube_videos for RSS metadata.",
    searchable: false
  },
  {
    id: "official-youtube-feed",
    kind: "official",
    title: "Official EverQuest Legends YouTube RSS",
    url: OFFICIAL_YOUTUBE_FEED_URL,
    description: "Official YouTube channel RSS feed for video IDs, titles, publish dates, and thumbnails.",
    searchable: false
  },
  {
    id: "creator-youtube-grimthule",
    kind: "community",
    title: "Creator YouTube: Grimthule",
    url: "https://www.youtube.com/@Grimthule",
    description: "Unofficial EQL creator channel with beta streams, beginner tips, UI setup, guides, and short-form updates. Use eql_youtube_videos for RSS metadata.",
    searchable: false
  },
  {
    id: "creator-youtube-higherthoughtgaming",
    kind: "community",
    title: "Creator YouTube: HigherThoughtGaming",
    url: "https://www.youtube.com/@MoProduktions",
    description: "Unofficial EQL creator channel with class impressions, farm routes, beta commentary, livestream-answer recaps, and systems discussion. Use eql_youtube_videos for RSS metadata.",
    searchable: false
  },
  {
    id: "creator-youtube-eqprogression",
    kind: "community",
    title: "Creator YouTube: EQProgression",
    url: "https://www.youtube.com/@eqprogression3040",
    description: "EverQuest-focused unofficial creator channel with EQL beta recaps, leveling impressions, development updates, and preview commentary. Use eql_youtube_videos for RSS metadata.",
    searchable: false
  },
  {
    id: "official-twitch",
    kind: "official",
    title: "Official EverQuest Legends Twitch",
    url: "https://twitch.tv/everquestlegends",
    description: "Official EverQuest Legends Twitch profile. Pointer-only; streams often move to YouTube VODs.",
    searchable: false
  },
  {
    id: "official-discord",
    kind: "official",
    title: "Official EverQuest Legends Discord",
    url: "https://discord.gg/everquestlegends",
    description: "Official EverQuest Legends Discord invite. Pointer-only because Discord content is not public static web content.",
    searchable: false
  },
  {
    id: "official-x",
    kind: "official",
    title: "Official EverQuest Legends X",
    url: "https://x.com/EQ_Legends",
    description: "Official EverQuest Legends X profile.",
    searchable: false
  },
  {
    id: "official-facebook",
    kind: "official",
    title: "Official EverQuest Legends Facebook",
    url: "https://www.facebook.com/everquestlegends",
    description: "Official EverQuest Legends Facebook profile.",
    searchable: false
  },
  {
    id: "official-instagram",
    kind: "official",
    title: "Official EverQuest Legends Instagram",
    url: "https://www.instagram.com/everquestlegends/",
    description: "Official EverQuest Legends Instagram profile.",
    searchable: false
  },
  {
    id: "official-bluesky",
    kind: "official",
    title: "Official EverQuest Legends Bluesky",
    url: "https://bsky.app/profile/everquestlegends.bsky.social",
    description: "Official EverQuest Legends Bluesky profile.",
    searchable: false
  },
  {
    id: "daybreak-help-preorder-beta",
    kind: "support",
    title: "Daybreak Help: Pre-Order and Beta",
    url: "https://help.daybreakgames.com/hc/en-us/articles/52413008844307-EverQuest-Legends-Pre-Order-and-Beta",
    description: "Daybreak support article with official website, preorder FAQ, and social links. Pointer-only because direct fetches may receive Cloudflare challenge HTML.",
    searchable: false
  },
  {
    id: "daybreak-help-beta",
    kind: "support",
    title: "Daybreak Help: EverQuest Legends Beta",
    url: "https://help.daybreakgames.com/hc/en-us/articles/51081724830611-EverQuest-Legends-Beta",
    description: "Earlier Daybreak beta support article. Pointer-only because direct fetches may receive Cloudflare challenge HTML.",
    searchable: false
  },
  {
    id: "daybreak-help-category",
    kind: "support",
    title: "Daybreak Help: EverQuest Legends Category",
    url: "https://help.daybreakgames.com/hc/en-us/categories/50726605840275-EVERQUEST-LEGENDS",
    description: "Official Daybreak support category for EverQuest Legends.",
    searchable: false
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
    id: "official-eq-history-1999",
    authority: "classic-eq",
    kind: "lore",
    title: "Official 1999 EverQuest History of Norrath",
    url: "https://web.archive.org/web/19990910004532/http://everquest.station.sony.com/e_history.html",
    description: "Wayback capture of the original official Sony Online Entertainment EverQuest history/lore page, including Norrath's ages and the Miragul/Erudite necromancy lore.",
    searchable: true
  },
  {
    id: "fvproject-lore-category",
    authority: "classic-eq",
    kind: "lore",
    title: "The Firiona Vie Project: Lore Category",
    url: "https://fvproject.com/index.php/Category:Lore",
    description: "Community MediaWiki category for official EverQuest lore articles preserved by The Firiona Vie Project. Use the FV lore tools for category and page reads.",
    searchable: false
  },
  {
    id: "eqarchives-search",
    authority: "classic-eq",
    kind: "archive",
    title: "EQArchives Search Portal",
    url: EQ_ARCHIVES_SEARCH_URL,
    description: "Hosted full-text search portal over EQ Archives material, including preserved websites, mailing lists, patch notes, logs, screenshots, and related historical EverQuest records. Use eql_eqarchives_search for bounded search results.",
    searchable: false
  },
  {
    id: "eqarchives-repository",
    authority: "classic-eq",
    kind: "archive",
    title: "EQ Archives Repository",
    url: EQ_ARCHIVES_REPOSITORY_URL,
    description: "GitHub repository for the massive EQ Archives corpus. Included as provenance for the archive search portal; prefer eql_eqarchives_search for information retrieval.",
    searchable: false
  },
  {
    id: "eg7-announcement",
    kind: "official",
    title: "EG7 Parent-Company EQL Announcement",
    url: "https://www.enadglobal7.com/mfn_news/daybreak-games-announces-everquest-legends-a-reimagined-solo-friendly-experience-set-in-the-world-of-norrath/",
    description: "Primary corporate announcement from Daybreak parent EG7 for EverQuest Legends.",
    searchable: true
  },
  {
    id: "gamejawn-home",
    kind: "official",
    title: "Game Jawn",
    url: "https://www.gamejawn.com/",
    description: "Official Game Jawn studio site. Pointer-only because the page has low EQL-specific text.",
    searchable: false
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
    id: "daybreak-press-announcement",
    kind: "press",
    title: "Daybreak Press: EQL Announcement",
    url: "https://www.daybreakgames.com/press/eqlegends/article/dbg-eql-announce",
    description: "Official Daybreak press-domain copy of the EverQuest Legends announcement.",
    searchable: true
  },
  {
    id: "daybreak-press-producer-letter",
    kind: "press",
    title: "Daybreak Press: Producer Letter April 2026",
    url: "https://www.daybreakgames.com/press/eqlegends/article/eqlegends-producers-letter-april-2026",
    description: "Official Daybreak press-domain producer letter for EverQuest Legends.",
    searchable: true
  },
  {
    id: "daybreak-press-40k-celebration",
    kind: "press",
    title: "Daybreak Press: 40,000 Beta Signup Celebration",
    url: "https://www.daybreakgames.com/press/eqlegends/article/eqlegends-40k-celebration",
    description: "Official Daybreak press-domain 40,000 beta signup celebration article.",
    searchable: true
  },
  {
    id: "daybreak-press-logos",
    kind: "press",
    title: "Daybreak Press: EQL Logos",
    url: "https://www.daybreakgames.com/press/eqlegends/logos",
    description: "Official Daybreak EQL logo asset listing. Use eql_press_assets for metadata links.",
    searchable: false
  },
  {
    id: "daybreak-press-artwork",
    kind: "press",
    title: "Daybreak Press: EQL Artwork",
    url: "https://www.daybreakgames.com/press/eqlegends/artwork",
    description: "Official Daybreak EQL artwork asset listing. Use eql_press_assets for metadata links.",
    searchable: false
  },
  {
    id: "daybreak-press-fact-sheets",
    kind: "press",
    title: "Daybreak Press: EQL Fact Sheets",
    url: "https://www.daybreakgames.com/press/eqlegends/fact-sheets",
    description: "Official Daybreak EQL fact sheet page with public PDF metadata.",
    searchable: false
  },
  {
    id: "daybreak-press-screenshots",
    kind: "press",
    title: "Daybreak Press: EQL Screenshots",
    url: "https://www.daybreakgames.com/press/eqlegends/screenshots",
    description: "Official Daybreak EQL screenshot page with CDN image URLs.",
    searchable: false
  },
  {
    id: "daybreak-press-video",
    kind: "press",
    title: "Daybreak Press: EQL Video",
    url: "https://www.daybreakgames.com/press/eqlegends/video",
    description: "Official Daybreak EQL press video listing. Use eql_press_assets for metadata links.",
    searchable: false
  },
  {
    id: "eqprogression-legends",
    kind: "guide",
    title: "EQProgression: EverQuest Legends Hub",
    url: "https://www.eqprogression.com/legends/",
    description: "Unofficial EverQuest Legends landing hub with links to EQL-specific guides and tables.",
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
    id: "eqprogression-posky-class-unlocks",
    kind: "guide",
    title: "EQProgression: Plane of Sky Class Unlocks",
    url: "https://www.eqprogression.com/legends/plane-of-sky-quests-class-unlocks/",
    description: "Unofficial EQL-specific guide for Plane of Sky quests and class unlocks.",
    searchable: true
  },
  {
    id: "everquestguides-class-builder",
    kind: "guide",
    title: "EverQuest Guides: EQL Class Combo Builder",
    url: "https://www.everquestguides.com/legends/",
    description: "Unofficial EQL-only 560-combo class builder. Pointer-only because it is an interactive scoring tool.",
    searchable: false
  },
  {
    id: "everquestguides-leveling",
    kind: "guide",
    title: "EverQuest Guides: EQL Leveling Guide",
    url: "https://www.everquestguides.com/everquest-leveling/everquest-legends-leveling-guide-1-50-and-strategy/",
    description: "Unofficial EverQuest Legends leveling route and multiclass leveling strategy guide.",
    searchable: true
  },
  {
    id: "everquestguides-unofficial-faq",
    kind: "guide",
    title: "EverQuest Guides: Unofficial EQL FAQ",
    url: "https://www.everquestguides.com/everquest-articles/eq-legends-faq-unofficial/",
    description: "Unofficial EQL FAQ aggregating official announcements, videos, dev comments, and beta observations. Pointer-only because it includes derived dev-comment material.",
    searchable: false
  },
  {
    id: "everquestguides-multiclass",
    kind: "guide",
    title: "EverQuest Guides: EQL Multiclassing Guide",
    url: "https://www.everquestguides.com/everquest-articles/everquest-legends-multiclassing-guide-top-class-combos-from-the-heroes-journey/",
    description: "Unofficial EQL multiclass article and theorycrafting. Pointer-only because recommendations are author scoring, not official balance data.",
    searchable: false
  },
  {
    id: "eqlfaq",
    kind: "guide",
    title: "Unofficial EQ Legends FAQ",
    url: "https://eqlfaq.com/",
    description: "Unofficial EQL FAQ aggregating Discord FAQ, dev comments, and source links. Pointer-only because it includes Discord-derived material.",
    searchable: false
  },
  {
    id: "rpgsite-gdc-interview",
    kind: "press",
    title: "RPG Site: EQL GDC Interview",
    url: "https://www.rpgsite.net/interview/19942-everquest-legends-interview-development-team-discuss-conception-vision-adjustments-made-for-nostalgic-but-casual-experience",
    description: "Original EQL interview with David Youssefi, Eda Spause, Sean Norton, and Rae Brewer.",
    searchable: true
  },
  {
    id: "rpgsite-launch-news",
    kind: "press",
    title: "RPG Site: EverQuest Legends Launches July 28",
    url: "https://www.rpgsite.net/news/20718-everquest-legends-launches-on-july-28",
    description: "EQL launch/preorder summary and secondary check on launch date, pricing, and preorder beta.",
    searchable: true
  },
  {
    id: "mmorpg-gdc-preview",
    kind: "press",
    title: "MMORPG.com: EQL GDC Preview",
    url: "https://www.mmorpg.com/previews/gdc-2026-everquest-legends-aims-to-recreate-classic-everquest-but-more-approachable-for-new-players-2000137614",
    description: "Original EQL GDC reporting with classic-asset, multiclassing, and development-context details.",
    searchable: true
  },
  {
    id: "mmorpg-beta-preview",
    kind: "press",
    title: "MMORPG.com: EQL Beta Preview",
    url: "https://www.mmorpg.com/previews/everquest-legends-beta-preview-2000138071",
    description: "Hands-on EQL beta preview from a newcomer perspective.",
    searchable: true
  },
  {
    id: "mmorpg-sgf-preview",
    kind: "press",
    title: "MMORPG.com: EQL Summer Game Fest Preview",
    url: "https://www.mmorpg.com/previews/everquest-legends-is-ready-to-party-like-its-1999-summer-game-fest-2026-2000138287",
    description: "Summer Game Fest EQL preview with demo and raid-retuning context.",
    searchable: true
  },
  {
    id: "massivelyop-gdc-preview",
    kind: "press",
    title: "MassivelyOP: EQL GDC Preview",
    url: "https://massivelyop.com/2026/03/24/gdc-2026-everquest-legends-is-a-new-pre-kunark-server-from-daybreak-and-game-jawn/",
    description: "Original MMO-press EQL coverage with GDC context and Game Jawn notes.",
    searchable: true
  },
  {
    id: "massivelyop-faq-summary",
    kind: "press",
    title: "MassivelyOP: EQL FAQ Summary",
    url: "https://massivelyop.com/2026/03/28/everquest-legends-details-monetization-class-switching-races-zones-and-more-in-new-faq/",
    description: "EQL FAQ summary capturing Discord FAQ details that may be hard to crawl directly.",
    searchable: true
  },
  {
    id: "massivelyop-preorder",
    kind: "press",
    title: "MassivelyOP: EQL Preorders Open",
    url: "https://massivelyop.com/2026/06/17/everquest-legends-has-begun-20-preorders-for-its-july-28th-launch-new-trailer-ahoy/",
    description: "EQL preorder and launch summary with embedded official post context.",
    searchable: true
  },
  {
    id: "pcgamer-announcement",
    kind: "press",
    title: "PC Gamer: EQL Announcement",
    url: "https://www.pcgamer.com/games/mmo/everquest-legends-announcement/",
    description: "Major EQL announcement coverage and design framing for time-constrained players.",
    searchable: true
  },
  {
    id: "pcgamer-beta-impressions",
    kind: "press",
    title: "PC Gamer: EQL Beta Impressions",
    url: "https://www.pcgamer.com/games/mmo/i-was-worried-everquest-legends-making-me-too-op-would-ruin-the-magic-of-the-classic-mmo-but-crushing-hordes-of-frogloks-is-incredibly-satisfying/",
    description: "Hands-on EQL beta impressions covering multiclassing, loot, loadouts, and difficulty.",
    searchable: true
  },
  {
    id: "rpgamer-interview",
    kind: "press",
    title: "RPGamer: EverQuest Legends Interview",
    url: "https://rpgamer.com/2026/06/everquest-legends-interview/",
    description: "Summer Game Fest EQL Q&A with Daybreak/Game Jawn developers.",
    searchable: true
  },
  {
    id: "rpgamer-launch",
    kind: "press",
    title: "RPGamer: EverQuest Legends Launching in Late July",
    url: "https://rpgamer.com/2026/06/everquest-legends-launching-in-late-july/",
    description: "EQL launch/preorder summary.",
    searchable: true
  },
  {
    id: "indieinformer-gdc-feature",
    kind: "press",
    title: "The Indie Informer: EQL GDC Feature",
    url: "https://theindieinformer.com/2026/03/24/everquest-legends-travels-back-in-time-thanks-to-emulator-community-memeber-devs/",
    description: "Original EQL GDC feature with Game Jawn and new-player positioning context.",
    searchable: true
  },
  {
    id: "indieinformer-beta-preview",
    kind: "press",
    title: "The Indie Informer: EQL Beta Preview",
    url: "https://theindieinformer.com/2026/05/15/everquest-legends-preview-blast-me-back/",
    description: "Hands-on EQL beta preview from a new/returning-player perspective.",
    searchable: true
  },
  {
    id: "gamespot-announcement",
    kind: "press",
    title: "GameSpot: EQL Announcement",
    url: "https://www.gamespot.com/articles/no-time-or-friends-for-an-mmo-everquest-legends-has-a-solution/1100-6538990/",
    description: "Mainstream EQL announcement coverage and cross-check.",
    searchable: true
  },
  {
    id: "kotaku-announcement",
    kind: "press",
    title: "Kotaku: EQL Announcement",
    url: "https://kotaku.com/everquest-legends-mmo-daybreak-game-company-classic-2000681514",
    description: "Mainstream EQL announcement coverage focused on solo-friendly rebalancing.",
    searchable: true
  },
  {
    id: "gamesradar-announcement",
    kind: "press",
    title: "GamesRadar: EQL Announcement",
    url: "https://www.gamesradar.com/games/mmo/everquest-is-the-next-legacy-mmo-to-get-the-classic-treatment-after-wow-classic-and-old-school-runescape-but-with-a-genius-twist-it-knows-all-of-us-olds-dont-have-time-for-mmos-anymore/",
    description: "Mainstream EQL announcement coverage summarizing the solo/casual classic-EQ pitch.",
    searchable: true
  },
  {
    id: "gematsu-announced",
    kind: "press",
    title: "Gematsu: EQL Announced",
    url: "https://www.gematsu.com/2026/03/everquest-legends-announced-for-pc",
    description: "Concise EQL announcement summary and trailer embed. Pointer-only because it mostly rewrites announcement copy.",
    searchable: false
  },
  {
    id: "gematsu-launch",
    kind: "press",
    title: "Gematsu: EQL Launches July 28",
    url: "https://www.gematsu.com/2026/06/everquest-legends-launches-july-28",
    description: "Concise EQL launch/preorder summary and trailer embed. Pointer-only because it mostly rewrites announcement copy.",
    searchable: false
  },
  {
    id: "eqlbuilds",
    kind: "builds",
    title: "EQL Builds (eqlbuilds.com)",
    url: "https://eqlbuilds.com/",
    description:
      "Unofficial EQL Legends build planner covering race/class combinations, class synergies, progression, spells, skills, alternate advancement, stances, and invocations. Client-rendered SPA with no readable HTML: query its extracted dataset via the eql_builds_* tools instead of fetching the page.",
    searchable: false
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
    id: "reddit-eqlegends-class-builder-thread",
    kind: "community",
    title: "r/EQLegends: Class Builder Thread",
    url: "https://www.reddit.com/r/EQLegends/comments/1t68727/class_builder/",
    description: "Community thread linking EQL class builder and leveling guide. Pointer-only.",
    searchable: false
  },
  {
    id: "reddit-eqlegends-race-unlock-thread",
    kind: "community",
    title: "r/EQLegends: Race Unlock Cheat Sheet Thread",
    url: "https://www.reddit.com/r/EQLegends/comments/1tuxutb/eql_race_unlock_cheat_sheet/",
    description: "Community thread discussing EQL race unlock information and corrections. Pointer-only.",
    searchable: false
  }
] as const;

export function sourceById(id: string): SourcePage | undefined {
  return SOURCE_PAGES.find((source) => source.id === id);
}
