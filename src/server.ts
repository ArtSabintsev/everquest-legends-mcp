import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import * as z from "zod/v4";
import { EQL_CLASSES, EQL_RACES, generateClassCombinations } from "./domain.js";
import { getOfficialArticle, getOfficialNews } from "./official.js";
import { listPressAssets, PRESS_ASSET_KINDS } from "./press.js";
import { fetchSource, searchCuratedSources } from "./sourceSearch.js";
import { SOURCE_PAGES } from "./sources.js";
import { getCategoryPages, getRecentChanges, getWikiPage, searchWiki } from "./mediawiki.js";

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
    version: "0.1.0"
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
          text: JSON.stringify({ sources: SOURCE_PAGES }, null, 2)
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
          text: JSON.stringify({ classes: EQL_CLASSES }, null, 2)
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
          text: JSON.stringify({ races: EQL_RACES }, null, 2)
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
        sources: SOURCE_PAGES
      })
  );

  server.registerTool(
    "eql_source_fetch",
    {
      title: "Fetch a curated EQL source",
      description: "Fetch and extract text from a searchable curated public source by id.",
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
        query: z.string().min(2).describe("Search terms."),
        limit: z.number().int().min(1).max(50).default(10),
        sourceIds: z.array(z.string()).optional().describe("Optional source id filter from eql_sources.")
      }
    },
    async ({ query, limit, sourceIds }) => {
      const results = await searchCuratedSources(query, { limit, sourceIds });
      return toolResult(`Found ${results.length} curated source matches for "${query}".`, {
        query,
        results
      });
    }
  );

  server.registerTool(
    "eql_wiki_search",
    {
      title: "Search EQL Wiki",
      description: "Full-text search the public EverQuest Legends MediaWiki.",
      inputSchema: {
        query: z.string().min(2).describe("MediaWiki search query."),
        limit: z.number().int().min(1).max(50).default(10)
      }
    },
    async ({ query, limit }) => {
      const results = await searchWiki(query, limit);
      return toolResult(`Found ${results.length} wiki matches for "${query}".`, { query, results });
    }
  );

  server.registerTool(
    "eql_wiki_page",
    {
      title: "Read EQL Wiki page",
      description: "Fetch a page from EQL Wiki via MediaWiki API and return extracted text, links, categories, and revision metadata.",
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
      description: "Fetch an official EverQuest Legends news article by page name or full URL.",
      inputSchema: {
        pageNameOrUrl: z.string().min(1).describe("Article page name such as everquest-legends-preorder, /news/..., or full URL."),
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
        include,
        exclude,
        combos
      });
    }
  );

  return server;
}
