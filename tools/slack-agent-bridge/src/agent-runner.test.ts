import { describe, expect, it, vi } from "vitest";
import {
  formatAgentReply,
  isAgentRunSuccessful,
  isEmptyAgentSuccess,
  runCursorAgentWithRetry,
  type AgentRunResult,
} from "./agent-runner.js";
import type { BridgeConfig } from "./config.js";

function emptyOk(overrides: Partial<AgentRunResult> = {}): AgentRunResult {
  return {
    exitCode: 0,
    signal: null,
    stdout: "",
    stderr: "",
    timedOut: false,
    dryRun: false,
    ...overrides,
  };
}

const baseConfig = {
  dryRun: false,
  workspacePath: "C:\\tmp",
  cursorAgentBin: "agent",
  agentExtraArgs: [],
  agentTimeoutMs: 1000,
} as unknown as BridgeConfig;

describe("isEmptyAgentSuccess", () => {
  it("detects exit 0 with no output", () => {
    expect(isEmptyAgentSuccess(emptyOk())).toBe(true);
  });

  it("ignores real success output", () => {
    expect(isEmptyAgentSuccess(emptyOk({ stdout: "Done\n" }))).toBe(false);
  });

  it("ignores non-zero exits", () => {
    expect(isEmptyAgentSuccess(emptyOk({ exitCode: 1 }))).toBe(false);
  });
});

describe("isAgentRunSuccessful", () => {
  it("rejects empty exit-0", () => {
    expect(isAgentRunSuccessful(emptyOk({ emptySuccess: true }))).toBe(false);
    expect(isAgentRunSuccessful(emptyOk())).toBe(false);
  });

  it("accepts exit 0 with body", () => {
    expect(isAgentRunSuccessful(emptyOk({ stdout: "shipped" }))).toBe(true);
  });
});

describe("formatAgentReply", () => {
  it("marks success and includes stdout", () => {
    const text = formatAgentReply(
      emptyOk({ stdout: "All tests passed" }),
      3500
    );

    expect(text).toContain("Done");
    expect(text).toContain("All tests passed");
  });

  it("truncates long output", () => {
    const text = formatAgentReply(
      emptyOk({ stdout: "x".repeat(10_000) }),
      200
    );

    expect(text).toContain("truncated");
    expect(text.length).toBeLessThan(500);
  });

  it("treats empty exit-0 as failure", () => {
    const text = formatAgentReply(
      emptyOk({ emptySuccess: true, attempts: 2 }),
      3500
    );

    expect(text).toContain("Failed");
    expect(text).toContain("silent CLI failure");
    expect(text).toContain("Tried 2 times");
    expect(text).not.toContain("*Done*");
  });

  it("notes success on retry", () => {
    const text = formatAgentReply(
      emptyOk({ stdout: "fixed", attempts: 2 }),
      3500
    );

    expect(text).toContain("succeeded on retry");
  });

  it("includes log path when provided", () => {
    const text = formatAgentReply(
      emptyOk({ stdout: "ok" }),
      3500,
      "tools/slack-agent-bridge/logs/latest.log"
    );

    expect(text).toContain("tools/slack-agent-bridge/logs/latest.log");
  });
});

describe("runCursorAgentWithRetry", () => {
  it("retries once on empty exit-0 then succeeds", async () => {
    const onRetry = vi.fn();
    const spawnOnce = vi
      .fn()
      .mockResolvedValueOnce(emptyOk())
      .mockResolvedValueOnce(emptyOk({ stdout: "shipped" }));

    const result = await runCursorAgentWithRetry(
      baseConfig,
      "task",
      undefined,
      { onRetry },
      { spawnOnce }
    );

    expect(spawnOnce).toHaveBeenCalledTimes(2);
    expect(onRetry).toHaveBeenCalledTimes(1);
    expect(result.attempts).toBe(2);
    expect(result.stdout).toBe("shipped");
    expect(result.emptySuccess).toBe(false);
    expect(isAgentRunSuccessful(result)).toBe(true);
  });

  it("fails after empty exit-0 on both attempts", async () => {
    const onRetry = vi.fn();
    const spawnOnce = vi
      .fn()
      .mockResolvedValueOnce(emptyOk())
      .mockResolvedValueOnce(emptyOk());

    const result = await runCursorAgentWithRetry(
      baseConfig,
      "task",
      undefined,
      { onRetry },
      { spawnOnce }
    );

    expect(spawnOnce).toHaveBeenCalledTimes(2);
    expect(result.attempts).toBe(2);
    expect(result.emptySuccess).toBe(true);
    expect(isAgentRunSuccessful(result)).toBe(false);
  });

  it("does not retry when first attempt has output", async () => {
    const onRetry = vi.fn();
    const spawnOnce = vi
      .fn()
      .mockResolvedValueOnce(emptyOk({ stdout: "ok first try" }));

    const result = await runCursorAgentWithRetry(
      baseConfig,
      "task",
      undefined,
      { onRetry },
      { spawnOnce }
    );

    expect(spawnOnce).toHaveBeenCalledTimes(1);
    expect(onRetry).not.toHaveBeenCalled();
    expect(result.attempts).toBe(1);
  });
});
