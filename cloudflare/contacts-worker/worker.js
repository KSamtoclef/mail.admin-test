/**
 * Cloudflare Worker — D1 Contacts API
 *
 * Secure API layer between the application and a Cloudflare D1 `contacts` table.
 * The Worker never exposes D1 credentials or the auth token to the browser.
 *
 * Endpoints (all require Authorization: Bearer <WORKER_AUTH_TOKEN>):
 *   GET  /contacts/count      -> { total: number }
 *   POST /contacts/retrieve   -> { contacts: Contact[] }   body: { count: number }
 *   POST /contacts/import     -> { imported, skipped }      body: CSV text (text/csv)
 *
 * D1 binding (wrangler.toml):
 *   [[d1_databases]]
 *   binding = "CONTACTS_DB"
 *   database_name = "contacts-db"
 *   database_id = "<your-d1-database-id>"
 *
 * Secret:
 *   wrangler secret put WORKER_AUTH_TOKEN
 */

interface Contact {
  id: number;
  user_id: string | null;
  session_id: string | null;
  email: string;
  full_name: string | null;
  username: string | null;
  country: string | null;
}

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MAX_RETRIEVE = 50000;
const IMPORT_BATCH = 500;

export default {
  async fetch(request, env) {
    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: corsHeaders });
    }

    // Auth check — every request must carry the bearer token
    const authError = checkAuth(request, env);
    if (authError) return authError;

    const url = new URL(request.url);
    const path = url.pathname;

    try {
      if (path === "/contacts/count" && request.method === "GET") {
        return await handleCount(env);
      }
      if (path === "/contacts/retrieve" && request.method === "POST") {
        return await handleRetrieve(request, env);
      }
      if (path === "/contacts/import" && request.method === "POST") {
        return await handleImport(request, env);
      }
      return json({ error: "Not found" }, 404);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Internal error";
      return json({ error: message }, 500);
    }
  },
};

function checkAuth(request, env) {
  const token = env.WORKER_AUTH_TOKEN;
  if (!token) {
    return json({ error: "Worker auth token not configured" }, 500);
  }
  const header = request.headers.get("Authorization") || "";
  if (!header.startsWith("Bearer ")) {
    return json({ error: "Missing or malformed Authorization header" }, 401);
  }
  if (header.slice(7) !== token) {
    return json({ error: "Unauthorized" }, 401);
  }
  return null;
}

async function handleCount(env) {
  const result = await env.CONTACTS_DB.prepare("SELECT COUNT(*) as total FROM contacts").first();
  const total = result?.total ?? 0;
  return json({ total });
}

async function handleRetrieve(request, env) {
  let body;
  try {
    body = await request.json();
  } catch {
    return json({ error: "Invalid JSON body" }, 400);
  }

  const count = Number(body?.count);
  if (!Number.isFinite(count) || count <= 0) {
    return json({ error: "count must be a positive number" }, 400);
  }

  const limit = Math.min(Math.floor(count), MAX_RETRIEVE);
  const { results } = await env.CONTACTS_DB.prepare(
    "SELECT id, user_id, session_id, email, full_name, username, country FROM contacts ORDER BY id ASC LIMIT ?"
  ).bind(limit).all();

  return json({ contacts: results || [] });
}

async function handleImport(request, env) {
  const contentType = request.headers.get("Content-Type") || "";
  let csvText;

  if (contentType.includes("application/json")) {
    // JSON envelope: { csv: "..." } — lets the proxy forward the file content
    let body;
    try {
      body = await request.json();
    } catch {
      return json({ error: "Invalid JSON body" }, 400);
    }
    csvText = body?.csv;
  } else {
    csvText = await request.text();
  }

  if (!csvText || typeof csvText !== "string") {
    return json({ error: "No CSV content received" }, 400);
  }

  const rows = parseCsv(csvText);
  if (rows.length === 0) {
    return json({ imported: 0, skipped: 0, error: "No data rows found in CSV" }, 400);
  }

  // Find column indices from header row (case-insensitive)
  const header = rows[0].map((h) => h.trim().toLowerCase());
  const findCol = (...names) => header.findIndex((h) => names.includes(h));
  const col = {
    email: findCol("email"),
    full_name: findCol("full_name", "fullname", "full name"),
    username: findCol("username"),
    country: findCol("country"),
    user_id: findCol("user_id"),
    session_id: findCol("session_id"),
  };

  if (col.email === -1) {
    return json({ error: "CSV must contain an 'Email' column" }, 400);
  }

  let imported = 0;
  let skipped = 0;
  const seen = new Set();

  const stmt = env.CONTACTS_DB.prepare(
    "INSERT OR IGNORE INTO contacts (user_id, session_id, email, full_name, username, country) VALUES (?, ?, ?, ?, ?, ?)"
  );

  // Process in batches via D1 batch API
  for (let i = 1; i < rows.length; i += IMPORT_BATCH) {
    const batchRows = rows.slice(i, i + IMPORT_BATCH);
    const batch = [];

    for (const row of batchRows) {
      const emailRaw = (row[col.email] || "").trim().toLowerCase();
      if (!emailRaw || !EMAIL_REGEX.test(emailRaw) || seen.has(emailRaw)) {
        skipped++;
        continue;
      }
      seen.add(emailRaw);

      const username = col.username !== -1 ? (row[col.username] || "").trim() : "";
      const full_name_raw = col.full_name !== -1 ? (row[col.full_name] || "").trim() : "";
      const full_name = full_name_raw || username || null;
      const country_raw = col.country !== -1 ? (row[col.country] || "").trim() : "";
      const country = country_raw || "Nigeria";
      const user_id = col.user_id !== -1 ? (row[col.user_id] || "").trim() || null : null;
      const session_id = col.session_id !== -1 ? (row[col.session_id] || "").trim() || null : null;

      batch.push(stmt.bind(user_id, session_id, emailRaw, full_name, username || null, country));
    }

    if (batch.length > 0) {
      const results = await env.CONTACTS_DB.batch(batch);
      for (const r of results) {
        if (r.meta?.changes && r.meta.changes > 0) imported++;
        else skipped++;
      }
    }
  }

  return json({ imported, skipped });
}

/**
 * Minimal RFC-4180-ish CSV parser supporting quoted fields with commas
 * and doubled quotes inside quoted fields.
 */
function parseCsv(text) {
  const rows = [];
  let row = [];
  let field = "";
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    const next = text[i + 1];

    if (inQuotes) {
      if (char === '"') {
        if (next === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += char;
      }
    } else {
      if (char === '"') {
        inQuotes = true;
      } else if (char === ",") {
        row.push(field);
        field = "";
      } else if (char === "\n") {
        row.push(field);
        rows.push(row);
        row = [];
        field = "";
      } else if (char === "\r") {
        // skip — handled by \n
      } else {
        field += char;
      }
    }
  }
  // last field/row
  if (field.length > 0 || row.length > 0) {
    row.push(field);
    rows.push(row);
  }

  // Drop trailing empty rows
  while (rows.length && rows[rows.length - 1].length === 1 && rows[rows.length - 1][0] === "") {
    rows.pop();
  }

  return rows;
}

function json(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
