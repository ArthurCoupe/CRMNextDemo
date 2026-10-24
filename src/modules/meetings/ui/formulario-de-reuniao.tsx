import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useProfile } from "@/hooks/use-profile";
import { dataEHoraSP } from "@/shared/lib/date";

import type { AlteracaoDeReuniao, DadosDeReuniao, Reuniao } from "../api/meetings.repository";
import {
  DURACAO_MAXIMA_MINUTOS,
  duracaoValida,
  ehDataCivilPlausivel,
  paraInstante,
  ReuniaoCriadaSemParticipantes,
  rotuloDoTipo,
  TIPOS_POR_GRUPO,
  vinculoExigido,
  type TipoDeReuniao,
} from "../domain/meeting";
import { useAtualizarReuniao, useCriarReuniao, useConflitos } from "../hooks/use-meetings";
import { CampoDeOportunidade } from "./campo-de-oportunidade";

interface PessoaParaSelecao {
  readonly id: string;
  readonly nome: string;
}

interface FormularioDeReuniaoProps {
  readonly aberto: boolean;
  readonly reuniao: Reuniao | null;
  readonly aoFechar: () => void;
  readonly clientes: readonly PessoaParaSelecao[];
  readonly pessoas: readonly PessoaParaSelecao[];
  readonly janela: { readonly desde: string; readonly ate: string };
}

interface Rascunho {
  titulo: string;
  tipo: TipoDeReuniao;
  data: string;
  hora: string;
  duracaoMinutos: number;
  clienteId: string;
  oportunidadeId: string;
  oportunidadeNome: string;
  local: string;
  notas: string;
  participantes: string[];
  organizadorId: string;
}

const TIPO_PADRAO = TIPOS_POR_GRUPO[0].tipos[0];

function rascunhoVazio(): Rascunho {
  return {
    titulo: "",
    tipo: TIPO_PADRAO,
    data: "",
    hora: "",
    duracaoMinutos: 60,
    clienteId: "",
    oportunidadeId: "",
    oportunidadeNome: "",
    local: "",
    notas: "",
    participantes: [],
    organizadorId: "",
  };
}

function rascunhoDe(reuniao: Reuniao): Rascunho {
  const { data, hora } = dataEHoraSP(reuniao.startsAt);
  return {
    titulo: reuniao.titulo,
    tipo: reuniao.tipo,
    data,
    hora,
    duracaoMinutos: reuniao.duracaoMinutos,
    clienteId: reuniao.clienteId ?? "",
    oportunidadeId: reuniao.oportunidadeId ?? "",
    oportunidadeNome: reuniao.oportunidadeNome ?? "",
    local: reuniao.local ?? "",
    notas: reuniao.notas ?? "",
    participantes: reuniao.participantes.map((p) => p.id),
    organizadorId: reuniao.organizadorId,
  };
}

function payloadDe(rascunho: Rascunho): DadosDeReuniao | null {
  if (rascunho.titulo.trim() === "") return null;

  const vinculo = vinculoExigido(rascunho.tipo);
  if (vinculo === "cliente" && rascunho.clienteId === "") return null;
  if (vinculo === "oportunidade" && rascunho.oportunidadeId === "") return null;
  if (!duracaoValida(rascunho.duracaoMinutos)) return null;

  let startsAt: string;
  try {
    startsAt = paraInstante(rascunho.data, rascunho.hora);
  } catch {
    return null;
  }

  return {
    titulo: rascunho.titulo.trim(),
    tipo: rascunho.tipo,
    startsAt,
    duracaoMinutos: rascunho.duracaoMinutos,
    clienteId: vinculo === "cliente" ? rascunho.clienteId : null,
    oportunidadeId: vinculo === "oportunidade" ? rascunho.oportunidadeId : null,
    local: rascunho.local.trim() === "" ? null : rascunho.local.trim(),
    notas: rascunho.notas.trim() === "" ? null : rascunho.notas.trim(),
    participantes: rascunho.participantes,
  };
}

export function FormularioDeReuniao({
  aberto,
  reuniao,
  aoFechar,
  clientes,
  pessoas,
  janela,
}: FormularioDeReuniaoProps) {
  const [rascunho, setRascunho] = useState<Rascunho>(() =>
    reuniao === null ? rascunhoVazio() : rascunhoDe(reuniao),
  );
  const [ultimaAbertura, setUltimaAbertura] = useState<string | null>(null);

  const chaveDeAbertura = aberto ? (reuniao?.id ?? "nova") : null;
  if (chaveDeAbertura !== ultimaAbertura) {
    setUltimaAbertura(chaveDeAbertura);
    if (chaveDeAbertura !== null) {
      setRascunho(reuniao === null ? rascunhoVazio() : rascunhoDe(reuniao));
    }
  }

  const { meuId, papel } = useProfile();
  const podeTrocarOrganizador = papel === "owner" || papel === "manager";
  const criar = useCriarReuniao();
  const atualizar = useAtualizarReuniao();

  const inicioParaConsulta = (() => {
    if (rascunho.data === "" || rascunho.hora === "") return "";
    try {
      return paraInstante(rascunho.data, rascunho.hora);
    } catch {
      return "";
    }
  })();
  const donoDaAgenda =
    reuniao === null
      ? meuId
      : rascunho.organizadorId !== ""
        ? rascunho.organizadorId
        : reuniao.organizadorId;
  const idsParaConflito = Array.from(
    new Set(
      donoDaAgenda === null ? rascunho.participantes : [...rascunho.participantes, donoDaAgenda],
    ),
  );

  const conflitos = useConflitos(
    idsParaConflito,
    inicioParaConsulta,
    rascunho.duracaoMinutos,
    reuniao?.id ?? null,
  );
  const nomesEmConflito = (conflitos.data ?? [])
    .map((id) => {
      if (id === meuId) return "você";
      const nome = pessoas.find((p) => p.id === id)?.nome ?? id;
      return id === donoDaAgenda ? `${nome} (organizador)` : nome;
    })
    .join(", ");

  const foraDoPeriodo =
    ehDataCivilPlausivel(rascunho.data) &&
    (rascunho.data < janela.desde || rascunho.data > janela.ate);

  const vinculo = vinculoExigido(rascunho.tipo);

  const editar = <C extends keyof Rascunho>(campo: C, valor: Rascunho[C]) =>
    setRascunho((atual) => ({ ...atual, [campo]: valor }));

  function mudarTipo(novoTipo: TipoDeReuniao) {
    setRascunho((atual) => {
      const novoVinculo = vinculoExigido(novoTipo);
      return {
        ...atual,
        tipo: novoTipo,
        clienteId: novoVinculo === "cliente" ? atual.clienteId : "",
        oportunidadeId: novoVinculo === "oportunidade" ? atual.oportunidadeId : "",
        oportunidadeNome: novoVinculo === "oportunidade" ? atual.oportunidadeNome : "",
      };
    });
  }

  function alternarParticipante(id: string, marcado: boolean) {
    setRascunho((atual) => ({
      ...atual,
      participantes: marcado
        ? [...atual.participantes, id]
        : atual.participantes.filter((p) => p !== id),
    }));
  }

  const salvando = criar.isPending || atualizar.isPending;
  const payload = payloadDe(rascunho);

  function salvar() {
    if (payload === null) return;
    if (reuniao === null) {
      criar.mutate(payload, {
        onSuccess: aoFechar,
        onError: (erro) => {
          if (erro instanceof ReuniaoCriadaSemParticipantes) aoFechar();
        },
      });
    } else {
      const trocouOrganizador =
        rascunho.organizadorId !== "" && rascunho.organizadorId !== reuniao.organizadorId;
      const dados: AlteracaoDeReuniao = trocouOrganizador
        ? { ...payload, organizadorId: rascunho.organizadorId }
        : payload;
      atualizar.mutate({ id: reuniao.id, dados }, { onSuccess: aoFechar });
    }
  }

  return (
    <Dialog open={aberto} onOpenChange={(v) => !v && aoFechar()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{reuniao === null ? "Nova reunião" : "Editar reunião"}</DialogTitle>
        </DialogHeader>

        <div className="space-y-3">
          <div>
            <Label htmlFor="reuniao-titulo">Título</Label>
            <Input
              id="reuniao-titulo"
              value={rascunho.titulo}
              onChange={(e) => editar("titulo", e.target.value)}
            />
          </div>

          <div>
            <Label htmlFor="reuniao-tipo">Tipo</Label>
            <select
              id="reuniao-tipo"
              className="mt-1 h-9 w-full rounded-md border bg-background px-2 text-sm"
              value={rascunho.tipo}
              onChange={(e) => mudarTipo(e.target.value as TipoDeReuniao)}
            >
              {TIPOS_POR_GRUPO.map(({ grupo, tipos }) => (
                <optgroup key={grupo} label={grupo}>
                  {tipos.map((tipo) => (
                    <option key={tipo} value={tipo}>
                      {rotuloDoTipo(tipo)}
                    </option>
                  ))}
                </optgroup>
              ))}
            </select>
          </div>

          {vinculo === "cliente" && (
            <div>
              <Label htmlFor="reuniao-cliente">Cliente</Label>
              <select
                id="reuniao-cliente"
                className="mt-1 h-9 w-full rounded-md border bg-background px-2 text-sm"
                value={rascunho.clienteId}
                onChange={(e) => editar("clienteId", e.target.value)}
              >
                <option value="">Escolha…</option>
                {clientes.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.nome}
                  </option>
                ))}
              </select>
            </div>
          )}

          {vinculo === "oportunidade" && (
            <CampoDeOportunidade
              escolhida={
                rascunho.oportunidadeId === ""
                  ? null
                  : {
                      id: rascunho.oportunidadeId,
                      nome: rascunho.oportunidadeNome || "Oportunidade vinculada",
                    }
              }
              aoEscolher={(o) =>
                setRascunho((atual) => ({
                  ...atual,
                  oportunidadeId: o?.id ?? "",
                  oportunidadeNome: o?.nome ?? "",
                }))
              }
            />
          )}

          <div className="grid grid-cols-3 gap-3">
            <div>
              <Label htmlFor="reuniao-data">Data</Label>
              <Input
                id="reuniao-data"
                type="date"
                className="mt-1"
                value={rascunho.data}
                onChange={(e) => editar("data", e.target.value)}
              />
            </div>

            <div>
              <Label htmlFor="reuniao-hora">Hora</Label>
              <Input
                id="reuniao-hora"
                type="time"
                className="mt-1"
                value={rascunho.hora}
                onChange={(e) => editar("hora", e.target.value)}
              />
            </div>

            <div>
              <Label htmlFor="reuniao-duracao">Duração (min)</Label>
              <Input
                id="reuniao-duracao"
                type="number"
                min={5}
                max={DURACAO_MAXIMA_MINUTOS}
                className="mt-1"
                value={rascunho.duracaoMinutos}
                onChange={(e) => editar("duracaoMinutos", Number(e.target.value))}
              />
            </div>
          </div>

          {foraDoPeriodo && (
            <p role="status" className="text-[11px] text-warning">
              Fora do período exibido: a reunião será {reuniao === null ? "criada" : "salva"}, mas
              só aparece ao mudar o período.
            </p>
          )}

          <div>
            <Label htmlFor="reuniao-local">Local</Label>
            <Input
              id="reuniao-local"
              className="mt-1"
              value={rascunho.local}
              onChange={(e) => editar("local", e.target.value)}
              placeholder="Sala, endereço ou link"
            />
          </div>

          <div>
            <Label htmlFor="reuniao-notas">Notas</Label>
            <Textarea
              id="reuniao-notas"
              rows={3}
              value={rascunho.notas}
              onChange={(e) => editar("notas", e.target.value)}
            />
          </div>

          {reuniao !== null && podeTrocarOrganizador && (
            <div>
              <Label htmlFor="reuniao-organizador">Organizador</Label>
              <select
                id="reuniao-organizador"
                className="mt-1 h-9 w-full rounded-md border bg-background px-2 text-sm"
                value={rascunho.organizadorId}
                aria-describedby="reuniao-organizador-ajuda"
                onChange={(e) => editar("organizadorId", e.target.value)}
              >
                {!pessoas.some((p) => p.id === reuniao.organizadorId) && (
                  <option value={reuniao.organizadorId}>Organizador atual</option>
                )}
                {pessoas.map((pessoa) => (
                  <option key={pessoa.id} value={pessoa.id}>
                    {pessoa.nome}
                  </option>
                ))}
              </select>
              <p id="reuniao-organizador-ajuda" className="mt-1 text-xs text-muted-foreground">
                Quem deixa de organizar só continua vendo a reunião se for participante.
              </p>
            </div>
          )}

          <div>
            <Label>Participantes</Label>
            <div className="mt-1 space-y-2">
              {pessoas.map((pessoa) => (
                <div key={pessoa.id} className="flex items-center gap-2">
                  <Checkbox
                    id={`reuniao-participante-${pessoa.id}`}
                    checked={rascunho.participantes.includes(pessoa.id)}
                    onCheckedChange={(marcado) => alternarParticipante(pessoa.id, marcado === true)}
                  />
                  <Label htmlFor={`reuniao-participante-${pessoa.id}`} className="font-normal">
                    {pessoa.nome}
                  </Label>
                </div>
              ))}
            </div>

            {nomesEmConflito !== "" && (
              <p className="mt-2 text-[11px] text-warning">
                Conflito de horário: {nomesEmConflito} já tem outra reunião nesse período.
              </p>
            )}
            {conflitos.isError && (
              <p className="mt-2 text-[11px] text-destructive">
                Não deu para checar conflitos de horário. Dá para salvar mesmo assim.
              </p>
            )}
          </div>
        </div>

        <div className="mt-4 flex justify-end gap-2">
          <Button type="button" variant="ghost" onClick={aoFechar} disabled={salvando}>
            Cancelar
          </Button>
          <Button type="button" onClick={salvar} disabled={payload === null || salvando}>
            {salvando ? "Salvando…" : "Salvar"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
