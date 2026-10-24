import { brl } from "@/shared/lib/format";
import { cn } from "@/lib/utils";

interface MoneyProps {
  value: number | null | undefined;
  className?: string;
}

export function Money({ value, className }: MoneyProps) {
  return <span className={cn("tabular-nums", className)}>{brl(value)}</span>;
}
