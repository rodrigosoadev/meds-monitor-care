// Supabase Edge Function: check-doses
// Purpose: scaffolding for periodic dose verification.
// Future use: invoke from a scheduled cron (pg_cron + pg_net) to scan for
// upcoming doses and send push/email notifications to users.
//
// Trigger manually:
//   curl -X POST "<SUPABASE_URL>/functions/v1/check-doses" \
//     -H "Authorization: Bearer <ANON_KEY>"

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const today = new Date().toISOString().slice(0, 10);

    // Pull today's pending logs across all users.
    const { data: pending, error } = await supabase
      .from("adherence_logs")
      .select("id, user_id, medication_id, scheduled_time, status")
      .eq("scheduled_date", today)
      .eq("status", "pending");

    if (error) throw error;

    // TODO: For each pending dose past its scheduled_time + grace window,
    // queue a notification (email/push) here. For now we just report counts.
    const summary = {
      date: today,
      pending: pending?.length ?? 0,
      processed_at: new Date().toISOString(),
    };

    return new Response(JSON.stringify(summary), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "unknown error";
    return new Response(JSON.stringify({ error: msg }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
