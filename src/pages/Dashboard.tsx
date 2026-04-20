import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Plus, Package, Calendar, AlertCircle, Clock, Trash2 } from "lucide-react";
import { format, parseISO, differenceInDays } from "date-fns";
import { toast } from "sonner";

type Shipment = {
  id: string;
  order_number: string;
  customer: string | null;
  notes: string | null;
  ship_date: string;
  reminder_date: string | null;
  status: string;
  created_at: string;
};

const STATUSES = ["pending", "processed", "cancelled"];
const STATUS_STYLES: Record<string, string> = {
  pending: "bg-warning text-warning-foreground hover:bg-warning",
  processed: "bg-success text-success-foreground hover:bg-success",
  cancelled: "bg-destructive text-destructive-foreground hover:bg-destructive",
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
      .select("id, order_number, customer, notes, ship_date, reminder_date, status, created_at")
      .eq("created_by", user!.id)
      .order("ship_date", { ascending: true });
    setShipments((data as any) ?? []);
    setLoading(false);
  };

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
        <div className="space-y-3">
          {shipments.map((s) => <ShipmentRow key={s.id} s={s} onChange={load} />)}
        </div>
      )}
    </div>
  );
}

function ShipmentRow({ s, onChange }: { s: Shipment; onChange: () => void }) {
  const today = new Date();
  const ship = parseISO(s.ship_date);
  const days = differenceInDays(ship, today);

  const updateStatus = async (status: string) => {
    const { error } = await supabase.from("shipments").update({ status }).eq("id", s.id);
    if (error) return toast.error(error.message);
    toast.success("Status updated");
    onChange();
  };

  const deleteShipment = async () => {
    const { error } = await supabase.from("shipments").delete().eq("id", s.id);
    if (error) return toast.error(error.message);
    toast.success("Shipment deleted");
    onChange();
  };

  return (
    <Card className="p-5">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div className="min-w-0 flex-1">
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
                <AlertCircle className="w-4 h-4" /> Awaiting Dan's reminder
              </span>
            )}
          </div>
          {s.notes && <p className="mt-2 text-sm text-muted-foreground italic">"{s.notes}"</p>}
        </div>
        <div className="flex items-center gap-2">
          <Select value={s.status} onValueChange={updateStatus}>
            <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
            <SelectContent>
              {STATUSES.map((st) => (
                <SelectItem key={st} value={st} className="capitalize">{st}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="outline" size="icon" aria-label="Delete shipment">
                <Trash2 className="w-4 h-4 text-destructive" />
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Delete shipment #{s.order_number}?</AlertDialogTitle>
                <AlertDialogDescription>This cannot be undone.</AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction onClick={deleteShipment} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                  Delete
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </div>
    </Card>
  );
}
