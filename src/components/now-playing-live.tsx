"use client";

import { Music4 } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import type { NowPlaying } from "@/lib/spotify";
import { YouTubeAudioPlayer } from "@/components/youtube-audio-player";

const POLL_MS = 8_000;
const TICK_MS = 250;
// Tolerate one empty poll (e.g. the gap while skipping tracks) before falling
// back, so it doesn't flicker mid-song-change.
const MAX_NULL_STREAK = 2;

type Source = "spotify" | "youtube";

function formatClock(ms: number) {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}

export function NowPlayingLive({
  initial,
  configured,
}: {
  initial: NowPlaying | null;
  configured: boolean;
}) {
  const [nowPlaying, setNowPlaying] = useState<NowPlaying | null>(initial);
  const [displayMs, setDisplayMs] = useState(initial?.progressMs ?? 0);
  const [manualSource, setManualSource] = useState<Source | null>(null);

  // Refs read by the smooth-progress ticker without re-subscribing each poll.
  const npRef = useRef<NowPlaying | null>(initial);
  const anchorMsRef = useRef(initial?.progressMs ?? 0);
  const anchorAtRef = useRef(0);
  const nullStreak = useRef(0);

  // Poll the current track.
  useEffect(() => {
    if (!configured) return;

    let cancelled = false;

    async function poll() {
      try {
        const response = await fetch("/api/spotify/now-playing", { cache: "no-store" });
        if (!response.ok || cancelled) return;

        const data = (await response.json()) as { nowPlaying: NowPlaying | null };

        if (data.nowPlaying) {
          nullStreak.current = 0;
          npRef.current = data.nowPlaying;
          // Re-anchor to the server-confirmed position; the ticker advances from here.
          anchorMsRef.current = data.nowPlaying.progressMs;
          anchorAtRef.current = performance.now();
          setNowPlaying(data.nowPlaying);
          setDisplayMs(data.nowPlaying.progressMs);
        } else {
          nullStreak.current += 1;
          if (nullStreak.current >= MAX_NULL_STREAK) {
            npRef.current = null;
            setNowPlaying(null);
          }
        }
      } catch {
        // keep the last known track on a transient failure
      }
    }

    anchorAtRef.current = performance.now();
    const timer = window.setInterval(poll, POLL_MS);
    void poll();

    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [configured]);

  // Advance the bar continuously between polls, anchored to the last confirmation.
  useEffect(() => {
    if (!configured) return;

    const timer = window.setInterval(() => {
      const np = npRef.current;
      if (!np) return;

      const next = np.isPlaying
        ? Math.min(np.durationMs, anchorMsRef.current + (performance.now() - anchorAtRef.current))
        : anchorMsRef.current;

      setDisplayMs(next);
    }, TICK_MS);

    return () => window.clearInterval(timer);
  }, [configured]);

  function selectSource(source: Source) {
    setManualSource(source);
    // play when choosing Spotify, pause it when choosing YouTube.
    void fetch("/api/spotify/playback", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: source === "spotify" ? "play" : "pause" }),
    });
  }

  if (!configured) {
    return <YouTubeAudioPlayer />;
  }

  const view: Source = manualSource ?? (nowPlaying ? "spotify" : "youtube");

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-2">
      <div className="flex justify-end">
        <div className="inline-flex overflow-hidden rounded-full border border-line text-xs font-semibold uppercase tracking-[0.14em]">
          <SourceButton label="Spotify" active={view === "spotify"} onClick={() => selectSource("spotify")} />
          <SourceButton label="YouTube" active={view === "youtube"} onClick={() => selectSource("youtube")} />
        </div>
      </div>

      {view === "youtube" ? (
        <YouTubeAudioPlayer />
      ) : nowPlaying ? (
        <NowPlayingBar nowPlaying={nowPlaying} displayMs={displayMs} />
      ) : (
        <div className="flex min-h-18 items-center justify-center rounded-full border border-line bg-panel px-6 py-3 text-muted shadow-[0_18px_55px_var(--spotlight-shadow)]">
          Nothing playing on Spotify. Start a song or scan the Jam.
        </div>
      )}
    </div>
  );
}

function SourceButton({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      className={`px-4 py-1.5 transition ${
        active ? "bg-signal text-background" : "text-muted hover:text-foreground"
      }`}
      onClick={onClick}
      type="button"
    >
      {label}
    </button>
  );
}

function NowPlayingBar({ nowPlaying, displayMs }: { nowPlaying: NowPlaying; displayMs: number }) {
  const progress =
    nowPlaying.durationMs > 0 ? Math.min(100, (displayMs / nowPlaying.durationMs) * 100) : 0;

  return (
    <div className="flex min-h-18 items-center gap-3 rounded-full border border-line bg-panel px-3 py-3 shadow-[0_18px_55px_var(--spotlight-shadow)]">
      <div className="grid h-12 w-12 flex-none place-items-center overflow-hidden rounded-full bg-panel-strong text-signal">
        {nowPlaying.albumArt ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            alt={nowPlaying.album || nowPlaying.title}
            className="h-full w-full object-cover"
            src={nowPlaying.albumArt}
          />
        ) : (
          <Music4 className="h-5 w-5" aria-hidden />
        )}
      </div>

      <div className="min-w-0 flex-1">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-signal">
          {nowPlaying.isPlaying ? "Now playing" : "Paused"}
        </p>
        <p className="truncate text-base font-semibold text-foreground" title={nowPlaying.title}>
          {nowPlaying.title}
        </p>
        <p className="truncate text-sm text-muted" title={nowPlaying.artists}>
          {nowPlaying.artists}
        </p>
        <div className="mt-1.5 flex items-center gap-2">
          <div className="h-1 flex-1 overflow-hidden rounded-full bg-panel-strong">
            <div className="h-full rounded-full bg-signal" style={{ width: `${progress}%` }} />
          </div>
          <span className="flex-none text-xs tabular-nums text-muted">
            {formatClock(displayMs)} / {formatClock(nowPlaying.durationMs)}
          </span>
        </div>
      </div>
    </div>
  );
}
