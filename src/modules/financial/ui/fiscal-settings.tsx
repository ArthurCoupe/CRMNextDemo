import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import type { MeioDePagamento } from "@/modules/contracts/domain/contract";
import { PageSection } from "@/shared/ui/page-section";
import { CampoEditavel } from "@/shared/ui/campo-editavel";

import { interpretarPercentual } from "../domain/fiscal";
import {
  useConfiguracaoFiscal,
  useDefinirAliquota,
  useDefinirTaxaDeParcelamento,
  useDefinirTaxasDoMeio,
  useTabelaDeParcelamento,
  useTaxasPorMeio,
} from "../hooks/use-fiscal";
import { estadoDaConsulta, piorEstado } from "@/shared/ui/estado-da-consulta";
import { FalhaAoLer } from "@/shared/ui/falha-ao-ler";

const ROTULO_DO_MEIO: Record<MeioDePagamento, string> = {
  pix: "Pix",
  credito: "Cartão de crédito",
  transferencia: "Transferência / TED",
};

export function FiscalSettings() {
  const config = useConfiguracaoFiscal();
  const tabela = useTabelaDeParcelamento();
  const taxas = useTaxasPorMeio();

  const estado = piorEstado(
    estadoDaConsulta(config),
    estadoDaConsulta(tabela),
    estadoDaConsulta(taxas),
  );

  return (
    <PageSection
      title="Tributos e taxas"
      lede="A alíquota e as taxas da operadora. Todo cálculo de líquido do sistema sai daqui: nenhum percentual vive em código."
    >
      {estado === "erro" ? (
        <FalhaAoLer oQue="a configuração fiscal" />
      ) : estado === "carregando" ? (
        <div className="h-64 animate-pulse rounded-xl border bg-card" />
      ) : (
        <div className="space-y-4">
          <Aliquota />
          <TaxasPorMeio />
          <TabelaDeParcelamento />
        </div>
      )}
    </PageSection>
  );
}

function Aliquota() {
  const { data: config } = useConfiguracaoFiscal();
  const definir = useDefinirAliquota();
  const [aliquota, setAliquota] = useState<string | null>(null);
  const [fonte, setFonte] = useState<string | null>(null);

  if (config == null) return null;

  const valorAtual = aliquota ?? String(config.aliquotaPct);
  const fonteAtual = fonte ?? config.fonte ?? "";

  const temRascunho =
    (aliquota !== null && aliquota !== String(config.aliquotaPct)) ||
    (fonte !== null && fonte !== (config.fonte ?? ""));

  function salvar() {
    const numero = interpretarPercentual(valorAtual);
    if (numero === null || numero > 100) {
      toast.error("A alíquota precisa ser um número entre 0 e 100.");
      return;
    }
    definir.mutate(
      { aliquotaPct: numero, provisoria: config!.provisoria, fonte: fonteAtual || null },
      {
        onSuccess: () => {
          toast.success("Alíquota atualizada. Todo cálculo de líquido já usa o valor novo.");
          setAliquota(null);
          setFonte(null);
        },
      },
    );
  }

  return (
    <div className="rounded-xl border bg-card p-4">
      <div className="grid gap-3 sm:grid-cols-[10rem_1fr_auto] sm:items-end">
        <div className="space-y-1.5">
          <Label htmlFor="aliquota">Alíquota (%)</Label>
          <Input
            id="aliquota"
            inputMode="decimal"
            className="tabular-nums"
            value={valorAtual}
            onChange={(e) => setAliquota(e.target.value)}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="fonte">Fonte</Label>
          <Input
            id="fonte"
            value={fonteAtual}
            placeholder="de onde veio este número"
            onChange={(e) => setFonte(e.target.value)}
          />
        </div>
        <Button onClick={salvar} disabled={definir.isPending}>
          Salvar
        </Button>
      </div>

      <div className="mt-4 flex items-center justify-between gap-3 rounded-lg border px-3 py-2">
        <div>
          <p className="text-xs font-medium">Valores confirmados com a operadora</p>
          <p className="text-[11px] text-muted-foreground">
            {config.provisoria
              ? "Marcado como PROVISÓRIO. O aviso aparece junto de todo número de líquido do sistema."
              : "Marcado como confirmado. Nenhum aviso de estimativa é exibido."}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {temRascunho && (
            <span className="max-w-[9rem] text-right text-[11px] text-warning">
              salve a alíquota primeiro
            </span>
          )}
          <Switch
            checked={!config.provisoria}
            disabled={temRascunho || definir.isPending}
            onCheckedChange={(confirmado) =>
              definir.mutate({
                aliquotaPct: config.aliquotaPct,
                provisoria: !confirmado,
                fonte: config.fonte,
              })
            }
          />
        </div>
      </div>
    </div>
  );
}

function TaxasPorMeio() {
  const { data: taxas } = useTaxasPorMeio();
  const definir = useDefinirTaxasDoMeio();

  if (taxas == null) return null;

  return (
    <div className="overflow-x-auto rounded-xl border bg-card">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b text-[11px] uppercase tracking-wide text-muted-foreground">
            <th className="px-3 py-2 text-left font-medium">Meio de pagamento</th>
            <th className="px-3 py-2 text-right font-medium">Taxa fixa (R$)</th>
            <th className="px-3 py-2 text-right font-medium">Variável (%)</th>
            <th className="px-3 py-2 text-left font-medium">Prazo de recebimento</th>
            <th className="px-3 py-2 text-left font-medium">Parcelável</th>
          </tr>
        </thead>
        <tbody>
          {[...taxas.values()].map((taxa) => (
            <tr key={taxa.meio} className="border-b last:border-0">
              <td className="px-3 py-2 font-medium">{ROTULO_DO_MEIO[taxa.meio]}</td>
              <td className="px-3 py-2 text-right">
                <CampoNumerico
                  valor={taxa.taxaFixa}
                  aoSalvar={(v) => definir.mutate({ meio: taxa.meio, taxaFixa: v })}
                />
              </td>
              <td className="px-3 py-2 text-right">
                {taxa.meio === "credito" ? (
                  <span className="text-[11px] text-muted-foreground">vem do parcelamento</span>
                ) : (
                  <CampoNumerico
                    valor={taxa.percentualVariavel}
                    aoSalvar={(v) => definir.mutate({ meio: taxa.meio, percentualVariavel: v })}
                  />
                )}
              </td>
              <td className="px-3 py-2">
                <CampoEditavel
                  id={`liquidacao-${taxa.meio}`}
                  rotulo={`Prazo (${ROTULO_DO_MEIO[taxa.meio]})`}
                  valor={taxa.liquidacao}
                  disabled={definir.isPending}
                  placeholder="D+1"
                  maxLength={40}
                  onGravar={(valor) => definir.mutate({ meio: taxa.meio, liquidacao: valor })}
                />
              </td>
              <td className="px-3 py-2">
                <Switch
                  aria-label={`Parcelável (${ROTULO_DO_MEIO[taxa.meio]})`}
                  checked={taxa.parcelavel}
                  disabled={definir.isPending}
                  onCheckedChange={(parcelavel) => definir.mutate({ meio: taxa.meio, parcelavel })}
                />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="border-t px-3 py-2 text-[11px] text-muted-foreground">
        A marca de parcelável fica registrada aqui, mas ainda não muda o formulário de contrato:
        hoje só o cartão de crédito oferece parcelas.
      </p>
    </div>
  );
}

function TabelaDeParcelamento() {
  const { data: tabela } = useTabelaDeParcelamento();
  const definir = useDefinirTaxaDeParcelamento();

  if (tabela == null) return null;

  return (
    <div className="rounded-xl border bg-card p-4">
      <p className="kicker mb-1">Parcelamento no cartão</p>
      <p className="mb-3 text-[11px] text-muted-foreground">
        A taxa cresce com o número de parcelas. É a diferença que o simulador do formulário de
        contrato mostra na hora de negociar.
      </p>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-6">
        {[...tabela.entries()].map(([parcelas, percentual]) => (
          <div key={parcelas} className="rounded-lg border px-2 py-1.5">
            <p className="text-[11px] text-muted-foreground">{parcelas}×</p>
            <CampoNumerico
              valor={percentual}
              aoSalvar={(v) => definir.mutate({ parcelas, percentual: v })}
            />
          </div>
        ))}
      </div>
    </div>
  );
}

function CampoNumerico({ valor, aoSalvar }: { valor: number; aoSalvar: (v: number) => void }) {
  const [rascunho, setRascunho] = useState<string | null>(null);

  return (
    <Input
      inputMode="decimal"
      className="h-8 text-right text-xs tabular-nums"
      value={rascunho ?? String(valor)}
      onChange={(e) => setRascunho(e.target.value)}
      onBlur={() => {
        if (rascunho === null) return;
        const texto = rascunho.trim();

        if (texto === "") {
          toast.error("Campo vazio. Para zerar de fato uma taxa, digite 0.");
          setRascunho(null);
          return;
        }

        const numero = interpretarPercentual(texto);
        if (numero === null) {
          toast.error("Valor inválido.");
          setRascunho(null);
          return;
        }
        if (numero !== valor) aoSalvar(numero);
        setRascunho(null);
      }}
    />
  );
}
