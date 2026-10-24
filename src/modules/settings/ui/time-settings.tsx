import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useProfile } from "@/hooks/use-profile";
import type { PapelDoUsuario } from "@/integrations/supabase/papel";
import { FalhaAoLer } from "@/shared/ui/falha-ao-ler";
import { estadoDaConsulta } from "@/shared/ui/estado-da-consulta";

import {
  useAtualizarPerfil,
  useDefinirPapelDaPessoa,
  useDefinirSituacaoDaPessoa,
  useTime,
} from "../hooks/use-settings";

const COR_DO_AVATAR = "oklch(0.50 0.20 264)";

const PAPEIS_OFERECIDOS: readonly PapelDoUsuario[] = ["owner", "manager", "member"];

interface Edicao {
  readonly id: string;
  readonly nome: string | null;
  readonly cargo: string | null;
}

export function TimeSettings() {
  const time = useTime();
  const { papel, meuId } = useProfile();
  const definirSituacao = useDefinirSituacaoDaPessoa();
  const definirPapel = useDefinirPapelDaPessoa();
  const atualizarPerfil = useAtualizarPerfil();
  const [edicao, setEdicao] = useState<Edicao | null>(null);
  const estado = estadoDaConsulta(time);
  const pessoas = time.data?.pessoas ?? [];
  const alvo = edicao === null ? undefined : pessoas.find((p) => p.id === edicao.id);

  function salvar() {
    if (edicao === null || alvo === undefined) return;
    const nome = (edicao.nome ?? alvo.nome).trim();
    if (nome === "") {
      toast.error("O nome não pode ficar em branco.");
      return;
    }
    const cargo = (edicao.cargo ?? alvo.cargo ?? "").trim();
    atualizarPerfil.mutate(
      { id: edicao.id, dados: { nomeCompleto: nome, cargo: cargo === "" ? null : cargo } },
      { onSuccess: () => setEdicao(null) },
    );
  }

  if (estado === "erro") return <FalhaAoLer oQue="a equipe" />;
  if (estado === "carregando") {
    return <div className="h-48 animate-pulse rounded-xl border bg-card" />;
  }

  const ehOwner = papel === "owner";

  return (
    <Card className="p-6 shadow-card">
      <h3 className="mb-4 text-lg font-semibold">Equipe</h3>
      {time.data?.truncada === true && (
        <p className="mb-3 rounded-md border border-amber-500/40 bg-amber-500/5 px-3 py-2 text-xs text-amber-500">
          A lista chegou ao teto de perfis: há gente que não está aparecendo aqui. Esta leitura
          precisa de paginação antes de o time crescer mais.
        </p>
      )}
      <div className="space-y-2">
        {pessoas.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nenhum perfil ainda.</p>
        ) : (
          pessoas.map((p) => {
            const emEdicao = edicao !== null && edicao.id === p.id ? edicao : null;
            const podeEditar = ehOwner || p.id === meuId;
            return (
              <div key={p.id} className="flex items-center gap-3 rounded-lg border p-3">
                <div
                  className="flex h-9 w-9 items-center justify-center rounded-full text-sm font-semibold text-primary-foreground"
                  style={{ backgroundColor: COR_DO_AVATAR }}
                >
                  {p.iniciais}
                </div>
                <div className="min-w-0 flex-1">
                  {emEdicao !== null ? (
                    <fieldset
                      disabled={atualizarPerfil.isPending}
                      className="grid min-w-0 gap-2 sm:grid-cols-2"
                    >
                      <div className="grid gap-1">
                        <Label
                          htmlFor={`nome-${p.id}`}
                          className="text-[11px] text-muted-foreground"
                        >
                          Nome
                        </Label>
                        <Input
                          id={`nome-${p.id}`}
                          className="h-8 text-xs"
                          value={emEdicao.nome ?? p.nome}
                          maxLength={120}
                          onChange={(e) => setEdicao({ ...emEdicao, nome: e.target.value })}
                        />
                      </div>
                      <div className="grid gap-1">
                        <Label
                          htmlFor={`cargo-${p.id}`}
                          className="text-[11px] text-muted-foreground"
                        >
                          Cargo
                        </Label>
                        <Input
                          id={`cargo-${p.id}`}
                          className="h-8 text-xs"
                          placeholder="Sem cargo"
                          value={emEdicao.cargo ?? p.cargo ?? ""}
                          maxLength={120}
                          onChange={(e) => setEdicao({ ...emEdicao, cargo: e.target.value })}
                        />
                      </div>
                      <div className="flex gap-2 sm:col-span-2">
                        <Button
                          type="button"
                          size="sm"
                          disabled={atualizarPerfil.isPending}
                          onClick={salvar}
                        >
                          Salvar
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          variant="ghost"
                          disabled={atualizarPerfil.isPending}
                          onClick={() => setEdicao(null)}
                        >
                          Cancelar
                        </Button>
                      </div>
                    </fieldset>
                  ) : (
                    <>
                      <p className="text-sm font-medium">{p.nome}</p>
                      {p.cargo !== null && (
                        <p className="text-xs text-muted-foreground">{p.cargo}</p>
                      )}
                    </>
                  )}
                  <p className="truncate text-xs text-muted-foreground">{p.email}</p>
                </div>
                <div className="ml-auto flex items-center gap-2">
                  {podeEditar && emEdicao === null && (
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      aria-label={`Editar ${p.nome}`}
                      disabled={alvo !== undefined}
                      onClick={() => setEdicao({ id: p.id, nome: null, cargo: null })}
                    >
                      Editar
                    </Button>
                  )}
                  {ehOwner && p.id !== meuId ? (
                    <Select
                      value={p.papel}
                      onValueChange={(novoPapel) =>
                        definirPapel.mutate({ id: p.id, papel: novoPapel as PapelDoUsuario })
                      }
                      disabled={definirPapel.isPending}
                    >
                      <SelectTrigger className="h-7 w-[110px] text-[11px]">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {PAPEIS_OFERECIDOS.map((papelOferecido) => (
                          <SelectItem key={papelOferecido} value={papelOferecido}>
                            {papelOferecido}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  ) : (
                    <span className="text-[11px] text-muted-foreground">{p.papel}</span>
                  )}
                  {!p.ativo && (
                    <span className="rounded-md bg-muted px-2 py-0.5 text-[11px] text-muted-foreground">
                      inativo
                    </span>
                  )}
                  {ehOwner && p.id !== meuId && (
                    <Button
                      type="button"
                      size="sm"
                      variant={p.ativo ? "outline" : "default"}
                      disabled={definirSituacao.isPending}
                      onClick={() => definirSituacao.mutate({ id: p.id, ativo: !p.ativo })}
                    >
                      {p.ativo ? `Desativar ${p.nome}` : `Ativar ${p.nome}`}
                    </Button>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>
    </Card>
  );
}
