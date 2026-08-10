import { createClient } from "jsr:@supabase/supabase-js@2";

export async function requireAdmin(req: Request) {
  const authHeader = req.headers.get("Authorization") ?? "";
  if (!authHeader.startsWith("Bearer ")) {
    return { ok: false as const, response: json({ error: "Unauthorized" }, 401) };
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  if (!supabaseUrl || !serviceRoleKey) {
    return { ok: false as const, response: json({ error: "Server configuration is incomplete" }, 500) };
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey);
  const token = authHeader.slice(7);
  const { data: userData, error: authError } = await supabase.auth.getUser(token);
  if (authError || !userData.user) {
    return { ok: false as const, response: json({ error: "Unauthorized" }, 401) };
  }

  const { data: adminProfile, error: adminError } = await supabase
    .from("admin_profiles")
    .select("id")
    .eq("user_id", userData.user.id)
    .maybeSingle();

  if (adminError || !adminProfile) {
    return { ok: false as const, response: json({ error: "Admin access required" }, 403) };
  }

  return { ok: true as const, supabase, user: userData.user };
}

function json(body: unknown, status: number) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}
