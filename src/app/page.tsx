import QRCode from "qrcode";
import {
  AlertTriangle,
  CircleDollarSign,
  Clock,
  TrendingUp,
} from "lucide-react";
import { connection } from "next/server";
import { AutoRefresh } from "@/components/auto-refresh";
import { HealthTicker } from "@/components/health-ticker";
import { MediaBar } from "@/components/media-bar";
import { SpotifyPlayer } from "@/components/spotify-player";
import { ThemeToggle } from "@/components/theme-toggle";
import { formatMoney, formatTime } from "@/lib/format";
import { getCustomerHealthTicker } from "@/lib/customer-health";
import { getDashboardMetrics } from "@/lib/dashboard-metrics";
import { getLatestJamLink } from "@/lib/slack-jam";
import { getNowPlaying, isSpotifyConfigured } from "@/lib/spotify";
import { LokiLogCard } from "@/components/loki-log-card";

export const revalidate = 0;

export default async function Home() {
  await connection();

  const metrics = await getDashboardMetrics();
  const generatedAt = new Date(metrics.generatedAt);
  const healthTicker = await getCustomerHealthTicker();
  const errors = [...metrics.errors, healthTicker.error].filter(Boolean);

  const nowPlaying = await getNowPlaying().catch(() => null);
  const jam = await getLatestJamLink().catch(() => null);
  let jamQrDataUrl: string | null = null;

  if (jam) {
    try {
      jamQrDataUrl = await QRCode.toDataURL(jam.url, { margin: 1, width: 400 });
    } catch {
      jamQrDataUrl = null;
    }
  }

  return (
    <main className="min-h-screen overflow-hidden bg-background text-foreground">
      <section className="mx-auto flex min-h-screen w-full max-w-[1800px] flex-col px-8 py-7 lg:px-12">
        <header className="flex flex-col gap-4 border-b border-line pb-5 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="sr-only">Revenue wallboard</h1>
            <p className="text-sm font-semibold uppercase tracking-[0.24em] text-signal">
              Internal wallboard
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3 text-sm text-muted">
            <span className="rounded-full border border-line px-4 py-2">
              {metrics.monthLabel}
            </span>
            <span className="rounded-full border border-line px-4 py-2">
              Updated {formatTime(generatedAt)}
            </span>
            <AutoRefresh />
            <ThemeToggle />
            <form action="/api/logout" method="post">
              <button
                className="rounded-full border border-line px-4 py-2 text-xs font-semibold uppercase tracking-[0.18em] text-muted transition hover:border-foreground hover:text-foreground focus:outline-none focus:ring-2 focus:ring-signal"
                type="submit"
              >
                Logout
              </button>
            </form>
          </div>
        </header>

        {errors.length > 0 ? (
          <div className="mt-6 flex items-center gap-3 border border-danger/50 bg-danger/10 px-4 py-3 text-sm text-foreground">
            <AlertTriangle className="h-5 w-5 flex-none text-danger" aria-hidden />
            <p>{errors.join(" ")}</p>
          </div>
        ) : null}

        <div className="flex flex-1 flex-col gap-6 py-7">
          <section className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
            <MetricCard
              eyebrow="All time"
              label="Net collected"
              value={formatMoney(metrics.totalCollectedCents, metrics.currency)}
              detail={`Supabase aggregate: ${metrics.collectionScopeLabel}`}
              icon={<CircleDollarSign className="h-8 w-8" aria-hidden />}
              tone="signal"
            />
            <MetricCard
              eyebrow="This month"
              label="Net collected"
              value={formatMoney(metrics.monthlyCollectedCents, metrics.currency)}
              detail={`Month-to-date from ${metrics.monthLabel}`}
              icon={<TrendingUp className="h-8 w-8" aria-hidden />}
              tone="warning"
            />
            <MetricCard
              eyebrow="All time"
              label="Time saved"
              value={metrics.totalTimeSaved}
              detail="Calls, texts, emails, action items, promises, and payment plans"
              icon={<Clock className="h-8 w-8" aria-hidden />}
              tone="plain"
            />
          </section>

          <HealthTicker ticker={healthTicker} />

          <LokiLogCard logs={metrics.logs} />

          <section className="border-t border-line pt-5">
            <h2 className="sr-only">Audio and Jam</h2>
            <MediaBar
              nowPlaying={nowPlaying}
              jamQrDataUrl={jamQrDataUrl}
              spotifyConfigured={isSpotifyConfigured()}
            />
            {/* Mounted once here (outside the MediaBar source swap) so the
                Web Playback SDK device stays alive across refreshes. */}
            <div className="mt-4">
              <SpotifyPlayer />
            </div>
          </section>
        </div>
      </section>
    </main>
  );
}

function MetricCard({
  eyebrow,
  label,
  value,
  detail,
  icon,
  tone,
}: {
  eyebrow: string;
  label: string;
  value: string;
  detail: string;
  icon: React.ReactNode;
  tone: "signal" | "warning" | "plain";
}) {
  const toneClass =
    tone === "signal"
      ? "text-signal"
      : tone === "warning"
        ? "text-warning"
        : "text-foreground";

  return (
    <article className="grid min-h-[172px] min-w-0 gap-5 border border-line bg-panel p-6 md:grid-cols-[220px_minmax(0,1fr)] 2xl:min-h-[190px]">
      <div className="flex min-w-0 flex-col justify-between gap-5">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.24em] text-muted">
            {eyebrow}
          </p>
          <div className="mt-2 flex items-center gap-2">
            <h2 className="font-display text-3xl font-semibold uppercase leading-none">
              {label}
            </h2>
            <div className={`${toneClass} flex-none`}>{icon}</div>
          </div>
        </div>
        <p className="border-t border-line pt-4 text-sm text-muted">
          {detail}
        </p>
      </div>
      <div className="flex min-w-0 items-end justify-end">
        <p
          className={`w-full overflow-hidden whitespace-nowrap text-right font-display font-bold leading-none tracking-normal tabular-nums text-xl sm:text-3xl 2xl:text-4xl ${toneClass}`}
          title={value}
        >
          {value}
        </p>
      </div>

    </article>
  );
}
