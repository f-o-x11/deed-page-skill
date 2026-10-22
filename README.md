# deed.page skill

An agent skill that publishes a file or folder to a permanent `https://<slug>.deed.page/` URL with one `curl` request. No account, API key, email code, or claim link.

It works with Claude Code, Codex, Cursor, Gemini CLI, Hermes Agent, and any agent that reads `SKILL.md` files ([agentskills.io](https://agentskills.io) format).

- Website: https://deed.page
- Docs: https://deed.page/docs
- llms.txt: https://deed.page/llms.txt
- OpenAPI: https://deed.page/openapi.json
- MCP server: https://deed.page/mcp

The skill is one file: [`skills/deed-page/SKILL.md`](skills/deed-page/SKILL.md).

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

```bash
npx skills add f-o-x11/deed-page-skill -a codex -g
```

Or inside Codex: `$skill-installer install https://github.com/f-o-x11/deed-page-skill/tree/main/skills/deed-page`

### Cursor

```bash
npx skills add f-o-x11/deed-page-skill -a cursor
```

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

`?ref=skill-gh` tells deed.page that a publish came from this skill. It does not change what is published. Set `DEED_REF` to override it.

## License

MIT. Copyright (c) 2026 Avatar 8 LLC.

deed.page is operated by Avatar 8 LLC. Contact: ops@avatar33.com. Report abuse: https://deed.page/abuse.
