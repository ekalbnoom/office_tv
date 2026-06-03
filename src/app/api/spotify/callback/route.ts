import { NextRequest } from "next/server";
import { SPOTIFY_REDIRECT_URI } from "@/lib/spotify";

const TOKEN_URL = "https://accounts.spotify.com/api/token";

// Spotify redirects here after authorization. We exchange the code for tokens
// and print the refresh token so it can be pasted into .env. One-time use.
export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get("code");
  const error = request.nextUrl.searchParams.get("error");

  if (error) {
    return page(`<h1>Authorization failed</h1><p>${escapeHtml(error)}</p>`);
  }

  if (!code) {
    return page("<h1>Missing authorization code</h1><p>Start over at /api/spotify/auth.</p>");
  }

  const clientId = process.env.SPOTIFY_CLIENT_ID;
  const clientSecret = process.env.SPOTIFY_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    return page("<h1>Missing credentials</h1><p>Set SPOTIFY_CLIENT_ID and SPOTIFY_CLIENT_SECRET in .env first.</p>");
  }

  const basic = Buffer.from(`${clientId}:${clientSecret}`).toString("base64");

  const response = await fetch(TOKEN_URL, {
    method: "POST",
    headers: {
      Authorization: `Basic ${basic}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      code,
      redirect_uri: SPOTIFY_REDIRECT_URI,
    }),
    cache: "no-store",
  });

  const data = (await response.json()) as { refresh_token?: string; error_description?: string };

  if (!data.refresh_token) {
    return page(
      `<h1>No refresh token returned</h1><p>${escapeHtml(data.error_description ?? "Unknown error")}</p>`,
    );
  }

  return page(
    `<h1>Success</h1>
     <p>Add this line to your <code>.env</code>, then restart the dev server:</p>
     <pre>SPOTIFY_REFRESH_TOKEN=${escapeHtml(data.refresh_token)}</pre>
     <p>You can delete the two files under <code>src/app/api/spotify/auth</code> and
     <code>src/app/api/spotify/callback</code> afterward if you want — they are only needed for this one-time step.</p>`,
  );
}

function page(body: string) {
  return new Response(
    `<!doctype html><html><head><meta charset="utf-8"><title>Spotify auth</title>
     <style>body{font-family:system-ui,sans-serif;max-width:760px;margin:48px auto;padding:0 20px;line-height:1.5}
     pre{background:#111;color:#8ee680;padding:16px;border-radius:8px;overflow-x:auto;white-space:pre-wrap;word-break:break-all}
     code{background:#eee;padding:2px 6px;border-radius:4px}</style></head>
     <body>${body}</body></html>`,
    { headers: { "Content-Type": "text/html; charset=utf-8" } },
  );
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
