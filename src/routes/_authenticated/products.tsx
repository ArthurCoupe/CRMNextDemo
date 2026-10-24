import { createFileRoute } from "@tanstack/react-router";

import { exigirPapel } from "@/integrations/supabase/papel";
import { CatalogoDeProdutos } from "@/modules/contracts/ui/catalogo-de-produtos";

export const Route = createFileRoute("/_authenticated/products")({
  beforeLoad: ({ context }) => exigirPapel(["owner", "manager", "member"], context.papel),
  component: CatalogoDeProdutos,
});
