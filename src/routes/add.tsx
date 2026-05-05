import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { addMed, todayStr, type MedFrequency, type MedIcon as MedIconType } from "@/lib/storage";
import { MedIcon } from "@/components/MedIcon";
import { Camera, Plus, X } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/add")({
  head: () => ({
    meta: [
      { title: "Adicionar medicamento · MediMind" },
      { name: "description", content: "Cadastre um novo medicamento, dosagem, horários e duração." },
    ],
  }),
  component: AddPage,
});

const ICONS: { value: MedIconType; label: string }[] = [
  { value: "pill", label: "Comprimido" },
  { value: "capsule", label: "Cápsula" },
  { value: "syrup", label: "Xarope" },
  { value: "injection", label: "Injeção" },
  { value: "drop", label: "Gotas" },
];

const WEEKDAYS = ["D", "S", "T", "Q", "Q", "S", "S"];

function AddPage() {
  const nav = useNavigate();
  const [name, setName] = useState("");
  const [dosage, setDosage] = useState("");
  const [category, setCategory] = useState("Pós-refeição");
  const [icon, setIcon] = useState<MedIconType>("pill");
  const [frequency, setFrequency] = useState<MedFrequency>("daily");
  const [weekdays, setWeekdays] = useState<number[]>([1, 3, 5]);
  const [times, setTimes] = useState<string[]>(["08:00"]);
  const [continuous, setContinuous] = useState(true);
  const [durationDays, setDurationDays] = useState(7);
  const [photo, setPhoto] = useState<string | undefined>();

  function onPhotoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    if (f.size > 2_000_000) {
      toast.error("Imagem muito grande (máx 2MB)");
      return;
    }
    const r = new FileReader();
    r.onload = () => setPhoto(r.result as string);
    r.readAsDataURL(f);
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim() || !dosage.trim() || times.length === 0) {
      toast.error("Preencha nome, dosagem e ao menos um horário");
      return;
    }
    addMed({
      name: name.trim().slice(0, 80),
      dosage: dosage.trim().slice(0, 40),
      category: category.trim().slice(0, 40),
      icon,
      frequency,
      weekdays: frequency === "weekly" ? weekdays : undefined,
      times: [...times].sort(),
      startDate: todayStr(),
      durationDays: continuous ? undefined : Math.max(1, Math.min(365, durationDays)),
      photo,
    });
    toast.success("Medicamento adicionado!");
    nav({ to: "/medications" });
  }

  return (
    <div className="max-w-2xl">
      <h1 className="text-2xl md:text-3xl font-bold tracking-tight mb-1">Novo medicamento</h1>
      <p className="text-muted-foreground mb-6">Preencha os dados abaixo para adicionar à sua agenda.</p>

      <form onSubmit={submit} className="space-y-6">
        <div className="rounded-2xl border border-border bg-card p-5 space-y-4">
          <Field label="Nome do remédio">
            <input
              required
              maxLength={80}
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ex: Losartana"
              className="input"
            />
          </Field>
          <div className="grid grid-cols-2 gap-4">
            <Field label="Dosagem">
              <input
                required
                maxLength={40}
                value={dosage}
                onChange={(e) => setDosage(e.target.value)}
                placeholder="Ex: 50mg"
                className="input"
              />
            </Field>
            <Field label="Categoria">
              <input
                maxLength={40}
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                placeholder="Ex: Pós-almoço"
                className="input"
              />
            </Field>
          </div>

          <Field label="Tipo / ícone">
            <div className="flex gap-2 flex-wrap">
              {ICONS.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setIcon(opt.value)}
                  className={`flex flex-col items-center gap-1 px-3 py-2 rounded-xl border transition ${
                    icon === opt.value ? "border-primary bg-primary/10 text-primary" : "border-border hover:bg-accent"
                  }`}
                >
                  <MedIcon icon={opt.value} className="h-5 w-5" />
                  <span className="text-xs">{opt.label}</span>
                </button>
              ))}
            </div>
          </Field>

          <Field label="Foto da caixa (opcional)">
            <div className="flex items-center gap-3">
              {photo ? (
                <div className="relative">
                  <img src={photo} className="h-16 w-16 rounded-xl object-cover" alt="prévia" />
                  <button
                    type="button"
                    onClick={() => setPhoto(undefined)}
                    className="absolute -top-2 -right-2 h-6 w-6 rounded-full bg-destructive text-destructive-foreground flex items-center justify-center"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </div>
              ) : (
                <label className="h-16 w-16 rounded-xl border-2 border-dashed border-border flex items-center justify-center text-muted-foreground hover:bg-accent cursor-pointer">
                  <Camera className="h-5 w-5" />
                  <input type="file" accept="image/*" className="hidden" onChange={onPhotoChange} />
                </label>
              )}
              <span className="text-sm text-muted-foreground">JPG ou PNG, até 2MB</span>
            </div>
          </Field>
        </div>

        <div className="rounded-2xl border border-border bg-card p-5 space-y-4">
          <Field label="Frequência">
            <div className="grid grid-cols-3 gap-2">
              {(
                [
                  { v: "daily", l: "Diária" },
                  { v: "alternate", l: "Alternada" },
                  { v: "weekly", l: "Semanal" },
                ] as const
              ).map((opt) => (
                <button
                  key={opt.v}
                  type="button"
                  onClick={() => setFrequency(opt.v)}
                  className={`px-3 py-2.5 rounded-xl border text-sm font-medium transition ${
                    frequency === opt.v ? "border-primary bg-primary/10 text-primary" : "border-border hover:bg-accent"
                  }`}
                >
                  {opt.l}
                </button>
              ))}
            </div>
          </Field>

          {frequency === "weekly" && (
            <Field label="Dias da semana">
              <div className="flex gap-2">
                {WEEKDAYS.map((d, i) => {
                  const active = weekdays.includes(i);
                  return (
                    <button
                      key={i}
                      type="button"
                      onClick={() =>
                        setWeekdays((w) => (active ? w.filter((x) => x !== i) : [...w, i].sort()))
                      }
                      className={`h-10 w-10 rounded-full text-sm font-medium border transition ${
                        active ? "bg-primary text-primary-foreground border-primary" : "border-border hover:bg-accent"
                      }`}
                    >
                      {d}
                    </button>
                  );
                })}
              </div>
            </Field>
          )}

          <Field label="Horários">
            <div className="space-y-2">
              {times.map((t, i) => (
                <div key={i} className="flex gap-2">
                  <input
                    type="time"
                    value={t}
                    onChange={(e) => setTimes((arr) => arr.map((x, idx) => (idx === i ? e.target.value : x)))}
                    className="input flex-1"
                  />
                  {times.length > 1 && (
                    <button
                      type="button"
                      onClick={() => setTimes((arr) => arr.filter((_, idx) => idx !== i))}
                      className="h-10 w-10 rounded-xl border border-border hover:bg-destructive/10 hover:text-destructive transition flex items-center justify-center"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  )}
                </div>
              ))}
              <button
                type="button"
                onClick={() => setTimes((arr) => [...arr, "12:00"])}
                className="inline-flex items-center gap-1 text-sm text-primary font-medium hover:underline"
              >
                <Plus className="h-4 w-4" /> adicionar horário
              </button>
            </div>
          </Field>

          <Field label="Duração do tratamento">
            <div className="flex items-center gap-3">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={continuous}
                  onChange={(e) => setContinuous(e.target.checked)}
                  className="h-4 w-4 rounded accent-[var(--color-primary)]"
                />
                <span className="text-sm">Uso contínuo</span>
              </label>
              {!continuous && (
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    min={1}
                    max={365}
                    value={durationDays}
                    onChange={(e) => setDurationDays(Number(e.target.value))}
                    className="input w-24"
                  />
                  <span className="text-sm text-muted-foreground">dias</span>
                </div>
              )}
            </div>
          </Field>
        </div>

        <div className="flex justify-end gap-3">
          <button
            type="button"
            onClick={() => nav({ to: "/" })}
            className="px-4 py-2.5 rounded-xl border border-border font-medium hover:bg-accent transition"
          >
            Cancelar
          </button>
          <button
            type="submit"
            className="px-5 py-2.5 rounded-xl bg-primary text-primary-foreground font-medium shadow-sm shadow-primary/20 hover:bg-primary/90 transition"
          >
            Salvar medicamento
          </button>
        </div>
      </form>

      <style>{`
        .input {
          width: 100%;
          padding: 0.625rem 0.875rem;
          border-radius: 0.75rem;
          border: 1px solid var(--color-border);
          background: var(--color-background);
          color: var(--color-foreground);
          font-size: 0.95rem;
          transition: border-color 0.15s, box-shadow 0.15s;
        }
        .input:focus { outline: none; border-color: var(--color-primary); box-shadow: 0 0 0 3px color-mix(in oklab, var(--color-primary) 20%, transparent); }
      `}</style>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-sm font-medium mb-1.5">{label}</label>
      {children}
    </div>
  );
}
