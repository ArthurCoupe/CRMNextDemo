import { createFileRoute } from "@tanstack/react-router";

import { exigirPapel } from "@/integrations/supabase/papel";
import { ClientsPage } from "@/modules/clients/ui/clients-page";

export const Route = createFileRoute("/_authenticated/clients")({
  beforeLoad: ({ context }) => exigirPapel(["owner", "manager", "member"], context.papel),
  component: ClientsPage,
});
