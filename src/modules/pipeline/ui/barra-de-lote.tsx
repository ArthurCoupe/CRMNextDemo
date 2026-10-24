import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { plural } from "@/shared/lib/format";

import type { AcaoEmLote, ResponsavelParaSelecao } from "../api/pipeline.repository";
import {
  apararValores,
  problemasDosValores,
  type CampoDoPipeline,
  type ValoresDeCampos,
} from "../domain/campos";
import type { EstagioDoPipeline } from "../domain/pipeline";
import { motivoExigidoPor } from "../domain/saida";
import { CamposDoFormulario } from "./campos-da-oportunidade";
import { DialogoDeMotivo, type SaidaPendente } from "./dialogo-de-motivo";

const NAO_ALTERAR = "nao-alterar";

export function BarraDeLote({
  pipelineId,
  quantidade,
  estagios,
  campos,
  camposFalharam = false,
  responsaveis,
  responsaveisFalharam = false,
  contarAlvos,
  aoAplicar,
  aoLimpar,
  pendente,
}: {
  pipelineId: string;
  quantidade: number;
  estagios: readonly EstagioDoPipeline[];
  campos: readonly CampoDoPipeline[];
  camposFalharam?: boolean;
  responsaveis: readonly ResponsavelParaSelecao[];
  responsaveisFalharam?: boolean;
  contarAlvos: (acao: AcaoEmLote) => number;
  aoAplicar: (acao: AcaoEmLote) => void;
  aoLimpar: () => void;
  pendente: boolean;
}) {
  const [ownerId, setOwnerId] = useState<string | null>(null);
  const [estagioId, setEstagioId] = useState<string | null>(null);
  const [campoId, setCampoId] = useState<string | null>(null);
  const [valores, setValores] = useState<ValoresDeCampos>({});
  const [saindo, setSaindo] = useState<SaidaPendente | null>(null);

  const estagiosAbertos = estagios.filter((estagio) => estagio.tipo !== "fechado");
  const camposAtivos = campos.filter((campo) => campo.ativo);
  const campo = camposAtivos.find((c) => c.id === campoId) ?? null;
  const valoresAparados = apararValores(valores);
  const temValor = Object.keys(valoresAparados).length > 0;
  const problemaDoCampo = temValor ? problemasDosValores(camposAtivos, valoresAparados, {}) : null;
  const campoIncompleto = campo !== null && (!temValor || problemaDoCampo !== null);

  function montarAcao(extra: AcaoEmLote = {}): AcaoEmLote {
    return {
      ...(ownerId !== null && { ownerId }),
      ...(estagioId !== null && { estagioId }),
      ...(temValor && problemaDoCampo === null && { campos: valoresAparados }),
      ...extra,
    };
  }
  const temAcao = Object.keys(montarAcao()).length > 0;

  function podeDisparar(acao: AcaoEmLote): boolean {
    if (campoIncompleto) {
      toast.error(
        problemaDoCampo ??
          `Preencha o campo ${campo?.nome ?? ""} ou volte para "Não alterar" antes de aplicar.`,
      );
      return false;
    }
    if (contarAlvos(acao) === 0) {
      toast.info("Nada a mudar.");
      return false;
    }
    return true;
  }

  function escolherEtapa(id: string) {
    if (id === NAO_ALTERAR) {
      setEstagioId(null);
      return;
    }
    const destino = estagiosAbertos.find((estagio) => estagio.id === id);
    if (destino === undefined) return;
    if (motivoExigidoPor(destino.tipo) !== null) {
      if (!podeDisparar(montarAcao({ estagioId: destino.id }))) return;
      setSaindo({ destino, lote: { pipelineId, quantidade } });
      return;
    }
    setEstagioId(id);
  }

  function escolherCampo(id: string) {
    setCampoId(id === NAO_ALTERAR ? null : id);
    setValores({});
  }

  return (
    <section
      role="region"
      aria-label="Ações em lote"
      className="flex flex-wrap items-center gap-2 rounded-md border border-primary/40 bg-primary/5 px-3 py-2"
    >
      <p aria-live="polite" className="text-xs font-semibold tabular-nums">
        {plural(quantidade, "selecionada", "selecionadas")}
      </p>

      <Select
        value={ownerId ?? ""}
        onValueChange={(id) => setOwnerId(id === NAO_ALTERAR ? null : id)}
      >
        <SelectTrigger aria-label="Responsável" className="h-8 w-[170px] text-xs">
          <SelectValue placeholder="Responsável" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={NAO_ALTERAR}>Não alterar</SelectItem>
          {responsaveis.map((responsavel) => (
            <SelectItem key={responsavel.id} value={responsavel.id}>
              {responsavel.nome}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select value={estagioId ?? ""} onValueChange={escolherEtapa}>
        <SelectTrigger aria-label="Etapa" className="h-8 w-[170px] text-xs">
          <SelectValue placeholder="Etapa" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={NAO_ALTERAR}>Não alterar</SelectItem>
          {estagiosAbertos.map((estagio) => (
            <SelectItem key={estagio.id} value={estagio.id}>
              {estagio.nome}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {camposAtivos.length > 0 && (
        <Select value={campoId ?? ""} onValueChange={escolherCampo}>
          <SelectTrigger aria-label="Campo" className="h-8 w-[170px] text-xs">
            <SelectValue placeholder="Campo" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={NAO_ALTERAR}>Não alterar</SelectItem>
            {camposAtivos.map((c) => (
              <SelectItem key={c.id} value={c.id}>
                {c.nome}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}
      {campo !== null && (
        <div className="min-w-[200px]">
          <CamposDoFormulario
            campos={[campo]}
            valores={valores}
            aoMudar={setValores}
            problemas={problemaDoCampo}
          />
        </div>
      )}

      <div className="ml-auto flex items-center gap-2">
        <Button type="button" variant="ghost" size="sm" className="h-8 text-xs" onClick={aoLimpar}>
          Limpar
        </Button>
        <Button
          type="button"
          size="sm"
          className="h-8 text-xs"
          disabled={!temAcao || pendente || campoIncompleto}
          onClick={() => {
            const acao = montarAcao();
            if (podeDisparar(acao)) aoAplicar(acao);
          }}
        >
          {pendente ? "Aplicando…" : "Aplicar"}
        </Button>
      </div>

      {(responsaveisFalharam || camposFalharam) && (
        <p role="status" className="basis-full text-xs text-destructive">
          Não foi possível ler {responsaveisFalharam ? "os responsáveis" : "os campos"}
          {responsaveisFalharam && camposFalharam && " nem os campos"}. Recarregue a página.
        </p>
      )}

      <DialogoDeMotivo
        saindo={saindo}
        aoFechar={() => setSaindo(null)}
        pendente={pendente}
        aoConfirmarLote={(motivo) => {
          if (saindo === null) return;
          const acao = montarAcao({
            estagioId: saindo.destino.id,
            motivoId: motivo.motivoId,
            ...(motivo.obs !== null && { motivoObs: motivo.obs }),
          });
          if (!podeDisparar(acao)) {
            setSaindo(null);
            return;
          }
          aoAplicar(acao);
        }}
      />
    </section>
  );
}
