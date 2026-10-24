import { useMemo, useState } from "react";
import { Info, Plus, Search } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
import { PageHeader } from "@/components/layout/page-header";
import { useAuth } from "@/hooks/use-auth";
import { useProfile } from "@/hooks/use-profile";
import { somarMrr } from "@/modules/contracts/domain/mrr";
import { ContractForm } from "@/modules/contracts/ui/contract-form";
import { brl, plural } from "@/shared/lib/format";
import { EmptyState } from "@/shared/ui/empty-state";
import { estadoDaConsulta } from "@/shared/ui/estado-da-consulta";
import { FalhaAoLer } from "@/shared/ui/falha-ao-ler";

import type { ClienteListado, FiltrosDeClientes } from "../api/clients.repository";
import {
  filtroDeBUDisponivel,
  podeLerContratosDoCliente,
  type ContextoDeAcesso,
} from "../domain/access";
import {
  avaliarSaude,
  clientStatusLabel,
  montarEntradaDeSaude,
  saudeEhParcial,
  type StatusDeCliente,
} from "../domain/health";
import { useClients, useGanhasSemContrato, useResponsaveisPossiveis } from "../hooks/use-clients";
import { ClientDrawer } from "./client-drawer";
import { ResumoDeSaude } from "./client-health";
import { FormularioDeCliente } from "./formulario-de-cliente";

const COR_DO_STATUS: Record<StatusDeCliente, string> = {
  active: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30",
  onboarding: "bg-sky-500/15 text-sky-400 border-sky-500/30",
  paused: "bg-amber-500/15 text-amber-500 border-amber-500/30",
  churned: "bg-muted text-muted-foreground",
};

export function ClientsPage() {
  const { papel } = useProfile();
  const { user } = useAuth();

  const contexto: ContextoDeAcesso = useMemo(
    () => ({ papel, usuarioId: user?.id ?? null }),
    [papel, user?.id],
  );

  const mostraColunaDeValor = papel === "owner" || papel === "manager";
  const filtroDeBU = filtroDeBUDisponivel(contexto);

  const [busca, setBusca] = useState("");
  const [status, setStatus] = useState<string>("todos");
  const [linhaDeNegocio, setLinhaDeNegocio] = useState<string>("todas");
  const [responsavelId, setResponsavelId] = useState<string>("todos");
  const [pagina, setPagina] = useState(1);
  const [selecionadoId, setSelecionadoId] = useState<string | null>(null);
  const [formAberto, setFormAberto] = useState(false);
  const ganhasSemContrato = useGanhasSemContrato(papel === "owner");
  const pendentes = ganhasSemContrato.data ?? [];
  const [contratoPara, setContratoPara] = useState<{
    readonly clienteId: string | null;
    readonly vendaId: string | null;
  } | null>(null);

  const filtros: FiltrosDeClientes = {
    busca,
    status: status as FiltrosDeClientes["status"],
    linhaDeNegocio: filtroDeBU.disponivel
      ? (linhaDeNegocio as FiltrosDeClientes["linhaDeNegocio"])
      : "todas",
    responsavelId,
    pagina,
  };
  const consulta = useClients(filtros);
  const { data, isPlaceholderData } = consulta;

  const estado = estadoDaConsulta(consulta);

  const clientes = useMemo(() => data?.clientes ?? [], [data]);
  const selecionado = useMemo(
    () => clientes.find((cliente) => cliente.id === selecionadoId) ?? null,
    [clientes, selecionadoId],
  );

  const consultaDeResponsaveis = useResponsaveisPossiveis(null);
  const responsaveis = consultaDeResponsaveis.data ?? [];

  const listaDeResponsaveisFalhou = estadoDaConsulta(consultaDeResponsaveis) === "erro";

  function aoFiltrar(aplicar: () => void) {
    aplicar();
    setPagina(1);
  }

  const avisoDeBU =
    filtroDeBU.precisaDeAviso && linhaDeNegocio !== "todas" ? filtroDeBU.motivo : null;
  const filtroDeBUIndisponivel = !filtroDeBU.disponivel ? filtroDeBU.motivo : null;

  return (
    <>
      <PageHeader
        title="Clientes"
        description="Cliente é entidade própria: contrato, saúde e histórico penduram aqui"
        actions={
          estado === "erro" || papel !== "owner" ? undefined : (
            <Button size="sm" onClick={() => setFormAberto(true)}>
              <Plus className="mr-1 h-4 w-4" />
              Novo cliente
            </Button>
          )
        }
      />

      {papel === "owner" && estadoDaConsulta(ganhasSemContrato) === "erro" && (
        <p role="status" className="mb-3 text-xs text-destructive">
          Não foi possível ler as ganhas esperando contrato.
        </p>
      )}

      {papel === "owner" && pendentes.length > 0 && (
        <div
          role="status"
          className="mb-3 flex flex-wrap items-center gap-2 rounded-md border border-amber-500/40 bg-amber-500/5 px-3 py-2 text-xs text-amber-500"
        >
          <span>{plural(pendentes.length, "ganha esperando", "ganhas esperando")} contrato.</span>
          <Button
            size="sm"
            variant="outline"
            className="ml-auto"
            onClick={() => setContratoPara({ clienteId: null, vendaId: pendentes[0]?.id ?? null })}
          >
            Cadastrar contrato
          </Button>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <div className="relative">
          <Search
            className="pointer-events-none absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground"
            aria-hidden
          />
          <Input
            value={busca}
            onChange={(evento) => aoFiltrar(() => setBusca(evento.target.value))}
            placeholder="Buscar por cliente ou contato"
            className="h-8 w-[240px] pl-7 text-xs"
          />
        </div>

        <Select value={status} onValueChange={(v) => aoFiltrar(() => setStatus(v))}>
          <SelectTrigger className="h-8 w-[150px] text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Status (todos)</SelectItem>
            <SelectItem value="onboarding">Onboarding</SelectItem>
            <SelectItem value="active">Ativo</SelectItem>
            <SelectItem value="paused">Pausado</SelectItem>
            <SelectItem value="churned">Encerrado</SelectItem>
          </SelectContent>
        </Select>

        {filtroDeBUIndisponivel !== null && (
          <span
            className="inline-flex items-center gap-1 text-[11px] text-muted-foreground"
            title={filtroDeBUIndisponivel}
          >
            <Info className="h-3.5 w-3.5" aria-hidden />
            Sem filtro de BU
          </span>
        )}

        {filtroDeBU.disponivel && (
          <Select
            value={linhaDeNegocio}
            onValueChange={(v) => aoFiltrar(() => setLinhaDeNegocio(v))}
          >
            <SelectTrigger className="h-8 w-[150px] text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todas">BU (todas)</SelectItem>
              <SelectItem value="demanda">Demanda</SelectItem>
              <SelectItem value="sistemas">Sistemas</SelectItem>
            </SelectContent>
          </Select>
        )}

        <Select value={responsavelId} onValueChange={(v) => aoFiltrar(() => setResponsavelId(v))}>
          <SelectTrigger className="h-8 w-[190px] text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Responsável (todos)</SelectItem>
            <SelectItem value="sem-responsavel">⚠ Sem responsável</SelectItem>
            {responsaveis.map((responsavel) => (
              <SelectItem key={responsavel.id} value={responsavel.id}>
                {responsavel.nome}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {listaDeResponsaveisFalhou && (
          <span
            className="inline-flex items-center gap-1 text-[11px] text-destructive"
            title="Não foi possível ler a lista de nomes. Um seletor vazio aqui não significa que não existam responsáveis cadastrados."
          >
            <Info className="h-3.5 w-3.5" aria-hidden />
            Lista de responsáveis indisponível
          </span>
        )}
      </div>

      {avisoDeBU !== null && (
        <p className="flex items-start gap-1.5 rounded-md border border-amber-500/40 bg-amber-500/10 px-2.5 py-1.5 text-[11px] text-amber-500">
          <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
          {avisoDeBU}
        </p>
      )}

      {estado === "erro" ? (
        <FalhaAoLer oQue="a lista de clientes" />
      ) : estado === "carregando" ? (
        <p className="text-sm text-muted-foreground">Carregando clientes…</p>
      ) : clientes.length === 0 ? (
        <EmptyState
          title="Nenhum cliente encontrado"
          description={
            papel === "owner"
              ? "Cliente nasce do fechamento de uma oportunidade (F10), da migração da base antiga, ou de um cadastro manual pelo botão acima."
              : "Cliente nasce do fechamento de uma oportunidade (F10) ou da migração da base antiga."
          }
        />
      ) : (
        <>
          <div className={isPlaceholderData ? "opacity-60 transition-opacity" : undefined}>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Cliente</TableHead>
                  <TableHead>Responsável</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Contratos</TableHead>
                  {mostraColunaDeValor && <TableHead className="text-right">Valor</TableHead>}
                  <TableHead>Saúde</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {clientes.map((cliente) => (
                  <LinhaDeCliente
                    key={cliente.id}
                    cliente={cliente}
                    contexto={contexto}
                    mostraColunaDeValor={mostraColunaDeValor}
                    aoAbrir={() => setSelecionadoId(cliente.id)}
                  />
                ))}
              </TableBody>
            </Table>
          </div>

          <div className="flex items-center justify-between gap-3 text-xs text-muted-foreground">
            <span>
              {data!.total} cliente{data!.total === 1 ? "" : "s"} · página {data!.pagina} de{" "}
              {data!.totalDePaginas}
            </span>
            <div className="flex gap-2">
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="h-7 text-xs"
                disabled={pagina <= 1}
                onClick={() => setPagina((p) => Math.max(1, p - 1))}
              >
                Anterior
              </Button>
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="h-7 text-xs"
                disabled={pagina >= data!.totalDePaginas}
                onClick={() => setPagina((p) => p + 1)}
              >
                Próxima
              </Button>
            </div>
          </div>
        </>
      )}

      <ClientDrawer
        cliente={selecionado}
        contexto={contexto}
        aoFechar={() => setSelecionadoId(null)}
      />

      <FormularioDeCliente
        aberto={formAberto}
        aoFechar={() => setFormAberto(false)}
        aoCriar={(clienteId, ganhaId) => {
          if (ganhaId !== null) setContratoPara({ clienteId, vendaId: ganhaId });
        }}
      />

      <ContractForm
        aberto={contratoPara !== null}
        aoFechar={() => setContratoPara(null)}
        preEscolha={contratoPara}
      />
    </>
  );
}

function LinhaDeCliente({
  cliente,
  contexto,
  mostraColunaDeValor,
  aoAbrir,
}: {
  cliente: ClienteListado;
  contexto: ContextoDeAcesso;
  mostraColunaDeValor: boolean;
  aoAbrir: () => void;
}) {
  const contaContratos = podeLerContratosDoCliente(contexto, cliente.responsavelId);

  const entrada = montarEntradaDeSaude({
    status: cliente.status,
    ultimoEventoEm: cliente.ultimoEventoEm,
    proximoFimDeCobranca: cliente.proximoFimDeCobranca,
    assinadoEm: cliente.assinadoEm,
    criadoEm: cliente.criadoEm,
    pausadoEm: cliente.pausadoEm,
    responsavelId: cliente.responsavelId,
    cobrancaVisivel: contaContratos,
    contratosAtivosVisiveis: cliente.contratosAtivosVisiveis,
  });
  const sinais = avaliarSaude(entrada);

  const mrrVisivel = somarMrr(cliente.contratos);

  return (
    <TableRow className="cursor-pointer" onClick={aoAbrir}>
      <TableCell>
        <div className="font-medium">{cliente.nome}</div>
        {cliente.segmento !== null && (
          <div className="text-[11px] text-muted-foreground">{cliente.segmento}</div>
        )}
      </TableCell>
      <TableCell className="text-xs">
        {cliente.responsavelNome ?? (
          <span
            className="text-destructive"
            title="Sem responsável, o contrato deste cliente não aparece para o gestor."
          >
            ⚠ sem responsável
          </span>
        )}
      </TableCell>
      <TableCell>
        <Badge className={COR_DO_STATUS[cliente.status]}>{clientStatusLabel(cliente.status)}</Badge>
      </TableCell>
      <TableCell className="text-right text-xs tabular-nums">
        {contaContratos ? (
          cliente.contratosAtivosVisiveis
        ) : (
          <span
            className="text-muted-foreground"
            title="Você não tem permissão para contar os contratos deste cliente. Vazio não é zero."
          >
            -
          </span>
        )}
      </TableCell>
      {mostraColunaDeValor && (
        <TableCell className="text-right text-xs font-medium tabular-nums">
          {contaContratos && mrrVisivel > 0 ? (
            <>
              {brl(mrrVisivel)}
              <span className="text-[10px] text-muted-foreground">/mês</span>
            </>
          ) : (
            <span className="text-muted-foreground">-</span>
          )}
        </TableCell>
      )}
      <TableCell>
        <ResumoDeSaude sinais={sinais} parcial={saudeEhParcial(entrada)} />
      </TableCell>
    </TableRow>
  );
}
