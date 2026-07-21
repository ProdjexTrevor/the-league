import { Suspense } from "react";

import LoginForm from "./login-form";

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <main className="flex min-h-screen items-center justify-center text-muted">
          Loading…
        </main>
      }
    >
      <LoginForm />
    </Suspense>
  );
}
