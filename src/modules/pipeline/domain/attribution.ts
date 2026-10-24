import { montarLinkDeConversa } from "./whatsapp";

const FORMA_DO_ID = /^[0-9a-f]{8}-?[0-9a-f]{4}-?[0-9a-f]{4}-?[0-9a-f]{4}-?[0-9a-f]{12}$/;

export function extrairRef(texto: string): string | null {
  const casamento = /ref:\s*([0-9a-fA-F-]{32,})/.exec(texto);
  if (casamento === null) {
    const cru = texto.trim().toLowerCase();
    return FORMA_DO_ID.test(cru) ? cru : null;
  }
  const id = casamento[1]!.toLowerCase();
  return FORMA_DO_ID.test(id) ? id : null;
}

export function montarLinkWhatsApp(telefoneE164: string, attributionId: string): string {
  const telefone = telefoneE164.replace(/\D/g, "");
  if (telefone.length < 10) {
    throw new Error("Telefone precisa estar em formato internacional (ex.: 5511999999999).");
  }
  const texto = `Olá! Vim pelo site e quero saber mais. ref:${attributionId}`;
  return montarLinkDeConversa(telefone, texto);
}

export const CAMPOS_UTM = [
  "utm_source",
  "utm_medium",
  "utm_campaign",
  "utm_content",
  "utm_term",
] as const;

export type CampoUtm = (typeof CAMPOS_UTM)[number];

export interface DadosDeAtribuicao {
  readonly utmSource: string | null;
  readonly utmMedium: string | null;
  readonly utmCampaign: string | null;
  readonly utmContent: string | null;
  readonly utmTerm: string | null;
  readonly landingUrl: string | null;
}

export function temDadosDeCampanha(dados: DadosDeAtribuicao | null): boolean {
  if (dados === null) return false;
  return (
    dados.utmSource !== null ||
    dados.utmMedium !== null ||
    dados.utmCampaign !== null ||
    dados.utmContent !== null ||
    dados.utmTerm !== null
  );
}
