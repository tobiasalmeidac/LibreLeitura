/**
 * Cliente HTTP único da LibreLeitura.
 *
 * - Todas as chamadas à API passam por aqui (nenhum `fetch` nos componentes).
 * - O access token fica SOMENTE em memória (variável deste módulo).
 * - O refresh token é um cookie httpOnly: usamos `credentials: "include"` sempre.
 * - Em 401, renovamos a sessão uma vez (POST /auth/refresh) e repetimos a requisição.
 *
 * Os tipos abaixo espelham os schemas do OpenAPI do backend (openapi.json, gerado de app.openapi()).
 * Se o backend mudar, regenere o arquivo e ajuste estes tipos.
 */

/* ----------------------------------------------------------------------------
 * Tipos de domínio (espelham os schemas do backend)
 * ------------------------------------------------------------------------- */

export type Id = number;
export type Papel = "GESTOR" | "LEITOR";
export type StatusDisponibilidade = "DISPONIVEL" | "EMPRESTADO" | "INDISPONIVEL";
export type SituacaoExemplar = "ATIVO" | "EXTRAVIADO" | "BAIXADO";
/** Situação que a API devolve em cada empréstimo. */
export type SituacaoEmprestimo = "EM_DIA" | "ATRASADO" | "DEVOLVIDO";
/** Filtros aceitos em GET /emprestimos e GET /me/emprestimos. */
export type FiltroEmprestimo = "EM_ABERTO" | "ATRASADO" | "A_VENCER" | "DEVOLVIDO";

export interface Usuario {
  id: Id;
  nome: string;
  email: string;
  papel: Papel;
  ativo: boolean;
  criado_em: string;
}

export interface LoginResposta {
  access_token: string;
  token_type: string;
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

/** ExemplarSaida: uma cópia física dentro de um livro. */
export interface Exemplar {
  id: Id;
  codigo: string;
  situacao: SituacaoExemplar;
  disponivel: boolean;
}

/** ExemplarComLivro: resultado de GET /exemplares (busca do balcão). */
export interface ExemplarComLivro extends Exemplar {
  livro_id: Id;
  livro_titulo: string;
}

/** LivroResumo: item das listagens do catálogo e do acervo. */
export interface LivroResumo {
  id: Id;
  titulo: string;
  isbn: string | null;
  editora: string | null;
  ano_publicacao: number | null;
  categoria: Categoria | null;
  autores: Autor[];
  total_exemplares: number;
  exemplares_disponiveis: number;
  status: StatusDisponibilidade;
}

/** LivroDetalhe: LivroResumo + lista de exemplares. */
export interface Livro extends LivroResumo {
  exemplares: Exemplar[];
}

/** EmprestimoSaida. `data_devolucao` nulo = em aberto. */
export interface Emprestimo {
  id: Id;
  leitor_id: Id;
  leitor_nome: string;
  exemplar_id: Id;
  exemplar_codigo: string;
  livro_id: Id;
  livro_titulo: string;
  data_saida: string;
  data_prevista: string;
  data_devolucao: string | null;
  situacao: SituacaoEmprestimo;
  dias_atraso: number;
}

/** LeitorSaida. O documento vem decifrado da API: não exibir em texto puro. */
export interface Leitor {
  id: Id;
  nome: string;
  email: string | null;
  telefone: string | null;
  documento: string | null;
  ativo: boolean;
  possui_acesso: boolean;
  criado_em: string;
}

export interface DadosLeitor {
  nome: string;
  email?: string | null;
  telefone?: string | null;
  documento?: string | null;
}

export interface Configuracao {
  prazo_padrao_dias: number;
  max_emprestimos_por_leitor: number;
  bloquear_leitor_com_atraso: boolean;
  dias_aviso_vencimento: number;
}

/** LivroCriar. */
export interface DadosLivro {
  titulo: string;
  isbn?: string | null;
  editora?: string | null;
  ano_publicacao?: number | null;
  categoria_id?: Id | null;
  autor_ids: Id[];
  quantidade_exemplares?: number;
}

/** ItemPendencia: linha do painel de pendências. */
export interface ItemPendencia {
  emprestimo_id: Id;
  leitor_id: Id;
  leitor_nome: string;
  leitor_email: string | null;
  leitor_telefone: string | null;
  livro_titulo: string;
  exemplar_codigo: string;
  data_saida: string;
  data_prevista: string;
  dias_atraso: number;
  dias_para_vencer: number;
}

/** PainelPendencias: resposta de GET /alertas/pendencias. */
export interface PainelPendencias {
  data_referencia: string;
  dias_aviso: number;
  resumo: { em_aberto: number; atrasados: number; a_vencer: number };
  atrasados: ItemPendencia[];
  a_vencer: ItemPendencia[];
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
 * Endpoints (rotas da seção 6 da especificação; campos conforme openapi.json)
 * ------------------------------------------------------------------------- */

export interface FiltrosLivros {
  busca?: string | undefined;
  categoriaId?: Id | undefined;
  autorId?: Id | undefined;
  somenteDisponiveis?: boolean | undefined;
  limite: number;
  deslocamento: number;
}

export interface FiltrosEmprestimos {
  situacao?: FiltroEmprestimo | undefined;
  leitorId?: Id | undefined;
  limite: number;
  deslocamento: number;
}

const seg = (id: Id) => encodeURIComponent(String(id));

export const api = {
  auth: {
    async login(email: string, senha: string) {
      const r = await requisicao<LoginResposta>("/auth/login", { method: "POST", body: { email, senha }, renovar: false });
      sessao.definirToken(r.access_token);
      return r;
    },
    async logout() {
      try {
        await requisicao<void>("/auth/logout", { method: "POST", renovar: false });
      } finally {
        sessao.limpar();
      }
    },
  },

  usuarios: {
    me: () => requisicao<Usuario>("/usuarios/me"),
    trocarSenha: (senhaAtual: string, novaSenha: string) =>
      requisicao<void>("/usuarios/me/senha", {
        method: "PUT",
        body: { senha_atual: senhaAtual, nova_senha: novaSenha },
      }),
    async listar(limite: number, deslocamento: number) {
      const r = await requisicao<Paginado<Usuario>>("/usuarios", { query: { limite, deslocamento } });
      return r;
    },
    criar: (d: { nome: string; email: string; senha: string }) =>
      requisicao<Usuario>("/usuarios", { method: "POST", body: d }),
    atualizar: (id: Id, d: { nome?: string; email?: string; ativo?: boolean }) =>
      requisicao<Usuario>(`/usuarios/${seg(id)}`, { method: "PATCH", body: d }),
  },

  leitores: {
    listar: (q: string | undefined, limite: number, deslocamento: number, ativo?: boolean) =>
      requisicao<Paginado<Leitor>>("/leitores", { query: { q, ativo, limite, deslocamento } }),
    obter: (id: Id) => requisicao<Leitor>(`/leitores/${seg(id)}`),
    criar: (d: DadosLeitor) => requisicao<Leitor>("/leitores", { method: "POST", body: d }),
    atualizar: (id: Id, d: Partial<DadosLeitor> & { ativo?: boolean }) =>
      requisicao<Leitor>(`/leitores/${seg(id)}`, { method: "PATCH", body: d }),
    excluir: (id: Id) => requisicao<void>(`/leitores/${seg(id)}`, { method: "DELETE" }),
    criarAcesso: (id: Id, d: { email?: string | null; senha: string }) =>
      requisicao<Leitor>(`/leitores/${seg(id)}/acesso`, { method: "POST", body: d }),
  },

  livros: {
    listar: (f: FiltrosLivros) =>
      requisicao<Paginado<LivroResumo>>("/livros", {
        query: {
          q: f.busca,
          categoria_id: f.categoriaId,
          autor_id: f.autorId,
          somente_disponiveis: f.somenteDisponiveis ? true : undefined,
          limite: f.limite,
          deslocamento: f.deslocamento,
        },
      }),
    obter: (id: Id) => requisicao<Livro>(`/livros/${seg(id)}`),
    criar: (d: DadosLivro) => requisicao<Livro>("/livros", { method: "POST", body: d }),
    atualizar: (id: Id, d: Partial<DadosLivro>) => requisicao<Livro>(`/livros/${seg(id)}`, { method: "PATCH", body: d }),
    excluir: (id: Id) => requisicao<void>(`/livros/${seg(id)}`, { method: "DELETE" }),
    adicionarExemplares: (id: Id, quantidade: number) =>
      requisicao<Livro>(`/livros/${seg(id)}/exemplares`, { method: "POST", body: { quantidade } }),
  },

  exemplares: {
    buscar: (q: string, somenteDisponiveis: boolean, signal?: AbortSignal) =>
      requisicao<Paginado<ExemplarComLivro>>("/exemplares", {
        query: { q, somente_disponiveis: somenteDisponiveis ? true : undefined, limite: 10, deslocamento: 0 },
        signal,
      }).then((r) => r.itens),
    atualizar: (id: Id, situacao: SituacaoExemplar) =>
      requisicao<ExemplarComLivro>(`/exemplares/${seg(id)}`, { method: "PATCH", body: { situacao } }),
  },

  categorias: {
    listar: () => requisicao<Categoria[]>("/categorias"),
    criar: (nome: string) => requisicao<Categoria>("/categorias", { method: "POST", body: { nome } }),
    atualizar: (id: Id, nome: string) => requisicao<Categoria>(`/categorias/${seg(id)}`, { method: "PUT", body: { nome } }),
    excluir: (id: Id) => requisicao<void>(`/categorias/${seg(id)}`, { method: "DELETE" }),
  },

  autores: {
    listar: (q: string | undefined, limite: number, deslocamento: number) =>
      requisicao<Paginado<Autor>>("/autores", { query: { q, limite, deslocamento } }),
    criar: (nome: string) => requisicao<Autor>("/autores", { method: "POST", body: { nome } }),
    atualizar: (id: Id, nome: string) => requisicao<Autor>(`/autores/${seg(id)}`, { method: "PUT", body: { nome } }),
    excluir: (id: Id) => requisicao<void>(`/autores/${seg(id)}`, { method: "DELETE" }),
  },

  emprestimos: {
    listar: (f: FiltrosEmprestimos) =>
      requisicao<Paginado<Emprestimo>>("/emprestimos", {
        query: { situacao: f.situacao, leitor_id: f.leitorId, limite: f.limite, deslocamento: f.deslocamento },
      }),
    registrar: (leitorId: Id, exemplarId: Id) =>
      requisicao<Emprestimo>("/emprestimos", { method: "POST", body: { leitor_id: leitorId, exemplar_id: exemplarId } }),
    devolver: (id: Id) => requisicao<Emprestimo>(`/emprestimos/${seg(id)}/devolucao`, { method: "POST" }),
  },

  devolucoes: {
    registrar: (codigoExemplar: string) =>
      requisicao<Emprestimo>("/devolucoes", { method: "POST", body: { codigo_exemplar: codigoExemplar } }),
  },

  alertas: {
    pendencias: () => requisicao<PainelPendencias>("/alertas/pendencias"),
  },

  configuracao: {
    obter: () => requisicao<Configuracao>("/configuracao"),
    atualizar: (d: Partial<Configuracao>) => requisicao<Configuracao>("/configuracao", { method: "PATCH", body: d }),
  },

  me: {
    emprestimos: (f: { situacao?: FiltroEmprestimo | undefined; limite: number; deslocamento: number }) =>
      requisicao<Paginado<Emprestimo>>("/me/emprestimos", {
        query: { situacao: f.situacao, limite: f.limite, deslocamento: f.deslocamento },
      }),
  },
};
