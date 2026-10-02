"""Paginação padrão das listagens (?limite=20&deslocamento=0)."""

from typing import Annotated, Generic, TypeVar

from fastapi import Depends, Query
from pydantic import BaseModel
from sqlalchemy import Select, func, select
from sqlalchemy.orm import Session

T = TypeVar("T")


class Pagina(BaseModel, Generic[T]):
    """Formato de resposta de toda listagem paginada."""

    itens: list[T]
    total: int
    limite: int
    deslocamento: int


class ParametrosPagina:
    """Lê os parâmetros de paginação da URL."""

    def __init__(
        self,
        limite: int = Query(20, ge=1, le=100, description="Itens por página"),
        deslocamento: int = Query(0, ge=0, description="Quantos itens pular"),
    ):
        self.limite = limite
        self.deslocamento = deslocamento


# Atalho para usar nas rotas:  def listar(paginacao: Paginacao): ...
Paginacao = Annotated[ParametrosPagina, Depends()]


def paginar(db: Session, consulta: Select, params: ParametrosPagina, *opcoes) -> tuple[list, int]:
    """Executa a consulta e devolve (itens da página, total de itens sem paginação)."""
    total = db.scalar(select(func.count()).select_from(consulta.order_by(None).subquery()))
    itens = db.scalars(consulta.options(*opcoes).limit(params.limite).offset(params.deslocamento)).all()
    return list(itens), total or 0


def montar_pagina(itens: list, total: int, params: ParametrosPagina) -> Pagina:
    """Monta a resposta paginada a partir dos itens já convertidos em schemas."""
    return Pagina(itens=itens, total=total, limite=params.limite, deslocamento=params.deslocamento)
