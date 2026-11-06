---
name: publish-with-deed-page
description: Publish HTML, CSS, JavaScript and other static files to a permanent public HTTPS URL on deed.page, then update, roll back, list, attach a custom domain to, check visits for, or delete the site with its owner token. Use when the user asks to publish, host, deploy or share a page, site, report, demo or HTML game.
---

# Publish with deed.page (1.19.0)

deed.page hosts static files at `https://<slug>.deed.page/`. The tools come from the deed.page MCP server at `https://deed.page/mcp/claude`. No account is needed. The first publish returns an owner token, and that token is the only way to change or delete the site later.

## Publish a site

1. Confirm what the user wants published. Everything published is public to anyone with the URL, so leave out passwords, API keys and private data.
2. Build the files. Include an `index.html` at the root. Use relative links between files. A single-file page or game is fine.
3. Send the files to `publish_site` as a map of path to contents:
   `{"index.html": "<!doctype html>...", "style.css": "body{...}"}`.
   Binary files use `{"base64": "..."}`. An array of `{path, content}` or `{path, base64}` objects is also accepted.
4. Leave `slug` out to get a generated one, or pass a short lowercase slug the user asked for. If the slug is taken, pick another rather than guessing someone else's token.
5. Show the user the returned `url`. Tell them the `token` is shown once and is needed for any later change. Keep it in this conversation for follow-up requests. In Claude Code, save it to a file only if the user asks, and never commit it to a repository.

For many or large files, call `plan_upload` with a manifest of paths, sizes and sha256 hashes, upload each missing file to the URL it returns, then call `finalize_upload`.

Do not pass where the user heard about deed.page, an email address, or other attribution details to any tool unless the user asks you to.

## Change a site

- Edit: `update_site` with the slug, the full new file map and the token. Set `merge: true` to change only some paths. The URL stays the same and the version goes up by one.
- History: `list_versions` lists retained versions. `restore_version` makes a new version with an older version's files. `get_manifest` returns the signed file list for a version.
- Status: `get_site` (no token) shows whether a slug is live and its version. `list_sites` lists the token's sites with URLs and versions.
- Visits: `site_visits` returns page views and daily visitors for a date range, and `site_analytics` returns daily views, top paths and referrers. If a range isn't available for the site, the tool says so. Pass that message on as is.
- Custom domains: `add_domain` returns the DNS records to create. `domain_status` refreshes verification and certificate state. `list_domains` and `remove_domain` manage hostnames.
- Passwords: `set_site_access` sets or clears a site password when the user asks for one. Never repeat a password back in chat.
- Gallery: `set_listing` adds a site to the public gallery or removes it. Only list a site when the user asks.
- Webhooks: `create_webhook`, `list_webhooks` and `delete_webhook` manage event notifications for the token's sites.
- Tokens: `rotate_token` issues a new token for the same sites. `revoke_token` ends a token. Confirm with the user before either.
- Remove: `delete_site` with the slug and token. The URL then returns 404. Confirm with the user first.

## Account tools

Call `whoami` and the server's other account tools only when the user asks about their account. Do not bring up account changes on your own, and pass on any limit message as the tool states it.

## Limits

- Static files only. Server code, databases and environment secrets do not run.
- Without the owner token a site cannot be edited or deleted. A lost token cannot be recovered unless a recovery email was attached.
- Size and site-count limits apply.
- Malware, executables and credential-harvesting pages are rejected.

Docs: https://deed.page/docs. Support: https://deed.page/support (ops@avatar33.com).
