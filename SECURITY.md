# Security

This MCP server is read-only. It should not log into Daybreak, automate a game client, manipulate accounts, download binary assets by default, or call private APIs.

## Supported Versions

Security reports should target the latest commit on `main` or the latest published release, if releases exist.

## Reporting

Use GitHub private vulnerability reporting when the repository is public. If that is unavailable, open a minimal public issue asking for a private reporting channel.

Include:

- affected tool, source id, URL, or parser
- reproduction steps
- expected and actual behavior
- impact
- whether secrets, cookies, account data, beta-only private content, or non-public Discord exports were involved

Do not submit secrets, tokens, cookies, account data, beta-only private content, or non-public Discord exports.
