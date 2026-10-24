import { createFileRoute } from "@tanstack/react-router";

import { PageHeader } from "@/components/layout/page-header";
import { SegundoFator } from "@/modules/seguranca/ui/segundo-fator";

export const Route = createFileRoute("/_authenticated/seguranca")({
  component: SegurancaPage,
});

function SegurancaPage() {
  return (
    <>
      <PageHeader
        title="Segurança da conta"
        description="Segundo fator de autenticação (app autenticador)"
      />
      <SegundoFator />
    </>
  );
}
