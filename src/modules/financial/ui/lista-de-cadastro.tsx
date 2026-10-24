import { Layers } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { EmptyState } from "@/shared/ui/empty-state";
import { Money } from "@/shared/ui/money";
import { formatDate } from "@/shared/lib/date";
import { cn } from "@/lib/utils";

import type { DespesaCadastrada } from "../api/expenses.repository";
import {
  despesaCorreEm,
  despesaEncerradaEm,
  mesEAno,
  ROTULO_DA_BU,
  ROTULO_DA_RECORRENCIA,
  ultimaParcelaEm,
} from "../domain/expenses";
import { useApagarDespesa, useDefinirSituacaoDaDespesa } from "../hooks/use-expenses";
import { DialogoDeExclusao } from "@/shared/ui/dialogo-de-exclusao";
import type { EstadoDaConsulta } from "@/shared/ui/estado-da-consulta";
import { FalhaAoLer } from "@/shared/ui/falha-ao-ler";

type SituacaoNoCusto = "conta" | "ainda-nao" | "terminou" | "fora" | "conteiner";

interface ListaDeCadastroProps {
  readonly despesas: readonly DespesaCadastrada[];
  readonly truncada: boolean;
  readonly estado: EstadoDaConsulta;
  readonly mostrarInativas: boolean;
  readonly onAlternarInativas: (valor: boolean) => void;
  readonly onEditar: (id: string) => void;
  readonly mesReferencia: string | null;
}

export function ListaDeCadastro({
  despesas,
  truncada,
  estado,
  mostrarInativas,
  onAlternarInativas,
  onEditar,
  mesReferencia,
}: ListaDeCadastroProps) {
  const situacao = useDefinirSituacaoDaDespesa();
  const emVoo = situacao.isPending ? situacao.variables?.id : undefined;
  const apagar = useApagarDespesa();
  const apagando = apagar.isPending ? apagar.variables : undefined;

  if (estado === "erro") return <FalhaAoLer oQue="as despesas cadastradas" />;
  if (estado === "carregando")
    return <div className="h-40 animate-pulse rounded-xl border bg-card" />;

  const filhosPorAgrupador = new Map<string, number>();
  const penduradasPorAgrupador = new Map<string, number>();
  for (const d of despesas) {
    if (d.agrupadorId === null) continue;
    penduradasPorAgrupador.set(d.agrupadorId, (penduradasPorAgrupador.get(d.agrupadorId) ?? 0) + 1);
    if (!d.ativa) continue;
    filhosPorAgrupador.set(d.agrupadorId, (filhosPorAgrupador.get(d.agrupadorId) ?? 0) + 1);
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <Switch
          id="mostrar-inativas"
          checked={mostrarInativas}
          onCheckedChange={onAlternarInativas}
        />
        <Label htmlFor="mostrar-inativas" className="text-xs font-normal text-muted-foreground">
          Mostrar também as que foram tiradas do custo
        </Label>
      </div>

      {despesas.length === 0 ? (
        <EmptyState
          title="Nada cadastrado ainda"
          description="Comece pelo cartão de crédito como agrupador, e pendure nele as assinaturas."
        />
      ) : (
        <div className="overflow-hidden rounded-xl border bg-card">
          <ul>
            {despesas.map((despesa) => {
              const situacaoNoCusto = classificar(despesa, mesReferencia);
              const filhos = filhosPorAgrupador.get(despesa.id) ?? 0;
              const penduradas = penduradasPorAgrupador.get(despesa.id) ?? 0;
              return (
                <li
                  key={despesa.id}
                  className={cn(
                    "flex items-center gap-3 border-b px-3.5 py-2.5 last:border-0",
                    situacaoNoCusto !== "conta" && situacaoNoCusto !== "conteiner" && "bg-muted/20",
                  )}
                >
                  <div className="min-w-0 flex-1">
                    <p className="flex items-center gap-1.5 truncate text-sm">
                      {despesa.ehAgrupador && (
                        <Layers
                          className="h-3.5 w-3.5 shrink-0 text-muted-foreground"
                          aria-hidden
                        />
                      )}
                      <span
                        className={cn(
                          situacaoNoCusto === "fora" && "text-muted-foreground line-through",
                        )}
                      >
                        {despesa.descricao}
                      </span>
                      <SeloDeSituacao situacao={situacaoNoCusto} />
                    </p>
                    <p className="mt-0.5 text-[11px] text-muted-foreground">
                      <Detalhe despesa={despesa} filhos={filhos} />
                    </p>
                  </div>

                  {!despesa.ehAgrupador && (
                    <span
                      className={cn(
                        "text-sm",
                        situacaoNoCusto !== "conta" && "text-muted-foreground",
                      )}
                    >
                      <Money value={despesa.valor} />
                    </span>
                  )}

                  <div className="flex shrink-0 items-center gap-1">
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-7 px-2 text-xs"
                      onClick={() => onEditar(despesa.id)}
                    >
                      Editar
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-7 px-2 text-xs"
                      disabled={emVoo === despesa.id || (despesa.ehAgrupador && filhos > 0)}
                      title={
                        despesa.ehAgrupador && filhos > 0
                          ? `${filhos} despesa(s) ainda penduram neste agrupador e continuariam somando. Mova ou tire as despesas primeiro.`
                          : undefined
                      }
                      onClick={() => situacao.mutate({ id: despesa.id, ativa: !despesa.ativa })}
                    >
                      {emVoo === despesa.id
                        ? "Salvando…"
                        : rotuloDoBotao(despesa.ehAgrupador, despesa.ativa)}
                    </Button>
                    <DialogoDeExclusao
                      gatilho={
                        <Button
                          type="button"
                          variant="destructive"
                          size="sm"
                          className="h-7 px-2 text-xs"
                          disabled={apagando === despesa.id || penduradas > 0}
                          title={
                            penduradas > 0
                              ? `${penduradas} despesa(s) ainda penduram neste agrupador. Mova ou apague as despesas primeiro.`
                              : undefined
                          }
                          aria-label={`Apagar ${despesa.descricao}`}
                        >
                          {apagando === despesa.id ? "Apagando…" : "Apagar"}
                        </Button>
                      }
                      titulo={`Apagar "${despesa.descricao}"?`}
                      pendente={apagando === despesa.id}
                      onConfirmar={() => apagar.mutate(despesa.id)}
                    >
                      <p>Apaga a despesa e o histórico de entradas e saídas do custo.</p>
                      <p>
                        Meses já fechados não mudam. Os meses abertos e a projeção deixam de contar
                        este valor.
                      </p>
                      <p>
                        {`Para parar de contar a partir de agora e manter o passado, use "${rotuloDoBotao(despesa.ehAgrupador, true)}" em vez de apagar.`}
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
                A lista mostra as 500 primeiras despesas e há mais cadastradas. Paginação chega
                junto com o volume que a exigir.
              </p>
            )}
            <p>
              Tirar do custo não apaga nada: a linha continua no histórico, com a data em que saiu,
              e volta com um clique. Apagar é para lançamento errado: meses já fechados não mudam,
              mas os meses abertos e a projeção deixam de contar a despesa.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

function classificar(despesa: DespesaCadastrada, mesReferencia: string | null): SituacaoNoCusto {
  if (!despesa.ativa) return "fora";
  if (despesa.ehAgrupador) return "conteiner";
  if (mesReferencia === null) return "conta";

  const base = {
    recorrencia: despesa.recorrencia,
    inicio: despesa.inicio,
    fim: despesa.fim,
    parcelasTotal: despesa.parcelasTotal,
  };

  if (despesaCorreEm(base, mesReferencia) === true) return "conta";
  if (despesaEncerradaEm(base, mesReferencia) === true) return "terminou";
  return "ainda-nao";
}

function SeloDeSituacao({ situacao }: { situacao: SituacaoNoCusto }) {
  if (situacao === "conta") return null;

  const texto = {
    fora: "tirada do custo",
    terminou: "já terminou",
    "ainda-nao": "ainda não conta",
    conteiner: "agrupador",
  }[situacao];

  return (
    <Badge variant="outline" className="h-4 px-1.5 text-[10px] font-normal">
      {texto}
    </Badge>
  );
}

function rotuloDoBotao(ehAgrupador: boolean, ativa: boolean): string {
  if (ehAgrupador) return ativa ? "Arquivar" : "Reativar";
  return ativa ? "Tirar do custo" : "Voltar ao custo";
}

function Detalhe({ despesa, filhos }: { despesa: DespesaCadastrada; filhos: number }) {
  if (despesa.ehAgrupador) {
    return (
      <>
        Contêiner · não soma no total ·{" "}
        {filhos === 0
          ? "nenhuma despesa pendurada"
          : `${filhos} despesa${filhos > 1 ? "s" : ""} pendurada${filhos > 1 ? "s" : ""}`}
      </>
    );
  }

  const partes = [ROTULO_DA_RECORRENCIA[despesa.recorrencia], ROTULO_DA_BU[despesa.bu]];

  if (despesa.recorrencia === "parcelado" && despesa.parcelasTotal !== null) {
    const fim = ultimaParcelaEm(despesa.inicio, despesa.parcelasTotal);
    const rotuloDoFim = fim === null ? null : mesEAno(fim);
    partes.push(`${despesa.parcelasTotal}×${rotuloDoFim === null ? "" : ` · até ${rotuloDoFim}`}`);
  }

  if (despesa.recorrencia === "mensal" && despesa.fim !== null) {
    const rotulo = mesEAno(despesa.fim);
    if (rotulo !== null) partes.push(`até ${rotulo}`);
  }

  const inicio = mesEAno(despesa.inicio);
  if (inicio !== null) {
    partes.push(despesa.recorrencia === "pontual" ? `em ${inicio}` : `desde ${inicio}`);
  }

  if (!despesa.ativa && despesa.saiuEm !== null) {
    partes.push(`saiu em ${formatDate(despesa.saiuEm)}`);
  }

  return <>{partes.join(" · ")}</>;
}
