import { convertToModelMessages, stepCountIs, streamText, type UIMessage } from "ai";
import { createWorkersAI } from "workers-ai-provider";
import { eqlTools } from "./eqlTools.js";

const CHAT_MODEL = "@cf/meta/llama-4-scout-17b-16e-instruct";

const SYSTEM_PROMPT = [
  "You are the EverQuest Legends Guide, a knowledgeable assistant for players researching EverQuest Legends (EQL).",
  "EQL launches pre-Kunark — Antonica, Faydwer, Odus, and classic Planes of Sky, Hate, and Fear.",
  "The community wiki inherits classic EverQuest data; when tools return eraAdvisory, warn the user that flagged content may not be launch-live.",
  "Always use your tools to look up facts before answering. Prefer official sources and the EQL wiki over assumptions.",
  "Creator YouTube channels are unofficial — verify factual claims against official pages or the wiki.",
  "Be conversational but precise. Name sources by title/URL when citing. Keep answers focused unless the user asks for depth."
].join(" ");

type Env = {
  AI: Ai;
  ASSETS: Fetcher;
};

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname === "/api/chat" && request.method === "POST") {
      return handleChat(request, env);
    }

    if (url.pathname.startsWith("/api/") && request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: corsHeaders(request) });
    }

    return serveAssets(request, env);
  }
};

async function handleChat(request: Request, env: Env): Promise<Response> {
  let body: { messages?: UIMessage[] };
  try {
    body = (await request.json()) as { messages?: UIMessage[] };
  } catch {
    return jsonResponse({ error: "Invalid JSON" }, 400, request);
  }

  const messages = body.messages;
  if (!Array.isArray(messages) || messages.length === 0) {
    return jsonResponse({ error: "messages required" }, 400, request);
  }

  const workersai = createWorkersAI({ binding: env.AI });

  const result = streamText({
    model: workersai(CHAT_MODEL),
    system: SYSTEM_PROMPT,
    messages: await convertToModelMessages(messages),
    tools: eqlTools,
    stopWhen: stepCountIs(6),
    temperature: 0.3
  });

  return result.toUIMessageStreamResponse({
    headers: corsHeaders(request)
  });
}

async function serveAssets(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url);

  if (url.pathname === "/" || url.pathname === "") {
    return addSecurityHeaders(await env.ASSETS.fetch(new URL("/index.html", request.url)));
  }

  const asset = await env.ASSETS.fetch(request);
  if (asset.status !== 404) {
    return addSecurityHeaders(asset);
  }

  // SPA fallback for client-side routes
  const index = await env.ASSETS.fetch(new URL("/index.html", request.url));
  return addSecurityHeaders(index);
}

function corsHeaders(request: Request): Record<string, string> {
  const origin = request.headers.get("Origin");
  const url = new URL(request.url);
  // Same-origin on workers.dev needs no CORS; reflect origin when present for flexibility.
  const allowOrigin = origin && (origin === url.origin || origin.endsWith(".workers.dev")) ? origin : url.origin;
  return {
    "Access-Control-Allow-Origin": allowOrigin,
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type"
  };
}

function jsonResponse(data: unknown, status: number, request: Request): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json", ...corsHeaders(request) }
  });
}

function addSecurityHeaders(response: Response): Response {
  const headers = new Headers(response.headers);
  headers.set("X-Content-Type-Options", "nosniff");
  headers.set("X-Frame-Options", "SAMEORIGIN");
  headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  return new Response(response.body, { status: response.status, statusText: response.statusText, headers });
}
