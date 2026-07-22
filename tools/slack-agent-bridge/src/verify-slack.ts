import { WebClient } from "@slack/web-api";
import type { BridgeConfig } from "./config.js";

export async function verifySlackAuth(config: BridgeConfig): Promise<void> {
  const bot = new WebClient(config.slackBotToken);

  try {
    const result = await bot.auth.test();
    if (!result.ok) {
      throw new Error("Bot token auth.test returned ok: false");
    }

    console.log(`  Bot user:  @${result.user ?? "unknown"}`);
    console.log(`  Team:      ${result.team ?? "unknown"}`);
  } catch {
    throw new Error(
      [
        "SLACK_BOT_TOKEN is invalid.",
        "In api.slack.com → your app → OAuth & Permissions:",
        "  1. Confirm Bot Token Scopes are set (channels:history, chat:write, etc.)",
        "  2. Click Reinstall to Workspace if you changed scopes",
        "  3. Copy Bot User OAuth Token again and paste into this package's .env",
        "Do not paste tokens in chat — edit .env locally only.",
      ].join("\n")
    );
  }

  if (!config.slackAppToken.startsWith("xapp-1-") || config.slackAppToken.length < 20) {
    throw new Error(
      "SLACK_APP_TOKEN looks malformed. Regenerate an app-level token with connections:write scope."
    );
  }
}

/** Join public channels from SLACK_CHANNEL_IDS (needs channels:join scope). */
export async function ensureBotInChannels(config: BridgeConfig): Promise<void> {
  const bot = new WebClient(config.slackBotToken);

  for (const channelId of config.slackChannelIds) {
    try {
      const info = await bot.conversations.info({ channel: channelId });
      if (info.channel?.is_member) {
        console.log(`  In channel:  ${info.channel?.name ?? channelId} (${channelId})`);
        continue;
      }

      await bot.conversations.join({ channel: channelId });
      console.log(`  Joined:      ${info.channel?.name ?? channelId} (${channelId})`);
    } catch (error) {
      const slackError = error as { data?: { error?: string } };
      const code = slackError.data?.error ?? "unknown";

      if (code === "missing_scope") {
        throw new Error(
          [
            `Bot could not join channel ${channelId}. Add scope channels:join, reinstall app, update .env token.`,
            "Or add the app manually: channel name → Integrations → Add apps → search Cursor.",
          ].join("\n")
        );
      }

      if (code === "method_not_supported_for_channel_type") {
        throw new Error(
          [
            `Channel ${channelId} is private. /invite does not work the same for apps.`,
            "Add manually: channel name → Integrations → Add apps → Cursor → Add.",
            "Then add bot event message.groups under Event Subscriptions (we can wire that next).",
          ].join("\n")
        );
      }

      throw new Error(`Could not join channel ${channelId}: ${code}`);
    }
  }
}
