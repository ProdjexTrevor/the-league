# Slack Agent Bridge

**Portable** local bridge: Slack `build:` → Cursor Agent CLI on **your machine**.

Not Cursor Cloud Agents. Your PC must be on and running this process.

---

## Drop into a new project (Cursor)

1. Copy / unzip this folder to:

   ```text
   <your-repo>/tools/slack-agent-bridge/
   ```

2. Open that repo in Cursor and say:

   ```text
   Install the Slack agent bridge using tools/slack-agent-bridge/CURSOR_INSTALL.md
   ```

3. Cursor should follow **[CURSOR_INSTALL.md](./CURSOR_INSTALL.md)** end-to-end (host `tsconfig` exclude, `npm install`, `.env`, smoke test).

Humans can also follow that file manually.

### Make a clean zip from this machine

```powershell
cd tools\slack-agent-bridge
powershell -ExecutionPolicy Bypass -File .\pack.ps1
```

Creates `tools/slack-agent-bridge-portable-<timestamp>.zip` (no `.env`, `node_modules`, or `logs`).

---

## Quick start (manual)

```powershell
# After folder is at tools/slack-agent-bridge
cd tools\slack-agent-bridge
npm install
copy .env.example .env
# Edit .env: tokens, channel ID, WORKSPACE_PATH, AGENT_SYSTEM_PROMPT
npm start
```

Expect:

```text
Socket Mode connected — waiting for build: / status: messages…
```

In Slack:

```text
status:
build: say hello from the bridge
```

---

## One-time setup (per machine + Slack workspace)

Reuse the same Slack app/tokens across projects; only change `WORKSPACE_PATH` / prompt per repo.

**Cursor CLI (Windows):**

```powershell
irm 'https://cursor.com/install?win32=true' | iex
& "$env:LOCALAPPDATA\cursor-agent\agent.cmd" login
& "$env:LOCALAPPDATA\cursor-agent\agent.cmd" status
```

**Slack app** ([api.slack.com/apps](https://api.slack.com/apps)):

1. Create app → enable **Socket Mode** → App-Level Token (`connections:write`) → `xapp-…`
2. **OAuth & Permissions** → scopes: `channels:history`, `channels:read`, `channels:join`, `chat:write`, `reactions:write`
3. **Event Subscriptions** → `message.channels`
4. Install to workspace → `xoxb-…`
5. Add bot to channel via **Integrations → Add apps** (not `/invite`)
6. Copy channel ID (`C…`) into `SLACK_CHANNEL_IDS`

---

## Commands in Slack

| You send | Bot does |
|----------|----------|
| `build: <task>` | Starts local agent on `WORKSPACE_PATH` (multi-line OK) |
| `build : <task>` | Same (`build :` typo accepted) |
| `status:` or `status` | Replies: working / queued / idle |
| *(while building)* | Auto “still working” every 15 min in thread |

One build at a time; extras queue.

---

## Host repo wiring

```json
// host tsconfig.json
"exclude": ["node_modules", "tools"]
```

```json
// host package.json scripts (optional)
"slack:bridge": "npm --prefix tools/slack-agent-bridge run start",
"slack:bridge:dev": "npm --prefix tools/slack-agent-bridge run dev"
```

---

## How it works

```text
Slack channel  (#builds)
      │  message starts with "build:"
      ▼
This package (Socket Mode on your PC)
      │  agent -p --force --trust --workspace <WORKSPACE_PATH>
      ▼
Cursor Agent CLI (local files)
      │
      ▼
Reply in Slack thread + write logs/
```

---

## Environment variables

| Variable | Default | Description |
|----------|---------|-------------|
| `SLACK_BOT_TOKEN` | — | Bot `xoxb-…` |
| `SLACK_APP_TOKEN` | — | App-level `xapp-…` |
| `SLACK_CHANNEL_IDS` | — | Comma-separated `C…` IDs |
| `BUILD_PREFIX` | `build:` | Trigger prefix |
| `STATUS_PREFIX` | `status:` | Status-check prefix |
| `WORKSPACE_PATH` | Parent of `tools/` | Repo the agent edits |
| `CURSOR_AGENT_BIN` | `agent` | Auto-finds Windows `agent.cmd` |
| `CURSOR_API_KEY` | — | Optional auth |
| `AGENT_EXTRA_ARGS` | — | Extra CLI flags |
| `AGENT_SYSTEM_PROMPT` | Generic | Prepended to every task |
| `DRY_RUN` | `false` | Skip agent invocation |
| `AGENT_TIMEOUT_MS` | `1800000` | 30 minutes |
| `HEARTBEAT_INTERVAL_MS` | `900000` | Still-working update every 15 minutes |
| `MAX_SLACK_REPLY_CHARS` | `3500` | Slack reply cap |
| `LOG_DIR` | `./logs` | Override log directory |

See `.env.example` for a full template.

---

## Scripts

```powershell
npm start          # run bridge
npm run dev        # watch mode
npm run check-auth # test Slack bot token
npm run join-channel
npm test
npm run typecheck
```

---

## Security

- Never paste tokens into Slack or chat.
- Use a dedicated build channel; keep `SLACK_CHANNEL_IDS` tight.
- Agent runs with `--force` (applies file changes). Review before merge.
- This is **local** execution; Cursor API is only used for the model, not a cloud workspace.

---

## Troubleshooting

| Issue | Fix |
|-------|------|
| `agent` not found | Install Cursor CLI; restart terminal; or set full path in `CURSOR_AGENT_BIN` |
| Authentication required | `agent login` or `CURSOR_API_KEY` in `.env` |
| `invalid_auth` (Slack) | Re-copy bot token; reinstall app after scope changes |
| No Slack replies | Bridge running? Only **one** `npm start`? Bot in channel? Correct `C…` ID? |
| `status:` ignored | Old bridge still running — kill extra processes, restart once |
| Multi-line `build:` ignored | Update to latest bridge code (parser fix) |
| *Done* with empty output / no code changes | Silent Cursor CLI exit-0 — bridge treats this as **Failed** and **retries once**; if still empty, re-send `build:` |
| Host Next.js / Vercel fails on `dotenv` | Exclude `tools` from root `tsconfig.json` |
| PowerShell: Unexpected token `status` | Use `& "$env:LOCALAPPDATA\cursor-agent\agent.cmd" status` |

---

## What to copy checklist

- [ ] Entire `src/` folder
- [ ] `package.json`, `package-lock.json` (optional), `tsconfig.json`
- [ ] `.env.example` (create `.env` in the new project — never copy secrets)
- [ ] `.gitignore`, `README.md`, `CURSOR_INSTALL.md`, `pack.ps1`
- [ ] Host `tsconfig` excludes `tools`
- [ ] `npm install` inside this folder
- [ ] Cursor CLI installed + logged in
- [ ] Slack app configured + bot in channel
