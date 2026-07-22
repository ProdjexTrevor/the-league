/** Pull plain text from a Slack message event (text field or blocks fallback). */
export function extractSlackMessageText(event: {
  text?: string;
  blocks?: unknown[];
}): string | null {
  const direct = event.text?.trim();
  if (direct) return direct;

  if (!Array.isArray(event.blocks)) return null;

  const parts: string[] = [];
  for (const block of event.blocks) {
    if (!block || typeof block !== "object") continue;
    const b = block as {
      type?: string;
      text?: { text?: string };
      elements?: Array<{ type?: string; text?: string; elements?: Array<{ text?: string }> }>;
    };

    if (b.text?.text) {
      parts.push(b.text.text);
      continue;
    }

    if (b.type === "rich_text" && Array.isArray(b.elements)) {
      for (const section of b.elements) {
        if (!Array.isArray(section.elements)) continue;
        for (const el of section.elements) {
          if (typeof el.text === "string") parts.push(el.text);
        }
      }
    }
  }

  const joined = parts.join("").trim();
  return joined.length > 0 ? joined : null;
}
