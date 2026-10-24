import { supabaseV2 } from "@/integrations/supabase/client.v2";
import { situacaoDoSegundoFator, type SituacaoDoSegundoFator } from "@/shared/lib/mfa";

export interface FatorTotp {
  readonly id: string;
  readonly nome: string;
  readonly verificado: boolean;
}

export interface CadastroTotp {
  readonly factorId: string;
  readonly qrCode: string;
  readonly segredo: string;
}

export async function listarFatores(): Promise<readonly FatorTotp[]> {
  const { data, error } = await supabaseV2.auth.mfa.listFactors();
  if (error) throw new Error("Não foi possível ler os fatores cadastrados.");
  return data.totp.map((f) => ({
    id: f.id,
    nome: f.friendly_name ?? "App autenticador",
    verificado: f.status === "verified",
  }));
}

export async function iniciarCadastroTotp(): Promise<CadastroTotp> {
  const { data, error } = await supabaseV2.auth.mfa.enroll({
    factorType: "totp",
    friendlyName: "Next CRM",
  });
  if (error || !data) throw new Error("Não foi possível iniciar o cadastro do app autenticador.");
  return { factorId: data.id, qrCode: data.totp.qr_code, segredo: data.totp.secret };
}

export async function confirmarCadastroTotp(factorId: string, codigo: string): Promise<void> {
  const { data: desafio, error: erroDesafio } = await supabaseV2.auth.mfa.challenge({ factorId });
  if (erroDesafio || !desafio) throw new Error("Não foi possível validar o código. Tente de novo.");
  const { error } = await supabaseV2.auth.mfa.verify({
    factorId,
    challengeId: desafio.id,
    code: codigo,
  });
  if (error) throw new Error("Código inválido. Confira o horário do celular e tente de novo.");
}

export async function removerFator(factorId: string): Promise<void> {
  const { error } = await supabaseV2.auth.mfa.unenroll({ factorId });
  if (error) {
    throw new Error(
      "Não foi possível remover. Saia e entre de novo com o código antes de remover.",
    );
  }
}

export async function lerSituacaoDoSegundoFator(): Promise<SituacaoDoSegundoFator> {
  const [fatores, nivel] = await Promise.all([
    supabaseV2.auth.mfa.listFactors(),
    supabaseV2.auth.mfa.getAuthenticatorAssuranceLevel(),
  ]);
  if (fatores.error || nivel.error || !nivel.data) return "ok";
  const verificado = fatores.data.totp.some((f) => f.status === "verified");
  return situacaoDoSegundoFator(verificado, nivel.data.currentLevel, nivel.data.nextLevel);
}
