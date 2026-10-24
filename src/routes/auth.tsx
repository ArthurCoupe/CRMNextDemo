import { createFileRoute, redirect } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client.browser";
import { obterSessao } from "@/integrations/supabase/sessao";
import { AVISO_DA_DEMO, CONTA_DA_DEMO, MODO_DEMO } from "@/shared/lib/demo";
import { destinoSeguro } from "@/shared/lib/destino-seguro";
import { MENSAGEM_DO_CAPTCHA, useCaptchaInvisivel } from "@/shared/ui/captcha-invisivel";
import { pedirLinkDeRecuperacao } from "@/modules/seguranca/api/recuperacao";
import { codigoTotpValido, normalizarCodigoTotp, precisaDeSegundoFator } from "@/shared/lib/mfa";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";

const CODIGOS_DE_CONTA_RECONHECIDA = new Set([
  "invalid_credentials",
  "user_not_found",
  "email_not_confirmed",
  "phone_not_confirmed",
  "user_banned",
  "user_sso_managed",
  "email_address_not_authorized",
]);

function mensagemDeLogin(error: {
  code?: string | undefined;
  status?: number | undefined;
}): string {
  if (CODIGOS_DE_CONTA_RECONHECIDA.has(error.code ?? "")) {
    return "E-mail ou senha incorretos.";
  }
  if (error.status === 429) {
    return "Muitas tentativas. Aguarde alguns minutos e tente de novo.";
  }
  if (error.status === 0) {
    return "Não foi possível falar com o servidor. Verifique sua conexão e tente de novo.";
  }
  return "Não foi possível entrar agora. Tente de novo em alguns instantes.";
}

export const Route = createFileRoute("/auth")({
  validateSearch: (search: Record<string, unknown>) => ({
    redirect: typeof search.redirect === "string" ? search.redirect : undefined,
  }),
  beforeLoad: async ({ search }) => {
    const session = await obterSessao();
    if (session) throw redirect({ href: destinoSeguro(search.redirect) });
  },
  component: AuthPage,
});

export function AuthPage() {
  const { redirect: redirectParam } = Route.useSearch();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [aviso, setAviso] = useState<string | null>(null);
  const [fatorPendente, setFatorPendente] = useState<string | null>(null);
  const [codigoTotp, setCodigoTotp] = useState("");
  const captcha = useCaptchaInvisivel();

  const entrar = async (credenciais = { email, password }) => {
    setLoading(true);
    let captchaToken: string | undefined;
    try {
      captchaToken = await captcha.token();
    } catch {
      setLoading(false);
      return toast.error(MENSAGEM_DO_CAPTCHA);
    }
    const { error } = await supabase.auth.signInWithPassword({
      email: credenciais.email,
      password: credenciais.password,
      ...(captchaToken ? { options: { captchaToken } } : {}),
    });
    if (error) {
      setLoading(false);
      return toast.error(mensagemDeLogin(error));
    }
    const { data: nivel } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
    if (nivel && precisaDeSegundoFator(nivel.currentLevel, nivel.nextLevel)) {
      const { data: fatores } = await supabase.auth.mfa.listFactors();
      const fator = fatores?.totp.find((f) => f.status === "verified");
      setLoading(false);
      if (fator) {
        setFatorPendente(fator.id);
        return;
      }
    }
    setLoading(false);
    window.location.assign(destinoSeguro(redirectParam));
  };

  async function confirmarTotp() {
    if (fatorPendente === null) return;
    if (!codigoTotpValido(codigoTotp))
      return toast.error("Digite os 6 dígitos do app autenticador.");
    setLoading(true);
    const { error } = await supabase.auth.mfa.challengeAndVerify({
      factorId: fatorPendente,
      code: normalizarCodigoTotp(codigoTotp),
    });
    setLoading(false);
    if (error) return toast.error("Código inválido. Confira o horário do celular e tente de novo.");
    window.location.assign(destinoSeguro(redirectParam));
  }

  async function pedirRecuperacao() {
    setAviso(null);
    if (email.trim() === "") {
      setAviso("Digite seu e-mail para receber o link.");
      return;
    }
    setLoading(true);
    let captchaToken: string | undefined;
    try {
      captchaToken = await captcha.token();
    } catch {
      setLoading(false);
      toast.error(MENSAGEM_DO_CAPTCHA);
      return;
    }
    const resultado = await pedirLinkDeRecuperacao(email.trim(), captchaToken);
    setLoading(false);
    if (resultado === "captcha") {
      toast.error(MENSAGEM_DO_CAPTCHA);
      return;
    }
    if (resultado === "sem-conexao") {
      setAviso("Não foi possível falar com o servidor. Verifique sua conexão e tente de novo.");
      return;
    }
    setAviso(
      "Se esse e-mail tiver conta, o link de recuperação foi enviado. Se não chegar em alguns minutos, procure o administrador.",
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md p-8 shadow-lg">
        <div className="mb-6 flex items-center gap-3">
          <img src="/logo.png" alt="Next Business" className="h-10 w-10 rounded-lg object-cover" />
          <div>
            <h1 className="text-xl font-semibold">Next CRM</h1>
            <p className="text-sm text-muted-foreground">Entre para continuar</p>
          </div>
        </div>

        {MODO_DEMO && (
          <div className="mb-4 space-y-2">
            <Button
              type="button"
              className="w-full"
              disabled={loading}
              onClick={() =>
                void entrar({ email: CONTA_DA_DEMO.email, password: CONTA_DA_DEMO.senha })
              }
            >
              Entrar na demo
            </Button>
            <p className="text-center text-xs text-muted-foreground">
              Conta de demonstração: {CONTA_DA_DEMO.email}, senha {CONTA_DA_DEMO.senha}
            </p>
          </div>
        )}

        <form
          noValidate
          className="space-y-3 pt-2"
          onSubmit={(evento) => {
            evento.preventDefault();
            setAviso(null);
            if (!evento.currentTarget.checkValidity()) {
              toast.error("Digite um e-mail válido.");
              return;
            }
            void (fatorPendente !== null ? confirmarTotp() : entrar());
          }}
        >
          <div className="space-y-2">
            <Label htmlFor="email-signin">Email</Label>
            <Input
              id="email-signin"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="pwd-signin">Senha</Label>
            <Input
              id="pwd-signin"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>
          {fatorPendente !== null && (
            <div className="space-y-2">
              <Label htmlFor="codigo-totp">Código do app autenticador</Label>
              <Input
                id="codigo-totp"
                inputMode="numeric"
                autoComplete="one-time-code"
                value={codigoTotp}
                onChange={(e) => setCodigoTotp(e.target.value)}
              />
            </div>
          )}
          <Button type="submit" className="w-full" disabled={loading || !email || !password}>
            {fatorPendente !== null ? "Confirmar código" : "Entrar"}
          </Button>
          {!MODO_DEMO && (
            <Button
              type="button"
              variant="link"
              className="w-full"
              disabled={loading}
              onClick={() => void pedirRecuperacao()}
            >
              Esqueci minha senha
            </Button>
          )}
          {aviso && (
            <p role="status" className="text-center text-sm text-muted-foreground">
              {aviso}
            </p>
          )}
          <p className="pt-2 text-center text-xs text-muted-foreground">
            {MODO_DEMO
              ? AVISO_DA_DEMO
              : "Apenas usuários convidados podem acessar. Solicite acesso ao administrador."}
          </p>
          {captcha.widget}
        </form>
      </Card>
    </div>
  );
}
