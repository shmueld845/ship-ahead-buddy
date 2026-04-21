import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "sonner";
import { z } from "zod";
import { UserPlus, Pencil } from "lucide-react";

type Profile = { user_id: string; email: string; display_name: string | null };
type RoleRow = { user_id: string; role: "admin" | "processor" | "rep" };

export default function Settings() {
  const [email, setEmail] = useState("");
  const [saving, setSaving] = useState(false);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [rolesByUser, setRolesByUser] = useState<Record<string, string[]>>({});

  // Invite form
  const [invEmail, setInvEmail] = useState("");
  const [invName, setInvName] = useState("");
  const [invPassword, setInvPassword] = useState("");
  const [invRoles, setInvRoles] = useState<string[]>(["rep"]);
  const [inviting, setInviting] = useState(false);

  // Edit user dialog
  const [editUser, setEditUser] = useState<Profile | null>(null);
  const [editName, setEditName] = useState("");
  const [editEmail, setEditEmail] = useState("");
  const [editSaving, setEditSaving] = useState(false);

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

  const toggleInvRole = (role: string) => {
    setInvRoles((prev) =>
      prev.includes(role) ? prev.filter((r) => r !== role) : [...prev, role]
    );
  };

  const inviteUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!invEmail || !invPassword) return toast.error("Email and password required");
    if (invPassword.length < 6) return toast.error("Password must be at least 6 characters");
    setInviting(true);
    const { data, error } = await supabase.functions.invoke("invite-user", {
      body: { email: invEmail, password: invPassword, display_name: invName, roles: invRoles },
    });
    setInviting(false);
    if (error || data?.error) return toast.error(data?.error || error?.message || "Failed to invite");
    toast.success(`User ${invEmail} created`);
    setInvEmail("");
    setInvName("");
    setInvPassword("");
    setInvRoles(["rep"]);
    load();
  };

  const openEdit = (p: Profile) => {
    setEditUser(p);
    setEditName(p.display_name ?? "");
    setEditEmail(p.email);
  };

  const saveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editUser) return;
    const parsedEmail = z.string().trim().email().safeParse(editEmail);
    if (!parsedEmail.success) return toast.error("Invalid email");
    if (!editName.trim()) return toast.error("Name is required");

    setEditSaving(true);
    const { error } = await supabase
      .from("profiles")
      .update({ display_name: editName.trim(), email: parsedEmail.data })
      .eq("user_id", editUser.user_id);
    setEditSaving(false);
    if (error) return toast.error(error.message);
    toast.success("User updated");
    setEditUser(null);
    load();
  };

  return (
    <div className="max-w-3xl mx-auto space-y-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Settings</h1>
        <p className="text-muted-foreground mt-1">Configure notifications, team, and roles.</p>
      </div>

      {/* Invite user */}
      <Card className="p-6">
        <h2 className="font-semibold text-lg mb-1 flex items-center gap-2">
          <UserPlus className="w-5 h-5" /> Add team member
        </h2>
        <p className="text-sm text-muted-foreground mb-4">
          Create a new account with a temporary password. The user can change it after signing in.
        </p>
        <form onSubmit={inviteUser} className="space-y-4">
          <div className="grid sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="inv-email">Email *</Label>
              <Input id="inv-email" type="email" value={invEmail} onChange={(e) => setInvEmail(e.target.value)} required placeholder="user@tigermedical.com" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="inv-name">Display name</Label>
              <Input id="inv-name" value={invName} onChange={(e) => setInvName(e.target.value)} placeholder="John Doe" />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="inv-pw">Temporary password *</Label>
            <Input id="inv-pw" type="password" value={invPassword} onChange={(e) => setInvPassword(e.target.value)} required placeholder="Min 6 characters" />
          </div>
          <div className="space-y-2">
            <Label>Roles</Label>
            <div className="flex gap-4">
              {(["rep", "processor", "admin"] as const).map((role) => (
                <label key={role} className="flex items-center gap-2 cursor-pointer">
                  <Checkbox checked={invRoles.includes(role)} onCheckedChange={() => toggleInvRole(role)} />
                  <span className="text-sm capitalize">{role}</span>
                </label>
              ))}
            </div>
          </div>
          <Button type="submit" disabled={inviting}>
            <UserPlus className="w-4 h-4 mr-2" /> {inviting ? "Creating…" : "Create user"}
          </Button>
        </form>
      </Card>

      {/* Processor email */}
      <Card className="p-6">
        <h2 className="font-semibold text-lg mb-1">Processor notification email</h2>
        <p className="text-sm text-muted-foreground mb-4">
          Daily digest of items ready to process is sent here.
        </p>
        <form onSubmit={saveEmail} className="flex gap-3 flex-wrap">
          <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)}
            placeholder="dan@example.com" className="flex-1 min-w-[240px]" required />
          <Button type="submit" disabled={saving}>{saving ? "Saving…" : "Save"}</Button>
        </form>
      </Card>

      {/* Team & roles */}
      <Card className="p-6">
        <h2 className="font-semibold text-lg mb-1">Team & roles</h2>
        <p className="text-sm text-muted-foreground mb-4">
          <strong>Rep</strong> — add new orders only. <strong>Processor</strong> — add, edit & process orders. <strong>Admin</strong> — full access including settings.
        </p>
        <div className="space-y-3">
          {profiles.map((p) => {
            const userRoles = rolesByUser[p.user_id] ?? [];
            return (
              <div key={p.user_id} className="flex items-center justify-between gap-4 flex-wrap p-3 rounded-md bg-secondary/40">
                <div className="min-w-0 flex items-center gap-2">
                  <div>
                    <p className="font-medium truncate">{p.display_name || p.email}</p>
                    <p className="text-xs text-muted-foreground truncate">{p.email}</p>
                  </div>
                  <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0" onClick={() => openEdit(p)}>
                    <Pencil className="h-3.5 w-3.5" />
                  </Button>
                </div>
                <div className="flex gap-2 flex-wrap">
                  {(["rep", "processor", "admin"] as const).map((r) => {
                    const active = userRoles.includes(r);
                    return (
                      <Badge
                        key={r}
                        variant={active ? "default" : "outline"}
                        className="cursor-pointer select-none capitalize"
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

      {/* Edit user dialog */}
      <Dialog open={!!editUser} onOpenChange={(open) => !open && setEditUser(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit user</DialogTitle>
          </DialogHeader>
          <form onSubmit={saveEdit} className="space-y-4">
            <div className="space-y-2">
              <Label>Display name</Label>
              <Input value={editName} onChange={(e) => setEditName(e.target.value)} placeholder="Name" required />
            </div>
            <div className="space-y-2">
              <Label>Email</Label>
              <Input type="email" value={editEmail} onChange={(e) => setEditEmail(e.target.value)} placeholder="Email" required />
            </div>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setEditUser(null)}>Cancel</Button>
              <Button type="submit" disabled={editSaving}>{editSaving ? "Saving…" : "Save"}</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
