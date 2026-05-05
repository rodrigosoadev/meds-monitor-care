import type { Medication } from "./storage";

export const FREQ_LABEL: Record<Medication["frequency"], string> = {
  daily: "Diariamente",
  alternate: "Dias alternados",
  weekly: "Semanal",
  interval_hours: "Por intervalo (horas)",
  interval_days: "Por intervalo (dias)",
};

const WD = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

export function describeFrequency(med: Medication): string {
  switch (med.frequency) {
    case "daily":
      return "Todos os dias";
    case "alternate":
      return "Dias alternados";
    case "interval_days":
      return `A cada ${med.intervalDays ?? 1} dias`;
    case "interval_hours":
      return `A cada ${med.intervalHours ?? 8}h (início ${med.startTime ?? "08:00"})`;
    case "weekly":
      return (med.weekdays ?? []).map((d) => WD[d]).join(", ") || "Sem dias selecionados";
  }
}
