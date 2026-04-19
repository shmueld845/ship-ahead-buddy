import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const today = new Date().toISOString().slice(0, 10);

    // Get processor email
    const { data: settings } = await supabase
      .from("app_settings").select("processor_email").eq("id", 1).maybeSingle();
    const processorEmail = settings?.processor_email;
    if (!processorEmail) {
      return json({ ok: false, reason: "no_processor_email" });
    }

    // Find ready items not yet notified
    const { data: items, error } = await supabase
      .from("shipment_items")
      .select("id, product_name, vendor, quantity, ship_date, lead_time_days, process_date, shipments!inner(order_number, customer)")
      .lte("process_date", today)
      .is("notified_at", null)
      .in("status", ["pending", "ready"]);
    if (error) throw error;
    if (!items || items.length === 0) {
      return json({ ok: true, sent: 0, message: "no items to notify" });
    }

    const rows = items
      .map((i: any) => `
        <tr>
          <td style="padding:8px;border-bottom:1px solid #e5e7eb;font-family:monospace;">#${i.shipments.order_number}</td>
          <td style="padding:8px;border-bottom:1px solid #e5e7eb;">${escapeHtml(i.product_name)}${i.quantity ? ` × ${i.quantity}` : ""}</td>
          <td style="padding:8px;border-bottom:1px solid #e5e7eb;">${escapeHtml(i.vendor ?? "—")}</td>
          <td style="padding:8px;border-bottom:1px solid #e5e7eb;">${i.ship_date}</td>
          <td style="padding:8px;border-bottom:1px solid #e5e7eb;">${i.lead_time_days}d</td>
        </tr>`).join("");

    const html = `
      <div style="font-family:Arial,sans-serif;max-width:640px;margin:0 auto;">
        <h2 style="color:#0f172a;">${items.length} shipment ${items.length === 1 ? "item is" : "items are"} ready to process</h2>
        <p style="color:#475569;">The processing window has opened for the following line items.</p>
        <table style="width:100%;border-collapse:collapse;margin-top:12px;">
          <thead>
            <tr style="background:#f1f5f9;text-align:left;">
              <th style="padding:8px;">Order</th>
              <th style="padding:8px;">Product</th>
              <th style="padding:8px;">Vendor</th>
              <th style="padding:8px;">Ship date</th>
              <th style="padding:8px;">Lead</th>
            </tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>
        <p style="margin-top:24px;color:#64748b;font-size:13px;">Open the queue in ShipQueue to update statuses.</p>
      </div>`;

    // Send via Lovable email gateway (callback_url style)
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    let emailSent = false;
    let emailError: string | null = null;
    if (LOVABLE_API_KEY) {
      try {
        const res = await fetch("https://ai.gateway.lovable.dev/v1/email/send", {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${LOVABLE_API_KEY}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            to: processorEmail,
            subject: `${items.length} shipment item${items.length === 1 ? "" : "s"} ready to process`,
            html,
          }),
        });
        emailSent = res.ok;
        if (!res.ok) emailError = `${res.status} ${await res.text()}`;
      } catch (e: any) {
        emailError = e.message;
      }
    } else {
      emailError = "LOVABLE_API_KEY not set — email skipped";
    }

    // Mark as notified + status=ready regardless (so they show in queue)
    const ids = items.map((i: any) => i.id);
    await supabase.from("shipment_items").update({
      notified_at: new Date().toISOString(),
      status: "ready",
    }).in("id", ids);

    return json({ ok: true, sent: items.length, emailSent, emailError });
  } catch (e: any) {
    return json({ ok: false, error: e.message }, 500);
  }
});

function json(body: any, status = 200) {
  return new Response(JSON.stringify(body), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
    status,
  });
}
function escapeHtml(s: string) {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!));
}
