import type { ReactNode } from "react";

// Substituto leve do @tanstack/react-router para testes de tela.
// As telas são renderizadas direto (sem árvore de rotas), então só precisamos das peças usadas nelas.

export const createFileRoute = () => (options: unknown) => ({ options });

export function Link({ to, children, className }: { to: string; children: ReactNode; className?: string }) {
  return (
    <a href={to} className={className}>
      {children}
    </a>
  );
}

export const useNavigate = () => () => undefined;

export const useRouterState = () => "/gestor";

export const Outlet = () => null;
