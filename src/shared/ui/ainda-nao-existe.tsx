import { Link } from "@tanstack/react-router";

import { PageHeader } from "@/components/layout/page-header";

interface AindaNaoExisteProps {
  readonly titulo: string;
  readonly descricao: string;
  readonly fase: string;
  readonly oQueChega: readonly string[];
  readonly enquantoIsso?: {
    readonly texto: string;
    readonly para: string;
    readonly rotulo: string;
  };
  readonly porQueEstavaAqui?: string;
}

export function AindaNaoExiste({
  titulo,
  descricao,
  fase,
  oQueChega,
  enquantoIsso,
  porQueEstavaAqui,
}: AindaNaoExisteProps) {
  return (
    <>
      <PageHeader title={titulo} description={descricao} />

      <div className="mx-auto max-w-xl rounded-xl border border-dashed px-6 py-12 text-center">
        <p className="kicker">{titulo}</p>
        <p className="mt-2 text-sm font-semibold">Ainda não existe. Chega na {fase}</p>

        <ul className="mx-auto mt-4 max-w-sm space-y-1.5 text-left text-xs text-muted-foreground">
          {oQueChega.map((item) => (
            <li key={item} className="flex gap-2">
              <span aria-hidden className="text-muted-foreground/60">
                ·
              </span>
              <span>{item}</span>
            </li>
          ))}
        </ul>

        {enquantoIsso !== undefined && (
          <p className="mt-5 text-xs text-muted-foreground">
            {enquantoIsso.texto}{" "}
            <Link to={enquantoIsso.para} className="font-medium text-primary-texto underline">
              {enquantoIsso.rotulo}
            </Link>
          </p>
        )}

        {porQueEstavaAqui !== undefined && (
          <p className="mx-auto mt-5 max-w-sm border-t pt-4 text-[11px] leading-relaxed text-muted-foreground">
            {porQueEstavaAqui}
          </p>
        )}
      </div>
    </>
  );
}
