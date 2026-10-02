"""Formato dos dados do acervo na API."""

import enum
from typing import Annotated, ClassVar

from pydantic import AfterValidator, BaseModel, ConfigDict, Field

from app.core.esquemas import Entrada, EntradaParcial
from app.modules.acervo.models import SituacaoExemplar


def _normalizar_isbn(valor: str | None) -> str | None:
    """Remove traços/espaços e confere se o ISBN tem 10 ou 13 caracteres válidos."""
    if valor is None:
        return None
    limpo = valor.replace("-", "").replace(" ", "").upper()
    if not limpo:
        return None
    isbn13 = len(limpo) == 13 and limpo.isdigit()
    isbn10 = len(limpo) == 10 and limpo[:9].isdigit() and (limpo[9].isdigit() or limpo[9] == "X")
    if not (isbn10 or isbn13):
        raise ValueError("ISBN deve ter 10 ou 13 dígitos.")
    return limpo


# Tipo reutilizável: um ISBN opcional já validado e normalizado
ISBN = Annotated[str | None, AfterValidator(_normalizar_isbn)]


class StatusLivro(enum.StrEnum):
    """Status exibido no catálogo (RF05)."""

    DISPONIVEL = "DISPONIVEL"      # há pelo menos um exemplar livre
    EMPRESTADO = "EMPRESTADO"      # todos os exemplares ativos estão emprestados
    INDISPONIVEL = "INDISPONIVEL"  # nenhum exemplar ativo (extraviados/baixados)


# --- Autores e categorias ---

class AutorEntrada(Entrada):
    nome: str = Field(min_length=2, max_length=150)


class AutorSaida(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    nome: str


class CategoriaEntrada(Entrada):
    nome: str = Field(min_length=2, max_length=80)


class CategoriaSaida(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    nome: str


# --- Livros ---

class LivroCriar(Entrada):
    """RF01: dados do livro + quantidade de exemplares (cada exemplar recebe um código próprio)."""

    titulo: str = Field(min_length=1, max_length=255)
    isbn: ISBN = None
    editora: str | None = Field(None, max_length=150)
    ano_publicacao: int | None = Field(None, ge=1450, le=2100)
    categoria_id: int | None = None
    autor_ids: list[int] = Field(min_length=1)
    quantidade_exemplares: int = Field(1, ge=1, le=100)


class LivroAtualizar(EntradaParcial):
    """Envie apenas os campos que deseja alterar. Exemplares são gerenciados em rotas próprias."""

    CAMPOS_OBRIGATORIOS: ClassVar[tuple[str, ...]] = ("titulo", "autor_ids")

    titulo: str | None = Field(None, min_length=1, max_length=255)
    isbn: ISBN = None
    editora: str | None = Field(None, max_length=150)
    ano_publicacao: int | None = Field(None, ge=1450, le=2100)
    categoria_id: int | None = None
    autor_ids: list[int] | None = Field(None, min_length=1)


class LivroResumo(BaseModel):
    """Item do catálogo com a disponibilidade calculada."""

    id: int
    titulo: str
    isbn: str | None
    editora: str | None
    ano_publicacao: int | None
    categoria: CategoriaSaida | None
    autores: list[AutorSaida]
    total_exemplares: int        # exemplares ativos (não conta extraviados/baixados)
    exemplares_disponiveis: int  # ativos e sem empréstimo em aberto
    status: StatusLivro


# --- Exemplares ---

class ExemplarSaida(BaseModel):
    id: int
    codigo: str
    situacao: SituacaoExemplar
    disponivel: bool


class LivroDetalhe(LivroResumo):
    exemplares: list[ExemplarSaida]


class ExemplarComLivro(ExemplarSaida):
    """Usado no balcão: ao bipar/buscar um exemplar, mostra de qual livro ele é."""

    livro_id: int
    livro_titulo: str


class AdicionarExemplares(Entrada):
    quantidade: int = Field(ge=1, le=100)


class ExemplarAtualizar(Entrada):
    situacao: SituacaoExemplar
