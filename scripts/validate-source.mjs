import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const failures = [];
const ok = (condition, message) => { if (!condition) failures.push(message); };
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');
const exists = (file) => fs.existsSync(path.join(root, file));

const required = [
  'src/lib/supabase.ts',
  'src/lib/services.ts',
  'src/types/database.ts',
  'supabase/migrations/20260809081700_0000_prepare_connected_mail_admin.sql',
  'supabase/migrations/20260809081748_0001_admin_profiles.sql',
  'supabase/migrations/20260809081758_0002_recipients.sql',
  'supabase/migrations/20260809081835_0005_campaigns.sql',
  'supabase/migrations/20260809120000_0011_import_legacy_contacts.sql',
  'supabase/functions/send-campaign/index.ts',
  'supabase/functions/send-test-email/index.ts',
  'supabase/functions/test-provider/index.ts',
  'supabase/functions/resend-webhook/index.ts',
  'supabase/functions/resend-domains/index.ts',
  '.env.example',
  '.gitignore',
  'vercel.json',
];
for (const file of required) ok(exists(file), `Missing required file: ${file}`);

if (!failures.length) {
  const types = read('src/types/database.ts');
  ok(/username:\s*string\s*\|\s*null/.test(types), 'Recipient.username is missing from database types.');
  ok(/d1_contact_count:\s*number/.test(types), 'Campaign.d1_contact_count is missing from database types.');
  for (const status of ['delivered', 'bounced', 'complained']) ok(types.includes(`'${status}'`), `Campaign recipient status '${status}' is missing.`);

  const services = read('src/lib/services.ts');
  ok(services.includes("functions.invoke('resend-domains'"), 'Dashboard must invoke the canonical resend-domains function name.');
  ok(!services.includes('resend-domains?action='), 'Stale query-string Edge Function slug remains in services.ts.');

  const adminMigration = read('supabase/migrations/20260809081748_0001_admin_profiles.sql');
  ok(!/CREATE\s+POLICY\s+"admin_insert_profiles"/i.test(adminMigration), 'Admin self-promotion insert policy must not exist.');
  ok(/DROP\s+POLICY\s+IF\s+EXISTS\s+"admin_insert_profiles"/i.test(adminMigration), 'Admin insert policy cleanup is missing.');

  const recipientsMigration = read('supabase/migrations/20260809081758_0002_recipients.sql');
  ok(/\busername\s+text\b/i.test(recipientsMigration), 'Recipients migration is missing username.');

  const campaignsMigration = read('supabase/migrations/20260809081835_0005_campaigns.sql');
  ok(/\bd1_contact_count\s+integer\b/i.test(campaignsMigration), 'Campaigns migration is missing d1_contact_count.');

  for (const file of [
    'supabase/functions/send-campaign/index.ts',
    'supabase/functions/send-test-email/index.ts',
    'supabase/functions/test-provider/index.ts',
  ]) {
    const source = read(file);
    ok(source.includes('auth.getUser'), `${file} must verify the authenticated user.`);
    ok(source.includes('admin_profiles'), `${file} must verify admin membership.`);
  }

  const webhook = read('supabase/functions/resend-webhook/index.ts');
  ok(webhook.includes('verifySvixSignature'), 'Resend webhook signature verification is missing.');
  ok(webhook.includes('toLowerCase()'), 'Webhook suppression email normalization is missing.');

  const domains = read('supabase/functions/resend-domains/index.ts');
  ok(domains.includes('admin_profiles'), 'Resend domain management must verify admin membership.');
  ok(domains.includes('RESEND_API_KEY'), 'Resend domain management must use the server-side Resend secret.');

  const gitignore = read('.gitignore');
  ok(/(^|\n)\.env(\n|$)/.test(gitignore), '.env must remain ignored.');
  const envExample = read('.env.example');
  ok(envExample.includes('YOUR_PROJECT_REF') && envExample.includes('YOUR_SUPABASE_PUBLISHABLE_OR_ANON_KEY'), '.env.example must contain placeholders only.');

  const vercel = read('vercel.json');
  ok(vercel.includes('"dest": "/index.html"'), 'Vercel SPA fallback routing is missing.');
}

const forbidden = [
  'gngsqjiceifkxazekppq',
  'SUPABASE_SERVICE_ROLE_KEY=',
  'RESEND_API_KEY=re_',
];

function walk(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (['.git', 'node_modules', 'dist'].includes(entry.name)) continue;
    const absolute = path.join(dir, entry.name);
    const relative = path.relative(root, absolute).replaceAll('\\', '/');
    if (entry.isDirectory()) {
      if (relative === '.bolt') failures.push('Bolt workspace metadata must not be committed.');
      else walk(absolute);
      continue;
    }
    if (relative === 'scripts/validate-source.mjs') continue;
    if (!/\.(?:ts|tsx|js|mjs|json|sql|md|html|toml|example|gitignore)$/i.test(entry.name) && !['.env.example', '.gitignore'].includes(entry.name)) continue;
    const text = fs.readFileSync(absolute, 'utf8');
    for (const token of forbidden) if (text.includes(token)) failures.push(`Forbidden production token '${token}' found in ${relative}.`);
    if (/eyJhbGciOiJ[A-Za-z0-9_-]*\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/.test(text)) failures.push(`JWT-like credential found in ${relative}.`);
  }
}
walk(root);

if (failures.length) {
  console.error(`Mail Admin source validation failed with ${failures.length} issue(s):`);
  for (const failure of [...new Set(failures)]) console.error(`- ${failure}`);
  process.exit(1);
}

console.log('Mail Admin source validation passed.');
console.log('Verified schema compatibility, admin authorization, secret hygiene, webhook integrity, legacy-contact preservation, and Vercel SPA routing.');
