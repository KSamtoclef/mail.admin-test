/**
 * Cloudflare Worker — D1 Contacts API
 * Secure API layer between Mail Admin and the D1 contacts table.
 */

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MAX_RETRIEVE = 50000;
const IMPORT_BATCH = 50;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

export default {
  async fetch(request, env) {
    if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: corsHeaders });

    const authError = checkAuth(request, env);
    if (authError) return authError;

    const db = env.DB;
    if (!db) return json({ error: 'D1 database binding "DB" is not configured' }, 500);

    const path = new URL(request.url).pathname.replace(/\/$/, "");

    try {
      if (path === "/contacts/count" && request.method === "GET") {
        const result = await db.prepare("SELECT COUNT(*) as total FROM contacts").first();
        return json({ total: result?.total ?? 0 });
      }
      if (path === "/contacts/retrieve" && request.method === "POST") return await handleRetrieve(request, db);
      if (path === "/contacts/import" && request.method === "POST") return await handleImport(request, db);
      return json({ error: "Not found" }, 404);
    } catch (err) {
      return json({ error: err instanceof Error ? err.message : "Internal error" }, 500);
    }
  },
};

function checkAuth(request, env) {
  const expected = env.WORKER_AUTH_TOKEN || "";
  const header = request.headers.get("Authorization") || "";
  if (!expected) return json({ error: "Worker auth token not configured" }, 500);
  if (!header.startsWith("Bearer ")) return json({ error: "Missing Authorization header" }, 401);
  if (header.slice(7) !== expected) return json({ error: "Unauthorized" }, 401);
  return null;
}

async function handleRetrieve(request, db) {
  let body;
  try { body = await request.json(); } catch { return json({ error: "Invalid JSON body" }, 400); }
  const count = Number(body?.count);
  if (!Number.isFinite(count) || count < 1) return json({ error: "count must be a positive integer" }, 400);
  const limit = Math.min(Math.floor(count), MAX_RETRIEVE);
  const { results } = await db.prepare(
    "SELECT id, user_id, session_id, email, full_name, username, country FROM contacts ORDER BY id ASC LIMIT ?"
  ).bind(limit).all();
  return json({ contacts: results || [] });
}

async function handleImport(request, db) {
  const contentType = request.headers.get("Content-Type") || "";
  let csvText = "";

  if (contentType.includes("multipart/form-data")) {
    const formData = await request.formData();
    const file = formData.get("file");
    if (!file || typeof file.text !== "function") return json({ error: 'CSV file is required in field "file"' }, 400);
    csvText = await file.text();
  } else if (contentType.includes("application/json")) {
    let body;
    try { body = await request.json(); } catch { return json({ error: "Invalid JSON body" }, 400); }
    csvText = typeof body?.csv === "string" ? body.csv : "";
  } else {
    csvText = await request.text();
  }

  if (!csvText) return json({ error: "No CSV content received" }, 400);
  const rows = parseCsv(csvText);
  if (rows.length < 2) return json({ imported: 0, skipped: 0, error: "No data rows found in CSV" }, 400);

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
  if (col.email === -1) return json({ error: "CSV must contain an Email column" }, 400);

  let imported = 0;
  let skipped = 0;
  const seen = new Set();
  const stmt = db.prepare(
    "INSERT OR IGNORE INTO contacts (user_id, session_id, email, full_name, username, country) VALUES (?, ?, ?, ?, ?, ?)"
  );

  for (let i = 1; i < rows.length; i += IMPORT_BATCH) {
    const batch = [];
    for (const row of rows.slice(i, i + IMPORT_BATCH)) {
      const email = (row[col.email] || "").trim().toLowerCase();
      if (!EMAIL_REGEX.test(email) || seen.has(email)) { skipped++; continue; }
      seen.add(email);
      const username = col.username >= 0 ? (row[col.username] || "").trim() : "";
      const fullName = col.full_name >= 0 ? (row[col.full_name] || "").trim() : "";
      const country = col.country >= 0 ? (row[col.country] || "").trim() : "";
      const userId = col.user_id >= 0 ? (row[col.user_id] || "").trim() : "";
      const sessionId = col.session_id >= 0 ? (row[col.session_id] || "").trim() : "";
      batch.push(stmt.bind(userId || null, sessionId || null, email, fullName || username || null, username || null, country || "Nigeria"));
    }
    if (!batch.length) continue;
    const results = await db.batch(batch);
    for (const result of results) {
      if (result.meta?.changes > 0) imported++; else skipped++;
    }
  }

  return json({ imported, skipped });
}

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
        if (next === '"') { field += '"'; i++; } else inQuotes = false;
      } else field += char;
    } else if (char === '"') inQuotes = true;
    else if (char === ",") { row.push(field); field = ""; }
    else if (char === "\n") { row.push(field); rows.push(row); row = []; field = ""; }
    else if (char !== "\r") field += char;
  }
  if (field.length || row.length) { row.push(field); rows.push(row); }
  while (rows.length && rows[rows.length - 1].length === 1 && rows[rows.length - 1][0] === "") rows.pop();
  return rows;
}

function json(body, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}
