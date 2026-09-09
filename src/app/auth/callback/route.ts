import { NextResponse } from "next/server";

import { createClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const nextRaw = searchParams.get("next") ?? "/app";
  // Only allow relative in-app redirects
  const next =
    nextRaw.startsWith("/") && !nextRaw.startsWith("//") ? nextRaw : "/app";

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      return NextResponse.redirect(`${origin}${next}`);
    }
  }

  // Invite / recovery sometimes lands without code if misconfigured
  const err = searchParams.get("error_description") ?? searchParams.get("error");
  if (err) {
    return NextResponse.redirect(
      `${origin}/login?error=${encodeURIComponent(err)}`
    );
  }

  return NextResponse.redirect(`${origin}/login?error=auth`);
}
