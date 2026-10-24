import { useMemo, useState } from "react";
import { ChevronRight, CreditCard, Users } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { brl } from "@/shared/lib/format";
import { EmptyState } from "@/shared/ui/empty-state";
import { Money } from "@/shared/ui/money";
import { cn } from "@/lib/utils";

import {
  mesEAno,
  montarArvore,
  ROTULO_DA_BU,
  ROTULO_DA_CATEGORIA,
  ROTULO_DA_RECORRENCIA,
  type CategoriaDeDespesa,
  type DespesaEfetiva,
  type MesProjetado,
  type RecorrenciaDeDespesa,
  type UnidadeDeNegocio,
} from "../domain/expenses";
import type { EstadoDaConsulta } from "@/shared/ui/estado-da-consulta";
import { FalhaAoLer } from "@/shared/ui/falha-ao-ler";

type FiltroDeBu = UnidadeDeNegocio | "todas";
type FiltroDeCategoria = CategoriaDeDespesa | "todas";
type FiltroDeRecorrencia = RecorrenciaDeDespesa | "todas";

interface ArvoreDeGastosProps {
  readonly despesas: readonly DespesaEfetiva[];
  readonly mesCorrente: MesProjetado | null;
  readonly estado: EstadoDaConsulta;
  readonly estadoDoTotal: EstadoDaConsulta;
  readonly estadoDoCadastro: EstadoDaConsulta;
  readonly onEditar: (id: string) => void;
  readonly mostraOrigemDaFolha: boolean;
}

export function ArvoreDeGastos({
  despesas,
  mesCorrente,
  estado,
  estadoDoTotal,
  estadoDoCadastro,
  onEditar,
  mostraOrigemDaFolha,
}: ArvoreDeGastosProps) {
  const [bu, setBu] = useState<FiltroDeBu>("todas");
  const [categoria, setCategoria] = useState<FiltroDeCategoria>("todas");
  const [recorrencia, setRecorrencia] = useState<FiltroDeRecorrencia>("todas");

  const filtradas = useMemo(
    () =>
      despesas.filter(
        (d) =>
          (bu === "todas" || d.bu === bu) &&
          (categoria === "todas" || d.categoria === categoria) &&
          (recorrencia === "todas" || d.recorrencia === recorrencia),
      ),
    [despesas, bu, categoria, recorrencia],
  );

  const arvore = useMemo(() => montarArvore(filtradas), [filtradas]);

  if (estado === "erro") return <FalhaAoLer oQue="os gastos do mês" />;
  if (estado === "carregando")
    return <div className="h-64 animate-pulse rounded-xl border bg-card" />;

  const folhaEhZero =
    estadoDoTotal === "pronto" &&
    mesCorrente !== null &&
    mesCorrente.custoFolha === 0 &&
    mesCorrente.pessoasNaFolha === 0;
  if (despesas.length === 0 && folhaEhZero) {
    return (
      <EmptyState
        title="Nenhuma despesa contando neste mês"
        description="Cadastre o aluguel, as assinaturas e o cartão para que o Resultado (F15) tenha o outro lado da conta."
      />
    );
  }

  const algumFiltroAtivo = bu !== "todas" || categoria !== "todas" || recorrencia !== "todas";
  const filtroQueOTotalIgnora = categoria !== "todas" || recorrencia !== "todas";
  const totalDoMes = totalParaBu(mesCorrente, bu);
  const podeEditar = estadoDoCadastro === "pronto";

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-1.5">
        <GrupoDeFiltro
          rotulo="Linha"
          valor={bu}
          opcoes={[["todas", "Todas"], ...enumerar(ROTULO_DA_BU)]}
          onEscolher={(v) => setBu(v as FiltroDeBu)}
        />
        <GrupoDeFiltro
          rotulo="Categoria"
          valor={categoria}
          opcoes={[["todas", "Todas"], ...enumerar(ROTULO_DA_CATEGORIA)]}
          onEscolher={(v) => setCategoria(v as FiltroDeCategoria)}
        />
        <GrupoDeFiltro
          rotulo="Recorrência"
          valor={recorrencia}
          opcoes={[["todas", "Todas"], ...enumerar(ROTULO_DA_RECORRENCIA)]}
          onEscolher={(v) => setRecorrencia(v as FiltroDeRecorrencia)}
        />
      </div>

      <div className="overflow-hidden rounded-xl border bg-card">
        {filtradas.length === 0 ? (
          <p className="px-3.5 py-8 text-center text-xs text-muted-foreground">
            {estadoDoTotal !== "pronto"
              ? "Nenhuma despesa deste mês bate com o filtro, e o total abaixo ainda não é conhecido."
              : despesas.length === 0
                ? "Nenhuma despesa neste mês. O custo abaixo é só de folha."
                : bu === "todas"
                  ? "Nenhuma despesa deste mês bate com o filtro. As outras continuam contando no total."
                  : `Nenhuma despesa de ${ROTULO_DA_BU[bu]} bate com o filtro. O total abaixo é o desta frente, e a folha dela entra nele.`}
          </p>
        ) : (
          <ul>
            {arvore.agrupadores.map((agrupador) => (
              <Agrupador
                key={agrupador.id}
                nome={agrupador.nome}
                total={agrupador.total}
                filhos={agrupador.filhos}
                filtrado={algumFiltroAtivo}
                podeEditar={podeEditar}
                onEditar={onEditar}
              />
            ))}
            {arvore.soltas.map((despesa) => (
              <li key={despesa.id} className="border-b last:border-0">
                <LinhaDeDespesa despesa={despesa} podeEditar={podeEditar} onEditar={onEditar} />
              </li>
            ))}
          </ul>
        )}

        <LinhaDaFolha
          mes={mesCorrente}
          estado={estadoDoTotal}
          bu={bu}
          mostraOrigem={mostraOrigemDaFolha}
        />

        <div className="flex items-baseline justify-between gap-3 border-t-2 bg-muted/30 px-3.5 py-2.5">
          <div>
            <p className="text-[11px] uppercase tracking-wide text-muted-foreground">
              {rotuloDoTotal(bu)}
            </p>
            {filtroQueOTotalIgnora && (
              <p className="mt-0.5 text-[11px] text-muted-foreground">
                O filtro de categoria e recorrência estreita a lista, não o total: somar as linhas
                filtradas aqui criaria uma segunda definição de custo do mês.
              </p>
            )}
          </div>
          <TotalDoMes valor={totalDoMes} estado={estadoDoTotal} />
        </div>
      </div>

      {!podeEditar && (
        <p className="text-[11px] text-muted-foreground">
          {estadoDoCadastro === "erro"
            ? "Não foi possível ler o cadastro, então Editar está indisponível: abrir agora criaria uma despesa nova em vez de corrigir esta."
            : "Carregando o cadastro para poder editar…"}
        </p>
      )}

      <p className="text-[11px] text-muted-foreground">
        Agrupadores não somam: o cartão é contêiner e tem valor zero no banco, por constraint. O
        total acima é o custo do mês vindo do Postgres (gastos <strong>mais folha</strong>), e
        nenhuma soma acontece nesta tela. Participação em contratos ainda não entra: é a terceira
        parcela do custo, e ela chega no Resultado (F15).
      </p>
    </div>
  );
}

function LinhaDaFolha({
  mes,
  estado,
  bu,
  mostraOrigem,
}: {
  mes: MesProjetado | null;
  estado: EstadoDaConsulta;
  bu: FiltroDeBu;
  mostraOrigem: boolean;
}) {
  if (estado !== "pronto" || mes === null) return null;

  const valor = folhaParaBu(mes, bu);
  if (valor === 0 && mes.pessoasNaFolha === 0) return null;

  return (
    <div className="flex items-center gap-3 border-t bg-muted/10 px-3.5 py-2.5">
      <Users className="h-3.5 w-3.5 shrink-0 text-muted-foreground" aria-hidden />
      <div className="min-w-0 flex-1">
        <p className="flex items-center gap-1.5 text-sm">
          Folha
          {mostraOrigem && (
            <Badge variant="outline" className="h-4 px-1.5 text-[10px] font-normal">
              vem da aba Folha e equipe
            </Badge>
          )}
        </p>
        <p className="mt-0.5 text-[11px] text-muted-foreground">
          {bu === "todas"
            ? `${mes.pessoasNaFolha} ${mes.pessoasNaFolha === 1 ? "pessoa conta" : "pessoas contam"} neste mês · custo fixo, sem participação em contratos`
            : `Custo fixo de folha em ${ROTULO_DA_BU[bu]} · sem participação em contratos`}
        </p>
      </div>
      <Money value={valor} className="text-sm" />
      <span className="w-[52px] shrink-0" aria-hidden />
    </div>
  );
}

function folhaParaBu(mes: MesProjetado, bu: FiltroDeBu): number {
  switch (bu) {
    case "demanda":
      return mes.folhaDemanda;
    case "sistemas":
      return mes.folhaSistemas;
    case "compartilhado":
      return mes.folhaCompartilhado;
    default:
      return mes.custoFolha;
  }
}

function TotalDoMes({ valor, estado }: { valor: number | null; estado: EstadoDaConsulta }) {
  if (estado === "erro") {
    return (
      <span className="text-xs font-medium text-destructive">
        desconhecido (falha ao ler o total)
      </span>
    );
  }
  if (estado === "carregando") {
    return <span className="text-xs text-muted-foreground">calculando…</span>;
  }
  if (valor === null) {
    return <span className="text-xs text-muted-foreground">desconhecido</span>;
  }
  return <span className="text-sm font-semibold tabular-nums">{brl(valor)}</span>;
}

function totalParaBu(mes: MesProjetado | null, bu: FiltroDeBu): number | null {
  if (mes === null) return null;
  switch (bu) {
    case "demanda":
      return mes.custoDemanda;
    case "sistemas":
      return mes.custoSistemas;
    case "compartilhado":
      return mes.custoCompartilhado;
    default:
      return mes.custoTotal;
  }
}

function rotuloDoTotal(bu: FiltroDeBu): string {
  return bu === "todas" ? "Total do mês" : `Total do mês · ${ROTULO_DA_BU[bu]}`;
}

function enumerar(rotulos: Readonly<Record<string, string>>): [string, string][] {
  return Object.entries(rotulos);
}

function GrupoDeFiltro({
  rotulo,
  valor,
  opcoes,
  onEscolher,
}: {
  rotulo: string;
  valor: string;
  opcoes: readonly (readonly [string, string])[];
  onEscolher: (valor: string) => void;
}) {
  return (
    <div className="flex items-center gap-1">
      <span className="text-[11px] text-muted-foreground">{rotulo}</span>
      {opcoes.map(([chave, texto]) => (
        <button
          key={chave}
          type="button"
          onClick={() => onEscolher(chave)}
          aria-pressed={valor === chave}
          className={cn(
            "rounded-md border px-2 py-0.5 text-[11px] transition-colors",
            valor === chave
              ? "border-primary bg-primary/10 font-medium text-foreground"
              : "border-transparent text-muted-foreground hover:bg-muted",
          )}
        >
          {texto}
        </button>
      ))}
    </div>
  );
}

function Agrupador({
  nome,
  total,
  filhos,
  filtrado,
  podeEditar,
  onEditar,
}: {
  nome: string;
  total: number | null;
  filhos: readonly DespesaEfetiva[];
  filtrado: boolean;
  podeEditar: boolean;
  onEditar: (id: string) => void;
}) {
  const [aberto, setAberto] = useState(true);

  return (
    <li className="border-b last:border-0">
      <button
        type="button"
        onClick={() => setAberto((v) => !v)}
        aria-expanded={aberto}
        className="flex w-full items-center gap-2 bg-muted/20 px-3.5 py-2 text-left hover:bg-muted/40"
      >
        <ChevronRight
          className={cn("h-3.5 w-3.5 shrink-0 transition-transform", aberto && "rotate-90")}
          aria-hidden
        />
        <CreditCard className="h-3.5 w-3.5 shrink-0 text-muted-foreground" aria-hidden />
        <span className="text-sm font-medium">{nome}</span>
        <Badge variant="outline" className="h-4 px-1.5 text-[10px] font-normal">
          agrupador · não soma
        </Badge>
        <span className="ml-auto flex items-baseline gap-1.5">
          {filtrado && (
            <span className="text-[10px] uppercase tracking-wide text-muted-foreground">
              fatura do mês
            </span>
          )}
          <span className="text-sm font-medium tabular-nums">
            {total === null ? "-" : brl(total)}
          </span>
        </span>
      </button>

      {aberto && (
        <ul>
          {filhos.map((despesa) => (
            <li key={despesa.id} className="border-t">
              <LinhaDeDespesa
                despesa={despesa}
                podeEditar={podeEditar}
                onEditar={onEditar}
                recuada
              />
            </li>
          ))}
        </ul>
      )}
    </li>
  );
}

function LinhaDeDespesa({
  despesa,
  podeEditar,
  onEditar,
  recuada = false,
}: {
  despesa: DespesaEfetiva;
  podeEditar: boolean;
  onEditar: (id: string) => void;
  recuada?: boolean;
}) {
  const termina = despesa.ultimaParcelaEm === null ? null : mesEAno(despesa.ultimaParcelaEm);

  return (
    <div className={cn("flex items-center gap-3 px-3.5 py-2.5", recuada && "pl-10")}>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm">{despesa.descricao}</p>
        <p className="mt-0.5 flex flex-wrap items-center gap-x-2 text-[11px] text-muted-foreground">
          <span>{ROTULO_DA_CATEGORIA[despesa.categoria]}</span>
          <span aria-hidden>·</span>
          <span>{ROTULO_DA_BU[despesa.bu]}</span>
          {despesa.fornecedor !== null && despesa.fornecedor !== "" && (
            <>
              <span aria-hidden>·</span>
              <span>{despesa.fornecedor}</span>
            </>
          )}
          {despesa.recorrencia === "pontual" && (
            <>
              <span aria-hidden>·</span>
              <span>conta só neste mês</span>
            </>
          )}
          {despesa.recorrencia === "parcelado" && despesa.parcelasTotal !== null && (
            <>
              <span aria-hidden>·</span>
              <span className="tabular-nums">
                parcela {despesa.parcelasPagas ?? "?"}/{despesa.parcelasTotal}
                {despesa.parcelasRestantes !== null && ` · faltam ${despesa.parcelasRestantes}`}
                {termina !== null && ` · até ${termina}`}
              </span>
            </>
          )}
        </p>
      </div>

      <Money value={despesa.valor} className="text-sm" />

      <Button
        type="button"
        variant="ghost"
        size="sm"
        className="h-7 px-2 text-xs"
        disabled={!podeEditar}
        onClick={() => onEditar(despesa.id)}
      >
        Editar
      </Button>
    </div>
  );
}
