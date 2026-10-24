import { render } from "@testing-library/react";
import { useEffect } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const hc = vi.hoisted(() => ({ execute: vi.fn(), resetCaptcha: vi.fn(), props: vi.fn() }));

vi.mock("@hcaptcha/react-hcaptcha", async () => {
  const { forwardRef, useImperativeHandle } = await import("react");
  const Duplo = forwardRef<unknown, Record<string, unknown>>((props, ref) => {
    hc.props(props);
    useImperativeHandle(ref, () => ({ execute: hc.execute, resetCaptcha: hc.resetCaptcha }));
    return <div data-testid="hcaptcha" />;
  });
  return { default: Duplo };
});

const { MENSAGEM_DO_CAPTCHA, chaveDoHcaptcha, useCaptchaInvisivel } =
  await import("./captcha-invisivel");

let api: ReturnType<typeof useCaptchaInvisivel>;
function Sonda() {
  const atual = useCaptchaInvisivel();
  useEffect(() => {
    api = atual;
  });
  return <>{atual.widget}</>;
}

beforeEach(() => {
  hc.execute.mockReset();
  hc.resetCaptcha.mockReset();
  hc.props.mockReset();
});
afterEach(() => vi.unstubAllEnvs());

describe("C25 · useCaptchaInvisivel", () => {
  it("sem VITE_HCAPTCHA_SITE_KEY: sem widget, token undefined, nada executado", async () => {
    vi.stubEnv("VITE_HCAPTCHA_SITE_KEY", "  ");
    const { queryByTestId } = render(<Sonda />);
    expect(chaveDoHcaptcha()).toBeUndefined();
    expect(queryByTestId("hcaptcha")).toBeNull();
    expect(await api.token()).toBeUndefined();
    expect(hc.execute).not.toHaveBeenCalled();
  });

  it("🔴 com site key: cada token() reseta ANTES de executar, e duas tentativas dao dois tokens", async () => {
    vi.stubEnv("VITE_HCAPTCHA_SITE_KEY", "10000000-ffff-ffff-ffff-000000000001");
    hc.execute
      .mockResolvedValueOnce({ response: "token-1", key: "k1" })
      .mockResolvedValueOnce({ response: "token-2", key: "k2" });
    const { getByTestId } = render(<Sonda />);
    expect(getByTestId("hcaptcha")).toBeTruthy();
    expect(hc.props).toHaveBeenLastCalledWith(
      expect.objectContaining({
        sitekey: "10000000-ffff-ffff-ffff-000000000001",
        size: "invisible",
        reCaptchaCompat: false,
        sentry: false,
      }),
    );

    expect(await api.token()).toBe("token-1");
    expect(await api.token()).toBe("token-2");

    expect(hc.execute).toHaveBeenCalledTimes(2);
    expect(hc.execute).toHaveBeenCalledWith({ async: true });
    expect(hc.resetCaptcha).toHaveBeenCalledTimes(2);
    const [r1, r2] = hc.resetCaptcha.mock.invocationCallOrder;
    const [e1, e2] = hc.execute.mock.invocationCallOrder;
    expect(r1).toBeLessThan(e1!);
    expect(e1).toBeLessThan(r2!);
    expect(r2).toBeLessThan(e2!);
  });

  it("challenge fechado: token() rejeita com a mensagem da tela, nunca o erro cru", async () => {
    vi.stubEnv("VITE_HCAPTCHA_SITE_KEY", "10000000-ffff-ffff-ffff-000000000001");
    hc.execute.mockRejectedValueOnce(new Error("challenge-closed"));
    render(<Sonda />);
    await expect(api.token()).rejects.toThrow(MENSAGEM_DO_CAPTCHA);
  });
  it("🔴 script que nao carrega: o execute do componente real fica pendente, e onError destrava a tentativa", async () => {
    vi.stubEnv("VITE_HCAPTCHA_SITE_KEY", "10000000-ffff-ffff-ffff-000000000001");
    hc.execute.mockReturnValue(new Promise(() => {}));
    render(<Sonda />);
    const tentativa = api.token();
    const { onError } = hc.props.mock.lastCall![0] as { onError: (evento: string) => void };
    onError("script-error");
    await expect(tentativa).rejects.toThrow(MENSAGEM_DO_CAPTCHA);

    hc.execute.mockClear();
    await expect(api.token()).rejects.toThrow(MENSAGEM_DO_CAPTCHA);
    expect(hc.execute).not.toHaveBeenCalled();
  });

  it("erro que nao e de carga (ex.: rate-limited) rejeita a tentativa, mas a seguinte volta a executar", async () => {
    vi.stubEnv("VITE_HCAPTCHA_SITE_KEY", "10000000-ffff-ffff-ffff-000000000001");
    hc.execute.mockReturnValueOnce(new Promise(() => {}));
    render(<Sonda />);
    const tentativa = api.token();
    const { onError } = hc.props.mock.lastCall![0] as { onError: (evento: string) => void };
    onError("rate-limited");
    await expect(tentativa).rejects.toThrow(MENSAGEM_DO_CAPTCHA);

    hc.execute.mockResolvedValueOnce({ response: "token-3", key: "k3" });
    expect(await api.token()).toBe("token-3");
  });
  it("🔴 tentativas sobrepostas: a antiga, cancelada pelo execute da nova, nao apaga a valvula da nova", async () => {
    vi.stubEnv("VITE_HCAPTCHA_SITE_KEY", "10000000-ffff-ffff-ffff-000000000001");
    let pendente: ((motivo: Error) => void) | null = null;
    hc.execute.mockImplementation(
      () =>
        new Promise((_, rejeitar) => {
          pendente?.(new Error("hcaptcha-execute-replaced"));
          pendente = rejeitar;
        }),
    );
    render(<Sonda />);
    const antiga = api.token();
    const nova = api.token();
    await expect(antiga).rejects.toThrow(MENSAGEM_DO_CAPTCHA);

    const { onError } = hc.props.mock.lastCall![0] as { onError: (evento: string) => void };
    onError("script-error");
    await expect(nova).rejects.toThrow(MENSAGEM_DO_CAPTCHA);
  });
});
