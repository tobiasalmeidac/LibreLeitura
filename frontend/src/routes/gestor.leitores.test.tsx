import { fireEvent, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { Route } from "@/routes/gestor.leitores";
import { leitor, pagina } from "@/test/fixtures";
import { renderTela } from "@/test/renderTela";

const h = vi.hoisted(() => ({ listar: vi.fn(), criar: vi.fn() }));

vi.mock("@/lib/api", async (importOriginal) => {
  const real = await importOriginal<typeof import("@/lib/api")>();
  return { ...real, api: { ...real.api, leitores: { ...real.api.leitores, listar: h.listar, criar: h.criar } } };
});
vi.mock("@tanstack/react-router", () => import("@/test/routerMock"));

// Os rótulos "Nome" e "E-mail" também existem como cabeçalhos da tabela, então buscamos o campo pelo id.
const campo = (id: string) => document.getElementById(id) as HTMLInputElement;

describe("Leitores", () => {
  beforeEach(() => {
    h.listar.mockReset().mockResolvedValue(pagina([leitor]));
    h.criar.mockReset();
  });

  it("lista o leitor com o documento só mascarado", async () => {
    renderTela(Route);

    expect(await screen.findByText("Ana Souza")).toBeInTheDocument();
    expect(screen.getByText("*****678")).toBeInTheDocument();
  });

  it("valida o e-mail antes de enviar o cadastro", async () => {
    renderTela(Route);

    fireEvent.click(await screen.findByRole("button", { name: /Novo leitor/ }));
    await screen.findByRole("button", { name: "Cadastrar leitor" });
    fireEvent.change(campo("leitor-nome"), { target: { value: "Carla" } });
    fireEvent.change(campo("leitor-email"), { target: { value: "carla-sem-arroba" } });
    fireEvent.click(screen.getByRole("button", { name: "Cadastrar leitor" }));

    expect(await screen.findByText("Informe um e-mail válido.")).toBeInTheDocument();
    expect(h.criar).not.toHaveBeenCalled();
  });

  it("rejeita documento inválido", async () => {
    renderTela(Route);

    fireEvent.click(await screen.findByRole("button", { name: /Novo leitor/ }));
    await screen.findByRole("button", { name: "Cadastrar leitor" });
    fireEvent.change(campo("leitor-nome"), { target: { value: "Carla" } });
    fireEvent.change(campo("leitor-documento"), { target: { value: "529.982.247-26" } }); // CPF com dígito errado
    fireEvent.click(screen.getByRole("button", { name: "Cadastrar leitor" }));

    await waitFor(() => expect(screen.getByText("Documento inválido.")).toBeInTheDocument());
    expect(h.criar).not.toHaveBeenCalled();
  });
});
