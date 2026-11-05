import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { api, ApiError, requisicao, sessao } from "./api";

function resposta(status: number, corpo?: unknown) {
  return new Response(corpo === undefined ? null : JSON.stringify(corpo), {
    status,
    headers: { "content-type": "application/json" },
  });
}

describe("cliente da API", () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    vi.stubGlobal("fetch", fetchMock);
    fetchMock.mockReset();
    sessao.limpar();
    sessao.aoExpirar(null);
    localStorage.clear();
    sessionStorage.clear();
  });

  afterEach(() => vi.unstubAllGlobals());

  it("em 401 renova a sessão e repete a requisição original uma vez com o novo token", async () => {
    sessao.definirToken("antigo");
    fetchMock
      .mockResolvedValueOnce(resposta(401, { detail: "Token expirado" }))
      .mockResolvedValueOnce(resposta(200, { access_token: "novo", expira_em_segundos: 900 }))
      .mockResolvedValueOnce(resposta(200, { id: 1, nome: "Ana", email: "a@b.c", papel: "LEITOR" }));

    const eu = await requisicao<{ nome: string }>("/usuarios/me");

    expect(eu.nome).toBe("Ana");
    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(fetchMock.mock.calls[1]?.[0]).toBe("/api/auth/refresh");
    expect(fetchMock.mock.calls[2]?.[1].headers.Authorization).toBe("Bearer novo");
  });

  it("se o refresh falhar, limpa a sessão e avisa 'Sua sessão expirou'", async () => {
    sessao.definirToken("antigo");
    const aoExpirar = vi.fn();
    sessao.aoExpirar(aoExpirar);
    fetchMock
      .mockResolvedValueOnce(resposta(401, { detail: "Token expirado" }))
      .mockResolvedValueOnce(resposta(401, { detail: "Refresh inválido" }));

    await expect(requisicao("/usuarios/me")).rejects.toMatchObject({ status: 401, message: "Sua sessão expirou" });
    expect(aoExpirar).toHaveBeenCalledTimes(1);
    expect(sessao.temToken()).toBe(false);
  });

  it("envia cookies (credentials: include) e nunca grava o token no armazenamento do navegador", async () => {
    fetchMock.mockResolvedValueOnce(
      resposta(200, { access_token: "tok", expira_em_segundos: 900, usuario: { id: 1, papel: "GESTOR" } }),
    );

    await api.auth.login("g@b.c", "segredo");

    expect(fetchMock.mock.calls[0]?.[1].credentials).toBe("include");
    expect(sessao.temToken()).toBe(true);
    expect(localStorage.length).toBe(0);
    expect(sessionStorage.length).toBe(0);
  });

  it("mostra a mensagem da API em 409/422 e associa erros de validação aos campos", async () => {
    sessao.definirToken("tok");
    fetchMock.mockResolvedValueOnce(resposta(409, { detail: "Exemplar já emprestado" }));
    await expect(requisicao("/emprestimos", { method: "POST", body: {} })).rejects.toMatchObject({
      status: 409,
      message: "Exemplar já emprestado",
    });

    fetchMock.mockResolvedValueOnce(
      resposta(422, { detail: [{ loc: ["body", "nova_senha"], msg: "Senha muito curta" }] }),
    );
    const erro = await requisicao<never>("/usuarios/me/senha", { method: "PUT", body: {} }).catch((e: unknown) => e as ApiError);
    expect(erro).toBeInstanceOf(ApiError);
    expect(erro.campos["nova_senha"]).toBe("Senha muito curta");
  });
});
