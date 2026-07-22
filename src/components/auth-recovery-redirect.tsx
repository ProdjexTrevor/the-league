"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect } from "react";

/**
 * Password recovery emails often land on Site URL with #access_token&type=recovery.
 * Send those sessions to /update-password without dropping the hash.
 */
export function AuthRecoveryRedirect() {
  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (pathname === "/update-password") return;

    const hash = window.location.hash.replace(/^#/, "");
    if (!hash) return;

    const params = new URLSearchParams(hash);
    const type = params.get("type");
    if (type === "recovery" || type === "invite") {
      router.replace(`/update-password#${hash}`);
    }
  }, [pathname, router]);

  return null;
}
