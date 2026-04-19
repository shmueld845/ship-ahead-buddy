import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { format, parseISO, differenceInDays } from "date-fns";
import { toast } from "sonner";
import { Inbox, AlertCircle, Clock, CheckCircle2 } from "lucide-react";

type QueueItem = {
  id: string;
  product_name: string;
  vendor: string | null;
  quantity: number | null;
  ship_date: string;
  lead_time_days: number;
  process_date: string;
  status: string;
  shipments: { order_number: string; customer: string | null; notes: string | null };
};

const STATUSES = ["pending", "ready", "processing", "shipped", "cancelled"];

export default function Queue() {
  const [items, setItems] = useState<QueueItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"ready" | "all">("ready");

  useEffect(() => { load(); }, [filter]);

  const load = async () => {
    setLoading(true);
    const today = new Date().toISOString().slice(0, 10);
    let q = supabase
      .from("shipment_items")
      .select("id, product_name, vendor, quantity, ship_date, lead_time_days, process_date, status, shipments!inner(order_number, customer, notes)")
      .order("process_date", { ascending: true });
    if (filter === "ready") {
      q = q.lte("process_date", today).in("status", ["pending", "ready", "processing"]);
    }
    const { data, error } = await q;
    setLoading(false);
    if (error) return toast.error(error.message);
    setItems((data as any) ?? []);
  };

  const updateStatus = async (id: string, status: string) => {
    const { error } = await supabase.from("shipment_items").update({ status: status as any }).eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Status updated");
    load();
  };

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-3xl font-bold tracking-tight flex items-center gap-3">
            <Inbox className="w-7 h-7" /> Processing queue
          </h1>
          <p className="text-muted-foreground mt-1">
            Items where today is on or after the processing date (ship date − lead time).
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant={filter === "ready" ? "default" : "outline"} size="sm" onClick={() => setFilter("ready")}>
            Ready now
          </Button>
          <Button variant={filter === "all" ? "default" : "outline"} size="sm" onClick={() => setFilter("all")}>
            All items
          </Button>
        </div>
      </div>

      {loading ? (
        <p className="text-muted-foreground">Loading…</p>
      ) : items.length === 0 ? (
        <Card className="p-12 text-center">
          <CheckCircle2 className="w-10 h-10 mx-auto text-success mb-3" />
          <h3 className="font-semibold mb-1">All caught up</h3>
          <p className="text-muted-foreground">No items need processing right now.</p>
        </Card>
      ) : (
        <div className="space-y-3">
          {items.map((i) => {
            const days = differenceInDays(parseISO(i.process_date), new Date());
            const isReady = days <= 0;
            return (
              <Card key={i.id} className="p-5">
                <div className="flex items-start justify-between gap-4 flex-wrap">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 mb-2 flex-wrap">
                      <span className="font-mono font-semibold">#{i.shipments.order_number}</span>
                      {isReady ? (
                        <Badge className="bg-accent text-accent-foreground hover:bg-accent">
                          <AlertCircle className="w-3 h-3 mr-1" /> Ready
                        </Badge>
                      ) : (
                        <Badge variant="secondary">
                          <Clock className="w-3 h-3 mr-1" /> in {days}d
                        </Badge>
                      )}
                      {i.shipments.customer && (
                        <span className="text-sm text-muted-foreground">· {i.shipments.customer}</span>
                      )}
                    </div>
                    <p className="font-medium">
                      {i.product_name}
                      {i.quantity ? <span className="text-muted-foreground font-normal"> × {i.quantity}</span> : null}
                    </p>
                    <p className="text-sm text-muted-foreground mt-1">
                      {i.vendor && <>Vendor: {i.vendor} · </>}
                      Process by {format(parseISO(i.process_date), "MMM d")} · Ship {format(parseISO(i.ship_date), "MMM d")} · Lead {i.lead_time_days}d
                    </p>
                    {i.shipments.notes && (
                      <p className="text-sm text-muted-foreground mt-2 italic">"{i.shipments.notes}"</p>
                    )}
                  </div>
                  <Select value={i.status} onValueChange={(v) => updateStatus(i.id, v)}>
                    <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {STATUSES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
