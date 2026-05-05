import { useMemo, useState } from "react";
import { getAdherenceForDate, heatLevel, useLogs, useMeds } from "@/lib/storage";

const HEAT_CLASSES = [
  "bg-heat-0",
  "bg-heat-1",
  "bg-heat-2",
  "bg-heat-3",
  "bg-heat-4",
  "bg-heat-5",
];

const MONTHS = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];

interface Cell {
  date: Date;
  level: number;
  ratio: number;
  total: number;
  taken: number;
  onTimeRatio: number;
}

export function HealthHeatmap() {
  const meds = useMeds();
  const logs = useLogs();
  const [hover, setHover] = useState<{ cell: Cell; x: number; y: number } | null>(null);

  const data = useMemo<Cell[]>(() => {
    const today = new Date();
    const end = new Date(today);
    const dayOfWeek = end.getDay();
    const cells: Cell[] = [];
    const totalCells = 53 * 7;
    const start = new Date(end);
    start.setDate(end.getDate() - (totalCells - 1) + (6 - dayOfWeek));
    for (let i = 0; i < totalCells; i++) {
      const d = new Date(start);
      d.setDate(start.getDate() + i);
      if (d > today) {
        cells.push({ date: d, level: -1, ratio: 0, total: 0, taken: 0, onTimeRatio: 0 });
        continue;
      }
      const a = getAdherenceForDate(meds, logs, d);
      cells.push({
        date: d,
        level: heatLevel(a.ratio, a.total, a.onTimeRatio),
        ratio: a.ratio,
        total: a.total,
        taken: a.taken,
        onTimeRatio: a.onTimeRatio,
      });
    }
    return cells;
  }, [meds, logs]);

  const columns: Cell[][] = [];
  for (let c = 0; c < 53; c++) columns.push(data.slice(c * 7, c * 7 + 7));

  const monthLabels = columns.map((col) => {
    const first = col[0]?.date;
    if (!first) return "";
    return first.getDate() <= 7 ? MONTHS[first.getMonth()] : "";
  });

  function handleEnter(e: React.MouseEvent<HTMLDivElement>, cell: Cell) {
    if (cell.level < 0) return;
    const rect = (e.currentTarget.closest("[data-heatmap-root]") as HTMLElement)?.getBoundingClientRect();
    const r = e.currentTarget.getBoundingClientRect();
    if (!rect) return;
    setHover({ cell, x: r.left - rect.left + r.width / 2, y: r.top - rect.top });
  }

  return (
    <div className="rounded-2xl border border-border bg-card p-5 md:p-6 shadow-sm relative" data-heatmap-root>
      <div className="flex items-start justify-between mb-4 flex-wrap gap-2">
        <div>
          <h2 className="text-lg font-semibold">Health Heatmap</h2>
          <p className="text-sm text-muted-foreground">Sua adesão nos últimos 12 meses · cor mais escura = no horário</p>
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
          <div className="flex gap-[3px] pl-6 text-[10px] text-muted-foreground h-3">
            {monthLabels.map((m, i) => (
              <div key={i} className="w-3 text-left">{m}</div>
            ))}
          </div>
          <div className="flex gap-[3px]">
            <div className="flex flex-col gap-[3px] pr-1 text-[10px] text-muted-foreground">
              {["", "Seg", "", "Qua", "", "Sex", ""].map((d, i) => (
                <div key={i} className="h-3 leading-3">{d}</div>
              ))}
            </div>
            {columns.map((col, ci) => (
              <div key={ci} className="flex flex-col gap-[3px]">
                {col.map((cell, ri) => {
                  if (cell.level < 0) return <div key={ri} className="h-3 w-3 rounded-sm opacity-0" />;
                  const cls = HEAT_CLASSES[cell.level];
                  return (
                    <div
                      key={ri}
                      onMouseEnter={(e) => handleEnter(e, cell)}
                      onMouseLeave={() => setHover(null)}
                      onTouchStart={(e) => handleEnter(e as unknown as React.MouseEvent<HTMLDivElement>, cell)}
                      className={`h-3 w-3 rounded-sm ${cls} hover:ring-2 hover:ring-primary/60 transition cursor-pointer`}
                    />
                  );
                })}
              </div>
            ))}
          </div>
        </div>
      </div>

      {hover && (
        <div
          className="pointer-events-none absolute z-20 -translate-x-1/2 -translate-y-full mt-[-6px] rounded-lg bg-foreground text-background text-xs px-3 py-2 shadow-lg whitespace-nowrap"
          style={{ left: hover.x, top: hover.y }}
        >
          <div className="font-semibold">
            {hover.cell.date.toLocaleDateString("pt-BR", { day: "numeric", month: "long", year: "numeric" })}
          </div>
          {hover.cell.total === 0 ? (
            <div className="opacity-80">Sem doses agendadas</div>
          ) : (
            <>
              <div className="opacity-80">
                {hover.cell.taken}/{hover.cell.total} doses · {Math.round(hover.cell.ratio * 100)}% adesão
              </div>
              {hover.cell.taken > 0 && (
                <div className="opacity-80">{Math.round(hover.cell.onTimeRatio * 100)}% no horário</div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}
