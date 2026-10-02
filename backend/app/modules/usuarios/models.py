"""Tabela de usuários (quem faz login no sistema)."""

import enum
from datetime import datetime

from sqlalchemy import DateTime, Enum, String, func
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base


class Papel(enum.StrEnum):
    """Perfis de acesso (RF07)."""

    GESTOR = "GESTOR"  # administrador/bibliotecário: opera todo o sistema
    LEITOR = "LEITOR"  # consulta o acervo e os próprios empréstimos


class Usuario(Base):
    __tablename__ = "usuario"

    id: Mapped[int] = mapped_column(primary_key=True)
    nome: Mapped[str] = mapped_column(String(150))
    email: Mapped[str] = mapped_column(String(254), unique=True)  # sempre em minúsculas
    senha_hash: Mapped[str] = mapped_column(String(255))          # hash Argon2id, nunca a senha
    papel: Mapped[Papel] = mapped_column(Enum(Papel, native_enum=False, length=20))
    ativo: Mapped[bool] = mapped_column(default=True)

    # Proteção contra força bruta no login
    tentativas_login_falhas: Mapped[int] = mapped_column(default=0)
    bloqueado_ate: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))

    criado_em: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
