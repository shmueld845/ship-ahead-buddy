import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    // Verify caller is admin
    const authHeader = req.headers.get("authorization") ?? "";
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const callerClient = createClient(SUPABASE_URL, anonKey, {
      global: { headers: { authorization: authHeader } },
    });
    const { data: { user: caller } } = await callerClient.auth.getUser();
    if (!caller) return json({ error: "Not authenticated" }, 401);

    const { data: isAdmin } = await createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)
      .rpc("has_role", { _user_id: caller.id, _role: "admin" });
    if (!isAdmin) return json({ error: "Admin access required" }, 403);

    const { email, password, display_name, roles } = await req.json();
    if (!email || !password) return json({ error: "Email and password required" }, 400);

    const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Create user
    const { data: newUser, error: createErr } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { display_name: display_name || email.split("@")[0] },
    });
    if (createErr) return json({ error: createErr.message }, 400);

    // Assign roles (the trigger already assigns 'rep', so add others if needed)
    if (roles && Array.isArray(roles)) {
      for (const role of roles) {
        if (["admin", "processor", "rep"].includes(role)) {
          await admin.from("user_roles").upsert(
            { user_id: newUser.user.id, role },
            { onConflict: "user_id,role" }
          );
        }
      }
    }

    return json({ ok: true, user_id: newUser.user.id });
  } catch (e: any) {
    return json({ error: e.message }, 500);
  }
});

function json(body: any, status = 200) {
  return new Response(JSON.stringify(body), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
    status,
  });
}
