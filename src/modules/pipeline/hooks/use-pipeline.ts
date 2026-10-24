import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { avisarEInvalidar, avisarErro } from "@/shared/lib/avisar-erro";
import { plural } from "@/shared/lib/format";
import { SEM_RETENTATIVA_EM_RECUSA } from "@/shared/lib/permissao";

import {
  apagarOportunidade,
  atualizarDadosDaOportunidade,
  atualizarDatasDeReuniao,
  atualizarEmLote,
  atualizarNutricao,
  carregarCatalogo,
  corrigirMotivoDeSaida,
  corrigirTextoDoEvento,
  criarOportunidade,
  importarOportunidades,
  listarEventos,
  listarOportunidades,
  listarResponsaveis,
  lerAtividadeSemanal,
  lerFechamentosPorCampanha,
  lerFunilPorCanal,
  lerMixDeOportunidades,
  lerPrimeiroContato,
  lerTempoAtePrimeiroContato,
  moverParaEstagio,
  registrarToque,
  responderPergunta,
  vincularRef,
  type AcaoEmLote,
  type AlvoDoLote,
  type CamposDeNutricao,
  type CamposDeReuniao,
  type DadosEditaveisDaOportunidade,
  type CorrecaoDeSaida,
  type ResultadoDaLinha,
  type TipoRegistravel,
  type DadosDeNovaOportunidade,
  type RespostaParaGravar,
} from "../api/pipeline.repository";
import type { LinhaDeImportacao } from "../domain/importacao";
import {
  apagarPipeline,
  arquivarPipeline,
  criarPipeline,
  listarCampos,
  listarEstagios,
  listarMotivos,
  listarPipelines,
  renomearPipeline,
  salvarCampos,
  salvarEstagios,
  salvarMotivos,
} from "../api/pipelines.repository";
import type { RascunhoDeCampo } from "../domain/campos";
import type { EstagioDoPipeline, MotivoDeSaida, TipoDeEstagio } from "../domain/pipeline";
import type { MotivoDeSaidaEscolhido } from "../domain/saida";

export const chavesDoPipeline = {
  raiz: ["opportunities"] as const,
  board: (pipelineId: string) => ["opportunities", "board", pipelineId] as const,
  pipelines: ["pipelines"] as const,
  estagios: (pipelineId: string) => ["pipelines", pipelineId, "estagios"] as const,
  motivos: (pipelineId: string) => ["pipelines", pipelineId, "motivos"] as const,
  campos: (pipelineId: string) => ["pipelines", pipelineId, "campos"] as const,
  eventos: (oportunidadeId: string) => ["opportunities", oportunidadeId, "eventos"] as const,
  catalogo: ["qualification-catalog"] as const,
  responsaveis: (responsavelAtualId: string | null) =>
    ["profiles", "responsaveis", responsavelAtualId] as const,
  funil: (desde: string) => ["opportunities", "funil", desde] as const,
  atividade: ["opportunities", "atividade"] as const,
  atividadeSemanal: (desde: string) => ["opportunities", "atividade", desde] as const,
  mix: ["opportunities", "mix"] as const,
  campanhas: ["opportunities", "campanhas"] as const,
  primeiroContatoRaiz: ["opportunities", "primeiro-contato"] as const,
  primeiroContato: (ids: readonly string[]) =>
    ["opportunities", "primeiro-contato", ...ids] as const,
  tempoAtePrimeiroContato: (desde: string) =>
    ["opportunities", "tempo-ate-primeiro-contato", desde] as const,
};

export function usePipeline(pipelineId: string | null) {
  return useQuery({
    queryKey: chavesDoPipeline.board(pipelineId ?? ""),
    queryFn: () => listarOportunidades(pipelineId ?? ""),
    enabled: pipelineId !== null,
  });
}

export function useOportunidadesDeTodosOsPipelines() {
  return useQuery({
    queryKey: chavesDoPipeline.board("todos"),
    queryFn: () => listarOportunidades(null),
  });
}

export function usePipelines(incluirArquivados = false) {
  return useQuery({
    queryKey: [...chavesDoPipeline.pipelines, incluirArquivados] as const,
    queryFn: () => listarPipelines(incluirArquivados),
    staleTime: 5 * 60 * 1000,
    retry: SEM_RETENTATIVA_EM_RECUSA,
  });
}

export function useEstagios(pipelineId: string | null) {
  return useQuery({
    queryKey: chavesDoPipeline.estagios(pipelineId ?? ""),
    queryFn: () => listarEstagios(pipelineId ?? ""),
    enabled: pipelineId !== null,
    retry: SEM_RETENTATIVA_EM_RECUSA,
  });
}

export function useMotivos(pipelineId: string | null, incluirInativos = false) {
  return useQuery({
    queryKey: [...chavesDoPipeline.motivos(pipelineId ?? ""), incluirInativos] as const,
    queryFn: () => listarMotivos(pipelineId ?? "", incluirInativos),
    enabled: pipelineId !== null,
    staleTime: 5 * 60 * 1000,
    retry: SEM_RETENTATIVA_EM_RECUSA,
  });
}

export function useCampos(pipelineId: string | null, incluirInativos = false) {
  return useQuery({
    queryKey: [...chavesDoPipeline.campos(pipelineId ?? ""), incluirInativos] as const,
    queryFn: () => listarCampos(pipelineId ?? "", incluirInativos),
    enabled: pipelineId !== null,
    staleTime: 5 * 60 * 1000,
    retry: SEM_RETENTATIVA_EM_RECUSA,
  });
}

function useInvalidacaoDePipeline() {
  const qc = useQueryClient();
  return (pipelineId: string) => {
    void qc.invalidateQueries({ queryKey: chavesDoPipeline.pipelines });
    void qc.invalidateQueries({ queryKey: chavesDoPipeline.estagios(pipelineId) });
    void qc.invalidateQueries({ queryKey: chavesDoPipeline.motivos(pipelineId) });
    void qc.invalidateQueries({ queryKey: chavesDoPipeline.board(pipelineId) });
  };
}

export function useCriarPipeline() {
  const invalidar = useInvalidacaoDePipeline();
  return useMutation({
    mutationFn: (dados: {
      nome: string;
      estagios: ReadonlyArray<{ nome: string; tipo: TipoDeEstagio }>;
    }) => criarPipeline(dados),
    onSuccess: (id) => invalidar(id),
    onError: avisarErro("Não foi possível criar o pipeline."),
  });
}

export function useRenomearPipeline() {
  const invalidar = useInvalidacaoDePipeline();
  return useMutation({
    mutationFn: ({ id, nome }: { id: string; nome: string }) => renomearPipeline(id, nome),
    onSuccess: (_dado, variaveis) => invalidar(variaveis.id),
    onError: avisarErro("Não foi possível renomear o pipeline."),
  });
}

export function useArquivarPipeline() {
  const invalidar = useInvalidacaoDePipeline();
  return useMutation({
    mutationFn: ({ id, ativo }: { id: string; ativo: boolean }) => arquivarPipeline(id, ativo),
    onSuccess: (_dado, variaveis) => invalidar(variaveis.id),
    onError: avisarErro("Não foi possível arquivar o pipeline."),
  });
}

export function useApagarPipeline() {
  const invalidar = useInvalidacaoDePipeline();
  return useMutation({
    mutationFn: (id: string) => apagarPipeline(id),
    onSuccess: (_dado, id) => {
      invalidar(id);
      toast.success("Pipeline apagado.");
    },
    onError: avisarErro("Não foi possível apagar o pipeline."),
  });
}

export function useSalvarEstagios() {
  const invalidar = useInvalidacaoDePipeline();
  return useMutation({
    mutationFn: ({
      pipelineId,
      estagios,
    }: {
      pipelineId: string;
      estagios: ReadonlyArray<{ id?: string; nome: string; tipo: TipoDeEstagio }>;
    }) => salvarEstagios(pipelineId, estagios),
    onSuccess: (_dado, variaveis) => invalidar(variaveis.pipelineId),
    onError: avisarErro("Não foi possível salvar os estágios."),
  });
}

export function useSalvarCampos() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      pipelineId,
      rascunho,
    }: {
      pipelineId: string;
      rascunho: ReadonlyArray<RascunhoDeCampo>;
    }) => salvarCampos(pipelineId, rascunho),
    onSuccess: async (_dado, variaveis) => {
      await Promise.all([
        qc.invalidateQueries({ queryKey: chavesDoPipeline.campos(variaveis.pipelineId) }),
        qc.invalidateQueries({ queryKey: chavesDoPipeline.raiz }),
      ]);
    },
    onError: (erro: unknown, variaveis) => {
      void qc.invalidateQueries({ queryKey: chavesDoPipeline.campos(variaveis.pipelineId) });
      avisarErro("Não foi possível salvar os campos.")(erro);
    },
  });
}

export function useSalvarMotivos() {
  const invalidar = useInvalidacaoDePipeline();
  return useMutation({
    mutationFn: ({
      pipelineId,
      motivos,
    }: {
      pipelineId: string;
      motivos: ReadonlyArray<{
        id?: string;
        tipo: MotivoDeSaida["tipo"];
        rotulo: string;
        ativo: boolean;
      }>;
    }) => salvarMotivos(pipelineId, motivos),
    onSuccess: (_dado, variaveis) => invalidar(variaveis.pipelineId),
    onError: avisarErro("Não foi possível salvar os motivos."),
  });
}

export function useEventos(oportunidadeId: string | null) {
  return useQuery({
    queryKey: chavesDoPipeline.eventos(oportunidadeId ?? ""),
    queryFn: () => listarEventos(oportunidadeId ?? ""),
    enabled: oportunidadeId !== null,
  });
}

export function useCatalogoDeQualificacao() {
  return useQuery({
    queryKey: chavesDoPipeline.catalogo,
    queryFn: carregarCatalogo,
    staleTime: 5 * 60 * 1000,
  });
}

export function useResponsaveis(
  responsavelAtualId: string | null,
  { enabled = true }: { enabled?: boolean } = {},
) {
  return useQuery({
    queryKey: chavesDoPipeline.responsaveis(responsavelAtualId),
    queryFn: () => listarResponsaveis(responsavelAtualId),
    staleTime: 5 * 60 * 1000,
    enabled,
  });
}

export function useMoverEstagio() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      oportunidadeId,
      destino,
      estagioAtualId,
      motivo,
    }: {
      oportunidadeId: string;
      destino: EstagioDoPipeline;
      estagioAtualId: string;
      motivo?: MotivoDeSaidaEscolhido | null;
      pipelineId: string;
    }) => moverParaEstagio(oportunidadeId, destino, estagioAtualId, motivo ?? null),
    onSuccess: (_dado, variaveis) => {
      void qc.invalidateQueries({ queryKey: chavesDoPipeline.board(variaveis.pipelineId) });
      void qc.invalidateQueries({ queryKey: chavesDoPipeline.eventos(variaveis.oportunidadeId) });
      void qc.invalidateQueries({ queryKey: chavesDoPipeline.atividade });
      void qc.invalidateQueries({ queryKey: chavesDoPipeline.primeiroContatoRaiz });
      void qc.invalidateQueries({ queryKey: ["clients", "ganhas-sem-contrato"] });
    },
    onError: (_erro, variaveis) =>
      void qc.invalidateQueries({ queryKey: chavesDoPipeline.board(variaveis.pipelineId) }),
  });
}

function avisarEInvalidarRaiz(qc: ReturnType<typeof useQueryClient>, fallback: string) {
  return avisarEInvalidar(qc, chavesDoPipeline.raiz, fallback);
}

export function useAtualizarDatasDeReuniao() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ oportunidadeId, campos }: { oportunidadeId: string; campos: CamposDeReuniao }) =>
      atualizarDatasDeReuniao(oportunidadeId, campos),
    onSuccess: () => void qc.invalidateQueries({ queryKey: chavesDoPipeline.raiz }),
    onError: avisarEInvalidarRaiz(qc, "Não foi possível gravar a data."),
  });
}

export function useAtualizarNutricao() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      oportunidadeId,
      campos,
    }: {
      oportunidadeId: string;
      campos: CamposDeNutricao;
    }) => atualizarNutricao(oportunidadeId, campos),
    onSuccess: () => void qc.invalidateQueries({ queryKey: chavesDoPipeline.raiz }),
    onError: avisarEInvalidarRaiz(qc, "Não foi possível gravar a nutrição."),
  });
}

export function useAtualizarDadosDaOportunidade() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, campos }: { id: string; campos: DadosEditaveisDaOportunidade }) =>
      atualizarDadosDaOportunidade(id, campos),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: chavesDoPipeline.raiz });
    },
    onError: avisarEInvalidarRaiz(qc, "Não foi possível salvar."),
  });
}

export function useCorrigirMotivoDeSaida() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      oportunidadeId,
      estagioAtualId,
      correcao,
    }: {
      oportunidadeId: string;
      estagioAtualId: string;
      correcao: CorrecaoDeSaida;
    }) => corrigirMotivoDeSaida(oportunidadeId, estagioAtualId, correcao),
    onSuccess: () => void qc.invalidateQueries({ queryKey: chavesDoPipeline.raiz }),
    onError: avisarEInvalidarRaiz(qc, "Não foi possível corrigir o motivo."),
  });
}

export function useApagarOportunidade() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apagarOportunidade(id),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: chavesDoPipeline.raiz });
      void qc.invalidateQueries({ queryKey: ["clients"] });
      void qc.invalidateQueries({ queryKey: ["reunioes"] });
      toast.success("Oportunidade apagada.");
    },
    onError: avisarEInvalidarRaiz(qc, "Não foi possível apagar a oportunidade."),
  });
}

export function useCriarOportunidade() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (dados: DadosDeNovaOportunidade) => criarOportunidade(dados),
    onSuccess: (_id, dados) =>
      void qc.invalidateQueries({ queryKey: chavesDoPipeline.board(dados.pipelineId) }),
  });
}

export function useImportarOportunidades() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      pipelineId,
      linhas,
      previa,
      arquivo,
    }: {
      pipelineId: string;
      linhas: readonly LinhaDeImportacao[];
      previa: boolean;
      arquivo: string;
    }) => importarOportunidades(pipelineId, linhas, previa, arquivo),
    onSuccess: (resultado: ResultadoDaLinha[], variaveis) => {
      if (variaveis.previa) return;
      void qc.invalidateQueries({ queryKey: chavesDoPipeline.raiz });
      const novas = resultado.filter((linha) => linha.acao === "nova").length;
      const atualizadas = resultado.filter((linha) => linha.acao === "atualiza").length;
      const erros = resultado.filter((linha) => linha.acao === "erro").length;
      toast.success(
        `${plural(novas, "nova", "novas")} · ${plural(atualizadas, "atualizada", "atualizadas")} · ${plural(erros, "erro", "erros")}`,
      );
    },
    onError: avisarErro("Não foi possível importar as oportunidades."),
  });
}

export function useAtualizarEmLote() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ alvos, acao }: { alvos: readonly AlvoDoLote[]; acao: AcaoEmLote }) =>
      atualizarEmLote(alvos, acao),
    onSuccess: async (alteradas) => {
      await qc.invalidateQueries({ queryKey: chavesDoPipeline.raiz });
      toast.success(
        alteradas === 1 ? "1 oportunidade atualizada" : `${alteradas} oportunidades atualizadas`,
      );
    },
    onError: (erro: unknown) => {
      void qc.invalidateQueries({ queryKey: chavesDoPipeline.raiz });
      avisarErro("Não foi possível aplicar em lote.")(erro);
    },
  });
}

export function useResponderPergunta() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      oportunidadeId,
      resposta,
      respondidoPor,
    }: {
      oportunidadeId: string;
      resposta: RespostaParaGravar;
      respondidoPor: string | null;
    }) => responderPergunta(oportunidadeId, resposta, respondidoPor),
    onSuccess: () => void qc.invalidateQueries({ queryKey: chavesDoPipeline.raiz }),
  });
}

export function useFunilPorCanal(desde: string | null = null) {
  return useQuery({
    queryKey: chavesDoPipeline.funil(desde ?? "sempre"),
    queryFn: () => lerFunilPorCanal(desde),
    retry: SEM_RETENTATIVA_EM_RECUSA,
  });
}

export function useAtividadeSemanal(desde: string | null = null) {
  return useQuery({
    queryKey: chavesDoPipeline.atividadeSemanal(desde ?? "sempre"),
    queryFn: () => lerAtividadeSemanal(desde),
    retry: SEM_RETENTATIVA_EM_RECUSA,
  });
}

export function useMixDeOportunidades() {
  return useQuery({
    queryKey: chavesDoPipeline.mix,
    queryFn: lerMixDeOportunidades,
    retry: SEM_RETENTATIVA_EM_RECUSA,
  });
}

export function useFechamentosPorCampanha() {
  return useQuery({
    queryKey: chavesDoPipeline.campanhas,
    queryFn: lerFechamentosPorCampanha,
    retry: SEM_RETENTATIVA_EM_RECUSA,
  });
}

export function usePrimeiroContato(ids: readonly string[]) {
  const ordenados = [...ids].sort();
  return useQuery({
    queryKey: chavesDoPipeline.primeiroContato(ordenados),
    queryFn: () => lerPrimeiroContato(ordenados),
    enabled: ordenados.length > 0,
    retry: SEM_RETENTATIVA_EM_RECUSA,
  });
}

export function useTempoAtePrimeiroContato(desde: string | null = null) {
  return useQuery({
    queryKey: chavesDoPipeline.tempoAtePrimeiroContato(desde ?? "sempre"),
    queryFn: () => lerTempoAtePrimeiroContato(desde),
    retry: SEM_RETENTATIVA_EM_RECUSA,
  });
}

export function useRegistrarToque() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      oportunidadeId,
      tipo,
      texto,
    }: {
      oportunidadeId: string;
      tipo: TipoRegistravel;
      texto: string;
    }) => registrarToque(oportunidadeId, tipo, texto),
    onSuccess: (_dado, variaveis) => {
      void qc.invalidateQueries({ queryKey: chavesDoPipeline.eventos(variaveis.oportunidadeId) });
      void qc.invalidateQueries({ queryKey: chavesDoPipeline.atividade });
      void qc.invalidateQueries({ queryKey: chavesDoPipeline.primeiroContatoRaiz });
    },
  });
}

export function useCorrigirTextoDoEvento() {
  const qc = useQueryClient();
  const reler = (oportunidadeId: string) =>
    qc.invalidateQueries({ queryKey: chavesDoPipeline.eventos(oportunidadeId) });
  return useMutation({
    mutationFn: ({
      eventoId,
      texto,
      editadoEmLido,
    }: {
      oportunidadeId: string;
      eventoId: string;
      texto: string;
      editadoEmLido: string | null;
    }) => corrigirTextoDoEvento(eventoId, texto, editadoEmLido),
    onSuccess: async (_dado, variaveis) => {
      await reler(variaveis.oportunidadeId);
    },
    onError: async (erro, variaveis) => {
      avisarErro("Não foi possível corrigir a nota.")(erro);
      await reler(variaveis.oportunidadeId);
    },
  });
}

export function useVincularRef() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      oportunidadeId,
      attributionId,
    }: {
      oportunidadeId: string;
      attributionId: string;
    }) => vincularRef(oportunidadeId, attributionId),
    onSuccess: () => void qc.invalidateQueries({ queryKey: chavesDoPipeline.raiz }),
  });
}
