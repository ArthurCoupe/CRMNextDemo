import { createFileRoute, useNavigate } from "@tanstack/react-router";

import { exigirPapel } from "@/integrations/supabase/papel";
import { ContractsPage } from "@/modules/contracts/ui/contracts-page";

interface BuscaDeContratos {
  cliente?: string;
}

const FORMATO_DE_UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const Route = createFileRoute("/_authenticated/contracts")({
  validateSearch: (busca: Record<string, unknown>): BuscaDeContratos => ({
    cliente:
      typeof busca.cliente === "string" && FORMATO_DE_UUID.test(busca.cliente)
        ? busca.cliente.toLowerCase()
        : undefined,
  }),
  beforeLoad: ({ context }) => exigirPapel(["owner", "manager"], context.papel),
  component: ContratosRoute,
});

function ContratosRoute() {
  const { cliente } = Route.useSearch();
  const navegar = useNavigate({ from: "/contracts" });
  return (
    <ContractsPage clienteId={cliente ?? null} aoVerTodos={() => void navegar({ search: {} })} />
  );
}
