import { Brand } from "@/components/brand";
import { BottomNav } from "@/components/bottom-nav";
import { signOut } from "@/app/actions";

export function AppShell({
  children,
  userId,
  title,
}: {
  children: React.ReactNode;
  userId: string;
  /** Optional page title under the top bar */
  title?: string;
}) {
  return (
    <div className="mx-auto min-h-dvh w-full max-w-lg">
      <header
        className="sticky top-0 z-40 flex items-center justify-between gap-3 border-b border-line/60 bg-bg/90 px-4 py-3 backdrop-blur-md"
        style={{ paddingTop: "max(env(safe-area-inset-top), 12px)" }}
      >
        <Brand href="/app" size="sm" />
        <form action={signOut}>
          <button
            type="submit"
            className="rounded-full border border-line px-3 py-1.5 text-xs font-semibold text-muted transition hover:border-fg/30 hover:text-fg"
          >
            Log out
          </button>
        </form>
      </header>

      <main className="px-4 pb-[calc(5.5rem+env(safe-area-inset-bottom))] pt-4">
        {title ? (
          <h1 className="mb-4 text-xl font-semibold tracking-tight">{title}</h1>
        ) : null}
        {children}
      </main>

      <BottomNav userId={userId} />
    </div>
  );
}
