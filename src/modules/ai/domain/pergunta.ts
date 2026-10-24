export const TETO_DA_PERGUNTA = 8000;

export const LIMITE_DE_CONVERSA_ABERTA = 200;

const INTEIRO = new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 0 });

export function perguntaLongaDemais(tamanho: number): string | null {
  if (tamanho <= TETO_DA_PERGUNTA) return null;
  return `A pergunta tem ${INTEIRO.format(tamanho)} caracteres; o máximo é ${INTEIRO.format(TETO_DA_PERGUNTA)}.`;
}

export function contagemDaPergunta(tamanho: number): string {
  return `${INTEIRO.format(tamanho)} / ${INTEIRO.format(TETO_DA_PERGUNTA)}`;
}
