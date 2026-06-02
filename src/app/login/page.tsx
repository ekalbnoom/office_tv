import { LockKeyhole } from "lucide-react";
import { ThemeToggle } from "@/components/theme-toggle";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; from?: string }>;
}) {
  const params = await searchParams;
  const hasError = params.error === "1";
  const isMissingConfig = params.error === "missing-config";

  return (
    <main className="grid min-h-screen place-items-center bg-background px-6 text-foreground">
      <div className="fixed right-6 top-6">
        <ThemeToggle />
      </div>
      <section className="w-full max-w-md border border-line bg-panel p-6">
        <div className="mb-8 flex items-center gap-4">
          <div className="grid h-12 w-12 place-items-center border border-line bg-panel-strong text-signal">
            <LockKeyhole className="h-6 w-6" aria-hidden />
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-signal">
              Private
            </p>
            <h1 className="font-display text-5xl font-semibold uppercase leading-none">
              Metrics
            </h1>
          </div>
        </div>

        <form action="/api/login" className="space-y-4" method="post">
          <input name="from" type="hidden" value={params.from ?? "/"} />
          <label className="block text-sm font-semibold uppercase tracking-[0.18em] text-muted">
            Password
          </label>
          <input
            autoComplete="current-password"
            autoFocus
            className="h-14 w-full border border-line bg-background px-4 text-lg text-foreground outline-none transition placeholder:text-muted/70 focus:border-signal focus:ring-2 focus:ring-signal/40"
            name="password"
            placeholder="Enter wallboard password"
            type="password"
          />
          {hasError ? (
            <p className="text-sm font-medium text-danger">That password did not work.</p>
          ) : null}
          {isMissingConfig ? (
            <p className="text-sm font-medium text-danger">
              Set DASHBOARD_PASSWORD before using this public site.
            </p>
          ) : null}
          <button
            className="h-14 w-full bg-signal px-5 text-sm font-bold uppercase tracking-[0.2em] text-background transition hover:bg-signal-strong focus:outline-none focus:ring-2 focus:ring-signal focus:ring-offset-2 focus:ring-offset-background"
            type="submit"
          >
            Enter
          </button>
        </form>
      </section>
    </main>
  );
}
