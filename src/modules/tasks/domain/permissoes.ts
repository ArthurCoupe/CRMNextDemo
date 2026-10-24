import type { Tarefa } from "./task";

export const CATEGORIA_DO_ONBOARDING = "Onboarding · método";

export function ehDeOnboarding(tarefa: Pick<Tarefa, "categoria">): boolean {
  return tarefa.categoria === CATEGORIA_DO_ONBOARDING;
}

function ehGestao(papel: string | null): boolean {
  return papel === "owner" || papel === "manager";
}

export function podeTrocarResponsavel(papel: string | null): boolean {
  return ehGestao(papel);
}

export function podeEditar(
  tarefa: Pick<Tarefa, "responsavelId" | "participantes">,
  papel: string | null,
  meuId: string | null,
): boolean {
  if (ehGestao(papel)) return true;
  if (papel !== "member" || meuId === null) return false;
  return tarefa.responsavelId === meuId || tarefa.participantes.some((p) => p.id === meuId);
}

export function podeGerirParticipantes(
  tarefa: Pick<Tarefa, "responsavelId" | "participantes" | "criadoPor" | "categoria">,
  papel: string | null,
  meuId: string | null,
): boolean {
  if (podeEditar(tarefa, papel, meuId)) return true;
  return (
    papel === "member" && meuId !== null && tarefa.criadoPor === meuId && !ehDeOnboarding(tarefa)
  );
}

export const podeArrastar = podeEditar;

export function podeApagar(
  tarefa: Pick<Tarefa, "criadoPor" | "categoria">,
  papel: string | null,
  meuId: string | null,
): boolean {
  if (ehGestao(papel)) return true;
  return (
    papel === "member" && meuId !== null && tarefa.criadoPor === meuId && !ehDeOnboarding(tarefa)
  );
}
