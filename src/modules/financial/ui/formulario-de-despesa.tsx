import { useMemo, useState } from "react";
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
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { ehDataCivilPlausivel } from "@/shared/lib/date";
import { brl } from "@/shared/lib/format";
import { useMudou } from "@/shared/lib/use-mudou";
import { estadoDaConsulta } from "@/shared/ui/estado-da-consulta";

import type { DespesaCadastrada, DespesaParaGravar } from "../api/expenses.repository";
import {
  despesaCorreEm,
  despesaEncerradaEm,
  fimParaGravar,
  hojeEmSaoPaulo,
  interpretarValorEmReais,
  mesEAno,
  parcelasParaGravar,
  parcelasRestantes,
  recorrenciaParaGravar,
  ROTULO_DA_BU,
  ROTULO_DA_CATEGORIA,
  ROTULO_DA_RECORRENCIA,
  ultimaParcelaEm,
  type CategoriaDeDespesa,
  type RecorrenciaDeDespesa,
  type UnidadeDeNegocio,
} from "../domain/expenses";
import { useAgrupadores, useAtualizarDespesa, useCriarDespesa } from "../hooks/use-expenses";

const SEM_AGRUPADOR = "nenhum";

interface Rascunho {
  descricao: string;
  valor: string;
  categoria: CategoriaDeDespesa;
  bu: UnidadeDeNegocio;
  recorrencia: RecorrenciaDeDespesa;
  parcelas: string;
  inicio: string;
  fim: string;
  fornecedor: string;
  meioDePagamento: string;
  agrupadorId: string;
  ehAgrupador: boolean;
  observacoes: string;
}

function rascunhoVazio(): Rascunho {
  return {
    descricao: "",
    valor: "",
    categoria: "estrutural",
    bu: "compartilhado",
    recorrencia: "mensal",
    parcelas: "",
    inicio: hojeEmSaoPaulo(),
    fim: "",
    fornecedor: "",
    meioDePagamento: "",
    agrupadorId: SEM_AGRUPADOR,
    ehAgrupador: false,
    observacoes: "",
  };
}

function rascunhoDe(despesa: DespesaCadastrada): Rascunho {
  return {
    descricao: despesa.descricao,
    valor: despesa.ehAgrupador ? "" : String(despesa.valor).replace(".", ","),
    categoria: despesa.categoria,
    bu: despesa.bu,
    recorrencia: despesa.recorrencia,
    parcelas: despesa.parcelasTotal === null ? "" : String(despesa.parcelasTotal),
    inicio: despesa.inicio,
    fim: despesa.fim ?? "",
    fornecedor: despesa.fornecedor ?? "",
    meioDePagamento: despesa.meioDePagamento ?? "",
    agrupadorId: despesa.agrupadorId ?? SEM_AGRUPADOR,
    ehAgrupador: despesa.ehAgrupador,
    observacoes: despesa.observacoes ?? "",
  };
}

interface FormularioDeDespesaProps {
  readonly aberto: boolean;
  readonly onFechar: () => void;
  readonly despesa: DespesaCadastrada | null;
}

export function FormularioDeDespesa({ aberto, onFechar, despesa }: FormularioDeDespesaProps) {
  const [rascunho, setRascunho] = useState<Rascunho>(() =>
    aberto && despesa !== null ? rascunhoDe(despesa) : rascunhoVazio(),
  );
  const agrupadores = useAgrupadores(despesa?.agrupadorId ?? null);
  const estadoDosAgrupadores = estadoDaConsulta(agrupadores);
  const criar = useCriarDespesa();
  const atualizar = useAtualizarDespesa();

  const abriu = useMudou(aberto);
  const trocouDespesa = useMudou(despesa);
  if (aberto && (abriu || trocouDespesa)) {
    setRascunho(despesa === null ? rascunhoVazio() : rascunhoDe(despesa));
  }

  const editar = <C extends keyof Rascunho>(campo: C, valor: Rascunho[C]) =>
    setRascunho((atual) => ({ ...atual, [campo]: valor }));

  const parcelasDigitadas = useMemo(() => {
    const limpo = rascunho.parcelas.trim();
    if (limpo === "") return null;
    const numero = Number(limpo);
    return Number.isInteger(numero) && numero > 0 ? numero : null;
  }, [rascunho.parcelas]);

  const valorEmReais = interpretarValorEmReais(rascunho.valor);

  const recorrenciaEfetiva = recorrenciaParaGravar(rascunho.ehAgrupador, rascunho.recorrencia);

  const previsao = useMemo(() => {
    const parcelas = parcelasParaGravar(recorrenciaEfetiva, parcelasDigitadas);
    if (parcelas === null) return null;
    const fim = ultimaParcelaEm(rascunho.inicio, parcelas);
    if (fim === null) return null;
    return {
      terminaEm: mesEAno(fim),
      faltam: parcelasRestantes(rascunho.inicio, parcelas, hojeEmSaoPaulo()),
      parcelas,
    };
  }, [recorrenciaEfetiva, rascunho.inicio, parcelasDigitadas]);

  const vigencia = useMemo(() => {
    const base = {
      recorrencia: recorrenciaEfetiva,
      inicio: rascunho.inicio,
      fim: fimParaGravar(recorrenciaEfetiva, rascunho.fim === "" ? null : rascunho.fim),
      parcelasTotal: parcelasParaGravar(recorrenciaEfetiva, parcelasDigitadas),
    };
    const hoje = hojeEmSaoPaulo();
    return {
      contaNesteMes: despesaCorreEm(base, hoje),
      jaAcabou: despesaEncerradaEm(base, hoje),
    };
  }, [recorrenciaEfetiva, rascunho.inicio, rascunho.fim, parcelasDigitadas]);

  const problema = validar(rascunho, valorEmReais, parcelasDigitadas);
  const salvando = criar.isPending || atualizar.isPending;

  function salvar() {
    if (problema !== null) {
      toast.error(problema);
      return;
    }

    const recorrencia = recorrenciaParaGravar(rascunho.ehAgrupador, rascunho.recorrencia);

    const dados: DespesaParaGravar = {
      descricao: rascunho.descricao.trim(),
      valor: rascunho.ehAgrupador ? 0 : (valorEmReais ?? 0),
      categoria: rascunho.categoria,
      bu: rascunho.bu,
      recorrencia,
      parcelasTotal: parcelasParaGravar(recorrencia, parcelasDigitadas),
      inicio: rascunho.inicio,
      fim: fimParaGravar(recorrencia, rascunho.fim === "" ? null : rascunho.fim),
      fornecedor:
        rascunho.ehAgrupador || rascunho.fornecedor.trim() === ""
          ? null
          : rascunho.fornecedor.trim(),
      meioDePagamento:
        rascunho.ehAgrupador || rascunho.meioDePagamento.trim() === ""
          ? null
          : rascunho.meioDePagamento.trim(),
      agrupadorId:
        rascunho.ehAgrupador || rascunho.agrupadorId === SEM_AGRUPADOR
          ? null
          : rascunho.agrupadorId,
      ehAgrupador: rascunho.ehAgrupador,
      observacoes: rascunho.observacoes.trim() === "" ? null : rascunho.observacoes.trim(),
    };

    const acao =
      despesa === null
        ? criar.mutateAsync(dados)
        : atualizar.mutateAsync({ id: despesa.id, dados });

    void acao.then(onFechar).catch(() => {});
  }

  return (
    <Dialog open={aberto} onOpenChange={(v) => !v && onFechar()}>
      <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{despesa === null ? "Nova despesa" : "Editar despesa"}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="flex items-start gap-3 rounded-lg border bg-muted/30 px-3 py-2.5">
            <Switch
              id="eh-agrupador"
              checked={rascunho.ehAgrupador}
              onCheckedChange={(v) => editar("ehAgrupador", v)}
            />
            <div>
              <Label htmlFor="eh-agrupador" className="text-sm">
                É um agrupador (cartão de crédito, fatura)
              </Label>
              <p className="mt-0.5 text-[11px] text-muted-foreground">
                Agrupador é contêiner: não tem valor próprio e <strong>nunca soma no total</strong>.
                As despesas reais penduram nele e são elas que contam.
              </p>
            </div>
          </div>

          <div>
            <Label htmlFor="descricao">Descrição</Label>
            <Input
              id="descricao"
              value={rascunho.descricao}
              onChange={(e) => editar("descricao", e.target.value)}
              placeholder={rascunho.ehAgrupador ? "Cartão de Crédito" : "Assinatura de IA"}
            />
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            {!rascunho.ehAgrupador && (
              <div>
                <Label htmlFor="valor">
                  {rascunho.recorrencia === "parcelado"
                    ? "Valor da parcela"
                    : rascunho.recorrencia === "pontual"
                      ? "Valor da compra"
                      : "Valor mensal"}
                </Label>
                <Input
                  id="valor"
                  inputMode="decimal"
                  value={rascunho.valor}
                  onChange={(e) => editar("valor", e.target.value)}
                  placeholder="670,00"
                />
                {rascunho.valor.trim() !== "" && valorEmReais === null && (
                  <p className="mt-1 text-[11px] text-destructive">
                    Valor não reconhecido. Use vírgula ou ponto para os centavos: 670,00 ou 670.00.
                  </p>
                )}
                {valorEmReais !== null && (
                  <p className="mt-1 text-[11px] text-muted-foreground">
                    Vai ser gravado como{" "}
                    <strong className="tabular-nums text-foreground">{brl(valorEmReais)}</strong>
                    {rascunho.recorrencia === "mensal" && " por mês"}
                    {rascunho.recorrencia === "parcelado" && " por parcela"}.
                  </p>
                )}
              </div>
            )}

            <div>
              <Label htmlFor="categoria">Categoria</Label>
              <Select
                value={rascunho.categoria}
                onValueChange={(v) => editar("categoria", v as CategoriaDeDespesa)}
              >
                <SelectTrigger id="categoria">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(ROTULO_DA_CATEGORIA).map(([chave, rotulo]) => (
                    <SelectItem key={chave} value={chave}>
                      {rotulo}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="bu">Linha de negócio</Label>
              <Select
                value={rascunho.bu}
                onValueChange={(v) => editar("bu", v as UnidadeDeNegocio)}
              >
                <SelectTrigger id="bu">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(ROTULO_DA_BU).map(([chave, rotulo]) => (
                    <SelectItem key={chave} value={chave}>
                      {rotulo}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="mt-1 text-[11px] text-muted-foreground">
                <strong>Compartilhado</strong> é o que existiria de qualquer jeito: aluguel,
                contabilidade, consumo. É o que viabiliza o rateio no Resultado.
              </p>
            </div>

            {!rascunho.ehAgrupador && (
              <div>
                <Label htmlFor="recorrencia">Recorrência</Label>
                <Select
                  value={rascunho.recorrencia}
                  onValueChange={(v) => editar("recorrencia", v as RecorrenciaDeDespesa)}
                >
                  <SelectTrigger id="recorrencia">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(ROTULO_DA_RECORRENCIA).map(([chave, rotulo]) => (
                      <SelectItem key={chave} value={chave}>
                        {rotulo}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {rascunho.recorrencia === "pontual" && (
                  <p className="mt-1 text-[11px] text-muted-foreground">
                    Pontual conta <strong>só no mês do início</strong>: compra única não vira custo
                    fixo.
                  </p>
                )}
              </div>
            )}

            {!rascunho.ehAgrupador && rascunho.recorrencia === "parcelado" && (
              <div>
                <Label htmlFor="parcelas">Número de parcelas</Label>
                <Input
                  id="parcelas"
                  inputMode="numeric"
                  value={rascunho.parcelas}
                  onChange={(e) => editar("parcelas", e.target.value)}
                  placeholder="8"
                />
              </div>
            )}

            <div>
              <Label htmlFor="inicio">Início</Label>
              <Input
                id="inicio"
                type="date"
                value={rascunho.inicio}
                onChange={(e) => editar("inicio", e.target.value)}
              />
            </div>

            {!rascunho.ehAgrupador && rascunho.recorrencia === "mensal" && (
              <div>
                <Label htmlFor="fim">Fim (opcional)</Label>
                <Input
                  id="fim"
                  type="date"
                  value={rascunho.fim}
                  onChange={(e) => editar("fim", e.target.value)}
                />
              </div>
            )}

            {!rascunho.ehAgrupador && (
              <>
                <div>
                  <Label htmlFor="fornecedor">Fornecedor</Label>
                  <Input
                    id="fornecedor"
                    value={rascunho.fornecedor}
                    onChange={(e) => editar("fornecedor", e.target.value)}
                  />
                </div>

                <div>
                  <Label htmlFor="meio">Meio de pagamento</Label>
                  <Input
                    id="meio"
                    value={rascunho.meioDePagamento}
                    onChange={(e) => editar("meioDePagamento", e.target.value)}
                    placeholder="Boleto, débito, cartão…"
                  />
                </div>

                <div className="sm:col-span-2">
                  <Label htmlFor="agrupador">Pendurar em</Label>
                  <Select
                    value={rascunho.agrupadorId}
                    onValueChange={(v) => editar("agrupadorId", v)}
                  >
                    <SelectTrigger id="agrupador">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={SEM_AGRUPADOR}>Nenhum (despesa avulsa)</SelectItem>
                      {agrupadores.data === undefined && rascunho.agrupadorId !== SEM_AGRUPADOR && (
                        <SelectItem value={rascunho.agrupadorId} disabled>
                          {estadoDosAgrupadores === "erro"
                            ? "Agrupador gravado (não foi possível ler a descrição)"
                            : "Carregando agrupadores…"}
                        </SelectItem>
                      )}
                      {(agrupadores.data ?? []).map((a) => (
                        <SelectItem key={a.id} value={a.id}>
                          {a.ativo ? a.descricao : `${a.descricao} (desativado)`}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {agrupadores.isError && (
                    <p className="mt-1 text-[11px] text-destructive">
                      Não foi possível ler os agrupadores. A lista acima pode estar incompleta. Não
                      é que não existam.
                    </p>
                  )}
                </div>
              </>
            )}
          </div>

          {previsao !== null && previsao.terminaEm !== null && (
            <div className="rounded-lg border bg-muted/30 px-3 py-2.5 text-xs">
              <p>
                Última parcela em <strong className="tabular-nums">{previsao.terminaEm}</strong>
                {previsao.faltam !== null && (
                  <>
                    {" · faltam "}
                    <strong className="tabular-nums">{previsao.faltam}</strong>
                    {previsao.faltam === 1 ? " parcela" : " parcelas"}
                  </>
                )}
                {valorEmReais !== null && (
                  <>
                    {" · total "}
                    <strong className="tabular-nums">
                      {brl(valorEmReais * previsao.parcelas)}
                    </strong>
                  </>
                )}
              </p>
              <p className="mt-0.5 text-muted-foreground">
                O sistema desativa o parcelamento sozinho quando a última cair, sem ninguém lembrar.
              </p>
            </div>
          )}

          {!rascunho.ehAgrupador && vigencia.contaNesteMes === false && (
            <p className="rounded-lg border border-warning/40 bg-warning/5 px-3 py-2 text-[11px] text-warning">
              {vigencia.jaAcabou === true ? (
                <>
                  Com estas datas a despesa <strong>já terminou</strong> e não vai contar em mês
                  nenhum daqui pra frente. Ela fica no histórico.
                </>
              ) : (
                <>
                  Com estas datas, a despesa <strong>ainda não conta</strong>: ela começa no futuro.
                  Fica cadastrada e entra no mês certo, e aparece na projeção de 12 meses.
                </>
              )}
            </p>
          )}

          <div>
            <Label htmlFor="observacoes">Observações</Label>
            <Textarea
              id="observacoes"
              rows={2}
              value={rascunho.observacoes}
              onChange={(e) => editar("observacoes", e.target.value)}
            />
          </div>

          {problema !== null && <p className="text-[11px] text-destructive">{problema}</p>}

          <div className="flex justify-end gap-2">
            <Button type="button" variant="ghost" onClick={onFechar} disabled={salvando}>
              Cancelar
            </Button>
            <Button type="button" onClick={salvar} disabled={salvando || problema !== null}>
              {salvando ? "Salvando…" : "Salvar"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function validar(
  rascunho: Rascunho,
  valorEmReais: number | null,
  parcelas: number | null,
): string | null {
  if (rascunho.descricao.trim() === "") return "A descrição é obrigatória.";
  if (rascunho.inicio === "") return "A data de início é obrigatória.";
  if (
    !ehDataCivilPlausivel(rascunho.inicio) ||
    (rascunho.fim !== "" && !ehDataCivilPlausivel(rascunho.fim))
  ) {
    return "Data inválida. Use um ano entre 2000 e 2100.";
  }

  if (rascunho.ehAgrupador) return null;

  if (valorEmReais === null) {
    return "Informe o valor. Campo vazio não é zero: se a despesa é mesmo R$ 0,00, digite 0.";
  }
  if (rascunho.recorrencia === "parcelado" && parcelas === null) {
    return "Parcelado precisa do número de parcelas: é ele que define quando o custo acaba.";
  }
  if (rascunho.recorrencia === "parcelado" && parcelas !== null && parcelas > 360) {
    return "Número de parcelas parece alto demais. Confira antes de salvar.";
  }

  const fim = fimParaGravar(rascunho.recorrencia, rascunho.fim === "" ? null : rascunho.fim);
  if (fim !== null && fim < rascunho.inicio) {
    return "O fim não pode ser anterior ao início.";
  }
  return null;
}
