import { ScrollText } from "lucide-react";
import type { LokiLogs } from "@/lib/loki-logs";
import { formatTime } from "@/lib/format";

export function LokiLogCard({ logs }: { logs: LokiLogs }) {
  return (
    <section className="border border-line bg-panel p-6">
      <div className="flex flex-col gap-4 border-b border-line pb-5 md:flex-row md:items-start md:justify-between">
        <h2 className="mt-2 font-display text-3xl font-semibold uppercase leading-none">
          Logs
        </h2>
        <div className="flex max-w-full flex-col gap-2 text-left md:items-end md:text-right">
          <span className="text-sm font-semibold uppercase tracking-[0.18em] text-signal">
            {logs.scopeLabel}
          </span>
        </div>
      </div>

      <div className="mt-5 grid gap-3">
        {logs.entries.length > 0 ? (
          logs.entries.map((entry) => {
            const severity = getSeverity(entry.line);

            return (
              <article
                className="grid min-w-0 grid-cols-[auto_minmax(0,1fr)] items-center gap-1 overflow-hidden md:grid-cols-[90px_86px_minmax(120px,0.35fr)_minmax(0,1fr)]"
                key={`${entry.timestamp}-${entry.app}-${JSON.stringify(entry.line)}`}
              >
                <div className="min-w-0">
                  <time
                    className="block whitespace-nowrap text-sm font-semibold tabular-nums text-signal"
                    dateTime={entry.timestamp}
                  >
                    {formatTime(new Date(entry.timestamp))}
                  </time>
                </div>
                <div className="min-w-0">
                  {severity === "error" ? (
                    <span className="inline-flex py-0.5 text-xs font-bold uppercase tracking-[0.14em] text-danger">
                      ERROR
                    </span>
                  ) : severity === "warn" ? (
                    <span className="inline-flex px-2 py-0.5 text-xs font-bold uppercase tracking-[0.14em] text-warning">
                      WARN
                    </span>
                  ) : (
                    <span className="text-xs font-bold uppercase tracking-[0.14em] text-muted">
                      INFO
                    </span>
                  )}
                </div>
                <p
                  className="min-w-0 overflow-hidden text-ellipsis whitespace-nowrap text-xs font-semibold uppercase tracking-[0.14em] text-muted"
                  title={entry.app}
                >
                  {entry.app}
                </p>
                <p
                  className="min-w-0 overflow-hidden text-ellipsis whitespace-nowrap font-mono text-sm leading-6 text-foreground"
                  title={[entry.line.url, entry.line.msg]
                    .filter(Boolean)
                    .join(" ")}
                >
                  {entry.line.url ? (
                    <span className="text-muted">
                      {entry.line.url?.slice(0, 20)}
                    </span>
                  ) : null}
                  {entry.line.url && entry.line.msg ? (
                    <span className="text-muted"> {"-"} </span>
                  ) : null}
                  {entry.line.msg}
                </p>
              </article>
            );
          })
        ) : (
          <div className="border border-dashed border-line px-4 py-6 text-sm font-medium text-muted">
            No recent log lines matched this Loki query.
          </div>
        )}
      </div>
    </section>
  );
}

function getSeverity(line: LokiLogs["entries"][number]["line"]) {
  const level = Number(line.level ?? line.level_extracted);
  const detectedLevel = line.detected_level?.toLowerCase();

  if (level >= 50 || detectedLevel === "error") {
    return "error";
  }

  if (level >= 40 || detectedLevel === "warn" || detectedLevel === "warning") {
    return "warn";
  }

  return "";
}
