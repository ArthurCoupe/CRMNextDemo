import { Link } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/hooks/use-auth";
import type { PapelDoUsuario } from "@/hooks/use-profile";
import { avisarErro } from "@/shared/lib/avisar-erro";
import { brl } from "@/shared/lib/format";
import { useMudou } from "@/shared/lib/use-mudou";
import { ehDataCivilPlausivel, todaySP } from "@/shared/lib/date";
import { CampoEditavel } from "@/shared/ui/campo-editavel";
import { DialogoDeExclusao } from "@/shared/ui/dialogo-de-exclusao";
import { estadoDaConsulta } from "@/shared/ui/estado-da-consulta";
import { FalhaAoLer } from "@/shared/ui/falha-ao-ler";

import {
  FRENTES_DE_SERVICO,
  frenteLabel,
  linhaDeNegocioLabel,
  type FrenteDeServico,
} from "@/modules/contracts/domain/contract";
import { interpretarValorEmReais } from "@/modules/financial/domain/expenses";
import { BlocoDePropostas } from "@/modules/proposals/ui/bloco-de-propostas";
import { DesfazerFechamento } from "@/modules/clients/ui/desfazer-fechamento";

import type {
  CamposDeNutricao,
  CamposDeReuniao,
  CorrecaoDeSaida,
  DadosEditaveisDaOportunidade,
  LinhaDeNegocioDaOportunidade,
  OportunidadeListada,
  ResultadoDoVinculo,
  TipoRegistravel,
} from "../api/pipeline.repository";
import { LIMITE_DE_EVENTOS } from "../domain/limites";
import { extrairRef, temDadosDeCampanha } from "../domain/attribution";
import { CANAIS, ehCanalDeVerdade, rotuloDaChaveDeCanal, rotuloDoCanal } from "../domain/channel";
import { rotuloDoTipoDeEvento, TIPOS_REGISTRAVEIS } from "../domain/event-type";
import {
  calcularTier,
  congelarResposta,
  somarPontos,
  type RespostaCongelada,
} from "../domain/qualification";
import { motivoExigidoPor } from "../domain/saida";
import { significadoDoEstagio } from "../domain/stage";
import {
  useApagarOportunidade,
  useAtualizarDadosDaOportunidade,
  useAtualizarDatasDeReuniao,
  useAtualizarNutricao,
  useCampos,
  useCorrigirMotivoDeSaida,
  useCorrigirTextoDoEvento,
  useMotivos,
  usePipelines,
  useRegistrarToque,
  useCatalogoDeQualificacao,
  useEventos,
  useResponderPergunta,
  useResponsaveis,
  useVincularRef,
} from "../hooks/use-pipeline";
import { BlocoDeCampos } from "./campos-da-oportunidade";
import { BlocoDeWhatsApp } from "./bloco-de-whatsapp";
import { SeletorDeMotivo } from "./dialogo-de-motivo";
import { ListaDeEventos } from "./timeline-events";

interface OpportunityDrawerProps {
  oportunidade: OportunidadeListada | null;
  aoFechar: () => void;
  podeEditar: boolean;
  papel?: PapelDoUsuario | null;
}

export function OpportunityDrawer({
  oportunidade,
  aoFechar,
  podeEditar,
  papel = null,
}: OpportunityDrawerProps) {
  return (
    <Dialog open={oportunidade !== null} onOpenChange={(aberto) => !aberto && aoFechar()}>
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
        {oportunidade !== null && (
          <ConteudoDoDrawer
            oportunidade={oportunidade}
            podeEditar={podeEditar}
            papel={papel}
            aoFechar={aoFechar}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}

function ConteudoDoDrawer({
  oportunidade,
  podeEditar,
  papel,
  aoFechar,
}: {
  oportunidade: OportunidadeListada;
  podeEditar: boolean;
  papel: PapelDoUsuario | null;
  aoFechar: () => void;
}) {
  const tier = calcularTier(oportunidade.respostas);
  const pipelines = usePipelines(true);
  const nomeDoPipeline = pipelines.isError
    ? "não foi possível ler"
    : (pipelines.data?.find((p) => p.id === oportunidade.pipelineId)?.nome ?? "…");

  return (
    <>
      <DialogHeader>
        <DialogTitle className="flex items-center gap-2">
          {oportunidade.nome}
          <Badge variant="outline" title={significadoDoEstagio(oportunidade.estagio)}>
            {oportunidade.estagioNome}
          </Badge>
          {tier !== null && <Badge>Tier {tier}</Badge>}
        </DialogTitle>
        <DialogDescription className="text-xs">Pipeline: {nomeDoPipeline}</DialogDescription>
      </DialogHeader>

      <div className="grid gap-5">
        <BlocoDeDados oportunidade={oportunidade} podeEditar={podeEditar} papel={papel} />
        <BlocoDeCamposDaFicha oportunidade={oportunidade} podeEditar={podeEditar} />
        <BlocoDeMotivo oportunidade={oportunidade} podeEditar={podeEditar} />
        <BlocoDeReunioes oportunidade={oportunidade} podeEditar={podeEditar} />
        <BlocoDePropostas oportunidade={oportunidade} />
        <BlocoDeNutricao oportunidade={oportunidade} podeEditar={podeEditar} />
        <FichaDeQualificacao oportunidade={oportunidade} podeEditar={podeEditar} />
        <BlocoDeAtribuicao oportunidade={oportunidade} podeEditar={podeEditar} />
        <Timeline oportunidadeId={oportunidade.id} podeEditar={podeEditar} />
        {papel === "owner" &&
          oportunidade.estagio === "fechado" &&
          oportunidade.clienteId !== null && (
            <div className="border-t pt-4">
              <DesfazerFechamento venda={{ id: oportunidade.id, nome: oportunidade.nome }} />
            </div>
          )}
        {podeEditar && <ApagarOportunidade oportunidade={oportunidade} aoApagar={aoFechar} />}
      </div>
    </>
  );
}

function ApagarOportunidade({
  oportunidade,
  aoApagar,
}: {
  oportunidade: OportunidadeListada;
  aoApagar: () => void;
}) {
  const apagar = useApagarOportunidade();

  return (
    <div className="border-t pt-4">
      <DialogoDeExclusao
        gatilho={
          <Button type="button" variant="destructive" size="sm">
            Apagar oportunidade
          </Button>
        }
        titulo={`Apagar "${oportunidade.nome}"?`}
        pendente={apagar.isPending}
        onConfirmar={() => apagar.mutate(oportunidade.id, { onSuccess: aoApagar })}
      >
        <p>
          Apaga a oportunidade com a timeline, as respostas de qualificação e as propostas em
          rascunho.
        </p>
        <p>Oportunidade com proposta já enviada ao cliente não se apaga: marque-a como perdida.</p>
        <p>
          Venda com contrato não se apaga: o caminho é &quot;Desfazer fechamento&quot;. A reunião de
          proposta para prospect sai junto; tarefas e as outras reuniões ligadas a ela ficam, sem a
          oportunidade.
        </p>
        <p>Esta ação não pode ser desfeita.</p>
      </DialogoDeExclusao>
    </div>
  );
}

function LinhaDeDado({ rotulo, valor }: { rotulo: string; valor: string | null }) {
  if (valor === null || valor === "") return null;
  return (
    <div className="flex justify-between gap-3 text-xs">
      <span className="text-muted-foreground">{rotulo}</span>
      <span className="text-right font-medium">{valor}</span>
    </div>
  );
}

const SEM_VALOR = "sem-valor";

const LINHAS_DE_NEGOCIO: readonly LinhaDeNegocioDaOportunidade[] = ["demanda", "sistemas"];

function ehLinhaDeNegocio(valor: string): valor is LinhaDeNegocioDaOportunidade {
  return LINHAS_DE_NEGOCIO.some((linha) => linha === valor);
}

const VALOR_ESTIMADO_ILEGIVEL =
  "Valor estimado não reconhecido. Use vírgula ou ponto para os centavos: 1.500,00 ou 1500.";

function BlocoDeDados({
  oportunidade,
  podeEditar,
  papel,
}: {
  oportunidade: OportunidadeListada;
  podeEditar: boolean;
  papel: PapelDoUsuario | null;
}) {
  const atualizarDados = useAtualizarDadosDaOportunidade();
  const consultaDeResponsaveis = useResponsaveis(oportunidade.responsavelId);
  const estadoDosResponsaveis = estadoDaConsulta(consultaDeResponsaveis);
  const responsaveis = consultaDeResponsaveis.data ?? [];

  const frentesDoServidor = oportunidade.frentesEsperadas ?? [];
  const [frentes, setFrentes] = useState<readonly FrenteDeServico[]>(frentesDoServidor);
  const frentesMudaram = useMudou(`${oportunidade.id}|${frentesDoServidor.join(",")}`);
  if (frentesMudaram) setFrentes(frentesDoServidor);

  function gravar(campos: DadosEditaveisDaOportunidade) {
    atualizarDados.mutate({ id: oportunidade.id, campos });
  }

  function gravarCampo(campo: keyof DadosEditaveisDaOportunidade, valorDoInput: string) {
    gravar({ [campo]: valorDoInput } as DadosEditaveisDaOportunidade);
  }

  function trocarResponsavel(valor: string) {
    gravar({ responsavelId: valor === "sem-responsavel" ? null : valor });
  }

  function trocarCanal(valor: string) {
    if (valor === SEM_VALOR) {
      gravar({ canal: null });
      return;
    }
    if (ehCanalDeVerdade(valor)) gravar({ canal: valor });
  }

  function trocarLinhaDeNegocio(valor: string) {
    if (valor === SEM_VALOR) {
      gravar({ linhaDeNegocio: null });
      return;
    }
    if (ehLinhaDeNegocio(valor)) gravar({ linhaDeNegocio: valor });
  }

  function trocarFrente(frente: FrenteDeServico, marcada: boolean) {
    const antes = frentes;
    const proximas = FRENTES_DE_SERVICO.filter((f) => (f === frente ? marcada : antes.includes(f)));
    setFrentes(proximas);
    atualizarDados.mutate(
      { id: oportunidade.id, campos: { frentesEsperadas: proximas } },
      { onError: () => setFrentes(antes) },
    );
  }

  function gravarValorEstimado(campo: HTMLInputElement) {
    const atual = oportunidade.valorEstimado === null ? "" : String(oportunidade.valorEstimado);
    const texto = campo.value;
    if (texto === atual) return;
    const gravarOuVoltar = (valorEstimado: number | null) =>
      atualizarDados.mutate(
        { id: oportunidade.id, campos: { valorEstimado } },
        {
          onError: () => {
            campo.value = atual;
          },
        },
      );
    if (texto.trim() === "") {
      if (oportunidade.valorEstimado !== null) gravarOuVoltar(null);
      return;
    }
    const valor = interpretarValorEmReais(texto);
    if (valor === null) {
      toast.error(VALOR_ESTIMADO_ILEGIVEL);
      campo.value = atual;
      return;
    }
    if (valor !== oportunidade.valorEstimado) gravarOuVoltar(valor);
  }

  const desabilitado = !podeEditar;

  return (
    <section className="grid gap-1.5 rounded-lg border p-3">
      <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Dados</h3>
      <CampoEditavel
        id={`oportunidade-nome-${oportunidade.id}`}
        rotulo="Nome"
        valor={oportunidade.nome}
        disabled={desabilitado}
        onGravar={(valorDoInput) => gravarCampo("nome", valorDoInput)}
      />
      <CampoEditavel
        id={`oportunidade-contato-nome-${oportunidade.id}`}
        rotulo="Contato"
        valor={oportunidade.contatoNome}
        disabled={desabilitado}
        onGravar={(valorDoInput) => gravarCampo("contatoNome", valorDoInput)}
      />
      <CampoEditavel
        id={`oportunidade-contato-email-${oportunidade.id}`}
        rotulo="E-mail"
        valor={oportunidade.contatoEmail}
        disabled={desabilitado}
        onGravar={(valorDoInput) => gravarCampo("contatoEmail", valorDoInput)}
      />
      <CampoEditavel
        id={`oportunidade-contato-telefone-${oportunidade.id}`}
        rotulo="Telefone"
        valor={oportunidade.contatoTelefone}
        disabled={desabilitado}
        onGravar={(valorDoInput) => gravarCampo("contatoTelefone", valorDoInput)}
      />
      <BlocoDeWhatsApp oportunidade={oportunidade} />
      <CampoEditavel
        id={`oportunidade-segmento-${oportunidade.id}`}
        rotulo="Segmento"
        valor={oportunidade.segmento}
        disabled={desabilitado}
        onGravar={(valorDoInput) => gravarCampo("segmento", valorDoInput)}
      />
      <CampoEditavel
        id={`oportunidade-nicho-${oportunidade.id}`}
        rotulo="Nicho"
        valor={oportunidade.nicho}
        disabled={desabilitado}
        onGravar={(valorDoInput) => gravarCampo("nicho", valorDoInput)}
      />

      <div className="grid gap-1">
        <span className="text-[11px] text-muted-foreground">Responsável</span>
        {podeEditar ? (
          <>
            {estadoDosResponsaveis === "erro" && (
              <FalhaAoLer
                oQue="a lista de responsáveis"
                mensagem="Recarregue a página e tente de novo."
              />
            )}
            <Select
              value={oportunidade.responsavelId ?? "sem-responsavel"}
              onValueChange={trocarResponsavel}
              disabled={atualizarDados.isPending || estadoDosResponsaveis !== "pronto"}
            >
              <SelectTrigger className="h-8 text-xs" aria-label="Responsável">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="sem-responsavel">Sem responsável</SelectItem>
                {oportunidade.responsavelId !== null &&
                  !responsaveis.some(
                    (responsavel) => responsavel.id === oportunidade.responsavelId,
                  ) && (
                    <SelectItem value={oportunidade.responsavelId} disabled>
                      {oportunidade.responsavelNome ?? "Responsável atual"}
                    </SelectItem>
                  )}
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
          <p className="text-xs">{oportunidade.responsavelNome ?? "Sem responsável"}</p>
        )}
      </div>

      {podeEditar ? (
        <>
          <div className="grid gap-1">
            <span className="text-[11px] text-muted-foreground">Canal</span>
            <Select
              value={oportunidade.canal ?? SEM_VALOR}
              onValueChange={trocarCanal}
              disabled={atualizarDados.isPending}
            >
              <SelectTrigger className="h-8 text-xs" aria-label="Canal">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={SEM_VALOR}>Sem canal</SelectItem>
                {CANAIS.map((canal) => (
                  <SelectItem key={canal} value={canal}>
                    {rotuloDoCanal(canal)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid gap-1">
            <span className="text-[11px] text-muted-foreground">Linha de negócio</span>
            <Select
              value={oportunidade.linhaDeNegocio ?? SEM_VALOR}
              onValueChange={trocarLinhaDeNegocio}
              disabled={atualizarDados.isPending}
            >
              <SelectTrigger className="h-8 text-xs" aria-label="Linha de negócio">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={SEM_VALOR}>Sem linha de negócio</SelectItem>
                {LINHAS_DE_NEGOCIO.map((linha) => (
                  <SelectItem key={linha} value={linha}>
                    {linhaDeNegocioLabel(linha)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </>
      ) : (
        <>
          <LinhaDeDado
            rotulo="Canal"
            valor={oportunidade.canal !== null ? rotuloDaChaveDeCanal(oportunidade.canal) : null}
          />
          <LinhaDeDado
            rotulo="Linha de negócio"
            valor={
              oportunidade.linhaDeNegocio !== null
                ? linhaDeNegocioLabel(oportunidade.linhaDeNegocio)
                : null
            }
          />
        </>
      )}
      <CampoEditavel
        id={`oportunidade-origem-${oportunidade.id}`}
        rotulo="Origem do lead"
        valor={oportunidade.origem}
        disabled={desabilitado}
        onGravar={(valorDoInput) => gravarCampo("origem", valorDoInput)}
      />
      <CampoEditavel
        id={`oportunidade-indicado-por-${oportunidade.id}`}
        rotulo="Indicado por"
        valor={oportunidade.indicadoPor}
        disabled={desabilitado}
        onGravar={(valorDoInput) => gravarCampo("indicadoPor", valorDoInput)}
      />

      {podeEditar ? (
        <div className="grid gap-1">
          <Label
            htmlFor={`oportunidade-valor-estimado-${oportunidade.id}`}
            className="text-[11px] text-muted-foreground"
          >
            Valor estimado (R$)
          </Label>
          <Input
            key={oportunidade.valorEstimado ?? ""}
            id={`oportunidade-valor-estimado-${oportunidade.id}`}
            inputMode="decimal"
            defaultValue={
              oportunidade.valorEstimado === null ? "" : String(oportunidade.valorEstimado)
            }
            placeholder="1.500,00"
            className="h-8 text-xs tabular-nums"
            onBlur={(evento) => gravarValorEstimado(evento.target)}
          />
          {oportunidade.valorEstimado !== null && (
            <p className="text-[11px] text-muted-foreground tabular-nums">
              {`${brl(oportunidade.valorEstimado)}. Estimativa: não entra no MRR nem no TCV.`}
            </p>
          )}
        </div>
      ) : (
        <LinhaDeDado
          rotulo="Valor estimado"
          valor={oportunidade.valorEstimado === null ? null : brl(oportunidade.valorEstimado)}
        />
      )}

      <div className="grid gap-1">
        <span className="text-[11px] text-muted-foreground">Frentes esperadas</span>
        {podeEditar ? (
          <div className="flex flex-wrap gap-x-3 gap-y-1.5">
            {FRENTES_DE_SERVICO.map((frente) => (
              <div key={frente} className="flex items-center gap-1.5">
                <Checkbox
                  id={`oportunidade-frente-${frente}-${oportunidade.id}`}
                  aria-label={`Frente esperada: ${frenteLabel(frente)}`}
                  checked={frentes.includes(frente)}
                  disabled={atualizarDados.isPending}
                  onCheckedChange={(marcada) => trocarFrente(frente, marcada === true)}
                />
                <Label
                  htmlFor={`oportunidade-frente-${frente}-${oportunidade.id}`}
                  className="text-xs font-normal"
                >
                  {frenteLabel(frente)}
                </Label>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-xs">
            {frentes.length === 0 ? "Nenhuma" : frentes.map((f) => frenteLabel(f)).join(", ")}
          </p>
        )}
      </div>

      <div className="grid gap-1">
        <Label
          htmlFor={`oportunidade-observacoes-${oportunidade.id}`}
          className="text-[11px] text-muted-foreground"
        >
          Observações
        </Label>
        <Textarea
          key={oportunidade.observacoes ?? ""}
          id={`oportunidade-observacoes-${oportunidade.id}`}
          defaultValue={oportunidade.observacoes ?? ""}
          disabled={desabilitado}
          maxLength={5000}
          className="min-h-16 text-xs"
          onBlur={(evento) => {
            if (evento.target.value === (oportunidade.observacoes ?? "")) return;
            gravarCampo("observacoes", evento.target.value);
          }}
        />
      </div>

      <CampoDeData
        id={`oportunidade-followup-${oportunidade.id}`}
        rotulo="Próximo follow-up"
        valorCivil={oportunidade.proximoFollowUp}
        disabled={desabilitado || atualizarDados.isPending}
        onGravar={(valorDoInput) => gravarCampo("proximoFollowup", valorDoInput)}
      />
      <LinhaDeDado
        rotulo="Fechado · recorrente"
        valor={
          oportunidade.fechadoMrr !== null && oportunidade.fechadoMrr > 0
            ? `${brl(oportunidade.fechadoMrr)}/mês`
            : null
        }
      />
      <LinhaDeDado
        rotulo="Fechado · projeto"
        valor={
          oportunidade.fechadoTcv !== null && oportunidade.fechadoTcv > 0
            ? brl(oportunidade.fechadoTcv)
            : null
        }
      />
      {oportunidade.clienteId !== null &&
        (papel === "owner" || papel === "manager") &&
        ((oportunidade.fechadoMrr ?? 0) > 0 || (oportunidade.fechadoTcv ?? 0) > 0) && (
          <Link
            to="/contracts"
            search={{ cliente: oportunidade.clienteId }}
            className="justify-self-start text-xs text-primary-texto underline"
          >
            {papel === "owner" ? "Editar no contrato" : "Ver no contrato"}
          </Link>
        )}
    </section>
  );
}

function BlocoDeCamposDaFicha({
  oportunidade,
  podeEditar,
}: {
  oportunidade: OportunidadeListada;
  podeEditar: boolean;
}) {
  const campos = useCampos(oportunidade.pipelineId, true);
  const atualizarDados = useAtualizarDadosDaOportunidade();
  const estado = estadoDaConsulta(campos);
  if (estado === "erro") {
    return (
      <FalhaAoLer oQue="os campos do pipeline" mensagem="Recarregue a página e tente de novo." />
    );
  }
  if (estado === "carregando") return <Skeleton className="h-8" />;

  return (
    <BlocoDeCampos
      campos={campos.data ?? []}
      valores={oportunidade.campos}
      podeEditar={podeEditar}
      aoGravar={(valores) =>
        atualizarDados.mutateAsync({ id: oportunidade.id, campos: { campos: valores } })
      }
    />
  );
}

function BlocoDeMotivo({
  oportunidade,
  podeEditar,
}: {
  oportunidade: OportunidadeListada;
  podeEditar: boolean;
}) {
  const corrigir = useCorrigirMotivoDeSaida();
  const exigido = motivoExigidoPor(oportunidade.estagio);
  const motivos = useMotivos(exigido === null ? null : oportunidade.pipelineId, true);
  if (exigido === null) return null;

  const rotuloDoTitulo = exigido === "descarte" ? "Motivo do descarte" : "Motivo da perda";

  function corrigirCampo(correcao: CorrecaoDeSaida) {
    corrigir.mutate({
      oportunidadeId: oportunidade.id,
      estagioAtualId: oportunidade.estagioId,
      correcao,
    });
  }

  const disabled = corrigir.isPending;

  return (
    <section className="grid gap-2 rounded-lg border p-3">
      <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        {rotuloDoTitulo}
      </h3>

      {podeEditar ? (
        <>
          <div className="grid gap-1">
            <span className="text-[11px] text-muted-foreground">Motivo</span>
            <SeletorDeMotivo
              id={`motivo-de-saida-${oportunidade.id}`}
              exigido={exigido}
              motivos={motivos.data ?? []}
              valor={oportunidade.motivoId}
              disabled={disabled}
              className="h-8 text-xs"
              aoEscolher={(motivoId) => corrigirCampo({ motivoId })}
            />
          </div>

          <CampoEditavel
            id={`motivo-obs-${oportunidade.id}`}
            rotulo="Observação do motivo"
            valor={oportunidade.motivoObs}
            disabled={disabled}
            onGravar={(texto) => corrigirCampo({ obs: texto.trim() === "" ? null : texto.trim() })}
          />
        </>
      ) : (
        <>
          <LinhaDeDado rotulo="Motivo" valor={oportunidade.motivoRotulo} />
          <LinhaDeDado rotulo="Observação" valor={oportunidade.motivoObs} />
        </>
      )}
    </section>
  );
}

function CampoDeData({
  id,
  rotulo,
  valorCivil,
  disabled,
  className,
  onGravar,
}: {
  id: string;
  rotulo: string;
  valorCivil: string | null;
  disabled: boolean;
  className?: string;
  onGravar: (valorDoInput: string) => void;
}) {
  return (
    <div className="grid gap-1">
      <Label htmlFor={id} className="text-[11px] text-muted-foreground">
        {rotulo}
      </Label>
      <Input
        key={valorCivil ?? ""}
        id={id}
        type="date"
        defaultValue={valorCivil ?? ""}
        disabled={disabled}
        className={className ?? "h-8 text-xs"}
        onBlur={(evento) => {
          if (evento.target.value === (valorCivil ?? "")) return;
          if (evento.target.value !== "" && !ehDataCivilPlausivel(evento.target.value)) {
            toast.error("Data inválida. Use um ano entre 2000 e 2100.");
            return;
          }
          onGravar(evento.target.value);
        }}
      />
    </div>
  );
}

function BlocoDeReunioes({
  oportunidade,
  podeEditar,
}: {
  oportunidade: OportunidadeListada;
  podeEditar: boolean;
}) {
  const atualizar = useAtualizarDatasDeReuniao();

  function gravar(campos: CamposDeReuniao) {
    atualizar.mutate({ oportunidadeId: oportunidade.id, campos });
  }

  function paraCivil(valor: string | null): string | null {
    return valor !== null ? todaySP(new Date(valor)) : null;
  }

  function paraTimestamptz(valorDoInput: string): string | null {
    return valorDoInput === "" ? null : `${valorDoInput}T00:00:00-03:00`;
  }

  const disabled = !podeEditar || atualizar.isPending;

  return (
    <section className="grid gap-2 rounded-lg border p-3">
      <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        Reuniões
      </h3>
      <div className="grid gap-3 sm:grid-cols-2">
        <CampoDeData
          id={`r1-agendada-${oportunidade.id}`}
          rotulo="R1 agendada"
          valorCivil={paraCivil(oportunidade.r1AgendadaEm)}
          disabled={disabled}
          onGravar={(v) => gravar({ r1AgendadaEm: paraTimestamptz(v) })}
        />
        <CampoDeData
          id={`r1-realizada-${oportunidade.id}`}
          rotulo="R1 realizada"
          valorCivil={paraCivil(oportunidade.r1RealizadaEm)}
          disabled={disabled}
          onGravar={(v) => gravar({ r1RealizadaEm: paraTimestamptz(v) })}
        />
        <CampoDeData
          id={`r2-agendada-${oportunidade.id}`}
          rotulo="R2 agendada"
          valorCivil={paraCivil(oportunidade.r2AgendadaEm)}
          disabled={disabled}
          onGravar={(v) => gravar({ r2AgendadaEm: paraTimestamptz(v) })}
        />
        <CampoDeData
          id={`r2-realizada-${oportunidade.id}`}
          rotulo="R2 realizada"
          valorCivil={paraCivil(oportunidade.r2RealizadaEm)}
          disabled={disabled}
          onGravar={(v) => gravar({ r2RealizadaEm: paraTimestamptz(v) })}
        />
      </div>
    </section>
  );
}

function BlocoDeNutricao({
  oportunidade,
  podeEditar,
}: {
  oportunidade: OportunidadeListada;
  podeEditar: boolean;
}) {
  const atualizar = useAtualizarNutricao();

  function gravar(campos: CamposDeNutricao) {
    atualizar.mutate({ oportunidadeId: oportunidade.id, campos });
  }

  const disabled = !podeEditar || atualizar.isPending;

  return (
    <section className="grid gap-2 rounded-lg border p-3">
      <div className="flex items-center justify-between">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Nutrição
        </h3>
        <Switch
          checked={oportunidade.emNutricao}
          disabled={disabled}
          aria-label={oportunidade.emNutricao ? "Desligar nutrição" : "Ligar nutrição"}
          onCheckedChange={(ligado) => gravar({ emNutricao: ligado })}
        />
      </div>

      <CampoDeData
        id={`nutrir-ate-${oportunidade.id}`}
        rotulo="Nutrir até"
        valorCivil={oportunidade.nutrirAte}
        disabled={disabled}
        className="h-8 w-40 text-xs"
        onGravar={(v) => gravar({ nutrirAte: v === "" ? null : v })}
      />
    </section>
  );
}

function FichaDeQualificacao({
  oportunidade,
  podeEditar,
}: {
  oportunidade: OportunidadeListada;
  podeEditar: boolean;
}) {
  const { user } = useAuth();
  const { data: catalogo, error: erroDoCatalogo } = useCatalogoDeQualificacao();
  const responder = useResponderPergunta();

  const [locais, setLocais] = useState<readonly RespostaCongelada[] | null>(null);
  const respostasDoServidorMudaram = useMudou(JSON.stringify(oportunidade.respostas));
  if (respostasDoServidorMudaram) setLocais(null);
  const respostas = locais ?? oportunidade.respostas;
  const tier = calcularTier(respostas);

  if (erroDoCatalogo) {
    return (
      <section className="rounded-lg border border-destructive/50 p-3 text-xs text-destructive">
        O catálogo de perguntas não carregou: {String(erroDoCatalogo)}
      </section>
    );
  }
  if (!catalogo) return null;

  function responderOpcao(perguntaIndex: number, opcaoIndex: number) {
    if (!catalogo) return;
    const pergunta = catalogo.questions[perguntaIndex];
    if (!pergunta) return;

    const congelada = congelarResposta(pergunta, opcaoIndex);
    const proximas = [
      ...respostas.filter((resposta) => resposta.questionKey !== congelada.questionKey),
      congelada,
    ];
    setLocais(proximas);

    responder.mutate(
      {
        oportunidadeId: oportunidade.id,
        resposta: { ...congelada, catalogVersion: catalogo.version },
        respondidoPor: user?.id ?? null,
      },
      {
        onError: (erro) => {
          setLocais(null);
          toast.error(erro instanceof Error ? erro.message : "Não foi possível gravar.");
        },
      },
    );
  }

  return (
    <section className="grid gap-3 rounded-lg border p-3">
      <div className="flex items-center justify-between">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Qualificação
        </h3>
        <span className="text-xs font-semibold">
          {tier === null
            ? "Sem qualificação"
            : `Tier ${tier} · ${somarPontos(respostas)} pts${
                respostas.some((resposta) => resposta.isKo) ? " · KO" : ""
              }`}
        </span>
      </div>

      {catalogo.questions.map((pergunta, perguntaIndex) => {
        const atual = respostas.find((resposta) => resposta.questionKey === pergunta.key);
        return (
          <div key={pergunta.key} className="grid gap-1.5">
            <p className="text-xs font-medium">{pergunta.label}</p>
            <p className="text-[11px] text-muted-foreground">{pergunta.prompt}</p>
            <div className="flex flex-wrap gap-1.5">
              {pergunta.options.map((opcao, opcaoIndex) => (
                <Button
                  key={opcao.label}
                  type="button"
                  size="sm"
                  variant={atual?.optionIndex === opcaoIndex ? "default" : "outline"}
                  className="h-7 text-[11px]"
                  disabled={!podeEditar || responder.isPending}
                  onClick={() => responderOpcao(perguntaIndex, opcaoIndex)}
                >
                  {opcao.label}
                  <span className="ml-1 text-[9px] opacity-70">
                    {opcao.ko === true ? "KO" : `${opcao.points}pt`}
                  </span>
                </Button>
              ))}
            </div>
          </div>
        );
      })}
    </section>
  );
}

function BlocoDeAtribuicao({
  oportunidade,
  podeEditar,
}: {
  oportunidade: OportunidadeListada;
  podeEditar: boolean;
}) {
  const vincular = useVincularRef();
  const [refColado, setRefColado] = useState("");

  const dados = oportunidade.atribuicao;

  async function aoVincular() {
    const id = extrairRef(refColado);
    if (id === null) {
      toast.error("Não achei um ref válido no texto colado.");
      return;
    }
    let resultado: ResultadoDoVinculo;
    try {
      resultado = await vincular.mutateAsync({
        oportunidadeId: oportunidade.id,
        attributionId: id,
      });
    } catch (erro) {
      avisarErro("Não foi possível vincular.")(erro);
      return;
    }
    switch (resultado.status) {
      case "vinculado":
        toast.success("Atribuição vinculada.");
        setRefColado("");
        break;
      case "nao_encontrado":
        toast.error("Ref não encontrado: o toque não existe ou o id está errado.");
        break;
      case "ja_vinculado":
        toast.error("Este ref já pertence a outra oportunidade: um toque só conta uma conversão.");
        break;
    }
  }

  return (
    <section className="grid gap-2 rounded-lg border p-3">
      <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        Atribuição de marketing
      </h3>

      {temDadosDeCampanha(dados) ? (
        <div className="grid gap-1.5">
          <LinhaDeDado rotulo="Origem" valor={dados.utmSource} />
          <LinhaDeDado rotulo="Mídia" valor={dados.utmMedium} />
          <LinhaDeDado rotulo="Campanha" valor={dados.utmCampaign} />
          <LinhaDeDado rotulo="Conteúdo" valor={dados.utmContent} />
          <LinhaDeDado rotulo="Termo" valor={dados.utmTerm} />
          <LinhaDeDado rotulo="Landing page" valor={dados.landingUrl} />
        </div>
      ) : (
        <>
          <p className="text-xs text-muted-foreground">
            Sem dados de campanha: não é possível ligar esta venda a um anúncio.
          </p>
          {podeEditar && (
            <div className="flex gap-2">
              <Input
                value={refColado}
                onChange={(evento) => setRefColado(evento.target.value)}
                placeholder="Cole aqui a mensagem com o ref:..."
                className="h-8 text-xs"
              />
              <Button
                type="button"
                size="sm"
                variant="outline"
                disabled={refColado.trim() === "" || vincular.isPending}
                onClick={() => void aoVincular()}
              >
                Vincular
              </Button>
            </div>
          )}
        </>
      )}
    </section>
  );
}

function ehRegistravel(valor: string): valor is TipoRegistravel {
  return TIPOS_REGISTRAVEIS.some((tipo) => tipo === valor);
}

function Timeline({ oportunidadeId, podeEditar }: { oportunidadeId: string; podeEditar: boolean }) {
  const { user } = useAuth();
  const corrigir = useCorrigirTextoDoEvento();
  const consulta = useEventos(oportunidadeId);
  const estado = estadoDaConsulta(consulta);
  const registrar = useRegistrarToque();
  const [tipo, setTipo] = useState<TipoRegistravel>("note");
  const [texto, setTexto] = useState("");

  function aoRegistrar() {
    const conteudo = texto.trim();
    if (conteudo === "") return;
    registrar.mutate(
      { oportunidadeId, tipo, texto: conteudo },
      {
        onSuccess: () => setTexto(""),
        onError: (erro) =>
          toast.error(erro instanceof Error ? erro.message : "Não foi possível registrar."),
      },
    );
  }

  return (
    <section className="grid gap-2 rounded-lg border p-3">
      <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        Timeline
      </h3>

      <div className="grid gap-2">
        <Select
          value={tipo}
          onValueChange={(valor) => {
            if (ehRegistravel(valor)) setTipo(valor);
          }}
        >
          <SelectTrigger className="h-8 w-48 text-xs" aria-label="Tipo do registro">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {TIPOS_REGISTRAVEIS.map((registravel) => (
              <SelectItem key={registravel} value={registravel} className="text-xs">
                {rotuloDoTipoDeEvento(registravel)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Textarea
          value={texto}
          onChange={(evento) => setTexto(evento.target.value)}
          onKeyDown={(evento) => {
            if ((evento.metaKey || evento.ctrlKey) && evento.key === "Enter") aoRegistrar();
          }}
          placeholder="O que aconteceu (entra na história, não sobrescreve)"
          aria-label="Descrição do registro"
          className="min-h-16 text-xs"
        />

        <Button
          type="button"
          size="sm"
          className="justify-self-start"
          disabled={texto.trim() === "" || registrar.isPending}
          onClick={aoRegistrar}
        >
          Registrar
        </Button>
      </div>

      {estado === "erro" ? (
        <FalhaAoLer
          oQue="a timeline desta oportunidade"
          mensagem="Recarregue a página e tente de novo."
        />
      ) : (
        <>
          {(consulta.data?.length ?? 0) >= LIMITE_DE_EVENTOS && (
            <p className="rounded-md border border-amber-500/40 bg-amber-500/5 px-3 py-2 text-xs text-amber-500">
              A timeline atingiu o teto de {LIMITE_DE_EVENTOS} registros. Os mais antigos não estão
              sendo exibidos.
            </p>
          )}
          <ListaDeEventos
            eventos={consulta.data ?? []}
            carregando={estado === "carregando"}
            podeCorrigir={(evento) =>
              podeEditar || (evento.autorId !== null && evento.autorId === user?.id)
            }
            corrigindo={corrigir.isPending}
            aoCorrigir={(eventoId, texto, pronto, editadoEmLido) =>
              corrigir.mutate(
                { oportunidadeId, eventoId, texto, editadoEmLido },
                { onSuccess: pronto },
              )
            }
          />
        </>
      )}
    </section>
  );
}
