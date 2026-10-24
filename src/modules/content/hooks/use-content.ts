import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { avisarErro } from "@/shared/lib/avisar-erro";
import { SEM_RETENTATIVA_EM_RECUSA } from "@/shared/lib/permissao";

import {
  apagarPost,
  corrigirPublicacao,
  criarPost,
  editarPost,
  listarClientes,
  listarEventos,
  listarPostsDaSemana,
  listarPostsDoQuadro,
  listarResponsaveis,
  moverPost,
} from "../api/content.repository";
import type { CamposDoPost, CorrecaoDaPublicacao } from "../domain/formulario";
import type { StatusDoPost } from "../domain/post";
import { limitesDaSemana } from "../domain/semana";

export const chavesDoConteudo = {
  raiz: ["content"] as const,
  quadro: (clienteId: string | null, desde: string) =>
    ["content", "quadro", clienteId, desde] as const,
  semana: (inicio: string, clienteId: string | null) =>
    ["content", "semana", inicio, clienteId] as const,
  eventos: (postId: string) => ["content", "eventos", postId] as const,
  responsaveis: ["content-listas", "responsaveis"] as const,
  clientes: ["content-listas", "clientes"] as const,
};

export function usePostsDoQuadro(clienteId: string | null, publicadosDesde: string) {
  return useQuery({
    queryKey: chavesDoConteudo.quadro(clienteId, publicadosDesde),
    queryFn: () => listarPostsDoQuadro(clienteId, publicadosDesde),
    retry: SEM_RETENTATIVA_EM_RECUSA,
  });
}

export function usePostsDaSemana(inicio: string, clienteId: string | null, ativo: boolean) {
  return useQuery({
    queryKey: chavesDoConteudo.semana(inicio, clienteId),
    queryFn: () => {
      const { de, ate } = limitesDaSemana(inicio);
      return listarPostsDaSemana(de, ate, clienteId);
    },
    enabled: ativo,
    retry: SEM_RETENTATIVA_EM_RECUSA,
  });
}

export function useEventosDoPost(postId: string | null) {
  return useQuery({
    queryKey: chavesDoConteudo.eventos(postId ?? ""),
    queryFn: () => listarEventos(postId ?? ""),
    enabled: postId !== null,
    retry: SEM_RETENTATIVA_EM_RECUSA,
  });
}

export function useResponsaveis() {
  return useQuery({
    queryKey: chavesDoConteudo.responsaveis,
    queryFn: listarResponsaveis,
    retry: SEM_RETENTATIVA_EM_RECUSA,
  });
}

export function useClientesDoConteudo() {
  return useQuery({
    queryKey: chavesDoConteudo.clientes,
    queryFn: listarClientes,
    retry: SEM_RETENTATIVA_EM_RECUSA,
  });
}

export interface Movimento {
  readonly id: string;
  readonly de: StatusDoPost;
  readonly para: StatusDoPost;
  readonly nota?: string | null;
  readonly link?: string | null;
}

function useRelerConteudo() {
  const qc = useQueryClient();
  return () => qc.invalidateQueries({ queryKey: chavesDoConteudo.raiz });
}

export function useCriarPost() {
  const reler = useRelerConteudo();
  return useMutation({
    mutationFn: (campos: CamposDoPost) => criarPost(campos),
    onError: avisarErro("Não foi possível criar o post."),
    onSettled: reler,
  });
}

export function useEditarPost() {
  const reler = useRelerConteudo();
  return useMutation({
    mutationFn: (v: { id: string; atualizadoEm: string; campos: CamposDoPost }) =>
      editarPost(v.id, v.atualizadoEm, v.campos),
    onError: avisarErro("Não foi possível salvar o post."),
    onSettled: reler,
  });
}

export function useCorrigirPublicacao() {
  const reler = useRelerConteudo();
  return useMutation({
    mutationFn: (v: { id: string; atualizadoEm: string; correcao: CorrecaoDaPublicacao }) =>
      corrigirPublicacao(v.id, v.atualizadoEm, v.correcao),
    onError: avisarErro("Não foi possível corrigir a publicação."),
    onSettled: reler,
  });
}

export function useMoverPost() {
  const reler = useRelerConteudo();
  return useMutation({
    mutationFn: (m: Movimento) => moverPost(m.id, m.de, m.para, m.nota ?? null, m.link ?? null),
    onError: avisarErro("Não foi possível mudar a etapa do post."),
    onSettled: reler,
  });
}

export function useApagarPost() {
  const reler = useRelerConteudo();
  return useMutation({
    mutationFn: (id: string) => apagarPost(id),
    onError: avisarErro("Não foi possível apagar o post."),
    onSettled: reler,
  });
}
