import { useRef, useState } from "react";
import { Download } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

import { plural } from "@/shared/lib/format";

import type { ResultadoDaLinha } from "../api/pipeline.repository";
import { CsvInvalido, lerCsv } from "../domain/csv";
import {
  decodificarCsv,
  MODELO_CSV,
  prepararImportacao,
  type LinhaDeImportacao,
  type Mapeamento,
} from "../domain/importacao";
import { useCampos, useImportarOportunidades, usePipelines } from "../hooks/use-pipeline";

interface ImportacaoDeCsvProps {
  aberto: boolean;
  pipelineIdPadrao: string;
  aoFechar: () => void;
}

interface ArquivoPreparado {
  readonly nome: string;
  readonly mapa: Mapeamento;
  readonly linhas: readonly LinhaDeImportacao[];
}

const HREF_DO_MODELO = "data:text/csv;charset=utf-8," + encodeURIComponent("\uFEFF" + MODELO_CSV);

const LINHAS_RENDERIZADAS = 200;

const VARIANTE_DA_ACAO = {
  nova: "success",
  atualiza: "default",
  erro: "destructive",
} as const;

function contar(resultado: readonly ResultadoDaLinha[]) {
  const novas = resultado.filter((linha) => linha.acao === "nova").length;
  const atualizam = resultado.filter((linha) => linha.acao === "atualiza").length;
  const erros = resultado.filter((linha) => linha.acao === "erro").length;
  return { novas, atualizam, erros };
}

function fraseDasContagens(
  resultado: readonly ResultadoDaLinha[],
  tempo: "previa" | "resultado",
): string {
  const { novas, atualizam, erros } = contar(resultado);
  const atualiza =
    tempo === "previa"
      ? plural(atualizam, "atualiza", "atualizam")
      : plural(atualizam, "atualizada", "atualizadas");
  return `${plural(novas, "nova", "novas")} · ${atualiza} · ${plural(erros, "erro", "erros")}`;
}

export function ImportacaoDeCsv({ aberto, pipelineIdPadrao, aoFechar }: ImportacaoDeCsvProps) {
  const importar = useImportarOportunidades();
  const pipelines = usePipelines();
  const ativos = pipelines.data ?? [];
  const [pipelineEscolhido, setPipelineEscolhido] = useState("");
  const pipelineId =
    pipelineEscolhido ||
    (ativos.some((p) => p.id === pipelineIdPadrao) ? pipelineIdPadrao : (ativos[0]?.id ?? ""));
  const nomeDoPipeline = ativos.find((p) => p.id === pipelineId)?.nome ?? "";
  const campos = useCampos(pipelineId || null);

  const [etapa, setEtapa] = useState<"arquivo" | "previa" | "resultado">("arquivo");
  const [erro, setErro] = useState<string | null>(null);
  const [preparado, setPreparado] = useState<ArquivoPreparado | null>(null);
  const [classificacao, setClassificacao] = useState<readonly ResultadoDaLinha[]>([]);
  const sessao = useRef(0);

  function fechar() {
    sessao.current += 1;
    setPipelineEscolhido("");
    setEtapa("arquivo");
    setErro(null);
    setPreparado(null);
    setClassificacao([]);
    aoFechar();
  }

  async function aoEscolherArquivo(arquivo: File | undefined) {
    const camposDoPipeline = campos.data;
    if (!arquivo || camposDoPipeline === undefined) return;
    setErro(null);
    if (arquivo.size > 5_000_000) {
      setErro("Arquivo acima de 5 MB.");
      return;
    }
    let pronto: ArquivoPreparado;
    try {
      const csv = lerCsv(decodificarCsv(await arquivo.arrayBuffer()));
      const { mapa, linhas } = prepararImportacao(csv, camposDoPipeline);
      pronto = { nome: arquivo.name, mapa, linhas };
    } catch (falha) {
      setErro(falha instanceof CsvInvalido ? falha.message : "Não foi possível ler o arquivo.");
      return;
    }
    setPreparado(pronto);
    const desta = sessao.current;
    importar.mutate(
      { pipelineId, linhas: pronto.linhas, previa: true, arquivo: pronto.nome },
      {
        onSuccess: (resultado) => {
          if (desta !== sessao.current) return;
          setClassificacao(resultado);
          setEtapa("previa");
        },
        onError: (falha) => {
          if (desta !== sessao.current) return;
          setErro(
            falha instanceof Error ? falha.message : "Não foi possível classificar o arquivo.",
          );
        },
      },
    );
  }

  function gravar() {
    if (preparado === null) return;
    setErro(null);
    const desta = sessao.current;
    importar.mutate(
      { pipelineId, linhas: preparado.linhas, previa: false, arquivo: preparado.nome },
      {
        onSuccess: (resultado) => {
          if (desta !== sessao.current) return;
          setClassificacao(resultado);
          setEtapa("resultado");
        },
        onError: (falha) => {
          if (desta !== sessao.current) return;
          setErro(
            falha instanceof Error ? falha.message : "Não foi possível importar as oportunidades.",
          );
        },
      },
    );
  }

  const { novas, atualizam } = contar(classificacao);
  const paraGravar = novas + atualizam;
  const dadosPorNumero = new Map(preparado?.linhas.map((linha) => [linha.numero, linha.dados]));
  const destacada = (linha: ResultadoDaLinha) => linha.acao === "erro" || linha.aviso !== undefined;
  const destacadas = classificacao.filter(destacada);
  const semErro = classificacao.filter((linha) => !destacada(linha));
  const semErroVisiveis =
    etapa === "resultado"
      ? []
      : semErro.slice(0, Math.max(0, LINHAS_RENDERIZADAS - destacadas.length));
  const linhasDaTabela = [...destacadas, ...semErroVisiveis].sort((a, b) => a.numero - b.numero);
  const semErroOcultas = etapa === "resultado" ? 0 : semErro.length - semErroVisiveis.length;

  return (
    <Dialog
      open={aberto}
      onOpenChange={(abrir) => {
        if (!abrir && !importar.isPending) fechar();
      }}
    >
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>Importar oportunidades por CSV</DialogTitle>
          <DialogDescription>
            Uma linha por oportunidade; telefone ou e-mail já cadastrado atualiza a existente sem
            movê-la.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-3">
          {etapa !== "resultado" && (
            <div className="grid gap-1.5">
              <Label htmlFor="importacao-pipeline">Pipeline de destino das novas</Label>
              <Select
                value={pipelineId}
                onValueChange={setPipelineEscolhido}
                disabled={etapa !== "arquivo" || importar.isPending}
              >
                <SelectTrigger id="importacao-pipeline" className="h-8">
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
            </div>
          )}

          {etapa === "arquivo" && (
            <>
              <div className="grid gap-1.5">
                <Label htmlFor="importacao-arquivo">Arquivo CSV</Label>
                <Input
                  id="importacao-arquivo"
                  type="file"
                  accept=".csv,text/csv"
                  disabled={importar.isPending || pipelineId === "" || campos.data === undefined}
                  onChange={(evento) => {
                    const arquivo = evento.target.files?.[0];
                    evento.target.value = "";
                    void aoEscolherArquivo(arquivo);
                  }}
                />
                <p className="text-[11px] text-secundario">
                  Separador <code>;</code> ou <code>,</code>, UTF-8 ou Windows-1252 (o que o Excel
                  exporta). Só a coluna <code>nome</code> é obrigatória; até 1.000 linhas.{" "}
                  <a
                    href={HREF_DO_MODELO}
                    download="modelo-de-importacao.csv"
                    className="inline-flex items-center gap-1 text-primary-texto underline-offset-2 hover:underline"
                  >
                    <Download className="h-3 w-3" aria-hidden /> Baixar modelo
                  </a>
                </p>
              </div>
              {importar.isPending && (
                <p className="text-xs text-secundario" aria-live="polite">
                  Classificando as linhas…
                </p>
              )}
              {campos.isError && (
                <p role="alert" className="text-[11px] text-destructive">
                  {campos.error instanceof Error
                    ? campos.error.message
                    : "Não foi possível carregar os campos do pipeline."}
                </p>
              )}
            </>
          )}

          {etapa !== "arquivo" && preparado !== null && (
            <>
              <div className="flex flex-wrap items-baseline justify-between gap-2 text-xs">
                <span className="font-semibold tabular-nums">
                  {fraseDasContagens(classificacao, etapa)}
                </span>
                <span className="text-secundario">
                  {preparado.nome} · colunas reconhecidas:{" "}
                  {Object.keys(preparado.mapa.indices).join(", ")}
                  {preparado.mapa.personalizadas.length > 0 &&
                    ` · campos do pipeline ${nomeDoPipeline}: ${preparado.mapa.personalizadas
                      .map((p) => `${p.coluna} → ${p.campo.nome}`)
                      .join(", ")}`}
                  {preparado.mapa.ignoradas.length > 0 &&
                    ` · ignoradas: ${preparado.mapa.ignoradas.join(", ")}`}
                </span>
              </div>

              {linhasDaTabela.length > 0 ? (
                <div className="max-h-[50vh] overflow-auto rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-12 text-right">Nº</TableHead>
                        <TableHead>Nome</TableHead>
                        <TableHead>Telefone</TableHead>
                        <TableHead>E-mail</TableHead>
                        <TableHead>Ação</TableHead>
                        <TableHead>Motivo</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {linhasDaTabela.map((linha) => {
                        const dados = dadosPorNumero.get(linha.numero);
                        return (
                          <TableRow key={linha.numero}>
                            <TableCell className="text-right tabular-nums">
                              {linha.numero}
                            </TableCell>
                            <TableCell>{dados?.nome || "-"}</TableCell>
                            <TableCell className="tabular-nums">{dados?.telefone ?? "-"}</TableCell>
                            <TableCell>{dados?.email ?? "-"}</TableCell>
                            <TableCell>
                              <Badge variant={VARIANTE_DA_ACAO[linha.acao]} data-testid="acao">
                                {linha.acao}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-secundario">
                              {linha.motivo ?? ""}
                              {linha.aviso !== undefined && (
                                <span className="block text-[11px] italic" data-testid="aviso">
                                  {linha.aviso}
                                </span>
                              )}
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                  {semErroOcultas > 0 && (
                    <p className="border-t px-3 py-2 text-xs text-secundario tabular-nums">
                      … e mais {plural(semErroOcultas, "linha", "linhas")} sem erro (todas serão
                      importadas)
                    </p>
                  )}
                </div>
              ) : (
                <p className="text-xs text-secundario">Nenhuma linha com erro.</p>
              )}
            </>
          )}

          {erro !== null && (
            <p
              role="alert"
              className="rounded-md border border-destructive/40 bg-destructive/10 px-2.5 py-2 text-[11px] text-destructive"
            >
              {erro}
            </p>
          )}

          <div className="flex justify-end gap-2 border-t pt-3">
            {etapa === "resultado" ? (
              <Button type="button" onClick={fechar}>
                Fechar
              </Button>
            ) : (
              <>
                <Button
                  type="button"
                  variant="outline"
                  disabled={importar.isPending}
                  onClick={fechar}
                >
                  Cancelar
                </Button>
                {etapa === "previa" && (
                  <Button
                    type="button"
                    disabled={paraGravar === 0 || importar.isPending}
                    onClick={gravar}
                  >
                    {importar.isPending
                      ? "Importando…"
                      : `Importar ${plural(paraGravar, "linha", "linhas")}`}
                  </Button>
                )}
              </>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
