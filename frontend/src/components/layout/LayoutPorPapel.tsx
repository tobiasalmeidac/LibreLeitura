import type { ReactNode } from "react";

import { useAuth } from "@/lib/auth";

import { LayoutGestor } from "./LayoutGestor";
import { LayoutPublico } from "./LayoutPublico";

/** Telas comuns aos dois papéis (ex.: Meus dados) usam o layout do papel logado. */
export function LayoutPorPapel({ children }: { children: ReactNode }) {
  const { usuario } = useAuth();
  if (usuario?.papel === "GESTOR") return <LayoutGestor>{children}</LayoutGestor>;
  return (
    <LayoutPublico>
      <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6">{children}</div>
    </LayoutPublico>
  );
}
