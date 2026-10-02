"""Rotas de autenticação (públicas)."""

from typing import Annotated

from fastapi import APIRouter, Cookie, Response, status

from app.core.config import get_settings
from app.core.dependencias import DbSession
from app.core.erros import NaoAutorizado
from app.modules.auth import service
from app.modules.auth.schemas import LoginEntrada, TokenSaida
from app.modules.usuarios.models import Usuario
from app.modules.usuarios.schemas import UsuarioSaida

router = APIRouter(prefix="/auth", tags=["Autenticação"])

NOME_COOKIE = "libreleitura_refresh"
CAMINHO_COOKIE = "/api/auth"  # o navegador só envia o cookie para as rotas de autenticação

# Tipo do parâmetro que lê o cookie de refresh enviado pelo navegador
CookieRefresh = Annotated[str | None, Cookie(alias=NOME_COOKIE)]


def _responder_com_tokens(resposta: Response, usuario: Usuario, access_token: str, refresh_token: str) -> TokenSaida:
    """Grava o refresh token em cookie httpOnly e devolve o access token no corpo."""
    settings = get_settings()
    resposta.set_cookie(
        key=NOME_COOKIE,
        value=refresh_token,
        max_age=settings.refresh_token_dias * 24 * 60 * 60,
        httponly=True,  # JavaScript não consegue ler (protege contra XSS)
        secure=settings.cookie_secure,  # só trafega em HTTPS
        samesite="strict",  # não é enviado por outros sites (protege contra CSRF)
        path=CAMINHO_COOKIE,
    )
    return TokenSaida(
        access_token=access_token,
        expira_em_segundos=settings.access_token_minutos * 60,
        usuario=UsuarioSaida.model_validate(usuario),
    )


@router.post("/login", response_model=TokenSaida)
def login(dados: LoginEntrada, resposta: Response, db: DbSession):
    """Login de gestores e leitores. Use o access_token no header: Authorization: Bearer <token>."""
    usuario = service.autenticar(db, dados.email, dados.senha)
    access_token, refresh_token = service.emitir_tokens(db, usuario)
    return _responder_com_tokens(resposta, usuario, access_token, refresh_token)


@router.post("/refresh", response_model=TokenSaida)
def refresh(resposta: Response, db: DbSession, refresh_token: CookieRefresh = None):
    """Gera um novo access token a partir do cookie de sessão (chamar quando o token expirar)."""
    if not refresh_token:
        raise NaoAutorizado("Sessão não encontrada. Faça login.")
    usuario, access_token, novo_refresh = service.renovar(db, refresh_token)
    return _responder_com_tokens(resposta, usuario, access_token, novo_refresh)


@router.post("/logout", status_code=status.HTTP_204_NO_CONTENT)
def logout(resposta: Response, db: DbSession, refresh_token: CookieRefresh = None):
    """Encerra a sessão: invalida o refresh token e apaga o cookie."""
    if refresh_token:
        service.revogar(db, refresh_token)
    settings = get_settings()
    resposta.delete_cookie(
        key=NOME_COOKIE,
        path=CAMINHO_COOKIE,
        secure=settings.cookie_secure,
        httponly=True,
        samesite="strict",
    )
