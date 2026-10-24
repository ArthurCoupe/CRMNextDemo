export interface RespostaFalsa {
  readonly data: unknown;
  readonly error: unknown;
}

export interface ChamadaRegistrada {
  readonly metodo: string;
  readonly args: readonly unknown[];
}

export const UMA_LINHA: RespostaFalsa = { data: [{ id: "x" }], error: null };

export const ZERO_LINHAS: RespostaFalsa = { data: [], error: null };

export const NENHUM_DADO: RespostaFalsa = { data: null, error: null };

export function repetir<T>(linha: T, quantas: number): readonly T[] {
  return Array.from({ length: quantas }, () => linha);
}

export function clienteFalso(
  lerResposta: (chamadasDaCadeia: readonly ChamadaRegistrada[]) => RespostaFalsa,
  registrar?: (chamada: ChamadaRegistrada) => void,
): { from: (tabela: string) => unknown } {
  function builder(chamadasDaCadeia: ChamadaRegistrada[]): unknown {
    const encadeavel: unknown = new Proxy(
      {},
      {
        get(_alvo, prop) {
          if (prop === "then") {
            const promessa = Promise.resolve(lerResposta(chamadasDaCadeia));
            return promessa.then.bind(promessa);
          }
          return (...args: unknown[]) => {
            const chamada = { metodo: String(prop), args };
            chamadasDaCadeia.push(chamada);
            registrar?.(chamada);
            return encadeavel;
          };
        },
      },
    );
    return encadeavel;
  }

  return {
    from(tabela: string) {
      const chamadaInicial: ChamadaRegistrada = { metodo: "from", args: [tabela] };
      registrar?.(chamadaInicial);
      return builder([chamadaInicial]);
    },
  };
}
