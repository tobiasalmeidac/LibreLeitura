"""Tabela de leitores (pessoas que pegam livros emprestados)."""

from datetime import datetime
from typing import Optional

from sqlalchemy import DateTime, ForeignKey, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base


class Leitor(Base):
    __tablename__ = "leitor"

    id: Mapped[int] = mapped_column(primary_key=True)

    # Login do leitor é opcional: ele pode ser cadastrado no balcão sem acesso ao sistema
    usuario_id: Mapped[int | None] = mapped_column(ForeignKey("usuario.id", ondelete="SET NULL"), unique=True)

    nome: Mapped[str] = mapped_column(String(150), index=True)
    email: Mapped[str | None] = mapped_column(String(254))
    telefone: Mapped[str | None] = mapped_column(String(30))

    # Documento/matrícula: cifrado (para exibir) + HMAC (para buscar e impedir duplicidade)
    documento_cifrado: Mapped[str | None] = mapped_column(Text)
    documento_hmac: Mapped[str | None] = mapped_column(String(64), unique=True)

    ativo: Mapped[bool] = mapped_column(default=True)
    criado_em: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    excluido_em: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))  # exclusão lógica (LGPD)

    usuario: Mapped[Optional["Usuario"]] = relationship("Usuario")  # noqa: F821
