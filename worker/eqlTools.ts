import { tool } from "ai";
import { z } from "zod/v4";
import { generateClassCombinations } from "../src/domain.js";
import { getOfficialArticle, getOfficialNews } from "../src/official.js";
import { fetchSource, searchCuratedSources } from "../src/sourceSearch.js";
import { EQL_CREATOR_PROGRAM, SOURCE_PAGES } from "../src/sources.js";
import { getWikiPage, searchWiki } from "../src/mediawiki.js";
import { detectNonLaunchEra } from "../src/era.js";
import { getYouTubeVideos } from "../src/youtube.js";

export const eqlTools = {
  eql_wiki_search: tool({
    description:
      "Full-text search the EverQuest Legends wiki. Results may include eraAdvisory when snippets reference post-launch expansion content.",
    inputSchema: z.object({
      query: z.string().min(2).describe("MediaWiki search query."),
      limit: z.number().int().min(1).max(20).default(8)
    }),
    execute: async ({ query, limit }) => {
      const results = await searchWiki(query, limit);
      const eraAdvisory = detectNonLaunchEra(results.map((r) => `${r.title}\n${r.snippet}`).join("\n"));
      return { query, results, ...(eraAdvisory.flagged ? { eraAdvisory } : {}) };
    }
  }),

  eql_wiki_page: tool({
    description: "Read a specific EQL Wiki page by title.",
    inputSchema: z.object({
      title: z.string().min(1).describe('Wiki page title, e.g. "Character Classes" or "Nagafen".'),
      maxCharacters: z.number().int().min(500).max(12_000).default(8000)
    }),
    execute: async ({ title, maxCharacters }) => {
      const page = await getWikiPage(title, maxCharacters);
      return { page };
    }
  }),

  eql_source_search: tool({
    description: "Search curated official, guide, and press pages about EverQuest Legends.",
    inputSchema: z.object({
      query: z.string().min(2).max(120),
      limit: z.number().int().min(1).max(15).default(8)
    }),
    execute: async ({ query, limit }) => searchCuratedSources(query, { limit })
  }),

  eql_source_fetch: tool({
    description: "Fetch extracted text from a curated source by id (from eql_sources).",
    inputSchema: z.object({
      id: z.string().describe("Source id such as official-home or eqprogression-faq."),
      maxCharacters: z.number().int().min(500).max(12_000).default(8000)
    }),
    execute: async ({ id, maxCharacters }) => {
      const source = await fetchSource(id, maxCharacters);
      return { source };
    }
  }),

  eql_official_news: tool({
    description: "List recent official EverQuest Legends news articles.",
    inputSchema: z.object({
      limit: z.number().int().min(1).max(20).default(10)
    }),
    execute: async ({ limit }) => {
      const articles = await getOfficialNews(limit);
      return { articles };
    }
  }),

  eql_official_article: tool({
    description: "Read an official EQL news article by slug or URL.",
    inputSchema: z.object({
      pageNameOrUrl: z.string().min(1),
      maxCharacters: z.number().int().min(500).max(12_000).default(8000)
    }),
    execute: async ({ pageNameOrUrl, maxCharacters }) => {
      const article = await getOfficialArticle(pageNameOrUrl, maxCharacters);
      return { article };
    }
  }),

  eql_youtube_videos: tool({
    description: "List recent official and creator YouTube videos about EQL.",
    inputSchema: z.object({
      scope: z.enum(["official", "creators", "all"]).default("all"),
      query: z.string().min(2).max(120).optional(),
      maxTotal: z.number().int().min(1).max(30).default(12)
    }),
    execute: async ({ scope, query, maxTotal }) =>
      getYouTubeVideos({ scope, query, limitPerSource: 5, maxTotal })
  }),

  eql_class_combos: tool({
    description: "Generate three-class combinations from the 16 EQL classes.",
    inputSchema: z.object({
      include: z.array(z.string()).default([]),
      exclude: z.array(z.string()).default([]),
      limit: z.number().int().min(1).max(50).default(20)
    }),
    execute: async ({ include, exclude, limit }) => ({
      combos: generateClassCombinations({ include, exclude, limit }),
      note: "Unordered three-class sets; does not validate race primary-class unlocks."
    })
  }),

  eql_sources: tool({
    description: "List all configured public EQL sources.",
    inputSchema: z.object({}),
    execute: async () => ({ sources: SOURCE_PAGES })
  }),

  eql_creator_program: tool({
    description: "Read official Creator Legends program metadata.",
    inputSchema: z.object({}),
    execute: async () => ({ creatorProgram: EQL_CREATOR_PROGRAM })
  })
};

export type EqlToolName = keyof typeof eqlTools;
