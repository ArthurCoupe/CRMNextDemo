import { describe, expect, it, vi } from "vitest";

vi.mock("@/modules/playbook/ui/playbook-page", () => ({ PlaybookPage: () => null }));
vi.mock("@/integrations/supabase/papel", () => ({ exigirPapel: vi.fn() }));

const { Route } = await import("./playbook");
const { exigirPapel } = await import("@/integrations/supabase/papel");

describe("guarda de /playbook", () => {
  it("beforeLoad chama exigirPapel excluindo client", async () => {
    await Route.options.beforeLoad!({ context: { papel: "client" } } as never);
    expect(exigirPapel).toHaveBeenCalledWith(["owner", "manager", "member"], "client");
    expect(exigirPapel).toHaveBeenCalledWith(expect.not.arrayContaining(["client"]), "client");
  });
});
