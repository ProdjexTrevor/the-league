import { App } from "@slack/bolt";
import type { BridgeConfig } from "./config.js";
import {
  formatAgentReply,
  isAgentRunSuccessful,
  runCursorAgentWithRetry,
} from "./agent-runner.js";
import { JobQueue } from "./job-queue.js";
import {
  buildAgentPrompt,
  parseBuildMessage,
  parseCommand,
} from "./parse-build-message.js";
import { formatLogPathForSlack, RunLogger } from "./run-logger.js";
import { safeAddReaction } from "./slack-reactions.js";
import { extractSlackMessageText } from "./slack-text.js";

type SlackJob = {
  channel: string;
  threadTs: string;
  messageTs: string;
  task: string;
  user: string;
};

function formatElapsed(startedAt: Date): string {
  const totalMinutes = Math.max(
    0,
    Math.floor((Date.now() - startedAt.getTime()) / 60_000)
  );
  if (totalMinutes < 1) return "less than a minute";
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (hours === 0) return `${minutes}m`;
  return `${hours}h ${minutes}m`;
}

export function createSlackBridge(config: BridgeConfig) {
  const app = new App({
    token: config.slackBotToken,
    appToken: config.slackAppToken,
    socketMode: true,
  });

  const queue = new JobQueue<SlackJob>();
  const allowedChannels = new Set(config.slackChannelIds);

  app.event("message", async ({ event, client, logger }) => {
    // Ignore message edits, deletes, bot posts, etc.
    if ("subtype" in event && event.subtype) {
      logger.info(
        `Ignoring message subtype=${event.subtype} channel=${event.channel}`
      );
      return;
    }
    if ("bot_id" in event && event.bot_id) {
      return;
    }

    if (!allowedChannels.has(event.channel)) {
      logger.info(`Ignoring message outside allowlist channel=${event.channel}`);
      return;
    }

    const text = extractSlackMessageText(event);
    if (!text) {
      logger.info(
        `Ignoring message with no text channel=${event.channel} ts=${"ts" in event ? event.ts : "?"}`
      );
      return;
    }

    logger.info(
      `Received message channel=${event.channel} text=${JSON.stringify(text.slice(0, 80))}`
    );

    const statusRequest = parseCommand(text, config.statusPrefix);
    if (statusRequest !== null) {
      logger.info(`Status check from ${event.user ?? "unknown"}`);
      const status = queue.getStatus();
      const reply = status.activeJob
        ? [
            ":hourglass_flowing_sand: *Build is still working*",
            `*Elapsed:* ${formatElapsed(status.activeJob.startedAt)}`,
            `*Task:* \`${status.activeJob.payload.task}\``,
            `*Queued behind it:* ${status.pendingCount}`,
            `_Heartbeats every ${Math.round(config.heartbeatIntervalMs / 60_000)} min in the build thread._`,
          ].join("\n")
        : status.pendingCount > 0
          ? `:hourglass_flowing_sand: ${status.pendingCount} build(s) queued and starting shortly.`
          : ":white_check_mark: *Bridge is idle* — no active or queued builds.";

      await client.chat.postMessage({
        channel: event.channel,
        thread_ts: event.thread_ts ?? event.ts,
        text: reply,
      });
      return;
    }

    const task = parseBuildMessage(text, config.buildPrefix);
    if (!task) {
      logger.info(`Not a build/status command — ignored`);
      return;
    }

    const threadTs = event.thread_ts ?? event.ts;
    const user = event.user ?? "unknown";

    if (queue.isBusy()) {
      const queuedAhead = queue.getStatus().pendingCount + (queue.isRunning() ? 1 : 0);
      await client.chat.postMessage({
        channel: event.channel,
        thread_ts: threadTs,
        text: `:hourglass_flowing_sand: Queued behind ${queuedAhead} build(s):\n\`${task.slice(0, 200)}${task.length > 200 ? "…" : ""}\``,
      });
    }

    queue.enqueue({
      id: event.ts,
      payload: {
        channel: event.channel,
        threadTs,
        task,
        user,
        messageTs: event.ts,
      },
      run: async (job) => {
        logger.info(`Starting agent for ${job.user}: ${job.task.slice(0, 120)}`);

        await safeAddReaction(client, {
          channel: job.channel,
          timestamp: job.messageTs,
          name: "eyes",
        });

        await client.chat.postMessage({
          channel: job.channel,
          thread_ts: job.threadTs,
          text: `:rocket: *Build started*\n\`${job.task.slice(0, 300)}${job.task.length > 300 ? "…" : ""}\`\n_Workspace:_ \`${config.workspacePath}\``,
        });

        const prompt = buildAgentPrompt(config.agentSystemPrompt, job.task);
        const runLogger = RunLogger.start({
          channel: job.channel,
          threadTs: job.threadTs,
          messageTs: job.messageTs,
          slackUser: job.user,
          task: job.task,
          workspacePath: config.workspacePath,
          dryRun: config.dryRun,
          logDir: config.logDir,
        });
        const logPath = formatLogPathForSlack(runLogger.relativePath);
        let result;

        const heartbeat = setInterval(() => {
          const status = queue.getStatus();
          const elapsed = status.activeJob
            ? formatElapsed(status.activeJob.startedAt)
            : "unknown";
          void client.chat
            .postMessage({
              channel: job.channel,
              thread_ts: job.threadTs,
              text: [
                ":hourglass_flowing_sand: *Still working*",
                `*Elapsed:* ${elapsed}`,
                `*Task:* \`${job.task.slice(0, 200)}${job.task.length > 200 ? "…" : ""}\``,
                `*Queued behind this build:* ${status.pendingCount}`,
                `_Next automatic update in ${Math.round(config.heartbeatIntervalMs / 60_000)} minutes._`,
              ].join("\n"),
            })
            .catch((error) => logger.warn("Heartbeat update skipped:", error));
        }, config.heartbeatIntervalMs);

        try {
          result = await runCursorAgentWithRetry(config, prompt, runLogger, {
            onRetry: async () => {
              logger.warn("Empty exit-0 from agent — retrying once");
              await client.chat.postMessage({
                channel: job.channel,
                thread_ts: job.threadTs,
                text: ":repeat: *Silent CLI failure* (exit 0, no output) — retrying once…",
              });
            },
          });
          runLogger.finalize({
            ...result,
            finishedAt: new Date().toISOString(),
          });

          const reply = formatAgentReply(result, config.maxSlackReplyChars, logPath);
          const ok = isAgentRunSuccessful(result);

          await client.chat.postMessage({
            channel: job.channel,
            thread_ts: job.threadTs,
            text: reply,
          });

          await safeAddReaction(client, {
            channel: job.channel,
            timestamp: job.messageTs,
            name: ok ? "white_check_mark" : "x",
          }).catch((error) => {
            logger.warn("Reaction skipped:", error);
          });
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error);
          logger.error(error);

          if (!result) {
            runLogger.finalize({
              exitCode: 1,
              signal: null,
              stdout: "",
              stderr: message,
              timedOut: false,
              dryRun: config.dryRun,
              error: message,
              finishedAt: new Date().toISOString(),
            });
          }

          await client.chat.postMessage({
            channel: job.channel,
            thread_ts: job.threadTs,
            text: `:x: Bridge error:\n\`\`\`\n${message}\n\`\`\`\n\n_Full log:_ \`${logPath}\``,
          });
        } finally {
          clearInterval(heartbeat);
        }
      },
    });
  });

  return app;
}
