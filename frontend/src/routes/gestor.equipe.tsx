import { zodResolver } from "@hookform/resolvers/zod";
import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { Plus } from "lucide-react";
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
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { api, type Usuario } from "@/lib/api";
import { aplicarErrosDaApi } from "@/lib/formularios";
import { CheckCircle2, CircleOff } from "lucide-react";

export const Route = createFileRoute("/gestor/equipe")({
  head: () => ({
    meta: [
      { title: "Equipe — LibreLeitura" },
      { name: "description", content: "Contas de gestores (bibliotecários e administradores) do sistema." },
      { property: "og:title", content: "Equipe — LibreLeitura" },
      { property: "og:description", content: "Contas de gestores (bibliotecários e administradores) do sistema." },
    ],
  }),
  component: Equipe,
});

const LIMITE = 20;

function Equipe() {
  const queryClient = useQueryClient();
  const [pagina, setPagina] = useState(0);
  const [novo, setNovo] = useState(false);
  const [alvo, setAlvo] = useState<Usuario | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const deslocamento = pagina * LIMITE;

  const eu = useQuery({ queryKey: ["usuarios", "me"], queryFn: api.usuarios.me });
  const consulta = useQuery({
    queryKey: ["usuarios", "lista", deslocamento],
    queryFn: () => api.usuarios.listar(LIMITE, deslocamento),
    placeholderData: keepPreviousData,
  });

  const alternarAtivo = useMutation({
    mutationFn: (u: Usuario) => api.usuarios.atualizar(u.id, { ativo: !u.ativo }),
    onSuccess: (u) => {
      toast.success(u.ativo ? "Conta reativada" : "Conta desativada");
      setAlvo(null);
      setErro(null);
      void queryClient.invalidateQueries({ queryKey: ["usuarios", "lista"] });
    },
    onError: (e) => setErro(mensagemDoErro(e)),
  });

  return (
    <div className="space-y-6">
      <CabecalhoPagina
        titulo="Equipe"
        descricao="Contas de gestores. Um gestor desativado perde o acesso imediatamente."
        acoes={
          <Button onClick={() => setNovo(true)}>
            <Plus aria-hidden="true" />
            Novo gestor
          </Button>
        }
      />

      {consulta.isPending ? (
        <CarregandoLinhas rotulo="Carregando equipe" />
      ) : consulta.isError ? (
        <EstadoErro erro={consulta.error} onTentarNovamente={() => consulta.refetch()} />
      ) : consulta.data.itens.length === 0 ? (
        <EstadoVazio titulo="Nenhum gestor cadastrado" />
      ) : (
        <>
          <div className="overflow-x-auto rounded-lg border bg-card shadow-card">
            <Table className="text-sm">
              <TableHeader>
                <TableRow>
                  <TableHead>Nome</TableHead>
                  <TableHead>E-mail</TableHead>
                  <TableHead>Situação</TableHead>
                  <TableHead className="text-right">
                    <span className="sr-only">Ações</span>
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {consulta.data.itens.map((u) => {
                  const voce = eu.data?.id === u.id;
                  return (
                    <TableRow key={u.id}>
                      <TableCell className="py-2 font-medium">
                        {u.nome}
                        {voce && <span className="ml-2 text-xs text-muted-foreground">(você)</span>}
                      </TableCell>
                      <TableCell className="py-2">{u.email}</TableCell>
                      <TableCell className="py-2">
                        {u.ativo ? (
                          <Etiqueta tom="sucesso" icone={CheckCircle2}>
                            Ativa
                          </Etiqueta>
                        ) : (
                          <Etiqueta tom="neutro" icone={CircleOff}>
                            Desativada
                          </Etiqueta>
                        )}
                      </TableCell>
                      <TableCell className="py-2 text-right">
                        {!voce && (
                          <Button variant="outline" size="sm" onClick={() => setAlvo(u)}>
                            {u.ativo ? "Desativar" : "Reativar"}
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
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

      <ConfirmarAcao
        aberto={!!alvo}
        onAbertoChange={(a) => !a && setAlvo(null)}
        titulo={alvo?.ativo ? `Desativar ${alvo.nome}?` : `Reativar ${alvo?.nome ?? ""}?`}
        descricao={
          alvo?.ativo
            ? "A pessoa perde o acesso ao sistema imediatamente, mas o histórico de ações é mantido."
            : "A pessoa volta a ter acesso ao sistema com a mesma senha."
        }
        rotuloConfirmar={alvo?.ativo ? "Desativar" : "Reativar"}
        destrutivo={!!alvo?.ativo}
        pendente={alternarAtivo.isPending}
        erro={erro}
        onConfirmar={() => alvo && alternarAtivo.mutate(alvo)}
      >
        <span />
      </ConfirmarAcao>

      {novo && <NovoGestor onFechar={() => setNovo(false)} />}
    </div>
  );
}

const esquema = z.object({
  nome: z.string().trim().min(1, "Informe o nome.").max(120, "Use no máximo 120 caracteres."),
  email: z.string().trim().email("Informe um e-mail válido."),
  senha: z.string().min(8, "Use pelo menos 8 caracteres."),
});
type Dados = z.infer<typeof esquema>;

const CAMPOS_API: Record<string, keyof Dados> = { nome: "nome", email: "email", senha: "senha" };

function NovoGestor({ onFechar }: { onFechar: () => void }) {
  const queryClient = useQueryClient();
  const [erroGeral, setErroGeral] = useState<string | null>(null);
  const form = useForm<Dados>({ resolver: zodResolver(esquema), defaultValues: { nome: "", email: "", senha: "" } });
  const { errors } = form.formState;

  const criar = useMutation({
    mutationFn: (d: Dados) => api.usuarios.criar({ nome: d.nome.trim(), email: d.email.trim(), senha: d.senha }),
    onSuccess: () => {
      toast.success("Gestor cadastrado");
      void queryClient.invalidateQueries({ queryKey: ["usuarios", "lista"] });
      onFechar();
    },
    onError: (e) => setErroGeral(aplicarErrosDaApi(e, form.setError, CAMPOS_API)),
  });

  return (
    <Dialog open onOpenChange={(a) => !a && onFechar()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Novo gestor</DialogTitle>
          <DialogDescription>A pessoa entra com o e-mail e a senha definidos aqui.</DialogDescription>
        </DialogHeader>
        <form className="space-y-4" onSubmit={form.handleSubmit((d) => criar.mutate(d))} noValidate>
          <CampoTexto id="gestor-nome" rotulo="Nome" obrigatorio {...form.register("nome")} erro={errors.nome?.message} />
          <CampoTexto id="gestor-email" rotulo="E-mail" type="email" obrigatorio {...form.register("email")} erro={errors.email?.message} />
          <CampoTexto
            id="gestor-senha"
            rotulo="Senha inicial"
            type="password"
            obrigatorio
            dica="Mínimo de 8 caracteres."
            {...form.register("senha")}
            erro={errors.senha?.message}
          />
          <AlertaErro mensagem={erroGeral} />
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onFechar}>
              Cancelar
            </Button>
            <Button type="submit" disabled={criar.isPending}>
              {criar.isPending ? "Salvando…" : "Cadastrar"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
