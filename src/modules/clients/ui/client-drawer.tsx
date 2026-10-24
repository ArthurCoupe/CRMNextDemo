import { useState } from "react";
import { ExternalLink, ShieldAlert } from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { brl } from "@/shared/lib/format";
import { ehDataCivilPlausivel, formatDate, formatDateTime, todaySP } from "@/shared/lib/date";
import { CampoEditavel } from "@/shared/ui/campo-editavel";
import { DialogoDeExclusao } from "@/shared/ui/dialogo-de-exclusao";
import { estadoDaConsulta } from "@/shared/ui/estado-da-consulta";
import { FalhaAoLer } from "@/shared/ui/falha-ao-ler";
import { cn } from "@/lib/utils";

import { contractStatusLabel } from "@/modules/contracts/domain/contract";
import { useEventos } from "@/modules/pipeline/hooks/use-pipeline";
import { LIMITE_DE_EVENTOS } from "@/modules/pipeline/domain/limites";
import { ListaDeEventos } from "@/modules/pipeline/ui/timeline-events";
import { ContratosDaPropostaACriar } from "@/modules/proposals/ui/contratos-da-proposta-a-criar";

import type {
  ClienteListado,
  ContratoDoCliente,
  CorrecaoDeData,
  DadosEditaveisDoCliente,
} from "../api/clients.repository";
import {
  podeLerContratosDoCliente,
  podeTrocarResponsavel,
  type ContextoDeAcesso,
} from "../domain/access";
import { validarDataDoStatus } from "../domain/data-do-status";
import { extrairIdDaPasta } from "../domain/drive";
import {
  avaliarSaude,
  clientStatusLabel,
  montarEntradaDeSaude,
  saudeEhParcial,
  type StatusDeCliente,
} from "../domain/health";
import {
  useApagarCliente,
  useAtualizarDadosDoCliente,
  useCorrecoesDeData,
  useCorrigirDataDoStatus,
  useDefinirAssinatura,
  useDefinirConfidencialidade,
  useDefinirPastaDoDrive,
  useDefinirResponsavel,
  useDefinirStatusDoCliente,
  useResponsaveisPossiveis,
} from "../hooks/use-clients";
import { ListaDeSinais } from "./client-health";

const COR_DO_STATUS: Record<StatusDeCliente, string> = {
  active: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30",
  onboarding: "bg-sky-500/15 text-sky-400 border-sky-500/30",
  paused: "bg-amber-500/15 text-amber-500 border-amber-500/30",
  churned: "bg-muted text-muted-foreground",
};

const OPCOES_DE_STATUS: readonly StatusDeCliente[] = ["onboarding", "active", "paused", "churned"];

const COR_DO_STATUS_DE_CONTRATO: Record<ContratoDoCliente["status"], string | null> = {
  active: null,
  paused: "bg-amber-500/15 text-amber-400 border-amber-500/30",
  finished: "bg-slate-500/15 text-slate-400 border-slate-500/30",
  cancelled: "bg-red-500/15 text-red-400 border-red-500/30",
};

interface ClientDrawerProps {
  cliente: ClienteListado | null;
  contexto: ContextoDeAcesso;
  aoFechar: () => void;
}

export function ClientDrawer({ cliente, contexto, aoFechar }: ClientDrawerProps) {
  return (
    <Dialog open={cliente !== null} onOpenChange={(aberto) => !aberto && aoFechar()}>
      <DialogContent
        className="max-h-[90vh] max-w-2xl overflow-y-auto"
        onOpenAutoFocus={(evento) => {
          evento.preventDefault();
          (evento.currentTarget as HTMLElement | null)?.focus();
        }}
        onEscapeKeyDown={() => {
          if (document.activeElement instanceof HTMLElement) document.activeElement.blur();
        }}
      >
        {cliente !== null && <Conteudo key={cliente.id} cliente={cliente} contexto={contexto} />}
      </DialogContent>
    </Dialog>
  );
}

function Linha({ rotulo, valor }: { rotulo: string; valor: string | null }) {
  if (valor === null || valor === "") return null;
  return (
    <div className="flex justify-between gap-3 text-xs">
      <span className="text-muted-foreground">{rotulo}</span>
      <span className="text-right font-medium">{valor}</span>
    </div>
  );
}

function Secao({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <section className="grid gap-2 rounded-lg border p-3">
      <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        {titulo}
      </h3>
      {children}
    </section>
  );
}

function fraseDaCorrecao(c: CorrecaoDeData): string {
  const rotulo = c.campo === "paused_at" ? "Data de pausa" : "Data de encerramento";
  const mudanca =
    c.antes !== null
      ? `corrigida de ${formatDate(c.antes)} para ${formatDate(c.depois)}`
      : `definida como ${formatDate(c.depois)} (antes sem data)`;
  return `${rotulo} ${mudanca}, por ${c.autorNome ?? "autor não identificado"} em ${formatDateTime(c.corrigidoEm)}.`;
}

function Conteudo({ cliente, contexto }: { cliente: ClienteListado; contexto: ContextoDeAcesso }) {
  const definir = useDefinirResponsavel();
  const atualizarDados = useAtualizarDadosDoCliente();
  const definirStatus = useDefinirStatusDoCliente();
  const definirAssinaturaMut = useDefinirAssinatura();
  const apagar = useApagarCliente();
  const permissaoDeTroca = podeTrocarResponsavel(contexto, cliente.responsavelId);
  const podeEditarDados = permissaoDeTroca.permitido;
  const leContratos = podeLerContratosDoCliente(contexto, cliente.responsavelId);
  const souOwner = contexto.papel === "owner";

  const corrigirData = useCorrigirDataDoStatus();
  const correcoes = useCorrecoesDeData(cliente.id);

  const [rejeicoes, setRejeicoes] = useState(0);
  const voltarAoValorDoBanco = () => setRejeicoes((n) => n + 1);

  function gravarDataDoStatus(campo: "paused_at" | "churned_at", valor: string) {
    const erro = validarDataDoStatus(valor, todaySP());
    if (erro !== null) {
      toast.error(erro);
      voltarAoValorDoBanco();
      return;
    }
    corrigirData.mutate({ id: cliente.id, campo, data: valor }, { onError: voltarAoValorDoBanco });
  }

  function gravarCampo(campo: keyof DadosEditaveisDoCliente, valorDoInput: string) {
    atualizarDados.mutate({
      id: cliente.id,
      campos: { [campo]: valorDoInput } as DadosEditaveisDoCliente,
    });
  }

  const consultaDeResponsaveis = useResponsaveisPossiveis(
    permissaoDeTroca.permitido ? cliente.responsavelId : null,
  );
  const responsaveis = consultaDeResponsaveis.data ?? [];

  const estadoDosResponsaveis = estadoDaConsulta(consultaDeResponsaveis);

  const entrada = montarEntradaDeSaude({
    status: cliente.status,
    ultimoEventoEm: cliente.ultimoEventoEm,
    proximoFimDeCobranca: cliente.proximoFimDeCobranca,
    assinadoEm: cliente.assinadoEm,
    criadoEm: cliente.criadoEm,
    pausadoEm: cliente.pausadoEm,
    responsavelId: cliente.responsavelId,
    cobrancaVisivel: leContratos,
    contratosAtivosVisiveis: cliente.contratosAtivosVisiveis,
  });
  const sinais = avaliarSaude(entrada);

  function trocarResponsavel(valor: string) {
    definir.mutate({
      clienteId: cliente.id,
      responsavelId: valor === "sem-responsavel" ? null : valor,
    });
  }

  function mudarStatus(valor: string) {
    definirStatus.mutate({ id: cliente.id, status: valor as StatusDeCliente });
  }

  return (
    <>
      <DialogHeader>
        <DialogTitle className="flex flex-wrap items-center gap-2">
          {cliente.nome}
          <Badge className={COR_DO_STATUS[cliente.status]}>
            {clientStatusLabel(cliente.status)}
          </Badge>
          {cliente.confidencial && (
            <Badge variant="warning" className="gap-1">
              <ShieldAlert className="h-3 w-3" aria-hidden /> Confidencial
            </Badge>
          )}
        </DialogTitle>
      </DialogHeader>

      <div className="grid gap-5">
        <Secao titulo="Saúde">
          <ListaDeSinais sinais={sinais} entrada={entrada} parcial={saudeEhParcial(entrada)} />
        </Secao>

        <section className="grid gap-1.5 rounded-lg border p-3">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Dados e contato
          </h3>
          <CampoEditavel
            id="cliente-nome"
            rotulo="Nome"
            valor={cliente.nome}
            disabled={!podeEditarDados}
            onGravar={(valorDoInput) => gravarCampo("nome", valorDoInput)}
          />
          <CampoEditavel
            id="cliente-segmento"
            rotulo="Segmento"
            valor={cliente.segmento}
            disabled={!podeEditarDados}
            onGravar={(valorDoInput) => gravarCampo("segmento", valorDoInput)}
          />
          <CampoEditavel
            id="cliente-nicho"
            rotulo="Nicho"
            valor={cliente.nicho}
            disabled={!podeEditarDados}
            onGravar={(valorDoInput) => gravarCampo("nicho", valorDoInput)}
          />
          <CampoEditavel
            id="cliente-contato-nome"
            rotulo="Contato"
            valor={cliente.contatoNome}
            disabled={!podeEditarDados}
            onGravar={(valorDoInput) => gravarCampo("contatoNome", valorDoInput)}
          />
          <CampoEditavel
            id="cliente-contato-email"
            rotulo="E-mail"
            valor={cliente.contatoEmail}
            disabled={!podeEditarDados}
            onGravar={(valorDoInput) => gravarCampo("contatoEmail", valorDoInput)}
          />
          <CampoEditavel
            id="cliente-contato-telefone"
            rotulo="Telefone"
            valor={cliente.contatoTelefone}
            disabled={!podeEditarDados}
            onGravar={(valorDoInput) => gravarCampo("contatoTelefone", valorDoInput)}
          />
          {podeEditarDados ? (
            <CampoEditavel
              id="cliente-assinado-em"
              rotulo="Assinado em"
              type="date"
              valor={cliente.assinadoEm}
              disabled={definirAssinaturaMut.isPending}
              onGravar={(valorDoInput) => {
                if (valorDoInput !== "" && !ehDataCivilPlausivel(valorDoInput)) {
                  toast.error("Data de assinatura inválida. Use um ano entre 2000 e 2100.");
                  return;
                }
                definirAssinaturaMut.mutate({
                  id: cliente.id,
                  data: valorDoInput === "" ? null : valorDoInput,
                });
              }}
            />
          ) : (
            <Linha
              rotulo="Assinado em"
              valor={cliente.assinadoEm !== null ? formatDate(cliente.assinadoEm) : null}
            />
          )}
          {souOwner && cliente.status === "paused" ? (
            <CampoEditavel
              key={`${cliente.pausadoEm ?? ""}-${rejeicoes}`}
              id="cliente-pausado-em"
              rotulo="Pausado em"
              type="date"
              valor={cliente.pausadoEm}
              disabled={corrigirData.isPending}
              onGravar={(valorDoInput) => gravarDataDoStatus("paused_at", valorDoInput)}
            />
          ) : (
            <Linha
              rotulo="Pausado em"
              valor={cliente.pausadoEm !== null ? formatDate(cliente.pausadoEm) : null}
            />
          )}
          {souOwner && cliente.status === "churned" ? (
            <CampoEditavel
              key={`${cliente.encerradoEm ?? ""}-${rejeicoes}`}
              id="cliente-encerrado-em"
              rotulo="Encerrado em"
              type="date"
              valor={cliente.encerradoEm}
              disabled={corrigirData.isPending}
              onGravar={(valorDoInput) => gravarDataDoStatus("churned_at", valorDoInput)}
            />
          ) : (
            <Linha
              rotulo="Encerrado em"
              valor={cliente.encerradoEm !== null ? formatDate(cliente.encerradoEm) : null}
            />
          )}
          {correcoes.isError && (
            <p className="text-[11px] text-destructive">
              Não foi possível ler o histórico de correções de data.
            </p>
          )}
          {(correcoes.data ?? []).length > 0 && (
            <ul
              aria-label="Correções de data"
              className="grid gap-0.5 text-[11px] text-muted-foreground"
            >
              {(correcoes.data ?? []).map((c) => (
                <li key={c.id}>{fraseDaCorrecao(c)}</li>
              ))}
            </ul>
          )}
          <Linha
            rotulo="Último evento"
            valor={cliente.ultimoEventoEm !== null ? formatDateTime(cliente.ultimoEventoEm) : null}
          />
          <div className="mt-1">
            <CampoDaPastaDoDrive cliente={cliente} podeEditar={permissaoDeTroca.permitido} />
          </div>
        </section>

        {podeEditarDados && (
          <Secao titulo="Status">
            <Select
              value={cliente.status}
              onValueChange={mudarStatus}
              disabled={definirStatus.isPending}
            >
              <SelectTrigger className="h-8 w-[160px] text-xs" aria-label="Status">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {OPCOES_DE_STATUS.map((status) => (
                  <SelectItem key={status} value={status}>
                    {clientStatusLabel(status)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Secao>
        )}

        <SecaoDeConfidencialidade cliente={cliente} podeEditar={permissaoDeTroca.permitido} />

        <Secao titulo="Responsável">
          {permissaoDeTroca.permitido ? (
            <>
              {estadoDosResponsaveis === "erro" && (
                <FalhaAoLer
                  oQue="a lista de quem pode ser responsável"
                  mensagem="Recarregue a página e tente de novo."
                />
              )}
              <Select
                value={cliente.responsavelId ?? "sem-responsavel"}
                onValueChange={trocarResponsavel}
                disabled={definir.isPending || estadoDosResponsaveis !== "pronto"}
              >
                <SelectTrigger className="h-8 text-xs" aria-label="Responsável">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="sem-responsavel">Sem responsável</SelectItem>
                  {responsaveis.map((responsavel) => (
                    <SelectItem
                      key={responsavel.id}
                      value={responsavel.id}
                      disabled={!responsavel.ativo}
                    >
                      {responsavel.ativo ? responsavel.nome : `${responsavel.nome} (desativada)`}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </>
          ) : (
            <>
              <p className="text-xs">{cliente.responsavelNome ?? "Sem responsável"}</p>
              <p className="text-[11px] text-muted-foreground">{permissaoDeTroca.motivo}</p>
            </>
          )}
        </Secao>

        {leContratos ? (
          <Secao titulo="Contratos">
            {cliente.contratos.length === 0 ? (
              <p className="text-xs text-muted-foreground">
                Este cliente não tem contrato cadastrado.
              </p>
            ) : (
              <ul className="grid gap-2">
                {cliente.contratos.map((contrato) => (
                  <ItemDeContrato key={contrato.id} contrato={contrato} />
                ))}
              </ul>
            )}
          </Secao>
        ) : (
          <Secao titulo="Contratos">
            <p className="text-xs text-muted-foreground">
              Você não tem permissão para ver os contratos deste cliente. Isso não significa que não
              existam.
            </p>
          </Secao>
        )}

        {souOwner && (
          <ContratosDaPropostaACriar
            clienteId={cliente.id}
            clienteNome={cliente.nome}
            vendas={cliente.vendasDeOrigem}
          />
        )}

        {cliente.vendasDeOrigem.length > 0 && (
          <Secao titulo="Vendas de origem">
            <div className="grid gap-4">
              {cliente.vendasDeOrigem.map((venda) => (
                <div key={venda.id} className="grid gap-1.5">
                  <p className="text-xs font-medium">{venda.nome}</p>
                  <TimelineDeOrigem oportunidadeId={venda.id} />
                </div>
              ))}
            </div>
          </Secao>
        )}

        {souOwner && (
          <div className="border-t pt-4">
            <DialogoDeExclusao
              gatilho={
                <Button type="button" variant="destructive" size="sm">
                  Apagar cliente
                </Button>
              }
              titulo={`Apagar "${cliente.nome}"?`}
              confirmarDigitando={cliente.nome}
              pendente={apagar.isPending}
              onConfirmar={() => apagar.mutate(cliente.id)}
            >
              <p>
                Apaga o cliente junto com os contratos dele (itens, participações e encerramentos
                automáticos), a jornada de onboarding com os cartões dela, os posts de conteúdo e as
                reuniões de cliente (kickoff, semanal, alinhamento, resultados, renovação, entregas
                e alinhamento interno sobre o cliente).
              </p>
              <p>
                Ficam, sem cliente: as tarefas avulsas e as outras reuniões. As vendas de origem
                continuam no Pipeline, em Fechado e sem contrato. Mês já fechado no Financeiro não
                muda; os meses abertos deixam de contar esses contratos.
              </p>
              <p>Não pode ser desfeito.</p>
              <p>
                Para só parar de cobrar e manter o histórico, não apague: abra o contrato em
                Contratos, mude o status dele para "Encerrado" e confirme "Sim, encerrar cobrança".
              </p>
            </DialogoDeExclusao>
          </div>
        )}
      </div>
    </>
  );
}

function CampoDaPastaDoDrive({
  cliente,
  podeEditar,
}: {
  cliente: ClienteListado;
  podeEditar: boolean;
}) {
  const definir = useDefinirPastaDoDrive();

  const link =
    cliente.pastaDoDrive !== null ? (
      <a
        href={`https://drive.google.com/drive/folders/${cliente.pastaDoDrive}`}
        target="_blank"
        rel="noreferrer"
        className="inline-flex items-center gap-1 text-xs text-primary-texto hover:underline"
      >
        <ExternalLink className="h-3 w-3" aria-hidden /> Abrir pasta no Drive
      </a>
    ) : null;

  if (!podeEditar) return link;

  function aoSairDoCampo(evento: React.FocusEvent<HTMLInputElement>) {
    const bruto = evento.target.value.trim();
    const idDigitado = extrairIdDaPasta(bruto);

    if (bruto !== "" && idDigitado === null) {
      toast.error(
        "Isso não parece um link nem um ID de pasta do Drive. Confira o valor colado e tente de novo.",
      );
      return;
    }

    if (idDigitado === cliente.pastaDoDrive) return;

    definir.mutate({ clienteId: cliente.id, valor: bruto });
  }

  return (
    <div className="grid gap-1.5">
      {link}
      <Input
        key={cliente.pastaDoDrive ?? ""}
        defaultValue={cliente.pastaDoDrive ?? ""}
        onBlur={aoSairDoCampo}
        placeholder="Cole o link ou o ID da pasta do Drive"
        className="h-7 text-xs"
        disabled={definir.isPending}
      />
    </div>
  );
}

function SecaoDeConfidencialidade({
  cliente,
  podeEditar,
}: {
  cliente: ClienteListado;
  podeEditar: boolean;
}) {
  const definir = useDefinirConfidencialidade(cliente.id);

  if (!podeEditar && !cliente.confidencial) return null;

  function alternar(marcado: boolean) {
    definir.mutate({ clienteId: cliente.id, confidencial: marcado });
  }

  function aoSairDaNota(evento: React.FocusEvent<HTMLTextAreaElement>) {
    const bruto = evento.target.value.trim();
    const valor = bruto === "" ? null : bruto;
    if (valor === cliente.confidencialNota) return;

    definir.mutate({ clienteId: cliente.id, confidencial: true, nota: valor });
  }

  return (
    <Secao titulo="Confidencialidade">
      {podeEditar ? (
        <div className="grid gap-2">
          <label className="flex items-center gap-2 text-xs">
            <Switch checked={cliente.confidencial} onCheckedChange={alternar} />
            Cliente confidencial: a marca avisa quem abre a ficha, não esconde o cliente de ninguém.
          </label>
          {cliente.confidencial && (
            <Textarea
              key={cliente.confidencialNota ?? ""}
              defaultValue={cliente.confidencialNota ?? ""}
              onBlur={aoSairDaNota}
              placeholder="Ex.: contato só pelo privado, pelo sócio, no telefone da Next."
              className="min-h-16 text-xs"
              disabled={definir.isPending}
            />
          )}
        </div>
      ) : (
        <p className="flex items-start gap-1.5 text-xs text-warning">
          <ShieldAlert className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
          <span>
            {cliente.confidencialNota !== null && cliente.confidencialNota !== ""
              ? cliente.confidencialNota
              : "Sem nota adicional."}
          </span>
        </p>
      )}
    </Secao>
  );
}

function ItemDeContrato({ contrato }: { contrato: ContratoDoCliente }) {
  const corDoStatus = COR_DO_STATUS_DE_CONTRATO[contrato.status];
  const encerrado = contrato.status === "cancelled";

  return (
    <li className={cn("grid gap-0.5 rounded-md border p-2", encerrado && "opacity-70")}>
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs font-medium">{contrato.nome}</span>
        <span
          className={cn("text-xs font-semibold tabular-nums", encerrado && "line-through")}
          title={encerrado ? "Contrato cancelado: este valor não é receita." : undefined}
        >
          {contrato.tipo === "mrr"
            ? `${brl(contrato.valorMensal ?? 0)}/mês`
            : brl(contrato.valorTotal ?? 0)}
        </span>
      </div>
      <div className="flex flex-wrap items-center gap-1.5 text-[10px] text-muted-foreground">
        <Badge variant="outline" className="text-[9.5px]">
          {contrato.tipo.toUpperCase()}
        </Badge>
        <Badge variant="outline" className="text-[9.5px]">
          {contrato.linhaDeNegocio === "demanda" ? "Demanda" : "Sistemas"}
        </Badge>
        {corDoStatus !== null && (
          <Badge className={cn("text-[9.5px]", corDoStatus)}>
            {contractStatusLabel(contrato.status)}
          </Badge>
        )}
        {!contrato.firme && <span className="text-amber-500">não firme</span>}
        {!contrato.cobrancaAtiva && <span>· sem cobrança</span>}
        <span>· início {formatDate(contrato.inicio)}</span>
        {contrato.fimDeCobranca !== null && (
          <span>· cobra até {formatDate(contrato.fimDeCobranca)}</span>
        )}
      </div>
    </li>
  );
}

function TimelineDeOrigem({ oportunidadeId }: { oportunidadeId: string }) {
  const eventos = useEventos(oportunidadeId);

  const estado = estadoDaConsulta(eventos);
  if (estado === "erro")
    return (
      <FalhaAoLer oQue="a timeline da venda" mensagem="Recarregue a página e tente de novo." />
    );

  return (
    <>
      {(eventos.data?.length ?? 0) >= LIMITE_DE_EVENTOS && (
        <p className="mb-2 rounded-md border border-amber-500/40 bg-amber-500/5 px-3 py-2 text-xs text-amber-500">
          A timeline atingiu o teto de {LIMITE_DE_EVENTOS} registros. Os mais antigos não estão
          sendo exibidos.
        </p>
      )}
      <ListaDeEventos
        eventos={eventos.data ?? []}
        carregando={estado === "carregando"}
        vazio="Esta venda não registrou nenhum evento."
      />
    </>
  );
}
