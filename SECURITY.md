# Security Notes

## Secrets

Never commit production credentials. Frontend deployment uses only the public Supabase URL and publishable/anon key. Resend, webhook, D1 worker, and service-role credentials belong in server-side platform secrets.

## Admin authorization

A valid Supabase Auth session is not enough to access the dashboard backend. The user must also have a server-provisioned row in `public.admin_profiles`.

## CI security gate

The verification workflow blocks deployments when `npm audit --omit=dev --audit-level=high` reports a high-severity production dependency advisory. Source validation also checks for old project references, JWT-like credentials, admin self-promotion policies, and missing backend authorization checks.

## Router advisory

React Router 6 currently has moderate advisories whose npm-provided remediation is a major-version upgrade to React Router 7. That upgrade should be performed as a deliberate navigation migration with full route regression testing rather than an automatic forced update.
