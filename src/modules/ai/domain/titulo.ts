export const LIMITE_DO_TITULO = 60;

export function erroDoTitulo(texto: string): string | null {
  const limpo = texto.trim();
  if (limpo === "") return "O nome da conversa não pode ficar em branco.";
  if (limpo.length > LIMITE_DO_TITULO) {
    return `O nome da conversa tem ${limpo.length} caracteres; o máximo é ${LIMITE_DO_TITULO}.`;
  }
  return null;
}
