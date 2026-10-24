import { useState } from "react";
import { AlertTriangle, Info } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { brl } from "@/shared/lib/format";
import { estadoDaConsulta } from "@/shared/ui/estado-da-consulta";
import { FalhaAoLer } from "@/shared/ui/falha-ao-ler";

import type {
  PadraoAGravar,
  PadraoDaLinhaDeNegocio,
  PessoaParaParticipacao,
} from "../api/shares.repository";
import { linhaDeNegocioLabel } from "../domain/contract";
import {
  problemaNoPercentualDoPadrao,
  recusaDoTetoDoPadrao,
  rotuloDoTipoDeParticipacao,
  type TipoDeParticipacao,
} from "../domain/shares";
import {
  useAdicionarPadrao,
  useAtualizarPadrao,
  useContratosSemParticipacao,
  useDesativarPadrao,
  usePessoasParaParticipacao,
  useTodosOsPadroes,
} from "../hooks/use-shares";
import { LimiarDeAlertaSettings } from "./limiar-de-alerta-settings";

type LinhaDePadrao = PadraoAGravar["linhaDeNegocio"];

const LINHAS: readonly LinhaDePadrao[] = ["demanda", "sistemas"];
const TIPOS: readonly TipoDeParticipacao[] = ["producao", "venda", "indicacao"];

type PadraoEditavel = PadraoDaLinhaDeNegocio & { readonly linhaDeNegocio: LinhaDePadrao };

function ehEditavel(padrao: PadraoDaLinhaDeNegocio): padrao is PadraoEditavel {
  return padrao.linhaDeNegocio !== "compartilhado";
}

function opcaoDe<T extends string>(opcoes: readonly T[], valor: string): T | undefined {
  return opcoes.find((opcao) => opcao === valor);
}

interface Rascunho {
  readonly linhaDeNegocio: LinhaDePadrao;
  readonly perfilId: string;
  readonly tipo: TipoDeParticipacao;
  readonly percentual: string;
}

const NOVO: Rascunho = {
  linhaDeNegocio: "sistemas",
  perfilId: "",
  tipo: "producao",
  percentual: "",
};

function comoListada(padrao: PadraoEditavel): PadraoAGravar {
  return {
    linhaDeNegocio: padrao.linhaDeNegocio,
    perfilId: padrao.perfilId,
    tipo: padrao.tipo,
    percentual: padrao.percentual,
  };
}

function rascunhoDe(padrao: PadraoEditavel): Rascunho {
  return { ...comoListada(padrao), percentual: String(padrao.percentual) };
}

function lerPadrao(r: Rascunho): PadraoAGravar | string {
  if (r.perfilId === "") return "Escolha a pessoa.";
  const percentual = Number(r.percentual);
  const problema = problemaNoPercentualDoPadrao(percentual);
  if (problema !== null) return problema;
  return { linhaDeNegocio: r.linhaDeNegocio, perfilId: r.perfilId, tipo: r.tipo, percentual };
}

interface RascunhoDaLinha {
  readonly base: PadraoAGravar;
  readonly campos: Rascunho;
}

const emPtBr = (percentual: number) =>
  percentual.toLocaleString("pt-BR", { maximumFractionDigits: 2 });

function AvisoDeTipoInerte() {
  return (
    <p className="text-[11px] text-warning">
      Só a produção nasce sozinha no contrato novo. Com outro tipo, este padrão fica guardado e não
      é aplicado a contrato nenhum.
    </p>
  );
}

function CamposDoPadrao({
  rotulo,
  valor,
  pessoas,
  beneficiarioAtual,
  desabilitado,
  aoMudar,
}: {
  rotulo: string;
  valor: Rascunho;
  pessoas: readonly PessoaParaParticipacao[];
  beneficiarioAtual: string | null;
  desabilitado: boolean;
  aoMudar: (parcial: Partial<Rascunho>) => void;
}) {
  const pessoaForaDaLista = valor.perfilId !== "" && !pessoas.some((p) => p.id === valor.perfilId);
  return (
    <>
      <Select
        value={valor.linhaDeNegocio}
        disabled={desabilitado}
        onValueChange={(v) => {
          const linha = opcaoDe(LINHAS, v);
          if (linha !== undefined) aoMudar({ linhaDeNegocio: linha });
        }}
      >
        <SelectTrigger className="h-8 w-32 text-xs" aria-label={`Linha de negócio ${rotulo}`}>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {LINHAS.map((l) => (
            <SelectItem key={l} value={l}>
              {linhaDeNegocioLabel(l)}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Select
        value={valor.perfilId}
        disabled={desabilitado}
        onValueChange={(v) => aoMudar({ perfilId: v })}
      >
        <SelectTrigger className="h-8 min-w-[10rem] text-xs" aria-label={`Pessoa ${rotulo}`}>
          <SelectValue placeholder="Quem recebe" />
        </SelectTrigger>
        <SelectContent>
          {pessoaForaDaLista && (
            <SelectItem value={valor.perfilId} disabled>
              {`${beneficiarioAtual ?? "Pessoa"} (desativada)`}
            </SelectItem>
          )}
          {pessoas.map((p) => (
            <SelectItem key={p.id} value={p.id} disabled={p.ativo === false}>
              {p.ativo === false ? `${p.nome} (desativada)` : p.nome}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Select
        value={valor.tipo}
        disabled={desabilitado}
        onValueChange={(v) => {
          const tipo = opcaoDe(TIPOS, v);
          if (tipo !== undefined) aoMudar({ tipo });
        }}
      >
        <SelectTrigger className="h-8 w-32 text-xs" aria-label={`Tipo ${rotulo}`}>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {TIPOS.map((t) => (
            <SelectItem key={t} value={t}>
              {rotuloDoTipoDeParticipacao(t)}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Input
        type="number"
        inputMode="decimal"
        min={0}
        max={100}
        step="0.01"
        aria-label={`Percentual ${rotulo}`}
        className="h-8 w-24 tabular-nums"
        value={valor.percentual}
        disabled={desabilitado}
        onChange={(e) => aoMudar({ percentual: e.target.value })}
      />
    </>
  );
}

export function DefaultSharesSettings() {
  const consultaDosPadroes = useTodosOsPadroes();
  const consultaDePessoas = usePessoasParaParticipacao();
  const estado = estadoDaConsulta(consultaDosPadroes);
  const estadoDePessoas = estadoDaConsulta(consultaDePessoas);
  const padroes = consultaDosPadroes.data ?? [];
  const editaveis = padroes.filter(ehEditavel);
  const pessoas = consultaDePessoas.data ?? [];
  const atualizar = useAtualizarPadrao();
  const adicionar = useAdicionarPadrao();
  const desativar = useDesativarPadrao();
  const [rascunho, setRascunho] = useState<Record<string, RascunhoDaLinha>>({});
  const [novo, setNovo] = useState<Rascunho | null>(null);
  const ocupado = atualizar.isPending || adicionar.isPending || desativar.isPending;
  const editavel = estado === "pronto" && estadoDePessoas === "pronto";

  function valorDe(padrao: PadraoEditavel): Rascunho {
    return rascunho[padrao.id]?.campos ?? rascunhoDe(padrao);
  }

  function mudar(padrao: PadraoEditavel, parcial: Partial<Rascunho>) {
    setRascunho((r) => {
      const atual = r[padrao.id] ?? { base: comoListada(padrao), campos: rascunhoDe(padrao) };
      return { ...r, [padrao.id]: { ...atual, campos: { ...atual.campos, ...parcial } } };
    });
  }

  function descartar(id: string) {
    setRascunho((r) => {
      const proximo = { ...r };
      delete proximo[id];
      return proximo;
    });
  }

  async function gravar(padrao: PadraoEditavel) {
    const editando = rascunho[padrao.id];
    if (editando === undefined) return;
    const lido = lerPadrao(editando.campos);
    if (typeof lido === "string") {
      toast.error(lido);
      return;
    }
    const teto = recusaDoTetoDoPadrao(padroes, { id: padrao.id, ...lido });
    if (teto !== null) {
      toast.error(teto);
      return;
    }
    try {
      await atualizar.mutateAsync({ id: padrao.id, anterior: editando.base, padrao: lido });
      descartar(padrao.id);
      toast.success("Padrão atualizado. Contratos já criados não mudaram.");
    } catch (erro) {
      toast.error(erro instanceof Error ? erro.message : "Não foi possível gravar.");
    }
  }

  async function tirar(padrao: PadraoEditavel) {
    try {
      await desativar.mutateAsync(padrao.id);
      descartar(padrao.id);
      toast.success(
        `Participação padrão desativada: ${padrao.beneficiario}, ${linhaDeNegocioLabel(padrao.linhaDeNegocio)}, ${rotuloDoTipoDeParticipacao(padrao.tipo)}, ${emPtBr(padrao.percentual)}%.`,
      );
    } catch (erro) {
      toast.error(erro instanceof Error ? erro.message : "Não foi possível desativar.");
    }
  }

  async function incluir() {
    if (novo === null) return;
    const lido = lerPadrao(novo);
    if (typeof lido === "string") {
      toast.error(lido);
      return;
    }
    const teto = recusaDoTetoDoPadrao(padroes, { id: null, ...lido });
    if (teto !== null) {
      toast.error(teto);
      return;
    }
    try {
      await adicionar.mutateAsync(lido);
      setNovo(null);
      toast.success("Padrão adicionado. Vale para os contratos criados daqui em diante.");
    } catch (erro) {
      toast.error(erro instanceof Error ? erro.message : "Não foi possível adicionar.");
    }
  }

  return (
    <Card className="space-y-4 p-6 shadow-card">
      <header>
        <h2 className="text-sm font-semibold">Participação padrão por linha de negócio</h2>
        <p className="mt-1 text-xs text-muted-foreground">
          Ao criar um contrato na linha de negócio configurada, a participação de produção nasce
          automaticamente com este percentual.
        </p>
      </header>

      <p className="flex items-start gap-1.5 rounded-md border border-primary/30 bg-primary/5 px-3 py-2 text-[11px]">
        <Info className="mt-px h-3.5 w-3.5 shrink-0 text-primary-texto" aria-hidden />
        <span>
          Alterar aqui <strong>não</strong> mexe em contratos já criados. Cada contrato preserva o
          percentual vigente quando foi assinado. É o que impede reescrever o passado.
        </span>
      </p>

      {estado === "erro" && <FalhaAoLer oQue="as participações padrão por linha de negócio" />}
      {estado === "pronto" && estadoDePessoas === "erro" && (
        <FalhaAoLer oQue="as pessoas do time" />
      )}

      {(estado === "carregando" || (estado === "pronto" && estadoDePessoas === "carregando")) && (
        <div className="h-20 animate-pulse rounded-md border bg-card" aria-label="Carregando" />
      )}

      {estado === "pronto" && padroes.length === 0 && (
        <p className="rounded-md border border-dashed px-3 py-4 text-center text-xs text-muted-foreground">
          Nenhuma participação padrão configurada.
        </p>
      )}

      {editavel &&
        editaveis.map((padrao) => {
          const valor = valorDe(padrao);
          const rotulo = `de ${padrao.beneficiario} em ${linhaDeNegocioLabel(padrao.linhaDeNegocio)}`;
          return (
            <div key={padrao.id} className="grid gap-2 rounded-md border p-3">
              <div className="flex flex-wrap items-end gap-2">
                <CamposDoPadrao
                  rotulo={rotulo}
                  valor={valor}
                  pessoas={pessoas}
                  beneficiarioAtual={padrao.beneficiario}
                  desabilitado={ocupado}
                  aoMudar={(parcial) => mudar(padrao, parcial)}
                />
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  disabled={rascunho[padrao.id] === undefined || ocupado}
                  onClick={() => void gravar(padrao)}
                >
                  Gravar
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  disabled={ocupado}
                  onClick={() => void tirar(padrao)}
                >
                  Desativar
                </Button>
              </div>
              {valor.tipo !== "producao" && <AvisoDeTipoInerte />}
            </div>
          );
        })}

      {editavel &&
        (novo === null ? (
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={ocupado}
            onClick={() => setNovo(NOVO)}
          >
            Adicionar participação padrão
          </Button>
        ) : (
          <div className="grid gap-2 rounded-md border border-dashed p-3">
            <div className="flex flex-wrap items-end gap-2">
              <CamposDoPadrao
                rotulo="do novo padrão"
                valor={novo}
                pessoas={pessoas}
                beneficiarioAtual={null}
                desabilitado={ocupado}
                aoMudar={(parcial) =>
                  setNovo((atual) => (atual === null ? atual : { ...atual, ...parcial }))
                }
              />
              <Button type="button" size="sm" disabled={ocupado} onClick={() => void incluir()}>
                Adicionar
              </Button>
              <Button
                type="button"
                size="sm"
                variant="ghost"
                disabled={ocupado}
                onClick={() => setNovo(null)}
              >
                Cancelar
              </Button>
            </div>
            {novo.tipo !== "producao" && <AvisoDeTipoInerte />}
          </div>
        ))}

      {estado === "pronto" && !padroes.some((p) => p.linhaDeNegocio === "demanda") && (
        <p className="text-[11px] text-muted-foreground">
          Demanda não tem participação padrão (D-004): a equipe de lá é remunerada por salário fixo.
          Adicionar uma aqui muda essa decisão: todo contrato novo comissionável de Demanda passaria
          a herdá-la.
        </p>
      )}

      <LimiarDeAlertaSettings />
      <BackfillDeParticipacoes />
    </Card>
  );
}

function BackfillDeParticipacoes() {
  const consulta = useContratosSemParticipacao();
  const estado = estadoDaConsulta(consulta);
  const contratos = consulta.data?.contratos ?? [];
  const truncado = consulta.data?.truncado ?? false;

  if (estado === "carregando") return null;

  return (
    <section className="grid gap-2 border-t pt-4">
      <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        Contratos ativos sem participação
      </h3>

      {estado === "erro" ? (
        <FalhaAoLer oQue="os contratos ativos sem participação" />
      ) : contratos.length === 0 ? (
        <p className="text-[11px] text-muted-foreground">
          Nenhum. Todo contrato ativo tem ao menos uma participação registrada.
        </p>
      ) : (
        <>
          <p className="text-[11px] text-muted-foreground">
            Abra cada contrato e decida. Nada é criado automaticamente aqui: participação retroativa
            é decisão sua, não consequência de uma varredura.
          </p>
          <ul className="grid gap-1">
            {contratos.map((c) => (
              <li
                key={c.id}
                className="flex items-center justify-between rounded-md border px-3 py-1.5 text-[11px]"
              >
                <span>
                  {c.cliente} · {c.nome}
                  <span className="ml-1.5 text-muted-foreground">
                    {linhaDeNegocioLabel(c.linhaDeNegocio)}
                  </span>
                </span>
                <span className="tabular-nums text-muted-foreground">
                  {c.tipo === "mrr" ? `${brl(c.valorMensal)}/mês` : brl(c.valorTotal)}
                </span>
              </li>
            ))}
          </ul>
        </>
      )}

      {truncado && (
        <p className="flex items-start gap-1.5 text-[11px] text-amber-400">
          <AlertTriangle className="mt-px h-3.5 w-3.5 shrink-0" aria-hidden />A varredura olhou os
          200 contratos ativos mais recentes. Pode haver mais fora desta lista.
        </p>
      )}
    </section>
  );
}
