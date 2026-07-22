import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  resolveAgentBin,
  resolveAgentInvocation,
} from "./resolve-agent-bin.js";

describe("resolveAgentBin", () => {
  it("returns explicit path when provided", () => {
    expect(resolveAgentBin("C:\\tools\\agent.cmd")).toBe("C:\\tools\\agent.cmd");
  });

  it("falls back to agent when no local install is found", () => {
    expect(resolveAgentBin("agent")).toMatch(/agent(\.cmd|\.exe)?$/i);
  });

  it("bypasses the Windows cmd shim so multiline prompts stay intact", () => {
    const installDir = mkdtempSync(path.join(tmpdir(), "cursor-agent-"));
    const versionDir = path.join(
      installDir,
      "versions",
      "2026.07.09-a3815c0"
    );
    mkdirSync(versionDir, { recursive: true });
    writeFileSync(path.join(versionDir, "node.exe"), "");
    writeFileSync(path.join(versionDir, "index.js"), "");

    try {
      const prompt = 'line one\nsay "Ready" & keep <reason>';
      const invocation = resolveAgentInvocation(
        path.join(installDir, "agent.cmd"),
        ["-p", prompt]
      );

      if (process.platform === "win32") {
        expect(invocation.command).toBe(path.join(versionDir, "node.exe"));
        expect(invocation.args).toEqual([
          path.join(versionDir, "index.js"),
          "-p",
          prompt,
        ]);
      }
    } finally {
      rmSync(installDir, { recursive: true, force: true });
    }
  });
});
