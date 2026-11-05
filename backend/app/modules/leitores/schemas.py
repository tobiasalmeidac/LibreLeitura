"""Formato dos dados de leitores na API."""

from datetime import datetime
from typing import ClassVar

from pydantic import BaseModel, EmailStr, Field

from app.core.esquemas import Entrada, EntradaParcial


class LeitorCriar(Entrada):
    nome: str = Field(min_length=2, max_length=150)
    email: EmailStr | None = None
    telefone: str | None = Field(None, max_length=30)
    documento: str | None = Field(None, max_length=30, description="Matrícula, CPF ou outro documento")


class LeitorAtualizar(EntradaParcial):
    """Envie apenas os campos que deseja alterar. Para apagar e-mail, telefone ou documento, envie null."""

    CAMPOS_OBRIGATORIOS: ClassVar[tuple[str, ...]] = ("nome", "ativo")

    nome: str | None = Field(None, min_length=2, max_length=150)
    email: EmailStr | None = None
    telefone: str | None = Field(None, max_length=30)
    documento: str | None = Field(None, max_length=30)
    ativo: bool | None = None


class CriarAcessoLeitor(Entrada):
    """Cria o login do leitor. Se o e-mail não for enviado, usa o e-mail do cadastro."""

    email: EmailStr | None = None
    senha: str = Field(min_length=8, max_length=128)


class LeitorSaida(BaseModel):
    id: int
    nome: str
    email: str | None
    telefone: str | None
    documento: str | None  # mascarado (ex.: "*****678"); o valor completo nunca sai da API
    ativo: bool
    possui_acesso: bool    # se o leitor tem login no sistema
    criado_em: datetime
