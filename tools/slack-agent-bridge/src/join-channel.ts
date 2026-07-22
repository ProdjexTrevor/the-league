import dotenv from "dotenv";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { loadConfig } from "./config.js";
import { ensureBotInChannels, verifySlackAuth } from "./verify-slack.js";

const packageDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
dotenv.config({ path: path.join(packageDir, ".env") });

const config = loadConfig();
await verifySlackAuth(config);
await ensureBotInChannels(config);
console.log("Done — bot should be in your build channel(s).");
