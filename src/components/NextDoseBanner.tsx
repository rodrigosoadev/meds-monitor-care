import { useEffect, useMemo, useState } from "react";
import { Bell, Clock } from "lucide-react";
import { getScheduledDosesForDate, useLogs, useMeds } from "@/lib/storage";

function timeToMinutes(t: string) {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + m;
}

export function NextDoseBanner() {
  const meds = useMeds();
  const logs = useLogs();
  const [now, setNow] = useState(new Date());

  useEffect(() => {
    const i = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(i);
  }, []);

  const next = useMemo(() => {
    const doses = getScheduledDosesForDate(meds, logs, now);
    const nowMin = now.getHours() * 60 + now.getMinutes();
    const upcoming = doses.find(
      (d) => d.status !== "taken" && timeToMinutes(d.time) >= nowMin
    );
    return upcoming;
  }, [meds, logs, now]);

  if (!next) {
    return (
      <div className="rounded-2xl border border-border bg-card p-4 md:p-5 flex items-center gap-4 shadow-sm">
        <div className="h-12 w-12 rounded-xl bg-success/15 text-success flex items-center justify-center">
          <Bell className="h-5 w-5" />
        </div>
        <div>
          <div className="font-semibold">Tudo em dia por hoje 🎉</div>
          <div className="text-sm text-muted-foreground">Nenhuma dose pendente no momento.</div>
        </div>
      </div>
    );
  }

  const target = new Date(now);
  const [h, m] = next.time.split(":").map(Number);
  target.setHours(h, m, 0, 0);
  const diff = Math.max(0, target.getTime() - now.getTime());
  const hh = Math.floor(diff / 3_600_000);
  const mm = Math.floor((diff % 3_600_000) / 60_000);
  const ss = Math.floor((diff % 60_000) / 1000);
  const fmt = `${String(hh).padStart(2, "0")}:${String(mm).padStart(2, "0")}:${String(ss).padStart(2, "0")}`;

  return (
    <div className="rounded-2xl bg-gradient-to-r from-primary to-primary-glow text-primary-foreground p-4 md:p-5 shadow-lg shadow-primary/20 flex items-center gap-4">
      <div className="h-12 w-12 rounded-xl bg-white/15 flex items-center justify-center backdrop-blur">
        <Clock className="h-6 w-6" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-xs uppercase tracking-wider opacity-80">Próxima dose</div>
        <div className="font-semibold truncate text-lg">
          {next.med.name} · {next.med.dosage}
        </div>
        <div className="text-sm opacity-90">{next.med.category} · às {next.time}</div>
      </div>
      <div className="text-right">
        <div className="font-mono text-2xl md:text-3xl font-bold tabular-nums">{fmt}</div>
        <div className="text-xs opacity-80">faltam</div>
      </div>
    </div>
  );
}
