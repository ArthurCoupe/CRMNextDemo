import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { SEM_RETENTATIVA_EM_RECUSA } from "@/shared/lib/permissao";

import {
  apagarScript,
  atualizarScript,
  criarScript,
  definirSituacaoDoScript,
  listarMaisUsados,
  listarNichos,
  listarScripts,
  listarScriptsDeWhatsApp,
  registrarUso,
  type AlteracaoDeScript,
  type DadosDeScript,
  type FiltrosDeScript,
} from "../api/scripts.repository";
import type { TipoDeScript } from "../domain/script";

export const chavesDeScripts = {
  raiz: ["scripts"] as const,
  lista: (filtros: FiltrosDeScript) => ["scripts", "lista", filtros] as const,
  nichos: (tipo: TipoDeScript) => ["scripts", "nichos", tipo] as const,
  maisUsados: (tipo: TipoDeScript) => ["scripts", "mais-usados", tipo] as const,
  whatsapp: ["scripts", "whatsapp"] as const,
};

export function useScripts(filtros: FiltrosDeScript) {
  return useQuery({
    queryKey: chavesDeScripts.lista(filtros),
    queryFn: () => listarScripts(filtros),
    retry: SEM_RETENTATIVA_EM_RECUSA,
    placeholderData: (anterior, consultaAnterior) => {
      const f = consultaAnterior?.queryKey[2];
      return f !== undefined && mesmoRecorte(f, filtros) ? anterior : undefined;
    },
  });
}

export function useScriptsDeWhatsApp(habilitado: boolean) {
  return useQuery({
    queryKey: chavesDeScripts.whatsapp,
    queryFn: () => listarScriptsDeWhatsApp(),
    retry: SEM_RETENTATIVA_EM_RECUSA,
    enabled: habilitado,
  });
}

function mesmoRecorte(a: FiltrosDeScript, b: FiltrosDeScript): boolean {
  return a.tipo === b.tipo && a.nicho === b.nicho && a.canal === b.canal && a.momento === b.momento;
}

export function useNichos(tipo: TipoDeScript) {
  return useQuery({
    queryKey: chavesDeScripts.nichos(tipo),
    queryFn: () => listarNichos(tipo),
    retry: SEM_RETENTATIVA_EM_RECUSA,
    staleTime: 5 * 60 * 1000,
  });
}

export function useMaisUsadosRecentemente(tipo: TipoDeScript) {
  return useQuery({
    queryKey: chavesDeScripts.maisUsados(tipo),
    queryFn: () => listarMaisUsados(tipo),
    retry: SEM_RETENTATIVA_EM_RECUSA,
  });
}

function aoFalhar(erro: unknown) {
  toast.error(erro instanceof Error ? erro.message : "Não foi possível salvar.");
}

export function useCriarScript() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (dados: DadosDeScript) => criarScript(dados),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: chavesDeScripts.raiz });
      toast.success("Script criado.");
    },
    onError: aoFalhar,
  });
}

export function useAtualizarScript() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      dados,
      updatedAt,
    }: {
      id: string;
      dados: AlteracaoDeScript;
      updatedAt: string;
    }) => atualizarScript(id, dados, updatedAt),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: chavesDeScripts.raiz });
      toast.success("Script salvo.");
    },
    onError: (erro) => {
      void qc.invalidateQueries({ queryKey: chavesDeScripts.raiz });
      aoFalhar(erro);
    },
  });
}

export function useDefinirSituacaoDoScript() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ativo }: { id: string; ativo: boolean }) =>
      definirSituacaoDoScript(id, ativo),
    onSuccess: (_dado, { ativo }) => {
      void qc.invalidateQueries({ queryKey: chavesDeScripts.raiz });
      toast.success(ativo ? "Script reativado." : "Script arquivado.");
    },
    onError: aoFalhar,
  });
}

export function useApagarScript() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apagarScript(id),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: chavesDeScripts.raiz });
      toast.success("Script apagado.");
    },
    onError: (erro: unknown) => {
      void qc.invalidateQueries({ queryKey: chavesDeScripts.raiz });
      aoFalhar(erro);
    },
  });
}

export function useRegistrarUso() {
  return useMutation({
    mutationFn: (scriptId: string) => registrarUso(scriptId),
    onError: () => undefined,
  });
}
