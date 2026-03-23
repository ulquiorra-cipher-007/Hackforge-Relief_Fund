// supabase/functions/create-org-user/index.ts
//
// Supabase Edge Function — runs server-side with the service_role key.
// This is the ONLY place that calls auth.admin.createUser.
// The browser (anon key) cannot call admin APIs — this is intentional.
//
// Deploy:
//   supabase functions deploy create-org-user
//
// The function is called from create-org.html via supabase.functions.invoke().

import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin":  "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req: Request) => {

  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    // ── Parse request body ──────────────────────────────────────────────────
    const { name, org_id, type, description, email, password } = await req.json();

    // Basic server-side validation
    if (!name || !org_id || !email || !password) {
      return jsonError("name, org_id, email and password are required.", 400);
    }
    if (!/^[a-z0-9-]+$/.test(org_id)) {
      return jsonError("org_id must be lowercase letters, numbers and hyphens only.", 400);
    }
    if (password.length < 8) {
      return jsonError("Password must be at least 8 characters.", 400);
    }

    // ── Create admin client using the service_role key ──────────────────────
    // These env vars are automatically available in Supabase Edge Functions.
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      { auth: { autoRefreshToken: false, persistSession: false } }
    );

    // ── Check org_id is unique before creating the auth user ────────────────
    const { data: existing } = await supabaseAdmin
      .from("organisations")
      .select("org_id")
      .eq("org_id", org_id)
      .maybeSingle();

    if (existing) {
      return jsonError(`An organisation with id "${org_id}" already exists.`, 409);
    }

    // ── Create the Supabase Auth user ────────────────────────────────────────
    // email_confirm: true  →  user can log in immediately without email confirmation
    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    });

    if (authError) {
      return jsonError(`Auth error: ${authError.message}`, 400);
    }

    const authUserId = authData.user.id;

    // ── Insert the organisations row linked to the auth user ─────────────────
    const { error: dbError } = await supabaseAdmin
      .from("organisations")
      .insert({
        auth_user_id: authUserId,   // FK → auth.users.id
        org_id:       org_id,
        name:         name,
        type:         type         || null,
        description:  description  || null,
        login_email:  email,
        is_active:    true,
      });

    if (dbError) {
      // If DB insert fails, clean up the auth user to avoid orphaned accounts
      await supabaseAdmin.auth.admin.deleteUser(authUserId);
      return jsonError(`Database error: ${dbError.message}`, 500);
    }

    // ── Return success ───────────────────────────────────────────────────────
    return new Response(
      JSON.stringify({ success: true, auth_user_id: authUserId, org_id }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
    );

  } catch (err) {
    return jsonError(`Unexpected error: ${err.message}`, 500);
  }
});

function jsonError(message: string, status: number) {
  return new Response(
    JSON.stringify({ error: message }),
    { headers: { ...corsHeaders, "Content-Type": "application/json" }, status }
  );
}
