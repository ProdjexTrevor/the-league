import { describe, expect, it } from "vitest";
import {
  buildAgentPrompt,
  parseBuildMessage,
  parseCommand,
} from "./parse-build-message.js";

describe("parseBuildMessage", () => {
  it("returns task when prefix matches", () => {
    expect(parseBuildMessage("build: fix native schedule", "build:")).toBe(
      "fix native schedule"
    );
  });

  it("is case-insensitive on prefix", () => {
    expect(parseBuildMessage("BUILD: App Agent task", "build:")).toBe(
      "App Agent task"
    );
  });

  it("accepts whitespace before the colon", () => {
    expect(parseBuildMessage("build : diagnose staging", "build:")).toBe(
      "diagnose staging"
    );
  });

  it("accepts multi-paragraph task bodies", () => {
    const text = [
      "build: I want a calendar view",
      "",
      "Bonus if drag and drop is easy.",
      "",
      "Planning for athlete times later.",
    ].join("\n");
    expect(parseBuildMessage(text, "build:")).toContain("calendar view");
    expect(parseBuildMessage(text, "build:")).toContain("drag and drop");
  });

  it("returns null when prefix missing", () => {
    expect(parseBuildMessage("hello world", "build:")).toBeNull();
  });

  it("returns null for empty task after prefix", () => {
    expect(parseBuildMessage("build:", "build:")).toBeNull();
    expect(parseBuildMessage("build:   ", "build:")).toBeNull();
  });
});

describe("parseCommand", () => {
  it("recognizes an empty status command", () => {
    expect(parseCommand("Status:", "status:")).toBe("");
    expect(parseCommand("status :", "status:")).toBe("");
    expect(parseCommand("status", "status:")).toBe("");
  });

  it("does not match unrelated messages", () => {
    expect(parseCommand("what is the status?", "status:")).toBeNull();
  });
});

describe("buildAgentPrompt", () => {
  it("wraps task with system prompt", () => {
    const prompt = buildAgentPrompt("Follow AGENTS.md", "ship feature X");
    expect(prompt).toContain("Follow AGENTS.md");
    expect(prompt).toContain("Task from Slack:");
    expect(prompt).toContain("ship feature X");
  });
});
