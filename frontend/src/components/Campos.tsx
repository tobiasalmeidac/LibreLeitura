import { AlertCircle } from "lucide-react";
import type { ComponentProps, ReactNode } from "react";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

export function CampoTexto({
  id,
  rotulo,
  erro,
  dica,
  obrigatorio,
  className,
  ...props
}: ComponentProps<"input"> & {
  id: string;
  rotulo: string;
  erro?: string | undefined;
  dica?: ReactNode;
  obrigatorio?: boolean;
}) {
  const descricoes = [erro ? `${id}-erro` : null, dica ? `${id}-dica` : null].filter(Boolean).join(" ");
  return (
    <div className={cn("space-y-1.5", className)}>
      <Label htmlFor={id}>
        {rotulo}
        {obrigatorio && (
          <span className="text-danger-strong" aria-hidden="true">
            *
          </span>
        )}
      </Label>
      <Input
        id={id}
        aria-invalid={!!erro}
        aria-required={obrigatorio || undefined}
        aria-describedby={descricoes || undefined}
        {...props}
      />
      {dica && !erro && (
        <p id={`${id}-dica`} className="text-xs text-muted-foreground">
          {dica}
        </p>
      )}
      {erro && (
        <p id={`${id}-erro`} className="text-xs text-danger-strong">
          {erro}
        </p>
      )}
    </div>
  );
}

export function AlertaErro({ mensagem, className }: { mensagem: string | null | undefined; className?: string }) {
  if (!mensagem) return null;
  return (
    <div
      role="alert"
      className={cn(
        "flex items-start gap-2 rounded-md border border-danger/30 bg-danger-soft px-3 py-2 text-sm text-danger-strong",
        className,
      )}
    >
      <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
      <span>{mensagem}</span>
    </div>
  );
}
