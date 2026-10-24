import { describe, expect, it } from "vitest";

import { extrairIdDaPasta } from "./drive";

const ID_DE_EXEMPLO = "1a2B3c_XYZ-999abc";

describe("extrairIdDaPasta", () => {
  it("extrai o ID de uma URL completa de pasta", () => {
    expect(extrairIdDaPasta(`https://drive.google.com/drive/folders/${ID_DE_EXEMPLO}`)).toBe(
      ID_DE_EXEMPLO,
    );
  });

  it("extrai o ID de uma URL com query string (?usp=sharing e afins)", () => {
    expect(
      extrairIdDaPasta(`https://drive.google.com/drive/folders/${ID_DE_EXEMPLO}?usp=sharing`),
    ).toBe(ID_DE_EXEMPLO);
  });

  it("extrai o ID de uma URL com conta múltipla (/u/{n}/)", () => {
    expect(extrairIdDaPasta(`https://drive.google.com/drive/u/2/folders/${ID_DE_EXEMPLO}`)).toBe(
      ID_DE_EXEMPLO,
    );
  });

  it("extrai o ID do formato antigo de link (drive.google.com/open?id=...)", () => {
    expect(extrairIdDaPasta(`https://drive.google.com/open?id=${ID_DE_EXEMPLO}`)).toBe(
      ID_DE_EXEMPLO,
    );
    expect(extrairIdDaPasta(`https://drive.google.com/open?authuser=0&id=${ID_DE_EXEMPLO}`)).toBe(
      ID_DE_EXEMPLO,
    );
  });

  it("aceita o ID solto, sem URL nenhuma", () => {
    expect(extrairIdDaPasta(ID_DE_EXEMPLO)).toBe(ID_DE_EXEMPLO);
  });

  it("recorta espaço em volta do ID solto", () => {
    expect(extrairIdDaPasta(`  ${ID_DE_EXEMPLO}  `)).toBe(ID_DE_EXEMPLO);
  });

  it("string vazia vira null", () => {
    expect(extrairIdDaPasta("")).toBeNull();
  });

  it("string só de espaço vira null", () => {
    expect(extrairIdDaPasta("   ")).toBeNull();
  });

  it("lixo vira null", () => {
    expect(extrairIdDaPasta("isso não é um link nem um id")).toBeNull();
    expect(extrairIdDaPasta("###@@@!!!")).toBeNull();
    expect(extrairIdDaPasta("abc123")).toBeNull();
  });

  it("URL de ARQUIVO do Drive vira null — não é pasta (decisão documentada em drive.ts)", () => {
    expect(extrairIdDaPasta(`https://drive.google.com/file/d/${ID_DE_EXEMPLO}/view`)).toBeNull();
  });

  it("outra URL do Google (docs, sheets) vira null", () => {
    expect(extrairIdDaPasta(`https://docs.google.com/document/d/${ID_DE_EXEMPLO}/edit`)).toBeNull();
  });

  it("URL de pasta mal formada (sem o segmento /folders/) vira null", () => {
    expect(extrairIdDaPasta(`https://drive.google.com/drive/${ID_DE_EXEMPLO}`)).toBeNull();
  });

  it("host do Drive no MEIO de uma URL de outro site vira null (regex ancorada)", () => {
    expect(
      extrairIdDaPasta(`https://outro.exemplo/?x=drive.google.com/drive/folders/${ID_DE_EXEMPLO}`),
    ).toBeNull();
    expect(
      extrairIdDaPasta(`https://outro.exemplo/?x=drive.google.com/open?id=${ID_DE_EXEMPLO}`),
    ).toBeNull();
    expect(
      extrairIdDaPasta(`https://evildrive.google.com/drive/folders/${ID_DE_EXEMPLO}`),
    ).toBeNull();
  });

  it("aceita a URL de pasta SEM o esquema — barra de endereco e recado colado nao trazem `https://`", () => {
    expect(extrairIdDaPasta(`drive.google.com/drive/folders/${ID_DE_EXEMPLO}`)).toBe(ID_DE_EXEMPLO);
    expect(extrairIdDaPasta(`www.drive.google.com/drive/folders/${ID_DE_EXEMPLO}`)).toBe(
      ID_DE_EXEMPLO,
    );
    expect(extrairIdDaPasta(`drive.google.com/open?id=${ID_DE_EXEMPLO}`)).toBe(ID_DE_EXEMPLO);
  });

  it("host do Drive no meio de uma URL SEM esquema tambem vira null", () => {
    expect(
      extrairIdDaPasta(`outro.exemplo/?x=drive.google.com/drive/folders/${ID_DE_EXEMPLO}`),
    ).toBeNull();
    expect(
      extrairIdDaPasta(`outro.exemplo/?x=drive.google.com/open?id=${ID_DE_EXEMPLO}`),
    ).toBeNull();
  });

  it("aceita o `www.` na frente do host", () => {
    expect(extrairIdDaPasta(`https://www.drive.google.com/drive/folders/${ID_DE_EXEMPLO}`)).toBe(
      ID_DE_EXEMPLO,
    );
  });
});
