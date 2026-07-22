import { spawn } from "node:child_process";
import type { BridgeConfig } from "./config.js";
import { resolveAgentInvocation } from "./resolve-agent-bin.js";
import type { RunLogger } from "./run-logger.js";

export type AgentRunResult = {
  exitCode: number | null;
  signal: NodeJS.Signals | null;
  stdout: string;
  stderr: string;
  timedOut: boolean;
  dryRun: boolean;
  /** True when exit 0 but stdout/stderr were empty (CLI silent failure). */
  emptySuccess?: boolean;
  /** How many attempts were used (1 = first try, 2 = after one retry). */
  attempts?: number;
};

/** Cursor CLI sometimes exits 0 with no output and no file changes. */
export function isEmptyAgentSuccess(result: AgentRunResult): boolean {
  if (result.dryRun || result.timedOut) return false;
  if (result.exitCode !== 0) return false;
  return !result.stdout.trim() && !result.stderr.trim();
}

export function isAgentRunSuccessful(result: AgentRunResult): boolean {
  if (result.timedOut) return false;
  if (result.emptySuccess || isEmptyAgentSuccess(result)) return false;
  return result.exitCode === 0;
}

async function spawnCursorAgent(
  config: BridgeConfig,
  prompt: string,
  runLogger?: RunLogger
): Promise<AgentRunResult> {
  const args = [
    "-p",
    "--force",
    "--trust",
    "--workspace",
    config.workspacePath,
    ...config.agentExtraArgs,
    prompt,
  ];

  const env = { ...process.env };
  if (config.cursorApiKey) {
    env.CURSOR_API_KEY = config.cursorApiKey;
  }

  const invocation = resolveAgentInvocation(config.cursorAgentBin, args);

  return new Promise((resolve) => {
    const child = spawn(invocation.command, invocation.args, {
      cwd: config.workspacePath,
      env,
      shell: false,
      stdio: ["ignore", "pipe", "pipe"],
    });

    let stdout = "";
    let stderr = "";
    let timedOut = false;

    const timeout = setTimeout(() => {
      timedOut = true;
      child.kill("SIGTERM");
    }, config.agentTimeoutMs);

    child.stdout?.on("data", (chunk: Buffer) => {
      const text = chunk.toString();
      stdout += text;
      runLogger?.appendStream(text, "stdout");
    });
    child.stderr?.on("data", (chunk: Buffer) => {
      const text = chunk.toString();
      stderr += text;
      runLogger?.appendStream(text, "stderr");
    });

    child.on("close", (exitCode, signal) => {
      clearTimeout(timeout);
      const result: AgentRunResult = {
        exitCode,
        signal,
        stdout,
        stderr,
        timedOut,
        dryRun: false,
      };
      result.emptySuccess = isEmptyAgentSuccess(result);
      resolve(result);
    });

    child.on("error", (error) => {
      clearTimeout(timeout);
      resolve({
        exitCode: 1,
        signal: null,
        stdout,
        stderr: `${stderr}\n${error.message}`.trim(),
        timedOut,
        dryRun: false,
      });
    });
  });
}

export async function runCursorAgent(
  config: BridgeConfig,
  prompt: string,
  runLogger?: RunLogger
): Promise<AgentRunResult> {
  runLogger?.appendSection("Prompt", prompt);

  if (config.dryRun) {
    const stdout = `[DRY_RUN] Would run agent in ${config.workspacePath}\n\nPrompt:\n${prompt}`;
    runLogger?.appendSection("STDOUT", stdout);
    return {
      exitCode: 0,
      signal: null,
      stdout,
      stderr: "",
      timedOut: false,
      dryRun: true,
      attempts: 1,
    };
  }

  const result = await spawnCursorAgent(config, prompt, runLogger);
  return { ...result, attempts: 1 };
}

export type AgentRetryHooks = {
  onRetry?: (attempt: number, previous: AgentRunResult) => void | Promise<void>;
};

export type AgentRunnerDeps = {
  /** Test seam — defaults to real Cursor CLI spawn. */
  spawnOnce?: (
    config: BridgeConfig,
    prompt: string,
    runLogger?: RunLogger
  ) => Promise<AgentRunResult>;
};

/**
 * Runs the agent once; if it exits 0 with empty output, retries once.
 * Empty success after retry is still marked failed via emptySuccess.
 */
export async function runCursorAgentWithRetry(
  config: BridgeConfig,
  prompt: string,
  runLogger?: RunLogger,
  hooks?: AgentRetryHooks,
  deps?: AgentRunnerDeps
): Promise<AgentRunResult> {
  runLogger?.appendSection("Prompt", prompt);

  if (config.dryRun) {
    const stdout = `[DRY_RUN] Would run agent in ${config.workspacePath}\n\nPrompt:\n${prompt}`;
    runLogger?.appendSection("STDOUT", stdout);
    return {
      exitCode: 0,
      signal: null,
      stdout,
      stderr: "",
      timedOut: false,
      dryRun: true,
      attempts: 1,
    };
  }

  const spawnOnce = deps?.spawnOnce ?? spawnCursorAgent;
  const first = await spawnOnce(config, prompt, runLogger);
  if (!isEmptyAgentSuccess(first)) {
    return { ...first, attempts: 1 };
  }

  runLogger?.appendSection(
    "Retry",
    "First attempt exited 0 with empty stdout/stderr — retrying once."
  );
  await hooks?.onRetry?.(2, first);

  const second = await spawnOnce(config, prompt, runLogger);
  return {
    ...second,
    attempts: 2,
    emptySuccess: isEmptyAgentSuccess(second),
  };
}

export function formatAgentReply(
  result: AgentRunResult,
  maxChars: number,
  logPath?: string
): string {
  const parts: string[] = [];
  const body = (result.stdout || result.stderr || "(no output)").trim();
  const empty =
    result.emptySuccess === true || isEmptyAgentSuccess(result);

  if (result.dryRun) {
    parts.push("*Dry run* — agent was not invoked.");
  } else if (result.timedOut) {
    parts.push("*Timed out* — agent process was stopped.");
  } else if (empty) {
    const tried =
      (result.attempts ?? 1) > 1
        ? ` Tried ${result.attempts} times.`
        : "";
    parts.push(
      `*Failed* — agent exited 0 with no output (silent CLI failure).${tried} Re-send the build message.`
    );
  } else if (result.exitCode === 0) {
    const retryNote =
      (result.attempts ?? 1) > 1 ? " (succeeded on retry)" : "";
    parts.push(`*Done* — agent exited successfully.${retryNote}`);
  } else if (body.includes("Authentication required")) {
    parts.push(
      "*Failed* — Cursor Agent not authenticated. Run `agent login` or set `CURSOR_API_KEY` in `.env`, then restart the bridge."
    );
  } else {
    parts.push(`*Failed* — exit code ${result.exitCode ?? "unknown"}.`);
  }

  const header = parts.join("\n");
  const budget = Math.max(0, maxChars - header.length - 8);
  const clipped =
    body.length > budget ? `${body.slice(0, budget)}\n\n…(truncated)` : body;

  const logLine = logPath ? `\n\n_Full log:_ \`${logPath}\`` : "";
  return `${header}\n\n\`\`\`\n${clipped}\n\`\`\`${logLine}`;
}
