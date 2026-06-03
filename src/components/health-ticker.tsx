import { TrendingDown, TrendingUp } from "lucide-react";
import type { CustomerHealthTicker, HealthTickerEntry } from "@/lib/customer-health";

type TickerItem = HealthTickerEntry & { direction: "up" | "down" };

// Interleave the healthiest and at-risk lists so the ribbon alternates green
// and red as it scrolls, the way a stock ticker mixes gainers and losers.
function interleave(up: TickerItem[], down: TickerItem[]): TickerItem[] {
  const out: TickerItem[] = [];
  const max = Math.max(up.length, down.length);
  for (let i = 0; i < max; i++) {
    if (up[i]) out.push(up[i]);
    if (down[i]) out.push(down[i]);
  }
  return out;
}

export function HealthTicker({ ticker }: { ticker: CustomerHealthTicker }) {
  const items = interleave(
    ticker.rising.map((e) => ({ ...e, direction: "up" as const })),
    ticker.falling.map((e) => ({ ...e, direction: "down" as const })),
  );

  if (items.length === 0) {
    return null;
  }

  // Duplicate the list once; the CSS animation scrolls exactly one copy width
  // and loops seamlessly.
  const track = [...items, ...items];

  // Scale the lap time to the number of items so the scroll speed stays
  // constant (and readable) regardless of how many clients are shown.
  // ~7s per item is a calm, news-ribbon pace.
  const lapSeconds = items.length * 7;

  return (
    <section
      aria-label="Customer health ticker"
      className="-mx-8 flex items-stretch border-y border-line bg-panel-strong lg:-mx-12"
    >
      <div className="flex flex-none items-center gap-3 bg-signal px-6 text-background">
        <span className="font-display text-xl font-bold uppercase tracking-[0.2em]">
          Client Health
        </span>
        {ticker.preview ? (
          <span className="rounded-full border border-background/40 px-2 py-0.5 text-xs font-bold uppercase tracking-[0.18em]">
            Preview
          </span>
        ) : null}
      </div>

      <div className="relative flex-1 overflow-hidden">
        {/* edge fades so items appear/disappear smoothly at the ribbon ends */}
        <div className="pointer-events-none absolute inset-y-0 left-0 z-10 w-16 bg-gradient-to-r from-panel-strong to-transparent" />
        <div className="pointer-events-none absolute inset-y-0 right-0 z-10 w-16 bg-gradient-to-l from-panel-strong to-transparent" />

        <div
          className="animate-ticker flex w-max items-center py-4"
          style={{ "--ticker-duration": `${lapSeconds}s` } as React.CSSProperties}
        >
          {track.map((item, index) => (
            <TickerCell
              key={index}
              item={item}
              aria-hidden={index >= items.length}
            />
          ))}
        </div>
      </div>
    </section>
  );
}

function TickerCell({
  item,
  "aria-hidden": ariaHidden,
}: {
  item: TickerItem;
  "aria-hidden"?: boolean;
}) {
  const up = item.direction === "up";
  const tone = up ? "text-signal" : "text-danger";
  const Icon = up ? TrendingUp : TrendingDown;

  return (
    <span
      aria-hidden={ariaHidden}
      className="flex flex-none items-center gap-3 whitespace-nowrap px-7"
    >
      <Icon className={`h-7 w-7 flex-none ${tone}`} aria-hidden />
      <span className="font-display text-3xl font-semibold uppercase tracking-wide">
        {item.name}
      </span>
      <span className="font-display text-3xl font-bold tabular-nums">
        {item.score}
      </span>
      {item.delta != null ? (
        <span className={`font-display text-2xl font-bold tabular-nums ${tone}`}>
          {item.delta > 0 ? "+" : "−"}
          {Math.abs(item.delta)}
        </span>
      ) : (
        <span className="text-base uppercase tracking-[0.18em] text-muted">
          {item.bucket}
        </span>
      )}
      <span className="pl-7 text-2xl text-line" aria-hidden>
        |
      </span>
    </span>
  );
}
