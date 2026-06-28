import { execFile } from "node:child_process";
import { mkdtemp, readdir, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";
import { cleanText, truncateText } from "./text.js";
import { getYtDlpExecutable, YtDlpConsentRequiredError, YtDlpUnavailableError } from "./ytdlp.js";

const execFileAsync = promisify(execFile);

export type TranscriptSegment = {
  start: number;
  duration: number;
  text: string;
};

export type TranscriptResult = {
  platform: "youtube" | "twitch" | "unknown";
  videoId: string | null;
  url: string;
  available: boolean;
  reason?: string;
  language?: string;
  kind?: "manual" | "asr";
  segmentCount: number;
  durationSeconds: number;
  text: string;
};

/**
 * Resolve a raw video id or any common YouTube URL form to an 11-char video id.
 * Returns null for inputs that are not recognizably YouTube.
 */
export function extractYouTubeVideoId(input: string): string | null {
  const value = input.trim();
  if (/^[a-zA-Z0-9_-]{11}$/.test(value)) {
    return value;
  }

  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return null;
  }

  const host = url.hostname.replace(/^www\./, "").toLowerCase();
  if (host === "youtu.be") {
    const id = url.pathname.slice(1).split("/")[0];
    return /^[a-zA-Z0-9_-]{11}$/.test(id) ? id : null;
  }
  if (host === "youtube.com" || host === "m.youtube.com" || host === "music.youtube.com") {
    const fromQuery = url.searchParams.get("v");
    if (fromQuery && /^[a-zA-Z0-9_-]{11}$/.test(fromQuery)) {
      return fromQuery;
    }
    const match = url.pathname.match(/\/(?:embed|shorts|live|v)\/([a-zA-Z0-9_-]{11})/);
    return match ? match[1] : null;
  }
  return null;
}

export function detectPlatform(input: string): "youtube" | "twitch" | "unknown" {
  if (extractYouTubeVideoId(input)) {
    return "youtube";
  }
  try {
    const host = new URL(input.trim()).hostname.replace(/^www\./, "").toLowerCase();
    if (host === "twitch.tv" || host === "clips.twitch.tv" || host.endsWith(".twitch.tv")) {
      return "twitch";
    }
  } catch {
    // not a URL
  }
  return "unknown";
}

type Json3Event = {
  tStartMs?: number;
  dDurationMs?: number;
  segs?: { utf8?: string }[];
};

/**
 * Parse yt-dlp's json3 subtitle format into ordered transcript segments. Pure.
 * json3 is YouTube's native caption JSON: events with tStartMs/dDurationMs and
 * a list of text segments. Newline-only events are dropped.
 */
export function parseJson3(json: string): TranscriptSegment[] {
  let parsed: { events?: Json3Event[] };
  try {
    parsed = JSON.parse(json);
  } catch {
    return [];
  }
  if (!Array.isArray(parsed.events)) {
    return [];
  }
  return parsed.events
    .map((event) => {
      const text = cleanText((event.segs ?? []).map((seg) => seg.utf8 ?? "").join(""));
      return {
        start: (event.tStartMs ?? 0) / 1000,
        duration: (event.dDurationMs ?? 0) / 1000,
        text
      };
    })
    .filter((segment) => segment.text.length > 0);
}

function emptyResult(
  platform: TranscriptResult["platform"],
  videoId: string | null,
  url: string,
  reason: string
): TranscriptResult {
  return { platform, videoId, url, available: false, reason, segmentCount: 0, durationSeconds: 0, text: "" };
}

export type TranscriptOptions = {
  language?: string;
  maxCharacters?: number;
  /** Override the yt-dlp executable path/name. Defaults to YTDLP_PATH env or "yt-dlp". */
  ytDlpPath?: string;
  /** Authorize a one-time auto-download of yt-dlp if it is not already available. */
  allowDownload?: boolean;
  timeoutMs?: number;
};

class YtDlpMissingError extends Error {}

/**
 * Run yt-dlp to download a single language's captions (manual preferred, else
 * auto-generated) as json3 into a throwaway temp dir, and return the parsed file
 * contents plus whether the track was auto-generated. No video/audio is fetched.
 */
async function downloadCaptions(
  url: string,
  language: string,
  ytDlpPath: string,
  timeoutMs: number
): Promise<{ json: string; kind: "manual" | "asr" } | null> {
  const dir = await mkdtemp(join(tmpdir(), "eql-captions-"));
  try {
    const baseArgs = [
      "--skip-download",
      "--no-playlist",
      "--sub-format",
      "json3",
      "--sub-langs",
      // match the base language and regional variants, e.g. en, en-US, en-GB
      `${language.split("-")[0]}.*,${language}`,
      "--socket-timeout",
      "30",
      "-o",
      join(dir, "%(id)s.%(ext)s"),
      url
    ];

    // Pass 1: manual subtitles only. Pass 2: auto-generated fallback.
    for (const [flag, kind] of [
      ["--write-subs", "manual"],
      ["--write-auto-subs", "asr"]
    ] as const) {
      try {
        await execFileAsync(ytDlpPath, [flag, ...baseArgs], { timeout: timeoutMs, maxBuffer: 8 * 1024 * 1024 });
      } catch (error) {
        const err = error as NodeJS.ErrnoException;
        if (err.code === "ENOENT") {
          throw new YtDlpMissingError();
        }
        // yt-dlp exits non-zero for "no subtitles of this type"; keep going.
      }
      const files = (await readdir(dir)).filter((name) => name.endsWith(".json3"));
      if (files.length > 0) {
        return { json: await readFile(join(dir, files[0]), "utf8"), kind };
      }
    }
    return null;
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

// In-flight de-duplication: concurrent identical requests share one yt-dlp run.
const inFlight = new Map<string, Promise<TranscriptResult>>();

/**
 * Fetch an existing transcript (published captions) for a video URL or id.
 * YouTube only: Twitch VODs do not expose retrievable captions. Uses yt-dlp,
 * resolved from PATH or auto-downloaded on first use; no ffmpeg, API key, or
 * audio download.
 */
export async function getVideoTranscript(input: string, options: TranscriptOptions = {}): Promise<TranscriptResult> {
  const language = options.language ?? "en";
  const maxCharacters = options.maxCharacters ?? 100_000;
  const timeoutMs = options.timeoutMs ?? 90_000;
  const platform = detectPlatform(input);

  if (platform === "twitch") {
    return emptyResult(
      "twitch",
      null,
      input.trim(),
      "Twitch VODs do not expose retrievable captions. Captions on Twitch are live-only and not stored, so there is no transcript to fetch. Transcribing Twitch requires a separate audio-to-text (ASR) pipeline."
    );
  }

  const videoId = extractYouTubeVideoId(input);
  if (!videoId) {
    return emptyResult("unknown", null, input.trim(), "Input is not a recognized YouTube video id or URL.");
  }

  const watchUrl = `https://www.youtube.com/watch?v=${videoId}`;
  const cacheKey = `${videoId}:${language}:${maxCharacters}`;
  const existing = inFlight.get(cacheKey);
  if (existing) {
    return existing;
  }

  const job = (async (): Promise<TranscriptResult> => {
    let ytDlpPath: string;
    try {
      ytDlpPath = await getYtDlpExecutable(options.ytDlpPath, options.allowDownload);
    } catch (error) {
      if (error instanceof YtDlpConsentRequiredError) {
        return emptyResult("youtube", videoId, watchUrl, error.message);
      }
      if (error instanceof YtDlpUnavailableError) {
        return emptyResult("youtube", videoId, watchUrl, `yt-dlp could not be obtained: ${error.message}`);
      }
      throw error;
    }

    let captions: { json: string; kind: "manual" | "asr" } | null;
    try {
      captions = await downloadCaptions(watchUrl, language, ytDlpPath, timeoutMs);
    } catch (error) {
      if (error instanceof YtDlpMissingError) {
        return emptyResult(
          "youtube",
          videoId,
          watchUrl,
          `yt-dlp could not be executed (resolved to "${ytDlpPath}"). If you set YTDLP_PATH, verify it points to a working yt-dlp binary.`
        );
      }
      throw error;
    }

    if (!captions) {
      return emptyResult("youtube", videoId, watchUrl, "No captions (manual or auto-generated) are published for this video in the requested language.");
    }

    const segments = parseJson3(captions.json);
    if (segments.length === 0) {
      return emptyResult("youtube", videoId, watchUrl, "Caption file was retrieved but contained no usable text.");
    }

    const lastSegment = segments[segments.length - 1];
    const durationSeconds = Math.round(lastSegment.start + lastSegment.duration);
    const fullText = segments
      .map((segment) => segment.text)
      .join(" ")
      .replace(/\s+/g, " ")
      .trim();

    return {
      platform: "youtube",
      videoId,
      url: watchUrl,
      available: true,
      language,
      kind: captions.kind,
      segmentCount: segments.length,
      durationSeconds,
      text: truncateText(fullText, maxCharacters)
    };
  })();

  inFlight.set(cacheKey, job);
  try {
    return await job;
  } finally {
    inFlight.delete(cacheKey);
  }
}
