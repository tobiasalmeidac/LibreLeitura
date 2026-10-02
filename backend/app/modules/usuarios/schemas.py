"""Formato dos dados de usuários na API."""

from datetime import datetime
from typing import ClassVar

from pydantic import BaseModel, ConfigDict, EmailStr, Field

from app.core.esquemas import Entrada, EntradaParcial
from app.modules.usuarios.models import Papel


class UsuarioCriar(Entrada):
    """Dados para criar um gestor (membro da equipe)."""

    nome: str = Field(min_length=2, max_length=150)
    email: EmailStr
    senha: str = Field(min_length=8, max_length=128)


class UsuarioAtualizar(EntradaParcial):
    """Envie apenas os campos que deseja alterar."""

    CAMPOS_OBRIGATORIOS: ClassVar[tuple[str, ...]] = ("nome", "email", "ativo")

    nome: str | None = Field(None, min_length=2, max_length=150)
    email: EmailStr | None = None
    ativo: bool | None = None


class TrocarSenha(Entrada):
    senha_atual: str = Field(min_length=1, max_length=128)
    nova_senha: str = Field(min_length=8, max_length=128)


class UsuarioSaida(BaseModel):
    """O que a API devolve sobre um usuário (nunca inclui o hash da senha)."""

    model_config = ConfigDict(from_attributes=True)

    id: int
    nome: str
    email: str
    papel: Papel
    ativo: bool
    criado_em: datetime
