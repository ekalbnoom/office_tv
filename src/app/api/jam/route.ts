import QRCode from "qrcode";
import { getLatestJamLink } from "@/lib/slack-jam";

// Lightweight endpoint the Jam widget polls so a freshly-posted link (or a
// "clear jam") shows up within seconds instead of the 60s full-page refresh.
export async function GET() {
  const jam = await getLatestJamLink().catch(() => null);

  let qrDataUrl: string | null = null;

  if (jam) {
    try {
      qrDataUrl = await QRCode.toDataURL(jam.url, { margin: 1, width: 400 });
    } catch {
      qrDataUrl = null;
    }
  }

  return Response.json({ qrDataUrl }, { headers: { "Cache-Control": "no-store" } });
}
