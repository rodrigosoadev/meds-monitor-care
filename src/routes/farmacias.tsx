import { createFileRoute } from "@tanstack/react-router";
import { FarmaciasProximas } from "@/components/FarmaciasProximas";

export const Route = createFileRoute("/farmacias")({
  head: () => ({
    meta: [
      { title: "Farmácias · MediMind" },
      { name: "description", content: "Buscar farmácias próximas e gerenciar números de WhatsApp customizados." },
    ],
  }),
  component: FarmaciasProximas,
});
