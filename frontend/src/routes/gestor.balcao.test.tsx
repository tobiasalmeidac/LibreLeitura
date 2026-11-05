import { fireEvent, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { Route } from "@/routes/gestor.balcao";
import { emprestimo, exemplarComLivro, leitor, pagina } from "@/test/fixtures";
import { ApiError } from "@/lib/api";
import { renderTela } from "@/test/renderTela";

const h = vi.hoisted(() => ({
  leitoresListar: vi.fn(),
  leitoresObter: vi.fn(),
  exemplaresBuscar: vi.fn(),
  emprestimosRegistrar: vi.fn(),
  devolucoesRegistrar: vi.fn(),
}));

vi.mock("@/lib/api", async (importOriginal) => {
  const real = await importOriginal<typeof import("@/lib/api")>();
  return {
    ...real,
    api: {
      ...real.api,
      leitores: { listar: h.leitoresListar, obter: h.leitoresObter },
      exemplares: { buscar: h.exemplaresBuscar },
      emprestimos: { registrar: h.emprestimosRegistrar },
      devolucoes: { registrar: h.devolucoesRegistrar },
    },
  };
});
vi.mock("@tanstack/react-router", () => import("@/test/routerMock"));

describe("Balcão", () => {
  beforeEach(() => {
    h.leitoresListar.mockReset().mockResolvedValue(pagina([leitor]));
    h.leitoresObter.mockReset().mockResolvedValue(leitor);
    h.exemplaresBuscar.mockReset().mockResolvedValue([exemplarComLivro]);
    h.emprestimosRegistrar.mockReset().mockResolvedValue(emprestimo);
    h.devolucoesRegistrar.mockReset().mockResolvedValue({ ...emprestimo, data_devolucao: "2026-01-18" });
  });

  it("registra um empréstimo: escolhe o leitor, o exemplar e confirma", async () => {
    renderTela(Route);

    fireEvent.change(screen.getByLabelText(/Buscar leitor/), { target: { value: "Ana" } });
    const opcaoLeitor = await screen.findByRole("option", { name: /Ana Souza/ });
    fireEvent.mouseDown(opcaoLeitor);

    const campoExemplar = await screen.findByLabelText(/Código do exemplar/, { selector: "#balcao-exemplar" });
    await waitFor(() => expect(campoExemplar).not.toBeDisabled());
    fireEvent.change(campoExemplar, { target: { value: "LL000001" } });
    const opcaoExemplar = await screen.findByRole("option", { name: /Dom Casmurro/ });
    fireEvent.mouseDown(opcaoExemplar);

    fireEvent.click(screen.getByRole("button", { name: "Confirmar empréstimo" }));

    await waitFor(() => expect(h.emprestimosRegistrar).toHaveBeenCalledWith(leitor.id, exemplarComLivro.id));
    expect(await screen.findByText(/Empréstimo registrado/)).toBeInTheDocument();
  });

  it("mostra a mensagem da API quando o empréstimo é recusado", async () => {
    h.emprestimosRegistrar.mockImplementation(() => Promise.reject(new ApiError(409, "O exemplar LL000001-001 já está emprestado.")));
    renderTela(Route);

    fireEvent.change(screen.getByLabelText(/Buscar leitor/), { target: { value: "Ana" } });
    fireEvent.mouseDown(await screen.findByRole("option", { name: /Ana Souza/ }));
    const campoExemplar = await screen.findByLabelText(/Código do exemplar/, { selector: "#balcao-exemplar" });
    await waitFor(() => expect(campoExemplar).not.toBeDisabled());
    fireEvent.change(campoExemplar, { target: { value: "LL000001" } });
    fireEvent.mouseDown(await screen.findByRole("option", { name: /Dom Casmurro/ }));

    fireEvent.click(screen.getByRole("button", { name: "Confirmar empréstimo" }));

    expect(await screen.findByText(/já está emprestado/)).toBeInTheDocument();
  });

  it("registra devolução pelo código do exemplar", async () => {
    renderTela(Route);

    fireEvent.mouseDown(screen.getByRole("tab", { name: "Devolução" }));
    fireEvent.click(screen.getByRole("tab", { name: "Devolução" }));
    const campo = await screen.findByLabelText(/Código do exemplar/, { selector: "#balcao-devolucao" });
    fireEvent.change(campo, { target: { value: "LL000001-001" } });
    fireEvent.keyDown(campo, { key: "Enter" });

    await waitFor(() => expect(h.devolucoesRegistrar).toHaveBeenCalledWith("LL000001-001"));
    expect(await screen.findByText(/Devolução registrada/)).toBeInTheDocument();
  });
});
