import { Loader2 } from "lucide-react";
import type { ReactNode } from "react";

import { AlertaErro } from "@/components/Campos";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";

interface Props {
  aberto: boolean;
  onAbertoChange: (aberto: boolean) => void;
  titulo: string;
  descricao: ReactNode;
  rotuloConfirmar: string;
  destrutivo?: boolean;
  pendente?: boolean;
  erro?: string | null;
  onConfirmar: () => void;
  children?: ReactNode;
}

/** Modal de confirmação para ações destrutivas (excluir, baixar, devolver). */
export function ConfirmarAcao({
  aberto,
  onAbertoChange,
  titulo,
  descricao,
  rotuloConfirmar,
  destrutivo,
  pendente,
  erro,
  onConfirmar,
  children,
}: Props) {
  return (
    <AlertDialog open={aberto} onOpenChange={(a) => !pendente && onAbertoChange(a)}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{titulo}</AlertDialogTitle>
          <AlertDialogDescription asChild>
            <div className="space-y-2 text-sm text-muted-foreground">{descricao}</div>
          </AlertDialogDescription>
        </AlertDialogHeader>
        {children}
        <AlertaErro mensagem={erro} />
        <AlertDialogFooter>
          <AlertDialogCancel disabled={pendente}>Cancelar</AlertDialogCancel>
          <Button variant={destrutivo ? "destructive" : "default"} onClick={onConfirmar} disabled={pendente}>
            {pendente && <Loader2 className="animate-spin" aria-hidden="true" />}
            {rotuloConfirmar}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
