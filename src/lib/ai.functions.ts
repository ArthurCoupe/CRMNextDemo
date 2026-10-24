import { createServerFn } from "@tanstack/react-start";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import {
  conversaPertenceAoUsuario,
  criarConversa,
  gravarMensagem,
  lerConversa,
  lerConversasRecentes,
  type MensagemDoHistorico,
} from "@/modules/ai/api/historico";
import {
  lerClientes,
  lerFinanceiro,
  lerMinhasTarefas,
  lerOnboarding,
  lerPipeline,
  lerQuemPergunta,
  type Cliente,
} from "@/modules/ai/api/leituras";
import {
  montarContexto,
  type ClienteDoContexto,
  type FinanceiroDoContexto,
  type OnboardingDoContexto,
  type OportunidadeDoContexto,
  type TarefaDoContexto,
} from "@/modules/ai/domain/contexto";
import {
  LIMITE_DE_CONVERSA_ABERTA,
  perguntaLongaDemais,
  TETO_DA_PERGUNTA,
} from "@/modules/ai/domain/pergunta";
import { VOCABULARIO } from "@/modules/ai/domain/vocabulario";
import { z } from "@/shared/lib/zod";
import { todaySP } from "@/shared/lib/date";
import { MODO_DEMO, respostaDaDemo } from "@/shared/lib/demo";
import { criarLimite, excedeuOLimite } from "@/shared/lib/rate-limit";

const MODELO = "gemini-3.6-flash";

const ENDPOINT = `https://generativelanguage.googleapis.com/v1beta/models/${MODELO}:streamGenerateContent?alt=sse`;

const INSTRUCAO_DE_SISTEMA = [
  "Você é o assistente interno do CRM da Next Business, uma agência brasileira.",
  "Responda sempre em português do Brasil, de forma objetiva e acionável.",
  "NUNCA invente números, nomes de clientes, valores ou datas.",
  "Se a informação não estiver no que foi fornecido, diga que não sabe.",
  "Nunca use travessão (em dash) nem meia-risca (en dash): no lugar, use vírgula, dois-pontos, ponto ou parênteses, e escreva intervalo com 'a' (\"4 a 5\").",
].join(" ");

const InputSchema = z
  .object({
    prompt: z.string().min(1).max(TETO_DA_PERGUNTA),
    conversaId: z.string().uuid().optional(),
  })
  .strict();

export function validarEntrada(input: unknown): z.infer<typeof InputSchema> {
  if (typeof input === "object" && input !== null && "prompt" in input) {
    const { prompt } = input;
    const longa = typeof prompt === "string" ? perguntaLongaDemais(prompt.length) : null;
    if (longa !== null) throw new Error(longa);
  }
  const resultado = InputSchema.safeParse(input);
  if (!resultado.success) throw new Error("Pergunta inválida.");
  return resultado.data;
}

const limiteDeAnalise = criarLimite(60_000, 20);

const LIMITE_DE_HISTORICO = 20;

interface RespostaDoGemini {
  readonly candidates?: readonly {
    readonly content?: { readonly parts?: readonly { readonly text?: string }[] };
    readonly finishReason?: string;
  }[];
  readonly promptFeedback?: { readonly blockReason?: string };
  readonly error?: { readonly status?: string; readonly message?: string };
}

function textoDoEvento(corpo: RespostaDoGemini): string {
  const partes = corpo.candidates?.[0]?.content?.parts ?? [];
  return partes.map((p) => p.text ?? "").join("");
}

export async function* eventosSSE(
  corpo: ReadableStream<Uint8Array>,
): AsyncGenerator<RespostaDoGemini> {
  const leitor = corpo.getReader();
  const decodificador = new TextDecoder();
  let buffer = "";
  try {
    for (;;) {
      const { done, value } = await leitor.read();
      if (done) break;
      buffer += decodificador.decode(value, { stream: true });
      const linhas = buffer.split("\n");
      buffer = linhas.pop() ?? "";
      for (const linha of linhas) {
        if (!linha.startsWith("data: ")) continue;
        const json = linha.slice("data: ".length).trim();
        if (json === "" || json === "[DONE]") continue;
        yield JSON.parse(json) as RespostaDoGemini;
      }
    }

    if (buffer.trim() !== "") {
      console.error(`[IA] SSE terminou com frame não despachado: ${JSON.stringify(buffer)}`);
    }
  } finally {
    await leitor.cancel();
  }
}

async function tolerante<T>(
  nome: string,
  falhas: string[],
  vazio: readonly T[],
  ler: () => Promise<readonly T[]>,
): Promise<readonly T[]> {
  try {
    return await ler();
  } catch (erro) {
    console.error(`[IA] leitura de ${nome} falhou: ${erro instanceof Error ? erro.message : erro}`);
    falhas.push(`não consegui ler ${nome}. Trate como desconhecido, não como vazio`);
    return vazio;
  }
}

async function montarContextoDoCrm(supabase: Cliente, userId: string) {
  const hoje = todaySP();
  const falhas: string[] = [];

  const { papel, nome } = await lerQuemPergunta(supabase, userId);

  const [minhasTarefas, pipeline, clientes, onboarding] = await Promise.all([
    tolerante<TarefaDoContexto>("suas tarefas", falhas, [], () =>
      lerMinhasTarefas(supabase, userId),
    ),
    tolerante<OportunidadeDoContexto>("o pipeline", falhas, [], () => lerPipeline(supabase)),
    tolerante<ClienteDoContexto>("os clientes", falhas, [], () => lerClientes(supabase)),
    tolerante<OnboardingDoContexto>("os onboardings", falhas, [], () => lerOnboarding(supabase)),
  ]);

  let financeiro: FinanceiroDoContexto | null = null;
  if (papel === "owner") {
    const primeiroDiaDoMes = `${hoje.slice(0, 7)}-01`;
    try {
      financeiro = await lerFinanceiro(supabase, primeiroDiaDoMes);
    } catch (erro) {
      console.error(
        `[IA] leitura financeira falhou: ${erro instanceof Error ? erro.message : erro}`,
      );
      falhas.push("não consegui ler o financeiro. Trate como desconhecido, não como zero");
    }
  }

  return montarContexto({
    hoje,
    nome,
    papel,
    minhasTarefas,
    pipeline,
    clientes,
    onboarding,
    financeiro,
    falhas,
  });
}

async function obterHistorico(
  supabase: Cliente,
  conversaIdSolicitado: string | undefined,
): Promise<{ conversaId: string | null; historico: readonly MensagemDoHistorico[] }> {
  if (conversaIdSolicitado === undefined) return { conversaId: null, historico: [] };
  if (!(await conversaPertenceAoUsuario(supabase, conversaIdSolicitado))) {
    return { conversaId: null, historico: [] };
  }

  const historico = await lerConversa(supabase, conversaIdSolicitado, LIMITE_DE_HISTORICO);
  return { conversaId: conversaIdSolicitado, historico };
}

export type FragmentoDeResposta =
  | { readonly tipo: "delta"; readonly texto: string }
  | { readonly tipo: "interrompida"; readonly motivo: string }
  | { readonly tipo: "fim"; readonly conversaId: string | null };

export const aiAnalyze = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator(validarEntrada)
  .handler(async function* ({ data, context }): AsyncGenerator<FragmentoDeResposta, void, unknown> {
    if (!limiteDeAnalise.permitir(context.userId)) throw excedeuOLimite("pergunta à IA");

    if (MODO_DEMO) {
      const contexto = await montarContextoDoCrm(context.supabase, context.userId);
      yield { tipo: "delta", texto: respostaDaDemo(contexto.texto) };
      yield { tipo: "fim", conversaId: null };
      return;
    }

    const { segredo } = await import("@/lib/segredos.server");
    const apiKey = segredo("GEMINI_API_KEY");
    if (!apiKey) throw new Error("GEMINI_API_KEY ausente no servidor");

    const contexto = await montarContextoDoCrm(context.supabase, context.userId);

    const { conversaId: conversaIdConfirmada, historico } = await obterHistorico(
      context.supabase,
      data.conversaId,
    );

    const resposta = await fetch(ENDPOINT, {
      method: "POST",
      headers: { "x-goog-api-key": apiKey, "content-type": "application/json" },
      body: JSON.stringify({
        system_instruction: {
          parts: [{ text: INSTRUCAO_DE_SISTEMA }, { text: VOCABULARIO }, { text: contexto.texto }],
        },
        contents: [
          ...historico.map((m) => ({ role: m.papel, parts: [{ text: m.conteudo }] })),
          { role: "user", parts: [{ text: data.prompt }] },
        ],
      }),
    });

    if (!resposta.ok) {
      const corpoDeErro = (await resposta.json().catch(() => null)) as RespostaDoGemini | null;
      console.error(`[IA] ${resposta.status}: ${corpoDeErro?.error?.message ?? "sem detalhe"}`);
      throw new Error(`A IA recusou a chamada (HTTP ${resposta.status})`);
    }

    if (resposta.body === null) throw new Error("A IA não devolveu corpo de resposta");

    let texto = "";
    let motivoDeBloqueio: string | undefined;
    let ultimoFinishReason: string | undefined;
    let erroDoProvedor: string | undefined;

    for await (const evento of eventosSSE(resposta.body)) {
      if (evento.error) {
        erroDoProvedor = evento.error.message ?? evento.error.status ?? "erro sem detalhe";
        break;
      }

      motivoDeBloqueio ??= evento.promptFeedback?.blockReason;
      ultimoFinishReason = evento.candidates?.[0]?.finishReason ?? ultimoFinishReason;

      const pedaco = textoDoEvento(evento);
      if (pedaco !== "") {
        texto += pedaco;
        yield { tipo: "delta", texto: pedaco };
      }
    }

    texto = texto.trim();

    if (texto === "") {
      const motivo = erroDoProvedor ?? motivoDeBloqueio ?? ultimoFinishReason ?? "desconhecido";
      throw new Error(`A IA não devolveu texto (motivo: ${motivo})`);
    }

    const motivoDaInterrupcao =
      erroDoProvedor ??
      (ultimoFinishReason !== undefined && ultimoFinishReason !== "STOP"
        ? ultimoFinishReason
        : undefined);
    if (motivoDaInterrupcao !== undefined) {
      console.error(
        `[IA] resposta interrompida (motivo: ${motivoDaInterrupcao}). ${texto.length} caracteres gravados mesmo assim`,
      );
    }

    let conversaId = conversaIdConfirmada;
    try {
      if (conversaId === null) {
        const titulo = data.prompt.slice(0, 60).trim();
        conversaId = await criarConversa(context.supabase, context.userId, titulo);
      }
      await gravarMensagem(context.supabase, conversaId, "user", data.prompt);
      await gravarMensagem(context.supabase, conversaId, "model", texto);
    } catch (erro) {
      console.error(
        `[IA] falha ao gravar a conversa: ${erro instanceof Error ? erro.message : erro}`,
      );
    }

    if (motivoDaInterrupcao !== undefined) {
      yield { tipo: "interrompida", motivo: motivoDaInterrupcao };
    }
    yield { tipo: "fim", conversaId };
  });

export const listarConversas = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => lerConversasRecentes(context.supabase, 20));

const CarregarConversaSchema = z.object({ conversaId: z.string().uuid() }).strict();

export function validarConversaId(input: unknown): z.infer<typeof CarregarConversaSchema> {
  const resultado = CarregarConversaSchema.safeParse(input);
  if (!resultado.success) throw new Error("Conversa inválida.");
  return resultado.data;
}

export const carregarConversa = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .validator(validarConversaId)
  .handler(async ({ data, context }) =>
    lerConversa(context.supabase, data.conversaId, LIMITE_DE_CONVERSA_ABERTA),
  );
