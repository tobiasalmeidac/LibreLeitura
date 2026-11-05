import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Undo2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { ConfirmarAcao } from "@/components/ConfirmarAcao";
import { mensagemDoErro } from "@/components/Estados";
import { Button } from "@/components/ui/button";
import { api, type Emprestimo } from "@/lib/api";
import { invalidarCirculacao } from "@/lib/consultas";
import { codigoDoEmprestimo, nomeDoLeitor, tituloDoEmprestimo } from "@/lib/dominio";

/** Botão "Registrar devolução"/"Devolver" com confirmação (POST /emprestimos/{id}/devolucao). */
export function BotaoDevolver({ emprestimo, rotulo = "Devolver" }: { emprestimo: Emprestimo; rotulo?: string }) {
  const [aberto, setAberto] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const queryClient = useQueryClient();

  const devolver = useMutation({
    mutationFn: () => api.emprestimos.devolver(emprestimo.id),
    onSuccess: () => {
      toast.success("Devolução registrada");
      setAberto(false);
      invalidarCirculacao(queryClient);
    },
    onError: (e) => setErro(mensagemDoErro(e)),
  });

  return (
    <>
      <Button
        variant="outline"
        size="sm"
        className="h-8"
        onClick={() => {
          setErro(null);
          setAberto(true);
        }}
      >
        <Undo2 aria-hidden="true" />
        {rotulo}
      </Button>
      <ConfirmarAcao
        aberto={aberto}
        onAbertoChange={setAberto}
        titulo="Registrar devolução?"
        descricao={
          <>
            <p>
              <span className="font-medium text-foreground">{tituloDoEmprestimo(emprestimo)}</span> (
              <span className="font-mono">{codigoDoEmprestimo(emprestimo)}</span>)
            </p>
            <p>Leitor: {nomeDoLeitor(emprestimo)}</p>
          </>
        }
        rotuloConfirmar="Confirmar devolução"
        pendente={devolver.isPending}
        erro={erro}
        onConfirmar={() => devolver.mutate()}
      />
    </>
  );
}
