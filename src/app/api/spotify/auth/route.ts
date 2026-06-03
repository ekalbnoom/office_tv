import { NextResponse } from "next/server";
import { SPOTIFY_REDIRECT_URI } from "@/lib/spotify";

// One-time helper: open /api/spotify/auth in the browser (while logged in) to
// start the Spotify authorization flow. Use http://127.0.0.1:3000 — Spotify
// rejects "localhost" as a redirect host for apps created after April 2025.
export async function GET() {
  const clientId = process.env.SPOTIFY_CLIENT_ID;

  if (!clientId) {
    return new Response("Set SPOTIFY_CLIENT_ID in .env first, then restart the dev server.", {
      status: 400,
    });
  }

  const params = new URLSearchParams({
    client_id: clientId,
    response_type: "code",
    redirect_uri: SPOTIFY_REDIRECT_URI,
    // streaming + user-read-email/private: required by the Web Playback SDK.
    // playback-state pair: read/transfer playback to the in-page device.
    scope:
      "streaming user-read-email user-read-private user-read-playback-state user-modify-playback-state user-read-currently-playing",
    show_dialog: "true",
  });

  return NextResponse.redirect(`https://accounts.spotify.com/authorize?${params.toString()}`);
}
