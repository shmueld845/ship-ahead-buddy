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

    const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Verify caller via JWT in authorization header
    const authHeader = req.headers.get("authorization") ?? "";
    const token = authHeader.replace(/^Bearer\s+/i, "").trim();
    if (!token) {
      console.log("No bearer token in authorization header");
      return json({ error: "Not authenticated" }, 401);
    }

    const { data: userData, error: userErr } = await admin.auth.getUser(token);
    if (userErr || !userData?.user) {
      console.log("getUser failed:", userErr?.message);
      return json({ error: "Not authenticated" }, 401);
    }
    const caller = userData.user;
    console.log("Caller:", caller.email, caller.id);

    // Check admin role
    const { data: isAdmin, error: roleErr } = await admin.rpc("has_role", {
      _user_id: caller.id,
      _role: "admin",
    });
    if (roleErr) {
      console.log("has_role error:", roleErr.message);
      return json({ error: "Role check failed: " + roleErr.message }, 500);
    }
    if (!isAdmin) {
      console.log("Caller is not admin");
      return json({ error: "Admin access required" }, 403);
    }

    const { email, password, display_name, roles } = await req.json();
    if (!email || !password) return json({ error: "Email and password required" }, 400);

    // Create user
    const { data: newUser, error: createErr } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { display_name: display_name || email.split("@")[0] },
    });
    if (createErr) {
      console.log("createUser failed:", createErr.message);
      return json({ error: createErr.message }, 400);
    }
    console.log("Created user:", newUser.user.id);

    // Assign roles (the trigger already assigns 'rep', so add others if needed)
    if (roles && Array.isArray(roles)) {
      for (const role of roles) {
        if (["admin", "processor", "rep"].includes(role)) {
          const { error: roleInsertErr } = await admin
            .from("user_roles")
            .upsert(
              { user_id: newUser.user.id, role },
              { onConflict: "user_id,role" }
            );
          if (roleInsertErr) console.log(`Role ${role} insert error:`, roleInsertErr.message);
        }
      }
    }

    return json({ ok: true, user_id: newUser.user.id });
  } catch (e: any) {
    console.log("Unhandled error:", e.message);
    return json({ error: e.message }, 500);
  }
});

function json(body: any, status = 200) {
  return new Response(JSON.stringify(body), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
    status,
  });
}
