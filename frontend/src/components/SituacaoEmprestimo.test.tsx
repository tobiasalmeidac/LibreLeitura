import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { emprestimo } from "@/test/fixtures";

import { SituacaoEmprestimo } from "./SituacaoEmprestimo";

describe("SituacaoEmprestimo", () => {
  it("mostra há quantos dias o empréstimo está atrasado", () => {
    render(<SituacaoEmprestimo e={emprestimo} />);
    expect(screen.getByText("Atrasado há 3 dias")).toBeInTheDocument();
  });

  it("mostra devolvido quando já foi devolvido", () => {
    render(<SituacaoEmprestimo e={{ ...emprestimo, situacao: "DEVOLVIDO", data_devolucao: "2026-01-14", dias_atraso: 0 }} />);
    expect(screen.getByText("Devolvido")).toBeInTheDocument();
  });

  it("mostra 'Vence em N dias' quando está em dia e dentro da janela de aviso", () => {
    const hoje = new Date();
    const daqui2 = new Date(hoje.getTime() + 2 * 86_400_000).toISOString().slice(0, 10);
    render(<SituacaoEmprestimo e={{ ...emprestimo, situacao: "EM_DIA", data_prevista: daqui2, dias_atraso: 0 }} diasAviso={3} />);
    expect(screen.getByText(/Vence em/)).toBeInTheDocument();
  });
});
