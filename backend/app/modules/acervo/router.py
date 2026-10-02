"""Rotas do acervo. Consultas são públicas (RF05); alterações exigem GESTOR."""

from fastapi import APIRouter, Query, status

from app.core.dependencias import DbSession, Gestor
from app.core.paginacao import Pagina, Paginacao
from app.modules.acervo import service
from app.modules.acervo.schemas import (
    AdicionarExemplares,
    AutorEntrada,
    AutorSaida,
    CategoriaEntrada,
    CategoriaSaida,
    ExemplarAtualizar,
    ExemplarComLivro,
    LivroAtualizar,
    LivroCriar,
    LivroDetalhe,
    LivroResumo,
)

livros = APIRouter(prefix="/livros", tags=["Acervo - Livros"])
autores = APIRouter(prefix="/autores", tags=["Acervo - Autores"])
categorias = APIRouter(prefix="/categorias", tags=["Acervo - Categorias"])
exemplares = APIRouter(prefix="/exemplares", tags=["Acervo - Exemplares"])


# --- Livros ---

@livros.get("", response_model=Pagina[LivroResumo])
def buscar_livros(
    db: DbSession,
    paginacao: Paginacao,
    q: str | None = Query(None, description="Trecho do título, ISBN, autor ou categoria"),
    categoria_id: int | None = None,
    autor_id: int | None = None,
    somente_disponiveis: bool = False,
):
    """Catálogo público (não precisa de login)."""
    return service.buscar_livros(db, paginacao, q, categoria_id, autor_id, somente_disponiveis)


@livros.get("/{livro_id}", response_model=LivroDetalhe)
def detalhar_livro(livro_id: int, db: DbSession):
    """Detalhe público do livro, com a situação de cada exemplar."""
    return service.detalhar_livro(db, livro_id)


@livros.post("", response_model=LivroDetalhe, status_code=status.HTTP_201_CREATED)
def criar_livro(dados: LivroCriar, db: DbSession, _gestor: Gestor):
    return service.criar_livro(db, dados)


@livros.patch("/{livro_id}", response_model=LivroDetalhe)
def atualizar_livro(livro_id: int, dados: LivroAtualizar, db: DbSession, _gestor: Gestor):
    return service.atualizar_livro(db, livro_id, dados)


@livros.delete("/{livro_id}", status_code=status.HTTP_204_NO_CONTENT)
def excluir_livro(livro_id: int, db: DbSession, _gestor: Gestor):
    service.excluir_livro(db, livro_id)


@livros.post("/{livro_id}/exemplares", response_model=LivroDetalhe, status_code=status.HTTP_201_CREATED)
def adicionar_exemplares(livro_id: int, dados: AdicionarExemplares, db: DbSession, _gestor: Gestor):
    """Acrescenta novas cópias físicas a um livro já cadastrado."""
    return service.adicionar_exemplares(db, livro_id, dados)


# --- Exemplares ---

@exemplares.get("", response_model=Pagina[ExemplarComLivro])
def listar_exemplares(
    db: DbSession,
    paginacao: Paginacao,
    _gestor: Gestor,
    q: str | None = Query(None, description="Código do exemplar ou trecho do título"),
    somente_disponiveis: bool = False,
):
    """Busca de exemplares para o balcão (código de barras ou título)."""
    return service.listar_exemplares(db, paginacao, q, somente_disponiveis)


@exemplares.patch("/{exemplar_id}", response_model=ExemplarComLivro)
def atualizar_exemplar(exemplar_id: int, dados: ExemplarAtualizar, db: DbSession, _gestor: Gestor):
    return service.atualizar_exemplar(db, exemplar_id, dados)


# --- Autores ---

@autores.get("", response_model=Pagina[AutorSaida])
def listar_autores(db: DbSession, paginacao: Paginacao, q: str | None = None):
    return service.listar_autores(db, paginacao, q)


@autores.post("", response_model=AutorSaida, status_code=status.HTTP_201_CREATED)
def criar_autor(dados: AutorEntrada, db: DbSession, _gestor: Gestor):
    return service.criar_autor(db, dados)


@autores.put("/{autor_id}", response_model=AutorSaida)
def atualizar_autor(autor_id: int, dados: AutorEntrada, db: DbSession, _gestor: Gestor):
    return service.atualizar_autor(db, autor_id, dados)


@autores.delete("/{autor_id}", status_code=status.HTTP_204_NO_CONTENT)
def excluir_autor(autor_id: int, db: DbSession, _gestor: Gestor):
    service.excluir_autor(db, autor_id)


# --- Categorias ---

@categorias.get("", response_model=list[CategoriaSaida])
def listar_categorias(db: DbSession):
    return service.listar_categorias(db)


@categorias.post("", response_model=CategoriaSaida, status_code=status.HTTP_201_CREATED)
def criar_categoria(dados: CategoriaEntrada, db: DbSession, _gestor: Gestor):
    return service.criar_categoria(db, dados)


@categorias.put("/{categoria_id}", response_model=CategoriaSaida)
def atualizar_categoria(categoria_id: int, dados: CategoriaEntrada, db: DbSession, _gestor: Gestor):
    return service.atualizar_categoria(db, categoria_id, dados)


@categorias.delete("/{categoria_id}", status_code=status.HTTP_204_NO_CONTENT)
def excluir_categoria(categoria_id: int, db: DbSession, _gestor: Gestor):
    service.excluir_categoria(db, categoria_id)


# Junta os quatro grupos em um único router, registrado no main.py
router = APIRouter()
for _sub in (livros, exemplares, autores, categorias):
    router.include_router(_sub)
