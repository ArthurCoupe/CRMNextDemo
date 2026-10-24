import { useState } from "react";
import { AlertTriangle } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ehDataCivilPlausivel } from "@/shared/lib/date";
import { estadoDaConsulta } from "@/shared/ui/estado-da-consulta";

import { extrairRef } from "../domain/attribution";
import { apararValores, problemasDosValores, type ValoresDeCampos } from "../domain/campos";
import { CANAIS, rotuloDoCanal } from "../domain/channel";
import {
  useCampos,
  useCriarOportunidade,
  usePipelines,
  useResponsaveis,
  useVincularRef,
} from "../hooks/use-pipeline";
import { CamposDoFormulario } from "./campos-da-oportunidade";

interface NewOpportunityFormProps {
  aberto: boolean;
  pipelineIdPadrao: string;
  aoFechar: () => void;
}

export function NewOpportunityForm({
  aberto,
  pipelineIdPadrao,
  aoFechar,
}: NewOpportunityFormProps) {
  const criar = useCriarOportunidade();
  const vincular = useVincularRef();
  const pipelines = usePipelines();
  const pipelinesFalharam = estadoDaConsulta(pipelines) === "erro";
  const consultaDeResponsaveis = useResponsaveis(null);
  const responsaveisFalharam = estadoDaConsulta(consultaDeResponsaveis) === "erro";
  const responsaveis = consultaDeResponsaveis.data ?? [];

  const [nome, setNome] = useState("");
  const [pipelineEscolhido, setPipelineEscolhido] = useState("");
  const ativos = pipelines.data ?? [];
  const pipelineId =
    pipelineEscolhido ||
    (ativos.some((p) => p.id === pipelineIdPadrao) || pipelinesFalharam
      ? pipelineIdPadrao
      : (ativos[0]?.id ?? ""));
  const [segmento, setSegmento] = useState("");
  const [nicho, setNicho] = useState("");
  const [contatoNome, setContatoNome] = useState("");
  const [contatoTelefone, setContatoTelefone] = useState("");
  const [canal, setCanal] = useState("");
  const [linhaDeNegocio, setLinhaDeNegocio] = useState("");
  const [responsavelId, setResponsavelId] = useState("");
  const [followUp, setFollowUp] = useState("");
  const [refColado, setRefColado] = useState("");

  const consultaDeCampos = useCampos(pipelineId || null);
  const estadoDosCampos = estadoDaConsulta(consultaDeCampos);
  const campos = consultaDeCampos.data ?? [];
  const [rascunho, setRascunho] = useState<{ pipelineId: string; valores: ValoresDeCampos }>({
    pipelineId: "",
    valores: {},
  });
  const valores = rascunho.pipelineId === pipelineId ? rascunho.valores : {};
  const camposParaEnvio = apararValores(valores);
  const problemasDosCampos = problemasDosValores(campos, camposParaEnvio);

  function limpar() {
    setNome("");
    setPipelineEscolhido("");
    setSegmento("");
    setNicho("");
    setRascunho({ pipelineId: "", valores: {} });
    setContatoNome("");
    setContatoTelefone("");
    setCanal("");
    setLinhaDeNegocio("");
    setResponsavelId("");
    setFollowUp("");
    setRefColado("");
  }

  const refInformado = refColado.trim() !== "";
  const refValido = refInformado ? extrairRef(refColado) : null;
  const followUpPlausivel = followUp === "" || ehDataCivilPlausivel(followUp);

  async function aoSalvar() {
    let id: string;
    try {
      id = await criar.mutateAsync({
        pipelineId,
        nome: nome.trim(),
        segmento: segmento.trim() || null,
        nicho: nicho.trim() || null,
        contatoNome: contatoNome.trim() || null,
        contatoTelefone: contatoTelefone.trim() || null,
        canal,
        linhaDeNegocio: (linhaDeNegocio || null) as "demanda" | "sistemas" | null,
        responsavelId: responsavelId || null,
        proximoFollowUp: followUp || null,
        campos: camposParaEnvio,
      });
    } catch (erro) {
      toast.error(erro instanceof Error ? erro.message : "Não foi possível criar.");
      return;
    }
    limpar();
    aoFechar();

    if (refValido === null) {
      toast.success("Oportunidade criada.");
      return;
    }
    try {
      const resultado = await vincular.mutateAsync({
        oportunidadeId: id,
        attributionId: refValido,
      });
      if (resultado.status === "vinculado") {
        toast.success("Oportunidade criada com atribuição vinculada.");
      } else if (resultado.status === "ja_vinculado") {
        toast.warning(
          "Oportunidade criada, mas o ref já pertence a outra: um toque só conta uma conversão.",
        );
      } else {
        toast.warning("Oportunidade criada, mas o ref não foi encontrado.");
      }
    } catch {
      toast.warning("Oportunidade criada; o ref não vinculou. Cole na ficha.");
    }
  }

  return (
    <Dialog open={aberto} onOpenChange={(abrir) => !abrir && aoFechar()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Nova oportunidade</DialogTitle>
        </DialogHeader>

        <div className="grid gap-3">
          <div className="grid gap-1.5">
            <Label htmlFor="nova-oportunidade-nome">Nome *</Label>
            <Input
              id="nova-oportunidade-nome"
              value={nome}
              onChange={(evento) => setNome(evento.target.value)}
            />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="nova-oportunidade-pipeline">Pipeline</Label>
            <Select value={pipelineId} onValueChange={setPipelineEscolhido}>
              <SelectTrigger id="nova-oportunidade-pipeline">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {ativos.map((pipeline) => (
                  <SelectItem key={pipeline.id} value={pipeline.id}>
                    {pipeline.nome}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {pipelinesFalharam && (
              <p className="flex items-start gap-1.5 rounded-md border border-destructive/40 bg-destructive/10 px-2.5 py-2 text-[11px] text-destructive">
                <AlertTriangle className="mt-px h-3.5 w-3.5 shrink-0" aria-hidden />
                <span>
                  Não foi possível ler os pipelines; a oportunidade vai para o pipeline do board.
                </span>
              </p>
            )}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-1.5">
              <Label htmlFor="nova-oportunidade-segmento">Segmento</Label>
              <Input
                id="nova-oportunidade-segmento"
                value={segmento}
                onChange={(evento) => setSegmento(evento.target.value)}
              />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="nova-oportunidade-nicho">Nicho</Label>
              <Input
                id="nova-oportunidade-nicho"
                value={nicho}
                onChange={(evento) => setNicho(evento.target.value)}
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-1.5">
              <Label>Contato</Label>
              <Input
                value={contatoNome}
                onChange={(evento) => setContatoNome(evento.target.value)}
              />
            </div>
            <div className="grid gap-1.5">
              <Label>Telefone</Label>
              <Input
                value={contatoTelefone}
                onChange={(evento) => setContatoTelefone(evento.target.value)}
                placeholder="5511999999999"
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-1.5">
              <Label htmlFor="nova-oportunidade-canal">Canal *</Label>
              <Select value={canal} onValueChange={setCanal}>
                <SelectTrigger id="nova-oportunidade-canal">
                  <SelectValue placeholder="-" />
                </SelectTrigger>
                <SelectContent>
                  {CANAIS.map((canal) => (
                    <SelectItem key={canal} value={canal}>
                      {rotuloDoCanal(canal)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {canal === "" && (
                <p className="text-[11px] text-muted-foreground">
                  Escolha o canal: ele define o prazo do primeiro contato
                </p>
              )}
            </div>
            <div className="grid gap-1.5">
              <Label>Linha de negócio</Label>
              <Select value={linhaDeNegocio} onValueChange={setLinhaDeNegocio}>
                <SelectTrigger>
                  <SelectValue placeholder="-" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="demanda">Demanda</SelectItem>
                  <SelectItem value="sistemas">Sistemas</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid gap-1.5">
            <Label>Responsável</Label>
            <Select value={responsavelId} onValueChange={setResponsavelId}>
              <SelectTrigger>
                <SelectValue placeholder="-" />
              </SelectTrigger>
              <SelectContent>
                {responsaveis.map((responsavel) => (
                  <SelectItem key={responsavel.id} value={responsavel.id}>
                    {responsavel.nome}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {responsaveisFalharam && (
              <p className="flex items-start gap-1.5 rounded-md border border-destructive/40 bg-destructive/10 px-2.5 py-2 text-[11px] text-destructive">
                <AlertTriangle className="mt-px h-3.5 w-3.5 shrink-0" aria-hidden />
                <span>
                  Não foi possível ler a lista de pessoas. Ela está vazia por falha de leitura, não
                  por não haver ninguém. Dá para criar a oportunidade sem responsável e atribuir
                  depois na ficha.
                </span>
              </p>
            )}
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="nova-oportunidade-follow-up">Próximo follow-up</Label>
            <Input
              id="nova-oportunidade-follow-up"
              type="date"
              value={followUp}
              onChange={(evento) => setFollowUp(evento.target.value)}
            />
            {!followUpPlausivel && (
              <p role="alert" className="text-xs text-destructive">
                Data inválida. Use um ano entre 2000 e 2100.
              </p>
            )}
          </div>

          <div className="grid gap-1.5">
            <Label>Ref de atribuição (opcional)</Label>
            <Input
              value={refColado}
              onChange={(evento) => setRefColado(evento.target.value)}
              placeholder="Cole a mensagem com o ref:..."
            />
            {refInformado && refValido === null && (
              <p className="text-[11px] text-destructive">Não achei um ref válido nesse texto.</p>
            )}
            {refValido !== null && <p className="text-[11px] text-emerald-400">Ref reconhecido.</p>}
          </div>

          {estadoDosCampos === "erro" && (
            <p className="flex items-start gap-1.5 rounded-md border border-destructive/40 bg-destructive/10 px-2.5 py-2 text-[11px] text-destructive">
              <AlertTriangle className="mt-px h-3.5 w-3.5 shrink-0" aria-hidden />
              <span>
                Não foi possível ler os campos personalizados do pipeline. Se houver campo
                obrigatório, a criação vai ser recusada. Recarregue a página e tente de novo.
              </span>
            </p>
          )}
          <CamposDoFormulario
            campos={campos}
            valores={valores}
            aoMudar={(novos) => setRascunho({ pipelineId, valores: novos })}
            problemas={problemasDosCampos}
          />

          <div className="flex justify-end gap-2 border-t pt-3">
            <Button type="button" variant="outline" onClick={aoFechar}>
              Cancelar
            </Button>
            <Button
              type="button"
              disabled={
                nome.trim() === "" ||
                canal === "" ||
                pipelineId === "" ||
                (refInformado && refValido === null) ||
                !followUpPlausivel ||
                estadoDosCampos === "carregando" ||
                problemasDosCampos !== null ||
                criar.isPending ||
                vincular.isPending
              }
              onClick={() => void aoSalvar()}
            >
              Criar
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
