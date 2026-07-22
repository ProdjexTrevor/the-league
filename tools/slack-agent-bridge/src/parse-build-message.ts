/**
 * Strip the build prefix and return the agent task text, or null if not a build message.
 */
export function parseBuildMessage(text: string | undefined, prefix: string): string | null {
  return parseCommand(text, prefix, true);
}

/** Accepts both `build:` and the common typo `build :`. */
export function parseCommand(
  text: string | undefined,
  prefix: string,
  requireBody = false
): string | null {
  if (!text?.trim()) return null;

  const command = prefix.trim().replace(/:\s*$/, "");
  const escaped = command.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  // Match "status", "status:", "status :", "Status: anything"
  // Use [\s\S] so multi-paragraph Slack tasks still match (`.` does not span newlines).
  const match = text
    .trim()
    .match(new RegExp(`^${escaped}(?:\\s*:\\s*([\\s\\S]*))?$`, "i"));
  if (!match) return null;

  const body = (match[1] ?? "").trim();
  if (requireBody && !body) return null;
  return body;
}

export function buildAgentPrompt(systemPrompt: string, task: string): string {
  const system = systemPrompt.trim();
  if (!system) return task;
  return `${system}\n\nTask from Slack:\n${task}`;
}
