import { Loader2, Wrench } from "lucide-react";
import { Card, CardContent, CardHeader } from "../ui/card";
import { Badge } from "../ui/card";
import { cn } from "../../lib/utils";

type ToolInvocationProps = {
  toolName: string;
  state: string;
  result?: unknown;
  errorText?: string;
};

const TOOL_LABELS: Record<string, string> = {
  eql_wiki_search: "Wiki search",
  eql_wiki_page: "Wiki page",
  eql_source_search: "Source search",
  eql_source_fetch: "Source fetch",
  eql_official_news: "Official news",
  eql_official_article: "Official article",
  eql_youtube_videos: "YouTube videos",
  eql_class_combos: "Class combos",
  eql_sources: "Sources",
  eql_creator_program: "Creator program"
};

export function ToolInvocation({ toolName, state, result, errorText }: ToolInvocationProps) {
  const label = TOOL_LABELS[toolName] ?? toolName;
  const running = state === "input-streaming" || state === "input-available" || state === "call";

  return (
    <Card className="w-full max-w-[92%] overflow-hidden">
      <CardHeader className="flex flex-row items-center gap-2 py-2">
        {running ? <Loader2 className="h-3.5 w-3.5 animate-spin text-eql-gold" /> : <Wrench className="h-3.5 w-3.5 text-eql-gold" />}
        <span className="text-xs font-semibold text-eql-gold">{label}</span>
        <Badge className="ml-auto">{state}</Badge>
      </CardHeader>
      {(result !== undefined || errorText) && (
        <CardContent className="pt-0">
          {errorText ? (
            <p className="text-sm text-red-400">{errorText}</p>
          ) : (
            <GenerativeToolResult toolName={toolName} result={result} />
          )}
        </CardContent>
      )}
    </Card>
  );
}

function GenerativeToolResult({ toolName, result }: { toolName: string; result: unknown }) {
  const data = result as Record<string, unknown>;

  switch (toolName) {
    case "eql_wiki_search":
      return <WikiSearchResult data={data} />;
    case "eql_wiki_page":
      return <WikiPageResult data={data} />;
    case "eql_source_search":
      return <SourceSearchResult data={data} />;
    case "eql_official_news":
      return <NewsResult data={data} />;
    case "eql_youtube_videos":
      return <YouTubeResult data={data} />;
    case "eql_class_combos":
      return <ClassCombosResult data={data} />;
    case "eql_creator_program":
      return <CreatorProgramResult data={data} />;
    default:
      return <JsonPreview data={result} />;
  }
}

function EraAdvisory({ advisory }: { advisory?: { flagged?: boolean; summary?: string } }) {
  if (!advisory?.flagged) return null;
  return (
    <div className="mb-3 rounded-lg border border-amber-700/50 bg-amber-950/40 px-3 py-2 text-xs text-amber-200">
      <strong>Era advisory:</strong> {advisory.summary ?? "Content may reference post-launch expansions not in EQL."}
    </div>
  );
}

function WikiSearchResult({ data }: { data: Record<string, unknown> }) {
  const results = (data.results as Array<{ title: string; snippet: string; url?: string }>) ?? [];
  return (
    <div className="space-y-3">
      <EraAdvisory advisory={data.eraAdvisory as { flagged?: boolean; summary?: string }} />
      <p className="text-xs text-eql-muted">{results.length} wiki matches for “{String(data.query)}”</p>
      <ul className="space-y-2">
        {results.slice(0, 6).map((item) => (
          <li key={item.title} className="rounded-lg border border-eql-border/60 bg-eql-bg/50 p-3">
            <a
              href={item.url ?? `https://eqlwiki.com/${encodeURIComponent(item.title.replace(/ /g, "_"))}`}
              target="_blank"
              rel="noreferrer"
              className="font-semibold text-eql-gold hover:underline"
            >
              {item.title}
            </a>
            <p className="mt-1 text-xs text-eql-muted line-clamp-3">{stripHtml(item.snippet)}</p>
          </li>
        ))}
      </ul>
    </div>
  );
}

function WikiPageResult({ data }: { data: Record<string, unknown> }) {
  const page = data.page as {
    title?: string;
    url?: string;
    excerpt?: string;
    eraAdvisory?: { flagged?: boolean; summary?: string };
    categories?: string[];
  };
  if (!page) return <JsonPreview data={data} />;
  return (
    <div className="space-y-2">
      <EraAdvisory advisory={page.eraAdvisory} />
      <a href={page.url} target="_blank" rel="noreferrer" className="font-semibold text-eql-gold hover:underline">
        {page.title}
      </a>
      {page.categories?.length ? (
        <div className="flex flex-wrap gap-1">
          {page.categories.slice(0, 5).map((cat) => (
            <Badge key={cat}>{cat.replace(/^Category:/, "")}</Badge>
          ))}
        </div>
      ) : null}
      <p className="text-xs text-eql-muted line-clamp-6">{page.excerpt}</p>
    </div>
  );
}

function SourceSearchResult({ data }: { data: Record<string, unknown> }) {
  const results = (data.results as Array<{ title: string; url: string; snippet: string; sourceId: string }>) ?? [];
  return (
    <ul className="space-y-2">
      {results.slice(0, 5).map((item) => (
        <li key={item.url} className="rounded-lg border border-eql-border/60 bg-eql-bg/50 p-3">
          <div className="mb-1 flex items-center gap-2">
            <Badge>{item.sourceId}</Badge>
            <a href={item.url} target="_blank" rel="noreferrer" className="font-semibold text-eql-gold hover:underline">
              {item.title}
            </a>
          </div>
          <p className="text-xs text-eql-muted line-clamp-2">{item.snippet}</p>
        </li>
      ))}
    </ul>
  );
}

function NewsResult({ data }: { data: Record<string, unknown> }) {
  const articles = (data.articles as Array<{ title: string; url: string; date?: string }>) ?? [];
  return (
    <ul className="space-y-2">
      {articles.map((article) => (
        <li key={article.url} className="flex items-start justify-between gap-3 rounded-lg border border-eql-border/60 bg-eql-bg/50 p-3">
          <a href={article.url} target="_blank" rel="noreferrer" className="font-semibold text-eql-gold hover:underline">
            {article.title}
          </a>
          {article.date ? <span className="shrink-0 text-[11px] text-eql-muted">{article.date}</span> : null}
        </li>
      ))}
    </ul>
  );
}

function YouTubeResult({ data }: { data: Record<string, unknown> }) {
  const videos = (data.videos as Array<{ title: string; url: string; sourceName?: string; publishedAt?: string }>) ?? [];
  return (
    <ul className="grid gap-2 sm:grid-cols-2">
      {videos.slice(0, 6).map((video) => (
        <li key={video.url} className="rounded-lg border border-eql-border/60 bg-eql-bg/50 p-3">
          <Badge className="mb-2">{video.sourceName ?? "YouTube"}</Badge>
          <a href={video.url} target="_blank" rel="noreferrer" className="block text-sm font-semibold text-eql-gold hover:underline">
            {video.title}
          </a>
          {video.publishedAt ? <p className="mt-1 text-[11px] text-eql-muted">{video.publishedAt}</p> : null}
        </li>
      ))}
    </ul>
  );
}

function ClassCombosResult({ data }: { data: Record<string, unknown> }) {
  const combos = (data.combos as string[][]) ?? [];
  return (
    <div className="flex flex-wrap gap-2">
      {combos.map((combo, index) => (
        <span
          key={index}
          className={cn(
            "rounded-lg border border-eql-border bg-eql-bg/60 px-3 py-1.5 text-xs font-medium text-eql-text"
          )}
        >
          {combo.join(" · ")}
        </span>
      ))}
    </div>
  );
}

function CreatorProgramResult({ data }: { data: Record<string, unknown> }) {
  const program = data.creatorProgram as {
    title?: string;
    applicationUrl?: string;
    requirements?: string[];
  };
  if (!program) return <JsonPreview data={data} />;
  return (
    <div className="space-y-2">
      <p className="font-semibold">{program.title}</p>
      {program.applicationUrl ? (
        <a href={program.applicationUrl} target="_blank" rel="noreferrer" className="text-sm text-eql-gold hover:underline">
          Apply →
        </a>
      ) : null}
      {program.requirements?.length ? (
        <ul className="list-disc pl-4 text-xs text-eql-muted">
          {program.requirements.slice(0, 4).map((req) => (
            <li key={req}>{req}</li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

function JsonPreview({ data }: { data: unknown }) {
  return (
    <pre className="max-h-48 overflow-auto rounded-lg bg-eql-bg p-3 text-[11px] text-eql-muted">
      {JSON.stringify(data, null, 2)}
    </pre>
  );
}

function stripHtml(html: string): string {
  return html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}
