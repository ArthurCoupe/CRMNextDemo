import { describe, expect, it } from "vitest";

import { destinoSeguro } from "./destino-seguro";

const ORIGEM_REAL = "https://crm.example.com";

function afirmar(valor: unknown, esperado: string) {
  const resultado = destinoSeguro(valor);
  expect(resultado).toBe(esperado);
  expect(new URL(resultado, ORIGEM_REAL).origin).toBe(ORIGEM_REAL);
}

describe("destinoSeguro — tentativas de escapar da origem devolvem '/'", () => {
  it("🔴 backslash unico — o bug relatado do AUTH-1", () => {
    afirmar("/\\evil.com", "/");
  });

  it("protocol-relative classico ('//')", () => {
    afirmar("//evil.com", "/");
  });

  it("barra + backslash + barra", () => {
    afirmar("/\\/evil.com", "/");
  });

  it("🔴 esquema javascript: nao e path", () => {
    afirmar("javascript:alert(1)", "/");
  });

  it("absoluta com origem estranha", () => {
    afirmar("https://evil.com", "/");
  });

  it("absoluta MESMO da propria origem do app — o parametro e sempre caminho", () => {
    afirmar("https://crm.example.com/meetings", "/");
  });

  it("dois backslash, sem barra na frente", () => {
    afirmar("\\\\evil.com", "/");
  });

  it("barra + dois backslash", () => {
    afirmar("/\\\\evil.com", "/");
  });

  it.each([[undefined], [null], [42]])("valor que nao e string (%s) -> '/'", (valor) => {
    afirmar(valor, "/");
  });

  it("string vazia -> '/'", () => {
    afirmar("", "/");
  });

  it("tab DEPOIS da barra inicial — o escape real (nao o tab no inicio, ver normalizacao)", () => {
    afirmar("/\t/evil.com", "/");
  });

  it("CR+LF depois da barra inicial — mesma familia do tab", () => {
    afirmar("/\r\n/evil.com", "/");
  });

  it.each([
    "///evil.com",
    "//user@evil.com",
    "HTTPS://evil.com",
    "data:text/html,x",
    " //evil.com",
  ])("%s -> '/'", (valor) => {
    afirmar(valor, "/");
  });
});

describe("destinoSeguro — ROUND 1: normalizacao de '.'/'..' nao pode reabrir a mesma porta", () => {
  it.each([
    "/.//evil.com",
    "/%2e%2e//evil.com",
    "/meetings/../..//evil.com",
    "/./\\evil.com",
    "/..//evil.com",
    "/.//",
  ])("%s -> '/'", (valor) => {
    afirmar(valor, "/");
  });
});

describe("destinoSeguro — ROUND 2: revalidar contra a SENTINELA nao basta, o host dela colide", () => {
  it.each(["/.//destino.invalid/x", "/.//DESTINO.INVALID/x", "/.//destino.invalid:80/x"])(
    "%s -> '/'",
    (valor) => {
      afirmar(valor, "/");
    },
  );
});

describe("destinoSeguro — caminho da propria origem passa direto", () => {
  it("caminho simples", () => {
    afirmar("/meetings", "/meetings");
  });

  it("caminho com query string", () => {
    afirmar("/pipeline?tipo=sdr", "/pipeline?tipo=sdr");
  });

  it("caminho com hash", () => {
    afirmar("/onboarding#etapa-2", "/onboarding#etapa-2");
  });

  it("raiz", () => {
    afirmar("/", "/");
  });
});

describe("destinoSeguro — normalizacao: o parser muda o texto, a origem continua segura", () => {
  it("percent-encoded nao vira barra dupla decodificada", () => {
    afirmar("%2F%2Fevil.com", "/%2F%2Fevil.com");
  });

  it("tab no inicio — o parser WHATWG remove antes de decidir path", () => {
    afirmar("\t/evil.com", "/evil.com");
  });

  it("newline no inicio — mesma remocao do tab", () => {
    afirmar("\n/evil.com", "/evil.com");
  });

  it("backslash NO MEIO do path vira separador comum, nao autoridade nova", () => {
    afirmar("/evil.com\\@x", "/evil.com/@x");
  });
});
