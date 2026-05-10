import { createFileRoute, Link } from "@tanstack/react-router";
import { HealthHeatmap } from "@/components/HealthHeatmap";
import { DoseList } from "@/components/DoseList";
import { getAdherenceForDate, getScheduledDosesForDate, useLogs, useMeds, useStoreLoading } from "@/lib/storage";
import { useEffect, useMemo, useState } from "react";
import { TrendingUp, Target, Flame, Plus } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Hoje · MediMind" },
      { name: "description", content: "Veja seus medicamentos do dia e sua adesão geral." },
    ],
  }),
  component: TodayPage,
});

function TodayPage() {
  const meds = useMeds();
  const logs = useLogs();
  const loading = useStoreLoading();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const today = useMemo(() => new Date(), []);
  const doses = useMemo(() => getScheduledDosesForDate(meds, logs, today), [meds, logs, today]);
  const adherence = useMemo(() => getAdherenceForDate(meds, logs, today), [meds, logs, today]);

  const streak = useMemo(() => {
    let s = 0;
    const d = new Date(today);
    d.setDate(d.getDate() - 1);
    for (let i = 0; i < 365; i++) {
      const a = getAdherenceForDate(meds, logs, d);
      if (a.total > 0 && a.ratio === 1) s++;
      else if (a.total > 0) break;
      d.setDate(d.getDate() - 1);
    }
    return s;
  }, [meds, logs, today]);

  const avg30 = useMemo(() => {
    let sum = 0;
    let n = 0;
    const d = new Date(today);
    for (let i = 0; i < 30; i++) {
      const a = getAdherenceForDate(meds, logs, d);
      if (a.total > 0) {
        sum += a.ratio;
        n++;
      }
      d.setDate(d.getDate() - 1);
    }
    return n ? sum / n : 0;
  }, [meds, logs, today]);

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-10 w-48" />
        <div className="grid grid-cols-3 gap-3"><Skeleton className="h-24" /><Skeleton className="h-24" /><Skeleton className="h-24" /></div>
        <Skeleton className="h-48" />
        <Skeleton className="h-32" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl md:text-3xl font-bold tracking-tight">Olá 👋</h1>
        <p className="text-muted-foreground mt-1 min-h-[1.25rem]">
          {mounted ? today.toLocaleDateString("pt-BR", { weekday: "long", day: "numeric", month: "long" }) : ""}
        </p>
      </div>

      {meds.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border bg-card/40 p-10 text-center">
          <h2 className="text-xl font-semibold">Vamos começar?</h2>
          <p className="text-sm text-muted-foreground mt-1 mb-4">Cadastre seu primeiro medicamento para acompanhar sua adesão.</p>
          <Link to="/add" className="inline-flex items-center gap-2 rounded-xl bg-primary text-primary-foreground px-4 py-2.5 font-medium">
            <Plus className="h-4 w-4" /> Adicionar medicamento
          </Link>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-3 gap-3 md:gap-4">
            <StatCard icon={Target} label="Adesão hoje" value={`${Math.round(adherence.ratio * 100)}%`} sub={`${adherence.taken}/${adherence.total} doses`} tone="primary" />
            <StatCard icon={TrendingUp} label="Média 30d" value={`${Math.round(avg30 * 100)}%`} sub="últimos 30 dias" tone="success" />
            <StatCard icon={Flame} label="Sequência" value={`${streak}`} sub="dias 100%" tone="warning" />
          </div>

          <HealthHeatmap />

          <section>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-semibold">Agenda de hoje</h2>
              <span className="text-sm text-muted-foreground">{doses.length} doses</span>
            </div>
            <DoseList doses={doses} />
          </section>
        </>
      )}
    </div>
  );
}

function StatCard({
  icon: Icon, label, value, sub, tone,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string; value: string; sub: string;
  tone: "primary" | "success" | "warning";
}) {
  const toneCls =
    tone === "primary" ? "bg-primary/10 text-primary"
    : tone === "success" ? "bg-success/15 text-success"
    : "bg-warning/20 text-warning-foreground";
  return (
    <div className="rounded-2xl border border-border bg-card p-3 md:p-4 shadow-sm">
      <div className={`h-8 w-8 md:h-10 md:w-10 rounded-lg flex items-center justify-center ${toneCls}`}>
        <Icon className="h-4 w-4 md:h-5 md:w-5" />
      </div>
      <div className="mt-2 md:mt-3 text-xl md:text-2xl font-bold tabular-nums">{value}</div>
      <div className="text-[11px] md:text-xs text-muted-foreground leading-tight">{label}</div>
      <div className="text-[10px] md:text-[11px] text-muted-foreground/70 mt-0.5">{sub}</div>
    </div>
  );
}
