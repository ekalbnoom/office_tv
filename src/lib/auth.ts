export const AUTH_COOKIE_NAME = "office_tv_session";
export const SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 30;

const encoder = new TextEncoder();

export function isPasswordConfigured() {
  return Boolean(process.env.DASHBOARD_PASSWORD);
}

export async function verifyDashboardPassword(candidate: string) {
  const expected = await createSessionToken();
  const actual = await hashSecret(candidate);
  return Boolean(expected) && expected === actual;
}

export async function createSessionToken() {
  return hashSecret(process.env.DASHBOARD_PASSWORD ?? "");
}

export async function isSessionCookieValid(value: string | undefined) {
  if (!value) {
    return false;
  }

  const expected = await createSessionToken();
  return Boolean(expected) && value === expected;
}

async function hashSecret(secret: string) {
  if (!secret) {
    return "";
  }

  const salt = process.env.AUTH_SECRET ?? "office-tv";
  const digest = await crypto.subtle.digest("SHA-256", encoder.encode(`${salt}:${secret}`));
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}
