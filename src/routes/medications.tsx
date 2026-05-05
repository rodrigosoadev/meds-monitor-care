import { createFileRoute, Link } from "@tanstack/react-router";
import { useMeds, deleteMed, isMedScheduledOn } from "@/lib/storage";
import { MedIcon } from "@/components/MedIcon";
import { Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/medications")({
  head: () => ({
    meta: [
      { title: "Medicamentos · MediMind" },
      { name: "description", content: "Gerencie todos os seus medicamentos cadastrados." },
    ],
  }),
  component: MedsPage,
});

const FREQ_LABEL = { daily: "Diariamente", alternate: "Dias alternados", weekly: "Semanal" } as const;

function MedsPage() {
  const meds = useMeds();
  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight">Meus medicamentos</h1>
          <p className="text-muted-foreground mt-1">{meds.length} cadastrados</p>
        </div>
        <Link
          to="/add"
          className="inline-flex items-center gap-2 rounded-xl bg-primary text-primary-foreground px-4 py-2.5 font-medium shadow-sm shadow-primary/20 hover:bg-primary/90 transition"
        >
          <Plus className="h-4 w-4" />
          Novo
        </Link>
      </div>

      {meds.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border bg-card/40 p-10 text-center">
          <h3 className="font-semibold text-lg">Nada por aqui ainda</h3>
          <p className="text-sm text-muted-foreground mt-1 mb-4">
            Cadastre seu primeiro medicamento para começar.
          </p>
          <Link to="/add" className="inline-flex rounded-xl bg-primary text-primary-foreground px-4 py-2 font-medium">
            Adicionar
          </Link>
        </div>
      ) : (
        <ul className="grid gap-3 md:grid-cols-2">
          {meds.map((m) => {
            const today = new Date();
            const activeToday = isMedScheduledOn(m, today);
            return (
              <li key={m.id} className="rounded-2xl border border-border bg-card p-4 flex items-start gap-4 shadow-sm">
                <div className="h-12 w-12 rounded-xl bg-accent text-accent-foreground flex items-center justify-center shrink-0">
                  {m.photo ? (
                    <img src={m.photo} alt={m.name} className="h-12 w-12 rounded-xl object-cover" />
                  ) : (
                    <MedIcon icon={m.icon} className="h-6 w-6" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-semibold truncate">{m.name}</div>
                  <div className="text-sm text-muted-foreground">{m.dosage} · {FREQ_LABEL[m.frequency]}</div>
                  <div className="text-xs text-muted-foreground mt-1">
                    Horários: {m.times.join(", ")}
                  </div>
                  <div className="flex items-center gap-2 mt-2">
                    <span className="text-xs px-2 py-0.5 rounded-full bg-secondary">{m.category}</span>
                    {activeToday && (
                      <span className="text-xs px-2 py-0.5 rounded-full bg-success/15 text-success">Hoje</span>
                    )}
                  </div>
                </div>
                <button
                  onClick={() => {
                    if (confirm(`Remover ${m.name}?`)) {
                      deleteMed(m.id);
                      toast.success("Medicamento removido");
                    }
                  }}
                  className="h-9 w-9 rounded-lg text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition flex items-center justify-center"
                  aria-label="Excluir"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
