"""Erros de negócio da aplicação e sua conversão em respostas HTTP."""

from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse


class ErroDeNegocio(Exception):
    """Erro esperado (uma regra do sistema). Os services lançam; a API devolve o status_code."""

    status_code = 400

    def __init__(self, mensagem: str):
        super().__init__(mensagem)
        self.mensagem = mensagem


class NaoAutorizado(ErroDeNegocio):
    """Usuário não está logado ou o token é inválido."""

    status_code = 401


class AcessoNegado(ErroDeNegocio):
    """Usuário logado, mas sem permissão (ex.: leitor tentando rota de gestor)."""

    status_code = 403


class NaoEncontrado(ErroDeNegocio):
    """Registro não existe."""

    status_code = 404


class Conflito(ErroDeNegocio):
    """Dado duplicado ou estado incompatível (ex.: exemplar já emprestado)."""

    status_code = 409


class RegraViolada(ErroDeNegocio):
    """Os dados são válidos, mas uma regra de negócio impede a operação."""

    status_code = 422


class MuitasTentativas(ErroDeNegocio):
    """Login bloqueado temporariamente por excesso de tentativas."""

    status_code = 429


def registrar_tratadores_de_erro(app: FastAPI) -> None:
    """Faz todo ErroDeNegocio virar JSON no formato {"detail": "mensagem"}."""

    @app.exception_handler(ErroDeNegocio)
    async def _tratar_erro_de_negocio(_request: Request, erro: ErroDeNegocio) -> JSONResponse:
        return JSONResponse(status_code=erro.status_code, content={"detail": erro.mensagem})
