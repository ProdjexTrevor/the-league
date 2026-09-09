import { createClient } from "@supabase/supabase-js";

import type { Database } from "@/lib/database.types";
import { requireSupabaseEnv } from "@/lib/supabase/env";

/** Server-only admin client (service role). Never import into client components. */
export function createAdminClient() {
  const { url } = requireSupabaseEnv();
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!serviceRoleKey) {
    throw new Error(
      "Missing SUPABASE_SERVICE_ROLE_KEY. Add it in Vercel env (and .env.local) from Supabase → Project Settings → API."
    );
  }

  return createClient<Database>(url, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}
