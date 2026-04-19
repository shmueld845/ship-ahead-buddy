import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Plus, Package, Calendar, Clock, AlertCircle } from "lucide-react";
import { format, differenceInDays, parseISO } from "date-fns";

type Item = {
  id: string;
  product_name: string;
  vendor: string | null;
  quantity: number | null;
  ship_date: string;
  lead_time_days: number;
  process_date: string;
  status: string;
};
type Shipment = {
  id: string;
  order_number: string;
  customer: string | null;
  notes: string | null;
  created_at: string;
  shipment_items: Item[];
};

export default function Dashboard() {
  const { user } = useAuth();
  const [shipments, setShipments] = useState<Shipment[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    load();
  }, [user]);

  const load = async () => {
    setLoading(true);
    const { data } = await supabase
      .from("shipments")
      .select("id, order_number, customer, notes, created_at, shipment_items(*)")
      .eq("created_by", user!.id)
      .order("created_at", { ascending: false });
    setShipments((data as any) ?? []);
    setLoading(false);
  };

  const totalItems = shipments.reduce((n, s) => n + s.shipment_items.length, 0);
  const readyCount = shipments.reduce(
    (n, s) => n + s.shipment_items.filter((i) => parseISO(i.process_date) <= new Date()).length,
    0
  );

  return (
    <div className="space-y-8">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">My shipments</h1>
          <p className="text-muted-foreground mt-1">Future-dated orders you've logged.</p>
        </div>
        <Button asChild size="lg">
          <Link to="/new"><Plus className="w-4 h-4 mr-2" /> New shipment</Link>
        </Button>
      </div>

      <div className="grid sm:grid-cols-3 gap-4">
        <Stat icon={Package} label="Shipments" value={shipments.length} />
        <Stat icon={Calendar} label="Total line items" value={totalItems} />
        <Stat icon={AlertCircle} label="Ready to process" value={readyCount} accent />
      </div>

      {loading ? (
        <p className="text-muted-foreground">Loading…</p>
      ) : shipments.length === 0 ? (
        <Card className="p-12 text-center">
          <Package className="w-10 h-10 mx-auto text-muted-foreground mb-3" />
          <h3 className="font-semibold mb-1">No shipments yet</h3>
          <p className="text-muted-foreground mb-4">Add your first future-dated order.</p>
          <Button asChild><Link to="/new"><Plus className="w-4 h-4 mr-2" /> New shipment</Link></Button>
        </Card>
      ) : (
        <div className="space-y-4">
          {shipments.map((s) => <ShipmentCard key={s.id} s={s} />)}
        </div>
      )}
    </div>
  );
}

function Stat({ icon: Icon, label, value, accent }: any) {
  return (
    <Card className="p-5 flex items-center gap-4">
      <div className={`w-11 h-11 rounded-lg grid place-items-center ${accent ? "bg-accent/15 text-accent-foreground" : "bg-secondary"}`}>
        <Icon className={`w-5 h-5 ${accent ? "text-accent" : ""}`} />
      </div>
      <div>
        <p className="text-sm text-muted-foreground">{label}</p>
        <p className="text-2xl font-semibold">{value}</p>
      </div>
    </Card>
  );
}

export function ShipmentCard({ s }: { s: Shipment }) {
  return (
    <Card className="p-5">
      <div className="flex items-start justify-between gap-4 flex-wrap mb-4">
        <div>
          <p className="font-mono font-semibold">#{s.order_number}</p>
          {s.customer && <p className="text-sm text-muted-foreground">{s.customer}</p>}
        </div>
        <p className="text-xs text-muted-foreground">
          Created {format(parseISO(s.created_at), "MMM d, yyyy")}
        </p>
      </div>
      <div className="space-y-2">
        {s.shipment_items.map((i) => <LineItem key={i.id} i={i} />)}
      </div>
      {s.notes && (
        <p className="mt-4 text-sm text-muted-foreground border-t pt-3">{s.notes}</p>
      )}
    </Card>
  );
}

function LineItem({ i }: { i: Item }) {
  const today = new Date();
  const processDate = parseISO(i.process_date);
  const shipDate = parseISO(i.ship_date);
  const daysUntilProcess = differenceInDays(processDate, today);
  const isReady = daysUntilProcess <= 0;

  return (
    <div className="flex items-center justify-between gap-3 p-3 rounded-md bg-secondary/40 flex-wrap">
      <div className="min-w-0">
        <p className="font-medium truncate">
          {i.product_name}
          {i.quantity ? <span className="text-muted-foreground font-normal"> × {i.quantity}</span> : null}
        </p>
        <p className="text-xs text-muted-foreground">
          {i.vendor && <>Vendor: {i.vendor} · </>}
          Ship {format(shipDate, "MMM d")} · Lead {i.lead_time_days}d
        </p>
      </div>
      <div className="flex items-center gap-2">
        {isReady ? (
          <Badge className="bg-accent text-accent-foreground hover:bg-accent">
            <AlertCircle className="w-3 h-3 mr-1" /> Ready to process
          </Badge>
        ) : (
          <Badge variant="secondary">
            <Clock className="w-3 h-3 mr-1" /> Process in {daysUntilProcess}d
          </Badge>
        )}
      </div>
    </div>
  );
}
