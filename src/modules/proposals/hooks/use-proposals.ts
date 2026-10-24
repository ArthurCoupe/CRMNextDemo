import { type QueryClient, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { avisarErro } from "@/shared/lib/avisar-erro";
import { SEM_RETENTATIVA_EM_RECUSA } from "@/shared/lib/permissao";

import {
  adicionarItem,
  criarProposta,
  editarItem,
  editarProposta,
  enviarProposta,
  excluirRascunho,
  lerPropostaParaImpressao,
  listarContratosACriar,
  listarItens,
  listarPropostas,
  novaVersao,
  podeVerPropostas,
  recusarProposta,
  registrarContratoDaProposta,
  removerItem,
  reordenarItens,
  type CamposDaProposta,
  type CamposDoItem,
} from "../api/proposals.repository";
import type { MudancaDeOrdem } from "../domain/ordem";

export const chavesDePropostas = {
  raiz: ["proposals"] as const,
  daOportunidade: (oportunidadeId: string) =>
    ["proposals", "oportunidade", oportunidadeId] as const,
  itens: (propostaId: string) => ["proposals", "itens", propostaId] as const,
  impressao: (propostaId: string) => ["proposals", "impressao", propostaId] as const,
  aCriar: (clienteId: string) => ["proposals", "a-criar", clienteId] as const,
};

const EVENTOS_DA_OPORTUNIDADE = (id: string) => ["opportunities", id, "eventos"] as const;
const PRIMEIRO_CONTATO = ["opportunities", "primeiro-contato"] as const;
const ATIVIDADE = ["opportunities", "atividade"] as const;

interface Alvo {
  readonly propostaId: string;
  readonly oportunidadeId: string;
}

export function usePropostas(oportunidadeId: string) {
  return useQuery({
    queryKey: chavesDePropostas.daOportunidade(oportunidadeId),
    queryFn: () => listarPropostas(oportunidadeId),
    retry: SEM_RETENTATIVA_EM_RECUSA,
  });
}

export function usePodeVerPropostas(oportunidadeId: string) {
  return useQuery({
    queryKey: [...chavesDePropostas.daOportunidade(oportunidadeId), "pode-ver"] as const,
    queryFn: () => podeVerPropostas(oportunidadeId),
    retry: SEM_RETENTATIVA_EM_RECUSA,
  });
}

export function useItensDaProposta(propostaId: string | null) {
  return useQuery({
    queryKey: chavesDePropostas.itens(propostaId ?? ""),
    queryFn: () => listarItens(propostaId ?? ""),
    enabled: propostaId !== null,
    retry: SEM_RETENTATIVA_EM_RECUSA,
  });
}

export function usePropostaParaImpressao(propostaId: string) {
  return useQuery({
    queryKey: chavesDePropostas.impressao(propostaId),
    queryFn: () => lerPropostaParaImpressao(propostaId),
    retry: SEM_RETENTATIVA_EM_RECUSA,
  });
}

export function useContratosACriar(clienteId: string) {
  return useQuery({
    queryKey: chavesDePropostas.aCriar(clienteId),
    queryFn: () => listarContratosACriar(clienteId),
    retry: SEM_RETENTATIVA_EM_RECUSA,
  });
}

function useInvalidar() {
  const qc = useQueryClient();
  return ({ propostaId, oportunidadeId }: Partial<Alvo>) => {
    if (oportunidadeId !== undefined) {
      void qc.invalidateQueries({ queryKey: chavesDePropostas.daOportunidade(oportunidadeId) });
    }
    if (propostaId !== undefined) {
      void qc.invalidateQueries({ queryKey: chavesDePropostas.itens(propostaId) });
    }
  };
}

export function useCriarProposta() {
  const invalidar = useInvalidar();
  return useMutation({
    mutationFn: ({ oportunidadeId }: { readonly oportunidadeId: string }) =>
      criarProposta(oportunidadeId),
    onError: avisarErro("Não foi possível criar a proposta."),
    onSettled: (_d, _e, { oportunidadeId }) => invalidar({ oportunidadeId }),
  });
}

export function useEditarProposta() {
  const invalidar = useInvalidar();
  return useMutation({
    mutationFn: ({ propostaId, campos }: Alvo & { readonly campos: CamposDaProposta }) =>
      editarProposta(propostaId, campos),
    onError: avisarErro("Não foi possível salvar a proposta."),
    onSettled: (_d, _e, alvo) => invalidar(alvo),
  });
}

export function useExcluirRascunho() {
  const invalidar = useInvalidar();
  return useMutation({
    mutationFn: ({ propostaId }: Alvo) => excluirRascunho(propostaId),
    onError: avisarErro("Não foi possível excluir o rascunho."),
    onSettled: (_d, _e, { oportunidadeId }) => invalidar({ oportunidadeId }),
  });
}

export function useAdicionarItem() {
  const invalidar = useInvalidar();
  return useMutation({
    mutationFn: ({
      propostaId,
      produtoId,
      ordem,
    }: Alvo & { readonly produtoId: string; readonly ordem: number }) =>
      adicionarItem(propostaId, produtoId, ordem),
    onError: avisarErro("Não foi possível adicionar o item."),
    onSettled: (_d, _e, alvo) => invalidar(alvo),
  });
}

export function useEditarItem() {
  const invalidar = useInvalidar();
  return useMutation({
    mutationFn: ({
      itemId,
      campos,
    }: Alvo & {
      readonly itemId: string;
      readonly campos: CamposDoItem;
    }) => editarItem(itemId, campos),
    onError: avisarErro("Não foi possível salvar o item."),
    onSettled: (_d, _e, alvo) => invalidar(alvo),
  });
}

export function useReordenarItens() {
  const invalidar = useInvalidar();
  return useMutation({
    mutationFn: ({ mudancas }: Alvo & { readonly mudancas: readonly MudancaDeOrdem[] }) =>
      reordenarItens(mudancas),
    onError: avisarErro("Não foi possível mudar a ordem dos itens."),
    onSettled: (_d, _e, alvo) => invalidar(alvo),
  });
}

export function useRemoverItem() {
  const invalidar = useInvalidar();
  return useMutation({
    mutationFn: ({ itemId }: Alvo & { readonly itemId: string }) => removerItem(itemId),
    onError: avisarErro("Não foi possível remover o item."),
    onSettled: (_d, _e, alvo) => invalidar(alvo),
  });
}

export function useEnviarProposta() {
  const qc = useQueryClient();
  const invalidar = useInvalidar();
  return useMutation({
    mutationFn: ({ propostaId }: Alvo) => enviarProposta(propostaId),
    onError: avisarErro("Não foi possível registrar o envio."),
    onSettled: (_d, _e, alvo) => {
      invalidar(alvo);
      void qc.invalidateQueries({ queryKey: EVENTOS_DA_OPORTUNIDADE(alvo.oportunidadeId) });
      void qc.invalidateQueries({ queryKey: PRIMEIRO_CONTATO });
      void qc.invalidateQueries({ queryKey: ATIVIDADE });
    },
  });
}

export function useRecusarProposta() {
  const invalidar = useInvalidar();
  return useMutation({
    mutationFn: ({ propostaId }: Alvo) => recusarProposta(propostaId),
    onError: avisarErro("Não foi possível marcar como recusada."),
    onSettled: (_d, _e, alvo) => invalidar(alvo),
  });
}

export function useNovaVersao() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ propostaId }: Alvo) => novaVersao(propostaId),
    onError: avisarErro("Não foi possível criar a nova versão."),
    onSettled: (_d, _e, { oportunidadeId }) =>
      qc.invalidateQueries({ queryKey: chavesDePropostas.daOportunidade(oportunidadeId) }),
  });
}

export const CHAVE_DAS_LIGACOES_PENDENTES = ["ligacoes-pendentes-de-proposta"] as const;

export const CHAVE_DA_LIGACAO = ["registrar-contrato-da-proposta"] as const;

function lerLigacoes(qc: QueryClient) {
  return qc.getQueryData<Record<string, string>>(CHAVE_DAS_LIGACOES_PENDENTES) ?? {};
}

function gravarLigacoes(qc: QueryClient, mapa: Record<string, string>) {
  qc.setQueryDefaults(CHAVE_DAS_LIGACOES_PENDENTES, { gcTime: Infinity, staleTime: Infinity });
  qc.setQueryData(CHAVE_DAS_LIGACOES_PENDENTES, mapa);
}

function marcarLigacao(qc: QueryClient, propostaId: string, contratoId: string) {
  gravarLigacoes(qc, { ...lerLigacoes(qc), [propostaId]: contratoId });
}

function limparLigacao(qc: QueryClient, propostaId: string) {
  gravarLigacoes(
    qc,
    Object.fromEntries(Object.entries(lerLigacoes(qc)).filter(([id]) => id !== propostaId)),
  );
}

export function useRegistrarContratoDaProposta() {
  const qc = useQueryClient();
  const avisar = avisarErro("O contrato foi criado, mas a proposta não foi ligada a ele.");
  return useMutation({
    mutationKey: CHAVE_DA_LIGACAO,
    mutationFn: ({
      propostaId,
      contratoId,
    }: {
      readonly propostaId: string;
      readonly contratoId: string;
    }) => registrarContratoDaProposta(propostaId, contratoId),
    onError: (erro, { propostaId, contratoId }) => {
      marcarLigacao(qc, propostaId, contratoId);
      avisar(erro);
    },
    onSuccess: (_d, { propostaId }) => limparLigacao(qc, propostaId),
    onSettled: () => qc.invalidateQueries({ queryKey: chavesDePropostas.raiz }),
  });
}

export function useLigacoesPendentes(): {
  pendentes: Readonly<Record<string, string>>;
  limpar(propostaId: string): void;
} {
  const qc = useQueryClient();
  const { data } = useQuery({
    queryKey: CHAVE_DAS_LIGACOES_PENDENTES,
    queryFn: () => lerLigacoes(qc),
    initialData: {},
    staleTime: Infinity,
    gcTime: Infinity,
  });
  return {
    pendentes: data,
    limpar: (propostaId) => limparLigacao(qc, propostaId),
  };
}
