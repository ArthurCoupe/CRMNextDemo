import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { RespostaMarkdown } from "./resposta-markdown";

describe("RespostaMarkdown", () => {
  it("título vira texto sem os `#`", () => {
    render(<RespostaMarkdown texto="### 05. R2 (Proposta e Fechamento)" />);

    expect(screen.getByText("05. R2 (Proposta e Fechamento)")).toBeInTheDocument();
    expect(screen.queryByText(/###/)).not.toBeInTheDocument();
  });

  it("negrito vira <strong> e perde os asteriscos", () => {
    const { container } = render(<RespostaMarkdown texto="**O que é:** contrato assinado" />);

    const forte = container.querySelector("strong");
    expect(forte?.textContent).toBe("O que é:");
    expect(container.textContent).toBe("O que é: contrato assinado");
    expect(container.textContent).not.toContain("*");
  });

  it("itens consecutivos viram UMA lista, não uma por item", () => {
    const { container } = render(<RespostaMarkdown texto={"* Preço\n* Concorrente\n* Timing"} />);

    expect(container.querySelectorAll("ul")).toHaveLength(1);
    expect(container.querySelectorAll("li")).toHaveLength(3);
  });

  it("duas listas separadas por um parágrafo continuam separadas", () => {
    const { container } = render(
      <RespostaMarkdown texto={"* um\n* dois\n\ntexto no meio\n\n* tres"} />,
    );

    expect(container.querySelectorAll("ul")).toHaveLength(2);
  });

  it("`---` vira separador", () => {
    const { container } = render(<RespostaMarkdown texto={"antes\n\n---\n\ndepois"} />);

    expect(container.querySelectorAll("hr")).toHaveLength(1);
  });

  it("código inline vira <code>", () => {
    const { container } = render(<RespostaMarkdown texto="a coluna `billing_months` manda" />);

    expect(container.querySelector("code")?.textContent).toBe("billing_months");
  });

  it("marcação dentro de item de lista também é aplicada", () => {
    const { container } = render(<RespostaMarkdown texto="* **Métrica:** entra no win rate" />);

    expect(container.querySelector("li strong")?.textContent).toBe("Métrica:");
  });

  it("preserva as quebras entre parágrafos, sem colar as linhas", () => {
    const { container } = render(<RespostaMarkdown texto={"primeira linha\nsegunda linha"} />);

    expect(container.querySelectorAll("p")).toHaveLength(2);
  });

  it("🔴 NÃO produz HTML a partir do texto — a resposta passa pelo modelo", () => {
    const { container } = render(
      <RespostaMarkdown texto={'<script>alert("x")</script> **fim**'} />,
    );

    expect(container.querySelector("script")).toBeNull();
    expect(container.textContent).toContain('<script>alert("x")</script>');
    expect(container.querySelector("strong")?.textContent).toBe("fim");
  });

  it("marcação malformada cai como texto literal, sem quebrar o render", () => {
    const { container } = render(<RespostaMarkdown texto="um ** asterisco solto e `crase" />);

    expect(container.textContent).toBe("um ** asterisco solto e `crase");
  });

  it("a resposta real do assistente rende sem sobrar marcação", () => {
    const real = [
      "### 03. Qualificação",
      "* **O que é:** Aplicação do BANT, com pontuação de 0 a 2 em cada critério.",
      "* **Regra de Morte:** Verba = 0 **OU** Autoridade = 0 acarreta descarte imediato.",
      "",
      "---",
      "",
      "### 07. Perdido",
      "* **Métrica:** **ENTRA** no cálculo da taxa de conversão.",
    ].join("\n");

    const { container } = render(<RespostaMarkdown texto={real} />);

    expect(container.textContent).not.toContain("###");
    expect(container.textContent).not.toContain("**");
    expect(container.querySelectorAll("ul")).toHaveLength(2);
    expect(container.querySelectorAll("hr")).toHaveLength(1);
    expect(screen.getByText("03. Qualificação")).toBeInTheDocument();
  });

  it("🔴 travessão e meia-risca do modelo não chegam à tela (§4.5)", () => {
    const travessao = String.fromCharCode(0x2014);
    const meiaRisca = String.fromCharCode(0x2013);
    const { container } = render(
      <RespostaMarkdown texto={`Agende de 4${meiaRisca}5 dias ${travessao} e confirme.`} />,
    );

    expect(container.textContent).toBe("Agende de 4 a 5 dias, e confirme.");
  });

  it("texto sem traço rende igual, o hífen fica", () => {
    const { container } = render(<RespostaMarkdown texto="Nota 6-8 agenda na hora." />);

    expect(container.textContent).toBe("Nota 6-8 agenda na hora.");
  });
});
