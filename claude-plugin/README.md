# deed.page plugin

deed.page publishes HTML, CSS, JavaScript and other static files to a live website at a permanent HTTPS URL (`https://<slug>.deed.page`). Ask Claude to build a landing page, portfolio, event page, report, HTML game or interactive demo and publish it, and you get a link you can share right away. No account is needed to publish.

![deed.page](assets/icon.png)

## What this plugin contains

- **MCP server** (`.mcp.json`): the hosted deed.page server at `https://deed.page/mcp/claude` (Streamable HTTP, no sign-in). It provides 25 tools to publish, update, list, restore, analyze and delete sites, attach custom domains, and manage webhooks and owner tokens.
- **Skill** `publish-with-deed-page` (`skills/publish-with-deed-page/SKILL.md`): tells Claude how to build and publish files, keep the owner token, and change or delete a site later.

## What it runs, sends and stores

- The plugin runs no local code, starts no local process and has no hooks.
- When you ask Claude to publish or change a site, Claude sends the site's files, the slug and the owner token to `https://deed.page/mcp/claude`. Nothing is sent to any other service.
- Published files are public to anyone with the URL. Do not publish passwords, API keys or private data.
- The first publish returns an owner token once. Anyone holding it can change or delete the site, so keep it private.
- deed.page stores the published files, site versions and cookieless visit counts. See the privacy policy for retention and how to delete a site or export its files.

## Install in Claude Code

```text
/plugin marketplace add f-o-x11/deed-page-skill
/plugin install deed-page@deed-page
```

## Limits

Static files only, with no server-side code or databases. Size and site-count limits apply. A lost owner token cannot be recovered unless a recovery email was attached.

## Links

- Docs: https://deed.page/docs
- Privacy: https://deed.page/privacy
- Terms: https://deed.page/terms
- Support: https://deed.page/support (ops@avatar33.com)

Operated by Avatar 8 LLC. License: MIT.
