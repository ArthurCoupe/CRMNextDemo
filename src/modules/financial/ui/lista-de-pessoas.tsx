import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { EmptyState } from "@/shared/ui/empty-state";
import { Money } from "@/shared/ui/money";
import { cn } from "@/lib/utils";

import type { PessoaCadastrada } from "../api/payroll.repository";
import { mesEAno, ROTULO_DA_BU } from "../domain/expenses";
import { ROTULO_DO_VINCULO, situacaoNaFolhaEm, type SituacaoNaFolha } from "../domain/payroll";
import { useApagarPessoaDaFolha, useDefinirSituacaoDaPessoa } from "../hooks/use-payroll";
import { DialogoDeExclusao } from "@/shared/ui/dialogo-de-exclusao";
import type { EstadoDaConsulta } from "@/shared/ui/estado-da-consulta";
import { FalhaAoLer } from "@/shared/ui/falha-ao-ler";

type SituacaoNoCusto = SituacaoNaFolha | "fora";

interface ListaDePessoasProps {
  readonly pessoas: readonly PessoaCadastrada[];
  readonly truncada: boolean;
  readonly estado: EstadoDaConsulta;
  readonly mostrarInativas: boolean;
  readonly onAlternarInativas: (valor: boolean) => void;
  readonly onEditar: (id: string) => void;
  readonly mesReferencia: string | null;
}

export function ListaDePessoas({
  pessoas,
  truncada,
  estado,
  mostrarInativas,
  onAlternarInativas,
  onEditar,
  mesReferencia,
}: ListaDePessoasProps) {
  const situacao = useDefinirSituacaoDaPessoa();
  const emVoo = situacao.isPending ? situacao.variables?.id : undefined;
  const apagar = useApagarPessoaDaFolha();
  const apagando = apagar.isPending ? apagar.variables : undefined;

  if (estado === "erro") return <FalhaAoLer oQue="as pessoas cadastradas" />;
  if (estado === "carregando")
    return <div className="h-40 animate-pulse rounded-xl border bg-card" />;

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <Switch
          id="mostrar-fora-da-folha"
          checked={mostrarInativas}
          onCheckedChange={onAlternarInativas}
        />
        <Label
          htmlFor="mostrar-fora-da-folha"
          className="text-xs font-normal text-muted-foreground"
        >
          Mostrar também quem foi tirado da folha
        </Label>
      </div>

      {pessoas.length === 0 ? (
        <EmptyState
          title="Ninguém cadastrado ainda"
          description="Cadastrar alguém é cadastrar o custo: o painel muda no mesmo instante."
        />
      ) : (
        <div className="overflow-hidden rounded-xl border bg-card">
          <ul>
            {pessoas.map((pessoa) => {
              const situacaoNoCusto = classificar(pessoa, mesReferencia);
              return (
                <li
                  key={pessoa.id}
                  className={cn(
                    "flex items-center gap-3 border-b px-3.5 py-2.5 last:border-0",
                    situacaoNoCusto !== "conta" && "bg-muted/20",
                  )}
                >
                  <div className="min-w-0 flex-1">
                    <p className="flex items-center gap-1.5 truncate text-sm">
                      <span
                        className={cn(
                          situacaoNoCusto === "fora" && "text-muted-foreground line-through",
                        )}
                      >
                        {pessoa.pessoa}
                      </span>
                      <SeloDeSituacao situacao={situacaoNoCusto} />
                    </p>
                    <p className="mt-0.5 text-[11px] text-muted-foreground">
                      <Detalhe pessoa={pessoa} />
                    </p>
                  </div>

                  <span
                    className={cn(
                      "text-sm",
                      situacaoNoCusto !== "conta" && "text-muted-foreground",
                    )}
                  >
                    <span className="text-right">
                      <Money value={pessoa.custoMensal} />
                      {pessoa.beneficios > 0 && (
                        <span className="block text-[10px] text-muted-foreground">
                          + benefícios <Money value={pessoa.beneficios} />
                        </span>
                      )}
                    </span>
                  </span>

                  <div className="flex shrink-0 items-center gap-1">
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-7 px-2 text-xs"
                      onClick={() => onEditar(pessoa.id)}
                    >
                      Editar
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-7 px-2 text-xs"
                      disabled={emVoo === pessoa.id}
                      onClick={() => situacao.mutate({ id: pessoa.id, ativa: !pessoa.ativa })}
                    >
                      {emVoo === pessoa.id
                        ? "Salvando…"
                        : pessoa.ativa
                          ? "Tirar da folha"
                          : "Voltar à folha"}
                    </Button>
                    <DialogoDeExclusao
                      gatilho={
                        <Button
                          type="button"
                          variant="destructive"
                          size="sm"
                          className="h-7 px-2 text-xs"
                          disabled={apagando === pessoa.id}
                          aria-label={`Apagar ${pessoa.pessoa}`}
                        >
                          {apagando === pessoa.id ? "Apagando…" : "Apagar"}
                        </Button>
                      }
                      titulo={`Apagar "${pessoa.pessoa}" da folha?`}
                      pendente={apagando === pessoa.id}
                      onConfirmar={() => apagar.mutate(pessoa.id)}
                    >
                      <p>Apaga a pessoa da folha e o histórico de entradas e saídas dela.</p>
                      <p>
                        Meses já fechados não mudam. Os meses abertos e a projeção deixam de contar
                        este custo.
                      </p>
                      <p>
                        Para parar de contar a partir de agora e manter o passado, use &quot;Tirar
                        da folha&quot; em vez de apagar.
                      </p>
                      <p>Isto não pode ser desfeito.</p>
                    </DialogoDeExclusao>
                  </div>
                </li>
              );
            })}
          </ul>

          <div className="border-t px-3.5 py-2 text-[11px] text-muted-foreground">
            {truncada && (
              <p className="mb-1 text-warning">
                A lista mostra as 500 primeiras pessoas e pode haver mais cadastradas. Paginação
                chega junto com o volume que a exigir.
              </p>
            )}
            <p>
              Tirar da folha não apaga nada e não reescreve mês fechado: a saída vira uma linha de
              histórico com data, o mês em que ela aconteceu deixa de contar, e os anteriores
              continuam custando o que custaram. Voltar à folha é um clique, e ele{" "}
              <strong>fecha</strong> o período em vez de apagá-lo. Sem isso, um segundo desligamento
              faria os meses entre as duas saídas voltarem a contar.
            </p>
            <p className="mt-1">
              Apagar é para cadastro errado: meses já fechados não mudam, mas os meses abertos e a
              projeção deixam de contar a pessoa.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

function classificar(pessoa: PessoaCadastrada, mesReferencia: string | null): SituacaoNoCusto {
  if (!pessoa.ativa) return "fora";
  if (mesReferencia === null) return "conta";
  return situacaoNaFolhaEm(pessoa.inicio, pessoa.fim, mesReferencia) ?? "conta";
}

function SeloDeSituacao({ situacao }: { situacao: SituacaoNoCusto }) {
  if (situacao === "conta") return null;

  const texto = {
    fora: "tirada da folha",
    terminou: "já saiu",
    "ainda-nao": "ainda não conta",
  }[situacao];

  return (
    <Badge variant="outline" className="h-4 px-1.5 text-[10px] font-normal">
      {texto}
    </Badge>
  );
}

function Detalhe({ pessoa }: { pessoa: PessoaCadastrada }) {
  const partes = [ROTULO_DO_VINCULO[pessoa.vinculo], ROTULO_DA_BU[pessoa.bu]];

  if (pessoa.cargo !== null && pessoa.cargo !== "") partes.push(pessoa.cargo);

  const inicio = mesEAno(pessoa.inicio);
  if (inicio !== null) partes.push(`desde ${inicio}`);

  if (pessoa.fim !== null) {
    const fim = mesEAno(pessoa.fim);
    if (fim !== null) partes.push(`até ${fim}`);
  }

  return <>{partes.join(" · ")}</>;
}
