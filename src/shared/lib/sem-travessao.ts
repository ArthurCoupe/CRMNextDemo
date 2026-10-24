const TRACO = `[${String.fromCharCode(0x2014, 0x2013)}]`;

const INTERVALO = new RegExp(`([0-9])${TRACO}([0-9])`, "g");
const CELULA_VAZIA = new RegExp(`(?<! )( +)${TRACO}(?= *(?:[|·]|$))`, "gm");
const TRACO_E = new RegExp(`(?<! ) +${TRACO} +e `, "g");
const TRACO_ENTRE_ESPACOS = new RegExp(`(?<! ) +${TRACO} +`, "g");
const TRACO_SOLTO = new RegExp(TRACO, "g");

export function semTravessao(texto: string): string {
  return texto
    .replace(INTERVALO, "$1 a $2")
    .replace(CELULA_VAZIA, "$1-")
    .replace(TRACO_E, ", e ")
    .replace(TRACO_ENTRE_ESPACOS, ", ")
    .replace(TRACO_SOLTO, "-");
}
