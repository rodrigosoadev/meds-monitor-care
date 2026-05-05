import { useState } from "react";
import { Check, Clock, X } from "lucide-react";
import { type ScheduledDose, markDose } from "@/lib/storage";
import { MedIcon } from "./MedIcon";
import { toast } from "sonner";

export function DoseList({ doses, readonly }: { doses: ScheduledDose[]; readonly?: boolean }) {
  const [animating, setAnimating] = useState<string | null>(null);

  if (doses.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-border bg-card/40 p-10 text-center">
        <div className="mx-auto h-20 w-20 rounded-full bg-accent flex items-center justify-center mb-4">
          <Clock className="h-10 w-10 text-accent-foreground" />
        </div>
        <h3 className="font-semibold text-lg">Nenhum remédio agendado</h3>
        <p className="text-sm text-muted-foreground mt-1">
          Adicione um medicamento para começar a acompanhar sua adesão.
        </p>
      </div>
    );
  }

  return (
    <ul className="space-y-3">
      {doses.map((d) => {
        const id = `${d.medId}-${d.time}`;
        const isAnim = animating === id;
        return (
          <li
            key={id}
            className={`group rounded-2xl border border-border bg-card p-4 flex items-center gap-4 shadow-sm transition-all ${
              isAnim ? "scale-[1.02] ring-2 ring-success" : ""
            }`}
          >
            <div
              className={`h-12 w-12 rounded-xl flex items-center justify-center shrink-0 transition-colors ${
                d.status === "taken"
                  ? "bg-success/15 text-success"
                  : d.status === "missed"
                  ? "bg-destructive/15 text-destructive"
                  : "bg-accent text-accent-foreground"
              }`}
            >
              <MedIcon icon={d.med.icon} className="h-6 w-6" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-semibold truncate">{d.med.name}</span>
                <span className="text-sm text-muted-foreground">{d.med.dosage}</span>
              </div>
              <div className="flex items-center gap-2 mt-1 flex-wrap">
                <span className="text-sm font-medium">{d.time}</span>
                <span className="text-xs px-2 py-0.5 rounded-full bg-secondary text-secondary-foreground">
                  {d.med.category}
                </span>
                {d.status === "taken" && (
                  <span className="text-xs px-2 py-0.5 rounded-full bg-success/15 text-success font-medium animate-pop">
                    ✓ Tomado
                  </span>
                )}
                {d.status === "missed" && (
                  <span className="text-xs px-2 py-0.5 rounded-full bg-destructive/15 text-destructive font-medium">
                    Esquecido
                  </span>
                )}
              </div>
            </div>
            {!readonly && d.status !== "taken" && (
              <div className="flex gap-2">
                <button
                  onClick={() => {
                    markDose(d.medId, d.date, d.time, "missed");
                    toast.error("Marcado como esquecido");
                  }}
                  className="h-10 w-10 rounded-xl border border-border text-muted-foreground hover:bg-destructive/10 hover:text-destructive hover:border-destructive/40 transition flex items-center justify-center"
                  aria-label="Marcar como esquecido"
                >
                  <X className="h-4 w-4" />
                </button>
                <button
                  onClick={() => {
                    setAnimating(id);
                    markDose(d.medId, d.date, d.time, "taken");
                    toast.success(`${d.med.name} registrado!`);
                    setTimeout(() => setAnimating(null), 600);
                  }}
                  className="h-10 px-4 rounded-xl bg-primary text-primary-foreground hover:bg-primary/90 active:scale-95 transition shadow-sm shadow-primary/20 flex items-center gap-2 font-medium text-sm"
                >
                  <Check className="h-4 w-4" />
                  <span className="hidden sm:inline">Tomei</span>
                </button>
              </div>
            )}
            {!readonly && d.status === "taken" && (
              <button
                onClick={() => {
                  markDose(d.medId, d.date, d.time, "pending");
                  toast("Marcação removida");
                }}
                className="text-xs text-muted-foreground hover:text-foreground underline"
              >
                desfazer
              </button>
            )}
          </li>
        );
      })}
    </ul>
  );
}
