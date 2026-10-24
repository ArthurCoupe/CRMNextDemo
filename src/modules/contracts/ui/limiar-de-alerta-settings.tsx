import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { interpretarPercentual } from "@/modules/financial/domain/fiscal";
import { estadoDaConsulta } from "@/shared/ui/estado-da-consulta";
import { FalhaAoLer } from "@/shared/ui/falha-ao-ler";

import { problemaNoLimiarDeAlerta } from "../domain/shares";
import { useLimiarDeAlerta, useSalvarLimiarDeAlerta } from "../hooks/use-shares";

export function LimiarDeAlertaSettings() {
  const consulta = useLimiarDeAlerta();
  const salvar = useSalvarLimiarDeAlerta();
  const [rascunho, setRascunho] = useState<string | null>(null);
  const estado = estadoDaConsulta(consulta);

  if (estado === "erro") return <FalhaAoLer oQue="o aviso de participação" />;
  if (estado === "carregando" || consulta.data === undefined) return null;

  const limiar = consulta.data;
  const valor =
    rascunho ??
    (limiar.percentual === null
      ? ""
      : limiar.percentual.toLocaleString("pt-BR", { maximumFractionDigits: 2 }));

  async function gravar() {
    const numero = interpretarPercentual(valor) ?? Number.NaN;
    const problema = problemaNoLimiarDeAlerta(numero);
    if (problema !== null) {
      toast.error(problema);
      return;
    }
    try {
      await salvar.mutateAsync({ percentual: numero, confirmado: limiar.confirmado });
      setRascunho(null);
      toast.success("Aviso atualizado.");
    } catch (erro) {
      toast.error(erro instanceof Error ? erro.message : "Não foi possível gravar o aviso.");
    }
  }

  return (
    <section className="grid gap-2 border-t pt-4">
      <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        Aviso de participação alta
      </h3>
      <p className="text-[11px] text-muted-foreground">
        A ficha do contrato avisa quando as participações somam este percentual ou mais.
      </p>
      <div className="flex items-end gap-2">
        <div className="grid gap-1">
          <Label htmlFor="limiar-de-alerta" className="text-[11px]">
            Avisar a partir de (%)
          </Label>
          <Input
            id="limiar-de-alerta"
            inputMode="decimal"
            className="h-8 w-24 tabular-nums"
            value={valor}
            onChange={(e) => setRascunho(e.target.value)}
          />
        </div>
        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={rascunho === null || salvar.isPending}
          onClick={() => void gravar()}
        >
          Salvar aviso
        </Button>
      </div>
      {!limiar.confirmado && (
        <p className="text-[11px] text-warning">
          Este percentual ainda não foi confirmado como regra da casa.
        </p>
      )}
    </section>
  );
}
