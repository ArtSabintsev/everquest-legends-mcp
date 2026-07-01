import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import * as z from "zod/v4";
import { EQL_CLASSES, EQL_CLASS_SOURCE, EQL_RACES, EQL_RACE_SOURCE, generateClassCombinations } from "./domain.js";
import { getOfficialArticle, getOfficialNews } from "./official.js";
import { listPressAssets, PRESS_ASSET_KINDS } from "./press.js";
import { fetchSource, searchCuratedSources } from "./sourceSearch.js";
import { EQL_CREATOR_PROGRAM, EQL_YOUTUBE_SOURCES, SOURCE_PAGES, SOURCE_SCOPE } from "./sources.js";
import { getCategoryPages, getRecentChanges, getWikiPage, searchWiki } from "./mediawiki.js";
import { detectNonLaunchEra } from "./era.js";
import { getOfficialYouTubeVideos, getYouTubeVideos, listYouTubeSources } from "./youtube.js";
import { getVideoTranscript } from "./transcript.js";
import { getEqArchiveDocument, getFvLorePage, getFvLorePages, searchEqArchives, searchFvLore } from "./archive.js";
import {
  getEqlBuildsAbility,
  getEqlBuildsClass,
  getEqlBuildsProvenance,
  getEqlBuildsRace,
  getEqlBuildsSpell,
  listEqlBuildsAbilities,
  listEqlBuildsClasses,
  listEqlBuildsModes,
  listEqlBuildsRaces,
  listEqlBuildsSkills,
  searchEqlBuildsAbilities,
  searchEqlBuildsSpells
} from "./eqlbuilds.js";

function toolResult(summary: string, structuredContent: Record<string, unknown>): CallToolResult {
  return {
    content: [
      {
        type: "text",
        text: `${summary}\n\n${JSON.stringify(structuredContent, null, 2)}`
      }
    ],
    structuredContent
  };
}

export function createServer(): McpServer {
  const server = new McpServer({
    name: "everquest-legends-mcp",
    version: "1.1.0"
  });

  server.registerResource(
    "sources",
    "eql://sources",
    {
      title: "EverQuest Legends source registry",
      description: "Curated public source registry used by this MCP server.",
      mimeType: "application/json"
    },
    (uri) => ({
      contents: [
        {
          uri: uri.href,
          mimeType: "application/json",
          text: JSON.stringify({ scope: SOURCE_SCOPE, sources: SOURCE_PAGES }, null, 2)
        }
      ]
    })
  );

  server.registerResource(
    "classes",
    "eql://classes",
    {
      title: "EverQuest Legends class metadata",
      description: "Static EQL class list confirmed against the public wiki.",
      mimeType: "application/json"
    },
    (uri) => ({
      contents: [
        {
          uri: uri.href,
          mimeType: "application/json",
          text: JSON.stringify({ source: EQL_CLASS_SOURCE, classes: EQL_CLASSES }, null, 2)
        }
      ]
    })
  );

  server.registerResource(
    "races",
    "eql://races",
    {
      title: "EverQuest Legends launch race list",
      description: "Static race list from public EQL sources.",
      mimeType: "application/json"
    },
    (uri) => ({
      contents: [
        {
          uri: uri.href,
          mimeType: "application/json",
          text: JSON.stringify({ source: EQL_RACE_SOURCE, races: EQL_RACES }, null, 2)
        }
      ]
    })
  );

  server.registerResource(
    "youtube-sources",
    "eql://youtube-sources",
    {
      title: "EverQuest Legends YouTube source registry",
      description: "Official and selected creator YouTube channel feeds used by this MCP server.",
      mimeType: "application/json"
    },
    (uri) => ({
      contents: [
        {
          uri: uri.href,
          mimeType: "application/json",
          text: JSON.stringify({ sources: EQL_YOUTUBE_SOURCES }, null, 2)
        }
      ]
    })
  );

  server.registerResource(
    "creator-program",
    "eql://creator-program",
    {
      title: "EverQuest Legends creator program metadata",
      description: "Structured summary of the official EQL Creator Legends program article.",
      mimeType: "application/json"
    },
    (uri) => ({
      contents: [
        {
          uri: uri.href,
          mimeType: "application/json",
          text: JSON.stringify(EQL_CREATOR_PROGRAM, null, 2)
        }
      ]
    })
  );

  server.registerTool(
    "eql_sources",
    {
      title: "List EQL sources",
      description: "List curated EverQuest Legends public sources known to this server."
    },
    async () =>
      toolResult(`Found ${SOURCE_PAGES.length} configured sources.`, {
        scope: SOURCE_SCOPE,
        sources: SOURCE_PAGES
      })
  );

  server.registerTool(
    "eql_source_fetch",
    {
      title: "Fetch a curated EQL source",
      description:
        "Fetch and extract text from a searchable curated public source by id. When the text references content from a later expansion (Kunark, Velious, Luclin) that is not in EQL's pre-Kunark launch, the result includes an eraAdvisory.",
      inputSchema: {
        id: z.string().describe("Source id from eql_sources, for example official-home or eqprogression-faq."),
        maxCharacters: z.number().int().min(500).max(40_000).default(12_000).describe("Maximum extracted text length.")
      }
    },
    async ({ id, maxCharacters }) => {
      const source = await fetchSource(id, maxCharacters);
      return toolResult(`Fetched ${source.title}.`, { source });
    }
  );

  server.registerTool(
    "eql_source_search",
    {
      title: "Search curated EQL sources",
      description: "Search across curated official, support, and guide pages. Use wiki-specific tools for full wiki search.",
      inputSchema: {
        query: z.string().min(2).max(120).describe("Search terms."),
        limit: z.number().int().min(1).max(50).default(10),
        sourceIds: z.array(z.string()).optional().describe("Optional source id filter from eql_sources.")
      }
    },
    async ({ query, limit, sourceIds }) => {
      const search = await searchCuratedSources(query, { limit, sourceIds });
      const failureNote = search.failedSources.length > 0 ? ` ${search.failedSources.length} source(s) failed and are listed in failedSources.` : "";
      return toolResult(`Found ${search.results.length} curated source matches for "${search.query}".${failureNote}`, search);
    }
  );

  server.registerTool(
    "eql_wiki_search",
    {
      title: "Search EQL Wiki",
      description:
        "Full-text search the public EverQuest Legends MediaWiki. The wiki inherits classic EverQuest data; when result snippets reference later-expansion content (Kunark, Velious, Luclin) not in EQL's pre-Kunark launch, the response includes an eraAdvisory.",
      inputSchema: {
        query: z.string().min(2).describe("MediaWiki search query."),
        limit: z.number().int().min(1).max(50).default(10)
      }
    },
    async ({ query, limit }) => {
      const results = await searchWiki(query, limit);
      const eraAdvisory = detectNonLaunchEra(results.map((result) => `${result.title}\n${result.snippet}`).join("\n"));
      return toolResult(`Found ${results.length} wiki matches for "${query}".`, {
        query,
        results,
        ...(eraAdvisory.flagged ? { eraAdvisory } : {})
      });
    }
  );

  server.registerTool(
    "eql_wiki_page",
    {
      title: "Read EQL Wiki page",
      description:
        "Fetch a page from EQL Wiki via MediaWiki API and return extracted text, links, categories, and revision metadata. Pages inherit classic EverQuest data; when the text references later-expansion content (Kunark, Velious, Luclin) not in EQL's pre-Kunark launch, the page includes an eraAdvisory.",
      inputSchema: {
        title: z.string().min(1).describe("Wiki page title, for example Character Classes, Nagafen, or Build Guides."),
        maxCharacters: z.number().int().min(500).max(40_000).default(12_000).describe("Maximum extracted body length.")
      }
    },
    async ({ title, maxCharacters }) => {
      const page = await getWikiPage(title, maxCharacters);
      return toolResult(`Fetched wiki page ${page.title}.`, { page });
    }
  );

  server.registerTool(
    "eql_wiki_recent_changes",
    {
      title: "Read EQL Wiki recent changes",
      description: "Return recent public edits from the EverQuest Legends Wiki.",
      inputSchema: {
        limit: z.number().int().min(1).max(50).default(10)
      }
    },
    async ({ limit }) => {
      const changes = await getRecentChanges(limit);
      return toolResult(`Fetched ${changes.length} recent wiki changes.`, { changes });
    }
  );

  server.registerTool(
    "eql_wiki_category_pages",
    {
      title: "List EQL Wiki category pages",
      description: "List pages in a MediaWiki category, for example Zones, NPCs, Equipment, or Bard Build.",
      inputSchema: {
        category: z.string().min(1).describe("Category name with or without Category: prefix."),
        limit: z.number().int().min(1).max(500).default(50)
      }
    },
    async ({ category, limit }) => {
      const pages = await getCategoryPages(category, limit);
      return toolResult(`Fetched ${pages.length} pages from category ${category}.`, { category, pages });
    }
  );

  server.registerTool(
    "eql_fv_lore_category_pages",
    {
      title: "List FVProject lore pages",
      description:
        "List pages in The Firiona Vie Project's public Category:Lore. This is classic EverQuest lore context, not EverQuest Legends launch-source authority.",
      inputSchema: {
        limit: z.number().int().min(1).max(500).default(50)
      }
    },
    async ({ limit }) => {
      const pages = await getFvLorePages(limit);
      return toolResult(`Fetched ${pages.length} FVProject lore page(s).`, { pages });
    }
  );

  server.registerTool(
    "eql_fv_lore_search",
    {
      title: "Search FVProject lore titles",
      description:
        "Search The Firiona Vie Project's Category:Lore page titles. Use eql_fv_lore_page to read a result. This is classic EQ lore context, not EQL launch-source authority.",
      inputSchema: {
        query: z.string().min(2).max(120).describe("Lore title terms, for example Grozmok, Innoruuk, or Combine."),
        limit: z.number().int().min(1).max(50).default(10)
      }
    },
    async ({ query, limit }) => {
      const results = await searchFvLore(query, limit);
      return toolResult(`Found ${results.length} FVProject lore title match(es) for "${query}".`, { query, results });
    }
  );

  server.registerTool(
    "eql_fv_lore_page",
    {
      title: "Read FVProject lore page",
      description:
        "Fetch and extract a public lore page from The Firiona Vie Project MediaWiki. Pages are classic EverQuest lore context and may reference post-launch EQL eras.",
      inputSchema: {
        title: z.string().min(1).describe("FVProject page title, for example 1- Prophecy of Grozmok or Innoruuk (Lore)."),
        maxCharacters: z.number().int().min(500).max(40_000).default(12_000)
      }
    },
    async ({ title, maxCharacters }) => {
      const page = await getFvLorePage(title, maxCharacters);
      return toolResult(`Fetched FVProject lore page ${page.title}.`, { page });
    }
  );

  server.registerTool(
    "eql_eqarchives_search",
    {
      title: "Search EQArchives",
      description:
        "Search the hosted EQArchives index of preserved EverQuest websites, mailing lists, patch records, logs, and other historical material. Results are historical context, not EQL launch-source authority.",
      inputSchema: {
        query: z.string().min(2).max(200).describe("Archive search terms matched against indexed title, URL, description, content, and metadata fields."),
        limit: z.number().int().min(1).max(25).default(10)
      }
    },
    async ({ query, limit }) => {
      const search = await searchEqArchives(query, { limit });
      return toolResult(`Found ${search.results.length} EQArchives hit(s) for "${search.query}".`, search);
    }
  );

  server.registerTool(
    "eql_eqarchives_document",
    {
      title: "Read EQArchives document",
      description:
        "Fetch one EQArchives indexed document by id returned from eql_eqarchives_search. Text is truncated and may represent historical, player-created, or archived web material.",
      inputSchema: {
        id: z.string().min(1).describe("Document id returned by eql_eqarchives_search."),
        maxCharacters: z.number().int().min(500).max(40_000).default(12_000)
      }
    },
    async ({ id, maxCharacters }) => {
      const document = await getEqArchiveDocument(id, maxCharacters);
      return toolResult(`Fetched EQArchives document ${document.title}.`, { document });
    }
  );

  server.registerTool(
    "eql_official_news",
    {
      title: "List official EQL news",
      description: "Parse the official EverQuest Legends news index.",
      inputSchema: {
        limit: z.number().int().min(1).max(50).default(10)
      }
    },
    async ({ limit }) => {
      const articles = await getOfficialNews(limit);
      return toolResult(`Fetched ${articles.length} official news articles.`, { articles });
    }
  );

  server.registerTool(
    "eql_official_article",
    {
      title: "Read official EQL article",
      description: "Fetch an official EverQuest Legends news article by page name or official /news/ URL.",
      inputSchema: {
        pageNameOrUrl: z.string().min(1).describe("Article page name such as everquest-legends-preorder, /news/..., or https://www.everquestlegends.com/news/... URL."),
        maxCharacters: z.number().int().min(500).max(40_000).default(12_000)
      }
    },
    async ({ pageNameOrUrl, maxCharacters }) => {
      const article = await getOfficialArticle(pageNameOrUrl, maxCharacters);
      return toolResult(`Fetched official article ${article.title}.`, { article });
    }
  );

  server.registerTool(
    "eql_press_assets",
    {
      title: "List official EQL press assets",
      description: "List official Daybreak press asset URLs for EQL. This returns metadata and links only; it does not download binary assets.",
      inputSchema: {
        kind: z.enum(PRESS_ASSET_KINDS).describe("Press asset kind to list.")
      }
    },
    async ({ kind }) => {
      const assets = await listPressAssets(kind);
      return toolResult(`Fetched ${assets.length} ${kind} press assets.`, { kind, assets });
    }
  );

  server.registerTool(
    "eql_builds_races",
    {
      title: "List EQL Builds races",
      description:
        "List playable races from the eqlbuilds.com build planner with their starting ability and a short description. Set includeInactive to also list races present in client data but disabled (e.g. Drakkin).",
      inputSchema: {
        includeInactive: z.boolean().default(false).describe("Include races that exist in client data but are inactive/visibility-gated.")
      }
    },
    async ({ includeInactive }) => {
      const data = listEqlBuildsRaces(includeInactive);
      return toolResult(`Listed ${data.races.length} active EQL Builds race(s).`, data);
    }
  );

  server.registerTool(
    "eql_builds_race",
    {
      title: "Read EQL Builds race",
      description: "Fetch one race from the eqlbuilds.com dataset by id (e.g. human, highElf, iksar), including full description, starting ability, and racial traits.",
      inputSchema: {
        id: z.string().min(2).describe("Race id such as human, barbarian, woodElf, darkElf, iksar, froglok, or drakkin.")
      }
    },
    async ({ id }) => {
      const race = getEqlBuildsRace(id);
      if (!race) {
        return toolResult(`No EQL Builds race found for "${id}".`, { id, race: null });
      }
      return toolResult(`Fetched EQL Builds race ${race.name}.`, { race });
    }
  );

  server.registerTool(
    "eql_builds_classes",
    {
      title: "List EQL Builds classes",
      description: "List all 16 classes from the eqlbuilds.com build planner with armor types and spell/skill/alternate-advancement counts.",
      inputSchema: {}
    },
    async () => {
      const data = listEqlBuildsClasses();
      return toolResult(`Listed ${data.classes.length} EQL Builds class(es).`, data);
    }
  );

  server.registerTool(
    "eql_builds_class",
    {
      title: "Read EQL Builds class",
      description:
        "Fetch one class from the eqlbuilds.com dataset by id (e.g. warrior, shadowKnight, enchanter). Returns armor, description, and counts by default; spell, skill, and alternate-advancement lists are opt-in because they are large.",
      inputSchema: {
        id: z.string().min(3).describe("Class id such as warrior, cleric, paladin, ranger, shadowKnight, druid, monk, bard, rogue, shaman, necromancer, wizard, magician, enchanter, beastlord, or berserker."),
        includeSpells: z.boolean().default(false).describe("Include the full spell list (can be 200+ entries for casters)."),
        includeSkills: z.boolean().default(false).describe("Include the full skill list with caps and trained-at levels."),
        includeAbilities: z.boolean().default(false).describe("Include the full alternate-advancement list.")
      }
    },
    async ({ id, includeSpells, includeSkills, includeAbilities }) => {
      const cls = getEqlBuildsClass(id, { includeSpells, includeSkills, includeAbilities });
      if (!cls) {
        return toolResult(`No EQL Builds class found for "${id}".`, { id, class: null });
      }
      return toolResult(`Fetched EQL Builds class ${cls.name}.`, { class: cls });
    }
  );

  server.registerTool(
    "eql_builds_spell_search",
    {
      title: "Search EQL Builds spells",
      description: "Search spells across the eqlbuilds.com dataset by name, description, or skill. Optionally restrict to a single class. Each result lists which classes can use the spell.",
      inputSchema: {
        query: z.string().min(2).max(120).describe("Spell search terms matched against name, resolved description, and skill line."),
        classId: z.string().optional().describe("Optional class id to restrict the search to that class's spell list."),
        limit: z.number().int().min(1).max(50).default(15)
      }
    },
    async ({ query, classId, limit }) => {
      const data = searchEqlBuildsSpells(query, { classId, limit });
      return toolResult(`Found ${data.results.length} EQL Builds spell(s) for "${query}".`, data);
    }
  );

  server.registerTool(
    "eql_builds_spell",
    {
      title: "Read one EQL Builds spell",
      description:
        "Fetch a single spell from the eqlbuilds.com dataset by numeric id or exact name, including effects, mana/cast/recast, and a usableBy list of every class that learns it with that class's own level (the same spell is often learned at different levels by different classes).",
      inputSchema: {
        idOrName: z
          .string()
          .min(1)
          .describe("Spell numeric id (e.g. 202) or exact spell name (e.g. Cure Poison).")
      }
    },
    async ({ idOrName }) => {
      const numeric = Number(idOrName.trim());
      const spell = getEqlBuildsSpell(Number.isInteger(numeric) && idOrName.trim() !== "" ? numeric : idOrName);
      if (!spell) {
        return toolResult(`No EQL Builds spell found for "${idOrName}".`, { idOrName, spell: null });
      }
      return toolResult(
        `Fetched EQL Builds spell ${spell.name} (usable by ${spell.usableBy.length} class(es)).`,
        { spell }
      );
    }
  );

  server.registerTool(
    "eql_builds_abilities",
    {
      title: "List EQL Builds alternate advancement",
      description:
        "Enumerate the alternate-advancement (AA) catalog from the eqlbuilds.com dataset without a search query. Returns a compact list (id, name, category, group, max rank, cost, activation). Filter by category (general, archetype, class, special), group, class, or activated-only. Use eql_builds_ability for full per-rank detail.",
      inputSchema: {
        category: z.string().optional().describe("Category filter: general, archetype, class, or special."),
        group: z.string().optional().describe("Group filter, e.g. General, Base Caster, Warrior, or Tank Archetype."),
        classId: z.string().optional().describe("Class id to restrict to AAs available to that class."),
        activatedOnly: z.boolean().default(false).describe("Only include activated (clickable) abilities.")
      }
    },
    async ({ category, group, classId, activatedOnly }) => {
      const data = listEqlBuildsAbilities({ category, group, classId, activatedOnly });
      return toolResult(`Listed ${data.count} EQL Builds AA(s) across ${data.categories.length} categories.`, data);
    }
  );

  server.registerTool(
    "eql_builds_ability",
    {
      title: "Read one EQL Builds alternate advancement",
      description:
        "Fetch a single alternate-advancement (AA) ability from the eqlbuilds.com dataset by id or exact name, including full per-rank costs, rank spells, requirements, and eligible classes.",
      inputSchema: {
        id: z.string().min(2).describe("Ability id (e.g. general-foraging) or exact name (e.g. Foraging).")
      }
    },
    async ({ id }) => {
      const ability = getEqlBuildsAbility(id);
      if (!ability) {
        return toolResult(`No EQL Builds AA found for "${id}".`, { id, ability: null });
      }
      return toolResult(`Fetched EQL Builds AA ${ability.name}.`, { ability });
    }
  );

  server.registerTool(
    "eql_builds_ability_search",
    {
      title: "Search EQL Builds alternate advancement",
      description:
        "Search alternate advancement (AA) abilities across the eqlbuilds.com dataset by name, description, or group, with rank costs and eligible classes. Optionally filter by class or category. AA costs derive from a vendored EQL Wiki snapshot and may be partial.",
      inputSchema: {
        query: z.string().min(2).max(120).describe("AA search terms matched against name, description, and group."),
        classId: z.string().optional().describe("Optional class id to restrict to AAs available to that class."),
        category: z.string().optional().describe("Optional AA category filter (e.g. general, archetype, class)."),
        limit: z.number().int().min(1).max(50).default(15)
      }
    },
    async ({ query, classId, category, limit }) => {
      const data = searchEqlBuildsAbilities(query, { classId, category, limit });
      return toolResult(`Found ${data.results.length} EQL Builds AA(s) for "${query}".`, data);
    }
  );

  server.registerTool(
    "eql_builds_skills",
    {
      title: "List EQL Builds class skills",
      description: "List the skill lines for one class from the eqlbuilds.com dataset, including caps and trained-at levels.",
      inputSchema: {
        classId: z.string().min(3).describe("Class id such as warrior, monk, rogue, or wizard.")
      }
    },
    async ({ classId }) => {
      const data = listEqlBuildsSkills(classId);
      if (!data) {
        return toolResult(`No EQL Builds class found for "${classId}".`, { classId, skills: null });
      }
      return toolResult(`Listed ${data.skills.length} skill(s) for ${data.name}.`, data);
    }
  );

  server.registerTool(
    "eql_builds_modes",
    {
      title: "List EQL Builds stances and invocations",
      description: "List the switchable combat stances and invocations (modes) from the eqlbuilds.com dataset, with their in-game messages and descriptions.",
      inputSchema: {}
    },
    async () => {
      const data = listEqlBuildsModes();
      return toolResult(`Listed ${data.stances.length} stance(s) and ${data.invocations.length} invocation(s).`, data);
    }
  );

  server.registerTool(
    "eql_builds_provenance",
    {
      title: "EQL Builds data provenance",
      description: "Report when and how the eqlbuilds.com dataset was extracted: snapshot manifest (extraction time, bundle hash, counts), the underlying EQL Wiki AA revision, and the extractor's own notes on data sources.",
      inputSchema: {}
    },
    async () => {
      const data = getEqlBuildsProvenance();
      return toolResult(`EQL Builds snapshot extracted ${data.manifest.extractedAt} (wiki rev ${data.manifest.wikiRevisionId}).`, data);
    }
  );

  server.registerTool(
    "eql_official_youtube_videos",
    {
      title: "List official EQL YouTube videos",
      description: "Read the official EverQuest Legends YouTube RSS feed and return video metadata. This does not download video or transcripts.",
      inputSchema: {
        limit: z.number().int().min(1).max(50).default(20)
      }
    },
    async ({ limit }) => {
      const videos = await getOfficialYouTubeVideos(limit);
      return toolResult(`Fetched ${videos.length} official YouTube videos.`, { videos });
    }
  );

  server.registerTool(
    "eql_youtube_sources",
    {
      title: "List EQL YouTube sources",
      description:
        "List official and selected creator/community YouTube channel feeds. Creator channels are unofficial and should not be treated as Daybreak/Game Jawn source-of-truth statements.",
      inputSchema: {
        scope: z.enum(["official", "creators", "all"]).default("all")
      }
    },
    async ({ scope }) => {
      const sources = listYouTubeSources(scope);
      return toolResult(`Found ${sources.length} YouTube source(s).`, {
        scope,
        sources,
        note: "Creator-channel videos are useful for coverage, guides, and commentary, but official facts should be verified against official EQL sources."
      });
    }
  );

  server.registerTool(
    "eql_youtube_videos",
    {
      title: "List EQL YouTube videos",
      description:
        "Read official and selected creator YouTube RSS feeds and return recent video metadata with source attribution. This does not download video or transcripts.",
      inputSchema: {
        scope: z.enum(["official", "creators", "all"]).default("all"),
        sourceIds: z.array(z.string()).default([]).describe("Optional source ids from eql_youtube_sources. Empty uses scope."),
        query: z.string().min(2).max(120).optional().describe("Optional title/author filter, for example beta, creator, class, or EverQuest Legends."),
        limitPerSource: z.number().int().min(1).max(50).default(10),
        maxTotal: z.number().int().min(1).max(200).default(50)
      }
    },
    async ({ scope, sourceIds, query, limitPerSource, maxTotal }) => {
      const search = await getYouTubeVideos({
        scope,
        sourceIds: sourceIds.length > 0 ? sourceIds : undefined,
        query,
        limitPerSource,
        maxTotal
      });
      const failureNote = search.failedSources.length > 0 ? ` ${search.failedSources.length} source(s) failed and are listed in failedSources.` : "";
      return toolResult(`Fetched ${search.videos.length} YouTube video(s).${failureNote}`, search);
    }
  );

  server.registerTool(
    "eql_creator_program",
    {
      title: "Read EQL creator program metadata",
      description:
        "Return structured metadata for the official EverQuest Legends Creator Legends program, including application URL, requirements, eligible content categories, review timing, and ongoing expectations."
    },
    async () => toolResult("Fetched official Creator Legends program metadata.", { creatorProgram: EQL_CREATOR_PROGRAM })
  );

  server.registerTool(
    "eql_video_transcript",
    {
      title: "Fetch a video transcript (captions)",
      description:
        "Fetch an existing transcript for a video from its published captions. Supports YouTube video ids and URLs (watch, youtu.be, shorts, embed, live). Twitch is not supported because Twitch VODs do not expose retrievable captions. This reads existing captions only; it does not transcribe audio. Pulling YouTube captions requires the yt-dlp helper; if it is not installed, call again with installYtDlp set to true to download it.",
      inputSchema: {
        urlOrId: z.string().min(1).describe("YouTube video id or URL, for example DsswWPXweW8 or https://www.youtube.com/watch?v=DsswWPXweW8."),
        language: z.string().min(2).max(10).default("en").describe("Preferred caption language code, for example en or en-US."),
        maxCharacters: z.number().int().min(500).max(200_000).default(100_000).describe("Maximum transcript text length."),
        installYtDlp: z
          .boolean()
          .default(false)
          .describe("Authorize a one-time download of the yt-dlp helper (~36 MB, checksum-verified) if it is not already installed. Required to pull YouTube captions when yt-dlp is absent.")
      }
    },
    async ({ urlOrId, language, maxCharacters, installYtDlp }) => {
      const transcript = await getVideoTranscript(urlOrId, { language, maxCharacters, allowDownload: installYtDlp });
      const summary = transcript.available
        ? `Fetched ${transcript.kind} ${transcript.language} transcript (${transcript.segmentCount} segments).`
        : `No transcript available: ${transcript.reason}`;
      return toolResult(summary, { transcript });
    }
  );

  server.registerTool(
    "eql_class_combos",
    {
      title: "Generate EQL class combinations",
      description: "Generate three-class EQL combinations from the 16 public wiki classes. This is a planning helper, not a race/primary-class validator.",
      inputSchema: {
        include: z.array(z.string()).default([]).describe("Classes or abbreviations that must be present, for example WAR or Cleric."),
        exclude: z.array(z.string()).default([]).describe("Classes or abbreviations to exclude."),
        limit: z.number().int().min(1).max(560).default(50)
      }
    },
    async ({ include, exclude, limit }) => {
      const combos = generateClassCombinations({ include, exclude, limit });
      return toolResult(`Generated ${combos.length} class combinations.`, {
        computedTotalUnfilteredCombinations: 560,
        note: "This enumerates unordered three-class sets from 16 classes. It does not validate race-specific primary-class unlocks.",
        source: EQL_CLASS_SOURCE,
        include,
        exclude,
        combos
      });
    }
  );

  return server;
}
