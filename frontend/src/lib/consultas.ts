import type { QueryClient } from "@tanstack/react-query";

/** Após empréstimo/devolução, tudo que depende de disponibilidade precisa ser recarregado. */
export function invalidarCirculacao(queryClient: QueryClient) {
  for (const chave of ["emprestimos", "pendencias", "livros", "livro", "exemplares", "leitores", "leitor"]) {
    void queryClient.invalidateQueries({ queryKey: [chave] });
  }
}
