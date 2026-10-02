"""Formato dos dados de empréstimos e devoluções na API."""

import enum
from datetime import date

from pydantic import BaseModel, Field, model_validator

from app.core.esquemas import Entrada


class SituacaoEmprestimo(enum.StrEnum):
    """Situação calculada de um empréstimo."""

    EM_DIA = "EM_DIA"        # em aberto e dentro do prazo
    ATRASADO = "ATRASADO"    # em aberto e com prazo vencido
    DEVOLVIDO = "DEVOLVIDO"  # encerrado


class FiltroEmprestimo(enum.StrEnum):
    """Filtros aceitos na listagem de empréstimos."""

    EM_ABERTO = "EM_ABERTO"  # todos ainda não devolvidos (em dia + atrasados)
    ATRASADO = "ATRASADO"
    A_VENCER = "A_VENCER"    # vencem nos próximos N dias (configuração)
    DEVOLVIDO = "DEVOLVIDO"


class EmprestimoCriar(Entrada):
    """RF03: leitor + exemplar (por id ou pelo código bipado). A data limite é opcional."""

    leitor_id: int
    exemplar_id: int | None = None
    codigo_exemplar: str | None = Field(None, max_length=30)
    data_prevista: date | None = Field(None, description="Se omitida, usa o prazo padrão da configuração")

    @model_validator(mode="after")
    def _exatamente_um_exemplar(self):
        if (self.exemplar_id is None) == (self.codigo_exemplar is None):
            raise ValueError("Informe exemplar_id ou codigo_exemplar (apenas um dos dois).")
        return self


class DevolucaoCriar(Entrada):
    """RF04: basta o código do exemplar que está sendo devolvido."""

    codigo_exemplar: str = Field(min_length=1, max_length=30)


class EmprestimoSaida(BaseModel):
    id: int
    leitor_id: int
    leitor_nome: str
    exemplar_id: int
    exemplar_codigo: str
    livro_id: int
    livro_titulo: str
    data_saida: date
    data_prevista: date
    data_devolucao: date | None
    situacao: SituacaoEmprestimo
    dias_atraso: int
