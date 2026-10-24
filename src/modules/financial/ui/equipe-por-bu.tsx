import { Users } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { brl } from "@/shared/lib/format";
import { EmptyState } from "@/shared/ui/empty-state";
import { Money } from "@/shared/ui/money";
import { cn } from "@/lib/utils";

import { ROTULO_DA_BU } from "../domain/expenses";
import {
  agruparPorBu,
  explicacaoDeParticipacaoSemLinha,
  fatiaVariavel,
  pessoaNaFolhaEm,
  ROTULO_DO_VINCULO,
  type CustoDeFolhaPorBu,
  type PessoaNaEquipe,
} from "../domain/payroll";
import type { EstadoDaConsulta } from "@/shared/ui/estado-da-consulta";
import { FalhaAoLer } from "@/shared/ui/falha-ao-ler";

interface EquipePorBuProps {
  readonly equipe: readonly PessoaNaEquipe[];
  readonly custoPorBu: readonly CustoDeFolhaPorBu[];
  readonly estado: EstadoDaConsulta;
  readonly estadoDoCusto: EstadoDaConsulta;
  readonly mesReferencia: string | null;
  readonly onEditar: (id: string) => void;
  readonly podeEditar: boolean;
}

export function EquipePorBu({
  equipe,
  custoPorBu,
  estado,
  estadoDoCusto,
  mesReferencia,
  onEditar,
  podeEditar,
}: EquipePorBuProps) {
  if (estado === "erro") return <FalhaAoLer oQue="a equipe" />;
  if (estado === "carregando")
    return <div className="h-56 animate-pulse rounded-xl border bg-card" />;

  if (equipe.length === 0) {
    return (
      <EmptyState
        icon={Users}
        title="Ninguém na folha ainda"
        description="Cadastrar alguém é cadastrar o custo: o painel de custo muda no mesmo instante."
      />
    );
  }

  const grupos = agruparPorBu(equipe, estadoDoCusto === "pronto" ? custoPorBu : []);

  return (
    <div className="space-y-3">
      {grupos.map((grupo) => (
        <div key={grupo.bu} className="overflow-hidden rounded-xl border bg-card">
          <div className="flex items-baseline justify-between gap-3 border-b bg-muted/20 px-3.5 py-2">
            <div>
              <p className="text-sm font-medium">{ROTULO_DA_BU[grupo.bu]}</p>
              <p className="text-[11px] text-muted-foreground">
                {grupo.pessoasNoCusto === null
                  ? "quantas pessoas contam neste mês: desconhecido"
                  : `${grupo.pessoasNoCusto} ${grupo.pessoasNoCusto === 1 ? "pessoa conta" : "pessoas contam"} neste mês`}
              </p>
            </div>
            <div className="text-right">
              <p className="text-[10px] uppercase tracking-wide text-muted-foreground">
                Folha fixa do mês
              </p>
              <CustoDoGrupo valor={grupo.custoFixo} estado={estadoDoCusto} />
            </div>
          </div>

          {grupo.pessoas.length === 0 ? (
            <p className="px-3.5 py-6 text-center text-xs text-muted-foreground">
              Ninguém nesta linha de negócio.
            </p>
          ) : (
            <ul>
              {grupo.pessoas.map((p) => (
                <li key={p.chave} className="border-b last:border-0">
                  <LinhaDaPessoa
                    pessoa={p}
                    mesReferencia={mesReferencia}
                    podeEditar={podeEditar}
                    onEditar={onEditar}
                  />
                </li>
              ))}
            </ul>
          )}
        </div>
      ))}

      <p className="text-[11px] text-muted-foreground">
        O custo fixo de cada linha vem do Postgres, com a vigência aplicada. Não é a soma das
        pessoas visíveis acima, porque a lista mostra também quem ainda não começou ou já saiu.{" "}
        Somar as contagens acima pode dar mais que o total de pessoas do mês na aba Gastos: lá, quem
        tem perfil vinculado conta uma vez só, mesmo atuando em duas frentes. Sem perfil não há como
        saber que duas linhas são a mesma pessoa, e cada uma conta por si.
      </p>
    </div>
  );
}

function CustoDoGrupo({ valor, estado }: { valor: number | null; estado: EstadoDaConsulta }) {
  if (estado === "erro") {
    return <span className="text-xs font-medium text-destructive">desconhecido</span>;
  }
  if (estado === "carregando") {
    return <span className="text-xs text-muted-foreground">calculando…</span>;
  }
  if (valor === null) return <span className="text-xs text-muted-foreground">desconhecido</span>;
  return <span className="text-sm font-semibold tabular-nums">{brl(valor)}</span>;
}

function LinhaDaPessoa({
  pessoa,
  mesReferencia,
  podeEditar,
  onEditar,
}: {
  pessoa: PessoaNaEquipe;
  mesReferencia: string | null;
  podeEditar: boolean;
  onEditar: (id: string) => void;
}) {
  const fatia = fatiaVariavel(pessoa);
  const naFolha =
    mesReferencia === null || pessoa.inicio === null
      ? null
      : pessoaNaFolhaEm(pessoa.inicio, pessoa.fim, mesReferencia);
  const explicacaoDaOrfa = explicacaoDeParticipacaoSemLinha(pessoa);
  const idDaFolha = pessoa.id;

  return (
    <div className="px-3.5 py-3">
      <div className="flex items-start gap-3">
        <div className="min-w-0 flex-1">
          <p className="flex flex-wrap items-center gap-1.5 text-sm">
            <span
              className={cn(
                !pessoa.ativa && !pessoa.semLinhaDeFolha && "text-muted-foreground line-through",
              )}
            >
              {pessoa.pessoa}
            </span>
            {pessoa.vinculo !== null && (
              <Badge variant="outline" className="h-4 px-1.5 text-[10px] font-normal">
                {ROTULO_DO_VINCULO[pessoa.vinculo]}
              </Badge>
            )}
            {pessoa.semLinhaDeFolha && (
              <Badge variant="outline" className="h-4 px-1.5 text-[10px] font-normal text-warning">
                sem linha de folha nesta frente
              </Badge>
            )}
            {!pessoa.ativa && !pessoa.semLinhaDeFolha && (
              <Badge variant="outline" className="h-4 px-1.5 text-[10px] font-normal">
                fora da folha
              </Badge>
            )}
            {pessoa.ativa && naFolha === false && (
              <Badge variant="outline" className="h-4 px-1.5 text-[10px] font-normal">
                não conta neste mês
              </Badge>
            )}
          </p>
          {pessoa.cargo !== null && pessoa.cargo !== "" && (
            <p className="mt-0.5 text-[11px] text-muted-foreground">{pessoa.cargo}</p>
          )}
        </div>

        <div className="shrink-0 text-right">
          <Money value={pessoa.custoTotal} className="text-sm font-medium" />
          <p className="text-[10px] uppercase tracking-wide text-muted-foreground">por mês</p>
        </div>

        {idDaFolha === null ? (
          <span className="w-[52px] shrink-0" aria-hidden />
        ) : (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-7 shrink-0 px-2 text-xs"
            disabled={!podeEditar}
            onClick={() => onEditar(idDaFolha)}
          >
            Editar
          </Button>
        )}
      </div>

      {explicacaoDaOrfa !== null && (
        <p className="mt-1 text-[11px] text-warning">{explicacaoDaOrfa}</p>
      )}

      <div className="mt-2 flex items-center gap-2">
        <div className="flex h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
          <div
            className="h-full bg-primary/70"
            style={{ width: fatia === null ? "100%" : `${(1 - fatia) * 100}%` }}
          />
          <div
            className="h-full bg-warning/70"
            style={{ width: fatia === null ? "0%" : `${fatia * 100}%` }}
          />
        </div>
        <span className="shrink-0 text-[11px] tabular-nums text-muted-foreground">
          fixo <strong className="text-foreground">{brl(pessoa.custoFixo)}</strong>
          {pessoa.custoVariavel > 0 && (
            <>
              {" · variável "}
              <strong className="text-foreground">{brl(pessoa.custoVariavel)}</strong>
              {` em ${pessoa.contratosComParticipacao} ${pessoa.contratosComParticipacao === 1 ? "contrato" : "contratos"}`}
            </>
          )}
        </span>
      </div>

      {pessoa.custoVariavel > 0 && (
        <p className="mt-1 text-[11px] text-muted-foreground">
          A parte variável vem da participação em contrato, com o percentual congelado na
          assinatura, não do percentual sugerido no cadastro desta pessoa.
        </p>
      )}
    </div>
  );
}
