import { getSupabaseCollectionMetrics } from "@/lib/supabase-metrics";
import { formatTimeSaved } from "@/lib/time-saved";
import { getLokiLogs, type LokiLogs } from "@/lib/loki-logs";

export type DashboardMetrics = {
  collectionScopeLabel: string;
  currency: string;
  errors: string[];
  generatedAt: string;
  logs: LokiLogs;
  monthLabel: string;
  monthlyCollectedCents: number;
  totalTimeSaved: string;
  totalCollectedCents: number;
};

export async function getDashboardMetrics(): Promise<DashboardMetrics> {
  const currency = (process.env.DISPLAY_CURRENCY ?? "usd").toLowerCase();
  const generatedAt = new Date();
  const monthStart = getMonthStart(generatedAt);

  const [collections, logs] = await Promise.all([
    getSupabaseCollectionMetrics(generatedAt, monthStart),
    getLokiLogs(),
  ]);

  return {
    collectionScopeLabel: collections.scopeLabel,
    currency,
    errors: [collections.error, logs.error].filter(Boolean),
    generatedAt: generatedAt.toISOString(),
    logs,
    monthLabel: new Intl.DateTimeFormat("en-US", {
      month: "long",
      year: "numeric",
    }).format(monthStart),
    monthlyCollectedCents: collections.monthlyCollectedCents,
    totalTimeSaved: formatTimeSaved(collections.totalTimeSavedHours),
    totalCollectedCents: collections.totalCollectedCents,
  };
}

function getMonthStart(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}
