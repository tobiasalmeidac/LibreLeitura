import { createFileRoute } from "@tanstack/react-router";

import { EmConstrucao } from "@/components/EmConstrucao";

export const Route = createFileRoute("/gestor/emprestimos")({
  head: () => ({
    meta: [
      { title: "Empréstimos — LibreLeitura" },
      { name: "description", content: "Consulte empréstimos em aberto, atrasados, a vencer e devolvidos." },
      { property: "og:title", content: "Empréstimos — LibreLeitura" },
      { property: "og:description", content: "Consulte empréstimos em aberto, atrasados, a vencer e devolvidos." },
    ],
  }),
  component: () => <EmConstrucao titulo="Empréstimos" descricao="Consulte empréstimos em aberto, atrasados, a vencer e devolvidos." />,
});
