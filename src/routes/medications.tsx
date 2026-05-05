import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useMeds, deleteMed, isMedScheduledOn, setMedStatus, type Medication } from "@/lib/storage";
import { describeFrequency } from "@/lib/freq";
import { MedIcon } from "@/components/MedIcon";
import { EditMedDialog } from "@/components/EditMedDialog";
import { Plus, Trash2, Pencil, Pause, Play, Archive, ArchiveRestore, AlertTriangle } from "lucide-react";
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

function MedsPage() {
  const meds = useMeds();
  const [editing, setEditing] = useState<Medication | null>(null);
  const [filter, setFilter] = useState<"active" | "paused" | "archived">("active");

  const filtered = meds.filter((m) => m.status === filter);

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

      <div className="inline-flex rounded-xl border border-border bg-card p-1">
        {(
          [
            { v: "active", l: "Ativos" },
            { v: "paused", l: "Pausados" },
            { v: "archived", l: "Arquivados" },
          ] as const
        ).map((opt) => (
          <button
            key={opt.v}
            onClick={() => setFilter(opt.v)}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition ${
              filter === opt.v ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-accent"
            }`}
          >
            {opt.l} ({meds.filter((m) => m.status === opt.v).length})
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border bg-card/40 p-10 text-center">
          <h3 className="font-semibold text-lg">Nada por aqui ainda</h3>
          <p className="text-sm text-muted-foreground mt-1 mb-4">Cadastre seu primeiro medicamento para começar.</p>
          <Link to="/add" className="inline-flex rounded-xl bg-primary text-primary-foreground px-4 py-2 font-medium">
            Adicionar
          </Link>
        </div>
      ) : (
        <ul className="grid gap-3 md:grid-cols-2">
          {filtered.map((m) => {
            const today = new Date();
            const activeToday = isMedScheduledOn(m, today);
            const lowStock = typeof m.stock === "number" && typeof m.lowStockThreshold === "number" && m.stock <= m.lowStockThreshold;
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
                  <div className="text-sm text-muted-foreground">{m.dosage} · {describeFrequency(m)}</div>
                  <div className="flex items-center gap-2 mt-2 flex-wrap">
                    <span className="text-xs px-2 py-0.5 rounded-full bg-secondary">{m.category}</span>
                    {m.status === "active" && activeToday && (
                      <span className="text-xs px-2 py-0.5 rounded-full bg-success/15 text-success">Hoje</span>
                    )}
                    {m.status === "paused" && (
                      <span className="text-xs px-2 py-0.5 rounded-full bg-warning/30 text-warning-foreground">Pausado</span>
                    )}
                    {m.status === "archived" && (
                      <span className="text-xs px-2 py-0.5 rounded-full bg-muted text-muted-foreground">Arquivado</span>
                    )}
                    {typeof m.stock === "number" && (
                      <span className={`text-xs px-2 py-0.5 rounded-full inline-flex items-center gap-1 ${
                        lowStock ? "bg-destructive/15 text-destructive" : "bg-secondary text-secondary-foreground"
                      }`}>
                        {lowStock && <AlertTriangle className="h-3 w-3" />}
                        Estoque: {m.stock}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-1 mt-3">
                    <IconBtn label="Editar" onClick={() => setEditing(m)}>
                      <Pencil className="h-4 w-4" />
                    </IconBtn>
                    {m.status === "active" ? (
                      <IconBtn label="Pausar" onClick={() => { setMedStatus(m.id, "paused"); toast("Tratamento pausado"); }}>
                        <Pause className="h-4 w-4" />
                      </IconBtn>
                    ) : (
                      <IconBtn label="Retomar" onClick={() => { setMedStatus(m.id, "active"); toast.success("Tratamento ativo"); }}>
                        <Play className="h-4 w-4" />
                      </IconBtn>
                    )}
                    {m.status !== "archived" ? (
                      <IconBtn label="Arquivar" onClick={() => { setMedStatus(m.id, "archived"); toast("Arquivado"); }}>
                        <Archive className="h-4 w-4" />
                      </IconBtn>
                    ) : (
                      <IconBtn label="Restaurar" onClick={() => { setMedStatus(m.id, "active"); toast.success("Restaurado"); }}>
                        <ArchiveRestore className="h-4 w-4" />
                      </IconBtn>
                    )}
                    <IconBtn
                      label="Excluir"
                      destructive
                      onClick={() => {
                        if (confirm(`Remover ${m.name}? Esta ação é permanente.`)) {
                          deleteMed(m.id);
                          toast.success("Medicamento removido");
                        }
                      }}
                    >
                      <Trash2 className="h-4 w-4" />
                    </IconBtn>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      <EditMedDialog med={editing} open={!!editing} onOpenChange={(o) => !o && setEditing(null)} />
    </div>
  );
}

function IconBtn({ children, onClick, label, destructive }: { children: React.ReactNode; onClick: () => void; label: string; destructive?: boolean }) {
  return (
    <button
      onClick={onClick}
      title={label}
      aria-label={label}
      className={`h-8 w-8 rounded-lg text-muted-foreground transition flex items-center justify-center ${
        destructive ? "hover:bg-destructive/10 hover:text-destructive" : "hover:bg-accent hover:text-foreground"
      }`}
    >
      {children}
    </button>
  );
}
