import { createFileRoute } from "@tanstack/react-router";

import { PageHeader } from "@/components/layout/page-header";
import { HistoricoDeAvisos } from "@/modules/notifications/ui/historico-de-avisos";
import { PreferenciasDeNotificacao } from "@/modules/notifications/ui/preferencias-de-notificacao";
import { UltimaPassada } from "@/modules/notifications/ui/ultima-passada";

export const Route = createFileRoute("/_authenticated/notificacoes")({
  component: NotificacoesPage,
});

function NotificacoesPage() {
  return (
    <>
      <PageHeader
        title="Notificações"
        description="O que o sistema te avisa, e o que já foi enviado"
      />
      <PreferenciasDeNotificacao />
      <UltimaPassada />
      <HistoricoDeAvisos />
    </>
  );
}
