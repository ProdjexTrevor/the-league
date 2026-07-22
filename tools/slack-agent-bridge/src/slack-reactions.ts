import type { WebClient } from "@slack/web-api";

type SlackApiError = {
  data?: { error?: string };
};

export async function safeAddReaction(
  client: WebClient,
  input: { channel: string; timestamp: string; name: string }
): Promise<void> {
  try {
    await client.reactions.add(input);
  } catch (error) {
    const err = error as SlackApiError & { message?: string };
    const code = err.data?.error;
    if (code === "already_reacted" || err.message?.includes("already_reacted")) {
      return;
    }
    throw error;
  }
}
