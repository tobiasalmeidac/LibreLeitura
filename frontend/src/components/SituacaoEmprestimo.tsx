import { AlertTriangle, CheckCircle2, Clock, CircleDot } from "lucide-react";

import { Etiqueta } from "@/components/StatusBadge";
import type { Emprestimo } from "@/lib/api";
import { diasDeAtraso, diasParaVencer, situacaoDoEmprestimo } from "@/lib/dominio";
import { pluralDias } from "@/lib/formato";

export function textoPrazo(e: Emprestimo): string {
  const atraso = diasDeAtraso(e);
  if (atraso > 0) return `Atrasado há ${pluralDias(atraso)}`;
  const faltam = diasParaVencer(e);
  if (faltam <= 0) return "Vence hoje";
  return `Faltam ${pluralDias(faltam)}`;
}

export function SituacaoEmprestimo({ e, diasAviso }: { e: Emprestimo; diasAviso?: number | null }) {
  const situacao = situacaoDoEmprestimo(e, diasAviso);
  switch (situacao) {
    case "DEVOLVIDO":
      return (
        <Etiqueta tom="neutro" icone={CheckCircle2}>
          Devolvido
        </Etiqueta>
      );
    case "ATRASADO":
      return (
        <Etiqueta tom="perigo" icone={AlertTriangle}>
          Atrasado há {pluralDias(Math.max(1, diasDeAtraso(e)))}
        </Etiqueta>
      );
    case "A_VENCER": {
      const faltam = diasParaVencer(e);
      return (
        <Etiqueta tom="atencao" icone={Clock}>
          {faltam <= 0 ? "Vence hoje" : `Vence em ${pluralDias(faltam)}`}
        </Etiqueta>
      );
    }
    default:
      return (
        <Etiqueta tom="info" icone={CircleDot}>
          Em aberto
        </Etiqueta>
      );
  }
}
