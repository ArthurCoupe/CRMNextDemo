import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { Toaster } from "@/components/ui/sonner";

describe("Toaster na impressão", () => {
  it("a section do sonner existe e fica dentro de um elemento print:hidden", () => {
    const { container } = render(<Toaster />);

    const secao = container.querySelector("section[aria-live]");
    expect(secao).not.toBeNull();
    expect(secao?.parentElement).toHaveClass("print:hidden");
  });
});
