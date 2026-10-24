import { useState } from "react";

export function useMudou(valor: unknown): boolean {
  const [anterior, setAnterior] = useState(() => valor);
  if (Object.is(anterior, valor)) return false;
  setAnterior(() => valor);
  return true;
}
