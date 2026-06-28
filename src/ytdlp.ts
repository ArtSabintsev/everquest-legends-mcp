import { execFile } from "node:child_process";
import { createHash } from "node:crypto";
import { chmod, mkdir, readFile, rename, stat, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

const RELEASE_BASE = "https://github.com/yt-dlp/yt-dlp/releases/latest/download";
const CHECKSUM_ASSET = "SHA2-256SUMS";
const REFRESH_INTERVAL_MS = 7 * 24 * 60 * 60_000;
const DOWNLOAD_TIMEOUT_MS = 60_000;

export class YtDlpUnavailableError extends Error {}

/** Thrown when yt-dlp is absent and the caller has not opted into installing it. */
export class YtDlpConsentRequiredError extends Error {}

export const YTDLP_CONSENT_MESSAGE =
  "Fetching YouTube transcripts needs the yt-dlp helper, which isn't installed yet. " +
  "YouTube gates caption downloads behind a bot-check that plain HTTP requests can't pass, so yt-dlp is what actually pulls the captions (captions only — no video or audio is downloaded). " +
  "To proceed, either install yt-dlp yourself (brew install yt-dlp / pipx install yt-dlp), " +
  "or re-run this tool with installYtDlp: true to download the official, checksum-verified standalone binary (~36 MB) into a local cache. " +
  "Set EQL_YTDLP_AUTODOWNLOAD=1 to allow this automatically from then on.";

/**
 * Map the current platform/arch to the matching yt-dlp standalone release asset.
 * The macOS/Linux standalone builds are self-contained (no Python required).
 * Pure and testable.
 */
export function ytDlpAssetName(platform: NodeJS.Platform, arch: string): string {
  if (platform === "win32") {
    return arch === "ia32" ? "yt-dlp_x86.exe" : "yt-dlp.exe";
  }
  if (platform === "darwin") {
    return "yt-dlp_macos";
  }
  if (platform === "linux") {
    if (arch === "arm64") return "yt-dlp_linux_aarch64";
    if (arch === "arm") return "yt-dlp_linux_armv7l";
    return "yt-dlp_linux";
  }
  throw new YtDlpUnavailableError(`No yt-dlp auto-download is available for platform ${platform}/${arch}. Install yt-dlp manually and set YTDLP_PATH.`);
}

function cacheDir(): string {
  if (process.platform === "win32") {
    return join(process.env.LOCALAPPDATA ?? join(homedir(), "AppData", "Local"), "everquest-legends-mcp");
  }
  if (process.platform === "darwin") {
    return join(homedir(), "Library", "Caches", "everquest-legends-mcp");
  }
  return join(process.env.XDG_CACHE_HOME ?? join(homedir(), ".cache"), "everquest-legends-mcp");
}

/** Standing consent to auto-download, granted via environment variable. */
function envConsent(): boolean {
  const value = (process.env.EQL_YTDLP_AUTODOWNLOAD ?? "").toLowerCase();
  return value === "1" || value === "true" || value === "yes" || value === "on";
}

async function fileExists(path: string): Promise<boolean> {
  try {
    await stat(path);
    return true;
  } catch {
    return false;
  }
}

async function runsOk(executable: string): Promise<boolean> {
  try {
    await execFileAsync(executable, ["--version"], { timeout: 15_000 });
    return true;
  } catch {
    return false;
  }
}

async function fetchBuffer(url: string): Promise<Buffer> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), DOWNLOAD_TIMEOUT_MS);
  try {
    const response = await fetch(url, { signal: controller.signal, redirect: "follow" });
    if (!response.ok) {
      throw new Error(`GET ${url} failed with HTTP ${response.status}`);
    }
    return Buffer.from(await response.arrayBuffer());
  } finally {
    clearTimeout(timer);
  }
}

/** Look up the expected sha256 for an asset in a SHA2-256SUMS file body. */
export function expectedChecksum(sumsFile: string, asset: string): string | undefined {
  for (const line of sumsFile.split("\n")) {
    const [hash, name] = line.trim().split(/\s+/);
    if (name === asset && hash) {
      return hash.toLowerCase();
    }
  }
  return undefined;
}

async function downloadVerified(destPath: string): Promise<void> {
  const asset = ytDlpAssetName(process.platform, process.arch);
  const sums = (await fetchBuffer(`${RELEASE_BASE}/${CHECKSUM_ASSET}`)).toString("utf8");
  const expected = expectedChecksum(sums, asset);
  if (!expected) {
    throw new YtDlpUnavailableError(`Could not find a published checksum for ${asset}; refusing to install an unverified binary.`);
  }

  const binary = await fetchBuffer(`${RELEASE_BASE}/${asset}`);
  const actual = createHash("sha256").update(binary).digest("hex");
  if (actual !== expected) {
    throw new YtDlpUnavailableError(`Checksum mismatch for ${asset} (expected ${expected}, got ${actual}); refusing to install.`);
  }

  await mkdir(cacheDir(), { recursive: true });
  // Write to a sibling temp file, then atomically rename onto the destination.
  const tempPath = `${destPath}.${process.pid}.tmp`;
  await writeFile(tempPath, binary);
  await chmod(tempPath, 0o755);
  await rename(tempPath, destPath);
  await writeFile(`${destPath}.meta.json`, JSON.stringify({ checkedAt: Date.now(), sha256: expected }), "utf8");
}

async function isStale(metaPath: string): Promise<boolean> {
  try {
    const meta = JSON.parse(await readFile(metaPath, "utf8")) as { checkedAt?: number };
    return typeof meta.checkedAt !== "number" || Date.now() - meta.checkedAt > REFRESH_INTERVAL_MS;
  } catch {
    return true;
  }
}

let resolved: string | null = null;
let inFlight: Promise<string> | null = null;

async function resolveExecutable(allowDownload: boolean): Promise<string> {
  // 1. A working yt-dlp already on PATH wins — respects a user's own up-to-date copy.
  if (await runsOk("yt-dlp")) {
    return "yt-dlp";
  }

  const managedPath = join(cacheDir(), ytDlpAssetName(process.platform, process.arch));

  // 2. A copy downloaded previously (consent already given) — refresh in the
  //    background if stale, but never fail the request on a failed update.
  if (await fileExists(managedPath)) {
    if (await isStale(`${managedPath}.meta.json`)) {
      downloadVerified(managedPath).catch(() => undefined);
    }
    return managedPath;
  }

  // 3. Nothing installed yet: require explicit consent before downloading.
  if (!allowDownload) {
    throw new YtDlpConsentRequiredError(YTDLP_CONSENT_MESSAGE);
  }

  await downloadVerified(managedPath);
  if (!(await runsOk(managedPath))) {
    throw new YtDlpUnavailableError(`Downloaded yt-dlp to ${managedPath} but it failed to run.`);
  }
  return managedPath;
}

/**
 * Resolve a usable yt-dlp executable: an explicit override, then a system copy
 * on PATH, then a cached binary, then (only with consent) an auto-downloaded
 * standalone binary. `allowDownload` (or EQL_YTDLP_AUTODOWNLOAD) authorizes the
 * one-time download. Concurrent callers share a single resolution.
 * Throws YtDlpConsentRequiredError if a download is needed but not authorized,
 * or YtDlpUnavailableError if resolution otherwise fails.
 */
export async function getYtDlpExecutable(override?: string, allowDownload = false): Promise<string> {
  const explicit = override ?? process.env.YTDLP_PATH;
  if (explicit) {
    return explicit;
  }
  if (resolved) {
    return resolved;
  }
  if (!inFlight) {
    inFlight = resolveExecutable(allowDownload || envConsent());
  }
  try {
    resolved = await inFlight;
    return resolved;
  } finally {
    inFlight = null;
  }
}
