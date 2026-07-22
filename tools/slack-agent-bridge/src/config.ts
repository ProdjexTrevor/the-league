import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { z } from "zod";
import { resolveAgentBin } from "./resolve-agent-bin.js";

const packageDir = path.dirname(fileURLToPath(import.meta.url));
/** Host repo root when this package lives at `<repo>/tools/slack-agent-bridge`. */
export const defaultWorkspacePath = path.resolve(packageDir, "..", "..", "..");

const boolFromEnv = z
  .string()
  .optional()
  .transform((value) => value === "true" || value === "1");

const configSchema = z.object({
  slackBotToken: z
    .string()
    .min(1, "SLACK_BOT_TOKEN is required")
    .transform((value) => value.trim())
    .refine((value) => value.startsWith("xoxb-"), {
      message: "SLACK_BOT_TOKEN must start with xoxb-",
    }),
  slackAppToken: z
    .string()
    .min(1, "SLACK_APP_TOKEN is required")
    .transform((value) => value.trim())
    .refine((value) => value.startsWith("xapp-"), {
      message: "SLACK_APP_TOKEN must start with xapp-",
    }),
  slackChannelIds: z
    .string()
    .min(1, "SLACK_CHANNEL_IDS is required (comma-separated C… ids)")
    .transform((value) =>
      value
        .split(",")
        .map((id) => id.trim())
        .filter(Boolean)
    )
    .refine((ids) => ids.every((id) => id.startsWith("C")), {
      message: "SLACK_CHANNEL_IDS must be public channel IDs (C…)",
    }),
  buildPrefix: z.string().default("build:"),
  statusPrefix: z.string().default("status:"),
  workspacePath: z.string().default(defaultWorkspacePath),
  cursorAgentBin: z.string().default("agent"),
  cursorApiKey: z.string().optional(),
  agentExtraArgs: z
    .string()
    .optional()
    .transform((value) => (value ? value.split(/\s+/).filter(Boolean) : [])),
  agentSystemPrompt: z
    .string()
    .default(
      "You are a coding agent working in this repository. Plan → build → test → push only if the task asks you to. Prefer the repo's existing conventions and branch workflow. After any push that triggers a deploy: NOT done until you confirm the deployment for that exact commit succeeded — poll until Ready or Error, fix and re-push on Error, and only report success with commit SHA, URL, and command output proving Ready. If you cannot verify, say pushed but unverified with reason; never guess success."
    ),
  dryRun: boolFromEnv.default("false"),
  agentTimeoutMs: z.coerce.number().int().positive().default(1_800_000),
  heartbeatIntervalMs: z.coerce.number().int().positive().default(900_000),
  maxSlackReplyChars: z.coerce.number().int().positive().default(3_500),
  logDir: z.string().optional().transform((value) => value?.trim() || undefined),
});

export type BridgeConfig = z.infer<typeof configSchema>;

export function loadConfig(env: NodeJS.ProcessEnv = process.env): BridgeConfig {
  const parsed = configSchema.parse({
    slackBotToken: env.SLACK_BOT_TOKEN,
    slackAppToken: env.SLACK_APP_TOKEN,
    slackChannelIds: env.SLACK_CHANNEL_IDS,
    buildPrefix: env.BUILD_PREFIX,
    statusPrefix: env.STATUS_PREFIX,
    workspacePath: env.WORKSPACE_PATH,
    cursorAgentBin: env.CURSOR_AGENT_BIN,
    cursorApiKey: env.CURSOR_API_KEY,
    agentExtraArgs: env.AGENT_EXTRA_ARGS,
    agentSystemPrompt: env.AGENT_SYSTEM_PROMPT,
    dryRun: env.DRY_RUN,
    agentTimeoutMs: env.AGENT_TIMEOUT_MS,
    heartbeatIntervalMs: env.HEARTBEAT_INTERVAL_MS,
    maxSlackReplyChars: env.MAX_SLACK_REPLY_CHARS,
    logDir: env.LOG_DIR,
  });

  if (!existsSync(parsed.workspacePath)) {
    throw new Error(`WORKSPACE_PATH does not exist: ${parsed.workspacePath}`);
  }

  return {
    ...parsed,
    cursorAgentBin: resolveAgentBin(parsed.cursorAgentBin),
  };
}
