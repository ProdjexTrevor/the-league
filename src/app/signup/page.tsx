"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";

import { createClient } from "@/lib/supabase/client";
import { normalizeVenmoUsername } from "@/lib/venmo";

export default function SignupPage() {
  const router = useRouter();
  const [displayName, setDisplayName] = useState("");
  const [venmoUsername, setVenmoUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setMessage(null);

    const venmo = normalizeVenmoUsername(venmoUsername);
    if (!venmo || !/^[a-z0-9_-]{3,30}$/i.test(venmo)) {
      setLoading(false);
      setError("Enter your Venmo username (e.g. john-smith).");
      return;
    }

    const supabase = createClient();
    const origin = window.location.origin;
    const { data, error: signUpError } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          display_name: displayName,
          venmo_username: venmo,
        },
        emailRedirectTo: `${origin}/auth/callback`,
      },
    });
    setLoading(false);
    if (signUpError) {
      setError(signUpError.message);
      return;
    }

    if (data.user) {
      // Best-effort profile sync (trigger also writes venmo)
      await supabase.from("profiles").upsert({
        id: data.user.id,
        display_name: displayName || email.split("@")[0],
        venmo_username: venmo,
      });
    }

    if (data.session) {
      router.push("/wallet");
      router.refresh();
      return;
    }
    setMessage("Check your email to confirm your account, then log in.");
  }

  return (
    <main className="flex min-h-screen flex-col items-center justify-center px-6 py-16">
      <div className="w-full max-w-md">
        <Link href="/" className="font-display text-3xl text-fg">
          THE LEAGUE
        </Link>
        <h1 className="mt-10 text-2xl font-semibold tracking-tight">
          Create account
        </h1>
        <p className="mt-2 text-sm text-muted">
          Add your Venmo so payouts open with one tap.
        </p>

        <form onSubmit={onSubmit} className="mt-8 space-y-4">
          <label className="block text-sm">
            <span className="text-muted">Display name</span>
            <input
              type="text"
              required
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              className="mt-1.5 w-full rounded-sm border border-line bg-bg-elevated px-3 py-2.5 text-fg outline-none focus:border-accent"
            />
          </label>
          <label className="block text-sm">
            <span className="text-muted">Venmo username</span>
            <div className="relative mt-1.5">
              <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted">
                @
              </span>
              <input
                type="text"
                required
                value={venmoUsername}
                onChange={(e) => setVenmoUsername(e.target.value)}
                placeholder="your-venmo"
                className="w-full rounded-sm border border-line bg-bg-elevated py-2.5 pl-7 pr-3 text-fg outline-none focus:border-accent"
              />
            </div>
            <span className="mt-1 block text-xs text-muted">
              Used when others pay you from their wallet.
            </span>
          </label>
          <label className="block text-sm">
            <span className="text-muted">Email</span>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="mt-1.5 w-full rounded-sm border border-line bg-bg-elevated px-3 py-2.5 text-fg outline-none focus:border-accent"
            />
          </label>
          <label className="block text-sm">
            <span className="text-muted">Password</span>
            <input
              type="password"
              required
              minLength={6}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="mt-1.5 w-full rounded-sm border border-line bg-bg-elevated px-3 py-2.5 text-fg outline-none focus:border-accent"
            />
          </label>
          {error && <p className="text-sm text-danger">{error}</p>}
          {message && <p className="text-sm text-accent">{message}</p>}
          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-sm bg-accent py-3 text-sm font-semibold text-accent-ink transition hover:brightness-110 disabled:opacity-60"
          >
            {loading ? "Creating…" : "Sign up"}
          </button>
        </form>

        <p className="mt-6 text-sm text-muted">
          Already have an account?{" "}
          <Link href="/login" className="text-accent hover:underline">
            Log in
          </Link>
        </p>
      </div>
    </main>
  );
}
