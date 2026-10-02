"""Tabelas do acervo: autores, categorias, livros (obras) e exemplares (cópias físicas)."""

import enum
from datetime import datetime
from typing import Optional

from sqlalchemy import Column, DateTime, Enum, ForeignKey, Index, String, Table, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base

# Tabela de ligação N:N entre livros e autores
livro_autor = Table(
    "livro_autor",
    Base.metadata,
    Column("livro_id", ForeignKey("livro.id", ondelete="CASCADE"), primary_key=True),
    Column("autor_id", ForeignKey("autor.id", ondelete="RESTRICT"), primary_key=True),
)


class SituacaoExemplar(enum.StrEnum):
    """Situação física do exemplar. Se ele está emprestado ou não é calculado pelos empréstimos."""

    ATIVO = "ATIVO"            # no acervo, pode ser emprestado
    EXTRAVIADO = "EXTRAVIADO"  # perdido
    BAIXADO = "BAIXADO"        # retirado do acervo (danificado, doado...)


class Autor(Base):
    __tablename__ = "autor"
    # Índice de trigramas (só PostgreSQL): acelera a busca por trecho do nome
    __table_args__ = (
        Index("ix_autor_nome_trgm", "nome", postgresql_using="gin", postgresql_ops={"nome": "gin_trgm_ops"}),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    nome: Mapped[str] = mapped_column(String(150), index=True)


class Categoria(Base):
    __tablename__ = "categoria"

    id: Mapped[int] = mapped_column(primary_key=True)
    nome: Mapped[str] = mapped_column(String(80), unique=True)


class Livro(Base):
    """A obra (título). Os exemplares são as cópias físicas que de fato são emprestadas."""

    __tablename__ = "livro"
    __table_args__ = (
        Index("ix_livro_titulo_trgm", "titulo", postgresql_using="gin", postgresql_ops={"titulo": "gin_trgm_ops"}),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    titulo: Mapped[str] = mapped_column(String(255), index=True)
    isbn: Mapped[str | None] = mapped_column(String(13), unique=True)  # só dígitos (10 ou 13)
    editora: Mapped[str | None] = mapped_column(String(150))
    ano_publicacao: Mapped[int | None]
    categoria_id: Mapped[int | None] = mapped_column(ForeignKey("categoria.id", ondelete="RESTRICT"), index=True)
    criado_em: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    categoria: Mapped[Optional["Categoria"]] = relationship("Categoria")
    autores: Mapped[list["Autor"]] = relationship("Autor", secondary=livro_autor)
    exemplares: Mapped[list["Exemplar"]] = relationship(
        "Exemplar", back_populates="livro", cascade="all, delete-orphan"
    )


class Exemplar(Base):
    __tablename__ = "exemplar"

    id: Mapped[int] = mapped_column(primary_key=True)
    livro_id: Mapped[int] = mapped_column(ForeignKey("livro.id", ondelete="CASCADE"), index=True)
    codigo: Mapped[str] = mapped_column(String(30), unique=True)  # código de tombo / etiqueta
    situacao: Mapped[SituacaoExemplar] = mapped_column(
        Enum(SituacaoExemplar, native_enum=False, length=20), default=SituacaoExemplar.ATIVO
    )
    criado_em: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    livro: Mapped["Livro"] = relationship("Livro", back_populates="exemplares")
