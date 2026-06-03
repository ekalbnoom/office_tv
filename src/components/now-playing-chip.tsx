"use client";

import { Music4 } from "lucide-react";
import { useEffect, useState } from "react";
import type { NowPlaying } from "@/lib/spotify";

const POLL_MS = 8_000;
const MAX_NULL_STREAK = 2;

// Compact "now playing" pill for the header. Display-only (the actual player +
// controls stay in the bottom MediaBar). Renders nothing when nothing is
// playing, so the header is unchanged when the room is quiet.
export function NowPlayingChip({
  initial,
  configured,
}: {
  initial: NowPlaying | null;
  configured: boolean;
}) {
  const [np, setNp] = useState<NowPlaying | null>(initial);

  useEffect(() => {
    if (!configured) return;
    let cancelled = false;
    let nullStreak = 0;

    async function poll() {
      try {
        const res = await fetch("/api/spotify/now-playing", { cache: "no-store" });
        if (!res.ok || cancelled) return;
        const data = (await res.json()) as { nowPlaying: NowPlaying | null };
        if (data.nowPlaying) {
          nullStreak = 0;
          setNp(data.nowPlaying);
        } else if (++nullStreak >= MAX_NULL_STREAK) {
          setNp(null);
        }
      } catch {
        // keep last known track on a transient failure
      }
    }

    const timer = window.setInterval(poll, POLL_MS);
    void poll();
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [configured]);

  if (!np) return null;

  return (
    <div className="flex min-w-0 max-w-md items-center gap-2.5 rounded-full border border-line bg-panel px-3 py-1.5">
      <div className="grid h-7 w-7 flex-none place-items-center overflow-hidden rounded-full bg-panel-strong text-signal">
        {np.albumArt ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img alt="" className="h-full w-full object-cover" src={np.albumArt} />
        ) : (
          <Music4 className="h-3.5 w-3.5" aria-hidden />
        )}
      </div>
      <span className="flex-none text-xs font-semibold uppercase tracking-[0.16em] text-signal">
        {np.isPlaying ? "Now playing" : "Paused"}
      </span>
      <span className="min-w-0 truncate text-sm text-foreground" title={`${np.title} · ${np.artists}`}>
        {np.title} <span className="text-muted">· {np.artists}</span>
      </span>
    </div>
  );
}
