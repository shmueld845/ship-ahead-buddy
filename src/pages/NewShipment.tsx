import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/card";
import { toast } from "sonner";
import { Save } from "lucide-react";
import { z } from "zod";

const schema = z.object({
  order_number: z.string().trim().min(1, "Order # required").max(100),
  ship_date: z.string().min(1, "Ship date required"),
  customer: z.string().trim().max(200).optional(),
  notes: z.string().trim().max(1000).optional(),
});

export default function NewShipment() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [orderNumber, setOrderNumber] = useState("");
  const [shipDate, setShipDate] = useState("");
  const [customer, setCustomer] = useState("");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    const parsed = schema.safeParse({
      order_number: orderNumber,
      ship_date: shipDate,
      customer: customer || undefined,
      notes: notes || undefined,
    });
    if (!parsed.success) return toast.error(parsed.error.errors[0].message);

    setSaving(true);
    const { data: shipment, error } = await supabase
      .from("shipments")
      .insert({
        order_number: parsed.data.order_number,
        ship_date: parsed.data.ship_date,
        customer: parsed.data.customer ?? null,
        notes: parsed.data.notes ?? null,
        created_by: user.id,
      })
      .select()
      .single();

    if (error || !shipment) {
      setSaving(false);
      return toast.error(error?.message ?? "Failed to save");
    }

    // Fire-and-forget notification to processor
    supabase.functions.invoke("notify-processor", {
      body: { type: "new_shipment", shipment_id: shipment.id },
    }).catch(() => {});

    setSaving(false);
    toast.success("Shipment saved — Dan has been notified");
    navigate("/");
  };

  return (
    <div className="max-w-xl mx-auto space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">New shipment</h1>
        <p className="text-muted-foreground mt-1">
          Log the order # and ship date. Dan will be notified to set his own reminder.
        </p>
      </div>

      <form onSubmit={submit}>
        <Card className="p-6 space-y-4">
          <div className="space-y-2">
            <Label htmlFor="order">Order number *</Label>
            <Input id="order" value={orderNumber} onChange={(e) => setOrderNumber(e.target.value)} required maxLength={100} autoFocus />
          </div>
          <div className="space-y-2">
            <Label htmlFor="ship">Ship date *</Label>
            <Input id="ship" type="date" value={shipDate} onChange={(e) => setShipDate(e.target.value)} required />
          </div>
          <div className="space-y-2">
            <Label htmlFor="customer">Customer (optional)</Label>
            <Input id="customer" value={customer} onChange={(e) => setCustomer(e.target.value)} maxLength={200} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="notes">Notes (optional)</Label>
            <Textarea id="notes" value={notes} onChange={(e) => setNotes(e.target.value)} maxLength={1000} rows={3} />
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <Button type="button" variant="ghost" onClick={() => navigate("/")}>Cancel</Button>
            <Button type="submit" disabled={saving}>
              <Save className="w-4 h-4 mr-2" /> {saving ? "Saving…" : "Save shipment"}
            </Button>
          </div>
        </Card>
      </form>
    </div>
  );
}
