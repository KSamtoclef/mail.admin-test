# Mail Admin Test

React + Vite administration console for email campaigns, recipient audiences, templates, Resend delivery analytics, suppressions, sender-domain verification, test sending and Cloudflare D1 contact import.

## Frontend environment

Copy `.env.example` to `.env` and set only the public Supabase project URL and publishable/anon key. Never commit `.env`.

## Supabase Edge Function secrets

Configure these server-side in Supabase:

- `RESEND_API_KEY`
- `RESEND_WEBHOOK_SECRET`
- `DEFAULT_FROM_EMAIL`
- `D1_WORKER_ENDPOINT`
- `D1_WORKER_AUTH_TOKEN`

## Admin security

Admin users must already exist in Supabase Auth and then be provisioned server-side in `public.admin_profiles`. Browser users cannot create or modify their own admin role.

## Local development

```bash
npm install
npm run dev
```

Deploy the Supabase migrations and Edge Functions only to the Supabase project chosen for this rebuild.
