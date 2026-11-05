import { useNavigate } from "@tanstack/react-router";
import { useEffect, type ReactNode } from "react";

import { TelaCarregando } from "@/components/Estados";
import type { Papel } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { rotaInicial } from "@/lib/dominio";

/**
 * Guarda de rota no cliente. A sessão vive só em memória (sem SSR de dados),
 * então a verificação acontece depois que o AuthProvider restaura a sessão.
 */
export function Protegido({ papel, children }: { papel?: Papel; children: ReactNode }) {
  const { estado, usuario } = useAuth();
  const navigate = useNavigate();
  const papelErrado = estado === "autenticado" && !!papel && usuario?.papel !== papel;

  useEffect(() => {
    if (estado === "anonimo") {
      navigate({ to: "/login", replace: true });
    } else if (papelErrado && usuario) {
      // Rotas de gestor redirecionam para o catálogo; demais, para a tela inicial do papel.
      navigate({ to: papel === "GESTOR" ? "/" : rotaInicial(usuario.papel), replace: true });
    }
  }, [estado, papelErrado, papel, usuario, navigate]);

  if (estado !== "autenticado" || papelErrado) return <TelaCarregando />;
  return <>{children}</>;
}
