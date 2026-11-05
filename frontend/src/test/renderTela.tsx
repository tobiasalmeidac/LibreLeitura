import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render } from "@testing-library/react";
import type { ComponentType } from "react";

/**
 * Renderiza o componente de uma rota (o `component` de createFileRoute) com um QueryClient novo.
 * Use junto com o mock de "@tanstack/react-router" em src/test/routerMock.tsx.
 */
export function renderTela(rota: { options: { component?: unknown } }) {
  const Tela = rota.options.component as ComponentType;
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 }, mutations: { retry: false } },
  });
  return render(
    <QueryClientProvider client={client}>
      <Tela />
    </QueryClientProvider>,
  );
}
