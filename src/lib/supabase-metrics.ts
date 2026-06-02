import "server-only";
import { createClient, SupabaseClient } from "@supabase/supabase-js";
import {
  computeTotalTimeSavedHours,
  getPaymentPlanTimeSavedMinutes,
} from "@/lib/time-saved";

type MetricsRow = {
  call_count: number;
  email_count: number;
  new_customers: number;
  text_count: number;
  total_collected: number | string | null;
};

type MetricsRpcArgs = {
  p_company_ids: string[] | null;
  p_end_date: string | null;
  p_non_attribution_only: boolean;
  p_office_ids: string[] | null;
  p_start_date: string | null;
};

type CountResponse = {
  count: number | null;
  error: { message: string } | null;
};

type IdRow = {
  id: number | string | null;
};

type TimeSavedExtras = {
  action_item_count: number;
  error: string;
  payment_plan_count: number;
  payment_plan_minutes: number;
  promise_to_pay_count: number;
};

let supabaseClient: SupabaseClient | null = null;

export async function getSupabaseCollectionMetrics(generatedAt: Date, monthStart: Date) {
  const config = getSupabaseConfig();

  if (!config) {
    return {
      error: "Set SUPABASE_URL and SUPABASE_WORKER_KEY to show collected totals.",
      monthlyCollectedCents: 0,
      scopeLabel: "Supabase metrics",
      totalTimeSavedHours: 0,
      totalCollectedCents: 0,
    };
  }

  try {
    const [allTime, monthToDate, timeSavedExtras] = await Promise.all([
      getMetricsFromView(config, null, generatedAt),
      getMetricsFromView(config, monthStart, generatedAt),
      getTimeSavedExtras(config, generatedAt),
    ]);

    return {
      error: timeSavedExtras.error,
      monthlyCollectedCents: dollarsToCents(monthToDate.total_collected),
      scopeLabel: getScopeLabel(config),
      totalTimeSavedHours: computeTotalTimeSavedHours({
        action_item_count: timeSavedExtras.action_item_count,
        call_count: allTime.call_count,
        email_count: allTime.email_count,
        payment_plan_count: timeSavedExtras.payment_plan_count,
        payment_plan_minutes: timeSavedExtras.payment_plan_minutes,
        promise_to_pay_count: timeSavedExtras.promise_to_pay_count,
        text_count: allTime.text_count,
      }),
      totalCollectedCents: dollarsToCents(allTime.total_collected),
    };
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Supabase metrics failed to load.";

    return {
      error: `Supabase metrics failed to load: ${message}`,
      monthlyCollectedCents: 0,
      scopeLabel: getScopeLabel(config),
      totalTimeSavedHours: 0,
      totalCollectedCents: 0,
    };
  }
}

async function getMetricsFromView(
  config: SupabaseConfig,
  startDate: Date | null,
  endDate: Date,
) {
  const { data, error } = await getSupabaseClient(config).rpc("get_metrics_from_view", {
    p_company_ids: config.companyIds.length > 0 ? config.companyIds : null,
    p_end_date: toDateOnly(endDate),
    p_non_attribution_only: false,
    p_office_ids: config.officeIds.length > 0 ? config.officeIds : null,
    p_start_date: startDate ? toDateOnly(startDate) : null,
  } satisfies MetricsRpcArgs);

  if (error) {
    throw new Error(error.message);
  }

  return ((data as MetricsRow[] | null)?.[0] ?? {
    call_count: 0,
    email_count: 0,
    new_customers: 0,
    text_count: 0,
    total_collected: 0,
  }) satisfies MetricsRow;
}

async function getTimeSavedExtras(
  config: SupabaseConfig,
  endDate: Date,
): Promise<TimeSavedExtras> {
  try {
    const [actionItemCount, promiseToPayCount, activePaymentPlanIds] =
      await Promise.all([
        getAiActionItemCount(config, endDate),
        getPromiseToPayCount(config, endDate),
        getActivePaymentPlanIds(config),
      ]);
    const paymentPlanFollowUpCount = await getPaymentPlanFollowUpCount(
      config,
      activePaymentPlanIds,
      endDate,
    );

    return {
      action_item_count: actionItemCount,
      error: "",
      payment_plan_count: activePaymentPlanIds.length,
      payment_plan_minutes: getPaymentPlanTimeSavedMinutes(
        activePaymentPlanIds.length,
        paymentPlanFollowUpCount,
      ),
      promise_to_pay_count: promiseToPayCount,
    };
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "time saved metrics failed to load.";

    return {
      action_item_count: 0,
      error: `Time saved extras failed to load: ${message}`,
      payment_plan_count: 0,
      payment_plan_minutes: 0,
      promise_to_pay_count: 0,
    };
  }
}

async function getAiActionItemCount(config: SupabaseConfig, endDate: Date) {
  const [totalCount, userCreatedCount] = await Promise.all([
    readCount(getActionItemCountQuery(config, endDate), "action_item"),
    readCount(
      getActionItemCountQuery(config, endDate).eq(
        "action_metadata->>created_by_type",
        "user",
      ),
      "user-created action_item",
    ),
  ]);

  return Math.max(totalCount - userCreatedCount, 0);
}

function getActionItemCountQuery(config: SupabaseConfig, endDate: Date) {
  let query = getSupabaseClient(config)
    .from("action_item")
    .select("id", { count: "exact", head: true })
    .lte("created_at", endDate.toISOString());

  if (config.companyIds.length > 0) {
    query = query.in("company_id", config.companyIds);
  }

  if (config.officeIds.length > 0) {
    query = query.in("office_id", config.officeIds);
  }

  return query;
}

async function getPromiseToPayCount(config: SupabaseConfig, endDate: Date) {
  const selectColumns =
    config.officeIds.length > 0 ? "id, customer!inner(office_id)" : "id";
  let query = getSupabaseClient(config)
    .from("promise_to_pay")
    .select(selectColumns, { count: "exact", head: true })
    .lte("created_at", endDate.toISOString());

  if (config.companyIds.length > 0) {
    query = query.in("company_id", config.companyIds);
  }

  if (config.officeIds.length > 0) {
    query = query.in("customer.office_id", config.officeIds);
  }

  return readCount(query, "promise_to_pay");
}

async function getActivePaymentPlanIds(config: SupabaseConfig) {
  const ids: string[] = [];
  const pageSize = 1000;
  let from = 0;

  while (true) {
    const selectColumns =
      config.officeIds.length > 0 ? "id, customer!inner(office_id)" : "id";
    let query = getSupabaseClient(config)
      .from("payment_plan")
      .select(selectColumns)
      .in("status", ["active", "defaulted"])
      .range(from, from + pageSize - 1);

    if (config.companyIds.length > 0) {
      query = query.in("company_id", config.companyIds);
    }

    if (config.officeIds.length > 0) {
      query = query.in("customer.office_id", config.officeIds);
    }

    const { data, error } = await query;

    if (error) {
      throw new Error(`payment_plan: ${error.message}`);
    }

    const rows = (data ?? []) as unknown as IdRow[];
    ids.push(
      ...rows
        .map((row) => row.id)
        .filter((id): id is string | number => id !== null)
        .map(String),
    );

    if (rows.length < pageSize) {
      break;
    }

    from += pageSize;
  }

  return ids;
}

async function getPaymentPlanFollowUpCount(
  config: SupabaseConfig,
  paymentPlanIds: string[],
  endDate: Date,
) {
  if (paymentPlanIds.length === 0) {
    return 0;
  }

  const counts = await Promise.all(
    chunk(paymentPlanIds, 500).map((ids) => {
      let query = getSupabaseClient(config)
        .from("payment_plan_installment")
        .select("id", { count: "exact", head: true })
        .in("payment_plan_id", ids)
        .lte("due_date", toDateOnly(endDate));

      if (config.companyIds.length > 0) {
        query = query.in("company_id", config.companyIds);
      }

      return readCount(query, "payment_plan_installment");
    }),
  );

  return counts.reduce((sum, count) => sum + count, 0);
}

async function readCount(query: PromiseLike<CountResponse>, label: string) {
  const { count, error } = await query;

  if (error) {
    throw new Error(`${label}: ${error.message}`);
  }

  return count ?? 0;
}

type SupabaseConfig = {
  anonOrServiceKey: string;
  companyIds: string[];
  officeIds: string[];
  url: string;
};

function getSupabaseConfig(): SupabaseConfig | null {
  const url = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonOrServiceKey =
    process.env.SUPABASE_SERVICE_ROLE_KEY ??
    process.env.SUPABASE_WORKER_KEY ??
    process.env.SUPABASE_ANON_KEY ??
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??
    process.env.NEXT_PUBLIC_SUPABASE_KEY;

  if (!url || !anonOrServiceKey) {
    return null;
  }

  return {
    anonOrServiceKey,
    companyIds: parseCsvEnv("OFFICE_TV_COMPANY_IDS"),
    officeIds: parseCsvEnv("OFFICE_TV_OFFICE_IDS"),
    url,
  };
}

function getSupabaseClient(config: SupabaseConfig) {
  supabaseClient ??= createClient(config.url, config.anonOrServiceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });

  return supabaseClient;
}

function getScopeLabel(config: SupabaseConfig) {
  if (config.companyIds.length > 0 && config.officeIds.length > 0) {
    return `${config.companyIds.length} companies / ${config.officeIds.length} offices`;
  }

  if (config.companyIds.length > 0) {
    return `${config.companyIds.length} companies`;
  }

  if (config.officeIds.length > 0) {
    return `${config.officeIds.length} offices`;
  }

  return "All companies and offices";
}

function parseCsvEnv(name: string) {
  const rawValue = process.env[name] ?? "";

  if (rawValue.trim().toUpperCase() === "ALL") {
    return [];
  }

  return rawValue
    .split(",")
    .map((value) => value.trim())
    .filter((value) => value && value.toUpperCase() !== "ALL");
}

function dollarsToCents(value: number | string | null) {
  const numeric = typeof value === "number" ? value : Number(value ?? 0);
  return Number.isFinite(numeric) ? Math.round(numeric * 100) : 0;
}

function chunk<T>(items: T[], size: number) {
  const chunks: T[][] = [];

  for (let index = 0; index < items.length; index += size) {
    chunks.push(items.slice(index, index + size));
  }

  return chunks;
}

function toDateOnly(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}
