# CURSOR INSTALL — Slack Agent Bridge

> **For Cursor (and humans):** You are installing a portable Slack → local Cursor Agent CLI bridge into this host repository.
> Read this file first. Follow the steps in order. Do not invent alternate layouts.

## What this is

- Local process on the developer's machine (not Cursor Cloud Agents).
- Slack `build:` messages spawn `agent -p --force --trust --workspace <host-repo>`.
- One workspace per running bridge process (multi-project routing is a future feature).

## Expected layout after install

```text
<host-repo>/
  tools/
    slack-agent-bridge/     ← this package (already dropped here)
      CURSOR_INSTALL.md     ← you are here
      README.md
      package.json
      .env.example
      src/
  package.json              ← host (optional script)
  tsconfig.json             ← host (must exclude tools)
```

If this folder was dropped at the repo root as `slack-agent-bridge/`, **move it** to `tools/slack-agent-bridge/` before continuing (keeps default `WORKSPACE_PATH` correct).

---

## Agent checklist (do all of these)

### 1) Confirm location

- [ ] Package path is `<host-repo>/tools/slack-agent-bridge`
- [ ] Host repo root is the parent of `tools/`

### 2) Host TypeScript / bundler hygiene (required)

Edit the **host** `tsconfig.json` so the bridge is never typechecked by the app build:

```json
"exclude": ["node_modules", "tools"]
```

If `exclude` already exists, **merge** `"tools"` into it — do not remove existing entries.

For Next.js / Vite monorepos, also ensure CI and Vercel builds do not compile `tools/**`.

### 3) Optional host npm script

In the **host** `package.json` `scripts`:

```json
"slack:bridge": "npm --prefix tools/slack-agent-bridge run start",
"slack:bridge:dev": "npm --prefix tools/slack-agent-bridge run dev"
```

### 4) Install dependencies

From this package directory:

```powershell
cd tools/slack-agent-bridge
npm install
```

### 5) Create `.env` from example

```powershell
copy .env.example .env
```

Fill required values (ask the human if missing — **never invent tokens**):

| Variable | Required | Notes |
|----------|----------|-------|
| `SLACK_BOT_TOKEN` | Yes | Starts with `xoxb-` |
| `SLACK_APP_TOKEN` | Yes | Starts with `xapp-` |
| `SLACK_CHANNEL_IDS` | Yes | Public channel ID(s) `C…`, comma-separated |
| `WORKSPACE_PATH` | Strongly recommended | Absolute path to **host repo root** |
| `AGENT_SYSTEM_PROMPT` | Recommended | Project-specific rules (see below) |
| `DRY_RUN` | Optional | Set `true` for first Slack smoke test |

**Do not commit `.env`.** It is gitignored.

### 6) Customize `AGENT_SYSTEM_PROMPT`

Replace the example with this host project's conventions. Minimum guidance:

1. Follow host `AGENTS.md` / `.cursor/rules` if present.
2. Plan → build → test.
3. Push only when the Slack task asks (or host workflow says so).
4. If the host deploys to Vercel: after push, verify **that commit's** deployment is Ready (`npx vercel ls` / `inspect`). Never claim Ready without proof.

If the host has `.cursor/rules/deploy-verify.mdc` or `workflow.mdc`, mirror those rules in the prompt.

### 7) One-time machine prerequisites (ask human if missing)

**Cursor Agent CLI (Windows):**

```powershell
irm 'https://cursor.com/install?win32=true' | iex
& "$env:LOCALAPPDATA\cursor-agent\agent.cmd" login
& "$env:LOCALAPPDATA\cursor-agent\agent.cmd" status
```

**Slack app** (reuse an existing Local Agent Bridge app if they already have one):

1. [api.slack.com/apps](https://api.slack.com/apps) → Create app (or reuse)
2. Socket Mode ON → App-Level Token `connections:write` → `xapp-…`
3. Bot scopes: `channels:history`, `channels:read`, `channels:join`, `chat:write`, `reactions:write`
4. Event Subscriptions → `message.channels`
5. Install to workspace → `xoxb-…`
6. Add bot to channel via **Integrations → Add apps** (not `/invite`)
7. Paste channel ID into `SLACK_CHANNEL_IDS`

### 8) Smoke test

```powershell
cd tools/slack-agent-bridge
# Optional first: DRY_RUN=true in .env
npm start
```

Expect:

```text
Socket Mode connected — waiting for build: / status: messages…
```

In Slack (allowed channel):

```text
status:
build: say hello from the bridge
```

Then set `DRY_RUN=false`, restart, and use real tasks.

### 9) Acceptance checks (stop when all pass)

- [ ] `npm install` succeeded in `tools/slack-agent-bridge`
- [ ] Host `tsconfig.json` excludes `tools`
- [ ] `.env` exists with real tokens (or human confirmed placeholders are intentional)
- [ ] `WORKSPACE_PATH` points at host repo root
- [ ] `npm start` connects Socket Mode without auth errors
- [ ] Slack `status:` gets a reply
- [ ] Slack `build:` (dry run or real) posts a thread reply

---

## Do / Don't

**Do**

- Keep one `npm start` running (extra copies fight over Socket Mode).
- Use a dedicated build channel; keep `SLACK_CHANNEL_IDS` tight.
- Put project rules in `AGENT_SYSTEM_PROMPT`.

**Don't**

- Copy `.env`, `node_modules/`, or `logs/` between projects.
- Paste Slack tokens into chat or commit them.
- Point `WORKSPACE_PATH` at this package folder — it must be the **host repo root**.
- Run two bridges with the same Slack app tokens unless you know what you're doing.

---

## Slack commands (after install)

| Message | Effect |
|---------|--------|
| `build: <task>` | Queue/run Cursor Agent on `WORKSPACE_PATH` |
| `build : <task>` | Same (typo accepted) |
| `status:` / `status` | Idle / working / queued |
| (while building) | Heartbeat every 15 min in thread |

---

## Packaging note

To refresh a distributable zip from a machine that already has this package:

```powershell
cd tools\slack-agent-bridge
powershell -ExecutionPolicy Bypass -File .\pack.ps1
```

That writes `slack-agent-bridge-portable.zip` next to this folder (no `.env`, `node_modules`, or `logs`).

---

## When install is blocked

| Blocker | What to tell the human |
|---------|------------------------|
| No Slack tokens | Need `xoxb-` + `xapp-` + channel `C…` |
| `agent` not found | Install Cursor CLI + `agent login` |
| Host is not a git repo | Still OK — set `WORKSPACE_PATH` explicitly |
| Private Slack channel | Add app via Integrations; `channels:join` may not work |

If you cannot complete a step without secrets, finish everything else, leave `.env.example` copied to `.env` with placeholders, and list exactly which values the human must paste.
