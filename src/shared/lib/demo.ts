export const MODO_DEMO = import.meta.env.VITE_CRM_DEMO === "1";

export const CONTA_DA_DEMO = { email: "helena@crm-demo.test", senha: "demo-crm-2026" } as const;

export const AVISO_DA_DEMO = "Demonstração: empresa e dados fictícios.";

export function rotaDesligadaNaDemo(caminho: string): boolean {
  let p = caminho;
  try {
    p = decodeURIComponent(caminho);
  } catch {
    // Caminho mal codificado: decide pelo texto cru, que o roteador também não casa.
  }
  p = p.toLowerCase().replace(/\/{2,}/g, "/");
  return p === "/api" || p.startsWith("/api/");
}

export function respostaDaDemo(contexto: string): string {
  return [
    "**Resposta simulada.** Nesta demonstração o assistente não chama nenhum provedor de IA.",
    "No sistema real, um modelo lê o contexto abaixo, montado pelo CRM para quem pergunta e recortado pelo papel dela, e responde em português.",
    "",
    contexto.trim() === "" ? "Nenhum dado visível para esta conta." : contexto,
  ].join("\n");
}
