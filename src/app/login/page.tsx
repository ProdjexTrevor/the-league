import { Suspense } from "react";

import { AuthRecoveryRedirect } from "@/components/auth-recovery-redirect";

import LoginForm from "./login-form";

export default function LoginPage() {
  return (
    <>
      <AuthRecoveryRedirect />
      <Suspense
        fallback={
          <main className="flex min-h-screen items-center justify-center text-muted">
            Loading…
          </main>
        }
      >
        <LoginForm />
      </Suspense>
    </>
  );
}
