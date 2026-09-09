"use client";

import { useState, useTransition } from "react";

import { inviteFriendByEmail } from "@/app/actions";

const field =
  "mt-1.5 w-full rounded-xl border border-line bg-bg px-3.5 py-3 text-fg outline-none focus:border-accent";

export function InviteFriendForm() {
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function onSubmit(formData: FormData) {
    setError(null);
    setMessage(null);
    startTransition(async () => {
      try {
        const result = await inviteFriendByEmail(formData);
        setMessage(
          `Invite sent to ${result.email}. They’ll get a Supabase email to join and set a password.`
        );
      } catch (e) {
        setError(e instanceof Error ? e.message : "Could not send invite.");
      }
    });
  }

  return (
    <section className="rounded-2xl border border-line bg-bg-elevated/70 p-4">
      <h2 className="text-lg font-semibold">Invite by email</h2>
      <p className="mt-1 text-sm text-muted">
        Uses Supabase Auth. They get an email, set a password, and show up in
        the app so you can bet them.
      </p>
      <form action={onSubmit} className="mt-4 space-y-3">
        <label className="block text-sm">
          <span className="text-muted">Email</span>
          <input
            name="email"
            type="email"
            required
            placeholder="buddy@email.com"
            className={field}
          />
        </label>
        <label className="block text-sm">
          <span className="text-muted">Display name (optional)</span>
          <input
            name="display_name"
            placeholder="Tom"
            className={field}
          />
        </label>
        {error ? <p className="text-sm text-danger">{error}</p> : null}
        {message ? <p className="text-sm text-accent">{message}</p> : null}
        <button
          type="submit"
          disabled={pending}
          className="w-full rounded-xl bg-accent py-3 text-sm font-semibold text-accent-ink disabled:opacity-60"
        >
          {pending ? "Sending…" : "Send Supabase invite"}
        </button>
      </form>
    </section>
  );
}
