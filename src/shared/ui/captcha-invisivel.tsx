import HCaptcha, { type ExecuteResponse } from "@hcaptcha/react-hcaptcha";
import { useCallback, useRef, type ReactNode } from "react";

export const MENSAGEM_DO_CAPTCHA =
  "Não foi possível concluir a verificação de segurança. Tente de novo.";

const ERROS_DE_CARGA = new Set(["script-error", "script-load-error-other"]);

export function chaveDoHcaptcha(): string | undefined {
  const chave = import.meta.env.VITE_HCAPTCHA_SITE_KEY as unknown;
  return typeof chave === "string" && chave.trim() !== "" ? chave.trim() : undefined;
}

export interface CaptchaInvisivel {
  widget: ReactNode;
  token: () => Promise<string | undefined>;
}

export function useCaptchaInvisivel(): CaptchaInvisivel {
  const chave = chaveDoHcaptcha();
  const ref = useRef<HCaptcha>(null);
  const scriptFalhou = useRef(false);
  const rejeitarEmCurso = useRef<((motivo: Error) => void) | null>(null);

  const token = useCallback(async () => {
    if (!chave) return undefined;
    const captcha = ref.current;
    if (!captcha || scriptFalhou.current) throw new Error(MENSAGEM_DO_CAPTCHA);
    captcha.resetCaptcha();
    let minhaRejeicao: ((motivo: Error) => void) | null = null;
    try {
      const { response } = await new Promise<ExecuteResponse>((resolver, rejeitar) => {
        minhaRejeicao = rejeitar;
        rejeitarEmCurso.current = rejeitar;
        captcha.execute({ async: true }).then(resolver, rejeitar);
      });
      return response;
    } catch {
      throw new Error(MENSAGEM_DO_CAPTCHA);
    } finally {
      if (rejeitarEmCurso.current === minhaRejeicao) rejeitarEmCurso.current = null;
    }
  }, [chave]);

  const aoFalhar = useCallback((evento: string) => {
    if (ERROS_DE_CARGA.has(evento)) scriptFalhou.current = true;
    rejeitarEmCurso.current?.(new Error(evento));
  }, []);

  const widget = chave ? (
    <HCaptcha
      ref={ref}
      sitekey={chave}
      size="invisible"
      reCaptchaCompat={false}
      sentry={false}
      onError={aoFalhar}
    />
  ) : null;

  return { widget, token };
}
