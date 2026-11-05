import { ChevronLeft, ChevronRight } from "lucide-react";

import { Button } from "@/components/ui/button";
import { formatarNumero } from "@/lib/formato";

interface Props {
  total: number;
  limite: number;
  deslocamento: number;
  onMudar: (novoDeslocamento: number) => void;
  desabilitado?: boolean;
}

export function Paginacao({ total, limite, deslocamento, onMudar, desabilitado }: Props) {
  if (total === 0) return null;
  const inicio = deslocamento + 1;
  const fim = Math.min(deslocamento + limite, total);
  const temAnterior = deslocamento > 0;
  const temProximo = deslocamento + limite < total;

  return (
    <nav aria-label="Paginação" className="flex flex-col items-center justify-between gap-3 border-t pt-4 sm:flex-row">
      <p className="text-sm text-muted-foreground tabular" aria-live="polite">
        Mostrando {formatarNumero(inicio)}–{formatarNumero(fim)} de {formatarNumero(total)}
      </p>
      <div className="flex gap-2">
        <Button
          variant="outline"
          size="sm"
          disabled={!temAnterior || desabilitado}
          onClick={() => onMudar(Math.max(0, deslocamento - limite))}
        >
          <ChevronLeft aria-hidden="true" />
          Anterior
        </Button>
        <Button
          variant="outline"
          size="sm"
          disabled={!temProximo || desabilitado}
          onClick={() => onMudar(deslocamento + limite)}
        >
          Próximo
          <ChevronRight aria-hidden="true" />
        </Button>
      </div>
    </nav>
  );
}
