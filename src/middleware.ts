import { type NextRequest } from "next/server";

import { updateSession } from "@/lib/supabase/middleware";

export async function middleware(request: NextRequest) {
  return updateSession(request);
}

export const config = {
  matcher: [
    "/app/:path*",
    "/bet/:path*",
    "/create/:path*",
    "/wallet/:path*",
    "/friends/:path*",
    "/leagues/:path*",
    "/events/:path*",
    "/players/:path*",
    "/catalog/:path*",
    "/trips/:path*",
    "/login",
    "/signup",
    "/forgot-password",
    "/update-password",
    "/auth/callback",
  ],
};
