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
import { getDefaultLocalScanRoots, inspectVmwareFusion, scanLocalFiles } from "./localData.js";

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
    "eql_local_vmware_inventory",
    {
      title: "Inspect local VMware Fusion EQL environment",
      description:
        "Read sanitized VMware Fusion metadata for local VMs that may contain an EverQuest Legends install. This is host metadata only: it does not mount, repair, or modify VMDK files, and it intentionally omits raw VMX encryption material.",
      inputSchema: {
        roots: z
          .array(z.string())
          .default([])
          .describe("Optional VMware search roots. Empty uses standard Fusion paths such as ~/Virtual Machines.localized."),
        includeLogSignals: z.boolean().default(true).describe("Include keyword counts and short recent matches from VMware log tails."),
        includeDiskExtents: z.boolean().default(false).describe("Include per-extent VMDK file metadata. Off by default because split disks can be noisy."),
        maxLogMatches: z.number().int().min(0).max(100).default(20)
      }
    },
    async ({ roots, includeLogSignals, includeDiskExtents, maxLogMatches }) => {
      const inventory = await inspectVmwareFusion({
        roots: roots.length > 0 ? roots : undefined,
        includeLogSignals,
        includeDiskExtents,
        maxLogMatches
      });
      return toolResult(`Found ${inventory.vms.length} VMware Fusion VM(s).`, { inventory });
    }
  );

  server.registerTool(
    "eql_local_scan_roots",
    {
      title: "List local EQL scan roots",
      description:
        "List host directories that eql_local_file_scan may read. Set EQL_LOCAL_DATA_ROOTS to a path-delimited allowlist to scan exported or mounted EverQuest Legends folders outside the defaults."
    },
    async () =>
      toolResult("Fetched local scan root policy.", {
        allowedRoots: getDefaultLocalScanRoots(),
        environmentVariable: "EQL_LOCAL_DATA_ROOTS",
        note: "The file scanner reads only text-like files and requires an explicit rootPath under an allowed root."
      })
  );

  server.registerTool(
    "eql_local_file_scan",
    {
      title: "Scan local EQL files",
      description:
        "Scan a host-visible EverQuest Legends install, export, or shared folder for text-like metadata files. rootPath must be under an allowed root from eql_local_scan_roots or EQL_LOCAL_DATA_ROOTS.",
      inputSchema: {
        rootPath: z.string().min(1).describe("Host-visible folder to scan, for example ~/Downloads/eql-export or a mounted game directory."),
        query: z
          .string()
          .min(2)
          .max(300)
          .default("EverQuest Legends EQLegends EQL Daybreak Darkpaw LaunchPad eqgame eqclient")
          .describe("Search terms used to select relevant files and snippets."),
        maxFiles: z.number().int().min(1).max(500).default(100),
        maxDepth: z.number().int().min(0).max(20).default(8),
        maxFileBytes: z.number().int().min(1_000).max(500_000).default(80_000)
      }
    },
    async ({ rootPath, query, maxFiles, maxDepth, maxFileBytes }) => {
      const scan = await scanLocalFiles({ rootPath, query, maxFiles, maxDepth, maxFileBytes });
      return toolResult(`Found ${scan.matches.length} local file match(es) under ${scan.rootPath}.`, { scan });
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
