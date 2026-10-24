import { Card } from "@/components/ui/card";
import { FalhaAoLer } from "@/shared/ui/falha-ao-ler";
import { estadoDaConsulta, piorEstado } from "@/shared/ui/estado-da-consulta";

import { usePapeis, useDefinirPapel, usePapeisExigidosPeloMetodo } from "../hooks/use-onboarding";
import { usePessoasDoTime } from "@/modules/tasks/hooks/use-tasks";

export function PapeisSettings() {
  const papeis = usePapeis();
  const time = usePessoasDoTime();
  const exigidos = usePapeisExigidosPeloMetodo();
  const definir = useDefinirPapel();

  const estado = piorEstado(
    estadoDaConsulta(papeis),
    estadoDaConsulta(time),
    estadoDaConsulta(exigidos),
  );

  const papeisDoMetodo = new Set(exigidos.data ?? []);

  return (
    <Card className="space-y-4 p-6 shadow-card">
      <div>
        <h3 className="text-lg font-semibold">Papéis do onboarding</h3>
        <p className="text-sm text-muted-foreground">
          Quem responde por cada papel do método. Uma etapa só pode ser liberada quando todos os
          papéis que ela usa têm pessoa: tarefa sem responsável é tarefa que ninguém faz.
        </p>
      </div>

      {estado === "erro" ? (
        <FalhaAoLer oQue="os papéis" />
      ) : estado === "carregando" ? (
        <div className="h-32 animate-pulse rounded-lg border bg-card" />
      ) : (
        <div className="space-y-2">
          {(papeis.data ?? []).map((p) => {
            const foraDoTimeAtivo =
              p.pessoaId !== null && !(time.data ?? []).some((pessoa) => pessoa.id === p.pessoaId);

            const nome = p.pessoa ?? "pessoa sem nome no perfil";

            return (
              <div
                key={p.papel}
                className="flex flex-wrap items-center justify-between gap-3 rounded-lg border p-3"
              >
                <div>
                  <p className="text-sm font-medium">{p.papel}</p>
                  <p className="text-xs text-muted-foreground">
                    {p.pessoaId !== null && p.pessoaInativa ? (
                      <span className={papeisDoMetodo.has(p.papel) ? "text-warning" : undefined}>
                        {`${nome} (desativada): troque a pessoa`}
                        {papeisDoMetodo.has(p.papel) && "; bloqueia a liberação de etapa"}
                      </span>
                    ) : p.pessoaId !== null ? (
                      nome
                    ) : papeisDoMetodo.has(p.papel) ? (
                      <span className="text-warning">
                        sem pessoa: bloqueia a liberação de etapa
                      </span>
                    ) : (
                      <span>sem pessoa, e nenhum item do método usa este papel</span>
                    )}
                  </p>
                </div>

                <select
                  className="h-9 rounded-md border bg-background px-2 text-sm"
                  value={p.pessoaId ?? ""}
                  disabled={definir.isPending}
                  onChange={(e) =>
                    definir.mutate({
                      papel: p.papel,
                      pessoaId: e.target.value === "" ? null : e.target.value,
                    })
                  }
                >
                  <option value="">Sem pessoa</option>
                  {foraDoTimeAtivo && p.pessoaId !== null && (
                    <option value={p.pessoaId} disabled>
                      {`${nome} ${p.pessoaInativa ? "(desativada)" : "(fora do time)"}`}
                    </option>
                  )}
                  {(time.data ?? []).map((pessoa) => (
                    <option key={pessoa.id} value={pessoa.id}>
                      {pessoa.nome}
                    </option>
                  ))}
                </select>
              </div>
            );
          })}

          {(papeis.data ?? []).length === 0 && (
            <p className="text-sm text-muted-foreground">
              Nenhum papel cadastrado. Eles nascem com a migration da F16.
            </p>
          )}
        </div>
      )}
    </Card>
  );
}
