import { Link, NavLink, Outlet, useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Package, LogOut, LayoutDashboard, Plus, Inbox, Settings } from "lucide-react";
import { cn } from "@/lib/utils";

export default function AppLayout() {
  const { user, roles, isAdmin, isProcessor, signOut, loading } = useAuth();
  const navigate = useNavigate();

  if (loading) return null;
  if (!user) {
    navigate("/auth", { replace: true });
    return null;
  }

  const navItems = [
    { to: "/", label: "Dashboard", icon: LayoutDashboard },
    { to: "/new", label: "New shipment", icon: Plus },
    isProcessor && { to: "/queue", label: "Processing queue", icon: Inbox },
    isAdmin && { to: "/settings", label: "Settings", icon: Settings },
  ].filter(Boolean) as { to: string; label: string; icon: typeof LayoutDashboard }[];

  return (
    <div className="min-h-screen flex flex-col">
      <header className="border-b bg-card">
        <div className="container flex items-center justify-between h-16">
          <Link to="/" className="flex items-center gap-2 font-semibold">
            <div className="w-8 h-8 rounded-md bg-primary text-primary-foreground grid place-items-center">
              <Package className="w-4 h-4" />
            </div>
            <span>ShipQueue</span>
          </Link>
          <div className="flex items-center gap-3">
            <span className="text-sm text-muted-foreground hidden sm:inline">
              {user.email} · {roles.join(", ") || "no role"}
            </span>
            <Button variant="ghost" size="sm" onClick={() => signOut()}>
              <LogOut className="w-4 h-4 mr-2" /> Sign out
            </Button>
          </div>
        </div>
        <nav className="container flex gap-1 -mb-px overflow-x-auto">
          {navItems.map(({ to, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              end={to === "/"}
              className={({ isActive }) =>
                cn(
                  "flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 whitespace-nowrap transition-colors",
                  isActive
                    ? "border-primary text-foreground"
                    : "border-transparent text-muted-foreground hover:text-foreground"
                )
              }
            >
              <Icon className="w-4 h-4" /> {label}
            </NavLink>
          ))}
        </nav>
      </header>
      <main className="flex-1 container py-8">
        <Outlet />
      </main>
    </div>
  );
}
