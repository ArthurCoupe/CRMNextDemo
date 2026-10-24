import { renderHook } from "@testing-library/react";
import { useEffect, useState } from "react";
import { describe, expect, it, vi } from "vitest";

import { useMudou } from "./use-mudou";

describe("useMudou", () => {
  it("false no primeiro render e enquanto o valor é o mesmo", () => {
    const objeto = { a: 1 };
    const { result, rerender } = renderHook(({ v }) => useMudou(v), {
      initialProps: { v: objeto },
    });
    expect(result.current).toBe(false);
    rerender({ v: objeto });
    expect(result.current).toBe(false);
  });

  function renderizarAnotando<V>(inicial: V) {
    const vistos: boolean[] = [];
    const { rerender } = renderHook(
      ({ v }) => {
        const mudou = useMudou(v);
        vistos.push(mudou);
        return mudou;
      },
      { initialProps: { v: inicial } },
    );
    return { vistos, rerender };
  }

  it("true só na passada em que o valor troca", () => {
    const { vistos, rerender } = renderizarAnotando<object>({ a: 1 });
    const novo = { a: 1 };
    rerender({ v: novo });
    rerender({ v: novo });
    expect(vistos).toEqual([false, true, false, false]);
  });

  it("valor que é função não vira inicializador nem updater", () => {
    let chamadas = 0;
    const f1 = () => {
      chamadas += 1;
      return "x";
    };
    const f2 = () => {
      chamadas += 1;
      return "y";
    };
    const { vistos, rerender } = renderizarAnotando(f1);
    rerender({ v: f2 });
    rerender({ v: f2 });
    expect(vistos).toEqual([false, true, false, false]);
    expect(chamadas).toBe(0);
  });

  it("🔴 objeto montado no render: o primeiro re-render lança (a docstring proíbe)", () => {
    const silencio = vi.spyOn(console, "error").mockImplementation(() => {});
    const { rerender } = renderHook(({ a }) => useMudou({ a }), { initialProps: { a: 1 } });

    expect(() => rerender({ a: 1 })).toThrow(/Too many re-renders/);
    silencio.mockRestore();
  });

  it("controle: o mesmo conteúdo como primitivo não lança", () => {
    const { result, rerender } = renderHook(({ a }) => useMudou(`a:${a}`), {
      initialProps: { a: 1 },
    });

    rerender({ a: 1 });
    expect(result.current).toBe(false);
  });

  it("rascunho reiniciado pela prop: nenhum commit com o rascunho velho", () => {
    const commits: string[] = [];
    function useRascunho(fonte: string) {
      const [rascunho, setRascunho] = useState(fonte);
      const mudou = useMudou(fonte);
      if (mudou) setRascunho(fonte);
      useEffect(() => {
        commits.push(rascunho);
      });
      return rascunho;
    }
    const { result, rerender } = renderHook(({ fonte }) => useRascunho(fonte), {
      initialProps: { fonte: "a" },
    });
    rerender({ fonte: "b" });
    expect(result.current).toBe("b");
    expect(commits).toEqual(["a", "b"]);
  });
});
