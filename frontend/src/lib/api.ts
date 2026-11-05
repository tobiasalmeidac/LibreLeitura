/**
 * Cliente HTTP único da LibreLeitura.
 *
 * - Todas as chamadas à API passam por aqui (nenhum `fetch` nos componentes).
 * - O access token fica SOMENTE em memória (variável deste módulo).
 * - O refresh token é um cookie httpOnly: usamos `credentials: "include"` sempre.
 * - Em 401, renovamos a sessão uma vez (POST /auth/refresh) e repetimos a requisição.
 *
 * Os formatos dos corpos e das respostas marcados com "CONFIRMAR NO SWAGGER"
 * foram deduzidos da especificação e devem ser conferidos em /api/docs.
 */

/* ----------------------------------------------------------------------------
 * Tipos de domínio
 * ------------------------------------------------------------------------- */

export type Id = number | string;
export type Papel = "GESTOR" | "LEITOR";
export type StatusDisponibilidade = "DISPONIVEL" | "EMPRESTADO" | "INDISPONIVEL";
export type SituacaoExemplar = "ATIVO" | "EXTRAVIADO" | "BAIXADO";

export interface Usuario {
  id: Id;
  nome: string;
  email: string;
  papel: Papel;
  ativo?: boolean;
}

export interface LoginResposta {
  access_token: string;
  expira_em_segundos: number;
  usuario: Usuario;
}

export interface Paginado<T> {
  itens: T[];
  total: number;
  limite: number;
  deslocamento: number;
}

export interface Autor {
  id: Id;
  nome: string;
}

export interface Categoria {
  id: Id;
  nome: string;
}

// CONFIRMAR NO SWAGGER: estrutura de Exemplar.
export interface Exemplar {
  id: Id;
  codigo: string;
  situacao: SituacaoExemplar;
  disponivel?: boolean;
  data_prevista_devolucao?: string | null;
  livro?: { id?: Id; titulo?: string; autores?: Autor[] } | null;
  titulo?: string;
}

// CONFIRMAR NO SWAGGER: estrutura de Livro.
export interface Livro {
  id: Id;
  titulo: string;
  autores?: Autor[];
  editora?: string | null;
  ano?: number | null;
  isbn?: string | null;
  categoria?: Categoria | null;
  status?: StatusDisponibilidade;
  disponibilidade?: StatusDisponibilidade;
  exemplares?: Exemplar[];
  proxima_devolucao_prevista?: string | null;
}

// CONFIRMAR NO SWAGGER: estrutura de Empréstimo.
export interface Emprestimo {
  id: Id;
  data_retirada: string;
  data_prevista: string;
  data_devolucao?: string | null;
  exemplar?: { id?: Id; codigo?: string; livro?: { id?: Id; titulo?: string } };
  livro?: { id?: Id; titulo?: string };
  codigo_exemplar?: string;
  titulo?: string;
  dias_atraso?: number;
  dias_para_vencer?: number;
  atrasado?: boolean;
  situacao?: SituacaoEmprestimo;
  leitor?: { id?: Id; nome?: string; email?: string | null; telefone?: string | null } | null;
  leitor_nome?: string;
}

export type SituacaoEmprestimo = "EM_ABERTO" | "ATRASADO" | "A_VENCER" | "DEVOLVIDO";

// CONFIRMAR NO SWAGGER: estrutura de Leitor. O documento nunca é exibido em texto puro.
export interface Leitor {
  id: Id;
  nome: string;
  email?: string | null;
  telefone?: string | null;
  matricula?: string | null;
  documento?: string | null;
  documento_mascarado?: string | null;
  emprestimos_ativos?: number;
  emprestimos_em_aberto?: number;
  possui_atraso?: boolean;
  tem_atraso?: boolean;
  bloqueado?: boolean;
  motivo_bloqueio?: string | null;
  possui_acesso?: boolean;
  tem_acesso?: boolean;
  usuario_id?: Id | null;
  emprestimos?: Emprestimo[];
}

export interface DadosLeitor {
  nome: string;
  email?: string | null;
  telefone?: string | null;
  documento?: string;
}

// CONFIRMAR NO SWAGGER: nomes dos campos de configuração.
export interface Configuracao {
  prazo_padrao_dias: number;
  max_emprestimos_por_leitor: number;
  bloquear_leitor_com_atraso: boolean;
  dias_aviso_vencimento: number;
}

// CONFIRMAR NO SWAGGER: corpo de POST/PATCH /livros.
export interface DadosLivro {
  titulo: string;
  autor_ids: Id[];
  editora: string | null;
  ano: number | null;
  isbn: string | null;
  categoria_id: Id | null;
}

export interface TotalPendencia {
  chave: string;
  rotulo: string;
  valor: number;
}

export interface Pendencias {
  atrasados: Emprestimo[];
  aVencer: Emprestimo[];
  diasAviso: number | null;
  totalAtrasados: number;
  totalAVencer: number;
  outrosTotais: TotalPendencia[];
}

/* ----------------------------------------------------------------------------
 * Erros
 * ------------------------------------------------------------------------- */

export class ApiError extends Error {
  status: number;
  /** Mensagens de validação (422) por nome de campo. */
  campos: Record<string, string>;

  constructor(status: number, message: string, campos: Record<string, string> = {}) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.campos = campos;
  }
}

export const MENSAGEM_SEM_CONEXAO =
  "Não foi possível conectar ao servidor. Verifique sua conexão e tente novamente.";
export const MENSAGEM_SESSAO_EXPIRADA = "Sua sessão expirou";

type ItemValidacao = { loc?: (string | number)[]; msg?: string };

function extrairErro(status: number, corpo: unknown): ApiError {
  const detail = (corpo as { detail?: unknown } | null)?.detail;
  if (typeof detail === "string") return new ApiError(status, detail);
  if (Array.isArray(detail)) {
    const campos: Record<string, string> = {};
    const mensagens: string[] = [];
    for (const item of detail as ItemValidacao[]) {
      const msg = item?.msg ?? "";
      if (msg) mensagens.push(msg);
      const loc = item?.loc ?? [];
      const campo = loc.length ? String(loc[loc.length - 1]) : "";
      if (campo && msg && !(campo in campos)) campos[campo] = msg;
    }
    return new ApiError(status, mensagens.join(" ") || `Erro ${status}`, campos);
  }
  if (typeof corpo === "string" && corpo.trim()) return new ApiError(status, corpo.trim());
  return new ApiError(status, `Erro ${status}`);
}

/* ----------------------------------------------------------------------------
 * Sessão em memória
 * ------------------------------------------------------------------------- */

let accessToken: string | null = null;
let aoExpirar: (() => void) | null = null;
let renovacaoEmAndamento: Promise<boolean> | null = null;

export const sessao = {
  definirToken(token: string | null) {
    accessToken = token;
  },
  temToken() {
    return accessToken !== null;
  },
  limpar() {
    accessToken = null;
  },
  /** Registra quem deve ser avisado quando a sessão expira sem possibilidade de renovação. */
  aoExpirar(callback: (() => void) | null) {
    aoExpirar = callback;
  },
};

const API_BASE = ((import.meta.env["VITE_API_URL"] as string | undefined) || "/api").replace(/\/+$/, "");

type Query = Record<string, string | number | boolean | null | undefined>;

interface Opcoes {
  method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  body?: unknown;
  query?: Query | undefined;
  signal?: AbortSignal | undefined;
  /** false = não tenta renovar a sessão em 401 (login, refresh, logout). */
  renovar?: boolean | undefined;
}

function montarUrl(caminho: string, query?: Query) {
  let url = `${API_BASE}${caminho}`;
  if (query) {
    const params = new URLSearchParams();
    for (const [chave, valor] of Object.entries(query)) {
      if (valor === undefined || valor === null || valor === "") continue;
      params.set(chave, String(valor));
    }
    const qs = params.toString();
    if (qs) url += `?${qs}`;
  }
  return url;
}

async function enviar(caminho: string, opcoes: Opcoes): Promise<Response> {
  const headers: Record<string, string> = { Accept: "application/json" };
  if (opcoes.body !== undefined) headers["Content-Type"] = "application/json";
  if (accessToken) headers["Authorization"] = `Bearer ${accessToken}`;
  try {
    return await fetch(montarUrl(caminho, opcoes.query), {
      method: opcoes.method ?? "GET",
      headers,
      body: opcoes.body !== undefined ? JSON.stringify(opcoes.body) : null,
      credentials: "include",
      signal: opcoes.signal ?? null,
    });
  } catch (erro) {
    if ((erro as Error)?.name === "AbortError") throw erro;
    throw new ApiError(0, MENSAGEM_SEM_CONEXAO);
  }
}

async function lerCorpo(resposta: Response): Promise<unknown> {
  if (resposta.status === 204) return undefined;
  const texto = await resposta.text();
  if (!texto) return undefined;
  try {
    return JSON.parse(texto);
  } catch {
    return texto;
  }
}

/** Renova o access token usando o cookie de refresh. Chamadas simultâneas compartilham a mesma renovação. */
export function renovarSessao(): Promise<boolean> {
  if (!renovacaoEmAndamento) {
    renovacaoEmAndamento = (async () => {
      try {
        const resposta = await enviar("/auth/refresh", { method: "POST", renovar: false });
        if (!resposta.ok) return false;
        const corpo = (await lerCorpo(resposta)) as Partial<LoginResposta> | undefined;
        if (!corpo?.access_token) return false;
        accessToken = corpo.access_token;
        return true;
      } catch {
        return false;
      }
    })().finally(() => {
      renovacaoEmAndamento = null;
    });
  }
  return renovacaoEmAndamento;
}

export async function requisicao<T>(caminho: string, opcoes: Opcoes = {}): Promise<T> {
  const tinhaSessao = accessToken !== null;
  let resposta = await enviar(caminho, opcoes);

  if (resposta.status === 401 && opcoes.renovar !== false && tinhaSessao) {
    const renovou = await renovarSessao();
    if (!renovou) {
      accessToken = null;
      aoExpirar?.();
      throw new ApiError(401, MENSAGEM_SESSAO_EXPIRADA);
    }
    resposta = await enviar(caminho, opcoes);
  }

  const corpo = await lerCorpo(resposta);
  if (!resposta.ok) throw extrairErro(resposta.status, corpo);
  return corpo as T;
}

/* ----------------------------------------------------------------------------
 * Normalização de listas
 * ------------------------------------------------------------------------- */

export function comoPaginado<T>(r: T[] | Paginado<T> | undefined | null, limite: number, deslocamento: number): Paginado<T> {
  if (!r) return { itens: [], total: 0, limite, deslocamento };
  if (Array.isArray(r)) return { itens: r, total: r.length, limite: r.length || limite, deslocamento: 0 };
  return {
    itens: r.itens ?? [],
    total: r.total ?? r.itens?.length ?? 0,
    limite: r.limite ?? limite,
    deslocamento: r.deslocamento ?? deslocamento,
  };
}

export function comoLista<T>(r: T[] | Paginado<T> | undefined | null): T[] {
  if (!r) return [];
  return Array.isArray(r) ? r : (r.itens ?? []);
}

/* ----------------------------------------------------------------------------
 * Pendências: a resposta de GET /alertas/pendencias é normalizada aqui.
 * CONFIRMAR NO SWAGGER: nomes das listas e dos totais.
 * ------------------------------------------------------------------------- */

const ROTULOS_TOTAIS: Record<string, string> = {
  em_aberto: "Em aberto",
  emprestimos_em_aberto: "Empréstimos em aberto",
  total_em_aberto: "Em aberto",
  leitores_com_atraso: "Leitores com atraso",
  leitores_bloqueados: "Leitores bloqueados",
  devolvidos_hoje: "Devolvidos hoje",
  emprestimos_hoje: "Empréstimos hoje",
  exemplares_emprestados: "Exemplares emprestados",
  exemplares_disponiveis: "Exemplares disponíveis",
  total_leitores: "Leitores",
  total_livros: "Livros",
  total_exemplares: "Exemplares",
};

const CHAVES_PRINCIPAIS = new Set([
  "atrasados",
  "a_vencer",
  "vencendo",
  "total_atrasados",
  "total_a_vencer",
  "qtd_atrasados",
  "qtd_a_vencer",
  "dias_aviso",
  "dias_aviso_vencimento",
]);

function rotuloDoTotal(chave: string): string {
  const conhecido = ROTULOS_TOTAIS[chave];
  if (conhecido) return conhecido;
  const texto = chave.replace(/^(total|qtd)_/, "").replace(/_/g, " ");
  return texto.charAt(0).toUpperCase() + texto.slice(1);
}

function numero(v: unknown): number | null {
  return typeof v === "number" && Number.isFinite(v) ? v : null;
}

export function normalizarPendencias(bruto: unknown): Pendencias {
  const r = (bruto ?? {}) as Record<string, unknown>;
  const listaOuTotal = (v: unknown): { lista: Emprestimo[]; total: number | null } => {
    if (Array.isArray(v)) return { lista: v as Emprestimo[], total: null };
    if (v && typeof v === "object" && Array.isArray((v as Paginado<Emprestimo>).itens)) {
      const p = v as Paginado<Emprestimo>;
      return { lista: p.itens, total: numero(p.total) };
    }
    return { lista: [], total: null };
  };
  const atrasados = listaOuTotal(r["atrasados"]);
  const aVencer = listaOuTotal(r["a_vencer"] ?? r["vencendo"]);
  const totais = (r["totais"] && typeof r["totais"] === "object" ? r["totais"] : {}) as Record<string, unknown>;

  const outros: TotalPendencia[] = [];
  for (const fonte of [r, totais]) {
    for (const [chave, valor] of Object.entries(fonte)) {
      const n = numero(valor);
      if (n === null || CHAVES_PRINCIPAIS.has(chave) || chave === "totais") continue;
      if (outros.some((o) => o.chave === chave)) continue;
      outros.push({ chave, rotulo: rotuloDoTotal(chave), valor: n });
    }
  }

  return {
    atrasados: atrasados.lista,
    aVencer: aVencer.lista,
    diasAviso: numero(r["dias_aviso"]) ?? numero(r["dias_aviso_vencimento"]) ?? numero(totais["dias_aviso"]),
    totalAtrasados:
      numero(r["total_atrasados"]) ?? numero(r["qtd_atrasados"]) ?? numero(totais["atrasados"]) ?? atrasados.total ?? atrasados.lista.length,
    totalAVencer:
      numero(r["total_a_vencer"]) ?? numero(r["qtd_a_vencer"]) ?? numero(totais["a_vencer"]) ?? aVencer.total ?? aVencer.lista.length,
    outrosTotais: outros,
  };
}

/* ----------------------------------------------------------------------------
 * Endpoints (somente os da seção 6 da especificação)
 * ------------------------------------------------------------------------- */

export interface FiltrosLivros {
  busca?: string | undefined;
  categoriaId?: string | undefined;
  status?: StatusDisponibilidade | undefined;
  limite: number;
  deslocamento: number;
}

export interface FiltrosEmprestimos {
  situacao?: SituacaoEmprestimo | undefined;
  busca?: string | undefined;
  leitorId?: Id | undefined;
  limite: number;
  deslocamento: number;
}

// CONFIRMAR NO SWAGGER: nomes dos parâmetros de busca/filtro de GET /livros.
const PARAMETROS_LIVROS = { busca: "q", categoria: "categoria_id", status: "status" } as const;
// CONFIRMAR NO SWAGGER: parâmetros de busca de GET /emprestimos.
const PARAMETROS_EMPRESTIMOS = { busca: "q", leitor: "leitor_id" } as const;
// CONFIRMAR NO SWAGGER: nome do campo do código em POST /devolucoes.
const CAMPO_CODIGO_DEVOLUCAO = "codigo_exemplar";

const seg = (id: Id) => encodeURIComponent(String(id));

export const api = {
  auth: {
    async login(email: string, senha: string) {
      const r = await requisicao<LoginResposta>("/auth/login", {
        method: "POST",
        body: { email, senha },
        renovar: false,
      });
      accessToken = r.access_token;
      return r;
    },
    async logout() {
      try {
        await requisicao<void>("/auth/logout", { method: "POST", renovar: false });
      } finally {
        accessToken = null;
      }
    },
  },

  usuarios: {
    me: () => requisicao<Usuario>("/usuarios/me"),
    // CONFIRMAR NO SWAGGER: nomes dos campos do corpo.
    trocarSenha: (senhaAtual: string, novaSenha: string) =>
      requisicao<void>("/usuarios/me/senha", {
        method: "PUT",
        body: { senha_atual: senhaAtual, nova_senha: novaSenha },
      }),
    async listar(limite: number, deslocamento: number) {
      const r = await requisicao<Paginado<Usuario> | Usuario[]>("/usuarios", { query: { limite, deslocamento } });
      return comoPaginado(r, limite, deslocamento);
    },
    // CONFIRMAR NO SWAGGER: corpo de POST /usuarios.
    criar: (d: { nome: string; email: string; senha: string }) =>
      requisicao<Usuario>("/usuarios", { method: "POST", body: { ...d, papel: "GESTOR" } }),
    atualizar: (id: Id, d: { ativo?: boolean; nome?: string }) =>
      requisicao<Usuario>(`/usuarios/${seg(id)}`, { method: "PATCH", body: d }),
  },

  leitores: {
    async listar(f: { busca?: string | undefined; limite: number; deslocamento: number }, signal?: AbortSignal) {
      const r = await requisicao<Paginado<Leitor> | Leitor[]>("/leitores", {
        query: { q: f.busca, limite: f.limite, deslocamento: f.deslocamento },
        signal,
      });
      return comoPaginado(r, f.limite, f.deslocamento);
    },
    obter: (id: Id) => requisicao<Leitor>(`/leitores/${seg(id)}`),
    criar: (d: DadosLeitor) => requisicao<Leitor>("/leitores", { method: "POST", body: d }),
    atualizar: (id: Id, d: Partial<DadosLeitor>) =>
      requisicao<Leitor>(`/leitores/${seg(id)}`, { method: "PATCH", body: d }),
    excluir: (id: Id) => requisicao<{ detail?: string } | undefined>(`/leitores/${seg(id)}`, { method: "DELETE" }),
    // CONFIRMAR NO SWAGGER: corpo de POST /leitores/{id}/acesso.
    criarAcesso: (id: Id, d: { email: string; senha: string }) =>
      requisicao<unknown>(`/leitores/${seg(id)}/acesso`, { method: "POST", body: d }),
  },

  livros: {
    async listar(f: FiltrosLivros) {
      const r = await requisicao<Paginado<Livro> | Livro[]>("/livros", {
        query: {
          [PARAMETROS_LIVROS.busca]: f.busca,
          [PARAMETROS_LIVROS.categoria]: f.categoriaId,
          [PARAMETROS_LIVROS.status]: f.status,
          limite: f.limite,
          deslocamento: f.deslocamento,
        },
      });
      return comoPaginado(r, f.limite, f.deslocamento);
    },
    obter: (id: Id) => requisicao<Livro>(`/livros/${seg(id)}`),
    criar: (d: DadosLivro) => requisicao<Livro>("/livros", { method: "POST", body: d }),
    atualizar: (id: Id, d: Partial<DadosLivro>) => requisicao<Livro>(`/livros/${seg(id)}`, { method: "PATCH", body: d }),
    excluir: (id: Id) => requisicao<void>(`/livros/${seg(id)}`, { method: "DELETE" }),
    // CONFIRMAR NO SWAGGER: corpo de POST /livros/{id}/exemplares.
    adicionarExemplares: (id: Id, quantidade: number) =>
      requisicao<Exemplar[] | unknown>(`/livros/${seg(id)}/exemplares`, { method: "POST", body: { quantidade } }),
  },

  exemplares: {
    async buscar(q: string, somenteDisponiveis: boolean, signal?: AbortSignal) {
      const r = await requisicao<Paginado<Exemplar> | Exemplar[]>("/exemplares", {
        query: { q, somente_disponiveis: somenteDisponiveis ? true : undefined, limite: 10, deslocamento: 0 },
        signal,
      });
      return comoLista(r);
    },
    atualizar: (id: Id, d: { situacao: SituacaoExemplar }) =>
      requisicao<Exemplar>(`/exemplares/${seg(id)}`, { method: "PATCH", body: d }),
  },

  categorias: {
    async listar() {
      return comoLista(await requisicao<Categoria[] | Paginado<Categoria>>("/categorias"));
    },
    criar: (nome: string) => requisicao<Categoria>("/categorias", { method: "POST", body: { nome } }),
    atualizar: (id: Id, nome: string) => requisicao<Categoria>(`/categorias/${seg(id)}`, { method: "PUT", body: { nome } }),
    excluir: (id: Id) => requisicao<void>(`/categorias/${seg(id)}`, { method: "DELETE" }),
  },

  autores: {
    async listar() {
      return comoLista(await requisicao<Autor[] | Paginado<Autor>>("/autores"));
    },
    criar: (nome: string) => requisicao<Autor>("/autores", { method: "POST", body: { nome } }),
    atualizar: (id: Id, nome: string) => requisicao<Autor>(`/autores/${seg(id)}`, { method: "PUT", body: { nome } }),
    excluir: (id: Id) => requisicao<void>(`/autores/${seg(id)}`, { method: "DELETE" }),
  },

  emprestimos: {
    async listar(f: FiltrosEmprestimos) {
      const r = await requisicao<Paginado<Emprestimo> | Emprestimo[]>("/emprestimos", {
        query: {
          situacao: f.situacao,
          [PARAMETROS_EMPRESTIMOS.busca]: f.busca,
          [PARAMETROS_EMPRESTIMOS.leitor]: f.leitorId,
          limite: f.limite,
          deslocamento: f.deslocamento,
        },
      });
      return comoPaginado(r, f.limite, f.deslocamento);
    },
    registrar: (leitorId: Id, exemplarId: Id) =>
      requisicao<Emprestimo>("/emprestimos", { method: "POST", body: { leitor_id: leitorId, exemplar_id: exemplarId } }),
    devolver: (id: Id) => requisicao<Emprestimo>(`/emprestimos/${seg(id)}/devolucao`, { method: "POST" }),
  },

  devolucoes: {
    registrar: (codigo: string) =>
      requisicao<Emprestimo>("/devolucoes", { method: "POST", body: { [CAMPO_CODIGO_DEVOLUCAO]: codigo } }),
  },

  alertas: {
    async pendencias() {
      return normalizarPendencias(await requisicao<unknown>("/alertas/pendencias"));
    },
  },

  configuracao: {
    obter: () => requisicao<Configuracao>("/configuracao"),
    atualizar: (d: Partial<Configuracao>) => requisicao<Configuracao>("/configuracao", { method: "PATCH", body: d }),
  },

  me: {
    async emprestimos(limite: number, deslocamento: number) {
      const r = await requisicao<Paginado<Emprestimo> | Emprestimo[]>("/me/emprestimos", {
        query: { limite, deslocamento },
      });
      return comoPaginado(r, limite, deslocamento);
    },
  },
};
