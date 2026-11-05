import { createFileRoute } from "@tanstack/react-router";

import { EmConstrucao } from "@/components/EmConstrucao";

export const Route = createFileRoute("/gestor/acervo")({
  head: () => ({
    meta: [
      { title: "Acervo — LibreLeitura" },
      { name: "description", content: "Livros, exemplares, autores e categorias." },
      { property: "og:title", content: "Acervo — LibreLeitura" },
      { property: "og:description", content: "Livros, exemplares, autores e categorias." },
    ],
  }),
  component: () => <EmConstrucao titulo="Acervo" descricao="Livros, exemplares, autores e categorias." />,
});
