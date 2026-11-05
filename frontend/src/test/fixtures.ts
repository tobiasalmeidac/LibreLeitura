import type { Configuracao, Emprestimo, ExemplarComLivro, Leitor, LivroResumo, PainelPendencias, Paginado } from "@/lib/api";

// Dados no formato exato que a API devolve (ver frontend/openapi.json).

export const leitor: Leitor = {
  id: 1,
  nome: "Ana Souza",
  email: "ana@exemplo.com",
  telefone: "11999990000",
  documento: "*****678",
  ativo: true,
  possui_acesso: false,
  criado_em: "2026-01-10T10:00:00",
};

export const exemplarComLivro: ExemplarComLivro = {
  id: 10,
  codigo: "LL000001-001",
  situacao: "ATIVO",
  disponivel: true,
  livro_id: 5,
  livro_titulo: "Dom Casmurro",
};

export const emprestimo: Emprestimo = {
  id: 100,
  leitor_id: 1,
  leitor_nome: "Ana Souza",
  exemplar_id: 10,
  exemplar_codigo: "LL000001-001",
  livro_id: 5,
  livro_titulo: "Dom Casmurro",
  data_saida: "2026-01-01",
  data_prevista: "2026-01-15",
  data_devolucao: null,
  situacao: "ATRASADO",
  dias_atraso: 3,
};

export const painelPendencias: PainelPendencias = {
  data_referencia: "2026-01-18",
  dias_aviso: 3,
  resumo: { em_aberto: 2, atrasados: 1, a_vencer: 1 },
  atrasados: [
    {
      emprestimo_id: 100,
      leitor_id: 1,
      leitor_nome: "Ana Souza",
      leitor_email: "ana@exemplo.com",
      leitor_telefone: "11999990000",
      livro_titulo: "Dom Casmurro",
      exemplar_codigo: "LL000001-001",
      data_saida: "2026-01-01",
      data_prevista: "2026-01-15",
      dias_atraso: 3,
      dias_para_vencer: -3,
    },
  ],
  a_vencer: [
    {
      emprestimo_id: 101,
      leitor_id: 2,
      leitor_nome: "Bruno Lima",
      leitor_email: null,
      leitor_telefone: null,
      livro_titulo: "Memórias Póstumas",
      exemplar_codigo: "LL000002-001",
      data_saida: "2026-01-10",
      data_prevista: "2026-01-20",
      dias_atraso: 0,
      dias_para_vencer: 2,
    },
  ],
};

export const livroResumo: LivroResumo = {
  id: 5,
  titulo: "Dom Casmurro",
  isbn: null,
  editora: "Editora X",
  ano_publicacao: 1899,
  categoria: { id: 1, nome: "Romance" },
  autores: [{ id: 1, nome: "Machado de Assis" }],
  total_exemplares: 2,
  exemplares_disponiveis: 2,
  status: "DISPONIVEL",
};

export const configuracao: Configuracao = {
  prazo_padrao_dias: 14,
  max_emprestimos_por_leitor: 3,
  bloquear_leitor_com_atraso: true,
  dias_aviso_vencimento: 3,
};

export function pagina<T>(itens: T[]): Paginado<T> {
  return { itens, total: itens.length, limite: 20, deslocamento: 0 };
}
