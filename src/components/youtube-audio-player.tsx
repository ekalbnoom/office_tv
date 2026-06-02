"use client";

import { Loader2, Play, Square, X } from "lucide-react";
import { FormEvent, useMemo, useState } from "react";

export function YouTubeAudioPlayer() {
  const [inputValue, setInputValue] = useState("");
  const [submittedUrl, setSubmittedUrl] = useState("");
  const [videoTitle, setVideoTitle] = useState("");
  const [isLoadingTitle, setIsLoadingTitle] = useState(false);
  const [error, setError] = useState("");

  const videoId = useMemo(() => extractYouTubeId(submittedUrl), [submittedUrl]);
  const embedUrl = videoId
    ? `https://www.youtube-nocookie.com/embed/${videoId}?autoplay=1&controls=0&modestbranding=1&rel=0`
    : "";
  const statusText = videoTitle || (videoId ? "Playing YouTube audio" : "Ready");

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const nextId = extractYouTubeId(inputValue);

    if (!nextId) {
      setError("Paste a valid YouTube link.");
      return;
    }

    setError("");
    setVideoTitle("");
    setSubmittedUrl(inputValue);
    void loadVideoTitle(inputValue);
  }

  function clearPlayer() {
    setError("");
    setInputValue("");
    setSubmittedUrl("");
    setVideoTitle("");
  }

  async function loadVideoTitle(url: string) {
    setIsLoadingTitle(true);

    try {
      const response = await fetch(`/api/youtube-title?url=${encodeURIComponent(url)}`);

      if (!response.ok) {
        setVideoTitle("Playing YouTube audio");
        return;
      }

      const data = (await response.json()) as { title?: string };
      setVideoTitle(data.title || "Playing YouTube audio");
    } catch {
      setVideoTitle("Playing YouTube audio");
    } finally {
      setIsLoadingTitle(false);
    }
  }

  return (
    <div className="mx-auto w-full max-w-5xl">
      <form
        className="flex min-h-18 items-center gap-3 rounded-full border border-line bg-panel px-3 py-3 shadow-[0_18px_55px_var(--spotlight-shadow)]"
        onSubmit={handleSubmit}
      >
        <div className="grid h-12 w-12 flex-none place-items-center rounded-full bg-panel-strong text-signal">
          {embedUrl ? (
            <Square className="h-5 w-5" aria-hidden />
          ) : (
            <Play className="h-5 w-5 fill-current" aria-hidden />
          )}
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex min-w-0 items-center gap-2">
            {isLoadingTitle ? (
              <Loader2 className="h-4 w-4 flex-none animate-spin text-muted" aria-hidden />
            ) : null}
            <p className="truncate text-base font-semibold text-foreground">{statusText}</p>
          </div>
          <input
            aria-label="YouTube URL"
            className="mt-1 h-7 w-full bg-transparent text-sm text-muted outline-none placeholder:text-muted/70 focus:text-foreground"
            onChange={(event) => setInputValue(event.target.value)}
            placeholder="Paste YouTube URL"
            type="url"
            value={inputValue}
          />
        </div>

        <button
          aria-label="Play YouTube audio"
          className="grid h-12 w-12 flex-none place-items-center rounded-full bg-signal text-background transition hover:bg-signal-strong focus:outline-none focus:ring-2 focus:ring-signal focus:ring-offset-2 focus:ring-offset-background"
          type="submit"
        >
          <Play className="h-5 w-5 fill-current" aria-hidden />
        </button>
        <button
          aria-label="Clear YouTube player"
          className="grid h-12 w-12 flex-none place-items-center rounded-full border border-line text-muted transition hover:border-foreground hover:text-foreground focus:outline-none focus:ring-2 focus:ring-signal"
          onClick={clearPlayer}
          type="button"
        >
          <X className="h-5 w-5" aria-hidden />
        </button>
      </form>

      {error ? <p className="mt-2 text-center text-sm font-medium text-danger">{error}</p> : null}

      {embedUrl ? (
        <iframe
          allow="autoplay; encrypted-media"
          className="pointer-events-none h-px w-px opacity-0"
          src={embedUrl}
          title="YouTube audio player"
        />
      ) : null}
    </div>
  );
}

function extractYouTubeId(url: string) {
  try {
    const parsed = new URL(url.trim());
    const host = parsed.hostname.replace(/^www\./, "");

    if (host === "youtu.be") {
      return normalizeId(parsed.pathname.slice(1));
    }

    if (host === "youtube.com" || host === "music.youtube.com" || host === "youtube-nocookie.com") {
      if (parsed.pathname === "/watch") {
        return normalizeId(parsed.searchParams.get("v") ?? "");
      }

      const match = parsed.pathname.match(/\/(?:embed|shorts|live)\/([^/?]+)/);
      return normalizeId(match?.[1] ?? "");
    }
  } catch {
    return "";
  }

  return "";
}

function normalizeId(value: string) {
  const id = value.trim();
  return /^[a-zA-Z0-9_-]{11}$/.test(id) ? id : "";
}
