import { AlertTriangle, ArrowDown, ArrowUp, Trash2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { useProfile } from "@/hooks/use-profile";
import { CampoEditavel } from "@/shared/ui/campo-editavel";
import { DialogoDeExclusao } from "@/shared/ui/dialogo-de-exclusao";
import { FalhaAoLer } from "@/shared/ui/falha-ao-ler";
import { estadoDaConsulta } from "@/shared/ui/estado-da-consulta";

import {
  ehTipoDeCampo,
  problemasDaDefinicao,
  ROTULO_DO_TIPO,
  TIPOS_DE_CAMPO,
  type CampoDoPipeline,
  type RascunhoDeCampo,
  type TipoDeCampo,
} from "../domain/campos";
import {
  MAXIMO_DE_CAMPOS,
  MAXIMO_DE_ESTAGIOS,
  MAXIMO_DE_PIPELINES,
  MOTIVOS_POR_TIPO,
} from "../domain/limites";
import {
  ehTipoDeEstagio,
  PIPELINE_PADRAO,
  problemasDosEstagios,
  problemasDosMotivos,
  type EstagioDoPipeline,
  type MotivoDeSaida,
  type Pipeline,
  type TipoDeEstagio,
} from "../domain/pipeline";
import { ORDEM_DOS_ESTAGIOS, rotuloDoEstagio } from "../domain/stage";
import {
  useApagarPipeline,
  useArquivarPipeline,
  useCampos,
  useCriarPipeline,
  useEstagios,
  useMotivos,
  usePipelines,
  useRenomearPipeline,
  useSalvarCampos,
  useSalvarEstagios,
  useSalvarMotivos,
} from "../hooks/use-pipeline";

const TETO_NOME_DE_PIPELINE = 60;
const TETO_NOME_DE_ESTAGIO = 40;
const TETO_ROTULO_DE_MOTIVO = 60;
const TETO_NOME_DE_CAMPO = 60;
const TETO_TEXTO_DE_OPCOES = 2000;

interface LinhaDeEstagio {
  readonly chave: string;
  readonly id?: string;
  readonly nome: string;
  readonly tipo: TipoDeEstagio;
}

interface LinhaDeMotivo {
  readonly chave: string;
  readonly id?: string;
  readonly tipo: MotivoDeSaida["tipo"];
  readonly rotulo: string;
  readonly ativo: boolean;
}

interface LinhaDeCampo {
  readonly chave: string;
  readonly id?: string;
  readonly nome: string;
  readonly tipo: TipoDeCampo;
  readonly opcoesTexto: string;
  readonly obrigatorio: boolean;
  readonly ativo: boolean;
}

function assinaturaDosEstagios(estagios: readonly EstagioDoPipeline[]): string {
  return estagios.map((e) => `${e.id}|${e.nome}|${e.ordem}|${e.tipo}`).join(";");
}

function assinaturaDosMotivos(motivos: readonly MotivoDeSaida[]): string {
  return motivos.map((m) => `${m.id}|${m.rotulo}|${m.ordem}|${m.tipo}|${m.ativo}`).join(";");
}

function assinaturaDosCampos(campos: readonly CampoDoPipeline[]): string {
  return JSON.stringify(campos);
}

function linhaDoCampo(c: CampoDoPipeline): LinhaDeCampo {
  return {
    chave: c.id,
    id: c.id,
    nome: c.nome,
    tipo: c.tipo,
    opcoesTexto: (c.opcoes ?? []).join("\n"),
    obrigatorio: c.obrigatorio,
    ativo: c.ativo,
  };
}

function rascunhoDeCampos(linhas: readonly LinhaDeCampo[]): RascunhoDeCampo[] {
  return linhas.map((l, i) => ({
    id: l.id,
    nome: l.nome.trim(),
    tipo: l.tipo,
    opcoes:
      l.tipo === "lista"
        ? l.opcoesTexto
            .split("\n")
            .map((o) => o.trim())
            .filter((o) => o !== "")
        : null,
    obrigatorio: l.obrigatorio,
    ordem: i,
    ativo: l.ativo,
  }));
}

let proximaChave = 0;
const chaveNova = () => `novo-${++proximaChave}`;

function estagiosPadrao(): LinhaDeEstagio[] {
  return ORDEM_DOS_ESTAGIOS.map((tipo) => ({
    chave: chaveNova(),
    nome: rotuloDoEstagio(tipo),
    tipo,
  }));
}

function mover<T>(lista: readonly T[], de: number, para: number): T[] {
  if (para < 0 || para >= lista.length) return [...lista];
  const copia = [...lista];
  const [item] = copia.splice(de, 1);
  copia.splice(para, 0, item);
  return copia;
}

function problemasDoRascunho(linhas: readonly LinhaDeEstagio[]): readonly string[] {
  return problemasDosEstagios(
    linhas.map<EstagioDoPipeline>((l, i) => ({
      id: l.id ?? "",
      pipelineId: "",
      nome: l.nome,
      ordem: i,
      tipo: l.tipo,
    })),
  );
}

function problemasDosMotivosDoRascunho(linhas: readonly LinhaDeMotivo[]): readonly string[] {
  return problemasDosMotivos(
    linhas.map<MotivoDeSaida>((l, i) => ({
      id: l.id ?? "",
      pipelineId: "",
      tipo: l.tipo,
      rotulo: l.rotulo,
      ordem: i,
      ativo: l.ativo,
    })),
  );
}

export function PipelinesSettings() {
  const pipelines = usePipelines(true);
  const { papel } = useProfile();
  const arquivar = useArquivarPipeline();
  const apagar = useApagarPipeline();
  const [abertoId, setAbertoId] = useState<string | null>(null);
  const [criando, setCriando] = useState(false);
  const estado = estadoDaConsulta(pipelines);

  if (estado === "erro") return <FalhaAoLer oQue="os pipelines" />;
  if (estado === "carregando") {
    return <div className="h-48 animate-pulse rounded-xl border bg-card" />;
  }

  const podeEditar = papel === "owner" || papel === "manager";
  const lista = pipelines.data ?? [];
  const ativos = lista.filter((p) => p.ativo).length;
  const noMaximo = lista.length >= MAXIMO_DE_PIPELINES;

  return (
    <Card className="space-y-4 p-6 shadow-card">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-lg font-semibold">Pipelines</h3>
          <p className="text-sm text-muted-foreground">
            Cada pipeline tem os próprios estágios e motivos de saída. O tipo do estágio é o que
            funil, placar e relatórios leem.
          </p>
        </div>
        {podeEditar && !criando && (
          <Button
            type="button"
            size="sm"
            disabled={noMaximo}
            title={
              noMaximo
                ? `Máximo de ${MAXIMO_DE_PIPELINES} pipelines, contando arquivados`
                : undefined
            }
            onClick={() => setCriando(true)}
          >
            Novo pipeline
          </Button>
        )}
      </div>

      {criando && <FormularioDeNovoPipeline onFechar={() => setCriando(false)} />}

      <div className="space-y-2">
        {lista.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nenhum pipeline ainda.</p>
        ) : (
          lista.map((p) => (
            <LinhaDePipeline
              key={p.id}
              pipeline={p}
              podeEditar={podeEditar}
              aberto={abertoId === p.id}
              onAlternar={() => setAbertoId(abertoId === p.id ? null : p.id)}
              arquivando={arquivar.isPending}
              unicoAtivo={p.ativo && ativos === 1}
              onArquivar={(ativo) => arquivar.mutate({ id: p.id, ativo })}
              apagando={apagar.isPending}
              onApagar={() => apagar.mutate(p.id)}
            />
          ))
        )}
      </div>
    </Card>
  );
}

function LinhaDePipeline({
  pipeline,
  podeEditar,
  aberto,
  onAlternar,
  arquivando,
  unicoAtivo,
  onArquivar,
  apagando,
  onApagar,
}: {
  readonly pipeline: Pipeline;
  readonly podeEditar: boolean;
  readonly aberto: boolean;
  readonly onAlternar: () => void;
  readonly arquivando: boolean;
  readonly unicoAtivo: boolean;
  readonly onArquivar: (ativo: boolean) => void;
  readonly apagando: boolean;
  readonly onApagar: () => void;
}) {
  const estagios = useEstagios(pipeline.id);
  const estado = estadoDaConsulta(estagios);
  const quantos = estagios.data?.length ?? 0;

  return (
    <div className="rounded-lg border">
      <div className="flex items-center gap-3 p-3">
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium">{pipeline.nome}</p>
          <p className="text-xs text-muted-foreground tabular-nums">
            {estado === "erro"
              ? "estágios ilegíveis"
              : estado === "carregando"
                ? "…"
                : `${quantos} ${quantos === 1 ? "estágio" : "estágios"}`}
          </p>
        </div>
        {!pipeline.ativo && (
          <span className="rounded-md bg-muted px-2 py-0.5 text-[11px] text-muted-foreground">
            arquivado
          </span>
        )}
        {podeEditar && (
          <>
            <Button type="button" size="sm" variant="outline" onClick={onAlternar}>
              {aberto ? `Fechar ${pipeline.nome}` : `Editar ${pipeline.nome}`}
            </Button>
            <Button
              type="button"
              size="sm"
              variant={pipeline.ativo ? "outline" : "default"}
              disabled={arquivando || unicoAtivo}
              title={unicoAtivo ? "Único pipeline ativo; reative outro antes" : undefined}
              onClick={() => onArquivar(!pipeline.ativo)}
            >
              {pipeline.ativo ? `Arquivar ${pipeline.nome}` : `Reativar ${pipeline.nome}`}
            </Button>
            {pipeline.id !== PIPELINE_PADRAO && (
              <DialogoDeExclusao
                gatilho={
                  <Button type="button" size="sm" variant="destructive">
                    {`Apagar ${pipeline.nome}`}
                  </Button>
                }
                titulo={`Apagar "${pipeline.nome}"?`}
                pendente={apagando}
                onConfirmar={onApagar}
              >
                <p>
                  Apaga o pipeline com os estágios, os motivos de saída e os campos personalizados.
                </p>
                <p>
                  Só se apaga pipeline sem oportunidades: apague-as antes, ou arquive o pipeline em
                  vez de apagar. O pipeline padrão não se apaga.
                </p>
                <p>Esta ação não pode ser desfeita.</p>
              </DialogoDeExclusao>
            )}
          </>
        )}
      </div>
      {podeEditar && aberto && (
        <div className="space-y-6 border-t p-3">
          {estado === "erro" ? (
            <FalhaAoLer oQue="os estágios" />
          ) : estado === "carregando" ? (
            <div className="h-24 animate-pulse rounded-md bg-muted" />
          ) : (
            <EditorDoPipeline
              key={`${pipeline.id}:${assinaturaDosEstagios(estagios.data ?? [])}`}
              pipeline={pipeline}
              estagios={estagios.data ?? []}
            />
          )}
        </div>
      )}
    </div>
  );
}

function FormularioDeNovoPipeline({ onFechar }: { readonly onFechar: () => void }) {
  const criar = useCriarPipeline();
  const [nome, setNome] = useState("");
  const [rascunho, setRascunho] = useState<LinhaDeEstagio[]>(estagiosPadrao);
  const problemas = problemasDoRascunho(rascunho);
  const nomeLimpo = nome.trim();
  const podeCriar = nomeLimpo !== "" && problemas.length === 0 && !criar.isPending;

  return (
    <div className="space-y-3 rounded-lg border border-primary/40 p-3">
      <div className="space-y-1.5">
        <Label htmlFor="novo-pipeline-nome">Nome do novo pipeline</Label>
        <Input
          id="novo-pipeline-nome"
          value={nome}
          maxLength={TETO_NOME_DE_PIPELINE}
          className="h-8 text-xs"
          onChange={(e) => setNome(e.target.value)}
        />
      </div>
      <EditorDeEstagios rascunho={rascunho} onChange={setRascunho} disabled={criar.isPending} />
      <div className="flex flex-wrap items-center gap-3">
        <Button
          type="button"
          size="sm"
          disabled={!podeCriar}
          onClick={() => {
            if (!podeCriar) return;
            criar.mutate(
              {
                nome: nomeLimpo,
                estagios: rascunho.map(({ nome: n, tipo }) => ({ nome: n.trim(), tipo })),
              },
              { onSuccess: onFechar },
            );
          }}
        >
          Criar pipeline
        </Button>
        <Button type="button" size="sm" variant="ghost" onClick={onFechar}>
          Cancelar
        </Button>
        <Problemas lista={problemas} />
      </div>
      <p className="text-[11px] text-muted-foreground">
        Os motivos de perda e descarte nascem copiados do pipeline padrão e podem ser editados
        depois.
      </p>
    </div>
  );
}

function EditorDoPipeline({
  pipeline,
  estagios,
}: {
  readonly pipeline: Pipeline;
  readonly estagios: readonly EstagioDoPipeline[];
}) {
  const renomear = useRenomearPipeline();
  const salvar = useSalvarEstagios();
  const [rascunho, setRascunho] = useState<LinhaDeEstagio[]>(() =>
    estagios.map((e) => ({ chave: e.id, id: e.id, nome: e.nome, tipo: e.tipo })),
  );

  const problemas = problemasDoRascunho(rascunho);
  const podeSalvar = problemas.length === 0 && !salvar.isPending;

  return (
    <>
      <div className="max-w-sm">
        <CampoEditavel
          id={`pipeline-nome-${pipeline.id}`}
          rotulo="Nome do pipeline"
          valor={pipeline.nome}
          disabled={renomear.isPending}
          onGravar={(nome) => {
            const limpo = nome.trim();
            if (limpo === "" || limpo.length > TETO_NOME_DE_PIPELINE) {
              toast.error(`O nome tem de 1 a ${TETO_NOME_DE_PIPELINE} caracteres.`);
              return;
            }
            renomear.mutate({ id: pipeline.id, nome: limpo });
          }}
        />
      </div>

      <section className="space-y-2" aria-label="Estágios">
        <div>
          <h4 className="text-sm font-semibold">Estágios</h4>
          <p className="text-[11px] text-muted-foreground">
            Estágio removido some ao salvar; estágio com oportunidades não pode ser removido:
            mova-as antes.
          </p>
        </div>
        <EditorDeEstagios rascunho={rascunho} onChange={setRascunho} disabled={salvar.isPending} />
        <div className="flex flex-wrap items-center gap-3">
          <Button
            type="button"
            size="sm"
            disabled={!podeSalvar}
            onClick={() => {
              if (!podeSalvar) return;
              salvar.mutate({
                pipelineId: pipeline.id,
                estagios: rascunho.map(({ id, nome, tipo }) => ({ id, nome: nome.trim(), tipo })),
              });
            }}
          >
            Salvar estágios
          </Button>
          <Problemas lista={problemas} />
        </div>
      </section>

      <EditorDeMotivos pipelineId={pipeline.id} />
      <EditorDeCampos pipelineId={pipeline.id} />
    </>
  );
}

function EditorDeEstagios({
  rascunho,
  onChange,
  disabled,
}: {
  readonly rascunho: readonly LinhaDeEstagio[];
  readonly onChange: (linhas: LinhaDeEstagio[]) => void;
  readonly disabled: boolean;
}) {
  const trocar = (i: number, mudanca: Partial<LinhaDeEstagio>) =>
    onChange(rascunho.map((l, j) => (j === i ? { ...l, ...mudanca } : l)));

  return (
    <div className="space-y-1.5">
      {rascunho.map((linha, i) => {
        const rotulo = linha.nome.trim() || `estágio ${i + 1}`;
        return (
          <div key={linha.chave} className="flex items-center gap-2">
            <span className="w-5 text-right text-[11px] text-muted-foreground tabular-nums">
              {i + 1}
            </span>
            <Input
              aria-label={`Nome do estágio ${i + 1}`}
              value={linha.nome}
              maxLength={TETO_NOME_DE_ESTAGIO}
              disabled={disabled}
              className="h-8 flex-1 text-xs"
              onChange={(e) => trocar(i, { nome: e.target.value })}
            />
            <Select
              value={linha.tipo}
              disabled={disabled}
              onValueChange={(tipo) => {
                if (ehTipoDeEstagio(tipo)) trocar(i, { tipo });
              }}
            >
              <SelectTrigger aria-label={`Tipo de ${rotulo}`} className="h-8 w-[170px] text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {ORDEM_DOS_ESTAGIOS.map((tipo) => (
                  <SelectItem key={tipo} value={tipo}>
                    {rotuloDoEstagio(tipo)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <BotoesDeLinha
              rotulo={rotulo}
              disabled={disabled}
              primeira={i === 0}
              ultima={i === rascunho.length - 1}
              onSubir={() => onChange(mover(rascunho, i, i - 1))}
              onDescer={() => onChange(mover(rascunho, i, i + 1))}
              onRemover={() => onChange(rascunho.filter((_, j) => j !== i))}
            />
          </div>
        );
      })}
      <Button
        type="button"
        size="sm"
        variant="outline"
        disabled={disabled || rascunho.length >= MAXIMO_DE_ESTAGIOS}
        title={
          rascunho.length >= MAXIMO_DE_ESTAGIOS
            ? `Máximo de ${MAXIMO_DE_ESTAGIOS} estágios por pipeline`
            : undefined
        }
        onClick={() =>
          onChange([...rascunho, { chave: chaveNova(), nome: "", tipo: "prospeccao" }])
        }
      >
        Adicionar estágio
      </Button>
    </div>
  );
}

function EditorDeMotivos({ pipelineId }: { readonly pipelineId: string }) {
  const motivos = useMotivos(pipelineId, true);
  const estado = estadoDaConsulta(motivos);
  if (estado === "erro") return <FalhaAoLer oQue="os motivos de saída" />;
  if (estado === "carregando") return <div className="h-24 animate-pulse rounded-md bg-muted" />;

  return (
    <FormularioDeMotivos
      key={`${pipelineId}:${assinaturaDosMotivos(motivos.data ?? [])}`}
      pipelineId={pipelineId}
      motivos={motivos.data ?? []}
    />
  );
}

function FormularioDeMotivos({
  pipelineId,
  motivos,
}: {
  readonly pipelineId: string;
  readonly motivos: readonly MotivoDeSaida[];
}) {
  const salvar = useSalvarMotivos();
  const [rascunho, setRascunho] = useState<LinhaDeMotivo[]>(() =>
    motivos.map((m) => ({ chave: m.id, id: m.id, tipo: m.tipo, rotulo: m.rotulo, ativo: m.ativo })),
  );

  const problemas = problemasDosMotivosDoRascunho(rascunho);
  const podeSalvar = problemas.length === 0 && !salvar.isPending;

  return (
    <section className="space-y-3" aria-label="Motivos de saída">
      <div>
        <h4 className="text-sm font-semibold">Motivos de saída</h4>
        <p className="text-[11px] text-muted-foreground">
          Motivo já usado em oportunidade não pode ser apagado. Desative.
        </p>
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        <ListaDeMotivos
          tipo="perda"
          titulo="Motivos de perda"
          rascunho={rascunho}
          onChange={setRascunho}
          disabled={salvar.isPending}
        />
        <ListaDeMotivos
          tipo="descarte"
          titulo="Motivos de descarte"
          rascunho={rascunho}
          onChange={setRascunho}
          disabled={salvar.isPending}
        />
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <Button
          type="button"
          size="sm"
          disabled={!podeSalvar}
          onClick={() => {
            if (!podeSalvar) return;
            salvar.mutate({
              pipelineId,
              motivos: rascunho.map(({ id, tipo, rotulo, ativo }) => ({ id, tipo, rotulo, ativo })),
            });
          }}
        >
          Salvar motivos
        </Button>
        <Problemas lista={problemas} />
      </div>
    </section>
  );
}

function ListaDeMotivos({
  tipo,
  titulo,
  rascunho,
  onChange,
  disabled,
}: {
  readonly tipo: MotivoDeSaida["tipo"];
  readonly titulo: string;
  readonly rascunho: readonly LinhaDeMotivo[];
  readonly onChange: (linhas: LinhaDeMotivo[]) => void;
  readonly disabled: boolean;
}) {
  const indices = rascunho.map((l, i) => (l.tipo === tipo ? i : -1)).filter((i) => i >= 0);
  const trocar = (i: number, mudanca: Partial<LinhaDeMotivo>) =>
    onChange(rascunho.map((l, j) => (j === i ? { ...l, ...mudanca } : l)));
  const trocarPosicao = (a: number, b: number) => {
    const copia = [...rascunho];
    [copia[a], copia[b]] = [copia[b], copia[a]];
    onChange(copia);
  };

  return (
    <fieldset className="space-y-1.5" aria-label={titulo}>
      <legend className="mb-1 text-xs font-medium text-muted-foreground">{titulo}</legend>
      {indices.map((i, posicao) => {
        const linha = rascunho[i];
        const rotulo = linha.rotulo.trim() || `motivo ${posicao + 1}`;
        return (
          <div key={linha.chave} className="flex items-center gap-2">
            <Input
              aria-label={`Motivo de ${tipo} ${posicao + 1}`}
              value={linha.rotulo}
              maxLength={TETO_ROTULO_DE_MOTIVO}
              disabled={disabled}
              className={`h-8 flex-1 text-xs ${linha.ativo ? "" : "text-muted-foreground line-through"}`}
              onChange={(e) => trocar(i, { rotulo: e.target.value })}
            />
            <Switch
              aria-label={`${rotulo} ativo`}
              checked={linha.ativo}
              disabled={disabled}
              onCheckedChange={(ativo) => trocar(i, { ativo })}
            />
            <BotoesDeLinha
              rotulo={rotulo}
              disabled={disabled}
              primeira={posicao === 0}
              ultima={posicao === indices.length - 1}
              onSubir={() => trocarPosicao(i, indices[posicao - 1])}
              onDescer={() => trocarPosicao(i, indices[posicao + 1])}
              onRemover={() => onChange(rascunho.filter((_, j) => j !== i))}
            />
          </div>
        );
      })}
      <Button
        type="button"
        size="sm"
        variant="outline"
        disabled={disabled || indices.length >= MOTIVOS_POR_TIPO}
        title={
          indices.length >= MOTIVOS_POR_TIPO
            ? `Máximo de ${MOTIVOS_POR_TIPO} motivos de ${tipo}`
            : undefined
        }
        onClick={() =>
          onChange([...rascunho, { chave: chaveNova(), tipo, rotulo: "", ativo: true }])
        }
      >
        Adicionar motivo
      </Button>
    </fieldset>
  );
}

function EditorDeCampos({ pipelineId }: { readonly pipelineId: string }) {
  const campos = useCampos(pipelineId, true);
  const estado = estadoDaConsulta(campos);
  if (estado === "erro") return <FalhaAoLer oQue="os campos personalizados" />;
  if (estado === "carregando") return <div className="h-24 animate-pulse rounded-md bg-muted" />;

  return (
    <FormularioDeCampos
      key={`${pipelineId}:${assinaturaDosCampos(campos.data ?? [])}`}
      pipelineId={pipelineId}
      campos={campos.data ?? []}
    />
  );
}

function FormularioDeCampos({
  pipelineId,
  campos,
}: {
  readonly pipelineId: string;
  readonly campos: readonly CampoDoPipeline[];
}) {
  const salvar = useSalvarCampos();
  const [rascunho, setRascunho] = useState<LinhaDeCampo[]>(() => campos.map(linhaDoCampo));
  const trocar = (i: number, mudanca: Partial<LinhaDeCampo>) =>
    setRascunho(rascunho.map((l, j) => (j === i ? { ...l, ...mudanca } : l)));

  const paraGravar = rascunhoDeCampos(rascunho);
  const problema = problemasDaDefinicao(paraGravar);
  const disabled = salvar.isPending;
  const podeSalvar = problema === null && !disabled;
  const noMaximo = rascunho.length >= MAXIMO_DE_CAMPOS;

  return (
    <section className="space-y-3" aria-label="Campos personalizados">
      <div>
        <h4 className="text-sm font-semibold">Campos personalizados</h4>
        <p className="text-[11px] text-muted-foreground">
          Aparecem no formulário de nova oportunidade e na ficha deste pipeline. Campo com valor
          gravado não pode ser apagado. Desative.
        </p>
      </div>
      <div className="space-y-2">
        {rascunho.length === 0 && (
          <p className="text-xs text-muted-foreground">Nenhum campo ainda.</p>
        )}
        {rascunho.map((linha, i) => {
          const rotulo = linha.nome.trim() || `campo ${i + 1}`;
          return (
            <div key={linha.chave} className="space-y-1.5">
              <div className="flex flex-wrap items-center gap-2">
                <Input
                  aria-label={`Nome do campo ${i + 1}`}
                  value={linha.nome}
                  maxLength={TETO_NOME_DE_CAMPO}
                  disabled={disabled}
                  className={`h-8 min-w-40 flex-1 text-xs ${linha.ativo ? "" : "text-muted-foreground line-through"}`}
                  onChange={(e) => trocar(i, { nome: e.target.value })}
                />
                <Select
                  value={linha.tipo}
                  disabled={disabled}
                  onValueChange={(tipo) => {
                    if (ehTipoDeCampo(tipo)) trocar(i, { tipo });
                  }}
                >
                  <SelectTrigger
                    aria-label={`Tipo do campo ${rotulo}`}
                    className="h-8 w-[120px] text-xs"
                  >
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {TIPOS_DE_CAMPO.map((tipo) => (
                      <SelectItem key={tipo} value={tipo}>
                        {ROTULO_DO_TIPO[tipo]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <label className="flex items-center gap-1.5 text-xs">
                  <Checkbox
                    aria-label={`${rotulo} obrigatório`}
                    checked={linha.obrigatorio}
                    disabled={disabled}
                    onCheckedChange={(marcado) => trocar(i, { obrigatorio: marcado === true })}
                  />
                  Obrigatório
                </label>
                <Switch
                  aria-label={`${rotulo} ativo`}
                  checked={linha.ativo}
                  disabled={disabled}
                  onCheckedChange={(ativo) => trocar(i, { ativo })}
                />
                <BotoesDeLinha
                  rotulo={rotulo}
                  disabled={disabled}
                  primeira={i === 0}
                  ultima={i === rascunho.length - 1}
                  onSubir={() => setRascunho(mover(rascunho, i, i - 1))}
                  onDescer={() => setRascunho(mover(rascunho, i, i + 1))}
                  onRemover={() => setRascunho(rascunho.filter((_, j) => j !== i))}
                />
              </div>
              {linha.tipo === "lista" && (
                <Textarea
                  aria-label={`Opções de ${rotulo}`}
                  placeholder="Uma opção por linha"
                  value={linha.opcoesTexto}
                  maxLength={TETO_TEXTO_DE_OPCOES}
                  rows={3}
                  disabled={disabled}
                  className="min-h-0 text-xs"
                  onChange={(e) => trocar(i, { opcoesTexto: e.target.value })}
                />
              )}
            </div>
          );
        })}
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={disabled || noMaximo}
          title={noMaximo ? `Máximo de ${MAXIMO_DE_CAMPOS} campos por pipeline.` : undefined}
          onClick={() =>
            setRascunho([
              ...rascunho,
              {
                chave: chaveNova(),
                nome: "",
                tipo: "texto",
                opcoesTexto: "",
                obrigatorio: false,
                ativo: true,
              },
            ])
          }
        >
          Adicionar campo
        </Button>
        <Button
          type="button"
          size="sm"
          disabled={!podeSalvar}
          onClick={() => {
            if (!podeSalvar) return;
            salvar.mutate({ pipelineId, rascunho: paraGravar });
          }}
        >
          Salvar campos
        </Button>
        <Problemas lista={problema === null ? [] : [problema]} />
      </div>
    </section>
  );
}

function BotoesDeLinha({
  rotulo,
  disabled,
  primeira,
  ultima,
  onSubir,
  onDescer,
  onRemover,
}: {
  readonly rotulo: string;
  readonly disabled: boolean;
  readonly primeira: boolean;
  readonly ultima: boolean;
  readonly onSubir: () => void;
  readonly onDescer: () => void;
  readonly onRemover: () => void;
}) {
  return (
    <div className="flex items-center gap-0.5">
      <Button
        type="button"
        size="icon"
        variant="ghost"
        className="h-8 w-8"
        aria-label={`Subir ${rotulo}`}
        disabled={disabled || primeira}
        onClick={onSubir}
      >
        <ArrowUp className="h-3.5 w-3.5" aria-hidden="true" />
      </Button>
      <Button
        type="button"
        size="icon"
        variant="ghost"
        className="h-8 w-8"
        aria-label={`Descer ${rotulo}`}
        disabled={disabled || ultima}
        onClick={onDescer}
      >
        <ArrowDown className="h-3.5 w-3.5" aria-hidden="true" />
      </Button>
      <Button
        type="button"
        size="icon"
        variant="ghost"
        className="h-8 w-8 text-destructive hover:text-destructive"
        aria-label={`Remover ${rotulo}`}
        disabled={disabled}
        onClick={onRemover}
      >
        <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
      </Button>
    </div>
  );
}

function Problemas({ lista }: { readonly lista: readonly string[] }) {
  if (lista.length === 0) return null;
  return (
    <ul className="space-y-0.5 text-[11px] text-destructive" aria-live="polite">
      {lista.map((p) => (
        <li key={p} className="flex items-center gap-1">
          <AlertTriangle className="h-3 w-3 shrink-0" aria-hidden="true" />
          {p}
        </li>
      ))}
    </ul>
  );
}
