import type {
  Emprestimo,
  Exemplar,
  ExemplarComLivro,
  Leitor,
  LivroResumo,
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

export function nomesDosAutores(livro: LivroResumo): string {
  return livro.autores.map((a) => a.nome).join(", ");
}

/** Dias de atraso de um empréstimo (0 se em dia ou devolvido). */
export function diasDeAtraso(e: Emprestimo): number {
  return e.data_devolucao ? 0 : Math.max(0, e.dias_atraso);
}

/** Dias que faltam para a data prevista (negativo = atrasado), a partir da data de hoje em São Paulo. */
export function diasParaVencer(e: Emprestimo, hoje: string = hojeSP()): number {
  return diasEntre(hoje, diaSP(e.data_prevista));
}

export const ROTULO_SITUACAO_EMPRESTIMO: Record<SituacaoEmprestimo, string> = {
  EM_DIA: "Em dia",
  ATRASADO: "Atrasado",
  DEVOLVIDO: "Devolvido",
};

/** Empréstimo em dia que vence dentro da janela de aviso (indicador "a vencer"). */
export function venceEmBreve(e: Emprestimo, diasAviso: number, hoje: string = hojeSP()): boolean {
  return e.situacao === "EM_DIA" && diasParaVencer(e, hoje) <= diasAviso;
}

export function nomeDoLeitor(l: Pick<Leitor, "nome">): string {
  return l.nome;
}

export const tituloDoEmprestimo = (e: Emprestimo): string => e.livro_titulo;
export const codigoDoEmprestimo = (e: Emprestimo): string => e.exemplar_codigo;
export const tituloDoExemplar = (e: ExemplarComLivro): string => e.livro_titulo;

/** Status de exemplar derivado de situacao + disponivel (ambos vêm da API). */
export function statusDoExemplar(e: Exemplar): StatusDisponibilidade {
  if (e.situacao !== "ATIVO") return "INDISPONIVEL";
  return e.disponivel ? "DISPONIVEL" : "EMPRESTADO";
}

/** A API já devolve o documento mascarado (ex.: "*****678"); aqui só repassamos. */
export function documentoMascarado(l: Pick<Leitor, "documento">): string | null {
  return l.documento ?? null;
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
