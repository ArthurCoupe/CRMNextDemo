import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { estadoDaConsulta } from "@/shared/ui/estado-da-consulta";
import { FalhaAoLer } from "@/shared/ui/falha-ao-ler";

import type { CatalogoLidoParaEdicao } from "../api/qualificacao.repository";
import {
  PONTOS_MAXIMOS_POR_OPCAO,
  problemaNoCatalogo,
  type PerguntaDoCatalogo,
} from "../domain/qualification";
import { useCatalogoParaEdicao, useSalvarCatalogoDeQualificacao } from "../hooks/use-qualificacao";

interface OpcaoEmEdicao {
  readonly label: string;
  readonly pontos: string;
  readonly ko: boolean;
}

interface PerguntaEmEdicao {
  readonly key: string;
  readonly label: string;
  readonly prompt: string;
  readonly nova: boolean;
  readonly opcoes: readonly OpcaoEmEdicao[];
}

const OPCAO_VAZIA: OpcaoEmEdicao = { label: "", pontos: "", ko: false };

function emEdicao(pergunta: PerguntaDoCatalogo): PerguntaEmEdicao {
  return {
    key: pergunta.key,
    label: pergunta.label,
    prompt: pergunta.prompt,
    nova: false,
    opcoes: pergunta.options.map((o) => ({
      label: o.label,
      pontos: String(o.points),
      ko: o.ko === true,
    })),
  };
}

function paraOCatalogo(p: PerguntaEmEdicao): PerguntaDoCatalogo {
  return {
    key: p.key,
    label: p.label,
    prompt: p.prompt,
    options: p.opcoes.map((o) => ({
      label: o.label,
      points: /^\d+$/.test(o.pontos.trim()) ? Number(o.pontos.trim()) : Number.NaN,
      ko: o.ko,
    })),
  };
}

export function QualificacaoSettings() {
  const consulta = useCatalogoParaEdicao();
  const estado = estadoDaConsulta(consulta);

  return (
    <Card className="space-y-4 p-6 shadow-card">
      <header>
        <h2 className="text-sm font-semibold">Perguntas de qualificação</h2>
        <p className="mt-1 text-xs text-muted-foreground">
          As perguntas que a ficha da oportunidade mostra. A resposta guarda os pontos do momento em
          que foi dada: mudar aqui não reescreve oportunidades já qualificadas.
        </p>
      </header>

      {estado === "erro" && (
        <FalhaAoLer
          oQue="as perguntas de qualificação"
          mensagem={
            consulta.data === undefined
              ? "Recarregue a página; se persistir, é falha de conexão com o banco."
              : "O que você editou continua na tela, mas as perguntas gravadas podem ter mudado. Salvar recusa se alguém salvou antes de você."
          }
        />
      )}
      {estado === "carregando" && (
        <div
          role="status"
          className="h-32 animate-pulse rounded-md border bg-card"
          aria-label="Carregando"
        />
      )}
      {consulta.data !== undefined && (
        <EditorDePerguntas key={consulta.data.atualizadoEm} lido={consulta.data} />
      )}
    </Card>
  );
}

function EditorDePerguntas({ lido }: { lido: CatalogoLidoParaEdicao }) {
  const salvar = useSalvarCatalogoDeQualificacao();
  const originais = lido.catalogo.questions.map(emEdicao);
  const [perguntas, setPerguntas] = useState<readonly PerguntaEmEdicao[]>(originais);
  const mudou = JSON.stringify(perguntas) !== JSON.stringify(originais);
  const removidas = lido.catalogo.questions.filter(
    (original) => !perguntas.some((p) => p.key === original.key),
  );

  function mudar(indice: number, parcial: Partial<PerguntaEmEdicao>) {
    setPerguntas((atual) => atual.map((p, i) => (i === indice ? { ...p, ...parcial } : p)));
  }

  function mudarOpcoes(
    indice: number,
    mudanca: (opcoes: readonly OpcaoEmEdicao[]) => readonly OpcaoEmEdicao[],
  ) {
    setPerguntas((atual) =>
      atual.map((p, i) => (i === indice ? { ...p, opcoes: mudanca(p.opcoes) } : p)),
    );
  }

  function mover(indice: number, destino: number) {
    setPerguntas((atual) => {
      const a = atual[indice];
      const b = atual[destino];
      if (a === undefined || b === undefined) return atual;
      const proximas = [...atual];
      proximas[indice] = b;
      proximas[destino] = a;
      return proximas;
    });
  }

  function adicionar() {
    setPerguntas((atual) => [
      ...atual,
      {
        key: crypto.randomUUID(),
        label: "",
        prompt: "",
        nova: true,
        opcoes: [OPCAO_VAZIA, OPCAO_VAZIA],
      },
    ]);
  }

  function gravar() {
    const catalogo = perguntas.map(paraOCatalogo);
    const problema = problemaNoCatalogo(catalogo);
    if (problema !== null) {
      toast.error(problema);
      return;
    }
    salvar.mutate({ lido, perguntas: catalogo });
  }

  return (
    <fieldset disabled={salvar.isPending} className="grid min-w-0 gap-3">
      {perguntas.map((p, i) => {
        const numero = i + 1;
        return (
          <div key={p.key} className="grid gap-2 rounded-md border p-3">
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="text-[11px] text-muted-foreground">Pergunta {numero}</span>
              <Button
                type="button"
                size="sm"
                variant="ghost"
                aria-label={`Subir pergunta ${numero}`}
                disabled={i === 0}
                onClick={() => mover(i, i - 1)}
              >
                Subir
              </Button>
              <Button
                type="button"
                size="sm"
                variant="ghost"
                aria-label={`Descer pergunta ${numero}`}
                disabled={i === perguntas.length - 1}
                onClick={() => mover(i, i + 1)}
              >
                Descer
              </Button>
              <Button
                type="button"
                size="sm"
                variant="ghost"
                aria-label={`Remover pergunta ${numero}`}
                onClick={() => setPerguntas((atual) => atual.filter((_, k) => k !== i))}
              >
                Remover
              </Button>
            </div>
            <Input
              aria-label={`Título da pergunta ${numero}`}
              className="h-8 text-xs"
              value={p.label}
              onChange={(e) => mudar(i, { label: e.target.value })}
            />
            <Textarea
              aria-label={`Texto da pergunta ${numero}`}
              className="min-h-14 text-xs"
              value={p.prompt}
              onChange={(e) => mudar(i, { prompt: e.target.value })}
            />
            {p.nova ? (
              <div className="grid gap-1.5">
                {p.opcoes.map((o, j) => {
                  const rotulo = `da opção ${j + 1} da pergunta ${numero}`;
                  return (
                    <div key={`${p.key}-${j}`} className="flex flex-wrap items-center gap-2">
                      <Input
                        aria-label={`Opção ${j + 1} da pergunta ${numero}`}
                        className="h-8 min-w-[12rem] flex-1 text-xs"
                        value={o.label}
                        onChange={(e) =>
                          mudarOpcoes(i, (opcoes) =>
                            opcoes.map((x, k) => (k === j ? { ...x, label: e.target.value } : x)),
                          )
                        }
                      />
                      <Input
                        aria-label={`Pontos ${rotulo}`}
                        inputMode="numeric"
                        className="h-8 w-16 text-xs tabular-nums"
                        placeholder={`0 a ${PONTOS_MAXIMOS_POR_OPCAO}`}
                        value={o.pontos}
                        onChange={(e) =>
                          mudarOpcoes(i, (opcoes) =>
                            opcoes.map((x, k) => (k === j ? { ...x, pontos: e.target.value } : x)),
                          )
                        }
                      />
                      <label className="flex cursor-pointer items-center gap-1 text-[11px]">
                        <Checkbox
                          aria-label={`KO ${rotulo}`}
                          checked={o.ko}
                          onCheckedChange={(marcado) =>
                            mudarOpcoes(i, (opcoes) =>
                              opcoes.map((x, k) => (k === j ? { ...x, ko: marcado === true } : x)),
                            )
                          }
                        />
                        KO
                      </label>
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        aria-label={`Remover opção ${j + 1} da pergunta ${numero}`}
                        disabled={p.opcoes.length === 1}
                        onClick={() => mudarOpcoes(i, (opcoes) => opcoes.filter((_, k) => k !== j))}
                      >
                        Remover
                      </Button>
                    </div>
                  );
                })}
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="justify-self-start"
                  onClick={() => mudarOpcoes(i, (opcoes) => [...opcoes, OPCAO_VAZIA])}
                >
                  Adicionar opção
                </Button>
              </div>
            ) : (
              <>
                <ul className="grid gap-0.5 text-[11px] text-muted-foreground">
                  {p.opcoes.map((o, j) => (
                    <li key={`${p.key}-${j}`}>
                      {o.label} ({o.ko ? "KO" : `${o.pontos} pt`})
                    </li>
                  ))}
                </ul>
                <p className="text-[11px] text-muted-foreground">
                  As opções de uma pergunta já salva não mudam: a resposta guarda a posição da opção
                  escolhida.
                </p>
              </>
            )}
          </div>
        );
      })}

      <Button
        type="button"
        size="sm"
        variant="outline"
        className="justify-self-start"
        onClick={adicionar}
      >
        Adicionar pergunta
      </Button>

      {removidas.length > 0 && (
        <p className="text-[11px] text-warning">
          Removendo: {removidas.map((r) => r.label).join(", ")}. As respostas já dadas a essas
          perguntas continuam contando no tier das oportunidades. Elas somem da ficha da
          oportunidade e aparecem como “Pergunta removida” na preparação da reunião.
        </p>
      )}
      <p className="text-[11px] text-muted-foreground">
        O tier segue a regra fixa do banco: 6 pontos ou mais é A, 4 ou mais é B. Acrescentar
        pergunta aumenta quantos pontos uma oportunidade consegue somar.
      </p>

      <div className="flex gap-2">
        <Button type="button" size="sm" disabled={!mudou || salvar.isPending} onClick={gravar}>
          Salvar perguntas
        </Button>
        <Button
          type="button"
          size="sm"
          variant="ghost"
          disabled={!mudou || salvar.isPending}
          onClick={() => setPerguntas(originais)}
        >
          Descartar alterações
        </Button>
      </div>
    </fieldset>
  );
}
