import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { getAdherenceForDate, getScheduledDosesForDate, heatLevel, todayStr, useLogs, useMeds } from "@/lib/storage";
import { DoseList } from "@/components/DoseList";
import { ChevronLeft, ChevronRight } from "lucide-react";

export const Route = createFileRoute("/calendar")({
  head: () => ({
    meta: [
      { title: "Calendário · MediMind" },
      { name: "description", content: "Histórico mensal de adesão aos medicamentos." },
    ],
  }),
  component: CalendarPage,
});

const HEAT = ["bg-heat-0", "bg-heat-1", "bg-heat-2", "bg-heat-3", "bg-heat-4"];
const WEEKDAYS = ["D", "S", "T", "Q", "Q", "S", "S"];

function CalendarPage() {
  const meds = useMeds();
  const logs = useLogs();
  const [cursor, setCursor] = useState(() => {
    const d = new Date();
    return new Date(d.getFullYear(), d.getMonth(), 1);
  });
  const [selected, setSelected] = useState<Date>(new Date());

  const grid = useMemo(() => {
    const year = cursor.getFullYear();
    const month = cursor.getMonth();
    const first = new Date(year, month, 1);
    const startWeekday = first.getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const cells: { date: Date | null }[] = [];
    for (let i = 0; i < startWeekday; i++) cells.push({ date: null });
    for (let d = 1; d <= daysInMonth; d++) cells.push({ date: new Date(year, month, d) });
    while (cells.length % 7 !== 0) cells.push({ date: null });
    return cells;
  }, [cursor]);

  const today = new Date();
  const selectedDoses = getScheduledDosesForDate(meds, logs, selected);
  const isFuture = selected > today;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl md:text-3xl font-bold tracking-tight">Calendário</h1>
        <p className="text-muted-foreground mt-1">Veja seu histórico e adesão mensal.</p>
      </div>

      <div className="rounded-2xl border border-border bg-card p-4 md:p-6 shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <button
            onClick={() => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() - 1, 1))}
            className="h-9 w-9 rounded-lg border border-border hover:bg-accent flex items-center justify-center"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <h2 className="font-semibold capitalize">
            {cursor.toLocaleDateString("pt-BR", { month: "long", year: "numeric" })}
          </h2>
          <button
            onClick={() => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1))}
            className="h-9 w-9 rounded-lg border border-border hover:bg-accent flex items-center justify-center"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>

        <div className="grid grid-cols-7 gap-1 md:gap-2 text-center text-xs text-muted-foreground mb-2">
          {WEEKDAYS.map((d, i) => <div key={i}>{d}</div>)}
        </div>
        <div className="grid grid-cols-7 gap-1 md:gap-2">
          {grid.map((c, i) => {
            if (!c.date) return <div key={i} />;
            const a = c.date <= today ? getAdherenceForDate(meds, logs, c.date) : { total: 0, taken: 0, ratio: 0 };
            const lvl = c.date <= today ? heatLevel(a.ratio, a.total) : 0;
            const isToday = todayStr(c.date) === todayStr(today);
            const isSelected = todayStr(c.date) === todayStr(selected);

            // Get scheduled medications for this date
            const scheduledDoses = c.date <= today ? getScheduledDosesForDate(meds, logs, c.date) : [];
            const uniqueMeds = [...new Set(scheduledDoses.map(d => d.med.name))];

            return (
              <button
                key={i}
                onClick={() => setSelected(c.date!)}
                className={`aspect-square rounded-lg p-1 text-xs md:text-sm font-medium border transition flex flex-col items-center justify-start gap-0.5 ${
                  isSelected
                    ? "border-primary ring-2 ring-primary/40"
                    : "border-transparent hover:border-border"
                } ${c.date > today ? "opacity-40" : ""}`}
              >
                <span className={isToday ? "text-primary font-bold" : ""}>{c.date.getDate()}</span>
                {a.total > 0 && <span className={`h-1.5 w-1.5 rounded-full ${HEAT[lvl]}`} />}
                {uniqueMeds.length > 0 && (
                  <div className="flex flex-col gap-0.5 max-h-8 overflow-hidden">
                    {uniqueMeds.slice(0, 2).map((medName, idx) => (
                      <span
                        key={idx}
                        className="text-[8px] md:text-[10px] leading-tight text-muted-foreground truncate max-w-full"
                        title={medName}
                      >
                        {medName.length > 6 ? `${medName.substring(0, 6)}...` : medName}
                      </span>
                    ))}
                    {uniqueMeds.length > 2 && (
                      <span className="text-[8px] md:text-[10px] leading-tight text-muted-foreground">
                        +{uniqueMeds.length - 2}
                      </span>
                    )}
                  </div>
                )}
              </button>
            );
          })}
        </div>
      </div>

      <section>
        <h2 className="text-xl font-semibold mb-3">
          {selected.toLocaleDateString("pt-BR", { weekday: "long", day: "numeric", month: "long" })}
        </h2>
        {isFuture ? (
          <div className="rounded-2xl border border-dashed border-border p-8 text-center text-muted-foreground">
            Esta data ainda não chegou.
          </div>
        ) : (
          <DoseList doses={selectedDoses} readonly={todayStr(selected) !== todayStr(today)} />
        )}
      </section>
    </div>
  );
}
