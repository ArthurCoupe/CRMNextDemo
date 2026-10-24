import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { chavesDeContratos } from "./use-contracts";
import {
  apagarProduto,
  definirSituacaoDoProduto,
  listarCatalogoCompleto,
  salvarProduto,
} from "../api/products.repository";

export const chavesDeProduto = {
  catalogo: ["produtos", "catalogo"] as const,
};

export function useCatalogoDeProdutos() {
  return useQuery({
    queryKey: chavesDeProduto.catalogo,
    queryFn: listarCatalogoCompleto,
    staleTime: 5 * 60 * 1000,
  });
}

function aoFalhar(erro: unknown) {
  const mensagem = erro instanceof Error ? erro.message : "Não foi possível salvar.";
  toast.error(`O produto NÃO foi salvo. ${mensagem}`);
}

function useInvalidarProdutos() {
  const qc = useQueryClient();
  return () => {
    void qc.invalidateQueries({ queryKey: chavesDeProduto.catalogo });
    void qc.invalidateQueries({ queryKey: chavesDeContratos.produtos });
  };
}

export function useSalvarProduto() {
  const invalidar = useInvalidarProdutos();
  return useMutation({
    mutationFn: salvarProduto,
    onSuccess: () => {
      invalidar();
      toast.success("Produto salvo.");
    },
    onError: aoFalhar,
  });
}

export function useDefinirSituacaoDoProduto() {
  const invalidar = useInvalidarProdutos();
  return useMutation({
    mutationFn: ({ id, ativo }: { id: string; ativo: boolean }) =>
      definirSituacaoDoProduto(id, ativo),
    onSuccess: () => {
      invalidar();
      toast.success("Situação do produto atualizada.");
    },
    onError: aoFalhar,
  });
}

export function useApagarProduto() {
  const invalidar = useInvalidarProdutos();
  return useMutation({
    mutationFn: (id: string) => apagarProduto(id),
    onSuccess: () => {
      invalidar();
      toast.success("Produto apagado.");
    },
    onError: (erro: unknown) => {
      const mensagem = erro instanceof Error ? erro.message : "Não foi possível apagar.";
      toast.error(`O produto NÃO foi apagado. ${mensagem}`);
    },
  });
}
