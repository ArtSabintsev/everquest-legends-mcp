# Versioning & releases

This package is **semantically versioned** and released automatically from `main`.

## Rules

1. **Every substantive change on `main` gets a version.** The Release workflow (`.github/workflows/release.yml`) runs on every push to `main` and after successful data-refresh workflows.
2. **Bump size is chosen from conventional commits** since the last git tag (`scripts/prepare-release.mjs`):
   - `feat!:` / `BREAKING CHANGE` → **major**
   - `feat:` → **minor**
   - everything else (`fix:`, `chore:`, `docs:`, `ci:`, …) → **patch**
   - `chore(release):` commits are ignored so the bot does not re-release itself
3. **Humans do not hand-edit `package.json` version** for a normal ship. The release job runs `npm version <bump> --no-git-tag-version`, rewrites `CHANGELOG.md`, commits `chore(release): X.Y.Z`, creates an **annotated** tag `vX.Y.Z`, pushes, and publishes a GitHub Release.
4. **Dates live in `CHANGELOG.md`** as `## [X.Y.Z] - YYYY-MM-DD` (UTC date of the release job). Keep hand notes under `## [Unreleased]` until the next release consumes them.
   - If `[Unreleased]` has any body text, **that body becomes the release notes verbatim** (commit subjects are not auto-merged in). Keep it complete before you push, or leave it empty and let the bot generate notes from conventional commits.
   - When multiple `feat:` commits land in one release window, either leave `[Unreleased]` empty or list every feature under it.
5. **Tags are the source of truth for “what shipped.”** GitHub Releases must match tags; the release workflow also has a heal step that ensures a Release exists for the latest tag if a previous run failed mid-way.
6. **Data-only refreshes** (`chore: refresh eqlbuilds…`) still go through the release path when they land on `main` via `workflow_run`, so snapshot commits are versioned rather than floating untagged on `main`.

## Commit message requirements

Use [Conventional Commits](https://www.conventionalcommits.org/):

```text
feat: add eql_companion_tools catalog
fix: handle Daybreak maintenance interstitial
chore: refresh eqlbuilds.com data snapshot (wiki rev 151303)
docs: document versioning rules
```

PRs that squash-merge must keep a conventional subject on the squash commit — that subject is what the next release reads.

## Manual release

If automation is stuck:

```bash
# from a clean main, after the change is already committed
gh workflow run Release --ref main
```

Do **not** force-push tags or rewrite published release notes without a deliberate rollback plan.

## Checklist for maintainers

- [ ] Change lands on `main` with a conventional commit
- [ ] `CHANGELOG.md` `[Unreleased]` notes are accurate (or empty → auto-generated from commits)
- [ ] Release workflow succeeds (new `chore(release)` commit + `v*` tag + GitHub Release)
- [ ] `npm` / `npx github:…` consumers see the new version after the tag exists
