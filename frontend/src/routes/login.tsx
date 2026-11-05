import { zodResolver } from "@hookform/resolvers/zod";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { AlertCircle, Eye, EyeOff, Info, Loader2 } from "lucide-react";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";

import { mensagemDoErro } from "@/components/Estados";
import { Logo } from "@/components/Logo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/lib/auth";
import { rotaInicial } from "@/lib/dominio";

export const Route = createFileRoute("/login")({
  head: () => ({
    meta: [
      { title: "Entrar — LibreLeitura" },
      { name: "description", content: "Acesse o LibreLeitura com seu e-mail e senha." },
      { property: "og:title", content: "Entrar — LibreLeitura" },
      { property: "og:description", content: "Acesse o LibreLeitura com seu e-mail e senha." },
    ],
  }),
  component: Login,
});

const esquema = z.object({
  email: z.string().trim().min(1, "Informe o e-mail.").email("Informe um e-mail válido."),
  senha: z.string().min(1, "Informe a senha."),
});
type Dados = z.infer<typeof esquema>;

function Login() {
  const { estado, usuario, entrar, aviso, limparAviso } = useAuth();
  const navigate = useNavigate();
  const [mostrarSenha, setMostrarSenha] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<Dados>({ resolver: zodResolver(esquema), defaultValues: { email: "", senha: "" } });

  // Já logado: vai direto para a tela inicial do papel.
  useEffect(() => {
    if (estado === "autenticado" && usuario) navigate({ to: rotaInicial(usuario.papel), replace: true });
  }, [estado, usuario, navigate]);

  async function aoEnviar(dados: Dados) {
    setErro(null);
    limparAviso();
    try {
      const u = await entrar(dados.email, dados.senha);
      navigate({ to: rotaInicial(u.papel), replace: true });
    } catch (e) {
      setErro(mensagemDoErro(e));
    }
  }

  return (
    <div className="flex min-h-screen flex-col bg-secondary/60">
      <div className="mx-auto flex w-full max-w-6xl px-4 py-5 sm:px-6">
        <Logo />
      </div>
      <main className="flex flex-1 items-start justify-center px-4 pt-8 pb-16 sm:pt-16">
        <div className="w-full max-w-sm">
          <div className="rounded-xl border bg-card p-6 shadow-card sm:p-8">
            <h1 className="text-xl font-semibold tracking-tight">Entrar</h1>
            <p className="mt-1 text-sm text-muted-foreground">Use o e-mail e a senha fornecidos pela biblioteca.</p>

            {aviso && (
              <div role="status" className="mt-5 flex items-start gap-2 rounded-md border border-warning/40 bg-warning-soft px-3 py-2 text-sm text-warning-strong">
                <Info className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
                {aviso}
              </div>
            )}

            <form onSubmit={handleSubmit(aoEnviar)} noValidate className="mt-6 space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="email">E-mail</Label>
                <Input
                  id="email"
                  type="email"
                  autoComplete="email"
                  autoFocus
                  aria-invalid={!!errors.email}
                  aria-describedby={errors.email ? "email-erro" : undefined}
                  {...register("email")}
                />
                {errors.email && (
                  <p id="email-erro" className="text-xs text-danger-strong">
                    {errors.email.message}
                  </p>
                )}
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="senha">Senha</Label>
                <div className="relative">
                  <Input
                    id="senha"
                    type={mostrarSenha ? "text" : "password"}
                    autoComplete="current-password"
                    className="pr-10"
                    aria-invalid={!!errors.senha}
                    aria-describedby={errors.senha ? "senha-erro" : undefined}
                    {...register("senha")}
                  />
                  <button
                    type="button"
                    onClick={() => setMostrarSenha((v) => !v)}
                    className="absolute inset-y-0 right-0 flex w-10 items-center justify-center rounded-r-md text-muted-foreground hover:text-foreground"
                    aria-label={mostrarSenha ? "Ocultar senha" : "Mostrar senha"}
                    aria-pressed={mostrarSenha}
                  >
                    {mostrarSenha ? <EyeOff className="size-4" aria-hidden="true" /> : <Eye className="size-4" aria-hidden="true" />}
                  </button>
                </div>
                {errors.senha && (
                  <p id="senha-erro" className="text-xs text-danger-strong">
                    {errors.senha.message}
                  </p>
                )}
              </div>

              <Button type="submit" className="w-full" disabled={isSubmitting || estado === "carregando"}>
                {isSubmitting && <Loader2 className="animate-spin" aria-hidden="true" />}
                Entrar
              </Button>

              {erro && (
                <div role="alert" className="flex items-start gap-2 rounded-md border border-danger/30 bg-danger-soft px-3 py-2 text-sm text-danger-strong">
                  <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
                  {erro}
                </div>
              )}
            </form>
          </div>
          <p className="mt-6 text-center text-sm text-muted-foreground">
            Quer apenas consultar o acervo?{" "}
            <Link to="/" className="font-medium text-primary underline-offset-4 hover:underline">
              Ver catálogo
            </Link>
          </p>
        </div>
      </main>
    </div>
  );
}
