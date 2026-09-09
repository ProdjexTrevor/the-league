"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { acceptEventInvite } from "@/app/actions";

export function AcceptInviteButton({
  eventId,
  label = "Accept & lock in",
  className,
}: {
  eventId: string;
  label?: string;
  className?: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  return (
    <div className="w-full">
      <button
        type="button"
        disabled={pending}
        onClick={() => {
          setError(null);
          startTransition(async () => {
            try {
              const fd = new FormData();
              await acceptEventInvite(eventId, fd);
              router.refresh();
            } catch (e) {
              setError(e instanceof Error ? e.message : "Could not accept.");
            }
          });
        }}
        className={
          className ??
          "w-full rounded-2xl bg-accent px-4 py-3 text-sm font-bold uppercase tracking-wider text-accent-ink transition hover:brightness-110 disabled:opacity-60"
        }
      >
        {pending ? "Locking…" : label}
      </button>
      {error ? <p className="mt-2 text-xs text-danger">{error}</p> : null}
    </div>
  );
}
