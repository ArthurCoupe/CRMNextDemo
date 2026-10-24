import { pct } from "@/shared/lib/format";
import type { EstadoDaConsulta } from "@/shared/ui/estado-da-consulta";
import { FalhaAoLer } from "@/shared/ui/falha-ao-ler";

import {
  CANAIS,
  ehCanalDeVerdade,
  rotuloDaChaveDeCanal,
  SEM_ATRIBUICAO,
  teseDoCanal,
} from "../domain/channel";
import {
  contagensPorEstagio,
  oportunidadesPorCanal,
  porCanal,
  taxaDeConversaoDoCanal,
  type LinhaDoFunil,
} from "../domain/funnel";
import type { Estagio } from "../domain/stage";

interface ComparativoPorCanalProps {
  readonly linhas: readonly LinhaDoFunil[];
  readonly estado: EstadoDaConsulta;
}

interface LinhaDaComparacao {
  readonly chave: string;
  readonly apoio: string;
  readonly oportunidades: number;
  readonly fechados: number;
  readonly razao: number | null;
}

function montarLinha(
  chave: string,
  contagens: Record<Estagio, number>,
  oportunidades: number,
  apoio: string,
): LinhaDaComparacao {
  return {
    chave,
    apoio,
    oportunidades,
    fechados: contagens.fechado,
    razao: taxaDeConversaoDoCanal(contagens.fechado, oportunidades),
  };
}

export function ComparativoPorCanal({ linhas, estado }: ComparativoPorCanalProps) {
  if (estado === "erro") {
    return <FalhaAoLer oQue="o comparativo por canal" />;
  }
  if (estado === "carregando") {
    return <div className="h-64 animate-pulse rounded-xl border bg-card" />;
  }

  const mapa = porCanal(linhas);
  const contagensDe = (chave: string) => mapa.get(chave) ?? contagensPorEstagio([]);
  const totais = oportunidadesPorCanal(linhas);
  const totalDe = (chave: string) => totais.get(chave) ?? 0;

  const canais = CANAIS.map((canal) =>
    montarLinha(canal, contagensDe(canal), totalDe(canal), teseDoCanal(canal)),
  );

  const desconhecidos = [...mapa.keys()]
    .filter((chave) => chave !== SEM_ATRIBUICAO && !ehCanalDeVerdade(chave))
    .map((chave) =>
      montarLinha(
        chave,
        contagensDe(chave),
        totalDe(chave),
        "Canal novo no enum do banco, ainda sem tese escrita em domain/channel.ts.",
      ),
    );

  const semAtribuicao = mapa.has(SEM_ATRIBUICAO)
    ? montarLinha(
        SEM_ATRIBUICAO,
        contagensDe(SEM_ATRIBUICAO),
        totalDe(SEM_ATRIBUICAO),
        "Oportunidade sem canal registrado. Não é um canal: não entra na comparação e nunca é somada a um deles.",
      )
    : null;

  return (
    <div className="overflow-x-auto rounded-xl border bg-card">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b text-[11px] uppercase tracking-wide text-muted-foreground">
            <th className="px-3 py-2 text-left font-medium">Canal</th>
            <th className="px-3 py-2 text-right font-medium">Oportunidades</th>
            <th className="px-3 py-2 text-right font-medium">Fechados</th>
            <th className="px-3 py-2 text-right font-medium">Conversão</th>
          </tr>
        </thead>
        <tbody>
          {[...canais, ...desconhecidos].map((linha) => (
            <tr key={linha.chave} className="border-b last:border-0">
              <CelulasDaLinha linha={linha} />
            </tr>
          ))}
        </tbody>
        {semAtribuicao !== null && (
          <tfoot>
            <tr className="border-t-2 bg-muted/30">
              <CelulasDaLinha linha={semAtribuicao} />
            </tr>
          </tfoot>
        )}
      </table>
      <p className="border-t px-3 py-2 text-[11px] text-muted-foreground">
        Conversão é fechados sobre as oportunidades DISTINTAS do canal, contadas pelo banco.
        Descartadas ficam de fora do funil inteiro; perdidas entram, senão a taxa daria 100%. Sem
        atribuição não é canal e fica fora da comparação: somá-la a um canal seria inventar de onde
        o lead veio.
      </p>
    </div>
  );
}

function CelulasDaLinha({ linha }: { linha: LinhaDaComparacao }) {
  return (
    <>
      <td className="px-3 py-2.5">
        <p className="font-medium">{rotuloDaChaveDeCanal(linha.chave)}</p>
        <p className="mt-0.5 max-w-[52ch] text-[11px] text-muted-foreground">{linha.apoio}</p>
      </td>
      <td className="px-3 py-2.5 text-right tabular-nums">{linha.oportunidades}</td>
      <td className="px-3 py-2.5 text-right font-medium tabular-nums">{linha.fechados}</td>
      <td className="px-3 py-2.5 text-right tabular-nums">
        {linha.razao === null ? (
          <span
            className="text-muted-foreground/50"
            title="Nenhuma oportunidade deste canal entrou no funil: não há taxa a calcular."
          >
            -
          </span>
        ) : (
          pct(linha.razao)
        )}
      </td>
    </>
  );
}
