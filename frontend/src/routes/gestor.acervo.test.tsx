import { fireEvent, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { Route } from "@/routes/gestor.acervo";
import { livroResumo, pagina } from "@/test/fixtures";
import { renderTela } from "@/test/renderTela";

const h = vi.hoisted(() => ({
  livrosListar: vi.fn(),
  livrosCriar: vi.fn(),
  categoriasListar: vi.fn(),
  autoresListar: vi.fn(),
}));

vi.mock("@/lib/api", async (importOriginal) => {
  const real = await importOriginal<typeof import("@/lib/api")>();
  return {
    ...real,
    api: {
      ...real.api,
      livros: { ...real.api.livros, listar: h.livrosListar, criar: h.livrosCriar },
      categorias: { ...real.api.categorias, listar: h.categoriasListar },
      autores: { ...real.api.autores, listar: h.autoresListar },
    },
  };
});
vi.mock("@tanstack/react-router", () => import("@/test/routerMock"));

describe("Acervo", () => {
  beforeEach(() => {
    h.livrosListar.mockReset().mockResolvedValue(pagina([livroResumo]));
    h.livrosCriar.mockReset();
    h.categoriasListar.mockReset().mockResolvedValue([{ id: 1, nome: "Romance" }]);
    h.autoresListar.mockReset().mockResolvedValue(pagina([{ id: 1, nome: "Machado de Assis" }]));
  });

  it("lista os livros com autor, categoria e disponibilidade", async () => {
    renderTela(Route);

    expect(await screen.findByText("Dom Casmurro")).toBeInTheDocument();
    expect(screen.getByText("Machado de Assis")).toBeInTheDocument();
    expect(screen.getByText("2 / 2")).toBeInTheDocument();
  });

  it("não cadastra livro sem título e mostra o erro no campo", async () => {
    renderTela(Route);

    fireEvent.click(await screen.findByRole("button", { name: /Novo livro/ }));
    fireEvent.click(await screen.findByRole("button", { name: "Cadastrar livro" }));

    expect(await screen.findByText("Informe o título.")).toBeInTheDocument();
    expect(h.livrosCriar).not.toHaveBeenCalled();
  });

  it("cadastra um livro com título, quantidade e autor", async () => {
    h.livrosCriar.mockResolvedValue({ ...livroResumo, id: 9, titulo: "Iracema", exemplares: [] });
    renderTela(Route);

    fireEvent.click(await screen.findByRole("button", { name: /Novo livro/ }));
    fireEvent.change(await screen.findByLabelText(/Título/), { target: { value: "Iracema" } });
    fireEvent.click(await screen.findByRole("checkbox"));
    fireEvent.click(screen.getByRole("button", { name: "Cadastrar livro" }));

    await waitFor(() =>
      expect(h.livrosCriar).toHaveBeenCalledWith(
        expect.objectContaining({ titulo: "Iracema", autor_ids: [1], quantidade_exemplares: 1, categoria_id: null }),
      ),
    );
  });
});
