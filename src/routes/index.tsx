import { createFileRoute } from "@tanstack/react-router";
import { HealthHeatmap } from "@/components/HealthHeatmap";
import { DoseList } from "@/components/DoseList";
import { getAdherenceForDate, getScheduledDosesForDate, useLogs, useMeds } from "@/lib/storage";
import { useMemo } from "react";
import { TrendingUp, Target, Flame } from "lucide-react";

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
  const today = useMemo(() => new Date(), []);
  const doses = useMemo(() => getScheduledDosesForDate(meds, logs, today), [meds, logs, today]);
  const adherence = getAdherenceForDate(meds, logs, today);

  // streak: consecutive days back from yesterday with 100% adherence
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

  // 30-day average
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

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl md:text-3xl font-bold tracking-tight">Olá 👋</h1>
        <p className="text-muted-foreground mt-1">
          {today.toLocaleDateString("pt-BR", { weekday: "long", day: "numeric", month: "long" })}
        </p>
      </div>

      <div className="grid grid-cols-3 gap-3 md:gap-4">
        <StatCard
          icon={Target}
          label="Adesão hoje"
          value={`${Math.round(adherence.ratio * 100)}%`}
          sub={`${adherence.taken}/${adherence.total} doses`}
          tone="primary"
        />
        <StatCard
          icon={TrendingUp}
          label="Média 30d"
          value={`${Math.round(avg30 * 100)}%`}
          sub="últimos 30 dias"
          tone="success"
        />
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
    </div>
  );
}

function StatCard({
  icon: Icon,
  label,
  value,
  sub,
  tone,
}: {
  icon: any;
  label: string;
  value: string;
  sub: string;
  tone: "primary" | "success" | "warning";
}) {
  const toneCls =
    tone === "primary"
      ? "bg-primary/10 text-primary"
      : tone === "success"
      ? "bg-success/15 text-success"
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
