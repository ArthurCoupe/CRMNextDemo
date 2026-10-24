import { createFileRoute } from "@tanstack/react-router";

import { exigirPapel } from "@/integrations/supabase/papel";
import { PaginaDeConteudo } from "@/modules/content/ui/pagina-de-conteudo";

export const Route = createFileRoute("/_authenticated/conteudo")({
  beforeLoad: ({ context }) => exigirPapel(["owner", "manager", "member"], context.papel),
  component: PaginaDeConteudo,
});
