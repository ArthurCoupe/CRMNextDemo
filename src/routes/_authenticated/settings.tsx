import { createFileRoute } from "@tanstack/react-router";

import { PageHeader } from "@/components/layout/page-header";
import { DefaultSharesSettings } from "@/modules/contracts/ui/default-shares-settings";
import { FiscalSettings } from "@/modules/financial/ui/fiscal-settings";
import { PapeisSettings } from "@/modules/onboarding/ui/papeis-settings";
import { PipelinesSettings } from "@/modules/pipeline/ui/pipelines-settings";
import { QualificacaoSettings } from "@/modules/pipeline/ui/qualificacao-settings";
import { MetasSettings } from "@/modules/settings/ui/metas-settings";
import { TimeSettings } from "@/modules/settings/ui/time-settings";
import { exigirPapel } from "@/integrations/supabase/papel";

export const Route = createFileRoute("/_authenticated/settings")({
  beforeLoad: ({ context }) => exigirPapel(["owner"], context.papel),
  component: SettingsPage,
});

function SettingsPage() {
  return (
    <>
      <PageHeader title="Configurações" description="Metas, integrações e equipe" />

      <MetasSettings />

      <PipelinesSettings />
      <QualificacaoSettings />
      <TimeSettings />

      <PapeisSettings />
      <DefaultSharesSettings />
      <FiscalSettings />
    </>
  );
}
