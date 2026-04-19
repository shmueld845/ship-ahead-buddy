import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const { data: settings } = await supabase
      .from("app_settings").select("processor_email").eq("id", 1).maybeSingle();
    const processorEmail = settings?.processor_email;
    if (!processorEmail) return json({ ok: false, reason: "no_processor_email" });

    let body: any = {};
    try { body = await req.json(); } catch { /* cron call has no body */ }

    // ── Mode 1: New shipment notification (called immediately on insert) ──
    if (body?.type === "new_shipment" && body?.shipment_id) {
      const { data: s, error } = await supabase
        .from("shipments")
        .select("id, order_number, customer, notes, ship_date, created_notified_at")
        .eq("id", body.shipment_id)
        .maybeSingle();
      if (error) throw error;
      if (!s) return json({ ok: false, reason: "shipment_not_found" });
      if (s.created_notified_at) return json({ ok: true, message: "already notified" });

      const sent = await sendEmail(processorEmail, newShipmentSubject(s), newShipmentHtml(s));
      await supabase.from("shipments")
        .update({ created_notified_at: new Date().toISOString() })
        .eq("id", s.id);
      return json({ ok: true, mode: "new_shipment", emailSent: sent.ok, error: sent.error });
    }

    // ── Mode 2: Daily reminder sweep ──
    const today = new Date().toISOString().slice(0, 10);
    const { data: due, error } = await supabase
      .from("shipments")
      .select("id, order_number, customer, notes, ship_date, reminder_date")
      .lte("reminder_date", today)
      .is("reminder_notified_at", null)
      .in("status", ["pending", "processing"]);
    if (error) throw error;
    if (!due || due.length === 0) return json({ ok: true, sent: 0, message: "no reminders due" });

    const html = reminderDigestHtml(due);
    const sent = await sendEmail(
      processorEmail,
      `${due.length} shipment ${due.length === 1 ? "reminder" : "reminders"} due`,
      html
    );
    await supabase.from("shipments")
      .update({ reminder_notified_at: new Date().toISOString() })
      .in("id", due.map((s: any) => s.id));
    return json({ ok: true, mode: "reminder_sweep", count: due.length, emailSent: sent.ok, error: sent.error });
  } catch (e: any) {
    return json({ ok: false, error: e.message }, 500);
  }
});

async function sendEmail(to: string, subject: string, html: string) {
  if (!RESEND_API_KEY) return { ok: false, error: "RESEND_API_KEY not configured" };
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { "Authorization": `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: "ShipQueue <onboarding@resend.dev>",
        to: [to],
        subject,
        html,
      }),
    });
    const text = await res.text();
    if (!res.ok) return { ok: false, error: `${res.status} ${text}` };
    return { ok: true, error: null };
  } catch (e: any) {
    return { ok: false, error: e.message };
  }
}

function newShipmentSubject(s: any) {
  return `New shipment #${s.order_number} — ship ${s.ship_date}`;
}
function newShipmentHtml(s: any) {
  return `
    <div style="font-family:Arial,sans-serif;max-width:560px;margin:0 auto;color:#0f172a;">
      <h2 style="margin:0 0 8px;">New shipment added</h2>
      <p style="color:#475569;margin:0 0 20px;">A rep just logged a future-dated shipment. Open it in ShipQueue and set a reminder date for when you'd like to be re-pinged.</p>
      <table style="width:100%;border-collapse:collapse;background:#f8fafc;border-radius:8px;">
        <tr><td style="padding:10px 14px;color:#64748b;width:120px;">Order #</td><td style="padding:10px 14px;font-weight:600;font-family:monospace;">${escapeHtml(s.order_number)}</td></tr>
        <tr><td style="padding:10px 14px;color:#64748b;">Ship date</td><td style="padding:10px 14px;font-weight:600;">${s.ship_date}</td></tr>
        ${s.customer ? `<tr><td style="padding:10px 14px;color:#64748b;">Customer</td><td style="padding:10px 14px;">${escapeHtml(s.customer)}</td></tr>` : ""}
        ${s.notes ? `<tr><td style="padding:10px 14px;color:#64748b;vertical-align:top;">Notes</td><td style="padding:10px 14px;">${escapeHtml(s.notes)}</td></tr>` : ""}
      </table>
    </div>`;
}
function reminderDigestHtml(items: any[]) {
  const rows = items.map((s) => `
    <tr>
      <td style="padding:10px;border-bottom:1px solid #e5e7eb;font-family:monospace;font-weight:600;">#${escapeHtml(s.order_number)}</td>
      <td style="padding:10px;border-bottom:1px solid #e5e7eb;">${escapeHtml(s.customer ?? "—")}</td>
      <td style="padding:10px;border-bottom:1px solid #e5e7eb;">${s.ship_date}</td>
    </tr>`).join("");
  return `
    <div style="font-family:Arial,sans-serif;max-width:640px;margin:0 auto;color:#0f172a;">
      <h2>${items.length} shipment ${items.length === 1 ? "reminder" : "reminders"} due today</h2>
      <p style="color:#475569;">These are the shipments you asked to be reminded about.</p>
      <table style="width:100%;border-collapse:collapse;margin-top:12px;">
        <thead><tr style="background:#f1f5f9;text-align:left;">
          <th style="padding:10px;">Order</th>
          <th style="padding:10px;">Customer</th>
          <th style="padding:10px;">Ship date</th>
        </tr></thead>
        <tbody>${rows}</tbody>
      </table>
    </div>`;
}
function escapeHtml(s: string) {
  return String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!));
}
function json(body: any, status = 200) {
  return new Response(JSON.stringify(body), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
    status,
  });
}
