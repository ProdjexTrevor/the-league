import { describe, expect, it } from "vitest";
import { extractSlackMessageText } from "./slack-text.js";

describe("extractSlackMessageText", () => {
  it("uses the text field when present", () => {
    expect(extractSlackMessageText({ text: "build: hello" })).toBe("build: hello");
  });

  it("falls back to rich_text blocks", () => {
    const text = extractSlackMessageText({
      blocks: [
        {
          type: "rich_text",
          elements: [
            {
              type: "rich_text_section",
              elements: [{ type: "text", text: "build: from blocks" }],
            },
          ],
        },
      ],
    });
    expect(text).toBe("build: from blocks");
  });

  it("returns null when empty", () => {
    expect(extractSlackMessageText({})).toBeNull();
  });
});
