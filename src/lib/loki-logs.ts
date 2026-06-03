import "server-only";

export type LokiLogEntry = {
  app?: string;
  line: {
    app?: string;
    reqId?: string;
    detected_level?: string;
    level?: number | string;
    level_extracted?: string;
    url?: string;
    msg?: string;
    [key: string]: unknown;
  };
  timestamp: string;
};

export type LokiLogs = {
  entries: LokiLogEntry[];
  error: string;
  scopeLabel: string;
};

type LokiConfig = {
  basicAuthPassword: string;
  basicAuthUsername: string;
  limit: number;
  lookbackMinutes: number;
  query: string;
  url: string;
};

type LokiQueryRangeResponse = {
  data?: {
    result?: Array<{
      metric?: Record<string, string>;
      stream?: Record<string, string>;
      values?: Array<[string, string]>;
    }>;
  };
  error?: string;
  message?: string;
  status?: string;
};

export async function getLokiLogs(): Promise<LokiLogs> {
  const config = getLokiConfig();

  if (!config) {
    return {
      entries: [],
      error: "",
      scopeLabel: "Loki not configured",
    };
  }

  try {
    const endpoint = new URL("/loki/api/v1/query_range", config.url);
    const now = Date.now();
    endpoint.searchParams.set("query", config.query);
    endpoint.searchParams.set(
      "start",
      String((now - config.lookbackMinutes * 60 * 1000) * 1_000_000),
    );
    endpoint.searchParams.set("end", String(now * 1_000_000));
    endpoint.searchParams.set("limit", String(config.limit));
    endpoint.searchParams.set("direction", "backward");

    const response = await fetch(endpoint, {
      cache: "no-store",
      headers: getLokiHeaders(config),
    });

    const body = (await response.json()) as LokiQueryRangeResponse;

    if (!response.ok || body.status === "error") {
      throw new Error(
        body.error ?? body.message ?? `Loki responded with ${response.status}`,
      );
    }

    return {
      entries: parseLokiEntries(body).slice(0, config.limit),
      error: "",
      scopeLabel: `Last ${config.lookbackMinutes}m`,
    };
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Loki logs failed to load.";

    return {
      entries: [],
      error: `Loki logs failed to load: ${message}`,
      scopeLabel: `Last ${config.lookbackMinutes}m`,
    };
  }
}

function getLokiConfig(): LokiConfig | null {
  const url = process.env.LOKI_URL;
  const query = `{app=~"client|api"} | detected_level=~"error|warn|warning" | json | logfmt | drop __error__, __error_details__ `;
  const logLimit = 15;
  const lookbackMinutes = 15;

  if (!url) {
    return null;
  }

  return {
    basicAuthPassword: process.env.LOKI_BASIC_AUTH_PASSWORD ?? "",
    basicAuthUsername: process.env.LOKI_BASIC_AUTH_USERNAME ?? "",
    limit: logLimit,
    lookbackMinutes,
    query,
    url,
  };
}

function getLokiHeaders(config: LokiConfig) {
  const headers: Record<string, string> = {};

  if (config.basicAuthUsername && config.basicAuthPassword) {
    headers.Authorization = `Basic ${Buffer.from(
      `${config.basicAuthUsername}:${config.basicAuthPassword}`,
    ).toString("base64")}`;
  }

  return headers;
}

function parseLokiEntries(body: LokiQueryRangeResponse): LokiLogEntry[] {
  const streams = body.data?.result ?? [];

  return streams
    .flatMap((result) => {
      const stream = result.stream ?? result.metric ?? {};

      return (result.values ?? []).map(([timestamp, line]) => ({
        app: stream.app,
        line: {
          ...stream,
          ...parseLogLine(line),
        },
        timestamp: formatLokiTimestamp(timestamp),
      }));
    })
    .sort(
      (left, right) => Date.parse(right.timestamp) - Date.parse(left.timestamp),
    );
}

function parseLogLine(line: string): Record<string, unknown> {
  try {
    const parsed = JSON.parse(line);

    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      return parsed;
    }
  } catch {
    // Loki can return raw text lines even when labels hold the structured fields.
  }

  return { msg: line };
}

function formatLokiTimestamp(timestamp: string) {
  const milliseconds =
    timestamp.length > 6
      ? Number(timestamp.slice(0, -6))
      : Number(timestamp) / 1_000_000;
  return new Date(milliseconds).toISOString();
}
