import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

function Ping() {
  return <p>pong</p>;
}

describe("ferramental de teste", () => {
  it("executa TypeScript", () => {
    expect(1 + 1).toBe(2);
  });

  it("renderiza JSX no ambiente jsdom com os matchers do jest-dom", () => {
    render(<Ping />);

    expect(screen.getByText("pong")).toBeInTheDocument();
  });
});
