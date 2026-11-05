import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { AlertCircle, Loader2 } from "lucide-react";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";

import { EstadoErro, mensagemDoErro } from "@/components/Estados";
import { LayoutPorPapel } from "@/components/layout/LayoutPorPapel";
import { Protegido } from "@/components/layout/Protegido";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { api, ApiError } from "@/lib/api";

export const Route = createFileRoute("/meus-dados")({
  head: () => ({
    meta: [
      { title: "Meus dados — LibreLeitura" },
      { name: "description", content: "Veja seus dados de acesso e troque sua senha." },
      { property: "og:title", content: "Meus dados — LibreLeitura" },
      { property: "og:description", content: "Veja seus dados de acesso e troque sua senha." },
    ],
  }),
  component: () => (
    <Protegido>
      <LayoutPorPapel>
        <MeusDados />
      </LayoutPorPapel>
    </Protegido>
  ),
});

const esquemaSenha = z
  .object({
    senhaAtual: z.string().min(1, "Informe a senha atual."),
    novaSenha: z.string().min(1, "Informe a nova senha."),
    confirmacao: z.string().min(1, "Confirme a nova senha."),
  })
  .refine((d) => d.novaSenha === d.confirmacao, {
    path: ["confirmacao"],
    message: "A confirmação não confere com a nova senha.",
  });
type DadosSenha = z.infer<typeof esquemaSenha>;

// Campos da API (422) → campos do formulário.
const CAMPOS_API: Record<string, keyof DadosSenha> = { senha_atual: "senhaAtual", nova_senha: "novaSenha" };

function MeusDados() {
  const eu = useQuery({ queryKey: ["usuarios", "me"], queryFn: api.usuarios.me });
  const [erroGeral, setErroGeral] = useState<string | null>(null);

  const form = useForm<DadosSenha>({
    resolver: zodResolver(esquemaSenha),
    defaultValues: { senhaAtual: "", novaSenha: "", confirmacao: "" },
  });
  const { errors } = form.formState;

  const trocar = useMutation({
    mutationFn: (d: DadosSenha) => api.usuarios.trocarSenha(d.senhaAtual, d.novaSenha),
    onSuccess: () => {
      toast.success("Senha alterada com sucesso");
      form.reset();
      setErroGeral(null);
    },
    onError: (e) => {
      let atribuido = false;
      if (e instanceof ApiError) {
        for (const [campoApi, msg] of Object.entries(e.campos)) {
          const campo = CAMPOS_API[campoApi];
          if (campo) {
            form.setError(campo, { message: msg });
            atribuido = true;
          }
        }
      }
      setErroGeral(atribuido ? null : mensagemDoErro(e));
    },
  });

  return (
    <div className="max-w-2xl space-y-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Meus dados</h1>
        <p className="mt-1 text-sm text-muted-foreground">Seus dados de acesso ao sistema.</p>
      </div>

      <section aria-labelledby="titulo-perfil" className="rounded-lg border bg-card p-5 shadow-card">
        <h2 id="titulo-perfil" className="mb-4 text-sm font-semibold tracking-wide text-muted-foreground uppercase">
          Perfil
        </h2>
        {eu.isPending ? (
          <div role="status" aria-label="Carregando dados" className="space-y-3">
            <Skeleton className="h-5 w-1/2" />
            <Skeleton className="h-5 w-2/3" />
          </div>
        ) : eu.isError ? (
          <EstadoErro erro={eu.error} onTentarNovamente={() => eu.refetch()} />
        ) : (
          <dl className="grid gap-4 sm:grid-cols-2">
            <div>
              <dt className="text-xs text-muted-foreground">Nome</dt>
              <dd className="font-medium">{eu.data.nome}</dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">E-mail</dt>
              <dd className="font-medium break-all">{eu.data.email}</dd>
            </div>
          </dl>
        )}
      </section>

      <section aria-labelledby="titulo-senha" className="rounded-lg border bg-card p-5 shadow-card">
        <h2 id="titulo-senha" className="mb-4 text-sm font-semibold tracking-wide text-muted-foreground uppercase">
          Trocar senha
        </h2>
        <form onSubmit={form.handleSubmit((d) => trocar.mutate(d))} noValidate className="space-y-4">
          <CampoSenha id="senhaAtual" rotulo="Senha atual" autoComplete="current-password" erro={errors.senhaAtual?.message} {...form.register("senhaAtual")} />
          <CampoSenha id="novaSenha" rotulo="Nova senha" autoComplete="new-password" erro={errors.novaSenha?.message} {...form.register("novaSenha")} />
          <CampoSenha id="confirmacao" rotulo="Confirmar nova senha" autoComplete="new-password" erro={errors.confirmacao?.message} {...form.register("confirmacao")} />

          {erroGeral && (
            <div role="alert" className="flex items-start gap-2 rounded-md border border-danger/30 bg-danger-soft px-3 py-2 text-sm text-danger-strong">
              <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
              {erroGeral}
            </div>
          )}

          <Button type="submit" disabled={trocar.isPending}>
            {trocar.isPending && <Loader2 className="animate-spin" aria-hidden="true" />}
            Salvar nova senha
          </Button>
        </form>
      </section>
    </div>
  );
}

const CampoSenha = ({
  id,
  rotulo,
  erro,
  ...props
}: React.ComponentProps<"input"> & { id: string; rotulo: string; erro?: string | undefined }) => (
  <div className="space-y-1.5 sm:max-w-sm">
    <Label htmlFor={id}>{rotulo}</Label>
    <Input
      id={id}
      type="password"
      aria-invalid={!!erro}
      aria-describedby={erro ? `${id}-erro` : undefined}
      {...props}
    />
    {erro && (
      <p id={`${id}-erro`} className="text-xs text-danger-strong">
        {erro}
      </p>
    )}
  </div>
);
