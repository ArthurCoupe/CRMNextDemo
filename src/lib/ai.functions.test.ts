import { describe, expect, it } from "vitest";

import { eventosSSE, validarConversaId, validarEntrada } from "./ai.functions";

function streamDeChunks(chunks: readonly string[]): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder();
  return new ReadableStream({
    start(controller) {
      for (const chunk of chunks) controller.enqueue(encoder.encode(chunk));
      controller.close();
    },
  });
}

async function coletar(chunks: readonly string[]): Promise<unknown[]> {
  const eventos: unknown[] = [];
  for await (const evento of eventosSSE(streamDeChunks(chunks))) eventos.push(evento);
  return eventos;
}

const JSON_OLA = '{"candidates":[{"content":{"parts":[{"text":"olá mundo"}]}}]}';
const JSON_UM = '{"candidates":[{"content":{"parts":[{"text":"um"}]}}]}';
const JSON_DOIS = '{"candidates":[{"content":{"parts":[{"text":"dois"}]}}]}';
const JSON_DEPOIS_DO_COMENTARIO =
  '{"candidates":[{"content":{"parts":[{"text":"depois do comentário"}]}}]}';
const JSON_ERRO = '{"error":{"status":"INTERNAL","message":"o modelo caiu"}}';
const JSON_NAO_DEVERIA_CHEGAR =
  '{"candidates":[{"content":{"parts":[{"text":"não deveria chegar"}]}}]}';

describe("eventosSSE", () => {
  it.each([
    [
      "frame partido entre dois chunks de rede",
      [`data: ${JSON_OLA}\n\n`.slice(0, 30), `data: ${JSON_OLA}\n\n`.slice(30)],
      [JSON.parse(JSON_OLA) as unknown],
    ],
    [
      "vários eventos no mesmo chunk de rede",
      [`data: ${JSON_UM}\n\ndata: ${JSON_DOIS}\n\n`],
      [JSON.parse(JSON_UM) as unknown, JSON.parse(JSON_DOIS) as unknown],
    ],
    [
      "CRLF (\\r\\n) — o \\r sobra na linha e some no .trim()",
      [`data: ${JSON_OLA}\r\n\r\n`],
      [JSON.parse(JSON_OLA) as unknown],
    ],
    [
      "linha em branco e linha de comentário (':') são ignoradas, não quebram o parser",
      [`: keep-alive\n\n\ndata: ${JSON_DEPOIS_DO_COMENTARIO}\n\n`],
      [JSON.parse(JSON_DEPOIS_DO_COMENTARIO) as unknown],
    ],
    ["[DONE] não vira evento", ["data: [DONE]\n\n"], []],
    [
      "evento de erro no meio do stream chega intacto ao chamador",
      [`data: ${JSON_ERRO}\n\ndata: ${JSON_NAO_DEVERIA_CHEGAR}\n\n`],
      [JSON.parse(JSON_ERRO) as unknown, JSON.parse(JSON_NAO_DEVERIA_CHEGAR) as unknown],
    ],
  ])("%s", async (_nome, chunks, esperado) => {
    await expect(coletar(chunks)).resolves.toEqual(esperado);
  });
});

describe("validarEntrada (AI-3)", () => {
  it("pergunta no teto passa e devolve o input tipado", () => {
    const prompt = "a".repeat(8000);
    expect(validarEntrada({ prompt })).toEqual({ prompt });
  });

  it("um caractere acima do teto recusa com frase legível, não com o JSON do Zod", () => {
    expect(() => validarEntrada({ prompt: "a".repeat(8001) })).toThrow(
      "A pergunta tem 8.001 caracteres; o máximo é 8.000.",
    );
  });

  it("qualquer outra falha de forma recusa com frase genérica", () => {
    expect(() => validarEntrada({ prompt: "" })).toThrow("Pergunta inválida.");
    expect(() => validarEntrada({ prompt: "oi", conversaId: "não-é-uuid" })).toThrow(
      "Pergunta inválida.",
    );
    expect(() => validarEntrada(null)).toThrow("Pergunta inválida.");
  });
});

describe("C27 · validators sao .strict(): campo extra e erro, nao silencio", () => {
  it("aiAnalyze: { prompt, role } e recusado (antes: role era ignorado)", () => {
    expect(() => validarEntrada({ prompt: "oi", role: "owner" })).toThrow("Pergunta inválida.");
  });

  it("controle positivo: so os campos do schema passam", () => {
    expect(validarEntrada({ prompt: "oi" })).toEqual({ prompt: "oi" });
  });

  it("carregarConversa: campo extra e recusado; uuid valido passa", () => {
    const id = "00000000-0000-4000-8000-000000000000";
    expect(() => validarConversaId({ conversaId: id, profileId: "x" })).toThrow(
      "Conversa inválida.",
    );
    expect(validarConversaId({ conversaId: id })).toEqual({ conversaId: id });
  });
});
