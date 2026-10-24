import type { ReactNode } from "react";
import { semTravessao } from "@/shared/lib/sem-travessao";

const INLINE = /(\*\*[^*\n]+\*\*|`[^`\n]+`|\*[^*\n]+\*)/g;

function comMarcacaoInline(texto: string, chave: string): ReactNode[] {
  return texto.split(INLINE).map((parte, i) => {
    const k = `${chave}-${i}`;
    if (parte.startsWith("**") && parte.endsWith("**") && parte.length > 4) {
      return (
        <strong key={k} className="font-semibold">
          {parte.slice(2, -2)}
        </strong>
      );
    }
    if (parte.startsWith("`") && parte.endsWith("`") && parte.length > 2) {
      return (
        <code key={k} className="rounded bg-background/60 px-1 py-px text-[0.9em]">
          {parte.slice(1, -1)}
        </code>
      );
    }
    if (parte.startsWith("*") && parte.endsWith("*") && parte.length > 2) {
      return <em key={k}>{parte.slice(1, -1)}</em>;
    }
    return parte;
  });
}

const TITULO = /^(#{1,6})\s+(.*)$/;
const ITEM = /^\s*[-*]\s+(.*)$/;
const SEPARADOR = /^\s*(?:---+|___+|\*\*\*+)\s*$/;

const CLASSE_DO_TITULO: Record<number, string> = {
  1: "text-base font-semibold",
  2: "text-[15px] font-semibold",
  3: "text-sm font-semibold",
  4: "text-sm font-semibold",
  5: "text-sm font-semibold",
  6: "text-sm font-semibold",
};

export function RespostaMarkdown({ texto }: { texto: string }): ReactNode {
  const blocos: ReactNode[] = [];
  const linhas = semTravessao(texto).split("\n");
  let itens: string[] = [];

  const fecharLista = () => {
    if (itens.length === 0) return;
    const atuais = itens;
    itens = [];
    blocos.push(
      <ul key={`ul-${blocos.length}`} className="ml-4 list-disc space-y-0.5">
        {atuais.map((item, i) => (
          <li key={i}>{comMarcacaoInline(item, `li-${blocos.length}-${i}`)}</li>
        ))}
      </ul>,
    );
  };

  linhas.forEach((linha, i) => {
    const item = ITEM.exec(linha);
    if (item !== null) {
      itens.push(item[1]);
      return;
    }
    fecharLista();

    if (linha.trim() === "") return;

    if (SEPARADOR.test(linha)) {
      blocos.push(<hr key={`hr-${i}`} className="my-2 border-border" />);
      return;
    }

    const titulo = TITULO.exec(linha);
    if (titulo !== null) {
      blocos.push(
        <p key={`h-${i}`} className={CLASSE_DO_TITULO[titulo[1].length]}>
          {comMarcacaoInline(titulo[2], `h-${i}`)}
        </p>,
      );
      return;
    }

    blocos.push(<p key={`p-${i}`}>{comMarcacaoInline(linha, `p-${i}`)}</p>);
  });

  fecharLista();

  return <div className="space-y-1.5">{blocos}</div>;
}
