# Office TV

Password-protected internal wallboard for collection metrics, total time saved, and a YouTube audio player.

## Setup

```bash
pnpm install
cp .env.example .env.local
pnpm dev
```

Open `http://localhost:3000`.

## Environment

```bash
DASHBOARD_PASSWORD=change-me
AUTH_SECRET=change-me-too
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_WORKER_KEY=your-worker-or-service-role-key
OFFICE_TV_COMPANY_IDS=ALL
OFFICE_TV_OFFICE_IDS=ALL
DISPLAY_CURRENCY=usd
```

- `DASHBOARD_PASSWORD` protects the public URL with one shared password.
- `AUTH_SECRET` salts the session cookie. Change it to invalidate sessions.
- `SUPABASE_URL` and `SUPABASE_WORKER_KEY` are used server-side for collected totals and time-saved counts. `NEXT_PUBLIC_SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` also work if you prefer the interval repo's existing names.
- `OFFICE_TV_COMPANY_IDS` and `OFFICE_TV_OFFICE_IDS` accept `ALL` for the whole company/office set, or comma-separated IDs if you ever want to narrow the TV.
- `DISPLAY_CURRENCY` defaults to `usd`.

## Metrics

- Net collected uses Supabase's `get_metrics_from_view` RPC, which sums the attributed `metrics_daily_aggregate` total.
- Monthly collected uses the same Supabase metric from the first day of the server's current month.
- Total time saved follows the Interval metrics page weights: calls 3 minutes, texts/emails 2 minutes, action items/promises/payment plans/payment plan follow-ups 3 minutes.

## Theme

- The light/dark toggle stores its preference in `localStorage` under `office-tv-theme`.
- Theme colors live in `src/app/globals.css`.

## Editing Map

- Dashboard UI: `src/app/page.tsx`
- YouTube control: `src/components/youtube-audio-player.tsx`
- Theme toggle: `src/components/theme-toggle.tsx`
- Combined metrics: `src/lib/dashboard-metrics.ts`
- Supabase collection totals: `src/lib/supabase-metrics.ts`
- Time saved formula: `src/lib/time-saved.ts`
- Password/session logic: `src/lib/auth.ts`, `src/proxy.ts`, `src/app/api/login/route.ts`
