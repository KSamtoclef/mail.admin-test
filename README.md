# Mail Admin Dashboard

Audited React + TypeScript rebuild of the Mail Admin operations dashboard.

## Frontend environment variables

Set these in Vercel (do not commit real values):

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY` (or the current Supabase publishable key)

The production frontend must point to the connected Supabase `mail-admin` project.

## Supabase Edge Function secrets

Configure these in the connected Supabase project before using provider/send features:

- `RESEND_API_KEY`
- `DEFAULT_FROM_EMAIL`
- `RESEND_WEBHOOK_SECRET`
- `D1_WORKER_ENDPOINT` (only if using the Cloudflare D1 contacts worker)
- `D1_WORKER_AUTH_TOKEN` (only if using the Cloudflare D1 contacts worker)

`SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` are supplied by the Supabase Edge Functions runtime.

## Security model

Dashboard routes use Supabase Auth. A signed-in user must also have a matching row in `public.admin_profiles` before protected data or server functions are available. Admin membership is provisioned server-side only; users cannot self-promote from the browser.

## Database migrations

Run migrations in filename order. The compatibility migration preserves the old Mail Admin tables where schemas conflict, and the final legacy-contact migration copies the existing contact audience into the rebuilt `recipients` model without deleting the historical `contacts` table.

## Deployment

- Frontend: Vercel/Vite
- Database/Auth/Edge Functions: Supabase
- Email provider: Resend
- Optional large external contact source: Cloudflare D1 worker
