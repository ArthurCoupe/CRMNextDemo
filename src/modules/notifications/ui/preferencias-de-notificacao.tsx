import { Card } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { useAuth } from "@/hooks/use-auth";
import { estadoDaConsulta } from "@/shared/ui/estado-da-consulta";
import { FalhaAoLer } from "@/shared/ui/falha-ao-ler";

import { EXPLICACAO_DO_AVISO, ROTULO_DO_AVISO, TIPOS_DE_AVISO } from "../domain/notificacoes";
import { useDefinirPreferencia, usePreferenciasDesligadas } from "../hooks/use-notifications";

export function PreferenciasDeNotificacao() {
  const { user } = useAuth();
  const desligados = usePreferenciasDesligadas(user?.id ?? null);
  const definir = useDefinirPreferencia();

  const estado = estadoDaConsulta(desligados);
  if (estado === "erro") return <FalhaAoLer oQue="as suas preferências de aviso" />;
  if (estado === "carregando") {
    return <div className="h-64 animate-pulse rounded-xl border bg-card" />;
  }

  const desligadosAgora = new Set(desligados.data ?? []);

  return (
    <Card className="space-y-4 p-6 shadow-card">
      <div>
        <h3 className="text-lg font-semibold">Avisos por e-mail</h3>
        <p className="text-sm text-muted-foreground">
          O sistema avisa por padrão. Desligue o que não quiser receber: vale só para você.
        </p>
      </div>

      <div className="divide-y">
        {TIPOS_DE_AVISO.map((tipo) => {
          const ligado = !desligadosAgora.has(tipo);
          return (
            <div key={tipo} className="flex items-start justify-between gap-4 py-3">
              <div className="min-w-0">
                <p className="text-sm font-medium">{ROTULO_DO_AVISO[tipo]}</p>
                <p className="text-[13px] text-muted-foreground">{EXPLICACAO_DO_AVISO[tipo]}</p>
              </div>
              <Switch
                checked={ligado}
                disabled={user === null || definir.isPending}
                aria-label={`${ligado ? "Desligar" : "Ligar"} ${ROTULO_DO_AVISO[tipo]}`}
                onCheckedChange={(novo) => {
                  if (user === null) return;
                  definir.mutate({ profileId: user.id, tipo, ativo: novo });
                }}
              />
            </div>
          );
        })}
      </div>

      <p className="rounded-md bg-muted px-3 py-2 text-[13px] text-muted-foreground">
        Desligar um aviso silencia <strong>o seu</strong> e-mail. Quando um aviso também vai em
        cópia para outra pessoa, a cópia dela continua saindo.
      </p>
    </Card>
  );
}
