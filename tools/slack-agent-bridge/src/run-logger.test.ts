import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { RunLogger } from "./run-logger.js";

describe("RunLogger", () => {
  it("writes a per-run log and index entry", () => {
    const logDir = mkdtempSync(path.join(tmpdir(), "slack-bridge-logs-"));

    try {
      const logger = RunLogger.start({
        channel: "C123",
        threadTs: "111.222",
        messageTs: "111.222",
        slackUser: "U123",
        task: "say hello",
        workspacePath: "c:\\Repos\\the-grind-pass-starter",
        dryRun: true,
        logDir,
      });

      logger.appendSection("Prompt", "Follow AGENTS.md\n\nTask: say hello");
      logger.finalize({
        exitCode: 0,
        signal: null,
        stdout: "ok",
        stderr: "",
        timedOut: false,
        dryRun: true,
        finishedAt: new Date().toISOString(),
      });

      const logText = readFileSync(logger.filePath, "utf8");
      expect(logText).toContain("say hello");
      expect(logText).toContain("## Prompt");
      expect(logText).toContain("## Result");

      const index = readFileSync(path.join(logDir, "index.jsonl"), "utf8");
      expect(index).toContain('"task":"say hello"');
      expect(readFileSync(path.join(logDir, "latest.log"), "utf8")).toContain("say hello");
    } finally {
      rmSync(logDir, { recursive: true, force: true });
    }
  });
});
