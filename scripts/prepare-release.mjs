// Prepares an automatic semver release from conventional commits.
//
// Reads commits since the last tag, picks the bump (breaking -> major,
// feat -> minor, otherwise patch), runs `npm version` (no git tag), converts
// the CHANGELOG's "[Unreleased]" section (or a generated commit summary) into
// the new version's section, and writes the release notes to .release-notes.md.
//
// Prints the new version to stdout, or "none" when there is nothing to
// release. Run by .github/workflows/release.yml on every push to main.
// NOTE: mirrored in guildwars1-mcp — keep in sync.
//
// Usage: node scripts/prepare-release.mjs
import { execSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const sh = (command) => execSync(command, { cwd: root, encoding: "utf8" }).trim();

let lastTag = null;
try {
  lastTag = sh("git describe --tags --abbrev=0");
} catch {
  // No tags yet: release everything.
}
const range = lastTag ? `${lastTag}..HEAD` : "HEAD";

const rawCommits = sh(`git log --format=%H%x00%s%x00%b%x01 ${range}`);
const commits = rawCommits
  .split("\u0001")
  .map((entry) => entry.trim())
  .filter(Boolean)
  .map((entry) => {
    const [hash, subject, body] = entry.split("\u0000");
    return { hash: (hash ?? "").slice(0, 7), subject: subject ?? "", body: body ?? "" };
  })
  .filter((commit) => commit.subject && !commit.subject.startsWith("chore(release):"));

if (commits.length === 0) {
  console.error(`no releasable commits since ${lastTag ?? "the beginning"}`);
  process.stdout.write("none");
  process.exit(0);
}

const isBreaking = commits.some(
  (commit) => /^[a-z]+(\([^)]*\))?!:/.test(commit.subject) || commit.body.includes("BREAKING CHANGE")
);
const hasFeature = commits.some((commit) => /^feat(\([^)]*\))?:/.test(commit.subject));
const bump = isBreaking ? "major" : hasFeature ? "minor" : "patch";

const version = sh(`npm version ${bump} --no-git-tag-version`).replace(/^v/, "");
const date = new Date().toISOString().slice(0, 10);

function describeCommit(commit) {
  const cleaned = commit.subject.replace(/^[a-z]+(\([^)]*\))?!?:\s*/, "");
  return `- ${cleaned} (${commit.hash})`;
}

function generatedSection() {
  const added = commits.filter((commit) => /^feat(\([^)]*\))?!?:/.test(commit.subject));
  const fixed = commits.filter((commit) => /^fix(\([^)]*\))?!?:/.test(commit.subject));
  const changed = commits.filter((commit) => !added.includes(commit) && !fixed.includes(commit));
  const parts = [];
  if (added.length > 0) parts.push(`### Added\n\n${added.map(describeCommit).join("\n")}`);
  if (fixed.length > 0) parts.push(`### Fixed\n\n${fixed.map(describeCommit).join("\n")}`);
  if (changed.length > 0) parts.push(`### Changed\n\n${changed.map(describeCommit).join("\n")}`);
  return parts.join("\n\n");
}

const changelogPath = path.join(root, "CHANGELOG.md");
const changelog = readFileSync(changelogPath, "utf8");
// Consume only the heading line itself; a greedy \s* here would swallow the
// newline the lookahead needs and misread the next section as unreleased notes.
const unreleasedMatch = changelog.match(/## \[Unreleased\][^\n]*\n([\s\S]*?)(?=\n## \[|$)/);
const manualNotes = unreleasedMatch?.[1]?.trim();

let notes;
let updatedChangelog;
if (manualNotes) {
  // A hand-written [Unreleased] section becomes the release's notes verbatim;
  // a fresh empty [Unreleased] heading is left above it for the next release.
  notes = manualNotes;
  updatedChangelog = changelog.replace(/## \[Unreleased\]/, `## [Unreleased]\n\n## [${version}] - ${date}`);
} else {
  notes = generatedSection();
  if (unreleasedMatch) {
    // An empty [Unreleased] heading exists: insert the new section directly
    // beneath it so the changelog stays in version order.
    updatedChangelog = changelog.replace(
      /## \[Unreleased\]\s*\n/,
      `## [Unreleased]\n\n## [${version}] - ${date}\n\n${notes}\n\n`
    );
  } else {
    const firstSection = changelog.search(/\n## \[/);
    const insertAt = firstSection === -1 ? changelog.length : firstSection;
    updatedChangelog = `${changelog.slice(0, insertAt)}\n## [${version}] - ${date}\n\n${notes}\n${changelog.slice(insertAt)}`;
  }
}

writeFileSync(changelogPath, updatedChangelog, "utf8");
writeFileSync(path.join(root, ".release-notes.md"), `${notes}\n`, "utf8");
console.error(`prepared release ${version} (${bump}) from ${commits.length} commit(s) since ${lastTag ?? "start"}`);
process.stdout.write(version);
