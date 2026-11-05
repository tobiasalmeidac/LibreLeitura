import { cva } from "class-variance-authority";
import { AlertTriangle, CheckCircle2, Clock, MinusCircle } from "lucide-react";

import type { StatusDisponibilidade } from "@/lib/api";
import { ROTULO_STATUS } from "@/lib/dominio";
import { cn } from "@/lib/utils";

export const statusVariants = cva(
  "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium whitespace-nowrap [&_svg]:size-3.5 [&_svg]:shrink-0",
  {
    variants: {
      tom: {
        sucesso: "border-success/30 bg-success-soft text-success-strong",
        atencao: "border-warning/40 bg-warning-soft text-warning-strong",
        perigo: "border-danger/30 bg-danger-soft text-danger-strong",
        neutro: "border-border bg-neutral-soft text-neutral-strong",
        info: "border-primary/25 bg-primary-soft text-primary",
      },
    },
    defaultVariants: { tom: "neutro" },
  },
);

const CONFIG: Record<StatusDisponibilidade, { tom: "sucesso" | "atencao" | "neutro"; Icone: typeof CheckCircle2 }> = {
  DISPONIVEL: { tom: "sucesso", Icone: CheckCircle2 },
  EMPRESTADO: { tom: "atencao", Icone: Clock },
  INDISPONIVEL: { tom: "neutro", Icone: MinusCircle },
};

export function StatusBadge({ status, className }: { status: StatusDisponibilidade; className?: string }) {
  const { tom, Icone } = CONFIG[status];
  return (
    <span className={cn(statusVariants({ tom }), className)}>
      <Icone aria-hidden="true" />
      {ROTULO_STATUS[status]}
    </span>
  );
}

export function Etiqueta({
  tom,
  icone: Icone,
  children,
  className,
}: {
  tom: "sucesso" | "atencao" | "perigo" | "neutro" | "info";
  icone?: typeof AlertTriangle;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <span className={cn(statusVariants({ tom }), className)}>
      {Icone && <Icone aria-hidden="true" />}
      {children}
    </span>
  );
}
