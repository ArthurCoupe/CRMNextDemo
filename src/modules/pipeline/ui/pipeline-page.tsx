import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import { useNavigate, useSearch } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Plus, Upload } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { PageHeader } from "@/components/layout/page-header";
import { useAgora } from "@/hooks/use-agora";
import { useProfile } from "@/hooks/use-profile";
import { isOverdue } from "@/shared/lib/date";
import { EmptyState } from "@/shared/ui/empty-state";
import { estadoDaConsulta, piorEstado } from "@/shared/ui/estado-da-consulta";
import { FalhaAoLer } from "@/shared/ui/falha-ao-ler";
import { cn } from "@/lib/utils";

import { type AcaoEmLote, type OportunidadeListada } from "../api/pipeline.repository";
import { LIMITE_DO_BOARD } from "../domain/limites";
import { ordenarEstagios, type EstagioDoPipeline } from "../domain/pipeline";
import type { PrimeiroContato } from "../domain/primeiro-contato";
import { calcularTier, type Tier } from "../domain/qualification";
import { ANUNCIOS_DO_BOARD, INSTRUCOES_DO_BOARD, TECLAS_DO_BOARD } from "./teclado-do-board";
import { corDoPontoDoEstagio, followUpVencido, significadoDoEstagio } from "../domain/stage";
import {
  useAtualizarEmLote,
  useCampos,
  useEstagios,
  useMoverEstagio,
  usePipeline,
  usePipelines,
  usePrimeiroContato,
  useResponsaveis,
} from "../hooks/use-pipeline";
import { BarraDeLote } from "./barra-de-lote";
import { DialogoDeGanho, type GanhoPendente } from "./dialogo-de-ganho";
import { DialogoDeMotivo } from "./dialogo-de-motivo";
import { ImportacaoDeCsv } from "./importacao-de-csv";
import { NewOpportunityForm } from "./new-opportunity-form";
import { OpportunityCard } from "./opportunity-card";
import { OpportunityDrawer } from "./opportunity-drawer";
import { PlacarSemanal } from "./placar-semanal";

function mudaCom(oportunidade: OportunidadeListada, acao: AcaoEmLote): boolean {
  if (acao.ownerId !== undefined && oportunidade.responsavelId !== acao.ownerId) return true;
  if (acao.estagioId !== undefined && oportunidade.estagioId !== acao.estagioId) return true;
  if (
    acao.campos !== undefined &&
    Object.entries(acao.campos).some(([id, valor]) => oportunidade.campos[id] !== valor)
  )
    return true;
  return false;
}

const NENHUMA_SELECAO: ReadonlySet<string> = new Set();

const SAIDA_DE_GANHA_COM_CONTRATO =
  'Esta venda já tem contrato. Para tirá-la de Fechado, use "Desfazer fechamento" na ficha da oportunidade.';

export function PipelinePage() {
  const { pipeline: pipelineDaUrl } = useSearch({ from: "/_authenticated/pipeline" });
  const navigate = useNavigate({ from: "/pipeline" });
  const pipelines = usePipelines();
  const pipelineId = pipelineDaUrl ?? pipelines.data?.[0]?.id ?? null;
  useEffect(() => {
    if (pipelineDaUrl === undefined && pipelineId !== null) {
      void navigate({ search: { pipeline: pipelineId }, replace: true });
    }
  }, [pipelineDaUrl, pipelineId, navigate]);

  const board = usePipeline(pipelineId);
  const estagios = useEstagios(pipelineId);
  const colunas = useMemo(() => ordenarEstagios(estagios.data ?? []), [estagios.data]);
  const semPipeline = estadoDaConsulta(pipelines) === "pronto" && pipelineId === null;
  const estadoDoBoard = semPipeline
    ? "pronto"
    : piorEstado(estadoDaConsulta(pipelines), estadoDaConsulta(estagios), estadoDaConsulta(board));
  const oportunidades = useMemo(() => board.data ?? [], [board.data]);
  const agora = useAgora();
  const idsDoBoard = useMemo(() => oportunidades.map((item) => item.id), [oportunidades]);
  const primeiroContato = usePrimeiroContato(idsDoBoard);
  const contatoPorId = useMemo(
    () =>
      new Map<string, PrimeiroContato>(
        (primeiroContato.data ?? []).map((linha) => [linha.oportunidadeId, linha]),
      ),
    [primeiroContato.data],
  );
  useEffect(() => {
    if (primeiroContato.error !== null) {
      console.error("[pipeline] primeiro contato:", primeiroContato.error);
    }
  }, [primeiroContato.error]);
  const mover = useMoverEstagio();
  const { papel } = useProfile();

  const podeEscrever = papel === "owner" || papel === "manager";

  const [selecao, setSelecao] = useState<{ pipelineId: string | null; ids: ReadonlySet<string> }>({
    pipelineId: null,
    ids: NENHUMA_SELECAO,
  });
  const selecionados = selecao.pipelineId === pipelineId ? selecao.ids : NENHUMA_SELECAO;
  const alternarSelecao = useCallback(
    (id: string) =>
      setSelecao((atual) => {
        const ids = new Set(atual.pipelineId === pipelineId ? atual.ids : []);
        if (ids.has(id)) ids.delete(id);
        else ids.add(id);
        return { pipelineId, ids };
      }),
    [pipelineId],
  );
  const botaoNova = useRef<HTMLButtonElement>(null);
  const limparSelecao = useCallback(() => {
    setSelecao({ pipelineId: null, ids: NENHUMA_SELECAO });
    botaoNova.current?.focus();
  }, []);
  const lote = useAtualizarEmLote();
  const campos = useCampos(podeEscrever ? pipelineId : null);
  const responsaveis = useResponsaveis(null, { enabled: podeEscrever });
  const responsaveisAtivos = useMemo(
    () => (responsaveis.data ?? []).filter((r) => r.ativo),
    [responsaveis.data],
  );

  function aplicarEmLote(acao: AcaoEmLote) {
    const alvos = alvosPara(acao);
    if (alvos.length === 0) {
      toast.info("Nada a mudar.");
      return;
    }
    lote.mutate({ alvos, acao }, { onSuccess: limparSelecao });
  }

  const [filtroTier, setFiltroTier] = useState<string>("todos");
  const [filtroBu, setFiltroBu] = useState<string>("todas");
  const [filtroResponsavel, setFiltroResponsavel] = useState<string>("todos");
  const [soFollowUpVencido, setSoFollowUpVencido] = useState(false);
  const [novaAberta, setNovaAberta] = useState(false);
  const [importacaoAberta, setImportacaoAberta] = useState(false);
  const [ganhando, setGanhando] = useState<GanhoPendente | null>(null);

  const [saindo, setSaindo] = useState<{
    oportunidade: OportunidadeListada;
    destino: EstagioDoPipeline;
  } | null>(null);

  const [selecionadaId, setSelecionadaId] = useState<string | null>(null);
  const selecionada = useMemo(
    () => oportunidades.find((item) => item.id === selecionadaId) ?? null,
    [oportunidades, selecionadaId],
  );

  const sensores = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { keyboardCodes: TECLAS_DO_BOARD }),
  );

  const responsaveisDoBoard = useMemo(() => {
    const vistos = new Map<string, string>();
    for (const oportunidade of oportunidades) {
      if (oportunidade.responsavelId !== null && oportunidade.responsavelNome !== null) {
        vistos.set(oportunidade.responsavelId, oportunidade.responsavelNome);
      }
    }
    return [...vistos.entries()].map(([id, nome]) => ({ id, nome }));
  }, [oportunidades]);

  const filtradas = useMemo(
    () =>
      oportunidades.filter((oportunidade) => {
        if (filtroTier !== "todos") {
          const tier = calcularTier(oportunidade.respostas);
          if (filtroTier === "sem" ? tier !== null : tier !== (filtroTier as Tier)) return false;
        }
        if (filtroBu !== "todas" && oportunidade.linhaDeNegocio !== filtroBu) return false;
        if (filtroResponsavel !== "todos" && oportunidade.responsavelId !== filtroResponsavel)
          return false;
        if (
          soFollowUpVencido &&
          !followUpVencido(oportunidade.estagio, oportunidade.proximoFollowUp, isOverdue)
        )
          return false;
        return true;
      }),
    [oportunidades, filtroTier, filtroBu, filtroResponsavel, soFollowUpVencido],
  );

  const selecionadasVisiveis = useMemo(
    () => filtradas.filter((o) => selecionados.has(o.id)),
    [filtradas, selecionados],
  );
  const alvosPara = useCallback(
    (acao: AcaoEmLote) =>
      selecionadasVisiveis
        .filter((o) => mudaCom(o, acao))
        .map((o) => ({ id: o.id, stageId: o.estagioId })),
    [selecionadasVisiveis],
  );
  const contarAlvos = useCallback((acao: AcaoEmLote) => alvosPara(acao).length, [alvosPara]);

  function aoSoltar(evento: DragEndEvent) {
    const destino = colunas.find((estagio) => estagio.id === evento.over?.id);
    const oportunidade = oportunidades.find((item) => item.id === evento.active.id);
    if (!destino || !oportunidade || oportunidade.estagioId === destino.id) return;

    if (
      oportunidade.estagio === "fechado" &&
      oportunidade.clienteId !== null &&
      destino.tipo !== "fechado"
    ) {
      toast.error(SAIDA_DE_GANHA_COM_CONTRATO);
      return;
    }

    if (destino.tipo === "fechado" && oportunidade.estagio !== "fechado") {
      setGanhando({ oportunidade, destino });
      return;
    }

    if (destino.tipo === "perdido" || destino.tipo === "descartado") {
      setSaindo({ oportunidade, destino });
      return;
    }

    mover.mutate(
      {
        oportunidadeId: oportunidade.id,
        destino,
        estagioAtualId: oportunidade.estagioId,
        pipelineId: oportunidade.pipelineId,
      },
      {
        onError: (erro) =>
          toast.error(erro instanceof Error ? erro.message : "Não foi possível mover."),
      },
    );
  }

  return (
    <>
      <PageHeader
        title="Pipeline"
        description="Arraste o card para mover de estágio"
        actions={
          podeEscrever && pipelineId !== null ? (
            <>
              <Button variant="outline" onClick={() => setImportacaoAberta(true)}>
                <Upload className="mr-1.5 h-4 w-4" aria-hidden /> Importar CSV
              </Button>
              <Button ref={botaoNova} onClick={() => setNovaAberta(true)}>
                <Plus className="mr-1.5 h-4 w-4" aria-hidden /> Nova oportunidade
              </Button>
            </>
          ) : undefined
        }
      />

      <PlacarSemanal />

      <div className="flex flex-wrap items-center gap-2">
        <Select
          value={pipelineId ?? ""}
          onValueChange={(id) => void navigate({ search: { pipeline: id } })}
        >
          <SelectTrigger aria-label="Pipeline" className="h-8 w-[180px] text-xs font-semibold">
            <SelectValue placeholder="Pipeline" />
          </SelectTrigger>
          <SelectContent>
            {(pipelines.data ?? []).map((pipeline) => (
              <SelectItem key={pipeline.id} value={pipeline.id}>
                {pipeline.nome}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={filtroTier} onValueChange={setFiltroTier}>
          <SelectTrigger className="h-8 w-[130px] text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Tier (todos)</SelectItem>
            <SelectItem value="A">Tier A</SelectItem>
            <SelectItem value="B">Tier B</SelectItem>
            <SelectItem value="C">Tier C</SelectItem>
            <SelectItem value="sem">Sem qualificação</SelectItem>
          </SelectContent>
        </Select>

        <Select value={filtroBu} onValueChange={setFiltroBu}>
          <SelectTrigger className="h-8 w-[150px] text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todas">BU (todas)</SelectItem>
            <SelectItem value="demanda">Demanda</SelectItem>
            <SelectItem value="sistemas">Sistemas</SelectItem>
          </SelectContent>
        </Select>

        <Select value={filtroResponsavel} onValueChange={setFiltroResponsavel}>
          <SelectTrigger className="h-8 w-[170px] text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Responsável (todos)</SelectItem>
            {responsaveisDoBoard.map((responsavel) => (
              <SelectItem key={responsavel.id} value={responsavel.id}>
                {responsavel.nome}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Button
          type="button"
          size="sm"
          variant={soFollowUpVencido ? "default" : "outline"}
          className="h-8 text-xs"
          onClick={() => setSoFollowUpVencido((valor) => !valor)}
        >
          Só follow-up vencido
        </Button>
      </div>

      {oportunidades.length >= LIMITE_DO_BOARD && (
        <p className="rounded-md border border-amber-500/40 bg-amber-500/5 px-3 py-2 text-xs text-amber-500">
          Este pipeline atingiu o teto de {LIMITE_DO_BOARD} oportunidades no board. As mais paradas
          não estão sendo exibidas.
        </p>
      )}

      {podeEscrever && pipelineId !== null && selecionadasVisiveis.length > 0 && (
        <BarraDeLote
          pipelineId={pipelineId}
          quantidade={selecionadasVisiveis.length}
          estagios={colunas}
          campos={campos.data ?? []}
          camposFalharam={campos.isError}
          responsaveis={responsaveisAtivos}
          responsaveisFalharam={responsaveis.isError}
          contarAlvos={contarAlvos}
          aoAplicar={aplicarEmLote}
          aoLimpar={limparSelecao}
          pendente={lote.isPending}
        />
      )}

      {estadoDoBoard === "erro" ? (
        <FalhaAoLer
          oQue={
            pipelines.isError
              ? "os pipelines"
              : estagios.isError
                ? "os estágios deste pipeline"
                : "as oportunidades do board"
          }
        />
      ) : estadoDoBoard === "carregando" ? (
        <p className="text-sm text-muted-foreground">Carregando o board…</p>
      ) : semPipeline ? (
        <EmptyState
          title="Nenhum pipeline ativo"
          description="Crie ou reative um pipeline em Configurações para o board aparecer."
        />
      ) : colunas.length === 0 ? (
        <EmptyState
          title="Pipeline não encontrado"
          description="Escolha outro pipeline no seletor acima."
        />
      ) : (
        <DndContext
          sensors={sensores}
          onDragEnd={aoSoltar}
          accessibility={{
            announcements: ANUNCIOS_DO_BOARD,
            screenReaderInstructions: INSTRUCOES_DO_BOARD,
          }}
        >
          <div className="flex snap-x snap-proximity gap-3 overflow-x-auto pb-3.5">
            {colunas.map((estagio) => (
              <Coluna
                key={estagio.id}
                estagio={estagio}
                oportunidades={filtradas.filter((item) => item.estagioId === estagio.id)}
                aoAbrir={(oportunidade) => setSelecionadaId(oportunidade.id)}
                podeArrastar={podeEscrever}
                selecionavel={podeEscrever}
                selecionados={selecionados}
                aoSelecionar={alternarSelecao}
                contatoPorId={contatoPorId}
                agora={agora}
              />
            ))}
          </div>
        </DndContext>
      )}

      {pipelineId !== null && (
        <>
          <NewOpportunityForm
            aberto={novaAberta}
            pipelineIdPadrao={pipelineId}
            aoFechar={() => setNovaAberta(false)}
          />
          <ImportacaoDeCsv
            aberto={importacaoAberta}
            pipelineIdPadrao={pipelineId}
            aoFechar={() => setImportacaoAberta(false)}
          />
        </>
      )}
      <DialogoDeGanho ganhando={ganhando} aoFechar={() => setGanhando(null)} />
      <DialogoDeMotivo saindo={saindo} aoFechar={() => setSaindo(null)} />
      <OpportunityDrawer
        oportunidade={selecionada}
        aoFechar={() => setSelecionadaId(null)}
        podeEditar={podeEscrever}
        papel={papel}
      />
    </>
  );
}

function Coluna({
  estagio,
  oportunidades,
  aoAbrir,
  podeArrastar,
  selecionavel,
  selecionados,
  aoSelecionar,
  contatoPorId,
  agora,
}: {
  estagio: EstagioDoPipeline;
  oportunidades: readonly OportunidadeListada[];
  aoAbrir: (oportunidade: OportunidadeListada) => void;
  podeArrastar: boolean;
  selecionavel: boolean;
  selecionados: ReadonlySet<string>;
  aoSelecionar: (id: string) => void;
  contatoPorId: ReadonlyMap<string, PrimeiroContato>;
  agora: Date;
}) {
  const { setNodeRef, isOver } = useDroppable({
    id: estagio.id,
    data: { nome: estagio.nome, tipo: estagio.tipo },
  });

  return (
    <section
      ref={setNodeRef}
      aria-label={estagio.nome}
      className={cn(
        "flex max-h-[calc(100vh-230px)] w-[260px] shrink-0 snap-start flex-col rounded-lg border bg-card",
        isOver && "border-primary bg-primary/5",
      )}
    >
      <div
        className="flex items-center gap-2 border-b px-3 py-2.5"
        title={significadoDoEstagio(estagio.tipo)}
      >
        <span
          className="h-[7px] w-[7px] shrink-0 rounded-full"
          style={{ backgroundColor: corDoPontoDoEstagio(estagio.tipo) }}
          aria-hidden
        />
        <h2 className="truncate text-xs font-semibold tracking-tight">{estagio.nome}</h2>
        <span className="ml-auto rounded-full bg-muted px-2 py-px text-[11px] font-semibold text-muted-foreground">
          {oportunidades.length}
        </span>
      </div>

      <div className="flex min-h-[90px] flex-1 flex-col gap-2 overflow-y-auto p-2">
        {oportunidades.length === 0 ? (
          <EmptyState title="Vazio" className="border-0 py-4" />
        ) : (
          oportunidades.map((oportunidade) => (
            <OpportunityCard
              key={oportunidade.id}
              oportunidade={oportunidade}
              aoAbrir={aoAbrir}
              podeArrastar={podeArrastar}
              selecionavel={selecionavel}
              selecionado={selecionados.has(oportunidade.id)}
              aoSelecionar={aoSelecionar}
              primeiroContato={contatoPorId.get(oportunidade.id)}
              agora={agora}
            />
          ))
        )}
      </div>
    </section>
  );
}
