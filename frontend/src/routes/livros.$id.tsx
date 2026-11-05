import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";

import { EstadoErro, EstadoVazio } from "@/components/Estados";
import { LayoutPublico } from "@/components/layout/LayoutPublico";
import { StatusBadge } from "@/components/StatusBadge";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { api, type Livro } from "@/lib/api";
import { nomesDosAutores, ROTULO_SITUACAO_EXEMPLAR, statusDoExemplar } from "@/lib/dominio";

export const Route = createFileRoute("/livros/$id")({
  head: () => ({
    meta: [
      { title: "Detalhe do livro — LibreLeitura" },
      { name: "description", content: "Dados do livro, exemplares e disponibilidade no acervo." },
      { property: "og:title", content: "Detalhe do livro — LibreLeitura" },
      { property: "og:description", content: "Dados do livro, exemplares e disponibilidade no acervo." },
    ],
  }),
  component: DetalheLivro,
});

function DetalheLivro() {
  const { id } = Route.useParams();
  const livro = useQuery({ queryKey: ["livro", id], queryFn: () => api.livros.obter(Number(id)) });

  return (
    <LayoutPublico>
      <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6">
        <Link
          to="/"
          className="inline-flex items-center gap-1.5 rounded-md text-sm font-medium text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="size-4" aria-hidden="true" />
          Voltar ao catálogo
        </Link>

        <div className="mt-6">
          {livro.isPending ? (
            <div role="status" aria-label="Carregando livro" className="space-y-4">
              <Skeleton className="h-8 w-2/3" />
              <Skeleton className="h-5 w-1/3" />
              <Skeleton className="h-40 w-full" />
            </div>
          ) : livro.isError ? (
            <EstadoErro erro={livro.error} onTentarNovamente={() => livro.refetch()} />
          ) : (
            <ConteudoLivro livro={livro.data} />
          )}
        </div>
      </div>
    </LayoutPublico>
  );
}

function ConteudoLivro({ livro }: { livro: Livro }) {
  const status = livro.status;
  const autores = nomesDosAutores(livro);
  const exemplares = livro.exemplares;

  const dados: [string, string | number | null | undefined][] = [
    ["Autor(es)", autores || null],
    ["Editora", livro.editora],
    ["Ano", livro.ano_publicacao],
    ["ISBN", livro.isbn],
    ["Categoria", livro.categoria?.nome],
  ];

  return (
    <article className="space-y-8">
      <header className="space-y-3">
        <h1 className="text-3xl font-semibold tracking-tight">{livro.titulo}</h1>
        {autores && <p className="text-lg text-muted-foreground">{autores}</p>}
        <div className="flex flex-wrap items-center gap-3">
          <StatusBadge status={status} className="px-3 py-1 text-sm" />
        </div>
      </header>

      <section aria-labelledby="titulo-dados" className="rounded-lg border bg-card p-5 shadow-card">
        <h2 id="titulo-dados" className="mb-4 text-sm font-semibold tracking-wide text-muted-foreground uppercase">
          Dados da obra
        </h2>
        <dl className="grid gap-x-6 gap-y-3 sm:grid-cols-2">
          {dados.map(([rotulo, valor]) => (
            <div key={rotulo}>
              <dt className="text-xs text-muted-foreground">{rotulo}</dt>
              <dd className="font-medium">{valor ?? "—"}</dd>
            </div>
          ))}
        </dl>
      </section>

      <section aria-labelledby="titulo-exemplares" className="space-y-3">
        <h2 id="titulo-exemplares" className="text-lg font-semibold">
          Exemplares
        </h2>
        {exemplares.length === 0 ? (
          <EstadoVazio titulo="Nenhum exemplar cadastrado para este livro" />
        ) : (
          <div className="overflow-hidden rounded-lg border bg-card shadow-card">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Código</TableHead>
                  <TableHead>Situação</TableHead>
                  <TableHead>Disponibilidade</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {exemplares.map((e) => (
                  <TableRow key={String(e.id)}>
                    <TableCell className="font-mono text-sm">{e.codigo}</TableCell>
                    <TableCell>{ROTULO_SITUACAO_EXEMPLAR[e.situacao] ?? e.situacao}</TableCell>
                    <TableCell>
                      <StatusBadge status={statusDoExemplar(e)} />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </section>
    </article>
  );
}
