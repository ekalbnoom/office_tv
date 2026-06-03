// Health-score logic ported verbatim from the finance app
// (interval-financial-analyst/src/components/customerHealth/healthScore.ts)
// so the wallboard ranks clients identically to the Customer Health → Overview tab.
// Keep in sync if the source formula changes.

export type Bucket = "Top" | "Healthy" | "Watch" | "AtRisk";

export interface CustomerHealthRow {
  customer_id: string;
  calls_started: number;
  texts_started: number;
  emails_started: number;
  has_active_schedule: boolean;
  active_schedule_count: number;
  collected_last_90d: number;
  contactable_ar: number;
  beyond_schedule_ar: number;
  not_contactable_ar: number;
  open_dispute_count: number;
  oldest_open_dispute_at: string | null;
  avg_dispute_resolution_days: number | null;
  has_instant_dispute_notifications: boolean;
  account_health_status?: string | null;
  customers: {
    name: string;
    commission_monthly_value: number | null;
    usage_monthly_value: number | null;
    saas_monthly_value: number | null;
  } | null;
}

export interface CustomerHealthScore {
  score: number;
  bucket: Bucket;
  reasons: string[];
}

const clamp = (n: number, lo = 0, hi = 100) => Math.max(lo, Math.min(hi, n));

function getMonthlyFees(row: CustomerHealthRow): number {
  const c = row.customers;
  if (!c) return 0;
  return (c.commission_monthly_value ?? 0) + (c.usage_monthly_value ?? 0) + (c.saas_monthly_value ?? 0);
}

function getValueRatio(row: CustomerHealthRow): number | null {
  const fees = getMonthlyFees(row);
  if (fees <= 0) return null;
  const monthlyCollected = row.collected_last_90d / 3;
  return monthlyCollected / fees;
}

function getActivity(row: CustomerHealthRow): number {
  return row.calls_started + row.texts_started + row.emails_started;
}

function getDaysSinceOldestDispute(row: CustomerHealthRow): number | null {
  if (!row.oldest_open_dispute_at) return null;
  const diff = Date.now() - new Date(row.oldest_open_dispute_at).getTime();
  return Math.floor(diff / (1000 * 60 * 60 * 24));
}

function contactableBucket(ar: number): number {
  if (ar >= 50_000) return 100;
  if (ar >= 10_000) return 85;
  if (ar >= 1_000) return 55;
  return 20;
}

function paymentScore(row: CustomerHealthRow): number {
  const ar = row.contactable_ar;
  const absolute = contactableBucket(ar);
  const reachable = ar + row.beyond_schedule_ar;
  const coverage = reachable > 0 ? clamp((ar / reachable) * 100) : 100;
  return clamp(absolute * 0.7 + coverage * 0.3);
}

function valueScore(row: CustomerHealthRow): number {
  const ratio = getValueRatio(row);
  if (ratio == null) return 50;
  if (ratio <= 0) return 0;
  if (ratio >= 30) return 100;
  if (ratio >= 15) return 85;
  if (ratio >= 8) return 70;
  if (ratio >= 4) return 55;
  if (ratio >= 2) return 40;
  if (ratio >= 1) return 25;
  return 10;
}

function scheduleCountContribution(_count: number, hasActive: boolean): number {
  return hasActive ? 100 : 0;
}

function engagementScore(row: CustomerHealthRow, medianActivity: number): number {
  const activity = getActivity(row);
  let activityScore = 50;
  if (medianActivity > 0) {
    activityScore = clamp((activity / medianActivity) * 50, 0, 100);
  } else {
    activityScore = activity > 0 ? 75 : 25;
  }
  const scheduleScore = scheduleCountContribution(row.active_schedule_count, row.has_active_schedule);
  return clamp(activityScore * 0.6 + scheduleScore * 0.4);
}

function disputeCountContribution(n: number): number {
  if (n === 0) return 100;
  if (n >= 50) return 10;
  if (n >= 20) return 30;
  if (n >= 5) return 55;
  return 80;
}

function disputeAgeContribution(days: number): number {
  if (days <= 3) return 100;
  if (days <= 7) return 85;
  if (days <= 14) return 60;
  if (days <= 30) return 35;
  if (days <= 60) return 20;
  if (days <= 90) return 10;
  return 5;
}

function resolutionContribution(avgDays: number | null): number {
  if (avgDays == null) return 50;
  if (avgDays <= 7) return 100;
  if (avgDays <= 14) return 85;
  if (avgDays <= 30) return 60;
  if (avgDays <= 60) return 35;
  return 15;
}

function riskScore(row: CustomerHealthRow): number {
  const countScore = disputeCountContribution(row.open_dispute_count);
  const ageDays = getDaysSinceOldestDispute(row) ?? 0;
  const ageScore = row.open_dispute_count === 0 ? 100 : disputeAgeContribution(ageDays);
  const resolutionScore = resolutionContribution(row.avg_dispute_resolution_days);
  const notifScore = row.has_instant_dispute_notifications ? 100 : 50;
  return clamp(countScore * 0.45 + ageScore * 0.30 + resolutionScore * 0.20 + notifScore * 0.05);
}

function computeMedianActivity(rows: CustomerHealthRow[]): number {
  if (rows.length === 0) return 0;
  const sorted = rows.map(getActivity).sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

function getBucket(score: number): Bucket {
  if (score >= 85) return "Top";
  if (score >= 65) return "Healthy";
  if (score >= 40) return "Watch";
  return "AtRisk";
}

export const BUCKET_LABEL: Record<Bucket, string> = {
  Top: "Top",
  Healthy: "Healthy",
  Watch: "Watch",
  AtRisk: "At Risk",
};

function buildReasons(row: CustomerHealthRow): string[] {
  const reasons: string[] = [];
  const ar = row.contactable_ar;
  const arFmt = `$${Math.round(ar).toLocaleString()}`;
  const reachable = ar + row.beyond_schedule_ar;
  const pastSchedPct = reachable > 0 ? Math.round((row.beyond_schedule_ar / reachable) * 100) : 0;
  if (ar < 1_000) {
    reasons.push(`Only ${arFmt} in contactable AR.`);
  } else if (pastSchedPct >= 30) {
    reasons.push(`${pastSchedPct}% of reachable AR has fallen past schedule.`);
  } else if (ar >= 50_000) {
    reasons.push(`${arFmt} in contactable AR.`);
  }

  const ratio = getValueRatio(row);
  if (ratio != null) {
    if (ratio >= 15) reasons.push(`Interval collects ${ratio.toFixed(1)}× their fees.`);
    else if (ratio < 2) reasons.push(`Interval only collects ${ratio.toFixed(1)}× their fees.`);
  } else {
    reasons.push("No fee data on file.");
  }

  if (!row.has_active_schedule) {
    reasons.push("No active schedule.");
  }

  if (row.open_dispute_count > 0) {
    reasons.push(`${row.open_dispute_count} open disputes.`);
  }

  return reasons;
}

export function computeHealthScore(row: CustomerHealthRow, medianActivity: number): CustomerHealthScore {
  const payment = paymentScore(row);
  const value = valueScore(row);
  const engagement = engagementScore(row, medianActivity);
  const risk = riskScore(row);

  // Weights: Contactable AR 30% · Value 30% · Engagement 25% · Disputes 15%
  const score = clamp(payment * 0.30 + value * 0.30 + engagement * 0.25 + risk * 0.15);

  return {
    score: Math.round(score),
    bucket: getBucket(score),
    reasons: buildReasons(row),
  };
}

export function computeAllScores(rows: CustomerHealthRow[]): Map<string, CustomerHealthScore> {
  const median = computeMedianActivity(rows);
  const map = new Map<string, CustomerHealthScore>();
  for (const row of rows) {
    map.set(row.customer_id, computeHealthScore(row, median));
  }
  return map;
}
