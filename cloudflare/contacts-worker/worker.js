/**
 * Cloudflare Worker — D1 Contacts API
 *
 * Secure API layer between the Mail Admin app and a Cloudflare D1 `contacts` table.
 * The browser never talks to this Worker directly; the Supabase edge function
 * `contacts-proxy` calls it using the WORKER_AUTH_TOKEN secret.
 *
 * Endpoints (all require `Authorization: Bearer <WORKER_AUTH_TOKEN>`):
 *   GET  /contacts/count       -> { total: number }
 *   POST /contacts/retrieve    body: { count: number }  -> { contacts: Contact[] }
 *   POST /contacts/import      multipart/form-data field "file" (CSV) -> { imported, skipped }
 *
 * D1 binding:  [[d1_databases]]  (see wrangler.toml)
 * Secret:       WORKER_AUTH_TOKEN  (set via `wrangler secret put WORKER_AUTH_TOKEN`)
 */

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const CSV_BATCH_SIZE = 50;

function json(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    },
  });
}

function parseCSV(text) {
  const lines = text.split(/\r?\n/).filter((l) => l.trim() !== '');
  if (lines.length === 0) return [];

  const header = lines[0].split(',').map((h) => h.trim().toLowerCase());
  const findCol = (...names) => header.findIndex((h) => names.includes(h));

  const emailIdx = findCol('email');
  const fullNameIdx = findCol('fullname', 'full_name', 'full name');
  const usernameIdx = findCol('username');
  const countryIdx = findCol('country');
  const userIdIdx = findCol('user_id');
  const sessionIdIdx = findCol('session_id');

  if (emailIdx === -1) {
    throw new Error('CSV must contain an "Email" column');
  }

  const rows = [];
  for (let i = 1; i < lines.length; i++) {
    const cells = lines[i].split(',');
    const username = usernameIdx >= 0 ? (cells[usernameIdx] || '').trim() : '';
    const fullNameRaw = fullNameIdx >= 0 ? (cells[fullNameIdx] || '').trim() : '';
    const countryRaw = countryIdx >= 0 ? (cells[countryIdx] || '').trim() : '';

    rows.push({
      email: (cells[emailIdx] || '').trim(),
      full_name: fullNameRaw || username,
      username,
      country: countryRaw || 'Nigeria',
      user_id: userIdIdx >= 0 ? (cells[userIdIdx] || '').trim() : '',
      session_id: sessionIdIdx >= 0 ? (cells[sessionIdIdx] || '').trim() : '',
    });
  }
  return rows;
}

export default {
  async fetch(request, env) {
    if (request.method === 'OPTIONS') {
      return new Response(null, {
        status: 204,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        },
      });
    }

    const header = request.headers.get('Authorization') || '';
    const token = header.startsWith('Bearer ') ? header.slice(7) : '';
    if (token === '' || token !== (env.WORKER_AUTH_TOKEN || '')) {
      return json({ error: 'Unauthorized' }, 401);
    }

    const db = env.DB;
    if (!db) {
      return json({ error: 'D1 database binding "DB" is not configured' }, 500);
    }

    const url = new URL(request.url);
    const path = url.pathname.replace(/\/$/, '');

    try {
      if (path === '/contacts/count' && request.method === 'GET') {
        const result = await db.prepare('SELECT COUNT(*) as total FROM contacts').first();
        return json({ total: result?.total ?? 0 });
      }

      if (path === '/contacts/retrieve' && request.method === 'POST') {
        let count;
        try {
          const body = await request.json();
          count = Number(body.count);
        } catch {
          return json({ error: 'Invalid JSON body' }, 400);
        }
        if (!Number.isFinite(count) || count < 1) {
          return json({ error: 'count must be a positive integer' }, 400);
        }
        count = Math.min(Math.floor(count), 50000);

        const contacts = await db
          .prepare('SELECT id, user_id, session_id, email, full_name, username, country FROM contacts LIMIT ?')
          .bind(count)
          .all();
        return json({ contacts: contacts.results || [] });
      }

      if (path === '/contacts/import' && request.method === 'POST') {
        const formData = await request.formData();
        const file = formData.get('file');
        if (!file || typeof file.text !== 'function') {
          return json({ error: 'CSV file is required (field "file")' }, 400);
        }

        const text = await file.text();
        let rows;
        try {
          rows = parseCSV(text);
        } catch (err) {
          return json({ error: err.message }, 400);
        }

        let imported = 0;
        let skipped = 0;

        for (let i = 0; i < rows.length; i += CSV_BATCH_SIZE) {
          const batch = rows.slice(i, i + CSV_BATCH_SIZE);
          const stmts = [];

          for (const row of batch) {
            const email = row.email.toLowerCase();
            if (!EMAIL_REGEX.test(email)) {
              skipped++;
              continue;
            }
            stmts.push(
              db
                .prepare('INSERT OR IGNORE INTO contacts (user_id, session_id, email, full_name, username, country) VALUES (?, ?, ?, ?, ?, ?)')
                .bind(row.user_id || null, row.session_id || null, email, row.full_name || null, row.username || null, row.country)
            );
          }

          if (stmts.length === 0) continue;

          const results = await db.batch(stmts);
          for (const r of results) {
            if (r.meta && r.meta.changes > 0) imported++;
            else skipped++;
          }
        }

        return json({ imported, skipped });
      }

      return json({ error: 'Not found' }, 404);
    } catch (err) {
      return json({ error: err instanceof Error ? err.message : 'Internal error' }, 500);
    }
  },
};
