const ORDEM_MAXIMA = 9999;

export function problemaNaSecao(dados: { titulo: string; ordem: number }): string | null {
  if (dados.titulo.trim() === "") return "O título da seção não pode ficar em branco.";
  if (!Number.isInteger(dados.ordem) || dados.ordem < 0 || dados.ordem > ORDEM_MAXIMA) {
    return `A ordem precisa ser um número inteiro de 0 a ${ORDEM_MAXIMA}.`;
  }
  return null;
}
