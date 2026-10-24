import { createFileRoute } from "@tanstack/react-router";

import { PageHeader } from "@/components/layout/page-header";
import { AccessDenied } from "@/shared/ui/access-denied";

interface BuscaAcessoNegado {
  exigido?: string;
}

export const Route = createFileRoute("/_authenticated/acesso-negado")({
  validateSearch: (busca: Record<string, unknown>): BuscaAcessoNegado => ({
    exigido: typeof busca.exigido === "string" ? busca.exigido : undefined,
  }),
  component: AcessoNegadoPage,
});

function AcessoNegadoPage() {
  const { exigido } = Route.useSearch();

  return (
    <>
      <PageHeader title="Acesso negado" />
      <AccessDenied exigido={exigido} />
    </>
  );
}
