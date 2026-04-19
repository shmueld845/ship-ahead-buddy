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
import { Plus, Trash2, Save } from "lucide-react";
import { z } from "zod";

type ItemDraft = {
  product_name: string;
  vendor: string;
  quantity: string;
  ship_date: string;
  lead_time_days: string;
};

const blankItem = (): ItemDraft => ({
  product_name: "",
  vendor: "",
  quantity: "",
  ship_date: "",
  lead_time_days: "",
});

const itemSchema = z.object({
  product_name: z.string().trim().min(1, "Product required").max(200),
  vendor: z.string().trim().max(120).optional(),
  quantity: z.number().int().positive().optional(),
  ship_date: z.string().min(1, "Ship date required"),
  lead_time_days: z.number().int().min(0).max(365),
});

export default function NewShipment() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [orderNumber, setOrderNumber] = useState("");
  const [customer, setCustomer] = useState("");
  const [notes, setNotes] = useState("");
  const [items, setItems] = useState<ItemDraft[]>([blankItem()]);
  const [saving, setSaving] = useState(false);

  const updateItem = (idx: number, patch: Partial<ItemDraft>) =>
    setItems((arr) => arr.map((it, i) => (i === idx ? { ...it, ...patch } : it)));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    if (!orderNumber.trim()) return toast.error("Order number is required");
    if (items.length === 0) return toast.error("Add at least one line item");

    const validated: any[] = [];
    for (const [i, it] of items.entries()) {
      const parsed = itemSchema.safeParse({
        product_name: it.product_name,
        vendor: it.vendor || undefined,
        quantity: it.quantity ? Number(it.quantity) : undefined,
        ship_date: it.ship_date,
        lead_time_days: Number(it.lead_time_days),
      });
      if (!parsed.success) {
        return toast.error(`Item ${i + 1}: ${parsed.error.errors[0].message}`);
      }
      validated.push(parsed.data);
    }

    setSaving(true);
    const { data: shipment, error } = await supabase
      .from("shipments")
      .insert({
        order_number: orderNumber.trim(),
        customer: customer.trim() || null,
        notes: notes.trim() || null,
        created_by: user.id,
      })
      .select()
      .single();
    if (error || !shipment) {
      setSaving(false);
      return toast.error(error?.message ?? "Failed to save");
    }

    const { error: itemsErr } = await supabase.from("shipment_items").insert(
      validated.map((v) => ({
        shipment_id: shipment.id,
        product_name: v.product_name,
        vendor: v.vendor ?? null,
        quantity: v.quantity ?? null,
        ship_date: v.ship_date,
        lead_time_days: v.lead_time_days,
      }))
    );
    setSaving(false);
    if (itemsErr) return toast.error(itemsErr.message);
    toast.success("Shipment saved");
    navigate("/");
  };

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">New shipment</h1>
        <p className="text-muted-foreground mt-1">
          Each line item has its own ship date and vendor lead time.
        </p>
      </div>

      <form onSubmit={submit} className="space-y-6">
        <Card className="p-6 space-y-4">
          <div className="grid sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="order">Order number *</Label>
              <Input id="order" value={orderNumber} onChange={(e) => setOrderNumber(e.target.value)} required maxLength={100} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="customer">Customer (optional)</Label>
              <Input id="customer" value={customer} onChange={(e) => setCustomer(e.target.value)} maxLength={200} />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="notes">Notes (optional)</Label>
            <Textarea id="notes" value={notes} onChange={(e) => setNotes(e.target.value)} maxLength={1000} rows={2} />
          </div>
        </Card>

        <div className="flex items-center justify-between">
          <h2 className="font-semibold text-lg">Line items</h2>
          <Button type="button" variant="outline" size="sm" onClick={() => setItems((a) => [...a, blankItem()])}>
            <Plus className="w-4 h-4 mr-2" /> Add item
          </Button>
        </div>

        {items.map((it, idx) => (
          <Card key={idx} className="p-5 space-y-4">
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium text-muted-foreground">Item {idx + 1}</p>
              {items.length > 1 && (
                <Button type="button" variant="ghost" size="sm"
                  onClick={() => setItems((a) => a.filter((_, i) => i !== idx))}>
                  <Trash2 className="w-4 h-4" />
                </Button>
              )}
            </div>
            <div className="grid sm:grid-cols-2 gap-4">
              <div className="space-y-2 sm:col-span-2">
                <Label>Product / SKU *</Label>
                <Input value={it.product_name} onChange={(e) => updateItem(idx, { product_name: e.target.value })} required maxLength={200} />
              </div>
              <div className="space-y-2">
                <Label>Vendor</Label>
                <Input value={it.vendor} onChange={(e) => updateItem(idx, { vendor: e.target.value })} maxLength={120} />
              </div>
              <div className="space-y-2">
                <Label>Quantity</Label>
                <Input type="number" min="1" value={it.quantity} onChange={(e) => updateItem(idx, { quantity: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>Ship date *</Label>
                <Input type="date" value={it.ship_date} onChange={(e) => updateItem(idx, { ship_date: e.target.value })} required />
              </div>
              <div className="space-y-2">
                <Label>Lead time (days) *</Label>
                <Input type="number" min="0" max="365" value={it.lead_time_days} onChange={(e) => updateItem(idx, { lead_time_days: e.target.value })} required />
              </div>
            </div>
          </Card>
        ))}

        <div className="flex justify-end gap-3">
          <Button type="button" variant="ghost" onClick={() => navigate("/")}>Cancel</Button>
          <Button type="submit" disabled={saving}>
            <Save className="w-4 h-4 mr-2" /> {saving ? "Saving…" : "Save shipment"}
          </Button>
        </div>
      </form>
    </div>
  );
}
