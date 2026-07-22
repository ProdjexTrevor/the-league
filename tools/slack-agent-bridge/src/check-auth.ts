import dotenv from "dotenv";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { WebClient } from "@slack/web-api";

const dir = path.dirname(fileURLToPath(import.meta.url));
const envPath = path.resolve(dir, "../.env");
dotenv.config({ path: envPath });

const token = (process.env.SLACK_BOT_TOKEN ?? "").trim();
console.log("env file:", envPath);
console.log("token prefix:", token.slice(0, 12) + "…");
console.log("token length:", token.length);
console.log("hyphen parts:", token.split("-").length);
console.log("has whitespace:", /\s/.test(token));

const client = new WebClient(token);
try {
  const result = await client.auth.test();
  console.log("auth OK as", result.user, "on", result.team);
} catch (error) {
  const err = error as { data?: { error?: string }; message?: string };
  console.log("auth FAIL:", err.data?.error ?? err.message);
}
