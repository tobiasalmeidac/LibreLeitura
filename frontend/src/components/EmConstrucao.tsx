import { Hammer } from "lucide-react";

import { CabecalhoPagina } from "@/components/layout/LayoutGestor";

export function EmConstrucao({ titulo, descricao }: { titulo: string; descricao: string }) {
  return (
    <>
      <CabecalhoPagina titulo={titulo} descricao={descricao} />
      <div className="flex flex-col items-center gap-2 rounded-lg border border-dashed bg-card px-6 py-16 text-center">
        <Hammer className="size-6 text-muted-foreground" aria-hidden="true" />
        <p className="font-medium">Tela em construção</p>
        <p className="max-w-sm text-sm text-muted-foreground">
          Esta tela faz parte das próximas etapas de construção do sistema.
        </p>
      </div>
    </>
  );
}
