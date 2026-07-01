#!/usr/bin/env node
// tsc does not emit non-TS assets, so copy the committed data snapshots from
// src/data into dist/data after compilation. Runtime modules resolve these via
// import.meta.url (e.g. src/eqlbuilds.ts -> ./data/eqlbuilds/*.json), so the
// files must exist alongside the compiled output that ships in the package.

import { cp } from "node:fs/promises";
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";

const src = new URL("../src/data/", import.meta.url);
const dest = new URL("../dist/data/", import.meta.url);

// Log to stderr, not stdout: this runs during the `prepare` lifecycle, and
// `npm pack --silent` captures lifecycle stdout — anything printed here would
// corrupt `tarball=$(npm pack --silent)` in the CI smoke step.
if (!existsSync(src)) {
  console.error("[copy-data] no src/data directory; nothing to copy.");
  process.exit(0);
}

await cp(src, dest, { recursive: true });
console.error(`[copy-data] copied ${fileURLToPath(src)} -> ${fileURLToPath(dest)}`);
