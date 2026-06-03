// Pure ranking logic for the customer-health ticker. No I/O, no "server-only",
// so it can be unit-tested directly. Given today's rows and (optionally) a past
// snapshot, it produces the ordered list the ribbon renders.
//
// - Churned customers are excluded.
// - ALL remaining customers are shown (no top/bottom cap).
// - Ordering: when a past snapshot exists (trend mode), biggest score change
//   first so the movers are visible the moment the ticker loads; ties and
//   no-change customers fall back to most-at-risk first. With no history yet
//   (rank mode), it's ordered most-at-risk first.

import {
  computeAllScores,
  BUCKET_LABEL,
  type Bucket,
  type CustomerHealthRow,
  type CustomerHealthScore,
} from "./health-score";

export type HealthTickerEntry = {
  name: string;
  score: number;
  bucket: string;
  status: string;
  reason: string;
  delta: number | null; // score change vs. the comparison snapshot; null = no history / no change
  direction: "up" | "down";
};

export type TickerMode = "trend" | "rank";

export type RankedTicker = {
  items: HealthTickerEntry[];
  mode: TickerMode;
};

type Scored = { row: CustomerHealthRow; score: CustomerHealthScore };

// Statuses to hide from the wallboard (only active customers belong on it).
const INACTIVE_STATUSES = new Set(["churned", "paused"]);

function isInactive(row: CustomerHealthRow): boolean {
  return INACTIVE_STATUSES.has((row.customers?.status ?? "").toLowerCase());
}

function directionFor(bucket: Bucket, delta: number | null): "up" | "down" {
  if (delta != null && delta !== 0) return delta > 0 ? "up" : "down";
  // No movement (or no history): color by health — Top/Healthy up, Watch/AtRisk down.
  return bucket === "Top" || bucket === "Healthy" ? "up" : "down";
}

export function buildTicker(
  currentRows: CustomerHealthRow[],
  pastRows: CustomerHealthRow[] | null,
): RankedTicker {
  const currentScores = computeAllScores(currentRows);

  const scored: Scored[] = currentRows
    .map((row) => ({ row, score: currentScores.get(row.customer_id) }))
    .filter((x): x is Scored => Boolean(x.score && x.row.customers && x.row.customers.name))
    .filter((x) => !isInactive(x.row));

  const entry = (s: Scored, delta: number | null): HealthTickerEntry => ({
    name: s.row.customers!.name,
    score: s.score.score,
    bucket: BUCKET_LABEL[s.score.bucket],
    status: s.row.account_health_status ?? "",
    reason: s.score.reasons[0] ?? "",
    delta,
    direction: directionFor(s.score.bucket, delta),
  });

  // ── Trend mode: all customers, biggest score change first ─────────────────
  if (pastRows && pastRows.length > 0) {
    const pastScores = computeAllScores(pastRows);
    const withDelta = scored.map((s) => {
      const past = pastScores.get(s.row.customer_id);
      return { s, delta: past ? s.score.score - past.score : null };
    });

    if (withDelta.some((x) => x.delta != null && x.delta !== 0)) {
      withDelta.sort((a, b) => {
        const ad = Math.abs(a.delta ?? 0);
        const bd = Math.abs(b.delta ?? 0);
        if (bd !== ad) return bd - ad; // biggest movement first
        return a.s.score.score - b.s.score.score; // then most at-risk first
      });
      return { items: withDelta.map(({ s, delta }) => entry(s, delta)), mode: "trend" };
    }
  }

  // ── Rank mode (no history yet): stable shuffle ────────────────────────────
  // No real movement to rank by yet, and a straight score sort reads as a dull
  // monotonic run. Order by a hash of the customer id instead: a varied mix of
  // scores/colors that's deterministic, so it doesn't reshuffle on every refresh.
  scored.sort((a, b) => hashId(a.row.customer_id) - hashId(b.row.customer_id));
  return { items: scored.map((s) => entry(s, null)), mode: "rank" };
}

function hashId(id: string): number {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  return h;
}
