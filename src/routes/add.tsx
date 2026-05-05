import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { addMed } from "@/lib/storage";
import { MedForm } from "@/components/MedForm";
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

function AddPage() {
  const nav = useNavigate();
  return (
    <div className="max-w-2xl">
      <h1 className="text-2xl md:text-3xl font-bold tracking-tight mb-1">Novo medicamento</h1>
      <p className="text-muted-foreground mb-6">Preencha os dados abaixo para adicionar à sua agenda.</p>
      <MedForm
        submitLabel="Salvar medicamento"
        onCancel={() => nav({ to: "/" })}
        onSubmit={(v) => {
          addMed(v);
          toast.success("Medicamento adicionado!");
          nav({ to: "/medications" });
        }}
      />
    </div>
  );
}
