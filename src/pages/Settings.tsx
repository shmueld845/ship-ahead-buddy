import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { z } from "zod";

type Profile = { user_id: string; email: string; display_name: string | null };
type RoleRow = { user_id: string; role: "admin" | "processor" | "rep" };

export default function Settings() {
  const [email, setEmail] = useState("");
  const [saving, setSaving] = useState(false);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [rolesByUser, setRolesByUser] = useState<Record<string, string[]>>({});

  useEffect(() => { load(); }, []);

  const load = async () => {
    const [{ data: settings }, { data: profs }, { data: roles }] = await Promise.all([
      supabase.from("app_settings").select("processor_email").eq("id", 1).maybeSingle(),
      supabase.from("profiles").select("user_id, email, display_name"),
      supabase.from("user_roles").select("user_id, role"),
    ]);
    setEmail(settings?.processor_email ?? "");
    setProfiles(profs ?? []);
    const map: Record<string, string[]> = {};
    (roles as RoleRow[] ?? []).forEach((r) => {
      map[r.user_id] = [...(map[r.user_id] ?? []), r.role];
    });
    setRolesByUser(map);
  };

  const saveEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    const parsed = z.string().trim().email().safeParse(email);
    if (!parsed.success) return toast.error("Invalid email");
    setSaving(true);
    const { error } = await supabase.from("app_settings").update({ processor_email: parsed.data }).eq("id", 1);
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success("Processor email saved");
  };

  const toggleRole = async (userId: string, role: "processor" | "admin" | "rep") => {
    const has = rolesByUser[userId]?.includes(role);
    if (has) {
      const { error } = await supabase.from("user_roles").delete().eq("user_id", userId).eq("role", role);
      if (error) return toast.error(error.message);
    } else {
      const { error } = await supabase.from("user_roles").insert({ user_id: userId, role });
      if (error) return toast.error(error.message);
    }
    load();
  };

  return (
    <div className="max-w-3xl mx-auto space-y-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Settings</h1>
        <p className="text-muted-foreground mt-1">Configure notifications and team roles.</p>
      </div>

      <Card className="p-6">
        <h2 className="font-semibold text-lg mb-1">Processor notification email</h2>
        <p className="text-sm text-muted-foreground mb-4">
          Daily digest of items ready to process is sent here. Use Dan's email.
        </p>
        <form onSubmit={saveEmail} className="flex gap-3 flex-wrap">
          <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)}
            placeholder="dan@example.com" className="flex-1 min-w-[240px]" required />
          <Button type="submit" disabled={saving}>{saving ? "Saving…" : "Save"}</Button>
        </form>
      </Card>

      <Card className="p-6">
        <h2 className="font-semibold text-lg mb-1">Team & roles</h2>
        <p className="text-sm text-muted-foreground mb-4">
          Reps log shipments. Processors see the queue. Admins manage settings.
        </p>
        <div className="space-y-3">
          {profiles.map((p) => {
            const userRoles = rolesByUser[p.user_id] ?? [];
            return (
              <div key={p.user_id} className="flex items-center justify-between gap-4 flex-wrap p-3 rounded-md bg-secondary/40">
                <div className="min-w-0">
                  <p className="font-medium truncate">{p.display_name || p.email}</p>
                  <p className="text-xs text-muted-foreground truncate">{p.email}</p>
                </div>
                <div className="flex gap-2 flex-wrap">
                  {(["rep", "processor", "admin"] as const).map((r) => {
                    const active = userRoles.includes(r);
                    return (
                      <Badge
                        key={r}
                        variant={active ? "default" : "outline"}
                        className="cursor-pointer select-none"
                        onClick={() => toggleRole(p.user_id, r)}
                      >
                        {r}
                      </Badge>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </Card>
    </div>
  );
}
