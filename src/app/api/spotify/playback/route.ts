import { getSpotifyAccessToken } from "@/lib/spotify";

// Play/pause the active Spotify device, used by the source toggle so choosing
// YouTube pauses Spotify and choosing Spotify resumes it.
export async function POST(request: Request) {
  const token = await getSpotifyAccessToken();

  if (!token) {
    return Response.json({ error: "spotify_not_configured" }, { status: 503 });
  }

  const body = (await request.json().catch(() => ({}))) as { action?: string };

  if (body.action !== "play" && body.action !== "pause") {
    return Response.json({ error: "bad_action" }, { status: 400 });
  }

  const response = await fetch(`https://api.spotify.com/v1/me/player/${body.action}`, {
    method: "PUT",
    headers: { Authorization: `Bearer ${token.accessToken}` },
    cache: "no-store",
  });

  // 204 = success, 404 = no active device (best-effort, not fatal for the UI).
  if (!response.ok) {
    const detail = await response.text();
    return Response.json(
      { error: "playback_failed", status: response.status, detail },
      { status: 502 },
    );
  }

  return Response.json({ ok: true });
}
