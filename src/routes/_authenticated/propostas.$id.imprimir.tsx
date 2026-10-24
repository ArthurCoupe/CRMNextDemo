import { createFileRoute } from "@tanstack/react-router";

import { exigirPapel } from "@/integrations/supabase/papel";
import { ImpressaoDaProposta } from "@/modules/proposals/ui/impressao-da-proposta";

export const Route = createFileRoute("/_authenticated/propostas/$id/imprimir")({
  beforeLoad: ({ context }) => exigirPapel(["owner", "manager", "member"], context.papel),
  component: PaginaDeImpressao,
});

function PaginaDeImpressao() {
  const { id } = Route.useParams();
  return <ImpressaoDaProposta propostaId={id} />;
}
