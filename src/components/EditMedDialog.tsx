import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { MedForm } from "./MedForm";
import { updateMed, type Medication } from "@/lib/storage";
import { toast } from "sonner";

export function EditMedDialog({
  med,
  open,
  onOpenChange,
}: {
  med: Medication | null;
  open: boolean;
  onOpenChange: (o: boolean) => void;
}) {
  if (!med) return null;
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Editar medicamento</DialogTitle>
        </DialogHeader>
        <MedForm
          initial={med}
          submitLabel="Salvar alterações"
          onCancel={() => onOpenChange(false)}
          onSubmit={(v) => {
            updateMed(med.id, v);
            toast.success("Medicamento atualizado");
            onOpenChange(false);
          }}
        />
      </DialogContent>
    </Dialog>
  );
}
