"use client";

import { Radio } from "lucide-react";
import { useEffect, useState } from "react";

const POLL_MS = 10_000;

// Polls the current Jam QR so a newly-posted #office-jams link or a "clear jam"
// is reflected within ~10s, independent of the 60s full-page refresh.
export function JamLive({
  initialQrDataUrl,
  hideWhenEmpty = false,
}: {
  initialQrDataUrl: string | null;
  hideWhenEmpty?: boolean;
}) {
  const [qrDataUrl, setQrDataUrl] = useState(initialQrDataUrl);

  useEffect(() => {
    let cancelled = false;

    async function poll() {
      try {
        const response = await fetch("/api/jam", { cache: "no-store" });
        if (!response.ok || cancelled) return;

        const data = (await response.json()) as { qrDataUrl: string | null };
        setQrDataUrl(data.qrDataUrl ?? null);
      } catch {
        // keep showing the last state on a transient failure
      }
    }

    const timer = window.setInterval(poll, POLL_MS);
    void poll();

    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, []);

  if (qrDataUrl) {
    return (
      <div className="flex flex-none items-center gap-3 rounded-2xl border border-line bg-panel p-3 lg:w-72">
        <div className="flex-none rounded-md bg-white p-2">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img alt="Scan to join the Jam" className="h-20 w-20" src={qrDataUrl} />
        </div>
        <div className="min-w-0">
          <div className="flex items-center gap-1.5 text-signal">
            <Radio className="h-4 w-4 flex-none" aria-hidden />
            <span className="text-xs font-semibold uppercase tracking-[0.18em]">Jam live</span>
            <span className="h-2 w-2 flex-none animate-pulse rounded-full bg-signal" aria-hidden />
          </div>
          <p className="mt-1 text-sm font-semibold text-foreground">Scan to join the Jam</p>
        </div>
      </div>
    );
  }

  // No active jam: render nothing where the caller wants the slot to disappear
  // entirely (e.g. the floating top-right QR), otherwise show the hint.
  if (hideWhenEmpty) return null;

  return (
    <div className="flex flex-none items-center gap-2 rounded-2xl border border-line bg-panel px-4 py-3 text-muted lg:w-72">
      <Radio className="h-4 w-4 flex-none" aria-hidden />
      <p className="text-sm">
        Drop a Jam link in <span className="text-foreground">#office-jams</span> to put it up here.
      </p>
    </div>
  );
}
