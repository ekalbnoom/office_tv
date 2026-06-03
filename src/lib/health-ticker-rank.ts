// Pure ranking logic for the customer-health ticker. No I/O, no "server-only",
// so it can be unit-tested directly. Given today's rows and (optionally) a past
// snapshot, it produces the rising/falling lists the ribbon renders.
//
// - When a usable past snapshot exists, the ticker shows the biggest MOVERS:
//   top gainers and top losers by score change (real "trending"). Short sides
//   are padded with today's healthiest/at-risk so the ribbon never half-empties.
// - When there's no history yet, it falls back to today's healthiest-vs-at-risk
//   ranking (mode: "rank"), so the ribbon is never empty.

import {
  computeAllScores,
  BUCKET_LABEL,
  type CustomerHealthRow,
  type CustomerHealthScore,
} from "./health-score";

export type HealthTickerEntry = {
  name: string;
  score: number;
  bucket: string;
  status: string;
  reason: string;
  delta: number | null; // score change vs. the comparison snapshot; null = not trending / no history
};

export type TickerMode = "trend" | "rank";

export type RankedTicker = {
  rising: HealthTickerEntry[];
  falling: HealthTickerEntry[];
  mode: TickerMode;
};

type Scored = { row: CustomerHealthRow; score: CustomerHealthScore };

export function buildTicker(
  currentRows: CustomerHealthRow[],
  pastRows: CustomerHealthRow[] | null,
  limit: number,
): RankedTicker {
  const currentScores = computeAllScores(currentRows);

  const scored: Scored[] = currentRows
    .map((row) => ({ row, score: currentScores.get(row.customer_id) }))
    .filter((x): x is Scored => Boolean(x.score && x.row.customers));

  const entry = (s: Scored, delta: number | null): HealthTickerEntry => ({
    name: s.row.customers!.name,
    score: s.score.score,
    bucket: BUCKET_LABEL[s.score.bucket],
    status: s.row.account_health_status ?? "",
    reason: s.score.reasons[0] ?? "",
    delta,
  });

  // ── Trend mode: biggest movers vs. the past snapshot ──────────────────────
  if (pastRows && pastRows.length > 0) {
    const pastScores = computeAllScores(pastRows);

    const movers = scored
      .map((s) => {
        const past = pastScores.get(s.row.customer_id);
        return past ? { s, delta: s.score.score - past.score } : null;
      })
      .filter((m): m is { s: Scored; delta: number } => m !== null && m.delta !== 0);

    if (movers.length > 0) {
      const used = new Set<string>();
      const take = (list: { s: Scored; delta: number }[]) => {
        const picked = list.slice(0, limit);
        picked.forEach((m) => used.add(m.s.row.customer_id));
        return picked.map((m) => entry(m.s, m.delta));
      };

      const rising = take(
        movers.filter((m) => m.delta > 0).sort((a, b) => b.delta - a.delta),
      );
      const falling = take(
        movers.filter((m) => m.delta < 0).sort((a, b) => a.delta - b.delta),
      );

      // Pad short sides with rank-based picks so the ribbon stays full.
      pad(rising, "top", limit, scored, used, entry);
      pad(falling, "bottom", limit, scored, used, entry);

      return { rising, falling, mode: "trend" };
    }
  }

  // ── Rank fallback: today's healthiest vs. at-risk ─────────────────────────
  const byScoreDesc = [...scored].sort((a, b) => b.score.score - a.score.score);
  const safeLimit = Math.min(limit, Math.floor(byScoreDesc.length / 2));
  const rising = byScoreDesc.slice(0, safeLimit).map((s) => entry(s, null));
  const falling = byScoreDesc
    .slice(byScoreDesc.length - safeLimit)
    .reverse()
    .map((s) => entry(s, null));

  return { rising, falling, mode: "rank" };
}

function pad(
  list: HealthTickerEntry[],
  side: "top" | "bottom",
  limit: number,
  scored: Scored[],
  used: Set<string>,
  entry: (s: Scored, delta: number | null) => HealthTickerEntry,
): void {
  if (list.length >= limit) return;
  const pool = [...scored].sort((a, b) =>
    side === "top" ? b.score.score - a.score.score : a.score.score - b.score.score,
  );
  for (const s of pool) {
    if (list.length >= limit) break;
    if (used.has(s.row.customer_id)) continue;
    used.add(s.row.customer_id);
    list.push(entry(s, null));
  }
}
