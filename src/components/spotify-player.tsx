"use client";

import { Loader2, Speaker } from "lucide-react";
import { useEffect, useRef, useState } from "react";

const SCRIPT_SRC = "https://sdk.scdn.co/spotify-player.js";
const DEVICE_NAME = "Office TV";

type Status = "idle" | "loading" | "ready" | "playing" | "no-creds" | "not-premium" | "error";

type PlayerEvent = { device_id?: string; message?: string };

type SpotifyPlayerInstance = {
  addListener: (event: string, cb: (payload: PlayerEvent) => void) => void;
  connect: () => Promise<boolean>;
  disconnect: () => void;
  activateElement: () => Promise<void>;
};

type SpotifyNamespace = {
  Player: new (options: {
    name: string;
    getOAuthToken: (cb: (token: string) => void) => void;
    volume?: number;
  }) => SpotifyPlayerInstance;
};

declare global {
  interface Window {
    Spotify?: SpotifyNamespace;
    onSpotifyWebPlaybackSDKReady?: () => void;
  }
}

async function fetchToken(): Promise<string | null> {
  try {
    const response = await fetch("/api/spotify/token", { cache: "no-store" });

    if (!response.ok) {
      return null;
    }

    const data = (await response.json()) as { access_token?: string };
    return data.access_token ?? null;
  } catch {
    return null;
  }
}

export function SpotifyPlayer() {
  const [status, setStatus] = useState<Status>("idle");
  const playerRef = useRef<SpotifyPlayerInstance | null>(null);
  const deviceIdRef = useRef<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function init() {
      // No Spotify creds configured -> stay invisible.
      const token = await fetchToken();
      if (cancelled) return;
      if (!token) {
        setStatus("no-creds");
        return;
      }

      setStatus("loading");

      if (!document.querySelector(`script[src="${SCRIPT_SRC}"]`)) {
        const script = document.createElement("script");
        script.src = SCRIPT_SRC;
        script.async = true;
        document.body.appendChild(script);
      }

      const onReady = () => {
        if (cancelled || !window.Spotify || playerRef.current) return;

        const player = new window.Spotify.Player({
          name: DEVICE_NAME,
          volume: 0.8,
          getOAuthToken: (cb) => {
            void fetchToken().then((value) => {
              if (value) cb(value);
            });
          },
        });

        player.addListener("ready", ({ device_id }) => {
          deviceIdRef.current = device_id ?? null;
          setStatus("ready");
        });
        player.addListener("not_ready", () => setStatus("idle"));
        player.addListener("account_error", () => setStatus("not-premium"));
        player.addListener("authentication_error", () => setStatus("error"));
        player.addListener("initialization_error", () => setStatus("error"));

        void player.connect();
        playerRef.current = player;
      };

      if (window.Spotify) {
        onReady();
      } else {
        window.onSpotifyWebPlaybackSDKReady = onReady;
      }
    }

    void init();

    return () => {
      cancelled = true;
      playerRef.current?.disconnect();
      playerRef.current = null;
    };
  }, []);

  async function playHere() {
    const deviceId = deviceIdRef.current;
    if (!deviceId) return;

    // Must run inside the click so the browser allows audio.
    try {
      await playerRef.current?.activateElement();
    } catch {
      // activateElement can reject if already active; ignore.
    }

    try {
      const response = await fetch("/api/spotify/transfer", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ deviceId }),
      });
      setStatus(response.ok ? "playing" : "error");
    } catch {
      setStatus("error");
    }
  }

  if (status === "no-creds" || status === "idle") {
    return null;
  }

  return (
    <div className="mx-auto flex w-full max-w-5xl items-center justify-center gap-3 text-sm text-muted">
      {status === "loading" ? (
        <span className="inline-flex items-center gap-2">
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
          Connecting this screen to Spotify…
        </span>
      ) : null}

      {status === "not-premium" ? (
        <span>In-page playback needs Spotify Premium on the connected account.</span>
      ) : null}

      {status === "error" ? (
        <span className="text-danger">Couldn’t start playback on this screen. Check the dev log.</span>
      ) : null}

      {status === "ready" ? (
        <button
          className="inline-flex items-center gap-2 rounded-full border border-line bg-panel px-4 py-2 font-semibold text-foreground transition hover:border-signal hover:text-signal focus:outline-none focus:ring-2 focus:ring-signal"
          onClick={playHere}
          type="button"
        >
          <Speaker className="h-4 w-4" aria-hidden />
          Play on this screen
        </button>
      ) : null}

      {status === "playing" ? (
        <span className="inline-flex items-center gap-2 text-signal">
          <Speaker className="h-4 w-4" aria-hidden />
          Playing on “{DEVICE_NAME}”
        </span>
      ) : null}
    </div>
  );
}
