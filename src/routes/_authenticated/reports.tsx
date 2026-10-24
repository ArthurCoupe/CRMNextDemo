import { createFileRoute } from "@tanstack/react-router";

import { exigirPapel } from "@/integrations/supabase/papel";
import { ReportsPage } from "@/modules/pipeline/ui/reports-page";

export const Route = createFileRoute("/_authenticated/reports")({
  beforeLoad: ({ context }) => exigirPapel(["owner", "manager", "member"], context.papel),
  component: ReportsPage,
});
