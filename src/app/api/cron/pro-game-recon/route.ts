import { NextResponse } from "next/server";

import { runProGameRecon } from "@/lib/pro-game-recon";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

function authorized(req: Request) {
  const secret = process.env.CRON_SECRET?.trim();
  if (!secret) return false;
  const header = req.headers.get("authorization") ?? "";
  return header === `Bearer ${secret}`;
}

export async function GET(req: Request) {
  if (!authorized(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const admin = createAdminClient();
    const summary = await runProGameRecon(admin);
    return NextResponse.json({ ok: true, ...summary });
  } catch (e) {
    return NextResponse.json(
      {
        ok: false,
        error: e instanceof Error ? e.message : "Recon failed",
      },
      { status: 500 }
    );
  }
}

// Vercel Cron uses GET; allow POST for manual triggers with the same secret.
export async function POST(req: Request) {
  return GET(req);
}
