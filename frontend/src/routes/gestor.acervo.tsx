import { zodResolver } from "@hookform/resolvers/zod";
import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";

import { AlertaErro, CampoTexto } from "@/components/Campos";
import { ConfirmarAcao } from "@/components/ConfirmarAcao";
import { CarregandoLinhas, EstadoErro, EstadoVazio, mensagemDoErro } from "@/components/Estados";
import { CabecalhoPagina } from "@/components/layout/LayoutGestor";
import { Paginacao } from "@/components/Paginacao";
import { StatusBadge } from "@/components/StatusBadge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useDebounce } from "@/hooks/use-debounce";
import { api, type Categoria, type Id, type SituacaoExemplar } from "@/lib/api";
import { invalidarCirculacao } from "@/lib/consultas";
import { isbnValido, nomesDosAutores, ROTULO_SITUACAO_EXEMPLAR, statusDoExemplar } from "@/lib/dominio";
import { aplicarErrosDaApi } from "@/lib/formularios";
import { formatarNumero } from "@/lib/formato";

export const Route = createFileRoute("/gestor/acervo")({
  head: () => ({
    meta: [
      { title: "Acervo — LibreLeitura" },
      { name: "description", content: "Cadastro de livros, exemplares, autores e categorias." },
      { property: "og:title", content: "Acervo — LibreLeitura" },
      { property: "og:description", content: "Cadastro de livros, exemplares, autores e categorias." },
    ],
  }),
  component: Acervo,
});

const LIMITE = 20;

function Acervo() {
  return (
    <div className="space-y-6">
      <CabecalhoPagina titulo="Acervo" descricao="Livros e exemplares, além de autores e categorias." />
      <Tabs defaultValue="livros">
        <TabsList>
          <TabsTrigger value="livros">Livros</TabsTrigger>
          <TabsTrigger value="cadastros">Autores e categorias</TabsTrigger>
        </TabsList>
        <TabsContent value="livros" className="mt-4">
          <Livros />
        </TabsContent>
        <TabsContent value="cadastros" className="mt-4">
          <AutoresECategorias />
        </TabsContent>
      </Tabs>
    </div>
  );
}

/* ---------------------------------------------------------------------------
 * Livros
 * ------------------------------------------------------------------------- */

function Livros() {
  const [texto, setTexto] = useState("");
  const busca = useDebounce(texto.trim(), 300);
  const [pagina, setPagina] = useState(0);
  const [novo, setNovo] = useState(false);
  const [detalheId, setDetalheId] = useState<Id | null>(null);
  const deslocamento = pagina * LIMITE;

  const consulta = useQuery({
    queryKey: ["livros", "acervo", { busca, deslocamento }],
    queryFn: () => api.livros.listar({ busca: busca || undefined, limite: LIMITE, deslocamento }),
    placeholderData: keepPreviousData,
  });

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="space-y-1.5 sm:w-80">
          <Label htmlFor="busca-acervo" className="text-xs text-muted-foreground">
            Buscar por título, ISBN, autor ou categoria
          </Label>
          <Input
            id="busca-acervo"
            value={texto}
            onChange={(e) => {
              setTexto(e.target.value);
              setPagina(0);
            }}
            className="bg-card"
          />
        </div>
        <Button onClick={() => setNovo(true)}>
          <Plus aria-hidden="true" />
          Novo livro
        </Button>
      </div>

      {consulta.isPending ? (
        <CarregandoLinhas rotulo="Carregando livros" />
      ) : consulta.isError ? (
        <EstadoErro erro={consulta.error} onTentarNovamente={() => consulta.refetch()} />
      ) : consulta.data.itens.length === 0 ? (
        <EstadoVazio titulo="Nenhum livro encontrado" />
      ) : (
        <>
          <div className="overflow-x-auto rounded-lg border bg-card shadow-card">
            <Table className="text-sm">
              <TableHeader>
                <TableRow>
                  <TableHead>Título</TableHead>
                  <TableHead>Autor(es)</TableHead>
                  <TableHead>Categoria</TableHead>
                  <TableHead className="text-right">Exemplares</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {consulta.data.itens.map((l) => (
                  <TableRow key={l.id} className="cursor-pointer" onClick={() => setDetalheId(l.id)}>
                    <TableCell className="py-2 font-medium">{l.titulo}</TableCell>
                    <TableCell className="py-2">{nomesDosAutores(l) || "—"}</TableCell>
                    <TableCell className="py-2">{l.categoria?.nome ?? "—"}</TableCell>
                    <TableCell className="py-2 text-right tabular">
                      {formatarNumero(l.exemplares_disponiveis)} / {formatarNumero(l.total_exemplares)}
                    </TableCell>
                    <TableCell className="py-2">
                      <StatusBadge status={l.status} />
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

      {novo && <NovoLivro onFechar={() => setNovo(false)} />}
      {detalheId !== null && <DetalheLivro id={detalheId} onFechar={() => setDetalheId(null)} />}
    </div>
  );
}

const esquemaLivro = z.object({
  titulo: z.string().trim().min(1, "Informe o título.").max(255, "Use no máximo 255 caracteres."),
  isbn: z.string().refine((v) => !v.trim() || isbnValido(v), "ISBN inválido."),
  editora: z.string().max(120, "Use no máximo 120 caracteres."),
  ano: z.string().refine((v) => !v.trim() || /^\d{4}$/.test(v.trim()), "Use 4 dígitos."),
  categoriaId: z.string(),
  autorIds: z.array(z.number()),
  quantidade: z.string().refine((v) => /^\d+$/.test(v) && Number(v) >= 1 && Number(v) <= 200, "Informe entre 1 e 200."),
});
type DadosLivro = z.infer<typeof esquemaLivro>;

// Campos da API (422) → campos do formulário.
const CAMPOS_LIVRO_API: Record<string, keyof DadosLivro> = {
  titulo: "titulo",
  isbn: "isbn",
  editora: "editora",
  ano_publicacao: "ano",
  categoria_id: "categoriaId",
  autor_ids: "autorIds",
  quantidade_exemplares: "quantidade",
};

function NovoLivro({ onFechar }: { onFechar: () => void }) {
  const queryClient = useQueryClient();
  const categorias = useQuery({ queryKey: ["categorias"], queryFn: api.categorias.listar, staleTime: 5 * 60_000 });
  const autores = useQuery({
    queryKey: ["autores", "todos"],
    queryFn: () => api.autores.listar(undefined, 100, 0),
    staleTime: 5 * 60_000,
  });
  const [erroGeral, setErroGeral] = useState<string | null>(null);

  const form = useForm<DadosLivro>({
    resolver: zodResolver(esquemaLivro),
    defaultValues: { titulo: "", isbn: "", editora: "", ano: "", categoriaId: "", autorIds: [], quantidade: "1" },
  });
  const { errors } = form.formState;
  const autorIds = form.watch("autorIds");
  const categoriaId = form.watch("categoriaId");

  const criar = useMutation({
    mutationFn: (d: DadosLivro) =>
      api.livros.criar({
        titulo: d.titulo.trim(),
        isbn: d.isbn.trim() || null,
        editora: d.editora.trim() || null,
        ano_publicacao: d.ano.trim() ? Number(d.ano) : null,
        categoria_id: d.categoriaId ? Number(d.categoriaId) : null,
        autor_ids: d.autorIds,
        quantidade_exemplares: Number(d.quantidade),
      }),
    onSuccess: () => {
      toast.success("Livro cadastrado");
      void queryClient.invalidateQueries({ queryKey: ["livros"] });
      onFechar();
    },
    onError: (e) => setErroGeral(aplicarErrosDaApi(e, form.setError, CAMPOS_LIVRO_API)),
  });

  function alternarAutor(id: Id, marcado: boolean) {
    const atual = form.getValues("autorIds");
    const novos = marcado ? [...atual, Number(id)] : atual.filter((a) => a !== Number(id));
    form.setValue("autorIds", novos, { shouldValidate: true });
  }

  return (
    <Dialog open onOpenChange={(a) => !a && onFechar()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Novo livro</DialogTitle>
          <DialogDescription>Os exemplares são numerados automaticamente a partir da quantidade informada.</DialogDescription>
        </DialogHeader>
        <form className="space-y-4" onSubmit={form.handleSubmit((d) => criar.mutate(d))} noValidate>
          <CampoTexto id="livro-titulo" rotulo="Título" obrigatorio {...form.register("titulo")} erro={errors.titulo?.message} />
          <div className="grid gap-4 sm:grid-cols-2">
            <CampoTexto id="livro-editora" rotulo="Editora" {...form.register("editora")} erro={errors.editora?.message} />
            <CampoTexto id="livro-ano" rotulo="Ano" inputMode="numeric" {...form.register("ano")} erro={errors.ano?.message} />
            <CampoTexto id="livro-isbn" rotulo="ISBN (opcional)" {...form.register("isbn")} erro={errors.isbn?.message} />
            <CampoTexto
              id="livro-quantidade"
              rotulo="Exemplares a criar"
              inputMode="numeric"
              {...form.register("quantidade")}
              erro={errors.quantidade?.message}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="livro-categoria">Categoria (opcional)</Label>
            <Select value={categoriaId || "nenhuma"} onValueChange={(v) => form.setValue("categoriaId", v === "nenhuma" ? "" : v)}>
              <SelectTrigger id="livro-categoria" className="bg-card">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="nenhuma">Sem categoria</SelectItem>
                {(categorias.data ?? []).map((c: Categoria) => (
                  <SelectItem key={c.id} value={String(c.id)}>
                    {c.nome}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <fieldset className="space-y-2">
            <legend className="text-sm font-medium">Autor(es)</legend>
            {autores.isPending ? (
              <p className="text-sm text-muted-foreground">Carregando autores…</p>
            ) : (autores.data?.itens.length ?? 0) === 0 ? (
              <p className="text-sm text-muted-foreground">Nenhum autor cadastrado. Cadastre na aba "Autores e categorias".</p>
            ) : (
              <div className="grid max-h-40 gap-1.5 overflow-y-auto rounded-md border p-3 sm:grid-cols-2">
                {autores.data?.itens.map((a) => (
                  <label key={a.id} className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={autorIds.includes(Number(a.id))}
                      onChange={(e) => alternarAutor(a.id, e.target.checked)}
                      className="size-4 accent-primary"
                    />
                    {a.nome}
                  </label>
                ))}
              </div>
            )}
          </fieldset>
          <AlertaErro mensagem={erroGeral} />
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onFechar}>
              Cancelar
            </Button>
            <Button type="submit" disabled={criar.isPending}>
              {criar.isPending ? "Salvando…" : "Cadastrar livro"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function DetalheLivro({ id, onFechar }: { id: Id; onFechar: () => void }) {
  const queryClient = useQueryClient();
  const livro = useQuery({ queryKey: ["livro", "acervo", id], queryFn: () => api.livros.obter(id) });
  const [quantidade, setQuantidade] = useState("1");
  const [pendente, setPendente] = useState<{ exemplar: Id; codigo: string; situacao: SituacaoExemplar } | null>(null);
  const [excluir, setExcluir] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const invalidar = () => {
    void queryClient.invalidateQueries({ queryKey: ["livros"] });
    void queryClient.invalidateQueries({ queryKey: ["livro"] });
    invalidarCirculacao(queryClient);
  };

  const addExemplares = useMutation({
    mutationFn: () => api.livros.adicionarExemplares(id, Number(quantidade)),
    onSuccess: () => {
      toast.success("Exemplares adicionados");
      setErro(null);
      invalidar();
    },
    onError: (e) => setErro(mensagemDoErro(e)),
  });

  const mudarSituacao = useMutation({
    mutationFn: (p: { exemplar: Id; situacao: SituacaoExemplar }) => api.exemplares.atualizar(p.exemplar, p.situacao),
    onSuccess: () => {
      toast.success("Situação do exemplar atualizada");
      setPendente(null);
      setErro(null);
      invalidar();
    },
    onError: (e) => setErro(mensagemDoErro(e)),
  });

  const removerLivro = useMutation({
    mutationFn: () => api.livros.excluir(id),
    onSuccess: () => {
      toast.success("Livro excluído");
      void queryClient.invalidateQueries({ queryKey: ["livros"] });
      onFechar();
    },
    onError: (e) => setErro(mensagemDoErro(e)),
  });

  const dados = livro.data;
  return (
    <Dialog open onOpenChange={(a) => !a && onFechar()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        {livro.isPending ? (
          <CarregandoLinhas rotulo="Carregando livro" />
        ) : livro.isError || !dados ? (
          <EstadoErro erro={livro.error} onTentarNovamente={() => livro.refetch()} />
        ) : (
          <>
            <DialogHeader>
              <DialogTitle>{dados.titulo}</DialogTitle>
              <DialogDescription>
                {[nomesDosAutores(dados), dados.editora, dados.ano_publicacao, dados.categoria?.nome].filter(Boolean).join(" · ") ||
                  "Sem dados complementares"}
              </DialogDescription>
            </DialogHeader>

            <div className="flex flex-wrap items-center gap-3 text-sm">
              <StatusBadge status={dados.status} />
              {dados.isbn && <span className="font-mono text-muted-foreground">ISBN {dados.isbn}</span>}
            </div>

            <div className="overflow-x-auto rounded-md border">
              <Table className="text-sm">
                <TableHeader>
                  <TableRow>
                    <TableHead>Código</TableHead>
                    <TableHead>Situação</TableHead>
                    <TableHead>Disponibilidade</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {dados.exemplares.map((e) => (
                    <TableRow key={e.id}>
                      <TableCell className="py-2 font-mono text-xs">{e.codigo}</TableCell>
                      <TableCell className="py-2">
                        <Select
                          value={e.situacao}
                          onValueChange={(v) => {
                            const situacao = v as SituacaoExemplar;
                            if (situacao === e.situacao) return;
                            if (situacao === "ATIVO") mudarSituacao.mutate({ exemplar: e.id, situacao });
                            else setPendente({ exemplar: e.id, codigo: e.codigo, situacao });
                          }}
                        >
                          <SelectTrigger aria-label={`Situação do exemplar ${e.codigo}`} className="h-8 w-40 bg-card">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {(Object.keys(ROTULO_SITUACAO_EXEMPLAR) as SituacaoExemplar[]).map((s) => (
                              <SelectItem key={s} value={s}>
                                {ROTULO_SITUACAO_EXEMPLAR[s]}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </TableCell>
                      <TableCell className="py-2">
                        <StatusBadge status={statusDoExemplar(e)} />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            <div className="flex flex-wrap items-end gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="qtd-exemplares">Adicionar exemplares</Label>
                <Input
                  id="qtd-exemplares"
                  inputMode="numeric"
                  value={quantidade}
                  onChange={(e) => setQuantidade(e.target.value)}
                  className="w-24 bg-card"
                />
              </div>
              <Button
                variant="outline"
                onClick={() => addExemplares.mutate()}
                disabled={addExemplares.isPending || !/^\d+$/.test(quantidade) || Number(quantidade) < 1}
              >
                Adicionar
              </Button>
            </div>

            <AlertaErro mensagem={erro} />

            <DialogFooter className="justify-between sm:justify-between">
              <Button variant="ghost" className="text-danger-strong" onClick={() => setExcluir(true)}>
                <Trash2 aria-hidden="true" />
                Excluir livro
              </Button>
              <Button variant="outline" onClick={onFechar}>
                Fechar
              </Button>
            </DialogFooter>
          </>
        )}

        <ConfirmarAcao
          aberto={!!pendente}
          onAbertoChange={(a) => !a && setPendente(null)}
          titulo={`Alterar situação do exemplar ${pendente?.codigo ?? ""}?`}
          descricao={`O exemplar será marcado como "${pendente ? ROTULO_SITUACAO_EXEMPLAR[pendente.situacao] : ""}" e deixará de ser emprestável.`}
          rotuloConfirmar="Confirmar"
          destrutivo
          pendente={mudarSituacao.isPending}
          erro={erro}
          onConfirmar={() => pendente && mudarSituacao.mutate({ exemplar: pendente.exemplar, situacao: pendente.situacao })}
        >
          <span />
        </ConfirmarAcao>

        <ConfirmarAcao
          aberto={excluir}
          onAbertoChange={setExcluir}
          titulo="Excluir este livro?"
          descricao="A exclusão só é permitida se o livro nunca foi emprestado. Caso contrário, a API recusa e a mensagem aparece aqui."
          rotuloConfirmar="Excluir"
          destrutivo
          pendente={removerLivro.isPending}
          erro={erro}
          onConfirmar={() => removerLivro.mutate()}
        >
          <span />
        </ConfirmarAcao>
      </DialogContent>
    </Dialog>
  );
}

/* ---------------------------------------------------------------------------
 * Autores e categorias (mesmo padrão: lista, criar, renomear e excluir)
 * ------------------------------------------------------------------------- */

interface ItemNomeado {
  id: Id;
  nome: string;
}

function AutoresECategorias() {
  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <CadastroNomes
        titulo="Autores"
        chave="autores"
        listar={async () => (await api.autores.listar(undefined, 100, 0)).itens}
        criar={api.autores.criar}
        atualizar={api.autores.atualizar}
        excluir={api.autores.excluir}
      />
      <CadastroNomes
        titulo="Categorias"
        chave="categorias"
        listar={api.categorias.listar}
        criar={api.categorias.criar}
        atualizar={api.categorias.atualizar}
        excluir={api.categorias.excluir}
      />
    </div>
  );
}

function CadastroNomes({
  titulo,
  chave,
  listar,
  criar,
  atualizar,
  excluir,
}: {
  titulo: string;
  chave: string;
  listar: () => Promise<ItemNomeado[]>;
  criar: (nome: string) => Promise<unknown>;
  atualizar: (id: Id, nome: string) => Promise<unknown>;
  excluir: (id: Id) => Promise<unknown>;
}) {
  const queryClient = useQueryClient();
  const singular = titulo.toLowerCase().replace(/s$/, "");
  const consulta = useQuery({ queryKey: [chave, "cadastro"], queryFn: listar });
  const [novo, setNovo] = useState("");
  const [editando, setEditando] = useState<{ id: Id; nome: string } | null>(null);
  const [aExcluir, setAExcluir] = useState<ItemNomeado | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  // Autores e categorias aparecem nos livros e nos filtros do catálogo.
  const aposSucesso = (mensagem: string) => {
    toast.success(mensagem);
    setErro(null);
    void queryClient.invalidateQueries({ queryKey: [chave] });
    void queryClient.invalidateQueries({ queryKey: ["livros"] });
  };

  const mutCriar = useMutation({
    mutationFn: () => criar(novo.trim()),
    onSuccess: () => {
      setNovo("");
      aposSucesso(`${titulo.slice(0, -1)} cadastrado`);
    },
    onError: (e) => setErro(mensagemDoErro(e)),
  });
  const mutAtualizar = useMutation({
    mutationFn: () => atualizar(editando!.id, editando!.nome.trim()),
    onSuccess: () => {
      setEditando(null);
      aposSucesso("Nome atualizado");
    },
    onError: (e) => setErro(mensagemDoErro(e)),
  });
  const mutExcluir = useMutation({
    mutationFn: () => excluir(aExcluir!.id),
    onSuccess: () => {
      setAExcluir(null);
      aposSucesso("Excluído");
    },
    onError: (e) => setErro(mensagemDoErro(e)),
  });

  return (
    <section aria-labelledby={`titulo-${chave}`} className="space-y-3 rounded-lg border bg-card p-5 shadow-card">
      <h2 id={`titulo-${chave}`} className="text-lg font-semibold">
        {titulo}
      </h2>
      <form
        className="flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          if (novo.trim()) mutCriar.mutate();
        }}
      >
        <Input aria-label={`Novo ${singular}`} value={novo} onChange={(e) => setNovo(e.target.value)} placeholder="Nome" className="bg-card" />
        <Button type="submit" disabled={!novo.trim() || mutCriar.isPending}>
          <Plus aria-hidden="true" />
          Adicionar
        </Button>
      </form>

      {consulta.isPending ? (
        <CarregandoLinhas rotulo={`Carregando ${titulo.toLowerCase()}`} linhas={3} />
      ) : consulta.isError ? (
        <EstadoErro erro={consulta.error} onTentarNovamente={() => consulta.refetch()} />
      ) : consulta.data.length === 0 ? (
        <EstadoVazio titulo={`Nenhum ${singular} cadastrado`} />
      ) : (
        <ul className="divide-y rounded-md border">
          {consulta.data.map((item) => (
            <li key={item.id} className="flex items-center gap-2 px-3 py-2">
              {editando?.id === item.id ? (
                <form
                  className="flex flex-1 gap-2"
                  onSubmit={(e) => {
                    e.preventDefault();
                    if (editando.nome.trim()) mutAtualizar.mutate();
                  }}
                >
                  <Input
                    aria-label="Novo nome"
                    value={editando.nome}
                    onChange={(e) => setEditando({ ...editando, nome: e.target.value })}
                    className="h-8 bg-card"
                  />
                  <Button size="sm" type="submit" disabled={mutAtualizar.isPending}>
                    Salvar
                  </Button>
                  <Button size="sm" variant="ghost" type="button" onClick={() => setEditando(null)}>
                    Cancelar
                  </Button>
                </form>
              ) : (
                <>
                  <span className="flex-1 truncate">{item.nome}</span>
                  <Button size="sm" variant="ghost" onClick={() => setEditando({ id: item.id, nome: item.nome })}>
                    Renomear
                  </Button>
                  <Button size="sm" variant="ghost" className="text-danger-strong" onClick={() => setAExcluir(item)}>
                    <Trash2 aria-hidden="true" />
                    <span className="sr-only">Excluir {item.nome}</span>
                  </Button>
                </>
              )}
            </li>
          ))}
        </ul>
      )}

      <AlertaErro mensagem={erro} />

      <ConfirmarAcao
        aberto={!!aExcluir}
        onAbertoChange={(a) => !a && setAExcluir(null)}
        titulo={`Excluir "${aExcluir?.nome ?? ""}"?`}
        descricao="Se estiver em uso por algum livro, a API recusa a exclusão e a mensagem aparece aqui."
        rotuloConfirmar="Excluir"
        destrutivo
        pendente={mutExcluir.isPending}
        erro={erro}
        onConfirmar={() => mutExcluir.mutate()}
      >
        <span />
      </ConfirmarAcao>
    </section>
  );
}
