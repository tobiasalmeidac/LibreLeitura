import { createFileRoute } from "@tanstack/react-router";

import { EmConstrucao } from "@/components/EmConstrucao";

export const Route = createFileRoute("/gestor/configuracoes")({
  head: () => ({
    meta: [
      { title: "Configurações — LibreLeitura" },
      { name: "description", content: "Prazos, limites de empréstimo e avisos de vencimento." },
      { property: "og:title", content: "Configurações — LibreLeitura" },
      { property: "og:description", content: "Prazos, limites de empréstimo e avisos de vencimento." },
    ],
  }),
  component: () => <EmConstrucao titulo="Configurações" descricao="Prazos, limites de empréstimo e avisos de vencimento." />,
});
