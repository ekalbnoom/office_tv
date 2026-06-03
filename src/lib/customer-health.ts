import "server-only";
import { type CustomerHealthRow } from "@/lib/health-score";
import {
  buildTicker,
  type HealthTickerEntry,
  type TickerMode,
} from "@/lib/health-ticker-rank";

// Customer health lives in the finance app's Supabase project — a different DB,
// and admin-only. Rather than hold that project's all-powerful service-role key,
// the wallboard calls a dedicated read-only edge function (customer-health-ticker)
// with a narrow shared secret. The function returns ONLY the health rows needed
// to render the ticker; the service-role key never leaves Supabase.

export type { HealthTickerEntry };

export type CustomerHealthTicker = {
  rising: HealthTickerEntry[];
  falling: HealthTickerEntry[];
  mode: TickerMode;
  preview: boolean; // true when the +/- deltas are synthetic (no real history yet)
  error: string | null;
};

type EdgeResponse = {
  current: CustomerHealthRow[];
  past: CustomerHealthRow[] | null;
};

export async function getCustomerHealthTicker(limit = 8): Promise<CustomerHealthTicker> {
  const url = process.env.HEALTH_TICKER_URL;
  const secret = process.env.HEALTH_TICKER_SECRET;

  if (!url || !secret) {
    return {
      rising: [],
      falling: [],
      mode: "rank",
      preview: false,
      error:
        "Set HEALTH_TICKER_URL and HEALTH_TICKER_SECRET to show the customer health ticker.",
    };
  }

  try {
    const res = await fetch(url, {
      // Custom header avoids the gateway trying to parse a non-JWT Bearer token.
      headers: { "x-ticker-secret": secret },
      signal: AbortSignal.timeout(15000),
      cache: "no-store",
    });

    if (!res.ok) {
      throw new Error(`ticker endpoint returned ${res.status}`);
    }

    const body = (await res.json()) as EdgeResponse;

    const currentRows = (body.current ?? []).filter(
      (row) => row.customers && row.customers.name,
    );

    // Attach today's fees to the past snapshot (history stores raw metrics only)
    // so the delta reflects operational movement, not fee changes.
    let pastRows: CustomerHealthRow[] | null = null;
    if (body.past && body.past.length > 0) {
      const feesById = new Map(currentRows.map((row) => [row.customer_id, row.customers]));
      pastRows = body.past.map((row) => ({
        ...row,
        customers: feesById.get(row.customer_id) ?? null,
      }));
    }

    // PREVIEW: when no real history exists yet, optionally synthesize a "last
    // week" snapshot in memory so the +/- ribbon can be demoed. Off by default;
    // enable with HEALTH_TICKER_PREVIEW=1. The numbers are NOT real movement and
    // the ribbon is labelled PREVIEW. No data is written anywhere.
    let preview = false;
    if (!pastRows && process.env.HEALTH_TICKER_PREVIEW) {
      pastRows = synthesizePreviewPast(currentRows);
      preview = true;
    }

    const ticker = buildTicker(currentRows, pastRows, limit);
    return { ...ticker, preview, error: null };
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Customer health ticker failed to load.";
    return {
      rising: [],
      falling: [],
      mode: "rank",
      preview: false,
      error: `Customer health ticker failed to load: ${message}`,
    };
  }
}

// Deterministically nudge today's metrics to fabricate a plausible "last week"
// so some clients trend up and some down. PREVIEW ONLY — never persisted.
function synthesizePreviewPast(currentRows: CustomerHealthRow[]): CustomerHealthRow[] {
  const factors = [0.5, 1.4, 0.7, 1.25, 0.6, 1.5, 0.8, 1.15];
  return currentRows.map((row, i) => {
    const f = factors[i % factors.length];
    return {
      ...row,
      contactable_ar: row.contactable_ar * f,
      collected_last_90d: row.collected_last_90d * f,
    };
  });
}
