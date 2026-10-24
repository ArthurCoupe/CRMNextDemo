export const DEFINA_EM_CONFIGURACOES = "Defina em Configurações › Papéis do onboarding.";

export const PECA_AO_OWNER =
  "Só um owner configura isso, em Configurações › Papéis do onboarding. Peça a ele.";

export function saidaDoAvisoDePapel(perfilChegou: boolean, ehOwner: boolean): string | null {
  if (!perfilChegou) return null;
  return ehOwner ? DEFINA_EM_CONFIGURACOES : PECA_AO_OWNER;
}
