import { semCaixaNemAcento } from "./campos";
import type { Estagio } from "./stage";

export function telefoneParaWhatsApp(telefone: string | null): string | null {
  const { comPais, digitos } = lerTelefone(telefone);
  if (!comPais && (digitos.length === 10 || digitos.length === 11)) return `55${digitos}`;
  if ((digitos.length === 12 || digitos.length === 13) && digitos.startsWith("55")) return digitos;
  return null;
}

export function telefoneDeOutroPais(telefone: string | null): boolean {
  const { comPais, digitos } = lerTelefone(telefone);
  return comPais && digitos !== "" && !digitos.startsWith("55");
}

function lerTelefone(telefone: string | null): { comPais: boolean; digitos: string } {
  const bruto = telefone ?? "";
  const soDigitos = bruto.replace(/\D/g, "");
  return {
    comPais: /^\D*\+/.test(bruto) || soDigitos.startsWith("00"),
    digitos: soDigitos.replace(/^0+/, ""),
  };
}

export function montarLinkDeConversa(telefone: string, texto: string): string {
  const base = `https://wa.me/${telefone}`;
  return texto.trim() === "" ? base : `${base}?text=${encodeURIComponent(texto)}`;
}

export interface ScriptSugerivel {
  readonly nicho: string;
  readonly pipelineStage: Estagio | null;
}

export interface ScriptOrdenado<S> {
  readonly script: S;
  readonly sugerido: boolean;
}

export function ordenarScriptsParaOportunidade<S extends ScriptSugerivel>(
  scripts: readonly S[],
  oportunidade: { readonly nicho: string | null; readonly estagio: Estagio },
): readonly ScriptOrdenado<S>[] {
  const nicho = semCaixaNemAcento(oportunidade.nicho ?? "");
  return scripts
    .map((script) => {
      const nichoDoScript = semCaixaNemAcento(script.nicho);
      const doNicho = nicho !== "" && nichoDoScript === nicho;
      const generico = !doNicho && nichoDoScript === "todos";
      const casaEtapa = script.pipelineStage === oportunidade.estagio;
      return { script, generico, pontos: Number(doNicho || generico) + Number(casaEtapa) };
    })
    .sort((a, b) => b.pontos - a.pontos || Number(a.generico) - Number(b.generico))
    .map(({ script, pontos }) => ({ script, sugerido: pontos > 0 }));
}

export function textoDoToque(tituloDoScript: string | null): string {
  return `WhatsApp · ${tituloDoScript ?? "sem script"}`;
}
