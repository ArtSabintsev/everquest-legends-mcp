// Prints the CHANGELOG.md section for a given version (release-notes recovery
// path for .github/workflows/release.yml). NOTE: mirrored in
// guildwars1-mcp — keep in sync.
//
// Usage: node scripts/changelog-notes.mjs 0.4.0
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const version = process.argv[2];
if (!version) {
  console.error("usage: node scripts/changelog-notes.mjs <version>");
  process.exit(2);
}

const changelogPath = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "CHANGELOG.md");
const changelog = readFileSync(changelogPath, "utf8");
const escaped = version.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const match = changelog.match(new RegExp(`## \\[${escaped}\\][^\\n]*\\n([\\s\\S]*?)(?=\\n## \\[|$)`));
if (!match || !match[1].trim()) {
  console.error(`no CHANGELOG section found for version ${version}`);
  process.exit(1);
}
process.stdout.write(`${match[1].trim()}\n`);
