import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { formatDateTime } from "@/shared/lib/date";
import { estadoDaConsulta } from "@/shared/ui/estado-da-consulta";
import { FalhaAoLer } from "@/shared/ui/falha-ao-ler";

import { LIMITE_DO_HISTORICO } from "../api/notifications.repository";
import { ROTULO_DO_AVISO } from "../domain/notificacoes";
import { useHistoricoDeAvisos } from "../hooks/use-notifications";

export function HistoricoDeAvisos() {
  const historico = useHistoricoDeAvisos();

  const estado = estadoDaConsulta(historico);
  if (estado === "erro") return <FalhaAoLer oQue="o histórico de avisos" />;
  if (estado === "carregando") {
    return <div className="h-48 animate-pulse rounded-xl border bg-card" />;
  }

  const linhas = historico.data ?? [];

  return (
    <Card className="space-y-4 p-6 shadow-card">
      <div>
        <h3 className="text-lg font-semibold">Avisos enviados</h3>
        <p className="text-sm text-muted-foreground">
          Os {LIMITE_DO_HISTORICO} mais recentes. Se um e-mail não chegou nos últimos dias, a
          resposta está aqui. Avisos mais antigos que isso saem da janela e ficam só no banco.
        </p>
      </div>

      {linhas.length === 0 ? (
        <p className="rounded-md bg-muted px-3 py-2 text-[13px] text-muted-foreground">
          Nenhum aviso registrado ainda, e este zero é leitura do banco, não falha. O job roda às 8h
          de São Paulo e só envia quando há o que dizer.
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-[11px] uppercase tracking-wide text-muted-foreground">
                <th className="px-3 py-2 text-left font-medium">Quando</th>
                <th className="px-3 py-2 text-left font-medium">Aviso</th>
                <th className="px-3 py-2 text-left font-medium">Para</th>
                <th className="px-3 py-2 text-left font-medium">Situação</th>
              </tr>
            </thead>
            <tbody>
              {linhas.map((linha) => (
                <tr key={linha.id} className="border-b last:border-0">
                  <td className="whitespace-nowrap px-3 py-2.5 tabular-nums">
                    {formatDateTime(linha.criadoEm)}
                  </td>
                  <td className="px-3 py-2.5">
                    <span className="font-medium">{ROTULO_DO_AVISO[linha.tipo]}</span>
                    <span className="ml-2 block text-[12px] text-muted-foreground">
                      {linha.assunto}
                    </span>
                  </td>
                  <td className="px-3 py-2.5 text-muted-foreground">{linha.para}</td>
                  <td className="px-3 py-2.5">
                    <Situacao enviadoEm={linha.enviadoEm} erro={linha.erro} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  );
}

function Situacao({ enviadoEm, erro }: { enviadoEm: string | null; erro: string | null }) {
  if (erro !== null) {
    return (
      <span className="text-destructive">
        <Badge variant="destructive">Falhou</Badge>
        <span className="ml-2 block text-[12px]">{erro}</span>
      </span>
    );
  }
  if (enviadoEm !== null) {
    return <Badge variant="secondary">Enviado</Badge>;
  }
  return (
    <span>
      <Badge variant="outline">Sem confirmação</Badge>
      <span className="ml-2 block text-[12px] text-muted-foreground">
        Reservado e não confirmado: o envio pode ter saído.
      </span>
    </span>
  );
}
