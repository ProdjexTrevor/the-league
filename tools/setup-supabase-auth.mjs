/**
 * One-shot setup: League Supabase Auth redirects + Vercel SERVICE_ROLE.
 *
 * Usage:
 *   set SUPABASE_ACCESS_TOKEN=sbp_...   (https://supabase.com/dashboard/account/tokens)
 *   node tools/setup-supabase-auth.mjs
 *
 * Or:
 *   set SUPABASE_SERVICE_ROLE_KEY=eyJ...
 *   node tools/setup-supabase-auth.mjs
 */
import { execSync } from "node:child_process";
import { writeFileSync, unlinkSync } from "node:fs";

const PROJECT_REF = "wbwdmxlroniuacibeirg";
const SITE = "https://the-league-ivory.vercel.app";
const LOCAL = "http://localhost:3000";

const REDIRECTS = [
  `${SITE}/auth/callback`,
  `${SITE}/auth/callback?next=/update-password`,
  `${SITE}/auth/callback?next=/app`,
  `${SITE}/update-password`,
  `${SITE}/**`,
  `${LOCAL}/auth/callback`,
  `${LOCAL}/auth/callback?next=/update-password`,
  `${LOCAL}/update-password`,
  `${LOCAL}/**`,
];

async function management(path, { method = "GET", body, token } = {}) {
  const res = await fetch(`https://api.supabase.com/v1${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let json;
  try {
    json = JSON.parse(text);
  } catch {
    json = text;
  }
  if (!res.ok) {
    throw new Error(`${method} ${path} → ${res.status}: ${text.slice(0, 400)}`);
  }
  return json;
}

function vercelEnvSet(name, value) {
  // Prefer stdin pipe (works on Windows PowerShell via cmd)
  const cmd = `npx vercel env add ${name} production --force`;
  try {
    execSync(cmd, {
      input: `${value}\n`,
      stdio: ["pipe", "inherit", "inherit"],
      shell: true,
    });
  } catch {
    // Fallback: write temp file
    const tmp = `.env.tmp.${name}`;
    writeFileSync(tmp, value, "utf8");
    try {
      execSync(
        `cmd /c "type ${tmp} | npx vercel env add ${name} production --force"`,
        { stdio: "inherit" }
      );
      try {
        execSync(
          `cmd /c "type ${tmp} | npx vercel env add ${name} preview --force"`,
          { stdio: "inherit" }
        );
      } catch {
        /* optional */
      }
      try {
        execSync(
          `cmd /c "type ${tmp} | npx vercel env add ${name} development --force"`,
          { stdio: "inherit" }
        );
      } catch {
        /* optional */
      }
    } finally {
      try {
        unlinkSync(tmp);
      } catch {
        /* ignore */
      }
    }
  }
}

async function main() {
  const accessToken = process.env.SUPABASE_ACCESS_TOKEN?.trim();
  let serviceRole = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();

  if (!serviceRole && !accessToken) {
    console.error(`
Missing credentials. Provide ONE of:

  1) Supabase personal access token (can fetch keys + set Auth URLs):
       https://supabase.com/dashboard/account/tokens
       $env:SUPABASE_ACCESS_TOKEN="sbp_..."
       node tools/setup-supabase-auth.mjs

  2) Service role key only (Vercel env; Auth URLs still need dashboard or token):
       Supabase → Project Settings → API → service_role
       $env:SUPABASE_SERVICE_ROLE_KEY="eyJ..."
       node tools/setup-supabase-auth.mjs
`);
    process.exit(1);
  }

  if (!serviceRole && accessToken) {
    console.log("Fetching API keys for", PROJECT_REF, "…");
    const keys = await management(`/projects/${PROJECT_REF}/api-keys`, {
      token: accessToken,
    });
    const list = Array.isArray(keys) ? keys : keys?.api_keys ?? [];
    const sr = list.find(
      (k) =>
        k.name === "service_role" ||
        k.tags?.includes?.("service_role") ||
        k.type === "service_role"
    );
    serviceRole = sr?.api_key ?? sr?.key ?? sr?.secret;
    if (!serviceRole) {
      // Newer API shape
      const revealed = await management(
        `/projects/${PROJECT_REF}/api-keys?reveal=true`,
        { token: accessToken }
      );
      const list2 = Array.isArray(revealed) ? revealed : [];
      const sr2 = list2.find(
        (k) => k.name === "service_role" || k.id === "service_role"
      );
      serviceRole = sr2?.api_key ?? sr2?.key;
    }
    if (!serviceRole) {
      throw new Error(
        "Could not find service_role in Management API response. Paste SUPABASE_SERVICE_ROLE_KEY instead."
      );
    }
    console.log("Got service_role key.");
  }

  if (accessToken) {
    console.log("Updating Auth URL config…");
    // GET current then PATCH
    try {
      await management(`/projects/${PROJECT_REF}/config/auth`, {
        method: "PATCH",
        token: accessToken,
        body: {
          site_url: SITE,
          uri_allow_list: REDIRECTS.join(","),
        },
      });
      console.log("Auth site_url + redirect allow list updated.");
    } catch (e) {
      console.warn("Auth config PATCH failed:", e.message);
      console.warn(
        "Set manually: Authentication → URL Configuration → Site URL + Redirect URLs"
      );
    }
  } else {
    console.warn(
      "No SUPABASE_ACCESS_TOKEN — skipped Auth URL config. Set redirects in the dashboard."
    );
  }

  console.log("Writing SUPABASE_SERVICE_ROLE_KEY to Vercel…");
  vercelEnvSet("SUPABASE_SERVICE_ROLE_KEY", serviceRole);

  // Keep app URL consistent for invite redirectTo
  try {
    vercelEnvSet("NEXT_PUBLIC_APP_URL", SITE);
  } catch (e) {
    console.warn("Could not set NEXT_PUBLIC_APP_URL:", e.message);
  }

  console.log("Done. Redeploying…");
  execSync("npx vercel --prod --yes", { stdio: "inherit" });
  console.log("Live.");
}

main().catch((e) => {
  console.error(e.message || e);
  process.exit(1);
});
