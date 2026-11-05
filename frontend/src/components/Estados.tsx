import { AlertCircle, Inbox, Loader2, RotateCw } from "lucide-react";
import type { ReactNode } from "react";

import { Button } from "@/components/ui/button";
import { ApiError, MENSAGEM_SEM_CONEXAO } from "@/lib/api";

export function mensagemDoErro(erro: unknown): string {
  if (erro instanceof ApiError) return erro.message;
  return MENSAGEM_SEM_CONEXAO;
}

export function EstadoErro({ erro, onTentarNovamente }: { erro: unknown; onTentarNovamente?: () => void }) {
  return (
    <div role="alert" className="flex flex-col items-center gap-3 rounded-lg border border-danger/25 bg-danger-soft px-6 py-10 text-center">
      <AlertCircle className="size-6 text-danger-strong" aria-hidden="true" />
      <p className="max-w-md text-sm font-medium text-danger-strong">{mensagemDoErro(erro)}</p>
      {onTentarNovamente && (
        <Button variant="outline" size="sm" onClick={onTentarNovamente}>
          <RotateCw aria-hidden="true" />
          Tentar novamente
        </Button>
      )}
    </div>
  );
}

export function EstadoVazio({ titulo, children }: { titulo: string; children?: ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-2 rounded-lg border border-dashed px-6 py-12 text-center">
      <Inbox className="size-6 text-muted-foreground" aria-hidden="true" />
      <p className="font-medium">{titulo}</p>
      {children && <div className="text-sm text-muted-foreground">{children}</div>}
    </div>
  );
}

export function Carregando({ texto = "Carregando…" }: { texto?: string }) {
  return (
    <div role="status" className="flex items-center justify-center gap-2 py-16 text-sm text-muted-foreground">
      <Loader2 className="size-4 animate-spin" aria-hidden="true" />
      {texto}
    </div>
  );
}

export function TelaCarregando() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background">
      <Carregando />
    </div>
  );
}

export function CarregandoLinhas({ linhas = 5, rotulo = "Carregando" }: { linhas?: number; rotulo?: string }) {
  return (
    <div role="status" aria-label={rotulo} className="space-y-2">
      {Array.from({ length: linhas }).map((_, i) => (
        <div key={i} className="h-10 w-full animate-pulse rounded-md bg-muted" />
      ))}
    </div>
  );
}
