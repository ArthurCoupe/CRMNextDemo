import { AVISO_DA_DEMO } from "@/shared/lib/demo";

export function FaixaDaDemo() {
  return (
    <p
      role="note"
      className="border-b border-l-[3px] border-border border-l-ouro bg-muted px-4 py-1.5 text-center text-xs font-medium text-muted-foreground print:hidden"
    >
      {AVISO_DA_DEMO}
    </p>
  );
}
