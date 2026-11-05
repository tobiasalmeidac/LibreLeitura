import { Link, useNavigate } from "@tanstack/react-router";
import { LogOut } from "lucide-react";
import type { ReactNode } from "react";

import { Logo } from "@/components/Logo";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/auth";

const linkNav =
  "rounded-md px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground";
const linkAtivo = "text-foreground bg-secondary";

export function LayoutPublico({ children }: { children: ReactNode }) {
  const { estado, usuario, sair } = useAuth();
  const navigate = useNavigate();

  async function aoSair() {
    await sair();
    navigate({ to: "/login" });
  }

  return (
    <div className="flex min-h-screen flex-col">
      <header className="sticky top-0 z-30 border-b bg-background/95 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-4 sm:px-6">
          <Logo />
          <nav aria-label="Principal" className="flex items-center gap-1 overflow-x-auto">
            <Link to="/" className={linkNav} activeProps={{ className: linkAtivo }} activeOptions={{ exact: true }}>
              Catálogo
            </Link>
            {estado === "autenticado" && usuario?.papel === "LEITOR" && (
              <>
                <Link to="/meus-emprestimos" className={linkNav} activeProps={{ className: linkAtivo }}>
                  Meus empréstimos
                </Link>
                <Link to="/meus-dados" className={linkNav} activeProps={{ className: linkAtivo }}>
                  Meus dados
                </Link>
              </>
            )}
            {estado === "autenticado" && usuario?.papel === "GESTOR" && (
              <Link to="/gestor" className={linkNav}>
                Painel
              </Link>
            )}
            {estado === "autenticado" ? (
              <Button variant="ghost" size="sm" onClick={aoSair} className="ml-1">
                <LogOut aria-hidden="true" />
                Sair
              </Button>
            ) : estado === "anonimo" ? (
              <Button asChild size="sm" className="ml-1">
                <Link to="/login">Entrar</Link>
              </Button>
            ) : null}
          </nav>
        </div>
      </header>
      <main id="conteudo" className="flex-1">
        {children}
      </main>
      <footer className="border-t">
        <div className="mx-auto max-w-6xl px-4 py-6 text-xs text-muted-foreground sm:px-6">
          LibreLeitura · Sistema para pequenas bibliotecas e salas de leitura
        </div>
      </footer>
    </div>
  );
}
