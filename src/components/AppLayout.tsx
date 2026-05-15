import { Link, Outlet, useLocation } from "@tanstack/react-router";
import { Activity, Calendar, Home, Pill, Plus, LogOut } from "lucide-react";
import { NextDoseBanner } from "./NextDoseBanner";
import { ThemeToggle } from "./ThemeToggle";
import { useAuth } from "@/lib/auth";
import { useLogs, useMeds } from "@/lib/storage";
import { toast } from "sonner";

const navItems = [
  { to: "/", label: "Hoje", icon: Home },
  { to: "/medications", label: "Remédios", icon: Pill },
  { to: "/calendar", label: "Calendário", icon: Calendar },
  { to: "/add", label: "Adicionar", icon: Plus },
];

export function AppLayout() {
  const loc = useLocation();
  const { user, signOut } = useAuth();
  const meds = useMeds();
  const logs = useLogs();

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Desktop sidebar */}
      <aside className="hidden md:flex fixed inset-y-0 left-0 w-64 flex-col border-r border-border bg-card/50 backdrop-blur p-6 z-30">
        <Link to="/" className="flex items-center gap-2 mb-10">
          <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-primary to-primary-glow flex items-center justify-center text-primary-foreground shadow-lg">
            <Activity className="h-5 w-5" />
          </div>
          <div>
            <div className="font-bold text-lg leading-none">MediMind</div>
            <div className="text-xs text-muted-foreground mt-1">Sua adesão diária</div>
          </div>
        </Link>
        <nav className="flex flex-col gap-1">
          {navItems.map((item) => {
            const active = loc.pathname === item.to;
            const Icon = item.icon;
            return (
              <Link
                key={item.to}
                to={item.to}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                  active
                    ? "bg-primary text-primary-foreground shadow-sm"
                    : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
                }`}
              >
                <Icon className="h-4 w-4" />
                {item.label}
              </Link>
            );
          })}
        </nav>
        <div className="mt-auto pt-6 border-t border-border space-y-3">
          <div className="flex items-center justify-between gap-3">
            <span className="text-sm text-muted-foreground">Tema</span>
            <ThemeToggle />
          </div>
          {user && (
            <div className="space-y-2">
              <div className="text-xs text-muted-foreground truncate" title={user.email ?? ""}>
                {user.email}
              </div>
              <button
                onClick={async () => { await signOut(); toast("Sessão encerrada"); }}
                className="w-full inline-flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-sm border border-border hover:bg-accent transition"
              >
                <LogOut className="h-4 w-4" /> Sair
              </button>
            </div>
          )}
        </div>
      </aside>

      <main className="md:pl-64 pb-24 md:pb-8">
        <div className="max-w-5xl mx-auto px-4 md:px-8 pt-6 md:pt-10">
          <div className="md:hidden flex justify-end items-center gap-2 mb-3">
            <ThemeToggle />
            {user && (
              <button
                onClick={async () => { await signOut(); toast("Sessão encerrada"); }}
                aria-label="Sair"
                className="h-9 w-9 inline-flex items-center justify-center rounded-lg border border-border"
              >
                <LogOut className="h-4 w-4" />
              </button>
            )}
          </div>
          <NextDoseBanner />
          <div className="mt-6 animate-fade-in">
            <Outlet />
          </div>
        </div>
      </main>

      {/* Mobile bottom nav */}
      <nav className="md:hidden fixed bottom-0 inset-x-0 z-40 border-t border-border bg-card/95 backdrop-blur">
        <div className="grid grid-cols-4">
          {navItems.map((item) => {
            const active = loc.pathname === item.to;
            const Icon = item.icon;
            return (
              <Link
                key={item.to}
                to={item.to}
                className={`flex flex-col items-center justify-center gap-1 py-3 text-xs font-medium transition-colors ${
                  active ? "text-primary" : "text-muted-foreground"
                }`}
              >
                <Icon className={`h-5 w-5 ${active ? "scale-110" : ""} transition-transform`} />
                {item.label}
              </Link>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
