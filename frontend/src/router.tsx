import { QueryClient } from "@tanstack/react-query";
import { createRouter } from "@tanstack/react-router";

import { ApiError } from "./lib/api";
import { routeTree } from "./routeTree.gen";

export const getRouter = () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        // Não repete erros de regra/permissão (4xx); repete uma vez falhas de rede/servidor.
        retry: (falhas, erro) => {
          if (erro instanceof ApiError && erro.status >= 400 && erro.status < 500) return false;
          return falhas < 1;
        },
        refetchOnWindowFocus: false,
        staleTime: 30_000,
      },
    },
  });

  const router = createRouter({
    routeTree,
    context: { queryClient },
    scrollRestoration: true,
    defaultPreloadStaleTime: 0,
  });

  return router;
};
