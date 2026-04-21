import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Plus, Package, Calendar, AlertCircle, Clock, User } from "lucide-react";
import { format, parseISO, differenceInDays } from "date-fns";

type Shipment = {
  id: string;
  order_number: string;
  customer: string | null;
  notes: string | null;
  ship_date: string;
  reminder_date: string | null;
  status: string;
  created_at: string;
  created_by: string;
  profiles: { display_name: string | null; email: string } | null;
};

const STATUS_STYLES: Record<string, string> = {
  pending: "bg-warning text-warning-foreground",
  processing: "bg-accent text-accent-foreground",
  processed: "bg-success text-success-foreground",
  cancelled: "bg-destructive text-destructive-foreground",
};

export default function Dashboard() {
  const { user, roles, isAdmin, isProcessor } = useAuth();
  const [shipments, setShipments] = useState<Shipment[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user || roles.length === 0) return;
    load();
  }, [user, roles]);

  const load = async () => {
    setLoading(true);
    let query = supabase
      .from("shipments")
      .select("id, order_number, customer, notes, ship_date, reminder_date, status, created_at, created_by, profiles!shipments_created_by_fkey(display_name, email)")
      .in("status", ["pending", "processing"])
      .order("ship_date", { ascending: true });

    // Reps only see their own; admins/processors see all
    if (!isAdmin && !isProcessor) {
      query = query.eq("created_by", user!.id);
    }

    const { data, error } = await query;
    if (error) {
      // Fallback: join may fail if no FK, try without join
      const { data: fallback } = await supabase
        .from("shipments")
        .select("id, order_number, customer, notes, ship_date, reminder_date, status, created_at, created_by")
        .in("status", ["pending", "processing"])
        .order("ship_date", { ascending: true });
      setShipments((fallback as any) ?? []);
    } else {
      setShipments((data as any) ?? []);
    }
    setLoading(false);
  };

  const getCreatorLabel = (s: Shipment) => {
    if (s.profiles) {
      return s.profiles.display_name || s.profiles.email;
    }
    return s.created_by === user?.id ? "You" : "Unknown";
  };

  return (
    <div className="space-y-8">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">
            {isAdmin || isProcessor ? "All shipments" : "My shipments"}
          </h1>
          <p className="text-muted-foreground mt-1">
            {isAdmin || isProcessor
              ? "Active orders across all reps."
              : "Active orders you've logged. Processed orders move to the archive."}
          </p>
        </div>
        <Button asChild size="lg">
          <Link to="/new"><Plus className="w-4 h-4 mr-2" /> New shipment</Link>
        </Button>
      </div>

      {loading ? (
        <p className="text-muted-foreground">Loading…</p>
      ) : shipments.length === 0 ? (
        <Card className="p-12 text-center">
          <Package className="w-10 h-10 mx-auto text-muted-foreground mb-3" />
          <h3 className="font-semibold mb-1">No active shipments</h3>
          <p className="text-muted-foreground mb-4">Add your first future-dated order.</p>
          <Button asChild><Link to="/new"><Plus className="w-4 h-4 mr-2" /> New shipment</Link></Button>
        </Card>
      ) : (
        <div className="space-y-3">
          {shipments.map((s) => {
            const ship = parseISO(s.ship_date);
            const days = differenceInDays(ship, new Date());
            return (
              <Card key={s.id} className="p-5">
                <div className="flex items-center gap-2 flex-wrap mb-1">
                  <span className="font-mono font-semibold">#{s.order_number}</span>
                  <Badge className={`capitalize ${STATUS_STYLES[s.status] ?? "bg-secondary text-secondary-foreground"}`}>
                    {s.status}
                  </Badge>
                </div>
                {s.customer && <p className="text-sm text-muted-foreground">{s.customer}</p>}
                <div className="flex items-center gap-4 mt-2 text-sm flex-wrap">
                  <span className="flex items-center gap-1.5">
                    <Calendar className="w-4 h-4 text-muted-foreground" />
                    Ship {format(ship, "MMM d, yyyy")}
                    <span className="text-muted-foreground">({days >= 0 ? `in ${days}d` : `${-days}d ago`})</span>
                  </span>
                  {s.reminder_date ? (
                    <span className="flex items-center gap-1.5 text-muted-foreground">
                      <Clock className="w-4 h-4" /> Reminder {format(parseISO(s.reminder_date), "MMM d")}
                    </span>
                  ) : (
                    <span className="flex items-center gap-1.5 text-muted-foreground">
                      <AlertCircle className="w-4 h-4" /> Awaiting reminder
                    </span>
                  )}
                  <span className="flex items-center gap-1.5 text-muted-foreground">
                    <User className="w-4 h-4" />
                    {s.created_by === user?.id ? "You" : getCreatorLabel(s)}
                  </span>
                </div>
                {s.notes && <p className="mt-2 text-sm text-muted-foreground italic">"{s.notes}"</p>}
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
