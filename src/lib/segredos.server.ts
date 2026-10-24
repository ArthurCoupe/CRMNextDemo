export const NOMES_DE_SEGREDO = ["GEMINI_API_KEY", "SUPABASE_SERVICE_ROLE_KEY"] as const;

export type NomeDeSegredo = (typeof NOMES_DE_SEGREDO)[number];

export function segredo(nome: NomeDeSegredo): string | undefined {
  const valor = process.env[nome];
  return valor === undefined || valor === "" ? undefined : valor;
}
