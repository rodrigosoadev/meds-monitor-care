import { useMemo } from "react";
import { getAdherenceForDate, heatLevel, useLogs, useMeds } from "@/lib/storage";

const HEAT_CLASSES = [
  "bg-heat-0",
  "bg-heat-1",
  "bg-heat-2",
  "bg-heat-3",
  "bg-heat-4",
];

const MONTHS = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];

export function HealthHeatmap() {
  const meds = useMeds();
  const logs = useLogs();

  const data = useMemo(() => {
    // 53 weeks ending today
    const today = new Date();
    const end = new Date(today);
    // align end to Saturday for nice columns
    const dayOfWeek = end.getDay();
    const cells: { date: Date; level: number; ratio: number; total: number; taken: number }[] = [];
    const totalCells = 53 * 7;
    const start = new Date(end);
    start.setDate(end.getDate() - (totalCells - 1) + (6 - dayOfWeek));
    for (let i = 0; i < totalCells; i++) {
      const d = new Date(start);
      d.setDate(start.getDate() + i);
      if (d > today) {
        cells.push({ date: d, level: -1, ratio: 0, total: 0, taken: 0 });
        continue;
      }
      const a = getAdherenceForDate(meds, logs, d);
      cells.push({ date: d, level: heatLevel(a.ratio, a.total), ratio: a.ratio, total: a.total, taken: a.taken });
    }
    return cells;
  }, [meds, logs]);

  // Build columns of 7
  const columns: typeof data[] = [];
  for (let c = 0; c < 53; c++) {
    columns.push(data.slice(c * 7, c * 7 + 7));
  }

  // Month labels: show month name on first column where day-of-month <=7
  const monthLabels = columns.map((col) => {
    const first = col[0]?.date;
    if (!first) return "";
    return first.getDate() <= 7 ? MONTHS[first.getMonth()] : "";
  });

  return (
    <div className="rounded-2xl border border-border bg-card p-5 md:p-6 shadow-sm">
      <div className="flex items-start justify-between mb-4 flex-wrap gap-2">
        <div>
          <h2 className="text-lg font-semibold">Health Heatmap</h2>
          <p className="text-sm text-muted-foreground">Sua adesão nos últimos 12 meses</p>
        </div>
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <span>Menos</span>
          {HEAT_CLASSES.map((c, i) => (
            <span key={i} className={`h-3 w-3 rounded-sm ${c}`} />
          ))}
          <span>Mais</span>
        </div>
      </div>

      <div className="overflow-x-auto pb-2">
        <div className="inline-flex flex-col gap-1 min-w-max">
          {/* month labels */}
          <div className="flex gap-[3px] pl-6 text-[10px] text-muted-foreground h-3">
            {monthLabels.map((m, i) => (
              <div key={i} className="w-3 text-left">{m}</div>
            ))}
          </div>
          <div className="flex gap-[3px]">
            {/* weekday labels */}
            <div className="flex flex-col gap-[3px] pr-1 text-[10px] text-muted-foreground">
              {["", "Seg", "", "Qua", "", "Sex", ""].map((d, i) => (
                <div key={i} className="h-3 leading-3">{d}</div>
              ))}
            </div>
            {columns.map((col, ci) => (
              <div key={ci} className="flex flex-col gap-[3px]">
                {col.map((cell, ri) => {
                  if (cell.level < 0) {
                    return <div key={ri} className="h-3 w-3 rounded-sm opacity-0" />;
                  }
                  const cls = HEAT_CLASSES[cell.level];
                  const title =
                    cell.total === 0
                      ? `${cell.date.toLocaleDateString("pt-BR")} — sem doses`
                      : `${cell.date.toLocaleDateString("pt-BR")} — ${cell.taken}/${cell.total} (${Math.round(cell.ratio * 100)}%)`;
                  return (
                    <div
                      key={ri}
                      title={title}
                      className={`h-3 w-3 rounded-sm ${cls} hover:ring-2 hover:ring-primary/60 transition`}
                    />
                  );
                })}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
