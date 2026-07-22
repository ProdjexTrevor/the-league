import { spawn } from "node:child_process";
import type { BridgeConfig } from "./config.js";
import { resolveAgentInvocation } from "./resolve-agent-bin.js";

export async function verifyAgentAuth(config: BridgeConfig): Promise<void> {
  if (config.dryRun) {
    console.log("  Agent auth: skipped (DRY_RUN=true)");
    return;
  }

  if (config.cursorApiKey) {
    console.log("  Agent auth: CURSOR_API_KEY set");
    return;
  }

  const result = await new Promise<{ ok: boolean; output: string }>((resolve) => {
    const invocation = resolveAgentInvocation(config.cursorAgentBin, ["status"]);
    const child = spawn(invocation.command, invocation.args, {
      shell: false,
      env: { ...process.env },
      stdio: ["ignore", "pipe", "pipe"],
    });

    let output = "";
    child.stdout?.on("data", (chunk: Buffer) => {
      output += chunk.toString();
    });
    child.stderr?.on("data", (chunk: Buffer) => {
      output += chunk.toString();
    });
    child.on("close", (code) => {
      resolve({ ok: code === 0, output: output.trim() });
    });
    child.on("error", (error) => {
      resolve({ ok: false, output: error.message });
    });
  });

  if (result.ok) {
    console.log("  Agent auth: logged in");
    return;
  }

  throw new Error(
    [
      "Cursor Agent is not authenticated for headless runs.",
      "Fix one of these, then restart the bridge:",
      "  1. In a terminal: agent login",
      "  2. Or set CURSOR_API_KEY in this package's .env",
      result.output ? `\nagent status:\n${result.output}` : "",
    ]
      .filter(Boolean)
      .join("\n")
  );
}
