export type ResultadoDaRecuperacao = "enviado" | "captcha" | "sem-conexao";

export async function pedirLinkDeRecuperacao(
  email: string,
  captchaToken?: string,
): Promise<ResultadoDaRecuperacao> {
  let resposta: Response;
  try {
    resposta = await fetch("/api/recuperar", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email, ...(captchaToken ? { captchaToken } : {}) }),
    });
  } catch {
    return "sem-conexao";
  }
  if (resposta.status === 400) {
    const corpo = (await resposta.json().catch(() => ({}))) as { error?: unknown };
    if (corpo.error === "captcha") return "captcha";
  }
  return "enviado";
}
