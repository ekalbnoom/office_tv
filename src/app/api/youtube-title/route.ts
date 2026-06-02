import { NextRequest } from "next/server";

export async function GET(request: NextRequest) {
  const url = request.nextUrl.searchParams.get("url");

  if (!url || !isYouTubeUrl(url)) {
    return Response.json({ title: "Playing YouTube audio" }, { status: 400 });
  }

  try {
    const response = await fetch(
      `https://www.youtube.com/oembed?format=json&url=${encodeURIComponent(url)}`,
      { cache: "no-store" },
    );

    if (!response.ok) {
      return Response.json({ title: "Playing YouTube audio" });
    }

    const data = (await response.json()) as { title?: string };
    return Response.json({ title: data.title || "Playing YouTube audio" });
  } catch {
    return Response.json({ title: "Playing YouTube audio" });
  }
}

function isYouTubeUrl(value: string) {
  try {
    const parsed = new URL(value);
    const host = parsed.hostname.replace(/^www\./, "");
    return host === "youtube.com" || host === "music.youtube.com" || host === "youtu.be";
  } catch {
    return false;
  }
}
