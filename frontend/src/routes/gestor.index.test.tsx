import { screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { Route } from "@/routes/gestor.index";
import { painelPendencias } from "@/test/fixtures";
import { renderTela } from "@/test/renderTela";

const h = vi.hoisted(() => ({ pendencias: vi.fn() }));

vi.mock("@/lib/api", async (importOriginal) => {
  const real = await importOriginal<typeof import("@/lib/api")>();
  return { ...real, api: { ...real.api, alertas: { pendencias: h.pendencias } } };
});
vi.mock("@tanstack/react-router", () => import("@/test/routerMock"));

describe("Painel de pendências", () => {
  beforeEach(() => h.pendencias.mockReset());

  it("mostra os totais e as listas de atrasados e a vencer", async () => {
    h.pendencias.mockResolvedValue(painelPendencias);
    renderTela(Route);

    const totais = await screen.findByRole("region", { name: "Totais" });
    expect(within(totais).getByText("Atrasados")).toBeInTheDocument();
    expect(within(totais).getByText("Vencem em 3 dias")).toBeInTheDocument();

    const atrasados = screen.getByRole("heading", { name: /Atrasados/ }).closest("section")!;
    expect(within(atrasados).getByText("Ana Souza")).toBeInTheDocument();
    expect(within(atrasados).getByText("Dom Casmurro")).toBeInTheDocument();
    expect(within(atrasados).getByRole("link", { name: "ana@exemplo.com" })).toHaveAttribute("href", "mailto:ana@exemplo.com");
    expect(within(atrasados).getByText("Atrasado há 3 dias")).toBeInTheDocument();

    const aVencer = screen.getByRole("heading", { name: /A vencer/ }).closest("section")!;
    expect(within(aVencer).getByText("Bruno Lima")).toBeInTheDocument();
    expect(within(aVencer).getByText("Faltam 2 dias")).toBeInTheDocument();
  });

  it("mostra estado vazio quando não há pendências", async () => {
    h.pendencias.mockResolvedValue({
      ...painelPendencias,
      resumo: { em_aberto: 0, atrasados: 0, a_vencer: 0 },
      atrasados: [],
      a_vencer: [],
    });
    renderTela(Route);

    expect(await screen.findByText("Nenhum empréstimo atrasado")).toBeInTheDocument();
    expect(screen.getByText("Nenhum empréstimo a vencer")).toBeInTheDocument();
  });
});
