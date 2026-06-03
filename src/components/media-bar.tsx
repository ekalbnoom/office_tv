import type { NowPlaying } from "@/lib/spotify";
import { JamLive } from "@/components/jam-live";
import { NowPlayingLive } from "@/components/now-playing-live";

// Bottom media row: the left slot is the active audio source (Spotify Now
// Playing takes over when something is playing, otherwise the YouTube player,
// updated live by NowPlayingLive), and the Jam QR sits alongside it on the right.
export function MediaBar({
  nowPlaying,
  jamQrDataUrl,
  spotifyConfigured,
}: {
  nowPlaying: NowPlaying | null;
  jamQrDataUrl: string | null;
  spotifyConfigured: boolean;
}) {
  return (
    <div className="flex flex-col gap-4 lg:flex-row lg:items-start">
      <div className="min-w-0 flex-1">
        <NowPlayingLive initial={nowPlaying} configured={spotifyConfigured} />
      </div>
      <JamLive initialQrDataUrl={jamQrDataUrl} />
    </div>
  );
}
