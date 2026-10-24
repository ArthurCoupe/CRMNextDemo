import { describe, expect, it } from "vitest";

const { Route } = await import("./scripts-closer");

describe("redirect de /scripts-closer", () => {
  it("aponta para /scripts com ?tipo=closer", () => {
    let capturado: unknown;
    try {
      Route.options.beforeLoad!({} as never);
    } catch (redirecionamento) {
      capturado = redirecionamento;
    }

    expect(capturado).toMatchObject({ options: { to: "/scripts", search: { tipo: "closer" } } });
  });
});
