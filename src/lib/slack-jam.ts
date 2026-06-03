const HISTORY_URL = "https://slack.com/api/conversations.history";

// Spotify Jam invite links are spotify.link short links; open.spotify.com is
// also accepted. The character class stops at Slack's link delimiters (< > |).
const SPOTIFY_LINK_RE = /https?:\/\/(?:open\.spotify\.com|spotify\.link)\/[^\s|>]+/i;

// A message like "clear jam" / "end jam" / "stop jam" takes the QR down.
const CLEAR_RE = /\b(?:clear|end|stop|kill)\s+jam\b/i;

const DEFAULT_MAX_AGE_MINUTES = 180;

export type JamLink = {
  url: string;
  postedAt: number; // epoch ms
};

type SlackMessage = { text?: string; ts?: string };
type SlackHistoryResponse = { ok?: boolean; messages?: SlackMessage[]; error?: string };

function getSlackConfig() {
  const token = process.env.SLACK_BOT_TOKEN;
  const channel = process.env.SLACK_JAM_CHANNEL_ID;

  if (!token || !channel) {
    return null;
  }

  return { token, channel };
}

function getMaxAgeMs() {
  const minutes = Number(process.env.JAM_LINK_MAX_AGE_MINUTES);
  const safe = Number.isFinite(minutes) && minutes > 0 ? minutes : DEFAULT_MAX_AGE_MINUTES;
  return safe * 60_000;
}

export async function getLatestJamLink(): Promise<JamLink | null> {
  const config = getSlackConfig();

  if (!config) {
    return null;
  }

  let response: Response;

  try {
    const params = new URLSearchParams({ channel: config.channel, limit: "40" });
    response = await fetch(`${HISTORY_URL}?${params.toString()}`, {
      headers: { Authorization: `Bearer ${config.token}` },
      cache: "no-store",
    });
  } catch {
    return null;
  }

  if (!response.ok) {
    console.warn(`[jam] Slack conversations.history HTTP ${response.status}`);
    return null;
  }

  let data: SlackHistoryResponse;

  try {
    data = (await response.json()) as SlackHistoryResponse;
  } catch {
    return null;
  }

  // Slack returns ok:false with an error string (e.g. not_in_channel,
  // invalid_auth, channel_not_found) rather than an HTTP error, so the common
  // setup mistakes surface here. Log it so they're debuggable from the dev log.
  if (!data.ok) {
    console.warn(`[jam] Slack error: ${data.error ?? "unknown"}`);
    return null;
  }

  if (!data.messages) {
    return null;
  }

  const maxAgeMs = getMaxAgeMs();
  const now = Date.now();

  // Messages arrive newest-first. Walk from the top: a "clear jam" before any
  // link means the host took it down; otherwise the newest Spotify link wins.
  for (const message of data.messages) {
    const text = message.text ?? "";

    if (CLEAR_RE.test(text)) {
      return null;
    }

    const match = text.match(SPOTIFY_LINK_RE);

    if (match) {
      const postedAt = Number(message.ts) * 1000;

      // Stale Jam links shouldn't linger on the TV overnight.
      if (Number.isFinite(postedAt) && now - postedAt > maxAgeMs) {
        return null;
      }

      return {
        url: match[0],
        postedAt: Number.isFinite(postedAt) ? postedAt : now,
      };
    }
  }

  return null;
}
