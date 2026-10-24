import { createFileRoute } from "@tanstack/react-router";

import { exigirPapel } from "@/integrations/supabase/papel";
import { FinancialPage } from "@/modules/financial/ui/financial-page";

export const Route = createFileRoute("/_authenticated/financial")({
  beforeLoad: ({ context }) => exigirPapel(["owner"], context.papel),
  component: FinancialPage,
});
