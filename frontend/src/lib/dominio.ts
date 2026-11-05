import type {
  Emprestimo,
  Exemplar,
  Leitor,
  Livro,
  Papel,
  SituacaoEmprestimo,
  SituacaoExemplar,
  StatusDisponibilidade,
} from "./api";
import { diaSP, diasEntre, hojeSP } from "./formato";

export const ROTULO_STATUS: Record<StatusDisponibilidade, string> = {
  DISPONIVEL: "Disponível",
  EMPRESTADO: "Emprestado",
  INDISPONIVEL: "Indisponível",
};

export const ROTULO_SITUACAO_EXEMPLAR: Record<SituacaoExemplar, string> = {
  ATIVO: "Ativo",
  EXTRAVIADO: "Extraviado",
  BAIXADO: "Baixado",
};

export function rotaInicial(papel: Papel): "/gestor" | "/meus-emprestimos" {
  return papel === "GESTOR" ? "/gestor" : "/meus-emprestimos";
}

function exemplarDisponivel(e: Exemplar): boolean {
  return e.situacao === "ATIVO" && e.disponivel !== false;
}

/** Status do livro informado pela API; se ausente, derivado dos exemplares. */
export function statusDoLivro(livro: Livro): StatusDisponibilidade {
  const informado = livro.status ?? livro.disponibilidade;
  if (informado) return informado;
  const ativos = (livro.exemplares ?? []).filter((e) => e.situacao === "ATIVO");
  if (ativos.length === 0) return "INDISPONIVEL";
  return ativos.some(exemplarDisponivel) ? "DISPONIVEL" : "EMPRESTADO";
}

export function statusDoExemplar(e: Exemplar): StatusDisponibilidade {
  if (e.situacao !== "ATIVO") return "INDISPONIVEL";
  return e.disponivel === false ? "EMPRESTADO" : "DISPONIVEL";
}

export function nomesDosAutores(livro: Livro): string {
  return (livro.autores ?? []).map((a) => a.nome).join(", ");
}

export function tituloDoEmprestimo(e: Emprestimo): string {
  return e.exemplar?.livro?.titulo ?? e.livro?.titulo ?? e.titulo ?? "—";
}

export function codigoDoEmprestimo(e: Emprestimo): string {
  return e.exemplar?.codigo ?? e.codigo_exemplar ?? "—";
}

/** Dias de atraso de um empréstimo em aberto (0 se em dia ou devolvido). */
export function diasDeAtraso(e: Emprestimo, hoje: string = hojeSP()): number {
  if (e.data_devolucao) return 0;
  if (typeof e.dias_atraso === "number") return Math.max(0, e.dias_atraso);
  return Math.max(0, diasEntre(diaSP(e.data_prevista), hoje));
}

/** Dias que faltam para a data prevista (negativo = atrasado). */
export function diasParaVencer(e: Emprestimo, hoje: string = hojeSP()): number {
  if (typeof e.dias_para_vencer === "number") return e.dias_para_vencer;
  return diasEntre(hoje, diaSP(e.data_prevista));
}

export const ROTULO_SITUACAO_EMPRESTIMO: Record<SituacaoEmprestimo, string> = {
  EM_ABERTO: "Em aberto",
  ATRASADO: "Atrasado",
  A_VENCER: "A vencer",
  DEVOLVIDO: "Devolvido",
};

/** Situação do empréstimo: usa a informada pela API; se ausente, deriva das datas. */
export function situacaoDoEmprestimo(e: Emprestimo, diasAviso?: number | null, hoje: string = hojeSP()): SituacaoEmprestimo {
  if (e.data_devolucao) return "DEVOLVIDO";
  if (e.atrasado || diasDeAtraso(e, hoje) > 0) return "ATRASADO";
  if (e.situacao === "A_VENCER") return "A_VENCER";
  if (typeof diasAviso === "number" && diasParaVencer(e, hoje) <= diasAviso) return "A_VENCER";
  return e.situacao === "ATRASADO" || e.situacao === "DEVOLVIDO" ? e.situacao : "EM_ABERTO";
}

export function exemplarDoEmprestimoEmAberto(e: Emprestimo): boolean {
  return !e.data_devolucao;
}

export function nomeDoLeitor(e: Emprestimo): string {
  return e.leitor?.nome ?? e.leitor_nome ?? "—";
}

export function tituloDoExemplar(e: Exemplar): string {
  return e.livro?.titulo ?? e.titulo ?? "—";
}

export function emprestimosAtivosDoLeitor(l: Leitor): number | undefined {
  return l.emprestimos_ativos ?? l.emprestimos_em_aberto;
}

export function leitorTemAtraso(l: Leitor): boolean | undefined {
  return l.possui_atraso ?? l.tem_atraso;
}

export function leitorTemAcesso(l: Leitor): boolean | undefined {
  if (typeof l.possui_acesso === "boolean") return l.possui_acesso;
  if (typeof l.tem_acesso === "boolean") return l.tem_acesso;
  if (l.usuario_id !== undefined) return l.usuario_id !== null;
  return undefined;
}

/** O documento só é exibido se a API devolver uma versão mascarada. */
export function documentoMascarado(l: Leitor): string | null {
  if (l.documento_mascarado) return l.documento_mascarado;
  if (l.documento && /[*•xX]{2,}/.test(l.documento)) return l.documento;
  return null;
}

/** Valida ISBN-10 ou ISBN-13 (aceita hífens e espaços). */
export function isbnValido(valor: string): boolean {
  const s = valor.replace(/[\s-]/g, "").toUpperCase();
  if (/^\d{9}[\dX]$/.test(s)) {
    let soma = 0;
    for (let i = 0; i < 10; i++) {
      const c = s[i] ?? "0";
      soma += (c === "X" ? 10 : Number(c)) * (10 - i);
    }
    return soma % 11 === 0;
  }
  if (/^\d{13}$/.test(s)) {
    let soma = 0;
    for (let i = 0; i < 13; i++) soma += Number(s[i]) * (i % 2 === 0 ? 1 : 3);
    return soma % 10 === 0;
  }
  return false;
}

function cpfValido(d: string): boolean {
  if (!/^\d{11}$/.test(d) || /^(\d)\1{10}$/.test(d)) return false;
  const digito = (n: number) => {
    let soma = 0;
    for (let i = 0; i < n; i++) soma += Number(d[i]) * (n + 1 - i);
    const r = (soma * 10) % 11;
    return r === 10 ? 0 : r;
  };
  return digito(9) === Number(d[9]) && digito(10) === Number(d[10]);
}

/**
 * Documento do leitor: se tiver 11 dígitos, é validado como CPF;
 * caso contrário, aceita de 5 a 20 letras/números (RG, matrícula etc.).
 */
export function documentoValido(valor: string): boolean {
  const limpo = valor.replace(/[\s.\-/]/g, "");
  if (/^\d{11}$/.test(limpo)) return cpfValido(limpo);
  return /^[0-9A-Za-z]{5,20}$/.test(limpo);
}

export const ROTULO_SITUACAO_EXEMPLAR_ACAO: Partial<Record<SituacaoExemplar, string>> = {
  EXTRAVIADO: "Marcar como extraviado",
  BAIXADO: "Dar baixa",
};
