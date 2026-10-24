import { describe, expect, it } from "vitest";

import {
  ehLinkHttps,
  type RascunhoDoPost,
  tamanho,
  validarCorrecaoDaPublicacao,
  validarPost,
} from "./formulario";

const BASE: RascunhoDoPost = {
  clienteId: "c1",
  titulo: "  Lançamento  ",
  legenda: "",
  formato: "reel",
  canal: "instagram",
  linkDaArte: "  https://drive.test/arte  ",
  data: "2026-10-05",
  hora: "18:00",
  responsavelId: "u1",
};

function erros(r: RascunhoDoPost) {
  const v = validarPost(r);
  return v.ok ? {} : v.erros;
}

describe("validarPost", () => {
  it("válido: limpa espaços, vazio vira nulo e o horário é de SP", () => {
    expect(validarPost(BASE)).toEqual({
      ok: true,
      campos: {
        clienteId: "c1",
        titulo: "Lançamento",
        legenda: null,
        formato: "reel",
        canal: "instagram",
        linkDaArte: "https://drive.test/arte",
        agendadoPara: "2026-10-05T21:00:00.000Z",
        responsavelId: "u1",
      },
    });
  });

  it("obrigatórios", () => {
    expect(erros({ ...BASE, clienteId: "", titulo: "   ", responsavelId: "" })).toEqual({
      clienteId: "Escolha o cliente.",
      titulo: "Escreva o título do post.",
      responsavelId: "Escolha o responsável.",
    });
  });

  it("título até 200", () => {
    expect(erros({ ...BASE, titulo: "x".repeat(200) })).toEqual({});
    expect(erros({ ...BASE, titulo: "x".repeat(201) }).titulo).toBe(
      "O título pode ter até 200 caracteres.",
    );
  });

  it("legenda conta emoji como 1, igual ao char_length do banco", () => {
    expect(tamanho("😀😀")).toBe(2);
    expect(erros({ ...BASE, legenda: "😀".repeat(2200) })).toEqual({});
    expect(erros({ ...BASE, legenda: "😀".repeat(2201) }).legenda).toBe(
      "A legenda pode ter até 2.200 caracteres.",
    );
  });

  it("link da arte: https sem espaço, até 2.000", () => {
    const mensagem = "O link da arte precisa começar com https:// e ter até 2.000 caracteres.";
    expect(erros({ ...BASE, linkDaArte: "http://drive.test/a" }).linkDaArte).toBe(mensagem);
    expect(erros({ ...BASE, linkDaArte: "https://drive .test/a" }).linkDaArte).toBe(mensagem);
    expect(erros({ ...BASE, linkDaArte: `https://${"a".repeat(1993)}` }).linkDaArte).toBe(mensagem);
    expect(ehLinkHttps(`https://${"a".repeat(1992)}`)).toBe(true);
  });

  it.each([
    ["data vazia", { data: "" }],
    ["dia que não existe", { data: "2026-02-30" }],
    ["ano pela metade", { data: "0002-01-01" }],
    ["hora inválida", { hora: "25:00" }],
    ["hora vazia", { hora: "" }],
  ])("%s: Informe data e hora válidas.", (_caso, extra) => {
    expect(erros({ ...BASE, ...extra }).data).toBe("Informe data e hora válidas.");
  });
});

describe("validarCorrecaoDaPublicacao (D-069, C5)", () => {
  const AGORA = new Date("2026-10-04T15:00:00Z");

  it("link e data válidos viram o link aparado e o instante de SP", () => {
    expect(
      validarCorrecaoDaPublicacao(
        { link: " https://instagram.com/p/certo ", data: "2026-10-04", hora: "09:00" },
        AGORA,
      ),
    ).toEqual({
      ok: true,
      correcao: { link: "https://instagram.com/p/certo", publicadoEm: "2026-10-04T12:00:00.000Z" },
    });
  });

  it("link vazio vira null", () => {
    expect(
      validarCorrecaoDaPublicacao({ link: "  ", data: "2026-10-04", hora: "09:00" }, AGORA),
    ).toEqual({ ok: true, correcao: { link: null, publicadoEm: "2026-10-04T12:00:00.000Z" } });
  });

  it("link sem https, com espaço no meio ou acima de 2.000 é recusado; no limite passa (controle)", () => {
    const recusa = {
      ok: false,
      erro: "O link do post precisa começar com https:// e ter até 2.000 caracteres.",
    };
    const com = (link: string) =>
      validarCorrecaoDaPublicacao({ link, data: "2026-10-04", hora: "09:00" }, AGORA);
    expect(com("http://x.test/a")).toEqual(recusa);
    expect(com("https://x .test/a")).toEqual(recusa);
    expect(com(`https://${"a".repeat(1993)}`)).toEqual(recusa);
    expect(com(`https://${"a".repeat(1992)}`).ok).toBe(true);
  });

  it("🔴 um minuto depois de agora é recusado; agora passa (controle)", () => {
    expect(
      validarCorrecaoDaPublicacao({ link: "", data: "2026-10-04", hora: "12:01" }, AGORA),
    ).toEqual({ ok: false, erro: "A data da publicação não pode ficar no futuro." });
    expect(
      validarCorrecaoDaPublicacao({ link: "", data: "2026-10-04", hora: "12:00" }, AGORA).ok,
    ).toBe(true);
  });

  it("data vazia, ano implausível ou hora vazia é recusada", () => {
    const erro = { ok: false, erro: "Data ou hora inválida." };
    expect(validarCorrecaoDaPublicacao({ link: "", data: "", hora: "09:00" }, AGORA)).toEqual(erro);
    expect(
      validarCorrecaoDaPublicacao({ link: "", data: "0002-10-04", hora: "09:00" }, AGORA),
    ).toEqual(erro);
    expect(validarCorrecaoDaPublicacao({ link: "", data: "2026-10-04", hora: "" }, AGORA)).toEqual(
      erro,
    );
  });
});
