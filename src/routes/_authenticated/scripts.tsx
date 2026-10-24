import { createFileRoute, useNavigate } from "@tanstack/react-router";

import { exigirPapel } from "@/integrations/supabase/papel";
import { ScriptsPage } from "@/modules/scripts/ui/scripts-page";
import type { TipoDeScript } from "@/modules/scripts/domain/script";

interface BuscaDeScripts {
  tipo: TipoDeScript;
}

export const Route = createFileRoute("/_authenticated/scripts")({
  beforeLoad: ({ context }) => exigirPapel(["owner", "manager", "member"], context.papel),
  validateSearch: (busca: Record<string, unknown>): BuscaDeScripts => ({
    tipo: busca.tipo === "closer" ? "closer" : "sdr",
  }),
  component: ScriptsRoute,
});

function ScriptsRoute() {
  const { tipo } = Route.useSearch();
  const navegar = useNavigate({ from: "/scripts" });

  return (
    <ScriptsPage tipo={tipo} aoTrocarTipo={(novo) => void navegar({ search: { tipo: novo } })} />
  );
}
