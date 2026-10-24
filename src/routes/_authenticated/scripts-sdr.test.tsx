import { describe, expect, it } from "vitest";

const { Route } = await import("./scripts-sdr");

describe("redirect de /scripts-sdr", () => {
  it("aponta para /scripts com ?tipo=sdr", () => {
    let capturado: unknown;
    try {
      Route.options.beforeLoad!({} as never);
    } catch (redirecionamento) {
      capturado = redirecionamento;
    }

    expect(capturado).toMatchObject({ options: { to: "/scripts", search: { tipo: "sdr" } } });
  });
});
