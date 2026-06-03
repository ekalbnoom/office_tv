import { getSpotifyAccessToken } from "@/lib/spotify";

// Transfers active playback (including a Jam the account is hosting) to the
// in-browser device, so the dashboard machine becomes the speaker.
export async function POST(request: Request) {
  const token = await getSpotifyAccessToken();

  if (!token) {
    return Response.json({ error: "spotify_not_configured" }, { status: 503 });
  }

  const body = (await request.json().catch(() => ({}))) as { deviceId?: string };

  if (!body.deviceId) {
    return Response.json({ error: "missing_device" }, { status: 400 });
  }

  const response = await fetch("https://api.spotify.com/v1/me/player", {
    method: "PUT",
    headers: {
      Authorization: `Bearer ${token.accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ device_ids: [body.deviceId], play: true }),
    cache: "no-store",
  });

  // Spotify returns 204 on success.
  if (!response.ok) {
    const detail = await response.text();
    return Response.json(
      { error: "transfer_failed", status: response.status, detail },
      { status: 502 },
    );
  }

  return Response.json({ ok: true });
}
