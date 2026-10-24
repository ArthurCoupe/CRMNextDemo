import { describe, expect, it } from "vitest";
import { CsvInvalido, detectarSeparador, lerCsv } from "./csv";

describe("lerCsv", () => {
  it("separa por vírgula e por ponto e vírgula (Excel BR)", () => {
    expect(lerCsv("nome,telefone\nAna,11\n").linhas).toEqual([["Ana", "11"]]);
    expect(lerCsv("nome;telefone\nAna;11\n").linhas).toEqual([["Ana", "11"]]);
    expect(detectarSeparador("a;b,c;d")).toBe(";");
  });
  it("🔴 campo entre aspas com separador, aspas duplicadas e quebra de linha dentro", () => {
    const texto = 'nome,obs\r\n"Silva, Ana","disse ""ok""\nna segunda"\r\n';
    expect(lerCsv(texto).linhas).toEqual([["Silva, Ana", 'disse "ok"\nna segunda']]);
  });
  it("remove o BOM e a linha vazia final, e preenche campo faltante com vazio", () => {
    expect(lerCsv("\uFEFFnome,telefone\nAna\n\n").linhas).toEqual([["Ana", ""]]);
  });
  it("linha com campos a mais é erro com o número da linha", () => {
    expect(() => lerCsv("nome\nAna,extra\n")).toThrow(CsvInvalido);
    expect(() => lerCsv("nome\nAna,extra\n")).toThrow("linha 2");
  });
  it("cabeçalho vazio é erro", () => {
    expect(() => lerCsv("")).toThrow(CsvInvalido);
  });
  it("campo entre aspas no fim do arquivo, sem quebra de linha final", () => {
    expect(lerCsv('nome,obs\nAna,"até aqui"').linhas).toEqual([["Ana", "até aqui"]]);
  });
  it("cabeçalho com espaços nas pontas é aparado", () => {
    expect(lerCsv(" nome , telefone \nAna,11\n").cabecalho).toEqual(["nome", "telefone"]);
  });
  it("🔴 aspa solta no meio de um campo não citado é literal, não reabre aspas", () => {
    const texto = "nome;obs\nAna;5'2\" e 3,5cm\nBia;x\n";
    expect(lerCsv(texto).linhas).toEqual([
      ["Ana", "5'2\" e 3,5cm"],
      ["Bia", "x"],
    ]);
  });
  it("🔴 aspas abertas sem fechar lançam erro mencionando a linha onde abriram, sem engolir o resto do arquivo", () => {
    const texto = 'nome,obs\nAna,"aberta\nBia,x\n';
    expect(() => lerCsv(texto)).toThrow(CsvInvalido);
    expect(() => lerCsv(texto)).toThrow("linha 2");
  });
  it("CRLF dentro de aspas vira só \\n, igual ao resto do arquivo", () => {
    const texto = 'nome,obs\r\n"A","l1\r\nl2"\r\n';
    expect(lerCsv(texto).linhas).toEqual([["A", "l1\nl2"]]);
  });
  it("linha em branco no meio do corpo é ignorada, não só a última", () => {
    expect(lerCsv("nome,telefone\nAna,11\n\nBia,22\n").linhas).toEqual([
      ["Ana", "11"],
      ["Bia", "22"],
    ]);
  });
  it("CsvInvalido tem name próprio, não 'Error'", () => {
    expect(new CsvInvalido("x").name).toBe("CsvInvalido");
  });
});
