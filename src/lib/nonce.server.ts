import { AsyncLocalStorage } from "node:async_hooks";

const armazem = new AsyncLocalStorage<string>();

export function executarComNonce<T>(nonce: string, fn: () => Promise<T>): Promise<T> {
  return armazem.run(nonce, fn);
}

export function lerNonce(): string | undefined {
  return armazem.getStore();
}
