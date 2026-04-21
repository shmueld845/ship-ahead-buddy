import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { format, parseISO, differenceInDays } from "date-fns";
import { toast } from "sonner";
import { Inbox, AlertCircle, Clock, CheckCircle2, Save, Trash2, Archive } from "lucide-react";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

const STATUS_STYLES: Record<string, string> = {
  pending: "bg-warning text-warning-foreground hover:bg-warning",
  processing: "bg-accent text-accent-foreground hover:bg-accent",
  processed: "bg-success text-success-foreground hover:bg-success",
  cancelled: "bg-destructive text-destructive-foreground hover:bg-destructive",
};

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

const ACTIVE_STATUSES = ["pending", "processing"];
const ARCHIVE_STATUSES = ["processed", "cancelled"];
const ALL_STATUSES = ["pending", "processing", "processed", "cancelled"];

export default function Queue() {
  const [shipments, setShipments] = useState<Shipment[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<"active" | "archive">("active");

  useEffect(() => { load(); }, [tab]);

  const load = async () => {
    setLoading(true);
    const statuses = tab === "active" ? ACTIVE_STATUSES : ARCHIVE_STATUSES;
    const { data, error } = await supabase
      .from("shipments")
      .select("id, order_number, customer, notes, ship_date, reminder_date, status, created_at")
      .in("status", statuses)
      .order("ship_date", { ascending: tab === "active" });
    setLoading(false);
    if (error) return toast.error(error.message);
    setShipments((data as Shipment[]) ?? []);
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight flex items-center gap-3">
          <Inbox className="w-7 h-7" /> Processing queue
        </h1>
        <p className="text-muted-foreground mt-1">
          Set a reminder date on each shipment. You'll be emailed on that date.
        </p>
      </div>

      <Tabs value={tab} onValueChange={(v) => setTab(v as "active" | "archive")}>
        <TabsList>
          <TabsTrigger value="active" className="gap-2">
            <Clock className="w-4 h-4" /> Active
          </TabsTrigger>
          <TabsTrigger value="archive" className="gap-2">
            <Archive className="w-4 h-4" /> Archive
          </TabsTrigger>
        </TabsList>

        <TabsContent value="active" className="mt-4">
          {loading ? (
            <p className="text-muted-foreground">Loading…</p>
          ) : shipments.length === 0 ? (
            <Card className="p-12 text-center">
              <CheckCircle2 className="w-10 h-10 mx-auto text-success mb-3" />
              <h3 className="font-semibold mb-1">All caught up</h3>
              <p className="text-muted-foreground">No shipments need attention right now.</p>
            </Card>
          ) : (
            <div className="space-y-3">
              {shipments.map((s) => <QueueRow key={s.id} s={s} onChange={load} showReminder />)}
            </div>
          )}
        </TabsContent>

        <TabsContent value="archive" className="mt-4">
          {loading ? (
            <p className="text-muted-foreground">Loading…</p>
          ) : shipments.length === 0 ? (
            <Card className="p-12 text-center">
              <Archive className="w-10 h-10 mx-auto text-muted-foreground mb-3" />
              <h3 className="font-semibold mb-1">No archived shipments</h3>
              <p className="text-muted-foreground">Processed and cancelled shipments will appear here.</p>
            </Card>
          ) : (
            <div className="space-y-3">
              {shipments.map((s) => <QueueRow key={s.id} s={s} onChange={load} showReminder={false} />)}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}

function QueueRow({ s, onChange, showReminder }: { s: Shipment; onChange: () => void; showReminder: boolean }) {
  const [reminder, setReminder] = useState(s.reminder_date ?? "");
  const [saving, setSaving] = useState(false);
  const today = new Date();
  const ship = parseISO(s.ship_date);
  const daysToShip = differenceInDays(ship, today);
  const reminderDue = s.reminder_date && parseISO(s.reminder_date) <= today;
  const noReminder = !s.reminder_date;

  const saveReminder = async () => {
    setSaving(true);
    const { error } = await supabase
      .from("shipments")
      .update({ reminder_date: reminder || null, reminder_notified_at: null })
      .eq("id", s.id);
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success("Reminder saved");
    onChange();
  };

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
    <Card className="p-5 space-y-4">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 mb-2 flex-wrap">
            <span className="font-mono font-semibold text-lg">#{s.order_number}</span>
            {showReminder && noReminder && (
              <Badge className="bg-accent text-accent-foreground hover:bg-accent">
                <AlertCircle className="w-3 h-3 mr-1" /> Set reminder
              </Badge>
            )}
            {showReminder && reminderDue && (
              <Badge className="bg-accent text-accent-foreground hover:bg-accent">
                <AlertCircle className="w-3 h-3 mr-1" /> Reminder due
              </Badge>
            )}
            <Badge className={`capitalize ${STATUS_STYLES[s.status] ?? "bg-secondary text-secondary-foreground"}`}>{s.status}</Badge>
          </div>
          {s.customer && <p className="text-sm text-muted-foreground">{s.customer}</p>}
          <p className="text-sm mt-1">
            Ship date: <span className="font-medium">{format(ship, "MMM d, yyyy")}</span>{" "}
            <span className="text-muted-foreground">
              ({daysToShip >= 0 ? `in ${daysToShip}d` : `${-daysToShip}d ago`})
            </span>
          </p>
          {s.notes && <p className="text-sm text-muted-foreground italic mt-2">"{s.notes}"</p>}
        </div>
        <Select value={s.status} onValueChange={updateStatus}>
          <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
          <SelectContent>
            {ALL_STATUSES.map((st) => <SelectItem key={st} value={st} className="capitalize">{st}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {showReminder && (
        <div className="border-t pt-4 flex items-end gap-3 flex-wrap">
          <div className="space-y-1.5 flex-1 min-w-[180px]">
            <Label htmlFor={`r-${s.id}`} className="text-xs flex items-center gap-1.5">
              <Clock className="w-3 h-3" /> Remind me on
            </Label>
            <Input
              id={`r-${s.id}`}
              type="date"
              value={reminder}
              onChange={(e) => setReminder(e.target.value)}
              max={s.ship_date}
            />
          </div>
          <Button onClick={saveReminder} disabled={saving || reminder === (s.reminder_date ?? "")}>
            <Save className="w-4 h-4 mr-2" /> {saving ? "Saving…" : "Save"}
          </Button>
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
      )}
    </Card>
  );
}
