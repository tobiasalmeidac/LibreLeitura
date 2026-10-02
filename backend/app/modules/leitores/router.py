"""Rotas de leitores (somente gestores)."""

from fastapi import APIRouter, Depends, Query, status

from app.core.dependencias import DbSession, exigir_gestor
from app.core.paginacao import Pagina, Paginacao
from app.modules.leitores import service
from app.modules.leitores.schemas import CriarAcessoLeitor, LeitorAtualizar, LeitorCriar, LeitorSaida

# dependencies=[...] aplica a exigência de GESTOR em todas as rotas deste arquivo
router = APIRouter(prefix="/leitores", tags=["Leitores"], dependencies=[Depends(exigir_gestor)])


@router.get("", response_model=Pagina[LeitorSaida])
def listar(
    db: DbSession,
    paginacao: Paginacao,
    q: str | None = Query(None, description="Nome, e-mail ou documento completo"),
    ativo: bool | None = None,
):
    """Lista/busca leitores (usado também no autocomplete do balcão de empréstimo)."""
    return service.listar_leitores(db, paginacao, q, ativo)


@router.post("", response_model=LeitorSaida, status_code=status.HTTP_201_CREATED)
def criar(dados: LeitorCriar, db: DbSession):
    return service.para_saida(service.criar_leitor(db, dados))


@router.get("/{leitor_id}", response_model=LeitorSaida)
def obter(leitor_id: int, db: DbSession):
    return service.para_saida(service.obter_leitor(db, leitor_id))


@router.patch("/{leitor_id}", response_model=LeitorSaida)
def atualizar(leitor_id: int, dados: LeitorAtualizar, db: DbSession):
    return service.para_saida(service.atualizar_leitor(db, leitor_id, dados))


@router.delete("/{leitor_id}", status_code=status.HTTP_204_NO_CONTENT)
def excluir(leitor_id: int, db: DbSession):
    """Exclui o leitor. Se ele tiver histórico de empréstimos, os dados pessoais são anonimizados."""
    service.excluir_leitor(db, leitor_id)


@router.post("/{leitor_id}/acesso", response_model=LeitorSaida, status_code=status.HTTP_201_CREATED)
def criar_acesso(leitor_id: int, dados: CriarAcessoLeitor, db: DbSession):
    """Cria o login do leitor (papel LEITOR)."""
    return service.para_saida(service.criar_acesso(db, leitor_id, dados))
