export const TENTATIVAS_EXTRAS = 2;

export const ESPERA_MS: readonly number[] = [150, 400];

const PREFIXO_REST = "/rest/v1/";

function caminhoDaRequisicao(entrada: RequestInfo | URL): string | null {
  const bruto = entrada instanceof Request ? entrada.url : entrada.toString();
  try {
    return new URL(bruto).pathname;
  } catch {
    return null;
  }
}

export function comRetentativaNoRest(
  fetchBase: typeof fetch = fetch.bind(globalThis),
  dormir: (ms: number) => Promise<void> = (ms) =>
    new Promise((resolver) => setTimeout(resolver, ms)),
): typeof fetch {
  return async (entrada: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    let resposta = await fetchBase(entrada, init);

    const caminho = caminhoDaRequisicao(entrada);
    const elegivel = caminho !== null && caminho.startsWith(PREFIXO_REST);

    const tentativasCabendoNaEspera = Math.min(TENTATIVAS_EXTRAS, ESPERA_MS.length);

    for (
      let tentativa = 0;
      elegivel && tentativa < tentativasCabendoNaEspera && resposta.status === 401;
      tentativa++
    ) {
      await dormir(ESPERA_MS[tentativa]);
      void resposta.body?.cancel();
      resposta = await fetchBase(entrada, init);
    }

    return resposta;
  };
}
