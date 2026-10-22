# deed.page skill

An agent skill that publishes a file or folder to a permanent `https://<slug>.deed.page/` URL with one `curl` request. No account, API key, email code, or claim link.

It works with Claude Code, Codex, Cursor, Gemini CLI, GitHub Copilot CLI, Grok Bot, Hermes Agent, and any agent that reads `SKILL.md` files ([agentskills.io](https://agentskills.io) format).

- Website: https://deed.page
- Docs: https://deed.page/docs
- llms.txt: https://deed.page/llms.txt
- OpenAPI: https://deed.page/openapi.json
- MCP server: https://deed.page/mcp

The skill is one file: [`skills/deed-page/SKILL.md`](skills/deed-page/SKILL.md). The repo is also a plugin that bundles the skill with the hosted deed.page MCP server, with manifests for each agent:

| File | Format |
| --- | --- |
| [`plugin.json`](plugin.json), [`mcp.json`](mcp.json) | [Agent Plugins 1.0](https://agent-plugins.org) (Codex, Cursor, Copilot CLI, Kiro) |
| [`.grok-plugin/plugin.json`](.grok-plugin/plugin.json) | Grok Bot |
| [`.cursor-plugin/plugin.json`](.cursor-plugin/plugin.json) | Cursor |
| [`.codex-plugin/plugin.json`](.codex-plugin/plugin.json), [`.agents/plugins/marketplace.json`](.agents/plugins/marketplace.json) | Codex |
| [`.claude-plugin/plugin.json`](.claude-plugin/plugin.json), [`.claude-plugin/marketplace.json`](.claude-plugin/marketplace.json), [`.mcp.json`](.mcp.json) | Claude Code |
| [`gemini-extension.json`](gemini-extension.json) | Gemini CLI |

Quick install for any agent:

```bash
npx skills add f-o-x11/deed-page-skill
```

## Install

### Any agent (skills.sh)

```bash
npx skills add f-o-x11/deed-page-skill
```

Add `-g` to install for all projects, or `-a claude-code`, `-a codex`, `-a cursor`, or `-a hermes-agent` to pick the agent.

### Claude Code

As a plugin:

```bash
claude plugin marketplace add f-o-x11/deed-page-skill
claude plugin install deed-page@deed-page
```

Or as a plain skill:

```bash
git clone --depth 1 https://github.com/f-o-x11/deed-page-skill /tmp/deed-page-skill
mkdir -p ~/.claude/skills && cp -r /tmp/deed-page-skill/skills/deed-page ~/.claude/skills/
```

### Codex

As a plugin (skill + MCP server):

```bash
codex plugin marketplace add f-o-x11/deed-page-skill
```

Then install `deed-page` from the plugin directory. As a plain skill:

```bash
npx skills add f-o-x11/deed-page-skill -a codex -g
```

Or inside Codex: `$skill-installer install https://github.com/f-o-x11/deed-page-skill/tree/main/skills/deed-page`

### Cursor

As a plain skill:

```bash
npx skills add f-o-x11/deed-page-skill -a cursor
```

### GitHub Copilot CLI

```bash
copilot plugin marketplace add f-o-x11/deed-page-skill
copilot plugin install deed-page@deed-page
```

### Grok Bot

The repo includes a Grok Bot plugin manifest in [`.grok-plugin/plugin.json`](.grok-plugin/plugin.json). Until it is in the Grok Bot plugin catalog, add the remote MCP server `https://deed.page/mcp`, or install the skill with `npx skills add f-o-x11/deed-page-skill`.

### Any MCP client

Add the remote MCP server `https://deed.page/mcp` (Streamable HTTP, no auth). It is listed in the official MCP Registry as `page.deed/deed-page`.

### Gemini CLI

```bash
gemini extensions install https://github.com/f-o-x11/deed-page-skill
```

This installs the skill and the deed.page MCP server (`https://deed.page/mcp`, no auth) from [`gemini-extension.json`](gemini-extension.json).

### Hermes Agent

```bash
hermes skills install f-o-x11/deed-page-skill/skills/deed-page
```

Or from the deed.page well-known endpoint: `hermes skills install well-known:https://deed.page/.well-known/skills/deed-page`.

Or `npx skills add f-o-x11/deed-page-skill -a hermes-agent -g`.

## What it does

Ask your agent to "publish this", "host this report", or "give me a link". The agent runs:

```bash
curl -sS -T index.html "https://deed.page/v1/sites?slug=my-report-7f3a2c&ref=skill-gh" -H "X-Client: <agent name>"
```

and answers with the `url` from the JSON response. The first publish returns a `token` once. It is the key to update or delete that site, so keep it safe.

- Free plan: 25 sites, 25 MB per site, 60 publishes per hour.
- Free sites are public. Do not publish secrets.
- Static files only.

`?ref=skill-gh` tells deed.page that a publish came from this skill. It does not change what is published. Set `DEED_REF` to override it. You can also say where you found deed.page with the optional `X-Deed-Heard-From` header on the first publish (at most 200 characters).

## Network endpoints and credentials

- The skill calls only `https://deed.page/v1/sites` with `curl`. The MCP server is `https://deed.page/mcp`. Published sites live at `https://<slug>.deed.page/`.
- No account or API key is needed. The first publish returns a site token once; the skill keeps it in `DEEDPAGE_TOKEN` for the session and sends it only to `https://deed.page` to update or delete that site.
- No install scripts, hooks, or executable code. See [SECURITY.md](SECURITY.md).

## Privacy and support

- Privacy policy: https://deed.page/privacy
- Terms: https://deed.page/terms
- Support: https://deed.page/support or ops@avatar33.com
- Security reports: ops@avatar33.com (see [SECURITY.md](SECURITY.md))

## License

MIT. Copyright (c) 2026 Avatar 8 LLC.

deed.page is operated by Avatar 8 LLC. Contact: ops@avatar33.com. Report abuse: https://deed.page/abuse.
