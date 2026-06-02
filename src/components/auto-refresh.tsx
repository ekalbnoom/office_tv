"use client";

import { RefreshCw } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";

const REFRESH_INTERVAL_MS = 60_000;
const REFRESH_INTERVAL_SECONDS = REFRESH_INTERVAL_MS / 1000;

export function AutoRefresh() {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const remainingSeconds = useRef(REFRESH_INTERVAL_SECONDS);
  const [seconds, setSeconds] = useState(REFRESH_INTERVAL_SECONDS);

  useEffect(() => {
    const timer = window.setInterval(() => {
      remainingSeconds.current -= 1;

      if (remainingSeconds.current <= 0) {
        remainingSeconds.current = REFRESH_INTERVAL_SECONDS;
        startTransition(() => router.refresh());
      }

      setSeconds(remainingSeconds.current);
    }, 1000);

    return () => window.clearInterval(timer);
  }, [router]);

  return (
    <button
      className="inline-flex items-center gap-2 rounded-full border border-line px-4 py-2 text-sm font-semibold text-foreground transition hover:border-signal hover:text-signal focus:outline-none focus:ring-2 focus:ring-signal"
      onClick={() => {
        remainingSeconds.current = REFRESH_INTERVAL_SECONDS;
        setSeconds(REFRESH_INTERVAL_SECONDS);
        startTransition(() => router.refresh());
      }}
      type="button"
    >
      <RefreshCw className={`h-4 w-4 ${isPending ? "animate-spin" : ""}`} aria-hidden />
      {isPending ? "Refreshing" : `${seconds}s`}
    </button>
  );
}
