const TOKEN_URL = "https://accounts.spotify.com/api/token";
// /me/player (full playback state) rather than /me/player/currently-playing:
// it reports the active device's loaded track even while paused, so the
// wallboard keeps showing the song instead of flickering back to the YouTube bar.
const NOW_PLAYING_URL = "https://api.spotify.com/v1/me/player";

// Must match the redirect URI registered in the Spotify app EXACTLY, and must
// be identical in both the /auth and /callback routes. We pin it rather than
// deriving from the request host because Next normalizes the dev origin to
// "localhost", which Spotify rejects (it only allows the 127.0.0.1 loopback).
export const SPOTIFY_REDIRECT_URI =
  process.env.SPOTIFY_REDIRECT_URI ?? "http://127.0.0.1:3000/api/spotify/callback";

export type NowPlaying = {
  isPlaying: boolean;
  title: string;
  artists: string;
  album: string;
  albumArt: string | null;
  trackUrl: string | null;
  progressMs: number;
  durationMs: number;
};

type SpotifyConfig = {
  clientId: string;
  clientSecret: string;
  refreshToken: string;
};

type SpotifyImage = { url?: string };

type SpotifyItem = {
  name?: string;
  duration_ms?: number;
  external_urls?: { spotify?: string };
  album?: { name?: string; images?: SpotifyImage[] };
  artists?: { name?: string }[];
  show?: { name?: string; images?: SpotifyImage[] };
  images?: SpotifyImage[];
};

type CurrentlyPlayingResponse = {
  is_playing?: boolean;
  progress_ms?: number;
  currently_playing_type?: string;
  item?: SpotifyItem | null;
};

// Cached across requests within the same server process. Spotify access tokens
// last an hour; we refresh a little early to avoid edge-of-expiry failures.
let cachedToken: { value: string; expiresAt: number } | null = null;

function getSpotifyConfig(): SpotifyConfig | null {
  const clientId = process.env.SPOTIFY_CLIENT_ID;
  const clientSecret = process.env.SPOTIFY_CLIENT_SECRET;
  const refreshToken = process.env.SPOTIFY_REFRESH_TOKEN;

  if (!clientId || !clientSecret || !refreshToken) {
    return null;
  }

  return { clientId, clientSecret, refreshToken };
}

// True when Now Playing / the in-page player can work at all. Used to decide
// whether to show the Spotify/YouTube source toggle.
export function isSpotifyConfigured(): boolean {
  return getSpotifyConfig() !== null;
}

async function getAccessToken(): Promise<string | null> {
  const config = getSpotifyConfig();

  if (!config) {
    return null;
  }

  if (cachedToken && cachedToken.expiresAt > Date.now() + 10_000) {
    return cachedToken.value;
  }

  const basic = Buffer.from(`${config.clientId}:${config.clientSecret}`).toString("base64");

  try {
    const response = await fetch(TOKEN_URL, {
      method: "POST",
      headers: {
        Authorization: `Basic ${basic}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        grant_type: "refresh_token",
        refresh_token: config.refreshToken,
      }),
      cache: "no-store",
    });

    if (!response.ok) {
      return null;
    }

    const data = (await response.json()) as { access_token?: string; expires_in?: number };

    if (!data.access_token) {
      return null;
    }

    cachedToken = {
      value: data.access_token,
      expiresAt: Date.now() + (data.expires_in ?? 3600) * 1000,
    };

    return cachedToken.value;
  } catch {
    return null;
  }
}

// Used by the /api/spotify/token route to hand a short-lived access token to
// the in-browser Web Playback SDK. The refresh token / client secret never
// leave the server.
export async function getSpotifyAccessToken(): Promise<{
  accessToken: string;
  expiresInSeconds: number;
} | null> {
  const token = await getAccessToken();

  if (!token || !cachedToken) {
    return null;
  }

  return {
    accessToken: token,
    expiresInSeconds: Math.max(0, Math.floor((cachedToken.expiresAt - Date.now()) / 1000)),
  };
}

export async function getNowPlaying(): Promise<NowPlaying | null> {
  const token = await getAccessToken();

  if (!token) {
    return null;
  }

  let response: Response;

  try {
    response = await fetch(NOW_PLAYING_URL, {
      headers: { Authorization: `Bearer ${token}` },
      cache: "no-store",
    });
  } catch {
    return null;
  }

  // 204 (nothing playing) and 202 (player loading) have no usable body.
  if (response.status === 204 || !response.ok) {
    return null;
  }

  const text = await response.text();

  if (!text) {
    return null;
  }

  let data: CurrentlyPlayingResponse;

  try {
    data = JSON.parse(text) as CurrentlyPlayingResponse;
  } catch {
    return null;
  }

  const item = data.item;

  // Ads return a null item; episodes/tracks both populate it but with
  // different shapes, so we read defensively below.
  if (!item || !item.name) {
    return null;
  }

  const artists = item.artists?.length
    ? item.artists.map((artist) => artist.name).filter(Boolean).join(", ")
    : (item.show?.name ?? "");

  const albumArt =
    item.album?.images?.[0]?.url ?? item.images?.[0]?.url ?? item.show?.images?.[0]?.url ?? null;

  return {
    isPlaying: data.is_playing ?? false,
    title: item.name,
    artists,
    album: item.album?.name ?? "",
    albumArt,
    trackUrl: item.external_urls?.spotify ?? null,
    progressMs: data.progress_ms ?? 0,
    durationMs: item.duration_ms ?? 0,
  };
}
