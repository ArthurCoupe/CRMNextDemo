import { useEffect, useRef, type ReactNode } from "react";

import { formatDate, todaySP } from "@/shared/lib/date";
import { brl } from "@/shared/lib/format";
import { FalhaAoLer } from "@/shared/ui/falha-ao-ler";

import type { PropostaParaImpressao } from "../api/proposals.repository";
import { rotuloDaProposta } from "../domain/ciclo";
import { ROTULO_DA_FORMA_DE_PAGAMENTO, type ItemDaProposta } from "../domain/grupos";
import { usePropostaParaImpressao } from "../hooks/use-proposals";

export const DICA_DE_IMPRESSAO =
  'No diálogo de impressão, escolha "Salvar como PDF" e desmarque "Cabeçalhos e rodapés".';

export function ImpressaoDaProposta({ propostaId }: { readonly propostaId: string }) {
  const consulta = usePropostaParaImpressao(propostaId);
  const jaImprimiu = useRef(false);

  function imprimirUmaVez() {
    if (jaImprimiu.current) return;
    jaImprimiu.current = true;
    window.print();
  }

  if (consulta.data !== undefined) {
    return <Documento dados={consulta.data} aoCarregarLogo={imprimirUmaVez} />;
  }
  if (consulta.isError) {
    const mensagem = consulta.error instanceof Error ? consulta.error.message : undefined;
    return <FalhaAoLer oQue="a proposta" mensagem={mensagem} />;
  }
  return <p className="text-xs text-muted-foreground">Carregando a proposta…</p>;
}

function quantidade(n: number, singular: string, plural: string): string {
  return `${n} ${n === 1 ? singular : plural}`;
}

function Documento({
  dados,
  aoCarregarLogo,
}: {
  readonly dados: PropostaParaImpressao;
  readonly aoCarregarLogo: () => void;
}) {
  const { proposta, oportunidade, itens } = dados;
  const mensais = itens.filter((i) => i.tipo === "mrr");
  const projeto = itens.filter((i) => i.tipo === "tcv");
  const emissao = proposta.enviadaEm !== null ? todaySP(new Date(proposta.enviadaEm)) : todaySP();
  const contato = [
    oportunidade.contatoNome,
    oportunidade.contatoEmail,
    oportunidade.contatoTelefone,
  ].filter((valor): valor is string => valor !== null && valor !== "");

  const titulo = `Proposta ${rotuloDaProposta(proposta.numero, proposta.versao)}`;
  useEffect(() => {
    const anterior = document.title;
    document.title = titulo;
    return () => {
      document.title = anterior;
    };
  }, [titulo]);

  return (
    <>
      <p className="mb-3 text-xs text-muted-foreground print:hidden">{DICA_DE_IMPRESSAO}</p>
      <article className="mx-auto w-full max-w-[210mm] bg-white p-[16mm] text-[10.5pt] leading-snug text-noturno shadow box-decoration-clone [page:proposta] print:max-w-none print:shadow-none">
        <header className="flex items-start justify-between gap-6 border-b-[3px] border-royal pb-4">
          <img
            src="/logo-fundo-claro.png"
            alt="Next Business"
            className="h-10 w-auto"
            onLoad={aoCarregarLogo}
            onError={aoCarregarLogo}
          />
          <dl className="grid grid-cols-[auto_auto] gap-x-3 gap-y-0.5 text-right text-[9pt]">
            <dt className="text-neutral-500">Proposta</dt>
            <dd className="font-semibold">{rotuloDaProposta(proposta.numero, proposta.versao)}</dd>
            <dt className="text-neutral-500">Emissão</dt>
            <dd className="tabular-nums">{formatDate(emissao)}</dd>
            <dt className="text-neutral-500">Válida até</dt>
            <dd className="tabular-nums">{formatDate(proposta.validaAte)}</dd>
          </dl>
        </header>

        <h1 className="mt-6 text-[16pt] font-extrabold">Proposta comercial</h1>

        <Secao titulo="Cliente">
          <p className="font-semibold">{oportunidade.nome}</p>
          {contato.map((linha) => (
            <p key={linha}>{linha}</p>
          ))}
        </Secao>

        {mensais.length > 0 && (
          <Secao titulo="Mensal">
            <TabelaDeItens
              itens={mensais}
              rotuloDoValor="Valor mensal"
              rotuloDoTotal="Total por mês"
              total={proposta.totalMensal}
            />
            {proposta.fidelidadeMeses !== null && (
              <p className="mt-2">
                Fidelidade de {quantidade(proposta.fidelidadeMeses, "mês", "meses")}.
              </p>
            )}
          </Secao>
        )}

        {projeto.length > 0 && (
          <Secao titulo="Projeto">
            <TabelaDeItens
              itens={projeto}
              rotuloDoValor="Valor"
              rotuloDoTotal="Total do projeto"
              total={proposta.totalProjeto}
            />
            {proposta.parcelasProjeto !== null && (
              <p className="mt-2">
                Pagamento em {quantidade(proposta.parcelasProjeto, "parcela", "parcelas")}.
              </p>
            )}
            {proposta.prazoEntregaDias !== null && (
              <p>
                Prazo de entrega:{" "}
                {quantidade(proposta.prazoEntregaDias, "dia corrido", "dias corridos")} a partir do
                início do contrato.
              </p>
            )}
          </Secao>
        )}

        {proposta.escopo !== null && proposta.escopo.trim() !== "" && (
          <Secao titulo="Escopo">
            <p className="whitespace-pre-line">{proposta.escopo}</p>
          </Secao>
        )}

        <Secao titulo="Condições de pagamento">
          <dl className="grid grid-cols-[auto_1fr] gap-x-3">
            <dt className="text-neutral-500">Forma de pagamento</dt>
            <dd>{ROTULO_DA_FORMA_DE_PAGAMENTO[proposta.formaPagamento]}</dd>
          </dl>
        </Secao>
      </article>
    </>
  );
}

function Secao({ titulo, children }: { readonly titulo: string; readonly children: ReactNode }) {
  return (
    <section className="mt-6">
      <h2 className="mb-2 w-fit break-after-avoid border-b-[3px] border-royal pb-0.5 text-[9pt] font-semibold uppercase tracking-wide text-royal">
        {titulo}
      </h2>
      {children}
    </section>
  );
}

function TabelaDeItens({
  itens,
  rotuloDoValor,
  rotuloDoTotal,
  total,
}: {
  readonly itens: readonly ItemDaProposta[];
  readonly rotuloDoValor: string;
  readonly rotuloDoTotal: string;
  readonly total: number;
}) {
  return (
    <table className="w-full border-collapse">
      <thead>
        <tr className="break-inside-avoid border-b border-neutral-300 text-left text-[9pt] text-neutral-500">
          <th scope="col" className="py-1 font-medium">
            Item
          </th>
          <th scope="col" className="py-1 text-right font-medium">
            {rotuloDoValor}
          </th>
        </tr>
      </thead>
      <tbody>
        {itens.map((item) => (
          <tr key={item.id} className="break-inside-avoid border-b border-neutral-200 align-top">
            <td className="py-1.5 pr-4">
              <p className="font-medium">{item.nome}</p>
              {item.descricao !== null && item.descricao !== "" && (
                <p className="text-[9pt] text-neutral-600">{item.descricao}</p>
              )}
            </td>
            <td className="py-1.5 text-right tabular-nums">{brl(item.valor)}</td>
          </tr>
        ))}
        <tr className="break-inside-avoid">
          <td className="pt-2 font-semibold">{rotuloDoTotal}</td>
          <td className="pt-2 text-right font-semibold tabular-nums">{brl(total)}</td>
        </tr>
      </tbody>
    </table>
  );
}
