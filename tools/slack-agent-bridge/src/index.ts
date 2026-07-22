import dotenv from "dotenv";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { loadConfig } from "./config.js";
import { createSlackBridge } from "./slack-bot.js";
import { verifySlackAuth, ensureBotInChannels } from "./verify-slack.js";
import { verifyAgentAuth } from "./verify-agent.js";

const packageDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
dotenv.config({ path: path.join(packageDir, ".env") });

async function main() {
  const config = loadConfig();

  console.log("Slack Agent Bridge");
  console.log(`  Workspace: ${config.workspacePath}`);
  console.log(`  Channels:  ${config.slackChannelIds.join(", ")}`);
  console.log(`  Build:     ${config.buildPrefix}`);
  console.log(`  Status:    ${config.statusPrefix}`);
  console.log(`  Updates:   every ${Math.round(config.heartbeatIntervalMs / 60_000)} minutes`);
  console.log(`  Dry run:   ${config.dryRun}`);
  console.log(`  Agent bin: ${config.cursorAgentBin}`);

  console.log("Verifying Slack tokens…");
  await verifySlackAuth(config);

  console.log("Checking build channel membership…");
  await ensureBotInChannels(config);

  console.log("Verifying Cursor Agent auth…");
  await verifyAgentAuth(config);

  const app = createSlackBridge(config);
  await app.start();
  console.log("Socket Mode connected — waiting for build: / status: messages…");
  console.log(`  PID: ${process.pid} — keep this process running (do not start a second bridge)`);

  process.on("SIGINT", () => {
    console.log("Shutting down Slack Agent Bridge…");
    process.exit(0);
  });
  process.on("SIGTERM", () => {
    console.log("Shutting down Slack Agent Bridge…");
    process.exit(0);
  });
  process.on("uncaughtException", (error) => {
    console.error("uncaughtException — bridge will exit:", error);
    process.exit(1);
  });
  process.on("unhandledRejection", (reason) => {
    console.error("unhandledRejection — bridge will exit:", reason);
    process.exit(1);
  });
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
