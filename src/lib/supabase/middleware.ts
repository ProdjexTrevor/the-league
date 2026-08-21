import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

import { getSupabaseEnv } from "@/lib/supabase/env";

/** Vercel Edge middleware must return well under the platform limit. */
const AUTH_FETCH_MS = 4_000;

function fetchWithTimeout(
  input: RequestInfo | URL,
  init?: RequestInit
): Promise<Response> {
  const timeout = AbortSignal.timeout(AUTH_FETCH_MS);
  const signal = init?.signal
    ? AbortSignal.any([init.signal, timeout])
    : timeout;
  return fetch(input, { ...init, signal });
}

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const env = getSupabaseEnv();
  if (!env) {
    return supabaseResponse;
  }

  const supabase = createServerClient(env.url, env.anonKey, {
    global: {
      fetch: fetchWithTimeout,
    },
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) =>
          request.cookies.set(name, value)
        );
        supabaseResponse = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) =>
          supabaseResponse.cookies.set(name, value, options)
        );
      },
    },
  });

  let user: { id: string } | null = null;
  try {
    const { data } = await supabase.auth.getUser();
    user = data.user;
  } catch {
    // Supabase paused/unreachable/slow → treat as logged out, never hang to 504.
    user = null;
  }

  const path = request.nextUrl.pathname;
  const isProtected =
    path.startsWith("/app") ||
    path.startsWith("/bet") ||
    path.startsWith("/create") ||
    path.startsWith("/wallet") ||
    path.startsWith("/leagues") ||
    path.startsWith("/events") ||
    path.startsWith("/players") ||
    path.startsWith("/catalog");

  if (!user && isProtected) {
    const redirectUrl = request.nextUrl.clone();
    redirectUrl.pathname = "/login";
    redirectUrl.searchParams.set("next", path);
    return NextResponse.redirect(redirectUrl);
  }

  // Keep recovery sessions on /update-password so they can set a new password.
  if (
    user &&
    (path === "/login" || path === "/signup" || path === "/forgot-password")
  ) {
    const redirectUrl = request.nextUrl.clone();
    redirectUrl.pathname = "/app";
    return NextResponse.redirect(redirectUrl);
  }

  return supabaseResponse;
}
