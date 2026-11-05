import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { Search, X } from "lucide-react";
import { useEffect, useState } from "react";

import { EstadoErro, EstadoVazio } from "@/components/Estados";
import { LayoutPublico } from "@/components/layout/LayoutPublico";
import { Paginacao } from "@/components/Paginacao";
import { StatusBadge } from "@/components/StatusBadge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { api, type LivroResumo, type StatusDisponibilidade } from "@/lib/api";
import { nomesDosAutores, ROTULO_STATUS } from "@/lib/dominio";

const LIMITE = 20;
// A API filtra apenas por "somente disponíveis"; os demais status são só exibidos.

interface BuscaCatalogo {
  q?: string | undefined;
  categoria?: string | undefined;
  status?: StatusDisponibilidade | undefined;
  pagina?: number | undefined;
}

export const Route = createFileRoute("/")({
  validateSearch: (s: Record<string, unknown>): BuscaCatalogo => ({
    q: typeof s["q"] === "string" && s["q"] ? s["q"] : undefined,
    categoria: s["categoria"] != null && s["categoria"] !== "" ? String(s["categoria"]) : undefined,
    status: s["status"] === "DISPONIVEL" ? "DISPONIVEL" : undefined,
    pagina: Number(s["pagina"]) > 1 ? Math.floor(Number(s["pagina"])) : undefined,
  }),
  head: () => ({
    meta: [
      { title: "Catálogo do acervo — LibreLeitura" },
      {
        name: "description",
        content: "Consulte o acervo da biblioteca e veja a disponibilidade dos livros em tempo real.",
      },
      { property: "og:title", content: "Catálogo do acervo — LibreLeitura" },
      {
        property: "og:description",
        content: "Consulte o acervo da biblioteca e veja a disponibilidade dos livros em tempo real.",
      },
    ],
  }),
  component: Catalogo,
});

function Catalogo() {
  const busca = Route.useSearch();
  const navigate = useNavigate({ from: "/" });
  const pagina = busca.pagina ?? 1;
  const deslocamento = (pagina - 1) * LIMITE;

  const [texto, setTexto] = useState(busca.q ?? "");
  useEffect(() => setTexto(busca.q ?? ""), [busca.q]);

  // Busca com pequena espera para não disparar uma requisição por tecla.
  useEffect(() => {
    const valor = texto.trim();
    if (valor === (busca.q ?? "")) return;
    const t = setTimeout(() => {
      navigate({ search: (s) => ({ ...s, q: valor || undefined, pagina: undefined }), replace: true });
    }, 350);
    return () => clearTimeout(t);
  }, [texto, busca.q, navigate]);

  const categorias = useQuery({ queryKey: ["categorias"], queryFn: api.categorias.listar, staleTime: 5 * 60_000 });

  const livros = useQuery({
    queryKey: ["livros", { q: busca.q, categoria: busca.categoria, status: busca.status, deslocamento }],
    queryFn: () =>
      api.livros.listar({
        busca: busca.q,
        categoriaId: busca.categoria ? Number(busca.categoria) : undefined,
        somenteDisponiveis: busca.status === "DISPONIVEL",
        limite: LIMITE,
        deslocamento,
      }),
    placeholderData: keepPreviousData,
  });

  const temFiltro = !!(busca.q || busca.categoria || busca.status);

  return (
    <LayoutPublico>
      <section className="border-b bg-secondary/50">
        <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6 sm:py-14">
          <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">Catálogo do acervo</h1>
          <p className="mt-2 max-w-xl text-muted-foreground">
            Pesquise por título ou autor e veja na hora se há exemplar disponível para retirada.
          </p>

          <form role="search" onSubmit={(e) => e.preventDefault()} className="mt-8">
            <Label htmlFor="busca" className="sr-only">
              Buscar por título ou autor
            </Label>
            <div className="relative">
              <Search className="pointer-events-none absolute top-1/2 left-4 size-5 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
              <Input
                id="busca"
                type="search"
                value={texto}
                onChange={(e) => setTexto(e.target.value)}
                placeholder="Buscar por título ou autor"
                className="h-14 rounded-lg bg-card pl-12 text-base shadow-card md:text-base"
                autoComplete="off"
              />
            </div>
          </form>

          <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-end">
            <div className="space-y-1.5 sm:w-64">
              <Label htmlFor="filtro-categoria" className="text-xs text-muted-foreground">
                Categoria
              </Label>
              <Select
                value={busca.categoria ?? "todas"}
                onValueChange={(v) =>
                  navigate({ search: (s) => ({ ...s, categoria: v === "todas" ? undefined : v, pagina: undefined }) })
                }
              >
                <SelectTrigger id="filtro-categoria" className="bg-card">
                  <SelectValue placeholder="Todas as categorias" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todas">Todas as categorias</SelectItem>
                  {(categorias.data ?? []).map((c) => (
                    <SelectItem key={String(c.id)} value={String(c.id)}>
                      {c.nome}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5 sm:w-56">
              <Label htmlFor="filtro-status" className="text-xs text-muted-foreground">
                Disponibilidade
              </Label>
              <Select
                value={busca.status ?? "todos"}
                onValueChange={(v) =>
                  navigate({
                    search: (s) => ({
                      ...s,
                      status: v === "todos" ? undefined : (v as StatusDisponibilidade),
                      pagina: undefined,
                    }),
                  })
                }
              >
                <SelectTrigger id="filtro-status" className="bg-card">
                  <SelectValue placeholder="Todos" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos</SelectItem>
                  <SelectItem value="DISPONIVEL">{ROTULO_STATUS.DISPONIVEL}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {temFiltro && (
              <Button
                variant="ghost"
                size="sm"
                className="self-start sm:self-auto"
                onClick={() => {
                  setTexto("");
                  navigate({ search: {} });
                }}
              >
                <X aria-hidden="true" />
                Limpar filtros
              </Button>
            )}
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-8 sm:px-6" aria-label="Resultados" aria-busy={livros.isFetching}>
        {livros.isPending ? (
          <GradeCarregando />
        ) : livros.isError ? (
          <EstadoErro erro={livros.error} onTentarNovamente={() => livros.refetch()} />
        ) : livros.data.itens.length === 0 ? (
          <EstadoVazio titulo={temFiltro ? "Nenhum livro encontrado" : "O acervo ainda não tem livros cadastrados"}>
            {temFiltro && "Tente outros termos de busca ou remova os filtros."}
          </EstadoVazio>
        ) : (
          <div className="space-y-6">
            <ul className="grid gap-3 sm:grid-cols-2 sm:gap-4 lg:grid-cols-3">
              {livros.data.itens.map((livro) => (
                <li key={String(livro.id)}>
                  <CartaoLivro livro={livro} />
                </li>
              ))}
            </ul>
            <Paginacao
              total={livros.data.total}
              limite={LIMITE}
              deslocamento={deslocamento}
              desabilitado={livros.isFetching}
              onMudar={(d) => {
                navigate({ search: (s) => ({ ...s, pagina: d / LIMITE + 1 > 1 ? d / LIMITE + 1 : undefined }) });
                window.scrollTo({ top: 0, behavior: "smooth" });
              }}
            />
          </div>
        )}
      </section>
    </LayoutPublico>
  );
}

function CartaoLivro({ livro }: { livro: LivroResumo }) {
  const autores = nomesDosAutores(livro);
  return (
    <Link
      to="/livros/$id"
      params={{ id: String(livro.id) }}
      className="group flex h-full flex-row items-center gap-3 rounded-lg border bg-card p-4 shadow-card transition-shadow hover:shadow-card-hover sm:flex-col sm:items-stretch sm:gap-4 sm:p-5"
    >
      <div className="min-w-0 flex-1">
        {livro.categoria?.nome && (
          <p className="mb-1 text-xs font-medium tracking-wide text-muted-foreground uppercase">{livro.categoria.nome}</p>
        )}
        <h2 className="line-clamp-2 font-semibold leading-snug group-hover:text-primary">{livro.titulo}</h2>
        {autores && <p className="mt-1 line-clamp-1 text-sm text-muted-foreground">{autores}</p>}
      </div>
      <div className="shrink-0">
        <StatusBadge status={livro.status} />
      </div>
    </Link>
  );
}

function GradeCarregando() {
  return (
    <div role="status" aria-label="Carregando livros" className="grid gap-3 sm:grid-cols-2 sm:gap-4 lg:grid-cols-3">
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} className="space-y-3 rounded-lg border bg-card p-5">
          <Skeleton className="h-3 w-20" />
          <Skeleton className="h-5 w-4/5" />
          <Skeleton className="h-4 w-1/2" />
          <Skeleton className="h-5 w-24 rounded-full" />
        </div>
      ))}
    </div>
  );
}
