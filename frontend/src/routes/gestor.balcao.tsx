import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import {
  AlertTriangle,
  BookOpen,
  CheckCircle2,
  CornerDownLeft,
  Loader2,
  ScanBarcode,
  UserRound,
  X,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";

import { Autocomplete } from "@/components/Autocomplete";
import { AlertaErro } from "@/components/Campos";
import { mensagemDoErro } from "@/components/Estados";
import { CabecalhoPagina } from "@/components/layout/LayoutGestor";
import { Etiqueta } from "@/components/StatusBadge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useDebounce } from "@/hooks/use-debounce";
import { api, type Emprestimo, type Exemplar, type Leitor } from "@/lib/api";
import { invalidarCirculacao } from "@/lib/consultas";
import {
  codigoDoEmprestimo,
  diasDeAtraso,
  emprestimosAtivosDoLeitor,
  leitorTemAtraso,
  nomeDoLeitor,
  tituloDoEmprestimo,
  tituloDoExemplar,
} from "@/lib/dominio";
import { formatarData, formatarNumero, pluralDias } from "@/lib/formato";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/gestor/balcao")({
  head: () => ({
    meta: [
      { title: "Balcão — LibreLeitura" },
      { name: "description", content: "Registre empréstimos e devoluções com teclado e leitor de código de barras." },
      { property: "og:title", content: "Balcão — LibreLeitura" },
      { property: "og:description", content: "Registre empréstimos e devoluções com teclado e leitor de código de barras." },
    ],
  }),
  component: Balcao,
});

type Aba = "emprestimo" | "devolucao";

function Balcao() {
  const [aba, setAba] = useState<Aba>("emprestimo");
  const focoEmprestimo = useRef<() => void>(() => {});
  const focoDevolucao = useRef<HTMLInputElement>(null);

  function trocarAba(nova: string) {
    const a = nova as Aba;
    setAba(a);
    setTimeout(() => (a === "devolucao" ? focoDevolucao.current?.focus() : focoEmprestimo.current()), 0);
  }

  return (
    <div className="mx-auto max-w-4xl">
      <CabecalhoPagina titulo="Balcão" descricao="Use o teclado ou o leitor de código de barras. Enter confirma, Esc limpa." />
      <Tabs value={aba} onValueChange={trocarAba}>
        <TabsList className="mb-6 h-11">
          <TabsTrigger value="emprestimo" className="px-5 text-sm">
            Empréstimo
          </TabsTrigger>
          <TabsTrigger value="devolucao" className="px-5 text-sm">
            Devolução
          </TabsTrigger>
        </TabsList>
        <TabsContent value="emprestimo" forceMount className="data-[state=inactive]:hidden">
          <AbaEmprestimo registrarFoco={(f) => (focoEmprestimo.current = f)} />
        </TabsContent>
        <TabsContent value="devolucao" forceMount className="data-[state=inactive]:hidden">
          <AbaDevolucao inputRef={focoDevolucao} ativa={aba === "devolucao"} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

/* ----------------------------------------------------------------------------
 * Empréstimo
 * ------------------------------------------------------------------------- */

function Passo({ numero, titulo, ativo, concluido, children }: { numero: number; titulo: string; ativo: boolean; concluido: boolean; children: React.ReactNode }) {
  return (
    <section
      aria-label={`Passo ${numero}: ${titulo}`}
      className={cn(
        "rounded-lg border bg-card p-5 shadow-card transition-colors",
        ativo && "border-primary/50 ring-2 ring-primary/15",
        !ativo && !concluido && "opacity-60",
      )}
    >
      <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold">
        <span
          className={cn(
            "inline-flex size-6 items-center justify-center rounded-full text-xs tabular",
            concluido ? "bg-success text-primary-foreground" : ativo ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground",
          )}
          aria-hidden="true"
        >
          {concluido ? <CheckCircle2 className="size-4" /> : numero}
        </span>
        {titulo}
      </h2>
      {children}
    </section>
  );
}

function AbaEmprestimo({ registrarFoco }: { registrarFoco: (f: () => void) => void }) {
  const queryClient = useQueryClient();
  const leitorRef = useRef<HTMLInputElement>(null);
  const exemplarRef = useRef<HTMLInputElement>(null);
  const confirmarRef = useRef<HTMLButtonElement>(null);

  const [textoLeitor, setTextoLeitor] = useState("");
  const [leitorSel, setLeitorSel] = useState<Leitor | null>(null);
  const [textoExemplar, setTextoExemplar] = useState("");
  const [exemplar, setExemplar] = useState<Exemplar | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [buscandoCodigo, setBuscandoCodigo] = useState(false);
  const [ultimo, setUltimo] = useState<{ titulo: string; codigo: string; leitor: string; prevista: string } | null>(null);

  const focar = (r: React.RefObject<HTMLElement | null>) => setTimeout(() => r.current?.focus(), 0);

  useEffect(() => {
    registrarFoco(() => (leitorSel ? exemplarRef.current?.focus() : leitorRef.current?.focus()));
  }, [registrarFoco, leitorSel]);

  const buscaLeitor = useDebounce(textoLeitor.trim(), 250);
  const leitores = useQuery({
    queryKey: ["leitores", "busca", buscaLeitor],
    queryFn: ({ signal }) => api.leitores.listar({ busca: buscaLeitor, limite: 8, deslocamento: 0 }, signal),
    enabled: !leitorSel && buscaLeitor.length >= 2,
    staleTime: 30_000,
  });

  // Detalhe atualizado do leitor selecionado (empréstimos ativos, atraso, bloqueio).
  const detalheLeitor = useQuery({
    queryKey: ["leitor", leitorSel?.id],
    queryFn: () => api.leitores.obter(leitorSel!.id),
    enabled: !!leitorSel,
  });
  const leitor = leitorSel ? { ...leitorSel, ...(detalheLeitor.data ?? {}) } : null;
  const bloqueado = !!leitor?.bloqueado;

  const buscaExemplar = useDebounce(textoExemplar.trim(), 200);
  const exemplares = useQuery({
    queryKey: ["exemplares", "busca", buscaExemplar],
    queryFn: ({ signal }) => api.exemplares.buscar(buscaExemplar, true, signal),
    enabled: !!leitorSel && !exemplar && buscaExemplar.length >= 2,
    staleTime: 10_000,
  });

  function selecionarLeitor(l: Leitor) {
    setLeitorSel(l);
    setTextoLeitor(l.nome);
    setErro(null);
    setUltimo(null);
    focar(exemplarRef);
  }

  function limparLeitor() {
    setLeitorSel(null);
    setTextoLeitor("");
    setExemplar(null);
    setTextoExemplar("");
    setErro(null);
    setUltimo(null);
    focar(leitorRef);
  }

  function selecionarExemplar(e: Exemplar) {
    setExemplar(e);
    setTextoExemplar(e.codigo);
    setErro(null);
    focar(confirmarRef);
  }

  function limparExemplar() {
    setExemplar(null);
    setTextoExemplar("");
    setErro(null);
    focar(exemplarRef);
  }

  /** Enter no campo do exemplar: o leitor de código de barras digita o código + Enter. */
  async function aoEnterExemplar(texto: string, destacada: Exemplar | undefined) {
    const codigo = texto.trim();
    if (!codigo) return;
    const igual = (e: Exemplar) => e.codigo.toLowerCase() === codigo.toLowerCase();
    const jaCarregado = (exemplares.data ?? []).find(igual);
    if (jaCarregado) return selecionarExemplar(jaCarregado);
    if (destacada && buscaExemplar === codigo) return selecionarExemplar(destacada);

    setBuscandoCodigo(true);
    try {
      const lista = await queryClient.fetchQuery({
        queryKey: ["exemplares", "busca", codigo],
        queryFn: ({ signal }) => api.exemplares.buscar(codigo, true, signal),
        staleTime: 10_000,
      });
      const exato = lista.find(igual) ?? (lista.length === 1 ? lista[0] : undefined);
      if (exato) selecionarExemplar(exato);
      else setErro(lista.length === 0 ? `Nenhum exemplar disponível encontrado para “${codigo}”.` : "Mais de um exemplar encontrado. Escolha um na lista.");
    } catch (e) {
      setErro(mensagemDoErro(e));
    } finally {
      setBuscandoCodigo(false);
    }
  }

  const registrar = useMutation({
    mutationFn: () => api.emprestimos.registrar(leitor!.id, exemplar!.id),
    onSuccess: (r: Emprestimo | undefined) => {
      toast.success("Empréstimo registrado");
      setUltimo({
        titulo: r ? tituloDoEmprestimo(r) !== "—" ? tituloDoEmprestimo(r) : tituloDoExemplar(exemplar!) : tituloDoExemplar(exemplar!),
        codigo: exemplar!.codigo,
        leitor: leitor!.nome,
        prevista: r?.data_prevista ?? "",
      });
      setExemplar(null);
      setTextoExemplar("");
      setErro(null);
      invalidarCirculacao(queryClient);
      focar(exemplarRef);
    },
    onError: (e) => {
      setErro(mensagemDoErro(e));
      focar(confirmarRef);
    },
  });

  const ativos = leitor ? emprestimosAtivosDoLeitor(leitor) : undefined;
  const atraso = leitor ? leitorTemAtraso(leitor) : undefined;

  return (
    <div className="space-y-4">
      {/* Passo 1 — Leitor */}
      <Passo numero={1} titulo="Leitor" ativo={!leitor} concluido={!!leitor}>
        {!leitor ? (
          <Autocomplete<Leitor>
            id="balcao-leitor"
            rotulo="Buscar leitor por nome, matrícula ou e-mail"
            valor={textoLeitor}
            onValor={setTextoLeitor}
            opcoes={leitores.data?.itens ?? []}
            chave={(l) => String(l.id)}
            carregando={leitores.isFetching}
            erro={leitores.isError ? mensagemDoErro(leitores.error) : null}
            mensagemVazia={buscaLeitor.length < 2 ? "Digite ao menos 2 caracteres" : "Nenhum leitor encontrado"}
            onSelecionar={selecionarLeitor}
            onEsc={() => setTextoLeitor("")}
            inputRef={leitorRef}
            autoFocus
            inputClassName="h-11 text-base"
            renderOpcao={(l) => (
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate font-medium">{l.nome}</p>
                  <p className="truncate text-xs text-muted-foreground">
                    {[l.matricula, l.email].filter(Boolean).join(" · ") || "—"}
                  </p>
                </div>
                {l.bloqueado && (
                  <Etiqueta tom="perigo" icone={AlertTriangle}>
                    Bloqueado
                  </Etiqueta>
                )}
              </div>
            )}
          />
        ) : (
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="flex items-start gap-3">
              <div className="flex size-10 items-center justify-center rounded-full bg-primary-soft text-primary">
                <UserRound className="size-5" aria-hidden="true" />
              </div>
              <div>
                <p className="text-base font-semibold">{leitor.nome}</p>
                <p className="text-sm text-muted-foreground">{[leitor.matricula, leitor.email].filter(Boolean).join(" · ") || "—"}</p>
                <div className="mt-2 flex flex-wrap gap-2">
                  {ativos !== undefined && (
                    <Etiqueta tom="info" icone={BookOpen}>
                      {formatarNumero(ativos)} {ativos === 1 ? "empréstimo ativo" : "empréstimos ativos"}
                    </Etiqueta>
                  )}
                  {atraso === true && (
                    <Etiqueta tom="perigo" icone={AlertTriangle}>
                      Possui atraso
                    </Etiqueta>
                  )}
                  {atraso === false && (
                    <Etiqueta tom="sucesso" icone={CheckCircle2}>
                      Sem atrasos
                    </Etiqueta>
                  )}
                </div>
              </div>
            </div>
            <Button variant="ghost" size="sm" onClick={limparLeitor}>
              <X aria-hidden="true" />
              Trocar leitor
            </Button>
            {bloqueado && (
              <AlertaErro className="w-full" mensagem={leitor.motivo_bloqueio || "Leitor bloqueado para novos empréstimos."} />
            )}
          </div>
        )}
      </Passo>

      {/* Passo 2 — Exemplar */}
      <Passo numero={2} titulo="Exemplar" ativo={!!leitor && !bloqueado && !exemplar} concluido={!!exemplar}>
        {!exemplar ? (
          <Autocomplete<Exemplar>
            id="balcao-exemplar"
            rotulo="Código do exemplar ou título"
            valor={textoExemplar}
            onValor={(t) => {
              setTextoExemplar(t);
              if (erro) setErro(null);
            }}
            opcoes={exemplares.data ?? []}
            chave={(e) => String(e.id)}
            carregando={exemplares.isFetching || buscandoCodigo}
            erro={exemplares.isError ? mensagemDoErro(exemplares.error) : null}
            mensagemVazia={buscaExemplar.length < 2 ? "Digite ao menos 2 caracteres" : "Nenhum exemplar disponível encontrado"}
            onSelecionar={selecionarExemplar}
            onEnter={aoEnterExemplar}
            onEsc={() => (textoExemplar ? setTextoExemplar("") : limparLeitor())}
            disabled={!leitor || bloqueado}
            inputRef={exemplarRef}
            placeholder="LL000042-001"
            inputClassName="h-11 font-mono text-base"
            dica={
              <span className="inline-flex items-center gap-1">
                <ScanBarcode className="size-3.5" aria-hidden="true" />
                Passe o leitor de código de barras ou digite o código e tecle Enter.
              </span>
            }
            renderOpcao={(e) => (
              <div className="flex items-center gap-3">
                <span className="font-mono text-xs">{e.codigo}</span>
                <span className="truncate">{tituloDoExemplar(e)}</span>
              </div>
            )}
          />
        ) : (
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="font-semibold">{tituloDoExemplar(exemplar)}</p>
              <p className="font-mono text-sm text-muted-foreground">{exemplar.codigo}</p>
            </div>
            <Button variant="ghost" size="sm" onClick={limparExemplar}>
              <X aria-hidden="true" />
              Trocar exemplar
            </Button>
          </div>
        )}
      </Passo>

      {/* Passo 3 — Confirmar */}
      <Passo numero={3} titulo="Confirmar" ativo={!!exemplar} concluido={false}>
        <div className="space-y-3">
          {erro && <AlertaErro mensagem={erro} />}
          <div className="flex flex-wrap items-center gap-3">
            <Button
              ref={confirmarRef}
              size="lg"
              disabled={!leitor || !exemplar || bloqueado || registrar.isPending}
              onClick={() => registrar.mutate()}
              onKeyDown={(e) => {
                if (e.key === "Escape") {
                  e.preventDefault();
                  limparExemplar();
                }
              }}
            >
              {registrar.isPending ? <Loader2 className="animate-spin" aria-hidden="true" /> : <CornerDownLeft aria-hidden="true" />}
              Confirmar empréstimo
            </Button>
            {exemplar && (
              <p className="text-xs text-muted-foreground">Enter confirma · Esc troca o exemplar. A data limite é calculada pelo sistema.</p>
            )}
          </div>
          {ultimo && (
            <div role="status" className="flex items-start gap-2 rounded-md border border-success/30 bg-success-soft px-3 py-2 text-sm text-success-strong">
              <CheckCircle2 className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
              <p>
                Empréstimo registrado: <span className="font-medium">{ultimo.titulo}</span> (<span className="font-mono">{ultimo.codigo}</span>) para{" "}
                {ultimo.leitor}.{" "}
                {ultimo.prevista && (
                  <>
                    Devolução prevista para <span className="font-semibold tabular">{formatarData(ultimo.prevista)}</span>.
                  </>
                )}
              </p>
            </div>
          )}
        </div>
      </Passo>
    </div>
  );
}

/* ----------------------------------------------------------------------------
 * Devolução
 * ------------------------------------------------------------------------- */

interface ResultadoDevolucao {
  titulo: string;
  codigo: string;
  leitor: string;
  atraso: number;
}

function AbaDevolucao({ inputRef, ativa }: { inputRef: React.RefObject<HTMLInputElement | null>; ativa: boolean }) {
  const queryClient = useQueryClient();
  const [codigo, setCodigo] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [resultado, setResultado] = useState<ResultadoDevolucao | null>(null);
  const temporizador = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => () => {
    if (temporizador.current) clearTimeout(temporizador.current);
  }, []);

  const devolver = useMutation({
    mutationFn: (c: string) => api.devolucoes.registrar(c),
    onSuccess: (r, c) => {
      const e = (r ?? {}) as Emprestimo;
      const atraso = e.data_prevista ? diasDeAtraso({ ...e, data_devolucao: null }) : (e.dias_atraso ?? 0);
      setResultado({
        titulo: tituloDoEmprestimo(e),
        codigo: codigoDoEmprestimo(e) !== "—" ? codigoDoEmprestimo(e) : c,
        leitor: nomeDoLeitor(e),
        atraso: e.atrasado && atraso === 0 ? 1 : atraso,
      });
      setErro(null);
      setCodigo("");
      toast.success("Devolução registrada");
      invalidarCirculacao(queryClient);
      if (temporizador.current) clearTimeout(temporizador.current);
      temporizador.current = setTimeout(() => setResultado(null), 8000);
      setTimeout(() => inputRef.current?.focus(), 0);
    },
    onError: (e) => {
      setErro(mensagemDoErro(e));
      setResultado(null);
      setTimeout(() => inputRef.current?.select(), 0);
    },
  });

  function enviar() {
    const c = codigo.trim();
    if (!c || devolver.isPending) return;
    devolver.mutate(c);
  }

  return (
    <section aria-label="Devolução" className="space-y-4 rounded-lg border bg-card p-5 shadow-card">
      <div className="space-y-1.5">
        <Label htmlFor="balcao-devolucao">Código do exemplar</Label>
        <div className="relative">
          <ScanBarcode className="pointer-events-none absolute top-1/2 left-3 size-5 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
          <Input
            ref={inputRef}
            id="balcao-devolucao"
            autoComplete="off"
            spellCheck={false}
            autoFocus={ativa}
            placeholder="LL000042-001"
            value={codigo}
            disabled={devolver.isPending}
            className="h-12 pl-10 font-mono text-lg"
            aria-describedby="balcao-devolucao-dica"
            onChange={(e) => {
              setCodigo(e.target.value);
              if (erro) setErro(null);
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                enviar();
              } else if (e.key === "Escape") {
                e.preventDefault();
                setCodigo("");
                setErro(null);
                setResultado(null);
              }
            }}
          />
          {devolver.isPending && (
            <Loader2 className="absolute top-1/2 right-3 size-5 -translate-y-1/2 animate-spin text-muted-foreground" aria-hidden="true" />
          )}
        </div>
        <p id="balcao-devolucao-dica" className="text-xs text-muted-foreground">
          Passe o leitor de código de barras ou digite o código e tecle Enter. Esc limpa o campo.
        </p>
      </div>

      <div aria-live="polite">
        {erro && <AlertaErro mensagem={erro} />}
        {resultado && (
          <div
            role="status"
            className={cn(
              "rounded-md border px-4 py-3",
              resultado.atraso > 0 ? "border-danger/30 bg-danger-soft text-danger-strong" : "border-success/30 bg-success-soft text-success-strong",
            )}
          >
            <p className="flex items-center gap-2 font-semibold">
              {resultado.atraso > 0 ? <AlertTriangle className="size-4" aria-hidden="true" /> : <CheckCircle2 className="size-4" aria-hidden="true" />}
              Devolução registrada {resultado.atraso > 0 ? `com atraso de ${pluralDias(resultado.atraso)}` : "no prazo"}
            </p>
            <dl className="mt-2 grid gap-x-6 gap-y-1 text-sm sm:grid-cols-3">
              <div>
                <dt className="text-xs opacity-80">Livro</dt>
                <dd className="font-medium">{resultado.titulo}</dd>
              </div>
              <div>
                <dt className="text-xs opacity-80">Exemplar</dt>
                <dd className="font-mono">{resultado.codigo}</dd>
              </div>
              <div>
                <dt className="text-xs opacity-80">Leitor</dt>
                <dd className="font-medium">{resultado.leitor}</dd>
              </div>
            </dl>
          </div>
        )}
      </div>
    </section>
  );
}
