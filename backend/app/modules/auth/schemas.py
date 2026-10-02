"""Formato dos dados de autenticação na API."""

from pydantic import BaseModel, EmailStr, Field

from app.core.esquemas import Entrada
from app.modules.usuarios.schemas import UsuarioSaida


class LoginEntrada(Entrada):
    email: EmailStr
    senha: str = Field(min_length=1, max_length=128)


class TokenSaida(BaseModel):
    """Resposta do login/refresh. O refresh token NÃO vem aqui: ele vai num cookie httpOnly."""

    access_token: str
    token_type: str = "bearer"
    expira_em_segundos: int
    usuario: UsuarioSaida
