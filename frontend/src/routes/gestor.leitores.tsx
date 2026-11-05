import { createFileRoute } from "@tanstack/react-router";

import { EmConstrucao } from "@/components/EmConstrucao";

export const Route = createFileRoute("/gestor/leitores")({
  head: () => ({
    meta: [
      { title: "Leitores — LibreLeitura" },
      { name: "description", content: "Cadastro de leitores e criação de acesso." },
      { property: "og:title", content: "Leitores — LibreLeitura" },
      { property: "og:description", content: "Cadastro de leitores e criação de acesso." },
    ],
  }),
  component: () => <EmConstrucao titulo="Leitores" descricao="Cadastro de leitores e criação de acesso." />,
});
