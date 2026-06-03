import { getSpotifyAccessToken } from "@/lib/spotify";

// Hands a short-lived access token to the in-browser Web Playback SDK. Gated by
// the session proxy, so only logged-in dashboard viewers can reach it.
export async function GET() {
  const token = await getSpotifyAccessToken();

  if (!token) {
    return Response.json({ error: "spotify_not_configured" }, { status: 503 });
  }

  return Response.json(
    { access_token: token.accessToken, expires_in: token.expiresInSeconds },
    { headers: { "Cache-Control": "no-store" } },
  );
}
