import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { isAuthRetryableFetchError, isAuthSessionMissingError } from "@supabase/supabase-js";
import { conferirToken, supabase } from "@/integrations/supabase/client.browser";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";

const TAMANHO_MINIMO_DA_SENHA = 12;
const AVISO_LINK_INVALIDO =
  "Este link de recuperação expirou ou já foi usado. Peça um novo em /auth.";
const AVISO_OUTRA_CONTA =
  "Esse não é o e-mail da conta deste link. Confira o e-mail ou peça um novo link em /auth.";

function mensagemDeNovaSenha(error: { code?: string | undefined }): string {
  if (error.code === "weak_password") {
    return "Essa senha é fácil de adivinhar. Escolha outra, com mais caracteres.";
  }
  if (error.code === "same_password") {
    return "A senha nova precisa ser diferente da atual.";
  }
  return "Não foi possível salvar a senha. Tente de novo.";
}

type Tokens = { access_token: string; refresh_token: string };

export function tokensDaRecuperacao(hash: string): Tokens | null {
  const p = new URLSearchParams(hash.replace(/^#/, ""));
  const access_token = p.get("access_token");
  const refresh_token = p.get("refresh_token");
  if (p.get("type") !== "recovery" || !access_token || !refresh_token) return null;
  return { access_token, refresh_token };
}

function apagarFragmento() {
  if (!window.location.hash) return;
  window.history.replaceState(
    window.history.state,
    "",
    window.location.pathname + window.location.search,
  );
}

function falhaPassageira(error: { status?: number | undefined }): boolean {
  return isAuthRetryableFetchError(error) || error.status === 429 || (error.status ?? 0) >= 500;
}

type Estado =
  | { fase: "carregando" | "invalido" | "tentar-de-novo" }
  | { fase: "formulario"; conta: string; tokens: Tokens | null };

export const Route = createFileRoute("/nova-senha")({
  component: NovaSenhaPage,
});

export function NovaSenhaPage() {
  const [estado, setEstado] = useState<Estado>({ fase: "carregando" });
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [confirmacao, setConfirmacao] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let cancelado = false;
    const tokens = tokensDaRecuperacao(window.location.hash);
    const conferir = tokens
      ? conferirToken(tokens.access_token).then(({ data, error }) => ({
          conta: data.user?.email,
          error,
        }))
      : supabase.auth
          .getSession()
          .then(({ data }) => ({ conta: data.session?.user.email, error: null }));
    conferir
      .then(({ conta, error }) => {
        if (cancelado) return;
        if (error && falhaPassageira(error)) return setEstado({ fase: "tentar-de-novo" });
        if (!conta || !tokens) apagarFragmento();
        setEstado(conta ? { fase: "formulario", conta, tokens } : { fase: "invalido" });
      })
      .catch(() => {
        if (cancelado) return;
        apagarFragmento();
        setEstado({ fase: "invalido" });
      });
    return () => {
      cancelado = true;
    };
  }, []);

  async function definirNovaSenha() {
    if (estado.fase !== "formulario") return;
    if (email.trim().toLowerCase() !== estado.conta.toLowerCase()) {
      return toast.error(AVISO_OUTRA_CONTA);
    }
    if (senha !== confirmacao) return toast.error("As senhas não são iguais.");
    if (senha.length < TAMANHO_MINIMO_DA_SENHA) {
      return toast.error(`A senha precisa de pelo menos ${TAMANHO_MINIMO_DA_SENHA} caracteres.`);
    }

    setLoading(true);
    if (estado.tokens) {
      const { error: falhaDoLink } = await supabase.auth.setSession(estado.tokens);
      if (falhaDoLink) {
        setLoading(false);
        return toast.error(
          falhaPassageira(falhaDoLink)
            ? "Não foi possível confirmar o link agora. Tente de novo."
            : AVISO_LINK_INVALIDO,
        );
      }
      apagarFragmento();
      setEstado({ ...estado, tokens: null });
    }
    const { error } = await supabase.auth.updateUser({ password: senha });
    setLoading(false);
    if (error) {
      return toast.error(
        isAuthSessionMissingError(error) ? AVISO_LINK_INVALIDO : mensagemDeNovaSenha(error),
      );
    }

    window.location.assign("/");
  }

  if (estado.fase === "carregando") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background p-4">
        <p className="text-sm text-muted-foreground">Carregando...</p>
      </div>
    );
  }

  if (estado.fase !== "formulario") {
    const passageira = estado.fase === "tentar-de-novo";
    return (
      <div className="flex min-h-screen items-center justify-center bg-background p-4">
        <Card className="w-full max-w-md p-8 text-center shadow-lg">
          <h1 className="text-xl font-semibold">
            {passageira ? "Não foi possível conferir o link agora" : "Link inválido"}
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            {passageira ? "Recarregue a página para tentar de novo." : AVISO_LINK_INVALIDO}
          </p>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md p-8 shadow-lg">
        <div className="mb-6">
          <h1 className="text-xl font-semibold">Definir nova senha</h1>
          <p className="text-sm text-muted-foreground">Escolha uma senha nova para sua conta.</p>
        </div>

        <form
          className="space-y-3 pt-2"
          onSubmit={(evento) => {
            evento.preventDefault();
            void definirNovaSenha();
          }}
        >
          <div className="space-y-2">
            <Label htmlFor="email-da-conta">E-mail da sua conta</Label>
            <Input
              id="email-da-conta"
              type="email"
              autoComplete="username"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="senha-nova">Nova senha</Label>
            <Input
              id="senha-nova"
              autoComplete="new-password"
              type="password"
              value={senha}
              onChange={(e) => setSenha(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="senha-confirmacao">Confirmar senha</Label>
            <Input
              id="senha-confirmacao"
              autoComplete="new-password"
              type="password"
              value={confirmacao}
              onChange={(e) => setConfirmacao(e.target.value)}
            />
          </div>
          <Button
            type="submit"
            className="w-full"
            disabled={loading || !email || !senha || !confirmacao}
          >
            Salvar nova senha
          </Button>
        </form>
      </Card>
    </div>
  );
}
