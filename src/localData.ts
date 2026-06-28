import { execFile } from "node:child_process";
import { constants } from "node:fs";
import { access, readdir, readFile, realpath, stat } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import { cleanText, snippetAround, truncateText } from "./text.js";

const execFileAsync = promisify(execFile);

const DEFAULT_VMWARE_ROOTS = [
  "~/Virtual Machines.localized",
  "~/Documents/Virtual Machines.localized",
  "~/Library/Application Support/VMware Fusion"
];

const VMWARE_KEY_VALUE_PATTERN = /^\s*([^#][^=]+?)\s*=\s*(?:"((?:\\.|[^"\\])*)"|(.*?))\s*$/;
const VMDK_EXTENT_PATTERN = /^\s*RW\s+(\d+)\s+(\S+)\s+"([^"]+)"/;
const TEXT_EXTENSIONS = new Set([
  ".cfg",
  ".conf",
  ".ini",
  ".json",
  ".log",
  ".manifest",
  ".md",
  ".opt",
  ".patch",
  ".txt",
  ".xml",
  ".yaml",
  ".yml"
]);
const SKIPPED_DIRS = new Set([".git", "dist", "node_modules"]);
const DEFAULT_LOCAL_QUERY = "EverQuest Legends EQLegends EQL Daybreak Darkpaw LaunchPad eqgame eqclient";

export type VmwareConfig = Record<string, string>;

export type VmwareSharedFolder = {
  index: number;
  enabled: boolean;
  hostPath?: string;
  guestName?: string;
  readAccess?: boolean;
  writeAccess?: boolean;
};

export type VmwareDiskExtent = {
  fileName: string;
  type: string;
  sectors: number;
  virtualSizeBytes: number;
  sizeBytes?: number;
  modifiedAt?: string;
};

export type VmwareDisk = {
  device: string;
  fileName: string;
  path: string;
  descriptorSizeBytes?: number;
  virtualSizeBytes?: number;
  allocatedSizeBytes?: number;
  extentCount?: number;
  extents?: VmwareDiskExtent[];
  createType?: string;
  adapterType?: string;
  uuid?: string;
  locked: boolean;
  descriptorReadable: boolean;
  error?: string;
};

export type VmwareLogSignal = {
  path: string;
  sizeBytes: number;
  modifiedAt: string;
  keywordCounts: Record<string, number>;
  recentMatches: string[];
};

export type VmwareSummary = {
  displayName?: string;
  path: string;
  vmxPath?: string;
  guestOS?: string;
  guestInfo?: string;
  hardware: {
    firmware?: string;
    virtualHWVersion?: string;
    cpuCount?: number;
    memoryMiB?: number;
    graphicsMemoryMiB?: number;
    guest3dEnabled?: boolean;
  };
  disks: VmwareDisk[];
  sharedFolders: VmwareSharedFolder[];
  locks: string[];
  status: {
    state: "running" | "locked-or-stale-lock" | "stopped";
    runningByVmrun: boolean;
    lockFilesPresent: boolean;
    cleanShutdown?: boolean;
  };
  logSignals?: VmwareLogSignal[];
};

export type VmwareInventory = {
  generatedAt: string;
  searchedRoots: string[];
  vmrun: {
    available: boolean;
    path?: string;
    runningVmPaths: string[];
    error?: string;
  };
  vms: VmwareSummary[];
  notes: string[];
};

export type VmwareInventoryOptions = {
  roots?: string[];
  includeLogSignals?: boolean;
  includeDiskExtents?: boolean;
  maxLogMatches?: number;
  includeVmwareInventory?: boolean;
};

export type LocalFileScanMatch = {
  path: string;
  relativePath: string;
  sizeBytes: number;
  modifiedAt: string;
  matchedTerms: string[];
  score: number;
  snippets: string[];
};

export type LocalFileScan = {
  generatedAt: string;
  rootPath: string;
  query: string;
  allowedRoots: string[];
  scannedFiles: number;
  skippedFiles: number;
  matches: LocalFileScanMatch[];
  notes: string[];
};

export type LocalFileScanOptions = {
  rootPath: string;
  query?: string;
  maxFiles?: number;
  maxDepth?: number;
  maxFileBytes?: number;
  allowedRoots?: string[];
};

export function expandHome(input: string): string {
  if (input === "~") {
    return os.homedir();
  }
  if (input.startsWith("~/")) {
    return path.join(os.homedir(), input.slice(2));
  }
  return input;
}

export function parseVmwareKeyValue(text: string): VmwareConfig {
  const config: VmwareConfig = {};

  for (const line of text.split(/\r?\n/)) {
    const match = VMWARE_KEY_VALUE_PATTERN.exec(line);
    if (!match) {
      continue;
    }
    const key = match[1]?.trim();
    const value = match[2] ?? match[3] ?? "";
    if (key) {
      config[key] = value.replace(/\\"/g, "\"").trim();
    }
  }

  return config;
}

export function getDefaultLocalScanRoots(): string[] {
  const configured = process.env.EQL_LOCAL_DATA_ROOTS?.split(path.delimiter)
    .map((entry) => entry.trim())
    .filter(Boolean);

  if (configured && configured.length > 0) {
    return configured.map((entry) => path.resolve(expandHome(entry)));
  }

  return [path.join(os.homedir(), "Downloads")].map((entry) => path.resolve(entry));
}

export async function inspectVmwareFusion(options: VmwareInventoryOptions = {}): Promise<VmwareInventory> {
  const searchedRoots = (options.roots ?? DEFAULT_VMWARE_ROOTS).map((entry) => path.resolve(expandHome(entry)));
  const vmrun = await getVmrunList();
  const vmxPaths = new Set<string>();

  for (const root of searchedRoots) {
    for (const vmxPath of await findVmxPaths(root)) {
      vmxPaths.add(vmxPath);
    }
  }

  if (options.includeVmwareInventory ?? true) {
    for (const inventoryPath of await findInventoryPaths()) {
      const inventory = await readConfigFile(inventoryPath);
      if (!inventory) {
        continue;
      }
      for (const [key, value] of Object.entries(inventory)) {
        if (key.endsWith(".config") && value.endsWith(".vmx")) {
          vmxPaths.add(path.resolve(expandHome(value)));
        }
      }
    }
  }

  const vms = await Promise.all(
    [...vmxPaths]
      .sort((left, right) => left.localeCompare(right))
      .map((vmxPath) =>
        summarizeVmwareVm(vmxPath, {
          runningVmPaths: vmrun.runningVmPaths,
          includeLogSignals: options.includeLogSignals ?? true,
          includeDiskExtents: options.includeDiskExtents ?? false,
          maxLogMatches: options.maxLogMatches ?? 20
        })
      )
  );

  return {
    generatedAt: new Date().toISOString(),
    searchedRoots,
    vmrun,
    vms,
    notes: [
      "This inventory reads VMware Fusion metadata only. It does not mount, repair, or modify VMDK files.",
      "Raw VMX keys with encryption material and other sensitive settings are intentionally excluded."
    ]
  };
}

export async function scanLocalFiles(options: LocalFileScanOptions): Promise<LocalFileScan> {
  const rootPath = path.resolve(expandHome(options.rootPath));
  const allowedRoots = options.allowedRoots ?? getDefaultLocalScanRoots();
  const realRootPath = await realpath(rootPath);
  const realAllowedRoots = await resolveExistingRoots(allowedRoots);
  const isAllowed = realAllowedRoots.some((allowedRoot) => isSameOrChild(realRootPath, allowedRoot));

  if (!isAllowed) {
    throw new Error(
      `Refusing to scan ${rootPath}. Add the containing directory to EQL_LOCAL_DATA_ROOTS or scan under one of: ${realAllowedRoots.join(", ")}`
    );
  }

  const query = cleanText(options.query ?? DEFAULT_LOCAL_QUERY);
  const terms = queryTerms(query);
  const maxFiles = clampInteger(options.maxFiles ?? 100, 1, 500);
  const maxDepth = clampInteger(options.maxDepth ?? 8, 0, 20);
  const maxFileBytes = clampInteger(options.maxFileBytes ?? 80_000, 1_000, 500_000);
  const matches: LocalFileScanMatch[] = [];
  const notes: string[] = [];
  let scannedFiles = 0;
  let skippedFiles = 0;

  async function walk(directory: string, depth: number): Promise<void> {
    if (depth < 0 || matches.length >= maxFiles) {
      return;
    }

    let entries;
    try {
      entries = await readdir(directory, { withFileTypes: true });
    } catch {
      skippedFiles += 1;
      return;
    }

    for (const entry of entries) {
      if (matches.length >= maxFiles) {
        return;
      }
      const fullPath = path.join(directory, entry.name);
      if (entry.isDirectory()) {
        if (!SKIPPED_DIRS.has(entry.name)) {
          await walk(fullPath, depth - 1);
        }
        continue;
      }
      if (!entry.isFile() || !isPotentialTextFile(entry.name)) {
        skippedFiles += 1;
        continue;
      }
      const match = await inspectTextFile(fullPath, realRootPath, query, terms, maxFileBytes);
      scannedFiles += 1;
      if (match) {
        matches.push(match);
      }
    }
  }

  await walk(realRootPath, maxDepth);

  matches.sort((left, right) => {
    if (right.score !== left.score) {
      return right.score - left.score;
    }
    return right.modifiedAt.localeCompare(left.modifiedAt);
  });

  if (matches.length >= maxFiles) {
    notes.push(`Stopped after collecting ${maxFiles} matches.`);
  }

  return {
    generatedAt: new Date().toISOString(),
    rootPath: realRootPath,
    query,
    allowedRoots: realAllowedRoots,
    scannedFiles,
    skippedFiles,
    matches,
    notes
  };
}

async function summarizeVmwareVm(
  vmxPath: string,
  options: {
    runningVmPaths: string[];
    includeLogSignals: boolean;
    includeDiskExtents: boolean;
    maxLogMatches: number;
  }
): Promise<VmwareSummary> {
  const config = (await readConfigFile(vmxPath)) ?? {};
  const vmPath = path.dirname(vmxPath);
  const locks = await listTopLevel(vmPath, (name) => name.endsWith(".lck"));
  const runningByVmrun = options.runningVmPaths.some((runningPath) => path.resolve(runningPath) === path.resolve(vmxPath));
  const lockFilesPresent = locks.length > 0;

  const state = runningByVmrun ? "running" : lockFilesPresent ? "locked-or-stale-lock" : "stopped";

  const logSignals = options.includeLogSignals ? await readLogSignals(vmPath, options.maxLogMatches) : undefined;

  return {
    displayName: config.displayName,
    path: vmPath,
    vmxPath,
    guestOS: config.guestOS,
    guestInfo: config["guestInfo.detailed.data"],
    hardware: {
      firmware: config.firmware,
      virtualHWVersion: config["virtualHW.version"],
      cpuCount: numberFromConfig(config.numvcpus),
      memoryMiB: numberFromConfig(config.memsize),
      graphicsMemoryMiB: numberFromConfig(config["svga.graphicsMemoryKB"]) ? Math.round(numberFromConfig(config["svga.graphicsMemoryKB"])! / 1024) : undefined,
      guest3dEnabled: boolFromConfig(config["mks.enable3d"])
    },
    disks: await getVmwareDisks(vmPath, config, options.includeDiskExtents),
    sharedFolders: getSharedFolders(config),
    locks,
    status: {
      state,
      runningByVmrun,
      lockFilesPresent,
      cleanShutdown: boolFromConfig(config.cleanShutdown)
    },
    ...(logSignals ? { logSignals } : {})
  };
}

async function getVmwareDisks(vmPath: string, config: VmwareConfig, includeExtents: boolean): Promise<VmwareDisk[]> {
  const disks: VmwareDisk[] = [];
  const fileKeys = Object.keys(config).filter((key) => key.endsWith(".fileName"));

  for (const key of fileKeys) {
    const device = key.slice(0, -".fileName".length);
    const fileName = config[key];
    if (!fileName || !fileName.toLowerCase().endsWith(".vmdk")) {
      continue;
    }
    if (config[`${device}.present`] && !boolFromConfig(config[`${device}.present`])) {
      continue;
    }
    const diskPath = path.isAbsolute(fileName) ? fileName : path.join(vmPath, fileName);
    disks.push(await readVmdkDescriptor(device, fileName, diskPath, includeExtents));
  }

  return disks.sort((left, right) => left.device.localeCompare(right.device));
}

async function readVmdkDescriptor(device: string, fileName: string, diskPath: string, includeExtents: boolean): Promise<VmwareDisk> {
  try {
    const descriptorStat = await stat(diskPath);
    const descriptorSizeBytes = Number(descriptorStat.size);
    if (descriptorSizeBytes > 512_000) {
      return {
        device,
        fileName,
        path: diskPath,
        descriptorSizeBytes,
        locked: await pathExists(`${diskPath}.lck`),
        descriptorReadable: false,
        error: "Descriptor file is larger than expected; skipped text parse."
      };
    }

    const descriptor = await readFile(diskPath, "utf8");
    const config = parseVmwareKeyValue(descriptor);
    const extents = [];
    let virtualSizeBytes = 0;
    let allocatedSizeBytes = descriptorSizeBytes;

    for (const line of descriptor.split(/\r?\n/)) {
      const match = VMDK_EXTENT_PATTERN.exec(line);
      if (!match) {
        continue;
      }
      const sectors = Number(match[1]);
      const type = match[2] ?? "UNKNOWN";
      const extentFileName = match[3] ?? "";
      const extentPath = path.join(path.dirname(diskPath), extentFileName);
      const extentStat = await optionalStat(extentPath);
      const extentVirtualSizeBytes = sectors * 512;
      const extentSizeBytes = extentStat ? Number(extentStat.size) : undefined;
      virtualSizeBytes += extentVirtualSizeBytes;
      allocatedSizeBytes += extentSizeBytes ?? 0;
      extents.push({
        fileName: extentFileName,
        type,
        sectors,
        virtualSizeBytes: extentVirtualSizeBytes,
        ...(extentStat ? { sizeBytes: extentSizeBytes, modifiedAt: extentStat.mtime.toISOString() } : {})
      });
    }

    return {
      device,
      fileName,
      path: diskPath,
      descriptorSizeBytes,
      virtualSizeBytes,
      allocatedSizeBytes,
      extentCount: extents.length,
      ...(includeExtents ? { extents } : {}),
      createType: config.createType,
      adapterType: config["ddb.adapterType"],
      uuid: config["ddb.uuid"],
      locked: await pathExists(`${diskPath}.lck`),
      descriptorReadable: true
    };
  } catch (error) {
    return {
      device,
      fileName,
      path: diskPath,
      locked: await pathExists(`${diskPath}.lck`),
      descriptorReadable: false,
      error: error instanceof Error ? error.message : String(error)
    };
  }
}

function getSharedFolders(config: VmwareConfig): VmwareSharedFolder[] {
  const indexes = new Set<number>();
  for (const key of Object.keys(config)) {
    const match = /^sharedFolder(\d+)\./.exec(key);
    if (match?.[1]) {
      indexes.add(Number(match[1]));
    }
  }

  return [...indexes]
    .sort((left, right) => left - right)
    .map((index) => ({
      index,
      enabled: boolFromConfig(config[`sharedFolder${index}.enabled`]) ?? false,
      hostPath: config[`sharedFolder${index}.hostPath`],
      guestName: config[`sharedFolder${index}.guestName`],
      readAccess: boolFromConfig(config[`sharedFolder${index}.readAccess`]),
      writeAccess: boolFromConfig(config[`sharedFolder${index}.writeAccess`])
    }));
}

async function readLogSignals(vmPath: string, maxMatches: number): Promise<VmwareLogSignal[]> {
  const logPaths = await listTopLevel(vmPath, (name) => /^vmware(?:-\d+)?\.log$/.test(name) || /^mksSandbox(?:-\d+)?\.log$/.test(name));
  const keywords = ["EverQuest", "EQLegends", "EQL", "Daybreak", "LaunchPad", "Game Disk", "Unrecognized shader"];
  const signals: VmwareLogSignal[] = [];

  for (const logPath of logPaths) {
    const logStat = await stat(logPath);
    const body = await readTail(logPath, 512_000);
    const lines = body.split(/\r?\n/);
    const keywordCounts: Record<string, number> = {};
    const recentMatches: string[] = [];

    for (const keyword of keywords) {
      const escaped = keyword.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      keywordCounts[keyword] = body.match(new RegExp(escaped, "gi"))?.length ?? 0;
    }

    for (const line of lines) {
      if (recentMatches.length >= maxMatches) {
        break;
      }
      if (/EverQuest|EQLegends|EQL|Daybreak|LaunchPad|Game Disk|Unrecognized shader/i.test(line)) {
        recentMatches.push(truncateText(cleanText(line), 300));
      }
    }

    signals.push({
      path: logPath,
      sizeBytes: logStat.size,
      modifiedAt: logStat.mtime.toISOString(),
      keywordCounts,
      recentMatches
    });
  }

  return signals.sort((left, right) => right.modifiedAt.localeCompare(left.modifiedAt));
}

async function getVmrunList(): Promise<VmwareInventory["vmrun"]> {
  const candidates = [
    process.env.VMRUN_PATH,
    "/Applications/VMware Fusion.app/Contents/Public/vmrun",
    "/Applications/VMware Fusion.app/Contents/Library/vmrun"
  ].filter((entry): entry is string => Boolean(entry));

  for (const candidate of candidates) {
    try {
      await access(candidate, constants.X_OK);
      const { stdout } = await execFileAsync(candidate, ["list"], { timeout: 5_000, maxBuffer: 1024 * 1024 });
      const runningVmPaths = stdout
        .split(/\r?\n/)
        .map((line) => line.trim())
        .filter((line) => line.endsWith(".vmx"));
      return { available: true, path: candidate, runningVmPaths };
    } catch (error) {
      if (candidate === candidates[candidates.length - 1]) {
        return {
          available: false,
          path: candidate,
          runningVmPaths: [],
          error: error instanceof Error ? error.message : String(error)
        };
      }
    }
  }

  return { available: false, runningVmPaths: [], error: "vmrun not found" };
}

async function findInventoryPaths(): Promise<string[]> {
  return [
    path.join(os.homedir(), "Library/Application Support/VMware Fusion/vmInventory"),
    path.join(os.homedir(), "Library/Preferences/VMware Fusion/vmInventory")
  ].filter((entry, index, entries) => entries.indexOf(entry) === index);
}

async function findVmxPaths(root: string, maxDepth = 4): Promise<string[]> {
  if (!(await pathExists(root))) {
    return [];
  }

  const found: string[] = [];

  async function walk(directory: string, depth: number): Promise<void> {
    if (depth < 0) {
      return;
    }
    let entries;
    try {
      entries = await readdir(directory, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      const fullPath = path.join(directory, entry.name);
      if (entry.isFile() && entry.name.endsWith(".vmx")) {
        found.push(fullPath);
      } else if (entry.isDirectory() && !SKIPPED_DIRS.has(entry.name)) {
        await walk(fullPath, depth - 1);
      }
    }
  }

  await walk(root, maxDepth);
  return found;
}

async function readConfigFile(filePath: string): Promise<VmwareConfig | undefined> {
  try {
    return parseVmwareKeyValue(await readFile(filePath, "utf8"));
  } catch {
    return undefined;
  }
}

async function listTopLevel(root: string, predicate: (name: string) => boolean): Promise<string[]> {
  try {
    const entries = await readdir(root, { withFileTypes: true });
    return entries
      .filter((entry) => predicate(entry.name))
      .map((entry) => path.join(root, entry.name))
      .sort((left, right) => left.localeCompare(right));
  } catch {
    return [];
  }
}

async function inspectTextFile(
  filePath: string,
  rootPath: string,
  query: string,
  terms: string[],
  maxFileBytes: number
): Promise<LocalFileScanMatch | undefined> {
  const fileStat = await stat(filePath);
  if (fileStat.size > maxFileBytes) {
    return undefined;
  }

  let text;
  try {
    const buffer = await readFile(filePath);
    if (!looksTextual(buffer)) {
      return undefined;
    }
    text = buffer.toString("utf8");
  } catch {
    return undefined;
  }

  const searchable = `${path.basename(filePath)}\n${text}`;
  const matchedTerms = terms.filter((term) => searchable.toLowerCase().includes(term.toLowerCase()));
  if (matchedTerms.length === 0) {
    return undefined;
  }

  const snippets = matchedTerms.slice(0, 3).map((term) => snippetAround(text, term, 600));
  const uniqueSnippets = [...new Set(snippets.filter(Boolean))].slice(0, 3);

  return {
    path: filePath,
    relativePath: path.relative(rootPath, filePath),
    sizeBytes: fileStat.size,
    modifiedAt: fileStat.mtime.toISOString(),
    matchedTerms,
    score: matchedTerms.length + (path.basename(filePath).match(/everquest|eqlegends|eql|daybreak|launchpad/i) ? 3 : 0),
    snippets: uniqueSnippets.length > 0 ? uniqueSnippets : [truncateText(cleanText(text), 600)]
  };
}

async function readTail(filePath: string, maxBytes: number): Promise<string> {
  const fileStat = await stat(filePath);
  const body = await readFile(filePath);
  if (fileStat.size <= maxBytes) {
    return body.toString("utf8");
  }
  return body.subarray(body.length - maxBytes).toString("utf8");
}

async function resolveExistingRoots(roots: string[]): Promise<string[]> {
  const resolved = [];
  for (const root of roots) {
    const absolute = path.resolve(expandHome(root));
    try {
      resolved.push(await realpath(absolute));
    } catch {
      resolved.push(absolute);
    }
  }
  return [...new Set(resolved)].sort((left, right) => left.localeCompare(right));
}

function isPotentialTextFile(fileName: string): boolean {
  const lower = fileName.toLowerCase();
  return TEXT_EXTENSIONS.has(path.extname(lower)) || /everquest|eqlegends|eql|daybreak|launchpad/.test(lower);
}

function looksTextual(buffer: Buffer): boolean {
  const sample = buffer.subarray(0, Math.min(buffer.length, 4096));
  if (sample.includes(0)) {
    return false;
  }
  if (sample.length === 0) {
    return true;
  }
  let printable = 0;
  for (const byte of sample) {
    if (byte === 9 || byte === 10 || byte === 13 || (byte >= 32 && byte <= 126) || byte >= 160) {
      printable += 1;
    }
  }
  return printable / sample.length > 0.85;
}

function queryTerms(query: string): string[] {
  return [
    ...new Set(
      query
        .split(/\s+/)
        .map((term) => term.trim().replace(/^"+|"+$/g, ""))
        .filter((term) => term.length > 1)
    )
  ];
}

function isSameOrChild(candidate: string, parent: string): boolean {
  const relative = path.relative(parent, candidate);
  return relative === "" || (!relative.startsWith("..") && !path.isAbsolute(relative));
}

function numberFromConfig(value: string | undefined): number | undefined {
  if (!value) {
    return undefined;
  }
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function boolFromConfig(value: string | undefined): boolean | undefined {
  if (value === undefined) {
    return undefined;
  }
  if (/^(true|yes|1)$/i.test(value)) {
    return true;
  }
  if (/^(false|no|0)$/i.test(value)) {
    return false;
  }
  return undefined;
}

function clampInteger(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, Math.trunc(value)));
}

async function optionalStat(filePath: string): Promise<Awaited<ReturnType<typeof stat>> | undefined> {
  try {
    return await stat(filePath);
  } catch {
    return undefined;
  }
}

async function pathExists(filePath: string): Promise<boolean> {
  try {
    await access(filePath);
    return true;
  } catch {
    return false;
  }
}
