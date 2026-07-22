import { appendFileSync, copyFileSync, mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { AgentRunResult } from "./agent-runner.js";

const packageDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
export const defaultLogDir = path.join(packageDir, "logs");

export type RunLogMeta = {
  runId: string;
  startedAt: string;
  channel: string;
  threadTs: string;
  messageTs: string;
  slackUser: string;
  task: string;
  workspacePath: string;
  dryRun: boolean;
};

export type RunLogFinalize = AgentRunResult & {
  error?: string;
  finishedAt: string;
};

function formatTimestamp(date = new Date()): string {
  return date.toISOString().replace(/[:.]/g, "-");
}

function makeRunId(date = new Date()): string {
  return `${formatTimestamp(date)}`;
}

export function resolveLogDir(logDir?: string): string {
  return logDir?.trim() ? path.resolve(logDir) : defaultLogDir;
}

export class RunLogger {
  readonly runId: string;
  readonly filePath: string;
  readonly relativePath: string;

  private readonly indexPath: string;
  private readonly latestPath: string;

  constructor(
    private readonly meta: RunLogMeta,
    logDir = defaultLogDir
  ) {
    mkdirSync(logDir, { recursive: true });
    this.runId = meta.runId;
    this.filePath = path.join(logDir, `${meta.runId}.log`);
    this.relativePath = path.relative(meta.workspacePath, this.filePath);
    this.indexPath = path.join(logDir, "index.jsonl");
    this.latestPath = path.join(logDir, "latest.log");

    this.writeHeader();
  }

  static start(input: {
    channel: string;
    threadTs: string;
    messageTs: string;
    slackUser: string;
    task: string;
    workspacePath: string;
    dryRun: boolean;
    logDir?: string;
  }): RunLogger {
    const startedAt = new Date().toISOString();
    const runId = makeRunId(new Date(startedAt));
    const logDir = resolveLogDir(input.logDir);

    return new RunLogger(
      {
        runId,
        startedAt,
        channel: input.channel,
        threadTs: input.threadTs,
        messageTs: input.messageTs,
        slackUser: input.slackUser,
        task: input.task,
        workspacePath: input.workspacePath,
        dryRun: input.dryRun,
      },
      logDir
    );
  }

  appendSection(title: string, body: string): void {
    const section = `\n\n## ${title}\n\n${body.trim()}\n`;
    appendFileSync(this.filePath, section, "utf8");
  }

  appendStream(chunk: string, stream: "stdout" | "stderr"): void {
    if (!this.streamMarkers[stream]) {
      this.streamMarkers[stream] = true;
      appendFileSync(this.filePath, `\n\n## ${stream.toUpperCase()}\n\n`, "utf8");
    }
    appendFileSync(this.filePath, chunk, "utf8");
  }

  private streamMarkers: Record<string, boolean> = {};

  finalize(result: RunLogFinalize): void {
    this.appendSection("Result", [
      `finished_at: ${result.finishedAt}`,
      `exit_code: ${result.exitCode ?? "null"}`,
      `signal: ${result.signal ?? "null"}`,
      `timed_out: ${result.timedOut}`,
      `dry_run: ${result.dryRun}`,
      result.error ? `error: ${result.error}` : null,
    ]
      .filter(Boolean)
      .join("\n"));

    const indexEntry = {
      runId: this.meta.runId,
      logFile: this.relativePath.replace(/\\/g, "/"),
      startedAt: this.meta.startedAt,
      finishedAt: result.finishedAt,
      task: this.meta.task,
      slackUser: this.meta.slackUser,
      channel: this.meta.channel,
      threadTs: this.meta.threadTs,
      exitCode: result.exitCode,
      timedOut: result.timedOut,
      dryRun: result.dryRun,
      error: result.error ?? null,
    };

    appendFileSync(this.indexPath, `${JSON.stringify(indexEntry)}\n`, "utf8");
    copyFileSync(this.filePath, this.latestPath);
  }

  private writeHeader(): void {
    const header = [
      "# Slack Agent Run",
      "",
      `run_id: ${this.meta.runId}`,
      `started_at: ${this.meta.startedAt}`,
      `slack_user: ${this.meta.slackUser}`,
      `channel: ${this.meta.channel}`,
      `thread_ts: ${this.meta.threadTs}`,
      `message_ts: ${this.meta.messageTs}`,
      `workspace: ${this.meta.workspacePath}`,
      `dry_run: ${this.meta.dryRun}`,
      "",
      "## Task",
      "",
      this.meta.task,
    ].join("\n");

    writeFileSync(this.filePath, `${header}\n`, "utf8");
  }
}

export function formatLogPathForSlack(relativePath: string): string {
  return relativePath.replace(/\\/g, "/");
}
