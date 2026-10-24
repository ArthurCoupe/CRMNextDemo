import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function CampoEditavel({
  id,
  rotulo,
  valor,
  disabled,
  onGravar,
  placeholder,
  maxLength,
  type,
}: {
  id: string;
  rotulo: string;
  valor: string | null;
  disabled: boolean;
  onGravar: (valorDoInput: string) => void;
  placeholder?: string;
  maxLength?: number;
  type?: "text" | "date";
}) {
  return (
    <div className="grid gap-1">
      <Label htmlFor={id} className="text-[11px] text-muted-foreground">
        {rotulo}
      </Label>
      <Input
        key={valor ?? ""}
        id={id}
        type={type ?? "text"}
        defaultValue={valor ?? ""}
        disabled={disabled}
        placeholder={placeholder}
        maxLength={maxLength}
        className="h-8 text-xs"
        onBlur={(evento) => {
          if (evento.target.value === (valor ?? "")) return;
          onGravar(evento.target.value);
        }}
      />
    </div>
  );
}
