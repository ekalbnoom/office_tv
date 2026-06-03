import type { NowPlaying } from "@/lib/spotify";
import { NowPlayingLive } from "@/components/now-playing-live";

// Bottom media row: the active audio source + controls (Spotify Now Playing
// takes over when something is playing, otherwise the YouTube player). The Jam
// QR now floats top-right (see page.tsx), so it's no longer in this row.
export function MediaBar({
  nowPlaying,
  spotifyConfigured,
}: {
  nowPlaying: NowPlaying | null;
  spotifyConfigured: boolean;
}) {
  return (
    <div className="min-w-0 flex-1">
      <NowPlayingLive initial={nowPlaying} configured={spotifyConfigured} />
    </div>
  );
}
