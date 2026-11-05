import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";

import { BotaoDevolver } from "@/components/emprestimos/DevolverEmprestimo";
import { CarregandoLinhas, EstadoErro, EstadoVazio } from "@/components/Estados";
import { CabecalhoPagina } from "@/components/layout/LayoutGestor";
import { Paginacao } from "@/components/Paginacao";
import { SituacaoEmprestimo } from "@/components/SituacaoEmprestimo";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { api, type FiltroEmprestimo } from "@/lib/api";
import { formatarData } from "@/lib/formato";

export const Route = createFileRoute("/gestor/emprestimos")({
  head: () => ({
    meta: [
      { title: "Empréstimos — LibreLeitura" },
      { name: "description", content: "Consulte empréstimos em aberto, atrasados, a vencer e devolvidos." },
      { property: "og:title", content: "Empréstimos — LibreLeitura" },
      { property: "og:description", content: "Consulte empréstimos em aberto, atrasados, a vencer e devolvidos." },
    ],
  }),
  component: Emprestimos,
});

const LIMITE = 20;

const FILTROS: { valor: FiltroEmprestimo | "todos"; rotulo: string }[] = [
  { valor: "todos", rotulo: "Todos" },
  { valor: "EM_ABERTO", rotulo: "Em aberto" },
  { valor: "ATRASADO", rotulo: "Atrasados" },
  { valor: "A_VENCER", rotulo: "A vencer" },
  { valor: "DEVOLVIDO", rotulo: "Devolvidos" },
];

function Emprestimos() {
  const [filtro, setFiltro] = useState<FiltroEmprestimo | "todos">("todos");
  const [pagina, setPagina] = useState(0);
  const deslocamento = pagina * LIMITE;
  const situacao = filtro === "todos" ? undefined : filtro;

  const configuracao = useQuery({ queryKey: ["configuracao"], queryFn: api.configuracao.obter, staleTime: 5 * 60_000 });
  const consulta = useQuery({
    queryKey: ["emprestimos", { situacao, deslocamento }],
    queryFn: () => api.emprestimos.listar({ situacao, limite: LIMITE, deslocamento }),
    placeholderData: keepPreviousData,
  });
  const diasAviso = configuracao.data?.dias_aviso_vencimento;

  return (
    <div className="space-y-6">
      <CabecalhoPagina titulo="Empréstimos" descricao="Consulte empréstimos em aberto, atrasados, a vencer e devolvidos." />

      <div className="space-y-1.5 sm:w-64">
        <Label htmlFor="filtro-situacao" className="text-xs text-muted-foreground">
          Situação
        </Label>
        <Select
          value={filtro}
          onValueChange={(v) => {
            setFiltro(v as FiltroEmprestimo | "todos");
            setPagina(0);
          }}
        >
          <SelectTrigger id="filtro-situacao" className="bg-card">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {FILTROS.map((f) => (
              <SelectItem key={f.valor} value={f.valor}>
                {f.rotulo}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {consulta.isPending ? (
        <CarregandoLinhas rotulo="Carregando empréstimos" />
      ) : consulta.isError ? (
        <EstadoErro erro={consulta.error} onTentarNovamente={() => consulta.refetch()} />
      ) : consulta.data.itens.length === 0 ? (
        <EstadoVazio titulo="Nenhum empréstimo encontrado com este filtro" />
      ) : (
        <>
          <div className="overflow-x-auto rounded-lg border bg-card shadow-card">
            <Table className="text-sm">
              <TableHeader>
                <TableRow>
                  <TableHead>Livro</TableHead>
                  <TableHead>Exemplar</TableHead>
                  <TableHead>Leitor</TableHead>
                  <TableHead>Retirada</TableHead>
                  <TableHead>Prevista</TableHead>
                  <TableHead>Devolução</TableHead>
                  <TableHead>Situação</TableHead>
                  <TableHead className="text-right">
                    <span className="sr-only">Ações</span>
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {consulta.data.itens.map((e) => (
                  <TableRow key={e.id}>
                    <TableCell className="py-2 font-medium">{e.livro_titulo}</TableCell>
                    <TableCell className="py-2 font-mono text-xs">{e.exemplar_codigo}</TableCell>
                    <TableCell className="py-2">{e.leitor_nome}</TableCell>
                    <TableCell className="py-2 tabular">{formatarData(e.data_saida)}</TableCell>
                    <TableCell className="py-2 tabular">{formatarData(e.data_prevista)}</TableCell>
                    <TableCell className="py-2 tabular">{e.data_devolucao ? formatarData(e.data_devolucao) : "—"}</TableCell>
                    <TableCell className="py-2">
                      <SituacaoEmprestimo e={e} diasAviso={diasAviso ?? null} />
                    </TableCell>
                    <TableCell className="py-2 text-right">
                      {!e.data_devolucao && <BotaoDevolver emprestimo={e} rotulo="Devolver" />}
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
            onMudar={(d) => setPagina(d / LIMITE)}
            desabilitado={consulta.isFetching}
          />
        </>
      )}
    </div>
  );
}
