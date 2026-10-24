import { pct } from "@/shared/lib/format";
import { EmptyState } from "@/shared/ui/empty-state";
import type { EstadoDaConsulta } from "@/shared/ui/estado-da-consulta";
import { FalhaAoLer } from "@/shared/ui/falha-ao-ler";

import type { LinhaDoPrimeiroContato } from "../api/pipeline.repository";
import { CANAIS, rotuloDaChaveDeCanal, SEM_ATRIBUICAO } from "../domain/channel";
import { formatarMinutosUteis } from "../domain/primeiro-contato";

function posicao(chave: string): number {
  const i = (CANAIS as readonly string[]).indexOf(chave);
  if (i !== -1) return i;
  return chave === SEM_ATRIBUICAO ? CANAIS.length + 1 : CANAIS.length;
}

export function TempoAtePrimeiroContato({
  linhas,
  estado,
}: {
  readonly linhas: readonly LinhaDoPrimeiroContato[];
  readonly estado: EstadoDaConsulta;
}) {
  if (estado === "erro") {
    return <FalhaAoLer oQue="o tempo até o primeiro contato" />;
  }
  if (estado === "carregando") {
    return <div className="h-40 animate-pulse rounded-xl border bg-card" />;
  }
  if (linhas.length === 0) {
    return (
      <EmptyState
        title="Nenhum lead novo ainda"
        description="A contagem começa nos leads criados depois que a regra entrou no ar."
      />
    );
  }

  const ordenadas = [...linhas].sort((a, b) => posicao(a.canal) - posicao(b.canal));

  return (
    <div className="overflow-x-auto rounded-xl border bg-card">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b text-[11px] uppercase tracking-wide text-muted-foreground">
            <th className="px-3 py-2 text-left font-medium">Canal</th>
            <th className="px-3 py-2 text-right font-medium">Novos</th>
            <th className="px-3 py-2 text-right font-medium">Contatados</th>
            <th className="px-3 py-2 text-right font-medium">Mediana (horas úteis)</th>
            <th className="px-3 py-2 text-right font-medium">No prazo</th>
          </tr>
        </thead>
        <tbody>
          {ordenadas.map((linha) => (
            <tr key={linha.canal} className="border-b last:border-0">
              <td className="px-3 py-2.5 font-medium">{rotuloDaChaveDeCanal(linha.canal)}</td>
              <td className="px-3 py-2.5 text-right tabular-nums">{linha.novos}</td>
              <td className="px-3 py-2.5 text-right tabular-nums">{linha.contatados}</td>
              <td className="px-3 py-2.5 text-right tabular-nums">
                {linha.medianaMin === null ? "-" : formatarMinutosUteis(linha.medianaMin)}
              </td>
              <td className="px-3 py-2.5 text-right tabular-nums">
                {linha.comPrazoMedido === 0 ? "-" : pct(linha.noPrazo / linha.comPrazoMedido)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="border-t px-3 py-2 text-[11px] text-muted-foreground">
        Horas úteis: segunda a sexta, das 9h às 18h. Mede até o toque ser registrado no CRM, não até
        o contato real. Outbound, lead sem canal e lead importado não têm prazo.
      </p>
    </div>
  );
}
