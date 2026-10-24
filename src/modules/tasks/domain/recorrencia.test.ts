import { describe, expect, it } from "vitest";

type Recorrencia = "nenhuma" | "semanal" | "quinzenal" | "mensal";

interface Elo {
  readonly prazo: string | null;
  readonly raiz: boolean;
}

function dia(iso: string): number {
  return Number(iso.slice(8, 10));
}

function ultimoDiaDoMes(ano: number, mes: number): number {
  return new Date(Date.UTC(ano, mes, 0)).getUTCDate();
}

function proximoPrazo(
  corrente: readonly Elo[],
  recorrencia: Recorrencia,
  hojeSP: string,
): string | null {
  if (recorrencia === "nenhuma") return null;

  const prazos = corrente.map((e) => e.prazo).filter((p): p is string => p !== null);

  const maior = prazos.length > 0 ? prazos.reduce((a, b) => (a > b ? a : b)) : null;
  const maiorDia = prazos.length > 0 ? Math.max(...prazos.map(dia)) : null;

  const base = maior ?? hojeSP;

  const prazoDaRaiz = corrente.find((e) => e.raiz)?.prazo ?? null;
  const ancora = prazoDaRaiz !== null ? dia(prazoDaRaiz) : (maiorDia ?? dia(base));

  const [ano, mes, d] = [
    Number(base.slice(0, 4)),
    Number(base.slice(5, 7)),
    Number(base.slice(8, 10)),
  ];

  if (recorrencia === "semanal" || recorrencia === "quinzenal") {
    const somar = recorrencia === "semanal" ? 7 : 14;
    const dt = new Date(Date.UTC(ano, mes - 1, d + somar));
    return dt.toISOString().slice(0, 10);
  }

  const mesSeguinte = mes === 12 ? 1 : mes + 1;
  const anoSeguinte = mes === 12 ? ano + 1 : ano;
  const ultimo = ultimoDiaDoMes(anoSeguinte, mesSeguinte);
  const escolhido = Math.min(ancora, ultimo);
  return `${anoSeguinte}-${String(mesSeguinte).padStart(2, "0")}-${String(escolhido).padStart(2, "0")}`;
}

const HOJE = "2026-08-16";
const raiz = (prazo: string | null): Elo => ({ prazo, raiz: true });
const filha = (prazo: string | null): Elo => ({ prazo, raiz: false });

describe("a âncora do dia do mês sobrevive ao clamp de fevereiro", () => {
  it("31/01 vira 28/02 e volta para 31/03 — o dia 31 não se perde", () => {
    const raizJan = raiz("2026-01-31");
    const fev = proximoPrazo([raizJan], "mensal", HOJE);
    expect(fev).toBe("2026-02-28");

    const mar = proximoPrazo([raizJan, filha(fev)], "mensal", HOJE);
    expect(mar).toBe("2026-03-31");
  });

  it("atravessa doze meses sem nunca ficar abaixo do dia 28", () => {
    const raizJan = raiz("2026-01-31");
    const corrente: Elo[] = [raizJan];
    const vistos: string[] = [];
    for (let i = 0; i < 12; i++) {
      const proximo = proximoPrazo(corrente, "mensal", HOJE);
      expect(proximo).not.toBeNull();
      vistos.push(proximo as string);
      corrente.push(filha(proximo));
    }
    expect(vistos).toEqual([
      "2026-02-28",
      "2026-03-31",
      "2026-04-30",
      "2026-05-31",
      "2026-06-30",
      "2026-07-31",
      "2026-08-31",
      "2026-09-30",
      "2026-10-31",
      "2026-11-30",
      "2026-12-31",
      "2027-01-31",
    ]);
  });

  it("fevereiro bissexto clampa em 29, e o 31 volta em março", () => {
    const raizJan = raiz("2028-01-31");
    const fev = proximoPrazo([raizJan], "mensal", HOJE);
    expect(fev).toBe("2028-02-29");
    expect(proximoPrazo([raizJan, filha(fev)], "mensal", HOJE)).toBe("2028-03-31");
  });

  it("vira o ano sem escorregar de mês", () => {
    expect(proximoPrazo([raiz("2026-12-31")], "mensal", HOJE)).toBe("2027-01-31");
  });
});

describe("raiz sem prazo — o buraco que a terceira rodada achou", () => {
  it("a corrente sem prazo nenhum parte de hoje em São Paulo", () => {
    expect(proximoPrazo([raiz(null)], "mensal", "2026-08-16")).toBe("2026-09-16");
  });

  it("com a raiz sem prazo, o maior dia já visto vira a âncora e o 31 sobrevive", () => {
    const corrente = [raiz(null), filha("2026-01-31")];
    const fev = proximoPrazo(corrente, "mensal", HOJE);
    expect(fev).toBe("2026-02-28");
    expect(proximoPrazo([...corrente, filha(fev)], "mensal", HOJE)).toBe("2026-03-31");
  });
});

describe("a base é a corrente inteira, não a linha concluída", () => {
  it("concluir uma ocorrência antiga reaberta não recria data já coberta", () => {
    const corrente = [raiz("2026-01-31"), filha("2026-02-28"), filha("2026-03-31")];
    expect(proximoPrazo(corrente, "mensal", HOJE)).toBe("2026-04-30");
  });

  it("o mesmo vale para semanal", () => {
    const corrente = [raiz("2026-08-03"), filha("2026-08-10"), filha("2026-08-17")];
    expect(proximoPrazo(corrente, "semanal", HOJE)).toBe("2026-08-24");
  });
});

describe("⚠️ corrente atrasada não alcança o presente — DECLARADO, não abençoado", () => {
  it("concluir com 3 meses de atraso gera ocorrência que já nasce vencida", () => {
    const corrente = [raiz("2026-05-31")];
    expect(proximoPrazo(corrente, "mensal", HOJE)).toBe("2026-06-30");
  });
});

describe("as outras recorrências", () => {
  it("semanal soma 7 dias sobre o maior prazo da corrente", () => {
    expect(proximoPrazo([raiz("2026-08-28")], "semanal", HOJE)).toBe("2026-09-04");
  });

  it("quinzenal soma 14 e atravessa o mês", () => {
    expect(proximoPrazo([raiz("2026-08-28")], "quinzenal", HOJE)).toBe("2026-09-11");
  });

  it("`nenhuma` não gera ocorrência — a trigger sequer dispara", () => {
    expect(proximoPrazo([raiz("2026-08-31")], "nenhuma", HOJE)).toBeNull();
  });
});

describe("a corrente real que está em produção hoje", () => {
  it("concluir a filha de 30/09 gera 31/10, não 30/10", () => {
    const corrente = [raiz("2026-08-31"), filha("2026-09-30")];
    expect(proximoPrazo(corrente, "mensal", HOJE)).toBe("2026-10-31");
  });
});
