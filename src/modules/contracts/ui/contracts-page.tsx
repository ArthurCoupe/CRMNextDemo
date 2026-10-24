import { useMemo, useState } from "react";
import { FileText, Pencil, Plus } from "lucide-react";

import { PageHeader } from "@/components/layout/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useProfile } from "@/hooks/use-profile";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { EmptyState } from "@/shared/ui/empty-state";
import { estadoDaConsulta } from "@/shared/ui/estado-da-consulta";
import { FalhaAoLer } from "@/shared/ui/falha-ao-ler";
import { Money } from "@/shared/ui/money";

import type { ContratoListado } from "../api/contracts.repository";
import {
  contractStatusLabel,
  frenteLabel,
  linhaDeNegocioLabel,
  type LinhaDeNegocio,
  type StatusDeContrato,
  type TipoDeContrato,
} from "../domain/contract";
import { useContracts } from "../hooks/use-contracts";
import { ContractForm } from "./contract-form";

type FiltroBu = LinhaDeNegocio | "todas";
type FiltroTipo = TipoDeContrato | "todos";
type FiltroStatus = StatusDeContrato | "todos";

const DESCRICAO_DA_TELA = "Mensalidades e projetos, decompostos por frente";

const COR_DO_STATUS: Record<StatusDeContrato, string> = {
  active: "bg-emerald-500/15 text-emerald-400",
  paused: "bg-amber-500/15 text-amber-400",
  cancelled: "bg-red-500/15 text-red-400",
  finished: "bg-slate-500/15 text-slate-400",
};

export function ContractsPage({
  clienteId = null,
  aoVerTodos,
}: {
  readonly clienteId?: string | null;
  readonly aoVerTodos?: () => void;
} = {}) {
  const { papel } = useProfile();
  const ofereceEscrita = papel === null || papel === "owner";
  const consulta = useContracts();
  const estado = estadoDaConsulta(consulta);
  const contratos = useMemo(() => consulta.data?.contratos ?? [], [consulta.data]);
  const truncada = consulta.data?.truncada === true;

  const [filtroBu, setFiltroBu] = useState<FiltroBu>("todas");
  const [filtroTipo, setFiltroTipo] = useState<FiltroTipo>("todos");
  const [filtroStatus, setFiltroStatus] = useState<FiltroStatus>("todos");

  const [formAberto, setFormAberto] = useState(false);
  const [emEdicao, setEmEdicao] = useState<ContratoListado | null>(null);

  const filtrados = useMemo(
    () =>
      contratos.filter(
        (c) =>
          (clienteId === null || c.clienteId === clienteId) &&
          (filtroBu === "todas" || c.linhaDeNegocio === filtroBu) &&
          (filtroTipo === "todos" || c.tipo === filtroTipo) &&
          (filtroStatus === "todos" || c.status === filtroStatus),
      ),
    [contratos, clienteId, filtroBu, filtroTipo, filtroStatus],
  );

  function abrirNovo() {
    setEmEdicao(null);
    setFormAberto(true);
  }

  function abrirEdicao(contrato: ContratoListado) {
    setEmEdicao(contrato);
    setFormAberto(true);
  }

  return (
    <>
      <PageHeader
        title="Contratos"
        description={DESCRICAO_DA_TELA}
        actions={
          estado === "erro" || !ofereceEscrita ? undefined : (
            <Button size="sm" onClick={abrirNovo}>
              <Plus className="mr-1 h-4 w-4" />
              Novo contrato
            </Button>
          )
        }
      />

      {!ofereceEscrita && (
        <p className="rounded-md border border-dashed px-3 py-2 text-xs text-muted-foreground">
          Você lê os contratos dos clientes da sua carteira, mas criar e editar contrato é do{" "}
          <strong>owner</strong>. O banco recusa a gravação de outros papéis. Peça a alteração em
          vez de preencher o formulário.
        </p>
      )}

      {clienteId !== null && estado !== "erro" && (
        <p className="flex flex-wrap items-center gap-2 rounded-md border px-3 py-2 text-xs">
          {`Mostrando só os contratos de ${
            contratos.find((c) => c.clienteId === clienteId)?.nomeDoCliente ?? "um cliente"
          }.`}
          {aoVerTodos !== undefined && (
            <Button
              type="button"
              size="sm"
              variant="link"
              className="h-auto p-0 text-xs"
              onClick={aoVerTodos}
            >
              Ver todos
            </Button>
          )}
        </p>
      )}

      <div className="flex flex-wrap gap-2">
        <Select value={filtroBu} onValueChange={(v) => setFiltroBu(v as FiltroBu)}>
          <SelectTrigger className="w-36">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todas">Todas as BUs</SelectItem>
            <SelectItem value="demanda">Demanda</SelectItem>
            <SelectItem value="sistemas">Sistemas</SelectItem>
          </SelectContent>
        </Select>

        <Select value={filtroTipo} onValueChange={(v) => setFiltroTipo(v as FiltroTipo)}>
          <SelectTrigger className="w-40">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos os tipos</SelectItem>
            <SelectItem value="mrr">Mensalidade (MRR)</SelectItem>
            <SelectItem value="tcv">Projeto (TCV)</SelectItem>
          </SelectContent>
        </Select>

        <Select value={filtroStatus} onValueChange={(v) => setFiltroStatus(v as FiltroStatus)}>
          <SelectTrigger className="w-36">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todo status</SelectItem>
            <SelectItem value="active">Ativo</SelectItem>
            <SelectItem value="paused">Pausado</SelectItem>
            <SelectItem value="cancelled">Cancelado</SelectItem>
            <SelectItem value="finished">Encerrado</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {estado !== "erro" && truncada && (
        <p className="rounded-md border border-amber-500/40 bg-amber-500/5 px-3 py-2 text-xs text-amber-500">
          A lista atingiu o teto de leitura. Os contratos mais antigos não estão sendo exibidos, e
          os filtros acima só enxergam o que veio. Nenhum contrato foi apagado.
        </p>
      )}

      {estado === "erro" ? (
        <FalhaAoLer oQue="a lista de contratos" />
      ) : estado === "carregando" ? (
        <div className="grid gap-2">
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-12 animate-pulse rounded-lg bg-muted/40" />
          ))}
        </div>
      ) : filtrados.length === 0 ? (
        <EmptyState
          icon={FileText}
          title={contratos.length === 0 ? "Nenhum contrato" : "Nenhum contrato nesses filtros"}
          description={
            contratos.length !== 0
              ? "Ajuste os filtros acima para ver os demais."
              : ofereceEscrita
                ? "Crie o primeiro em Novo contrato."
                : "Nenhum contrato dos clientes da sua carteira."
          }
          action={
            contratos.length === 0 && ofereceEscrita ? (
              <Button size="sm" onClick={abrirNovo}>
                <Plus className="mr-1 h-4 w-4" />
                Novo contrato
              </Button>
            ) : undefined
          }
        />
      ) : (
        <div className="overflow-x-auto rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Cliente</TableHead>
                <TableHead>Contrato</TableHead>
                <TableHead>BU</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead className="text-right">Mensal</TableHead>
                <TableHead className="text-right">Total (projeto)</TableHead>
                <TableHead>Frentes</TableHead>
                <TableHead>Status</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtrados.map((contrato) => (
                <TableRow key={contrato.id}>
                  <TableCell className="font-medium">{contrato.nomeDoCliente}</TableCell>
                  <TableCell>
                    <span className="block max-w-56 truncate">{contrato.nome}</span>
                    {!contrato.firme && (
                      <span className="text-[11px] text-muted-foreground">não firme</span>
                    )}
                  </TableCell>
                  <TableCell>{linhaDeNegocioLabel(contrato.linhaDeNegocio)}</TableCell>
                  <TableCell className="uppercase text-xs">{contrato.tipo}</TableCell>
                  <TableCell className="text-right">
                    {contrato.tipo === "mrr" ? <Money value={contrato.valorMensal} /> : "-"}
                  </TableCell>
                  <TableCell className="text-right">
                    {contrato.tipo === "tcv" ? (
                      <span>
                        <Money value={contrato.valorTotal} />
                        {contrato.mesesDeCobranca !== null && (
                          <span className="ml-1 text-[11px] text-muted-foreground">
                            em {contrato.mesesDeCobranca}x
                          </span>
                        )}
                      </span>
                    ) : (
                      "-"
                    )}
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-1">
                      {contrato.itens.map((item) => (
                        <Badge key={item.frente} variant="outline" className="text-[10px]">
                          {frenteLabel(item.frente)}
                        </Badge>
                      ))}
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge className={COR_DO_STATUS[contrato.status]}>
                      {contractStatusLabel(contrato.status)}
                      {!contrato.cobrancaAtiva && contrato.status !== "cancelled" && (
                        <span className="ml-1">· sem cobrança</span>
                      )}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    {ofereceEscrita && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => abrirEdicao(contrato)}
                        aria-label={`Editar ${contrato.nome}`}
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      <ContractForm
        aberto={formAberto}
        aoFechar={() => setFormAberto(false)}
        contrato={emEdicao}
        podeApagar={ofereceEscrita}
      />
    </>
  );
}
