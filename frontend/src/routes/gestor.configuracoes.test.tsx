import { fireEvent, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { Route } from "@/routes/gestor.configuracoes";
import { configuracao } from "@/test/fixtures";
import { renderTela } from "@/test/renderTela";

const h = vi.hoisted(() => ({ obter: vi.fn(), atualizar: vi.fn() }));

vi.mock("@/lib/api", async (importOriginal) => {
  const real = await importOriginal<typeof import("@/lib/api")>();
  return { ...real, api: { ...real.api, configuracao: { obter: h.obter, atualizar: h.atualizar } } };
});
vi.mock("@tanstack/react-router", () => import("@/test/routerMock"));

describe("Configurações", () => {
  beforeEach(() => {
    h.obter.mockReset().mockResolvedValue(configuracao);
    h.atualizar.mockReset().mockResolvedValue({ ...configuracao, prazo_padrao_dias: 30 });
  });

  it("carrega os valores atuais da API", async () => {
    renderTela(Route);

    expect(await screen.findByLabelText(/Prazo padrão/)).toHaveValue("14");
    expect(screen.getByLabelText(/Máximo de empréstimos/)).toHaveValue("3");
    expect(screen.getByLabelText(/Aviso de vencimento/)).toHaveValue("3");
  });

  it("salva o novo prazo como número", async () => {
    renderTela(Route);

    const prazo = await screen.findByLabelText(/Prazo padrão/);
    fireEvent.change(prazo, { target: { value: "30" } });
    fireEvent.click(screen.getByRole("button", { name: "Salvar configurações" }));

    await waitFor(() =>
      expect(h.atualizar).toHaveBeenCalledWith(
        expect.objectContaining({ prazo_padrao_dias: 30, max_emprestimos_por_leitor: 3, dias_aviso_vencimento: 3 }),
      ),
    );
  });

  it("não envia valores fora da faixa permitida", async () => {
    renderTela(Route);

    const prazo = await screen.findByLabelText(/Prazo padrão/);
    fireEvent.change(prazo, { target: { value: "400" } });
    fireEvent.click(screen.getByRole("button", { name: "Salvar configurações" }));

    expect(await screen.findByText(/O prazo deve estar entre 1 e 365/)).toBeInTheDocument();
    expect(h.atualizar).not.toHaveBeenCalled();
  });
});
