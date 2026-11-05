import { zodResolver } from "@hookform/resolvers/zod";
import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { KeyRound, Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";

import { AlertaErro, CampoTexto } from "@/components/Campos";
import { ConfirmarAcao } from "@/components/ConfirmarAcao";
import { CarregandoLinhas, EstadoErro, EstadoVazio, mensagemDoErro } from "@/components/Estados";
import { CabecalhoPagina } from "@/components/layout/LayoutGestor";
import { Paginacao } from "@/components/Paginacao";
import { Etiqueta } from "@/components/StatusBadge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useDebounce } from "@/hooks/use-debounce";
import { api, type Leitor } from "@/lib/api";
import { invalidarCirculacao } from "@/lib/consultas";
import { documentoMascarado, documentoValido } from "@/lib/dominio";
import { aplicarErrosDaApi } from "@/lib/formularios";
import { CheckCircle2, CircleOff } from "lucide-react";

export const Route = createFileRoute("/gestor/leitores")({
  head: () => ({
    meta: [
      { title: "Leitores — LibreLeitura" },
      { name: "description", content: "Cadastro de leitores e criação de acesso." },
      { property: "og:title", content: "Leitores — LibreLeitura" },
      { property: "og:description", content: "Cadastro de leitores e criação de acesso." },
    ],
  }),
  component: Leitores,
});

const LIMITE = 20;
type Ativo = "todos" | "ativos" | "inativos";

type Modo = { tipo: "novo" } | { tipo: "editar"; leitor: Leitor } | { tipo: "acesso"; leitor: Leitor } | null;

function Leitores() {
  const [texto, setTexto] = useState("");
  const busca = useDebounce(texto.trim(), 300);
  const [ativo, setAtivo] = useState<Ativo>("todos");
  const [pagina, setPagina] = useState(0);
  const [modo, setModo] = useState<Modo>(null);
  const [detalhe, setDetalhe] = useState<Leitor | null>(null);
  const deslocamento = pagina * LIMITE;

  const consulta = useQuery({
    queryKey: ["leitores", "lista", { busca, ativo, deslocamento }],
    queryFn: () => api.leitores.listar(busca || undefined, LIMITE, deslocamento, ativo === "todos" ? undefined : ativo === "ativos"),
    placeholderData: keepPreviousData,
  });

  return (
    <div className="space-y-6">
      <CabecalhoPagina
        titulo="Leitores"
        descricao="Cadastro das pessoas que retiram livros. O leitor não se cadastra sozinho."
        acoes={
          <Button onClick={() => setModo({ tipo: "novo" })}>
            <Plus aria-hidden="true" />
            Novo leitor
          </Button>
        }
      />

      <div className="flex flex-wrap items-end gap-3">
        <div className="space-y-1.5 sm:w-80">
          <Label htmlFor="busca-leitor" className="text-xs text-muted-foreground">
            Nome, e-mail ou documento completo
          </Label>
          <Input
            id="busca-leitor"
            value={texto}
            onChange={(e) => {
              setTexto(e.target.value);
              setPagina(0);
            }}
            className="bg-card"
          />
        </div>
        <div className="space-y-1.5 sm:w-48">
          <Label htmlFor="filtro-ativo" className="text-xs text-muted-foreground">
            Situação
          </Label>
          <Select
            value={ativo}
            onValueChange={(v) => {
              setAtivo(v as Ativo);
              setPagina(0);
            }}
          >
            <SelectTrigger id="filtro-ativo" className="bg-card">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos</SelectItem>
              <SelectItem value="ativos">Ativos</SelectItem>
              <SelectItem value="inativos">Inativos</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {consulta.isPending ? (
        <CarregandoLinhas rotulo="Carregando leitores" />
      ) : consulta.isError ? (
        <EstadoErro erro={consulta.error} onTentarNovamente={() => consulta.refetch()} />
      ) : consulta.data.itens.length === 0 ? (
        <EstadoVazio titulo="Nenhum leitor encontrado" />
      ) : (
        <>
          <div className="overflow-x-auto rounded-lg border bg-card shadow-card">
            <Table className="text-sm">
              <TableHeader>
                <TableRow>
                  <TableHead>Nome</TableHead>
                  <TableHead>E-mail</TableHead>
                  <TableHead>Telefone</TableHead>
                  <TableHead>Documento</TableHead>
                  <TableHead>Situação</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {consulta.data.itens.map((l) => (
                  <TableRow key={l.id} className="cursor-pointer" onClick={() => setDetalhe(l)}>
                    <TableCell className="py-2 font-medium">{l.nome}</TableCell>
                    <TableCell className="py-2">{l.email ?? "—"}</TableCell>
                    <TableCell className="py-2 whitespace-nowrap">{l.telefone ?? "—"}</TableCell>
                    <TableCell className="py-2 font-mono text-xs">{documentoMascarado(l) ?? "—"}</TableCell>
                    <TableCell className="py-2">
                      {l.ativo ? (
                        <Etiqueta tom="sucesso" icone={CheckCircle2}>
                          Ativo
                        </Etiqueta>
                      ) : (
                        <Etiqueta tom="neutro" icone={CircleOff}>
                          Inativo
                        </Etiqueta>
                      )}
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

      {detalhe && (
        <DetalheLeitor
          leitor={detalhe}
          onFechar={() => setDetalhe(null)}
          onEditar={() => setModo({ tipo: "editar", leitor: detalhe })}
          onAcesso={() => setModo({ tipo: "acesso", leitor: detalhe })}
        />
      )}
      {modo?.tipo === "novo" && <FormLeitor onFechar={() => setModo(null)} />}
      {modo?.tipo === "editar" && <FormLeitor leitor={modo.leitor} onFechar={() => setModo(null)} />}
      {modo?.tipo === "acesso" && <FormAcesso leitor={modo.leitor} onFechar={() => setModo(null)} />}
    </div>
  );
}

/* ---------------------------------------------------------------------------
 * Detalhe (abre ao clicar na linha)
 * ------------------------------------------------------------------------- */

function DetalheLeitor({
  leitor,
  onFechar,
  onEditar,
  onAcesso,
}: {
  leitor: Leitor;
  onFechar: () => void;
  onEditar: () => void;
  onAcesso: () => void;
}) {
  const queryClient = useQueryClient();
  const [excluir, setExcluir] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const alternarAtivo = useMutation({
    mutationFn: () => api.leitores.atualizar(leitor.id, { ativo: !leitor.ativo }),
    onSuccess: () => {
      toast.success(leitor.ativo ? "Leitor desativado" : "Leitor reativado");
      setErro(null);
      onFechar();
      void queryClient.invalidateQueries({ queryKey: ["leitores"] });
    },
    onError: (e) => setErro(mensagemDoErro(e)),
  });

  const removerLeitor = useMutation({
    mutationFn: () => api.leitores.excluir(leitor.id),
    onSuccess: () => {
      toast.success("Leitor excluído");
      onFechar();
      invalidarCirculacao(queryClient);
      void queryClient.invalidateQueries({ queryKey: ["leitores"] });
    },
    onError: (e) => setErro(mensagemDoErro(e)),
  });

  return (
    <Dialog open onOpenChange={(a) => !a && onFechar()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{leitor.nome}</DialogTitle>
          <DialogDescription>
            {leitor.ativo ? "Leitor ativo" : "Leitor inativo"} · {leitor.possui_acesso ? "possui login" : "sem login"}
          </DialogDescription>
        </DialogHeader>

        <dl className="grid gap-3 text-sm sm:grid-cols-2">
          <div>
            <dt className="text-xs text-muted-foreground">E-mail</dt>
            <dd className="break-all">{leitor.email ?? "—"}</dd>
          </div>
          <div>
            <dt className="text-xs text-muted-foreground">Telefone</dt>
            <dd>{leitor.telefone ?? "—"}</dd>
          </div>
          <div>
            <dt className="text-xs text-muted-foreground">Documento</dt>
            <dd className="font-mono">{documentoMascarado(leitor) ?? "—"}</dd>
          </div>
        </dl>

        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" onClick={onEditar}>
            Editar
          </Button>
          {!leitor.possui_acesso && (
            <Button variant="outline" size="sm" onClick={onAcesso}>
              <KeyRound aria-hidden="true" />
              Criar acesso
            </Button>
          )}
          <Button variant="outline" size="sm" onClick={() => alternarAtivo.mutate()} disabled={alternarAtivo.isPending}>
            {leitor.ativo ? "Desativar" : "Reativar"}
          </Button>
        </div>

        <AlertaErro mensagem={erro} />

        <DialogFooter className="justify-between sm:justify-between">
          <Button variant="ghost" className="text-danger-strong" onClick={() => setExcluir(true)}>
            <Trash2 aria-hidden="true" />
            Excluir leitor
          </Button>
          <Button variant="outline" onClick={onFechar}>
            Fechar
          </Button>
        </DialogFooter>

        <ConfirmarAcao
          aberto={excluir}
          onAbertoChange={setExcluir}
          titulo={`Excluir ${leitor.nome}?`}
          descricao="Leitores com empréstimo em aberto não podem ser excluídos. Quem já teve empréstimos tem os dados pessoais anonimizados e o histórico mantido."
          rotuloConfirmar="Excluir"
          destrutivo
          pendente={removerLeitor.isPending}
          erro={erro}
          onConfirmar={() => removerLeitor.mutate()}
        >
          <span />
        </ConfirmarAcao>
      </DialogContent>
    </Dialog>
  );
}

/* ---------------------------------------------------------------------------
 * Cadastro e edição
 * ------------------------------------------------------------------------- */

const esquemaLeitor = z.object({
  nome: z.string().trim().min(1, "Informe o nome.").max(120, "Use no máximo 120 caracteres."),
  email: z
    .string()
    .trim()
    .refine((v) => !v || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v), "Informe um e-mail válido."),
  telefone: z.string().max(30, "Use no máximo 30 caracteres."),
  // Na edição, deixar em branco mantém o documento atual.
  documento: z.string().refine((v) => !v.trim() || documentoValido(v), "Documento inválido."),
});
type DadosLeitor = z.infer<typeof esquemaLeitor>;

const CAMPOS_LEITOR_API: Record<string, keyof DadosLeitor> = {
  nome: "nome",
  email: "email",
  telefone: "telefone",
  documento: "documento",
};

function FormLeitor({ leitor, onFechar }: { leitor?: Leitor; onFechar: () => void }) {
  const queryClient = useQueryClient();
  const [erroGeral, setErroGeral] = useState<string | null>(null);
  const editando = !!leitor;
  const form = useForm<DadosLeitor>({
    resolver: zodResolver(esquemaLeitor),
    defaultValues: { nome: leitor?.nome ?? "", email: leitor?.email ?? "", telefone: leitor?.telefone ?? "", documento: "" },
  });
  const { errors } = form.formState;

  const salvar = useMutation({
    mutationFn: (d: DadosLeitor) => {
      const base = {
        nome: d.nome.trim(),
        email: d.email.trim() || null,
        telefone: d.telefone.trim() || null,
      };
      if (!editando) return api.leitores.criar({ ...base, documento: d.documento.trim() || null });
      return api.leitores.atualizar(leitor.id, d.documento.trim() ? { ...base, documento: d.documento.trim() } : base);
    },
    onSuccess: () => {
      toast.success(editando ? "Leitor atualizado" : "Leitor cadastrado");
      void queryClient.invalidateQueries({ queryKey: ["leitores"] });
      invalidarCirculacao(queryClient);
      onFechar();
    },
    onError: (e) => setErroGeral(aplicarErrosDaApi(e, form.setError, CAMPOS_LEITOR_API)),
  });

  return (
    <Dialog open onOpenChange={(a) => !a && onFechar()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{editando ? "Editar leitor" : "Novo leitor"}</DialogTitle>
          <DialogDescription>Os campos com * são obrigatórios.</DialogDescription>
        </DialogHeader>
        <form className="space-y-4" onSubmit={form.handleSubmit((d) => salvar.mutate(d))} noValidate>
          <CampoTexto id="leitor-nome" rotulo="Nome" obrigatorio {...form.register("nome")} erro={errors.nome?.message} />
          <div className="grid gap-4 sm:grid-cols-2">
            <CampoTexto id="leitor-email" rotulo="E-mail" type="email" {...form.register("email")} erro={errors.email?.message} />
            <CampoTexto id="leitor-telefone" rotulo="Telefone" type="tel" {...form.register("telefone")} erro={errors.telefone?.message} />
          </div>
          <CampoTexto
            id="leitor-documento"
            rotulo="Documento (CPF, RG ou matrícula)"
            dica={editando ? "Deixe em branco para manter o documento atual." : "Não é exibido por inteiro depois de salvo."}
            autoComplete="off"
            {...form.register("documento")}
            erro={errors.documento?.message}
          />
          <AlertaErro mensagem={erroGeral} />
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onFechar}>
              Cancelar
            </Button>
            <Button type="submit" disabled={salvar.isPending}>
              {salvar.isPending ? "Salvando…" : editando ? "Salvar alterações" : "Cadastrar leitor"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

const esquemaAcesso = z.object({
  email: z
    .string()
    .trim()
    .refine((v) => !v || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v), "Informe um e-mail válido."),
  senha: z.string().min(8, "Use pelo menos 8 caracteres."),
});
type DadosAcesso = z.infer<typeof esquemaAcesso>;

function FormAcesso({ leitor, onFechar }: { leitor: Leitor; onFechar: () => void }) {
  const queryClient = useQueryClient();
  const [erroGeral, setErroGeral] = useState<string | null>(null);
  const form = useForm<DadosAcesso>({
    resolver: zodResolver(esquemaAcesso),
    defaultValues: { email: leitor.email ?? "", senha: "" },
  });
  const { errors } = form.formState;

  const criar = useMutation({
    mutationFn: (d: DadosAcesso) =>
      api.leitores.criarAcesso(leitor.id, { email: d.email.trim() || null, senha: d.senha }),
    onSuccess: () => {
      toast.success("Acesso criado");
      void queryClient.invalidateQueries({ queryKey: ["leitores"] });
      onFechar();
    },
    onError: (e) => setErroGeral(aplicarErrosDaApi(e, form.setError, { email: "email", senha: "senha" })),
  });

  return (
    <Dialog open onOpenChange={(a) => !a && onFechar()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Criar acesso para {leitor.nome}</DialogTitle>
          <DialogDescription>Com o acesso, o leitor consulta o próprio histórico de empréstimos.</DialogDescription>
        </DialogHeader>
        <form className="space-y-4" onSubmit={form.handleSubmit((d) => criar.mutate(d))} noValidate>
          <CampoTexto id="acesso-email" rotulo="E-mail de login" type="email" {...form.register("email")} erro={errors.email?.message} />
          <CampoTexto
            id="acesso-senha"
            rotulo="Senha inicial"
            type="password"
            obrigatorio
            dica="Mínimo de 8 caracteres. Peça ao leitor para trocá-la em 'Meus dados'."
            {...form.register("senha")}
            erro={errors.senha?.message}
          />
          <AlertaErro mensagem={erroGeral} />
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onFechar}>
              Cancelar
            </Button>
            <Button type="submit" disabled={criar.isPending}>
              {criar.isPending ? "Criando…" : "Criar acesso"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
