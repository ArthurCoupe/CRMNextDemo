import { useMemo, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ehDataCivilPlausivel } from "@/shared/lib/date";
import { brl } from "@/shared/lib/format";
import { useMudou } from "@/shared/lib/use-mudou";
import { estadoDaConsulta } from "@/shared/ui/estado-da-consulta";

import type { PessoaCadastrada, PessoaParaGravar } from "../api/payroll.repository";
import {
  hojeEmSaoPaulo,
  interpretarValorEmReais,
  mesEAno,
  ROTULO_DA_BU,
  type UnidadeDeNegocio,
} from "../domain/expenses";
import {
  avisoDePercentualSugerido,
  pessoaNaFolhaEm,
  ROTULO_DO_VINCULO,
  type VinculoDeTrabalho,
} from "../domain/payroll";
import { useAtualizarPessoa, useCriarPessoa, usePerfisParaVincular } from "../hooks/use-payroll";

const SEM_PERFIL = "nenhum";

interface Rascunho {
  pessoa: string;
  cargo: string;
  vinculo: VinculoDeTrabalho;
  bu: UnidadeDeNegocio;
  custoMensal: string;
  beneficios: string;
  percentualSugerido: string;
  perfilId: string;
  inicio: string;
  fim: string;
}

function rascunhoVazio(): Rascunho {
  return {
    pessoa: "",
    cargo: "",
    vinculo: "clt",
    bu: "demanda",
    custoMensal: "",
    beneficios: "",
    percentualSugerido: "",
    perfilId: SEM_PERFIL,
    inicio: hojeEmSaoPaulo(),
    fim: "",
  };
}

function rascunhoDe(p: PessoaCadastrada): Rascunho {
  return {
    pessoa: p.pessoa,
    cargo: p.cargo ?? "",
    vinculo: p.vinculo,
    bu: p.bu,
    custoMensal: String(p.custoMensal).replace(".", ","),
    beneficios: p.beneficios === 0 ? "" : String(p.beneficios).replace(".", ","),
    percentualSugerido: p.percentualSugerido === null ? "" : String(p.percentualSugerido),
    perfilId: p.profileId ?? SEM_PERFIL,
    inicio: p.inicio,
    fim: p.fim ?? "",
  };
}

interface FormularioDePessoaProps {
  readonly aberto: boolean;
  readonly onFechar: () => void;
  readonly pessoa: PessoaCadastrada | null;
}

export function FormularioDePessoa({ aberto, onFechar, pessoa }: FormularioDePessoaProps) {
  const [rascunho, setRascunho] = useState<Rascunho>(() =>
    aberto && pessoa !== null ? rascunhoDe(pessoa) : rascunhoVazio(),
  );
  const perfis = usePerfisParaVincular(pessoa?.profileId ?? null);
  const estadoDosPerfis = estadoDaConsulta(perfis);
  const criar = useCriarPessoa();
  const atualizar = useAtualizarPessoa();

  const abriu = useMudou(aberto);
  const trocouPessoa = useMudou(pessoa);
  if (aberto && (abriu || trocouPessoa)) {
    setRascunho(pessoa === null ? rascunhoVazio() : rascunhoDe(pessoa));
  }

  const editar = <C extends keyof Rascunho>(campo: C, valor: Rascunho[C]) =>
    setRascunho((atual) => ({ ...atual, [campo]: valor }));

  const custoMensal = interpretarValorEmReais(rascunho.custoMensal);
  const beneficios =
    rascunho.beneficios.trim() === "" ? 0 : interpretarValorEmReais(rascunho.beneficios);

  const custoFixo = useMemo(
    () => (custoMensal === null || beneficios === null ? null : custoMensal + beneficios),
    [custoMensal, beneficios],
  );

  const percentual = useMemo(() => {
    const limpo = rascunho.percentualSugerido.trim();
    if (limpo === "") return null;
    const n = Number(limpo.replace(",", "."));
    return Number.isFinite(n) && n >= 0 && n <= 100 ? n : null;
  }, [rascunho.percentualSugerido]);

  const contaNesteMes = useMemo(
    () =>
      pessoaNaFolhaEm(rascunho.inicio, rascunho.fim === "" ? null : rascunho.fim, hojeEmSaoPaulo()),
    [rascunho.inicio, rascunho.fim],
  );

  const aviso = avisoDePercentualSugerido(rascunho.vinculo);
  const problema = validar(rascunho, custoMensal, beneficios, percentual);
  const salvando = criar.isPending || atualizar.isPending;

  function salvar() {
    if (problema !== null) {
      toast.error(problema);
      return;
    }
    const dados: PessoaParaGravar = {
      profileId: rascunho.perfilId === SEM_PERFIL ? null : rascunho.perfilId,
      pessoa: rascunho.pessoa.trim(),
      cargo: rascunho.cargo.trim() === "" ? null : rascunho.cargo.trim(),
      vinculo: rascunho.vinculo,
      bu: rascunho.bu,
      custoMensal: custoMensal ?? 0,
      beneficios: beneficios ?? 0,
      percentualSugerido: percentual,
      inicio: rascunho.inicio,
      fim: rascunho.fim === "" ? null : rascunho.fim,
    };

    const acao =
      pessoa === null ? criar.mutateAsync(dados) : atualizar.mutateAsync({ id: pessoa.id, dados });
    void acao.then(onFechar).catch(() => {});
  }

  return (
    <Dialog open={aberto} onOpenChange={(v) => !v && onFechar()}>
      <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{pessoa === null ? "Nova pessoa na folha" : "Editar folha"}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <Label htmlFor="pessoa">Nome</Label>
              <Input
                id="pessoa"
                value={rascunho.pessoa}
                onChange={(e) => editar("pessoa", e.target.value)}
              />
            </div>

            <div>
              <Label htmlFor="cargo">Cargo</Label>
              <Input
                id="cargo"
                value={rascunho.cargo}
                onChange={(e) => editar("cargo", e.target.value)}
              />
            </div>

            <div>
              <Label htmlFor="vinculo">Vínculo</Label>
              <Select
                value={rascunho.vinculo}
                onValueChange={(v) => editar("vinculo", v as VinculoDeTrabalho)}
              >
                <SelectTrigger id="vinculo">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(ROTULO_DO_VINCULO).map(([chave, rotulo]) => (
                    <SelectItem key={chave} value={chave}>
                      {rotulo}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="custo">Custo mensal</Label>
              <Input
                id="custo"
                inputMode="decimal"
                value={rascunho.custoMensal}
                onChange={(e) => editar("custoMensal", e.target.value)}
                placeholder="4.500,00"
              />
              {rascunho.custoMensal.trim() !== "" && custoMensal === null && (
                <p className="mt-1 text-[11px] text-destructive">
                  Valor não reconhecido. Use vírgula ou ponto para os centavos.
                </p>
              )}
            </div>

            <div>
              <Label htmlFor="beneficios">Benefícios</Label>
              <Input
                id="beneficios"
                inputMode="decimal"
                value={rascunho.beneficios}
                onChange={(e) => editar("beneficios", e.target.value)}
                placeholder="0,00"
              />
              {rascunho.beneficios.trim() !== "" && beneficios === null && (
                <p className="mt-1 text-[11px] text-destructive">Valor não reconhecido.</p>
              )}
            </div>

            <div>
              <Label htmlFor="bu-pessoa">Linha de negócio</Label>
              <Select
                value={rascunho.bu}
                onValueChange={(v) => editar("bu", v as UnidadeDeNegocio)}
              >
                <SelectTrigger id="bu-pessoa">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(ROTULO_DA_BU).map(([chave, rotulo]) => (
                    <SelectItem key={chave} value={chave}>
                      {rotulo}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="mt-1 text-[11px] text-muted-foreground">
                <strong>Compartilhado</strong> é para quem serve às duas frentes sem divisão
                apurável (administrativo, financeiro). Quem tem divisão conhecida entra como duas
                pessoas.
              </p>
            </div>

            <div>
              <Label htmlFor="perfil">Conta no sistema</Label>
              <Select value={rascunho.perfilId} onValueChange={(v) => editar("perfilId", v)}>
                <SelectTrigger id="perfil">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={SEM_PERFIL}>Sem conta vinculada</SelectItem>
                  {perfis.data === undefined && rascunho.perfilId !== SEM_PERFIL && (
                    <SelectItem value={rascunho.perfilId} disabled>
                      {estadoDosPerfis === "erro"
                        ? "Conta vinculada (não foi possível ler o nome)"
                        : "Carregando contas…"}
                    </SelectItem>
                  )}
                  {(perfis.data ?? []).map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.ativo ? p.nome : `${p.nome} (desativada)`}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="mt-1 text-[11px] text-muted-foreground">
                Vincular a conta é o que faz a participação em contratos aparecer no custo desta
                pessoa. Sem isso, o casamento é por nome, e nomes se repetem.
              </p>
              {perfis.isError && (
                <p className="mt-1 text-[11px] text-destructive">
                  Não foi possível ler as contas. A lista acima pode estar incompleta. Não é que não
                  existam.
                </p>
              )}
            </div>

            <div>
              <Label htmlFor="inicio-pessoa">Início</Label>
              <Input
                id="inicio-pessoa"
                type="date"
                value={rascunho.inicio}
                onChange={(e) => editar("inicio", e.target.value)}
              />
            </div>

            <div>
              <Label htmlFor="fim-pessoa">Saída (opcional)</Label>
              <Input
                id="fim-pessoa"
                type="date"
                value={rascunho.fim}
                onChange={(e) => editar("fim", e.target.value)}
              />
            </div>

            {rascunho.vinculo === "comissionado" && (
              <div className="sm:col-span-2">
                <Label htmlFor="pct">Percentual sugerido (%)</Label>
                <Input
                  id="pct"
                  inputMode="decimal"
                  value={rascunho.percentualSugerido}
                  onChange={(e) => editar("percentualSugerido", e.target.value)}
                  placeholder="10"
                />
              </div>
            )}
          </div>

          {aviso !== null && (
            <p className="rounded-lg border border-warning/40 bg-warning/5 px-3 py-2 text-[11px] text-warning">
              🔴 {aviso}
            </p>
          )}

          {custoFixo !== null && (
            <div className="rounded-lg border bg-muted/30 px-3 py-2.5 text-xs">
              <p>
                Custo fixo desta pessoa: <strong className="tabular-nums">{brl(custoFixo)}</strong>{" "}
                por mês
                {beneficios !== null && beneficios > 0 && (
                  <>
                    {" "}
                    ({brl(custoMensal ?? 0)} de custo e {brl(beneficios)} de benefícios)
                  </>
                )}
                .
              </p>
              <p className="mt-0.5 text-muted-foreground">
                A participação em contratos, se houver, entra <strong>por fora</strong> e aparece
                separada na lista.
              </p>
            </div>
          )}

          {contaNesteMes === false && (
            <p className="rounded-lg border border-warning/40 bg-warning/5 px-3 py-2 text-[11px] text-warning">
              Com estas datas, a pessoa <strong>não conta no mês corrente</strong>
              {rascunho.fim !== "" && mesEAno(rascunho.fim) !== null
                ? `: a saída foi em ${mesEAno(rascunho.fim)}.`
                : ": ela começa no futuro."}{" "}
              O cadastro fica, e o custo entra no mês certo.
            </p>
          )}

          {problema !== null && <p className="text-[11px] text-destructive">{problema}</p>}

          <div className="flex justify-end gap-2">
            <Button type="button" variant="ghost" onClick={onFechar} disabled={salvando}>
              Cancelar
            </Button>
            <Button type="button" onClick={salvar} disabled={salvando || problema !== null}>
              {salvando ? "Salvando…" : "Salvar"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function validar(
  rascunho: Rascunho,
  custoMensal: number | null,
  beneficios: number | null,
  percentual: number | null,
): string | null {
  if (rascunho.pessoa.trim() === "") return "O nome é obrigatório.";
  if (rascunho.inicio === "") return "A data de início é obrigatória.";
  if (
    !ehDataCivilPlausivel(rascunho.inicio) ||
    (rascunho.fim !== "" && !ehDataCivilPlausivel(rascunho.fim))
  ) {
    return "Data inválida. Use um ano entre 2000 e 2100.";
  }
  if (custoMensal === null) {
    return "Informe o custo mensal. Campo vazio não é zero: se é mesmo R$ 0,00, digite 0.";
  }
  if (beneficios === null) return "Benefícios: valor não reconhecido.";
  if (rascunho.fim !== "" && rascunho.fim < rascunho.inicio) {
    return "A saída não pode ser anterior ao início.";
  }
  if (
    rascunho.vinculo === "comissionado" &&
    rascunho.percentualSugerido.trim() !== "" &&
    percentual === null
  ) {
    return "Percentual sugerido precisa ser um número entre 0 e 100.";
  }
  return null;
}
