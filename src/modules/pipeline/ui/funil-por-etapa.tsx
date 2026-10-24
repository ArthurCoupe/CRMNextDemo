import { pct } from "@/shared/lib/format";
import type { EstadoDaConsulta } from "@/shared/ui/estado-da-consulta";
import { FalhaAoLer } from "@/shared/ui/falha-ao-ler";

import { funilEmDegraus, referenciaDoFunil, type LinhaDoFunil } from "../domain/funnel";
import { rotuloDoEstagio, significadoDoEstagio } from "../domain/stage";

interface FunilPorEtapaProps {
  readonly linhas: readonly LinhaDoFunil[];
  readonly estado: EstadoDaConsulta;
}

export function FunilPorEtapa({ linhas, estado }: FunilPorEtapaProps) {
  if (estado === "erro") {
    return <FalhaAoLer oQue="o funil por etapa" />;
  }
  if (estado === "carregando") {
    return <div className="h-64 animate-pulse rounded-xl border bg-card" />;
  }

  const degraus = funilEmDegraus(linhas);
  const referencia = referenciaDoFunil(degraus);
  const vazio = degraus.every((degrau) => degrau.oportunidades === 0);

  return (
    <div className="overflow-x-auto rounded-xl border bg-card">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b text-[11px] uppercase tracking-wide text-muted-foreground">
            <th className="px-3 py-2 text-left font-medium">Etapa</th>
            <th className="w-[38%] px-3 py-2 text-left font-medium">Alcance sobre o topo</th>
            <th className="px-3 py-2 text-right font-medium">Alcançaram</th>
            <th className="px-3 py-2 text-right font-medium">Taxa da anterior</th>
          </tr>
        </thead>
        <tbody>
          {degraus.map((degrau, indice) => (
            <tr key={degrau.estagio} className="border-b last:border-0">
              <td className="px-3 py-2.5">
                <span className="font-medium">{rotuloDoEstagio(degrau.estagio)}</span>
                <span className="ml-2 text-[11px] text-muted-foreground">
                  {significadoDoEstagio(degrau.estagio)}
                </span>
              </td>
              <td className="px-3 py-2.5">
                <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                  <div
                    className="h-full rounded-full bg-primary/60"
                    style={{
                      width:
                        referencia.valor === 0
                          ? "0%"
                          : `${Math.min(100, (degrau.oportunidades / referencia.valor) * 100)}%`,
                    }}
                  />
                </div>
              </td>
              <td className="px-3 py-2.5 text-right font-medium tabular-nums">
                {degrau.oportunidades}
              </td>
              <td className="px-3 py-2.5 text-right tabular-nums">
                {degrau.taxaDaAnterior === null ? (
                  <span
                    className="text-muted-foreground/50"
                    title={
                      indice === 0
                        ? "Topo do funil: não existe etapa anterior."
                        : "Ninguém alcançou a etapa anterior: não há taxa a calcular."
                    }
                  >
                    -
                  </span>
                ) : (
                  pct(degrau.taxaDaAnterior)
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="border-t px-3 py-2 text-[11px] text-muted-foreground">
        {vazio
          ? "Nenhuma oportunidade alcançou etapa nenhuma ainda, e este zero é leitura do banco, não falha."
          : "Conta quem ALCANÇOU a etapa, não quem está nela agora: quem avançou continua contando na etapa por onde passou."}{" "}
        {referencia.ehOMaior && (
          <>
            <strong>Ninguém passou por prospecção neste período</strong>, então as barras estão
            sobre o maior degrau ({referencia.valor}), não sobre o topo: oportunidade criada direto
            numa etapa adiante não entra em prospecção.{" "}
          </>
        )}
        O traço na taxa quer dizer que ninguém chegou na etapa anterior, não que a passagem foi de
        0%. `perdido` e `descartado` não são degraus e ficam fora desta esteira.
      </p>
    </div>
  );
}
