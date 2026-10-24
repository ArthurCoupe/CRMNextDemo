import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";

import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/layout/page-header";
import { useProfile } from "@/hooks/use-profile";
import { exigirPapel } from "@/integrations/supabase/papel";
import { EmptyState } from "@/shared/ui/empty-state";
import { FalhaAoLer } from "@/shared/ui/falha-ao-ler";
import { estadoDaConsulta, piorEstado } from "@/shared/ui/estado-da-consulta";

import {
  useApagarJornada,
  useClientesComJornada,
  useEditarEtapaDaJornada,
  useEditarItemDaJornada,
  useIniciarJornada,
  useJornada,
  useLiberarEtapa,
  useMarcarItem,
  usePapeis,
} from "@/modules/onboarding/hooks/use-onboarding";
import { saidaDoAvisoDePapel } from "@/modules/onboarding/domain/aviso-de-papel";
import {
  papeisComPessoaAtiva,
  papeisComPessoaDesativada,
} from "@/modules/onboarding/domain/onboarding";
import { VisaoDaJornada } from "@/modules/onboarding/ui/jornada";

export const Route = createFileRoute("/_authenticated/onboarding")({
  beforeLoad: ({ context }) => exigirPapel(["owner", "manager", "member"], context.papel),
  component: OnboardingPage,
});

function OnboardingPage() {
  const clientes = useClientesComJornada();
  const papeis = usePapeis();
  const [clienteId, setClienteId] = useState<string | null>(null);

  const { perfil, papel, meuId } = useProfile();

  const ondeResolver = saidaDoAvisoDePapel(perfil !== null, papel === "owner");

  const iniciar = useIniciarJornada();
  const liberar = useLiberarEtapa();
  const marcar = useMarcarItem();
  const apagar = useApagarJornada();
  const editarItem = useEditarItemDaJornada();
  const editarEtapa = useEditarEtapaDaJornada();

  const lista = clientes.data ?? [];
  const selecionado = lista.find((c) => c.id === clienteId) ?? null;
  const jornada = useJornada(selecionado?.jornadaId ?? null);

  const podeEscrever =
    papel === "owner" || (papel === "manager" && meuId !== null && selecionado?.donoId === meuId);

  const estadoDoTopo = piorEstado(estadoDaConsulta(clientes), estadoDaConsulta(papeis));
  const papeisComPessoa = papeisComPessoaAtiva(papeis.data ?? []);
  const papeisDesativados = papeisComPessoaDesativada(papeis.data ?? []);
  const papeisDisponiveis = (papeis.data ?? []).map((p) => p.papel);

  return (
    <>
      <PageHeader
        title="Onboarding"
        description="A entrada do cliente novo, da assinatura ao primeiro resultado."
      />

      {estadoDoTopo === "erro" ? (
        <FalhaAoLer oQue="os clientes e os papéis" />
      ) : estadoDoTopo === "carregando" ? (
        <div className="h-24 animate-pulse rounded-xl border bg-card" />
      ) : (
        <>
          <div className="mb-4 flex flex-wrap items-center gap-2">
            <select
              className="h-9 min-w-56 rounded-md border bg-background px-2 text-sm"
              value={clienteId ?? ""}
              onChange={(e) => setClienteId(e.target.value === "" ? null : e.target.value)}
            >
              <option value="">Escolha um cliente…</option>
              {lista.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.nome}
                  {c.jornadaId === null
                    ? " (sem jornada)"
                    : c.jornadaConcluida
                      ? " (concluída)"
                      : ""}
                </option>
              ))}
            </select>

            {selecionado !== null && selecionado.jornadaId === null && podeEscrever && (
              <Button
                type="button"
                size="sm"
                className="h-9"
                disabled={iniciar.isPending}
                onClick={() => iniciar.mutate(selecionado.id)}
              >
                Abrir jornada de {selecionado.nome}
              </Button>
            )}

            {selecionado !== null && selecionado.jornadaId === null && !podeEscrever && (
              <span className="text-[11px] text-muted-foreground">
                Abrir jornada é do owner ou do responsável pelo cliente.
              </span>
            )}

            {selecionado?.jornadaConcluida === true && (
              <span className="rounded-md bg-success/10 px-2 py-1 text-[11px] text-success">
                Onboarding concluído. Abaixo, como foi
              </span>
            )}
          </div>

          {selecionado === null ? (
            <EmptyState
              title="Escolha um cliente"
              description="Uma jornada por vez. A lista mostra quem já tem jornada aberta e quem ainda não."
            />
          ) : selecionado.jornadaId === null ? (
            <EmptyState
              title={`${selecionado.nome} ainda não tem jornada`}
              description="Abrir a jornada copia as etapas do método. A cópia é dela: mudar o método depois não reescreve esta jornada."
            />
          ) : estadoDaConsulta(jornada) === "erro" ? (
            <FalhaAoLer oQue="a jornada" />
          ) : estadoDaConsulta(jornada) === "carregando" ? (
            <div className="h-64 animate-pulse rounded-xl border bg-card" />
          ) : jornada.data ? (
            <VisaoDaJornada
              jornada={jornada.data}
              papeisComPessoa={papeisComPessoa}
              papeisComPessoaDesativada={papeisDesativados}
              podeEscrever={podeEscrever}
              ondeResolver={ondeResolver}
              liberando={liberar.isPending}
              onLiberar={(etapaId, forcar) => liberar.mutate({ etapaId, forcar })}
              onMarcar={(itemId, concluido) => marcar.mutate({ itemId, concluido })}
              podeApagar={papel === "owner"}
              apagando={apagar.isPending}
              onApagar={(jornadaId) => apagar.mutate(jornadaId)}
              papeisDisponiveis={papeisDisponiveis}
              editando={editarItem.isPending || editarEtapa.isPending}
              onEditarItem={(itemId, campos, aoSalvar) =>
                editarItem.mutate({ itemId, campos }, { onSuccess: aoSalvar })
              }
              onEditarEtapa={(etapaId, campos, aoSalvar) =>
                editarEtapa.mutate({ etapaId, campos }, { onSuccess: aoSalvar })
              }
            />
          ) : null}
        </>
      )}
    </>
  );
}
