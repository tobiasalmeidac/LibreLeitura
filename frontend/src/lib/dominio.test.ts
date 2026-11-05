import { describe, expect, it } from "vitest";

import { emprestimo, exemplarComLivro, leitor } from "@/test/fixtures";

import {
  diasDeAtraso,
  diasParaVencer,
  documentoMascarado,
  documentoValido,
  isbnValido,
  rotaInicial,
  statusDoExemplar,
  venceEmBreve,
} from "./dominio";

describe("atraso e vencimento", () => {
  it("conta dias de atraso só para empréstimos em aberto", () => {
    expect(diasDeAtraso(emprestimo)).toBe(3);
    expect(diasDeAtraso({ ...emprestimo, data_devolucao: "2026-01-16", situacao: "DEVOLVIDO", dias_atraso: 3 })).toBe(0);
  });

  it("calcula os dias que faltam a partir da data de referência", () => {
    const e = { ...emprestimo, situacao: "EM_DIA" as const, data_prevista: "2026-01-20", dias_atraso: 0 };
    expect(diasParaVencer(e, "2026-01-18")).toBe(2);
  });

  it("marca como 'a vencer' só quem está em dia e dentro da janela de aviso", () => {
    const e = { ...emprestimo, situacao: "EM_DIA" as const, data_prevista: "2026-01-20", dias_atraso: 0 };
    expect(venceEmBreve(e, 3, "2026-01-18")).toBe(true);
    expect(venceEmBreve(e, 1, "2026-01-18")).toBe(false);
    expect(venceEmBreve(emprestimo, 3, "2026-01-18")).toBe(false); // atrasado não é "a vencer"
  });
});

describe("status de exemplar", () => {
  it("usa situação e disponibilidade vindas da API", () => {
    expect(statusDoExemplar(exemplarComLivro)).toBe("DISPONIVEL");
    expect(statusDoExemplar({ ...exemplarComLivro, disponivel: false })).toBe("EMPRESTADO");
    expect(statusDoExemplar({ ...exemplarComLivro, situacao: "EXTRAVIADO" })).toBe("INDISPONIVEL");
  });
});

describe("validações", () => {
  it("aceita ISBN-10 e ISBN-13 válidos e rejeita o resto", () => {
    expect(isbnValido("0-306-40615-2")).toBe(true); // ISBN-10
    expect(isbnValido("978-0-306-40615-7")).toBe(true); // ISBN-13
    expect(isbnValido("978-0-306-40615-8")).toBe(false); // dígito verificador errado
    expect(isbnValido("123")).toBe(false);
  });

  it("aceita CPF válido, outros documentos com 5 a 20 caracteres, e rejeita o resto", () => {
    expect(documentoValido("529.982.247-25")).toBe(true); // CPF válido
    expect(documentoValido("529.982.247-26")).toBe(false); // CPF com dígito errado
    expect(documentoValido("MAT-0001")).toBe(true);
    expect(documentoValido("ab")).toBe(false);
  });

  it("repassa o documento mascarado vindo da API", () => {
    expect(documentoMascarado(leitor)).toBe("*****678");
    expect(documentoMascarado({ documento: null })).toBeNull();
  });
});

describe("rota inicial por papel", () => {
  it("leva o gestor ao painel e o leitor aos seus empréstimos", () => {
    expect(rotaInicial("GESTOR")).toBe("/gestor");
    expect(rotaInicial("LEITOR")).toBe("/meus-emprestimos");
  });
});
