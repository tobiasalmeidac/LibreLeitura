"""Rotas de empréstimo e devolução (gestor) e consulta dos próprios empréstimos (leitor)."""

from fastapi import APIRouter, status

from app.core.dependencias import DbSession, Gestor, UsuarioAtual
from app.core.paginacao import Pagina, Paginacao
from app.modules.circulacao import service
from app.modules.circulacao.schemas import DevolucaoCriar, EmprestimoCriar, EmprestimoSaida, FiltroEmprestimo

router = APIRouter(tags=["Circulação"])


@router.post("/emprestimos", response_model=EmprestimoSaida, status_code=status.HTTP_201_CREATED)
def registrar_emprestimo(dados: EmprestimoCriar, db: DbSession, gestor: Gestor):
    """RF03: último clique do balcão. A data limite é calculada automaticamente se não for enviada."""
    return service.registrar_emprestimo(db, dados, gestor)


@router.get("/emprestimos", response_model=Pagina[EmprestimoSaida])
def listar_emprestimos(
    db: DbSession,
    paginacao: Paginacao,
    _gestor: Gestor,
    situacao: FiltroEmprestimo | None = None,
    leitor_id: int | None = None,
):
    return service.listar_emprestimos(db, paginacao, situacao, leitor_id)


@router.post("/devolucoes", response_model=EmprestimoSaida)
def registrar_devolucao(dados: DevolucaoCriar, db: DbSession, gestor: Gestor):
    """RF04: devolução pelo código do exemplar (bipado ou digitado)."""
    return service.registrar_devolucao(db, gestor, codigo_exemplar=dados.codigo_exemplar)


@router.post("/emprestimos/{emprestimo_id}/devolucao", response_model=EmprestimoSaida)
def devolver_por_id(emprestimo_id: int, db: DbSession, gestor: Gestor):
    """RF04: devolução a partir do painel de pendências (botão na linha do empréstimo)."""
    return service.registrar_devolucao(db, gestor, emprestimo_id=emprestimo_id)


@router.get("/me/emprestimos", response_model=Pagina[EmprestimoSaida])
def meus_emprestimos(db: DbSession, usuario: UsuarioAtual, paginacao: Paginacao, situacao: FiltroEmprestimo | None = None):
    """Empréstimos do leitor logado, com prazos de devolução."""
    return service.meus_emprestimos(db, usuario, paginacao, situacao)
