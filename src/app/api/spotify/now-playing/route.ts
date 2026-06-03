import { getNowPlaying } from "@/lib/spotify";

// Lightweight endpoint the Now Playing widget polls so song changes show up in
// seconds rather than waiting for the 60s full-page refresh.
export async function GET() {
  const nowPlaying = await getNowPlaying().catch(() => null);

  return Response.json({ nowPlaying }, { headers: { "Cache-Control": "no-store" } });
}
