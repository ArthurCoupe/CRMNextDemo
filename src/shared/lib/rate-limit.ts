const MAXIMO_DE_CHAVES = 10_000;

interface Janela {
  inicio: number;
  contagem: number;
}

export interface LimiteDeChamadas {
  readonly permitir: (chave: string, agora?: number) => boolean;
  readonly esquecer: () => void;
}

export function criarLimite(janelaMs: number, maximoPorJanela: number): LimiteDeChamadas {
  const janelas = new Map<string, Janela>();

  return {
    permitir(chave: string, agora: number = Date.now()): boolean {
      const janela = janelas.get(chave);

      if (janela === undefined || agora - janela.inicio >= janelaMs) {
        if (janelas.size >= MAXIMO_DE_CHAVES) {
          const primeira = janelas.keys().next();
          if (!primeira.done) janelas.delete(primeira.value);
        }
        janelas.set(chave, { inicio: agora, contagem: 1 });
        return true;
      }

      janela.contagem += 1;
      return janela.contagem <= maximoPorJanela;
    },

    esquecer() {
      janelas.clear();
    },
  };
}

export function excedeuOLimite(oQue: string): Error {
  return new Error(
    `Muitas tentativas de ${oQue} em pouco tempo. Espere um minuto e tente de novo.`,
  );
}
