"""Dependências usadas pelas rotas: sessão do banco, usuário logado e controle de acesso por papel."""

from typing import Annotated

from fastapi import Depends
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.erros import AcessoNegado, NaoAutorizado
from app.core.seguranca import decodificar_access_token
from app.modules.usuarios.models import Papel, Usuario

# Sessão do banco aberta para a requisição atual
DbSession = Annotated[Session, Depends(get_db)]

# Lê o header "Authorization: Bearer <token>" (auto_error=False: nós mesmos tratamos a ausência)
_bearer = HTTPBearer(auto_error=False)


def get_usuario_atual(
    db: DbSession,
    credenciais: Annotated[HTTPAuthorizationCredentials | None, Depends(_bearer)],
) -> Usuario:
    """Valida o token e devolve o usuário logado (precisa existir e estar ativo)."""
    if credenciais is None:
        raise NaoAutorizado("Token de acesso não informado.")

    payload = decodificar_access_token(credenciais.credentials)
    try:
        usuario_id = int(payload["sub"])
    except (KeyError, ValueError) as erro:
        raise NaoAutorizado("Token inválido.") from erro

    usuario = db.get(Usuario, usuario_id)
    if usuario is None or not usuario.ativo:
        raise NaoAutorizado("Usuário inexistente ou inativo.")
    return usuario


def exigir_gestor(usuario: Annotated[Usuario, Depends(get_usuario_atual)]) -> Usuario:
    """Libera a rota apenas para o papel GESTOR."""
    if usuario.papel != Papel.GESTOR:
        raise AcessoNegado("Apenas gestores podem realizar esta operação.")
    return usuario


# Atalhos para usar nos parâmetros das rotas
UsuarioAtual = Annotated[Usuario, Depends(get_usuario_atual)]
Gestor = Annotated[Usuario, Depends(exigir_gestor)]
