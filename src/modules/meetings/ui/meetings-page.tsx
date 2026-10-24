import { useState } from "react";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { PageHeader } from "@/components/layout/page-header";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useProfile } from "@/hooks/use-profile";
import { formatDate, formatDateTime, todaySP } from "@/shared/lib/date";
import { EmptyState } from "@/shared/ui/empty-state";
import { estadoDaConsulta } from "@/shared/ui/estado-da-consulta";
import { DialogoDeExclusao } from "@/shared/ui/dialogo-de-exclusao";
import { FalhaAoLer } from "@/shared/ui/falha-ao-ler";

import {
  ehDataCivil,
  ehDataCivilPlausivel,
  MENSAGEM_DO_TETO_DE_REUNIOES,
  paraInstante,
  rotuloDoTipo,
  separarAgenda,
} from "../domain/meeting";
import type { Reuniao } from "../api/meetings.repository";
import {
  useApagarReuniao,
  useCancelarReuniao,
  useClientesParaSelecao,
  useDesfazerCancelamento,
  useReunioes,
  useStaffParaSelecao,
} from "../hooks/use-meetings";
import { FichaDePreparacao } from "./ficha-de-preparacao";
import { FormularioDeReuniao } from "./formulario-de-reuniao";

export function MeetingsPage() {
  const { papel, meuId } = useProfile();
  const podeCriar = papel === "owner" || papel === "manager" || papel === "member";

  const [soAsQueOrganizo, setSoAsQueOrganizo] = useState(false);
  const [janela, setJanela] = useState(() => janelaDaAgenda());
  const [entrada, setEntrada] = useState(janela);
  function mudarPeriodo(campo: "desde" | "ate", valor: string) {
    if (!ehDataCivil(valor)) return;
    setEntrada((e) => ({ ...e, [campo]: valor }));
    if (ehDataCivilPlausivel(valor)) setJanela((j) => ({ ...j, [campo]: valor }));
  }
  const limites = limitesDe(janela);
  const reunioes = useReunioes({
    desde: limites.desde,
    ate: limites.ate,
    soMinhas: soAsQueOrganizo,
  });
  const periodoExibido = `de ${formatDate(janela.desde)} a ${formatDate(janela.ate)}`;
  const cancelar = useCancelarReuniao();
  const apagar = useApagarReuniao();
  const desfazer = useDesfazerCancelamento();

  const [passadasAbertas, setPassadasAbertas] = useState(false);
  const [formAberto, setFormAberto] = useState(false);
  const [reuniaoEmEdicao, setReuniaoEmEdicao] = useState<Reuniao | null>(null);
  const [reuniaoEmPreparo, setReuniaoEmPreparo] = useState<Reuniao | null>(null);

  const clientesQuery = useClientesParaSelecao();
  const pessoasQuery = useStaffParaSelecao();
  const clientes = clientesQuery.data ?? [];
  const pessoas = (pessoasQuery.data ?? []).map((p) => ({ id: p.id, nome: p.nome }));

  const listasQueFalharam = [
    clientesQuery.isError ? "clientes" : null,
    pessoasQuery.isError ? "pessoas do time" : null,
  ].filter((nome): nome is string => nome !== null);
  const formularioIndisponivel = listasQueFalharam.length > 0;

  function abrirNova() {
    setReuniaoEmEdicao(null);
    setFormAberto(true);
  }

  function abrirEdicao(reuniao: Reuniao) {
    setReuniaoEmEdicao(reuniao);
    setFormAberto(true);
  }

  const estado = estadoDaConsulta(reunioes);
  const lista = reunioes.data ?? [];

  const { futuras, passadas } = separarAgenda(lista);

  return (
    <>
      <PageHeader title="Reuniões" description="Agenda de reuniões, futuras e passadas" />

      <div className="mb-3 flex flex-wrap items-center gap-2">
        <Button
          type="button"
          size="sm"
          variant={soAsQueOrganizo ? "default" : "outline"}
          disabled={meuId === null}
          aria-pressed={soAsQueOrganizo}
          onClick={() => setSoAsQueOrganizo((v) => !v)}
        >
          Que eu organizo
        </Button>

        <Label htmlFor="periodo-desde" className="ml-2 text-xs text-muted-foreground">
          Desde
        </Label>
        <Input
          id="periodo-desde"
          type="date"
          className="h-8 w-auto text-xs"
          value={entrada.desde}
          max={janela.ate}
          onChange={(e) => mudarPeriodo("desde", e.target.value)}
        />
        <Label htmlFor="periodo-ate" className="text-xs text-muted-foreground">
          Até
        </Label>
        <Input
          id="periodo-ate"
          type="date"
          className="h-8 w-auto text-xs"
          value={entrada.ate}
          min={janela.desde}
          onChange={(e) => mudarPeriodo("ate", e.target.value)}
        />

        {podeCriar && (
          <Button
            type="button"
            size="sm"
            className="ml-auto"
            disabled={formularioIndisponivel}
            onClick={abrirNova}
          >
            Nova reunião
          </Button>
        )}
      </div>

      {formularioIndisponivel && (
        <p className="mb-3 text-sm text-destructive">
          Não foi possível carregar {listasQueFalharam.join(" e ")}. Criar ou editar reunião fica
          indisponível até recarregar a página.
        </p>
      )}

      {estado === "erro" ? (
        <FalhaAoLer
          oQue="as reuniões"
          mensagem={
            reunioes.error instanceof Error &&
            reunioes.error.message === MENSAGEM_DO_TETO_DE_REUNIOES
              ? MENSAGEM_DO_TETO_DE_REUNIOES
              : undefined
          }
        />
      ) : estado === "carregando" ? (
        <p className="text-sm text-muted-foreground">Carregando reuniões…</p>
      ) : lista.length === 0 ? (
        <EmptyState
          title={`Nenhuma reunião ${periodoExibido}`}
          description={
            podeCriar
              ? "Mude o período acima ou crie a primeira reunião para começar a agenda."
              : "Mude o período acima ou peça a um organizador para registrar a primeira reunião."
          }
        />
      ) : (
        <div className="grid gap-4">
          {gruposDe(futuras).map((grupo) => (
            <div key={grupo.dia}>
              <p className="mb-1.5 text-xs font-medium text-muted-foreground">
                {formatDate(grupo.dia)}
              </p>
              <div className="grid gap-2">
                {grupo.reunioes.map((reuniao) => (
                  <LinhaDeReuniao
                    key={reuniao.id}
                    reuniao={reuniao}
                    podeEditar={
                      papel === "owner" ||
                      papel === "manager" ||
                      (meuId !== null && meuId === reuniao.organizadorId)
                    }
                    podeCancelar={
                      papel === "owner" ||
                      papel === "manager" ||
                      (meuId !== null && meuId === reuniao.organizadorId)
                    }
                    podeApagar={
                      papel === "owner" ||
                      papel === "manager" ||
                      (meuId !== null && meuId === reuniao.organizadorId)
                    }
                    cancelando={cancelar.isPending}
                    apagando={apagar.isPending}
                    desfazendo={desfazer.isPending}
                    formularioIndisponivel={formularioIndisponivel}
                    aoEditar={() => abrirEdicao(reuniao)}
                    aoPreparar={() => setReuniaoEmPreparo(reuniao)}
                    aoCancelar={(motivo) => cancelar.mutate({ id: reuniao.id, motivo })}
                    aoApagar={() => apagar.mutate(reuniao.id)}
                    aoDesfazerCancelamento={(canceladaEm) =>
                      desfazer.mutate({ id: reuniao.id, canceladaEm })
                    }
                  />
                ))}
              </div>
            </div>
          ))}

          {passadas.length > 0 && (
            <div>
              <Button
                type="button"
                size="sm"
                variant="outline"
                aria-expanded={passadasAbertas}
                onClick={() => setPassadasAbertas((v) => !v)}
              >
                {passadasAbertas ? "Ocultar" : "Mostrar"} passadas ({passadas.length})
              </Button>

              {passadasAbertas && (
                <div className="mt-3 grid gap-4">
                  {gruposDe(passadas).map((grupo) => (
                    <div key={grupo.dia}>
                      <p className="mb-1.5 text-xs font-medium text-muted-foreground">
                        {formatDate(grupo.dia)}
                      </p>
                      <div className="grid gap-2">
                        {grupo.reunioes.map((reuniao) => (
                          <LinhaDeReuniao
                            key={reuniao.id}
                            reuniao={reuniao}
                            podeEditar={
                              papel === "owner" ||
                              papel === "manager" ||
                              (meuId !== null && meuId === reuniao.organizadorId)
                            }
                            podeCancelar={
                              papel === "owner" ||
                              papel === "manager" ||
                              (meuId !== null && meuId === reuniao.organizadorId)
                            }
                            podeApagar={
                              papel === "owner" ||
                              papel === "manager" ||
                              (meuId !== null && meuId === reuniao.organizadorId)
                            }
                            cancelando={cancelar.isPending}
                            apagando={apagar.isPending}
                            desfazendo={desfazer.isPending}
                            formularioIndisponivel={formularioIndisponivel}
                            aoEditar={() => abrirEdicao(reuniao)}
                            aoPreparar={() => setReuniaoEmPreparo(reuniao)}
                            aoCancelar={(motivo) => cancelar.mutate({ id: reuniao.id, motivo })}
                            aoApagar={() => apagar.mutate(reuniao.id)}
                            aoDesfazerCancelamento={(canceladaEm) =>
                              desfazer.mutate({ id: reuniao.id, canceladaEm })
                            }
                          />
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          <p className="text-xs text-muted-foreground">
            Mostrando reuniões {periodoExibido}. Mude as datas acima para ver outras.
          </p>
        </div>
      )}

      <FormularioDeReuniao
        aberto={formAberto}
        reuniao={reuniaoEmEdicao}
        aoFechar={() => setFormAberto(false)}
        clientes={clientes}
        pessoas={pessoas}
        janela={janela}
      />
      <FichaDePreparacao reuniao={reuniaoEmPreparo} aoFechar={() => setReuniaoEmPreparo(null)} />
    </>
  );
}

function janelaDaAgenda(agora: Date = new Date()): { desde: string; ate: string } {
  const desde = new Date(agora);
  desde.setMonth(desde.getMonth() - 1);
  const ate = new Date(agora);
  ate.setMonth(ate.getMonth() + 3);
  return { desde: todaySP(desde), ate: todaySP(ate) };
}

function limitesDe(janela: { desde: string; ate: string }): { desde: string; ate: string } {
  const fimDoUltimoMinuto = new Date(paraInstante(janela.ate, "23:59")).getTime() + 59_999;
  return {
    desde: paraInstante(janela.desde, "00:00"),
    ate: new Date(fimDoUltimoMinuto).toISOString(),
  };
}

function gruposDe(
  reunioes: readonly Reuniao[],
): ReadonlyArray<{ dia: string; reunioes: readonly Reuniao[] }> {
  const grupos: { dia: string; reunioes: Reuniao[] }[] = [];
  for (const reuniao of reunioes) {
    const dia = todaySP(new Date(reuniao.startsAt));
    const ultimo = grupos[grupos.length - 1];
    if (ultimo !== undefined && ultimo.dia === dia) {
      ultimo.reunioes.push(reuniao);
    } else {
      grupos.push({ dia, reunioes: [reuniao] });
    }
  }
  return grupos;
}

function comPontoFinal(texto: string): string {
  return /[.!?…]$/.test(texto) ? texto : `${texto}.`;
}

function LinhaDeReuniao({
  reuniao,
  podeEditar,
  podeCancelar,
  podeApagar,
  cancelando,
  apagando,
  desfazendo,
  formularioIndisponivel,
  aoEditar,
  aoPreparar,
  aoCancelar,
  aoApagar,
  aoDesfazerCancelamento,
}: {
  reuniao: Reuniao;
  podeEditar: boolean;
  podeCancelar: boolean;
  podeApagar: boolean;
  cancelando: boolean;
  apagando: boolean;
  desfazendo: boolean;
  formularioIndisponivel: boolean;
  aoEditar: () => void;
  aoPreparar: () => void;
  aoCancelar: (motivo: string) => void;
  aoApagar: () => void;
  aoDesfazerCancelamento: (canceladaEm: string) => void;
}) {
  const { canceladaEm } = reuniao;
  const cancelada = canceladaEm !== null;
  const [motivo, setMotivo] = useState("");
  const motivoIdInput = `motivo-cancelamento-${reuniao.id}`;

  return (
    <Card className="p-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className={cancelada ? "font-medium line-through" : "font-medium"}>{reuniao.titulo}</p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {formatDateTime(reuniao.startsAt)} · {rotuloDoTipo(reuniao.tipo)}
            {reuniao.clienteNome !== null ? ` · ${reuniao.clienteNome}` : ""}
            {reuniao.oportunidadeNome !== null ? ` · ${reuniao.oportunidadeNome}` : ""}
          </p>
          {cancelada && (
            <p className="mt-1 text-xs text-destructive">
              Cancelada. Motivo: {reuniao.motivoDoCancelamento ?? "não informado"}
            </p>
          )}
          {reuniao.cancelamentosDesfeitos.length > 0 && (
            <details className="mt-1 text-[11px] text-muted-foreground">
              <summary className="cursor-pointer">
                {`Cancelamentos desfeitos (${reuniao.cancelamentosDesfeitos.length})`}
              </summary>
              <ul aria-label="Cancelamentos desfeitos" className="mt-0.5 grid gap-0.5">
                {reuniao.cancelamentosDesfeitos.map((c) => (
                  <li key={c.id}>
                    {`Cancelada por ${c.canceladaPorNome ?? "autor não identificado"} em ${formatDateTime(c.canceladaEm)}. Motivo: ${comPontoFinal(c.motivo ?? "sem motivo")} Desfeito por ${c.desfeitoPorNome ?? "autor não identificado"} em ${formatDateTime(c.desfeitoEm)}.`}
                  </li>
                ))}
              </ul>
            </details>
          )}
        </div>
        <div className="flex shrink-0 items-center gap-1">
          {!cancelada && (reuniao.oportunidadeId !== null || reuniao.clienteId !== null) && (
            <Button type="button" size="sm" variant="ghost" onClick={aoPreparar}>
              Preparar
            </Button>
          )}
          {!cancelada && podeEditar && (
            <Button
              type="button"
              size="sm"
              variant="ghost"
              disabled={formularioIndisponivel}
              onClick={aoEditar}
            >
              Editar
            </Button>
          )}
          {!cancelada && podeCancelar && (
            <AlertDialog onOpenChange={(aberto) => !aberto && setMotivo("")}>
              <AlertDialogTrigger asChild>
                <Button size="sm" variant="ghost" disabled={cancelando}>
                  Cancelar
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Cancelar "{reuniao.titulo}"?</AlertDialogTitle>
                  <AlertDialogDescription>
                    O motivo é obrigatório e fica registrado na reunião.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <div className="grid gap-1">
                  <Label htmlFor={motivoIdInput}>Motivo do cancelamento</Label>
                  <Textarea
                    id={motivoIdInput}
                    value={motivo}
                    onChange={(e) => setMotivo(e.target.value)}
                    className="min-h-16 text-xs"
                  />
                </div>
                <AlertDialogFooter>
                  <AlertDialogCancel>Voltar</AlertDialogCancel>
                  <AlertDialogAction
                    className={buttonVariants({ variant: "destructive" })}
                    disabled={motivo.trim() === ""}
                    onClick={() => aoCancelar(motivo.trim())}
                  >
                    Cancelar reunião
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          )}
          {cancelada && podeCancelar && (
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button type="button" size="sm" variant="ghost" disabled={desfazendo}>
                  Desfazer cancelamento
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>
                    Desfazer o cancelamento de "{reuniao.titulo}"?
                  </AlertDialogTitle>
                  <AlertDialogDescription>
                    Cancelada em {formatDateTime(canceladaEm)}. Motivo:{" "}
                    {comPontoFinal(reuniao.motivoDoCancelamento ?? "sem motivo")} A reunião volta à
                    agenda, e esse cancelamento fica no histórico dela.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Voltar</AlertDialogCancel>
                  <AlertDialogAction onClick={() => aoDesfazerCancelamento(canceladaEm)}>
                    Desfazer
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          )}
          {podeApagar && (
            <DialogoDeExclusao
              gatilho={
                <Button type="button" size="sm" variant="destructive" disabled={apagando}>
                  Apagar
                </Button>
              }
              titulo={`Apagar "${reuniao.titulo}"?`}
              pendente={apagando}
              onConfirmar={aoApagar}
            >
              <p>Apaga a reunião e a lista de participantes.</p>
              {!cancelada && <p>Para manter o registro de que ela não aconteceu, use Cancelar.</p>}
              <p>Não pode ser desfeito.</p>
            </DialogoDeExclusao>
          )}
        </div>
      </div>
    </Card>
  );
}
