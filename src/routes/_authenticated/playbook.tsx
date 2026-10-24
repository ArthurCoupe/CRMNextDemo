import { createFileRoute } from "@tanstack/react-router";

import { exigirPapel } from "@/integrations/supabase/papel";
import { PlaybookPage } from "@/modules/playbook/ui/playbook-page";

export const Route = createFileRoute("/_authenticated/playbook")({
  beforeLoad: ({ context }) => exigirPapel(["owner", "manager", "member"], context.papel),
  component: PlaybookPage,
});
