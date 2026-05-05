import { createFileRoute } from "@tanstack/react-router";
import { AppLayout } from "@/components/AppLayout";
import { HealthHeatmap } from "@/components/HealthHeatmap";
import { DoseList } from "@/components/DoseList";
import { getAdherenceForDate, getScheduledDosesForDate, useLogs, useMeds } from "@/lib/storage";
import { useMemo } from "react";
import { Toaster } from "sonner";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "MediMind — Sua adesão diária aos medicamentos" },
      {
        name: "description",
        content:
          "MediMind ajuda pacientes crônicos a gerenciar medicamentos com lembretes, histórico e mapa de calor de adesão.",
      },
    ],
  }),
  component: () => (
    <>
      <AppLayout />
      <Toaster position="top-center" richColors />
    </>
  ),
});

// override layout's outlet content via index page
export function Today() {
  return <TodayPage />;
}

function TodayPage() {
  return null;
}
