import type { Json } from "@/shared/types/database.types";

export type Tier = "A" | "B" | "C";

export interface RespostaCongelada {
  readonly questionKey: string;
  readonly optionIndex: number;
  readonly points: number;
  readonly isKo: boolean;
}

export interface OpcaoDoCatalogo {
  readonly label: string;
  readonly points: number;
  readonly ko?: boolean;
}

export interface PerguntaDoCatalogo {
  readonly key: string;
  readonly label: string;
  readonly prompt: string;
  readonly options: readonly OpcaoDoCatalogo[];
}

export interface CatalogoDeQualificacao {
  readonly version: number;
  readonly questions: readonly PerguntaDoCatalogo[];
}

export function interpretarCatalogo(bruto: unknown): CatalogoDeQualificacao {
  if (typeof bruto !== "object" || bruto === null) {
    throw new Error("Catálogo de qualificação ausente ou com formato inválido.");
  }
  const objeto = bruto as Record<string, unknown>;
  if (typeof objeto.version !== "number" || !Array.isArray(objeto.questions)) {
    throw new Error("Catálogo de qualificação sem version ou questions.");
  }

  const questions = objeto.questions.map((q: unknown): PerguntaDoCatalogo => {
    if (typeof q !== "object" || q === null) {
      throw new Error("Pergunta do catálogo com formato inválido.");
    }
    const pergunta = q as Record<string, unknown>;
    if (
      typeof pergunta.key !== "string" ||
      typeof pergunta.label !== "string" ||
      typeof pergunta.prompt !== "string" ||
      !Array.isArray(pergunta.options) ||
      pergunta.options.length === 0
    ) {
      throw new Error(`Pergunta "${String(pergunta.key)}" incompleta no catálogo.`);
    }
    const options = pergunta.options.map((o: unknown): OpcaoDoCatalogo => {
      if (typeof o !== "object" || o === null) {
        throw new Error(`Opção inválida na pergunta "${pergunta.key}".`);
      }
      const opcao = o as Record<string, unknown>;
      if (typeof opcao.label !== "string" || typeof opcao.points !== "number") {
        throw new Error(`Opção sem label/points na pergunta "${pergunta.key}".`);
      }
      return {
        label: opcao.label,
        points: opcao.points,
        ko: opcao.ko === true,
      };
    });
    return {
      key: pergunta.key,
      label: pergunta.label,
      prompt: pergunta.prompt,
      options,
    };
  });

  return { version: objeto.version, questions };
}

export const PONTOS_MAXIMOS_POR_OPCAO = 2;

export type ObjetoJson = Record<string, Json | undefined>;

export function problemaNoCatalogo(perguntas: readonly PerguntaDoCatalogo[]): string | null {
  if (perguntas.length === 0) return "O catálogo precisa de pelo menos uma pergunta.";
  const chaves = new Set<string>();
  for (const [indice, pergunta] of perguntas.entries()) {
    const nome = `Pergunta ${indice + 1}`;
    if (pergunta.key.trim() === "" || chaves.has(pergunta.key)) {
      return `${nome}: chave repetida ou vazia. Recarregue a página e refaça.`;
    }
    chaves.add(pergunta.key);
    if (pergunta.label.trim() === "") return `${nome}: o título não pode ficar em branco.`;
    if (pergunta.prompt.trim() === "") return `${nome}: o texto não pode ficar em branco.`;
    if (pergunta.options.length === 0) return `${nome}: precisa de pelo menos uma opção.`;
    const rotulos = new Set<string>();
    for (const [i, opcao] of pergunta.options.entries()) {
      const rotulo = opcao.label.trim();
      if (rotulo === "") return `${nome}, opção ${i + 1}: o texto não pode ficar em branco.`;
      if (rotulos.has(rotulo)) return `${nome}: duas opções com o texto "${rotulo}".`;
      rotulos.add(rotulo);
      if (
        !Number.isInteger(opcao.points) ||
        opcao.points < 0 ||
        opcao.points > PONTOS_MAXIMOS_POR_OPCAO
      ) {
        return `${nome}, opção ${i + 1}: os pontos vão de 0 a ${PONTOS_MAXIMOS_POR_OPCAO}, sem fração.`;
      }
    }
  }
  return null;
}

export function montarCatalogoParaGravar(
  bruto: ObjetoJson,
  perguntas: readonly PerguntaDoCatalogo[],
): ObjetoJson {
  const cruas = Array.isArray(bruto.questions) ? bruto.questions : [];
  const cruaPorChave = new Map<string, ObjetoJson>();
  for (const crua of cruas) {
    if (typeof crua === "object" && crua !== null && !Array.isArray(crua)) {
      const chave = crua.key;
      if (typeof chave === "string") cruaPorChave.set(chave, crua);
    }
  }
  const versao = typeof bruto.version === "number" ? bruto.version : 0;

  return {
    ...bruto,
    version: versao + 1,
    questions: perguntas.map((p): ObjetoJson => {
      const crua = cruaPorChave.get(p.key);
      if (crua !== undefined) {
        return { ...crua, label: p.label.trim(), prompt: p.prompt.trim() };
      }
      return {
        key: p.key,
        label: p.label.trim(),
        prompt: p.prompt.trim(),
        options: p.options.map((o) =>
          o.ko === true
            ? { points: o.points, label: o.label.trim(), ko: true }
            : { points: o.points, label: o.label.trim() },
        ),
      };
    }),
  };
}

export function congelarResposta(
  pergunta: PerguntaDoCatalogo,
  optionIndex: number,
): RespostaCongelada {
  const opcao = pergunta.options[optionIndex];
  if (opcao === undefined) {
    throw new Error(
      `Opção ${optionIndex} não existe na pergunta "${pergunta.key}" (${pergunta.options.length} opções).`,
    );
  }
  return {
    questionKey: pergunta.key,
    optionIndex,
    points: opcao.points,
    isKo: opcao.ko === true,
  };
}

export function calcularTier(respostas: readonly RespostaCongelada[]): Tier | null {
  if (respostas.length === 0) return null;
  if (respostas.some((resposta) => resposta.isKo)) return "C";
  const soma = respostas.reduce((total, resposta) => total + resposta.points, 0);
  if (soma >= 6) return "A";
  if (soma >= 4) return "B";
  return "C";
}

export function somarPontos(respostas: readonly RespostaCongelada[]): number {
  return respostas.reduce((total, resposta) => total + resposta.points, 0);
}
