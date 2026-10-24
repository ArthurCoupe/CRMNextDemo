import { useEffect, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { codigoTotpValido, normalizarCodigoTotp } from "@/shared/lib/mfa";

import {
  confirmarCadastroTotp,
  iniciarCadastroTotp,
  listarFatores,
  removerFator,
  type CadastroTotp,
  type FatorTotp,
} from "../api/mfa.repository";

function mensagem(erro: unknown, fallback: string): string {
  return erro instanceof Error ? erro.message : fallback;
}

export function SegundoFator() {
  const [fatores, setFatores] = useState<readonly FatorTotp[] | null>(null);
  const [cadastro, setCadastro] = useState<CadastroTotp | null>(null);
  const [codigo, setCodigo] = useState("");
  const [ocupado, setOcupado] = useState(false);

  function carregar(): Promise<void> {
    return listarFatores().then(setFatores, (erro: unknown) => {
      toast.error(mensagem(erro, "Não foi possível ler os fatores cadastrados."));
      setFatores([]);
    });
  }

  useEffect(() => {
    void carregar();
  }, []);

  async function iniciar() {
    setOcupado(true);
    try {
      setCadastro(await iniciarCadastroTotp());
    } catch (erro) {
      toast.error(mensagem(erro, "Não foi possível iniciar o cadastro."));
    } finally {
      setOcupado(false);
    }
  }

  async function confirmar() {
    if (!cadastro) return;
    if (!codigoTotpValido(codigo)) return toast.error("Digite os 6 dígitos do app autenticador.");
    setOcupado(true);
    try {
      await confirmarCadastroTotp(cadastro.factorId, normalizarCodigoTotp(codigo));
      toast.success("App autenticador cadastrado. O próximo login vai pedir o código.");
      setCadastro(null);
      setCodigo("");
      await carregar();
    } catch (erro) {
      toast.error(mensagem(erro, "Código inválido."));
    } finally {
      setOcupado(false);
    }
  }

  async function remover(id: string) {
    setOcupado(true);
    try {
      await removerFator(id);
      toast.success("Fator removido.");
      await carregar();
    } catch (erro) {
      toast.error(mensagem(erro, "Não foi possível remover."));
    } finally {
      setOcupado(false);
    }
  }

  const verificados = (fatores ?? []).filter((f) => f.verificado);

  return (
    <Card className="space-y-4 p-5">
      {fatores === null ? (
        <p className="text-sm text-muted-foreground">Carregando…</p>
      ) : verificados.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          Nenhum app autenticador cadastrado. Com ele, entrar no CRM exige a senha e um código de 6
          dígitos que muda a cada 30 segundos.
        </p>
      ) : (
        <ul className="space-y-2">
          {verificados.map((f) => (
            <li key={f.id} className="flex items-center justify-between text-sm">
              <span>{f.nome}</span>
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={ocupado}
                onClick={() => void remover(f.id)}
              >
                Remover
              </Button>
            </li>
          ))}
        </ul>
      )}

      {cadastro === null ? (
        <Button type="button" disabled={ocupado || fatores === null} onClick={() => void iniciar()}>
          Cadastrar app autenticador
        </Button>
      ) : (
        <div className="space-y-3">
          <p className="text-sm">
            Leia o QR no app (Google Authenticator, 1Password, Authy…) ou digite a chave:
          </p>
          <img src={cadastro.qrCode} alt="QR code do app autenticador" className="h-40 w-40" />
          <code className="block break-all text-xs">{cadastro.segredo}</code>
          <div className="space-y-2">
            <Label htmlFor="codigo-totp">Código de 6 dígitos</Label>
            <Input
              id="codigo-totp"
              inputMode="numeric"
              autoComplete="one-time-code"
              value={codigo}
              onChange={(e) => setCodigo(e.target.value)}
            />
          </div>
          <div className="flex gap-2">
            <Button type="button" disabled={ocupado} onClick={() => void confirmar()}>
              Confirmar
            </Button>
            <Button
              type="button"
              variant="outline"
              disabled={ocupado}
              onClick={() => setCadastro(null)}
            >
              Cancelar
            </Button>
          </div>
        </div>
      )}
    </Card>
  );
}
