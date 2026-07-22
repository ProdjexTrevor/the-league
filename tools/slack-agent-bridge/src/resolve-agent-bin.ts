import { existsSync, readdirSync } from "node:fs";
import path from "node:path";

export type AgentInvocation = {
  command: string;
  args: string[];
};

/** Resolve Cursor Agent CLI path (Windows often lacks `agent` on PATH for spawned processes). */
export function resolveAgentBin(configured = "agent"): string {
  const trimmed = configured.trim();
  if (!trimmed) return resolveAgentBin("agent");

  const looksLikePath =
    trimmed.includes(path.sep) ||
    trimmed.includes("/") ||
    trimmed.toLowerCase().endsWith(".cmd") ||
    trimmed.toLowerCase().endsWith(".exe");

  if (looksLikePath) {
    return trimmed;
  }

  if (process.platform === "win32") {
    const candidates = [
      path.join(process.env.LOCALAPPDATA ?? "", "cursor-agent", "agent.cmd"),
      path.join(process.env.USERPROFILE ?? "", ".cursor", "bin", "agent.exe"),
      path.join(process.env.USERPROFILE ?? "", ".local", "bin", "agent.exe"),
    ];

    for (const candidate of candidates) {
      if (candidate && existsSync(candidate)) {
        return candidate;
      }
    }
  }

  return trimmed;
}

/**
 * Avoid running Cursor's Windows `.cmd` shim through a shell. Shell parsing
 * corrupts multiline prompts and values containing quotes or metacharacters.
 */
export function resolveAgentInvocation(
  agentBin: string,
  args: string[]
): AgentInvocation {
  if (process.platform !== "win32" || !agentBin.toLowerCase().endsWith(".cmd")) {
    return { command: agentBin, args };
  }

  const installDir = path.dirname(agentBin);
  const versionsDir = path.join(installDir, "versions");

  if (existsSync(versionsDir)) {
    const versions = readdirSync(versionsDir, { withFileTypes: true })
      .filter(
        (entry) =>
          entry.isDirectory() &&
          /^\d{4}\.\d{1,2}\.\d{1,2}(?:-\d{2}-\d{2}-\d{2})?-[a-f0-9]+$/i.test(
            entry.name
          )
      )
      .map((entry) => entry.name)
      .sort()
      .reverse();

    for (const version of versions) {
      const versionDir = path.join(versionsDir, version);
      const nodeBin = path.join(versionDir, "node.exe");
      const entryPoint = path.join(versionDir, "index.js");
      if (existsSync(nodeBin) && existsSync(entryPoint)) {
        return { command: nodeBin, args: [entryPoint, ...args] };
      }
    }
  }

  // Cursor's installer normally includes versions/<version>/node.exe. Keep a
  // clear fallback for unusual installations rather than silently using a shell.
  const powershellScript = path.join(installDir, "cursor-agent.ps1");
  if (existsSync(powershellScript)) {
    return {
      command: "powershell.exe",
      args: [
        "-NoProfile",
        "-ExecutionPolicy",
        "Bypass",
        "-File",
        powershellScript,
        ...args,
      ],
    };
  }

  return { command: agentBin, args };
}
