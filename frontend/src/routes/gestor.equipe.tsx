import { createFileRoute } from "@tanstack/react-router";

import { EmConstrucao } from "@/components/EmConstrucao";

export const Route = createFileRoute("/gestor/equipe")({
  head: () => ({
    meta: [
      { title: "Equipe — LibreLeitura" },
      { name: "description", content: "Usuários gestores do sistema." },
      { property: "og:title", content: "Equipe — LibreLeitura" },
      { property: "og:description", content: "Usuários gestores do sistema." },
    ],
  }),
  component: () => <EmConstrucao titulo="Equipe" descricao="Usuários gestores do sistema." />,
});
