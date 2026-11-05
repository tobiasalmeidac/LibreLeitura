import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { AlertTriangle, CheckCircle2, Clock } from "lucide-react";

import { EstadoErro, EstadoVazio } from "@/components/Estados";
import { LayoutPublico } from "@/components/layout/LayoutPublico";
import { Protegido } from "@/components/layout/Protegido";
import { Paginacao } from "@/components/Paginacao";
import { Etiqueta } from "@/components/StatusBadge";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { api, type Emprestimo } from "@/lib/api";
import { codigoDoEmprestimo, diasDeAtraso, tituloDoEmprestimo } from "@/lib/dominio";
import { formatarData, pluralDias } from "@/lib/formato";
import { cn } from "@/lib/utils";

const LIMITE = 20;

export const Route = createFileRoute("/meus-emprestimos")({
  validateSearch: (s: Record<string, unknown>): { pagina?: number | undefined } => ({
    pagina: Number(s["pagina"]) > 1 ? Math.floor(Number(s["pagina"])) : undefined,
  }),
  head: () => ({
    meta: [
      { title: "Meus empréstimos — LibreLeitura" },
      { name: "description", content: "Acompanhe seus empréstimos, datas de devolução e atrasos." },
      { property: "og:title", content: "Meus empréstimos — LibreLeitura" },
      { property: "og:description", content: "Acompanhe seus empréstimos, datas de devolução e atrasos." },
    ],
  }),
  component: () => (
    <Protegido papel="LEITOR">
      <MeusEmprestimos />
    </Protegido>
  ),
});

function Situacao({ e }: { e: Emprestimo }) {
  if (e.data_devolucao) {
    return (
      <Etiqueta tom="neutro" icone={CheckCircle2}>
        Devolvido
      </Etiqueta>
    );
  }
  const atraso = diasDeAtraso(e);
  if (atraso > 0) {
    return (
      <Etiqueta tom="perigo" icone={AlertTriangle}>
        Atrasado há {pluralDias(atraso)}
      </Etiqueta>
    );
  }
  return (
    <Etiqueta tom="info" icone={Clock}>
      Em aberto
    </Etiqueta>
  );
}

function MeusEmprestimos() {
  const { pagina = 1 } = Route.useSearch();
  const navigate = useNavigate({ from: "/meus-emprestimos" });
  const deslocamento = (pagina - 1) * LIMITE;

  const consulta = useQuery({
    queryKey: ["me", "emprestimos", deslocamento],
    queryFn: () => api.me.emprestimos(LIMITE, deslocamento),
    placeholderData: keepPreviousData,
  });

  return (
    <LayoutPublico>
      <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
        <h1 className="text-2xl font-semibold tracking-tight">Meus empréstimos</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Para devolver um livro, leve o exemplar ao balcão da biblioteca.
        </p>

        <div className="mt-6">
          {consulta.isPending ? (
            <div role="status" aria-label="Carregando empréstimos" className="space-y-2">
              {Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className="h-14 w-full" />
              ))}
            </div>
          ) : consulta.isError ? (
            <EstadoErro erro={consulta.error} onTentarNovamente={() => consulta.refetch()} />
          ) : consulta.data.itens.length === 0 ? (
            <EstadoVazio titulo="Você ainda não tem empréstimos">
              Consulte o catálogo e retire um livro no balcão da biblioteca.
            </EstadoVazio>
          ) : (
            <div className="space-y-6">
              {/* Celular: lista de cartões */}
              <ul className="space-y-3 md:hidden">
                {consulta.data.itens.map((e) => {
                  const atrasado = diasDeAtraso(e) > 0;
                  return (
                    <li
                      key={String(e.id)}
                      className={cn(
                        "rounded-lg border bg-card p-4 shadow-card",
                        atrasado && "border-danger/40 bg-danger-soft",
                      )}
                    >
                      <p className="font-semibold leading-snug">{tituloDoEmprestimo(e)}</p>
                      <p className="mt-0.5 font-mono text-xs text-muted-foreground">{codigoDoEmprestimo(e)}</p>
                      <div className="mt-3">
                        <Situacao e={e} />
                      </div>
                      <dl className="mt-3 grid grid-cols-3 gap-2 text-xs">
                        <div>
                          <dt className="text-muted-foreground">Retirada</dt>
                          <dd className="font-medium tabular">{formatarData(e.data_retirada)}</dd>
                        </div>
                        <div>
                          <dt className="text-muted-foreground">Prevista</dt>
                          <dd className="font-medium tabular">{formatarData(e.data_prevista)}</dd>
                        </div>
                        <div>
                          <dt className="text-muted-foreground">Devolução</dt>
                          <dd className="font-medium tabular">{formatarData(e.data_devolucao)}</dd>
                        </div>
                      </dl>
                    </li>
                  );
                })}
              </ul>

              {/* Desktop: tabela */}
              <div className="hidden overflow-hidden rounded-lg border bg-card shadow-card md:block">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Livro</TableHead>
                      <TableHead>Exemplar</TableHead>
                      <TableHead>Retirada</TableHead>
                      <TableHead>Devolução prevista</TableHead>
                      <TableHead>Devolvido em</TableHead>
                      <TableHead>Situação</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {consulta.data.itens.map((e) => (
                      <TableRow key={String(e.id)} className={cn(diasDeAtraso(e) > 0 && "bg-danger-soft hover:bg-danger-soft")}>
                        <TableCell className="font-medium">{tituloDoEmprestimo(e)}</TableCell>
                        <TableCell className="font-mono text-xs">{codigoDoEmprestimo(e)}</TableCell>
                        <TableCell className="tabular">{formatarData(e.data_retirada)}</TableCell>
                        <TableCell className="tabular">{formatarData(e.data_prevista)}</TableCell>
                        <TableCell className="tabular">{formatarData(e.data_devolucao)}</TableCell>
                        <TableCell>
                          <Situacao e={e} />
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              <Paginacao
                total={consulta.data.total}
                limite={LIMITE}
                deslocamento={deslocamento}
                desabilitado={consulta.isFetching}
                onMudar={(d) => navigate({ search: { pagina: d / LIMITE + 1 > 1 ? d / LIMITE + 1 : undefined } })}
              />
            </div>
          )}
        </div>
      </div>
    </LayoutPublico>
  );
}
