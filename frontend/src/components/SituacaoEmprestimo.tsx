import { AlertTriangle, CheckCircle2, Clock, CircleDot } from "lucide-react";

import { Etiqueta } from "@/components/StatusBadge";
import type { Emprestimo } from "@/lib/api";
import { diasDeAtraso, diasParaVencer, venceEmBreve } from "@/lib/dominio";
import { pluralDias } from "@/lib/formato";

export function textoPrazo(e: Emprestimo): string {
  const atraso = diasDeAtraso(e);
  if (atraso > 0) return `Atrasado há ${pluralDias(atraso)}`;
  const faltam = diasParaVencer(e);
  if (faltam <= 0) return "Vence hoje";
  return `Faltam ${pluralDias(faltam)}`;
}

export function SituacaoEmprestimo({ e, diasAviso }: { e: Emprestimo; diasAviso?: number | null }) {
  if (e.situacao === "DEVOLVIDO") {
    return (
      <Etiqueta tom="neutro" icone={CheckCircle2}>
        Devolvido
      </Etiqueta>
    );
  }
  if (e.situacao === "ATRASADO") {
    return (
      <Etiqueta tom="perigo" icone={AlertTriangle}>
        Atrasado há {pluralDias(Math.max(1, diasDeAtraso(e)))}
      </Etiqueta>
    );
  }
  if (typeof diasAviso === "number" && venceEmBreve(e, diasAviso)) {
    const faltam = diasParaVencer(e);
    return (
      <Etiqueta tom="atencao" icone={Clock}>
        {faltam <= 0 ? "Vence hoje" : `Vence em ${pluralDias(faltam)}`}
      </Etiqueta>
    );
  }
  return (
    <Etiqueta tom="info" icone={CircleDot}>
      Em dia
    </Etiqueta>
  );
}
