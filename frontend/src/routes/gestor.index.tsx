import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { AlertTriangle, ArrowLeftRight, Clock, Mail, Phone, RotateCw } from "lucide-react";

import { BotaoDevolver } from "@/components/emprestimos/DevolverEmprestimo";
import { CarregandoLinhas, EstadoErro, EstadoVazio } from "@/components/Estados";
import { CabecalhoPagina } from "@/components/layout/LayoutGestor";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { ItemPendencia } from "@/lib/api";
import { api } from "@/lib/api";
import { formatarData, formatarNumero, pluralDias } from "@/lib/formato";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/gestor/")({
  head: () => ({
    meta: [
      { title: "Painel — LibreLeitura" },
      { name: "description", content: "Empréstimos atrasados e a vencer, com contatos dos leitores." },
      { property: "og:title", content: "Painel — LibreLeitura" },
      { property: "og:description", content: "Empréstimos atrasados e a vencer, com contatos dos leitores." },
    ],
  }),
  component: Painel,
});

function Painel() {
  const consulta = useQuery({ queryKey: ["pendencias"], queryFn: api.alertas.pendencias, refetchInterval: 60_000 });
  const p = consulta.data;
  const rotuloAVencer = p ? `Vencem em ${formatarNumero(p.dias_aviso)} ${p.dias_aviso === 1 ? "dia" : "dias"}` : "A vencer";

  return (
    <div className="space-y-8">
      <CabecalhoPagina
        titulo="Painel de pendências"
        descricao="Empréstimos atrasados e próximos do vencimento."
        acoes={
          <>
            <Button variant="outline" size="sm" onClick={() => consulta.refetch()} disabled={consulta.isFetching}>
              <RotateCw className={cn(consulta.isFetching && "animate-spin")} aria-hidden="true" />
              Atualizar
            </Button>
            <Button asChild size="sm">
              <Link to="/gestor/balcao">
                <ArrowLeftRight aria-hidden="true" />
                Ir para o balcão
              </Link>
            </Button>
          </>
        }
      />

      {consulta.isPending ? (
        <div className="space-y-6">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {Array.from({ length: 2 }).map((_, i) => (
              <div key={i} className="h-24 animate-pulse rounded-lg bg-muted" />
            ))}
          </div>
          <CarregandoLinhas rotulo="Carregando pendências" />
        </div>
      ) : consulta.isError ? (
        <EstadoErro erro={consulta.error} onTentarNovamente={() => consulta.refetch()} />
      ) : (
        <>
          <section aria-label="Totais" className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <CartaoTotal rotulo="Atrasados" valor={p!.resumo.atrasados} tom="perigo" icone={AlertTriangle} />
            <CartaoTotal rotulo={rotuloAVencer} valor={p!.resumo.a_vencer} tom="atencao" icone={Clock} />
            <CartaoTotal rotulo="Em aberto" valor={p!.resumo.em_aberto} tom="neutro" />
          </section>

          <TabelaPendencias
            titulo="Atrasados"
            itens={p!.atrasados}
            vazio="Nenhum empréstimo atrasado"
            colunaPrazo="Atraso"
            atrasados
          />
          <TabelaPendencias titulo="A vencer" itens={p!.a_vencer} vazio="Nenhum empréstimo a vencer" colunaPrazo="Faltam" />
        </>
      )}
    </div>
  );
}

function CartaoTotal({
  rotulo,
  valor,
  tom,
  icone: Icone,
}: {
  rotulo: string;
  valor: number;
  tom: "perigo" | "atencao" | "neutro";
  icone?: typeof AlertTriangle;
}) {
  return (
    <div
      className={cn(
        "rounded-lg border bg-card p-4 shadow-card",
        tom === "perigo" && valor > 0 && "border-danger/30 bg-danger-soft",
        tom === "atencao" && valor > 0 && "border-warning/40 bg-warning-soft",
      )}
    >
      <p
        className={cn(
          "flex items-center gap-1.5 text-sm font-medium text-muted-foreground",
          tom === "perigo" && valor > 0 && "text-danger-strong",
          tom === "atencao" && valor > 0 && "text-warning-strong",
        )}
      >
        {Icone && <Icone className="size-4" aria-hidden="true" />}
        {rotulo}
      </p>
      <p className="mt-2 text-3xl font-semibold tabular">{formatarNumero(valor)}</p>
    </div>
  );
}

function textoPrazoPendencia(e: ItemPendencia, atrasado: boolean): string {
  if (atrasado) return `Atrasado há ${pluralDias(e.dias_atraso)}`;
  if (e.dias_para_vencer <= 0) return "Vence hoje";
  return `Faltam ${pluralDias(e.dias_para_vencer)}`;
}

function TabelaPendencias({
  titulo,
  itens,
  vazio,
  colunaPrazo,
  atrasados,
}: {
  titulo: string;
  itens: ItemPendencia[];
  vazio: string;
  colunaPrazo: string;
  atrasados?: boolean;
}) {
  const idTitulo = `tabela-${titulo.toLowerCase().replace(/\s+/g, "-")}`;
  return (
    <section aria-labelledby={idTitulo} className="space-y-3">
      <h2 id={idTitulo} className="flex items-center gap-2 text-lg font-semibold">
        {titulo}
        <span className="text-sm font-normal text-muted-foreground tabular">({formatarNumero(itens.length)})</span>
      </h2>
      {itens.length === 0 ? (
        <EstadoVazio titulo={vazio} />
      ) : (
        <div className="overflow-x-auto rounded-lg border bg-card shadow-card">
          <Table className="text-sm">
            <TableHeader>
              <TableRow>
                <TableHead>Leitor</TableHead>
                <TableHead>E-mail</TableHead>
                <TableHead>Telefone</TableHead>
                <TableHead>Livro</TableHead>
                <TableHead>Exemplar</TableHead>
                <TableHead>Prevista</TableHead>
                <TableHead>{colunaPrazo}</TableHead>
                <TableHead className="text-right">
                  <span className="sr-only">Ações</span>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {itens.map((e) => {
                const email = e.leitor_email;
                const telefone = e.leitor_telefone;
                return (
                  <TableRow key={String(e.emprestimo_id)}>
                    <TableCell className="py-2 font-medium">{e.leitor_nome}</TableCell>
                    <TableCell className="py-2">
                      {email ? (
                        <a href={`mailto:${email}`} className="inline-flex items-center gap-1 text-primary underline-offset-2 hover:underline">
                          <Mail className="size-3.5" aria-hidden="true" />
                          {email}
                        </a>
                      ) : (
                        "—"
                      )}
                    </TableCell>
                    <TableCell className="py-2 whitespace-nowrap">
                      {telefone ? (
                        <a
                          href={`tel:${telefone.replace(/[^\d+]/g, "")}`}
                          className="inline-flex items-center gap-1 text-primary underline-offset-2 hover:underline"
                        >
                          <Phone className="size-3.5" aria-hidden="true" />
                          {telefone}
                        </a>
                      ) : (
                        "—"
                      )}
                    </TableCell>
                    <TableCell className="py-2">{e.livro_titulo}</TableCell>
                    <TableCell className="py-2 font-mono text-xs">{e.exemplar_codigo}</TableCell>
                    <TableCell className="py-2 tabular">{formatarData(e.data_prevista)}</TableCell>
                    <TableCell
                      className={cn(
                        "py-2 font-medium whitespace-nowrap tabular",
                        atrasados ? "text-danger-strong" : "text-warning-strong",
                      )}
                    >
                      <span className="inline-flex items-center gap-1">
                        {atrasados ? <AlertTriangle className="size-3.5" aria-hidden="true" /> : <Clock className="size-3.5" aria-hidden="true" />}
                        {textoPrazoPendencia(e, !!atrasados)}
                      </span>
                    </TableCell>
                    <TableCell className="py-2 text-right">
                      <BotaoDevolver
                        emprestimo={{
                          id: e.emprestimo_id,
                          livro_titulo: e.livro_titulo,
                          exemplar_codigo: e.exemplar_codigo,
                          leitor_nome: e.leitor_nome,
                        }}
                        rotulo="Registrar devolução"
                      />
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}
    </section>
  );
}
