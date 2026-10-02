"""Rotas de usuários: dados do próprio usuário e gestão da equipe."""

from fastapi import APIRouter, status

from app.core.dependencias import DbSession, Gestor, UsuarioAtual
from app.core.paginacao import Pagina, Paginacao
from app.modules.usuarios import service
from app.modules.usuarios.schemas import TrocarSenha, UsuarioAtualizar, UsuarioCriar, UsuarioSaida

router = APIRouter(prefix="/usuarios", tags=["Usuários"])


# --- Qualquer usuário logado ---

@router.get("/me", response_model=UsuarioSaida)
def meus_dados(usuario: UsuarioAtual):
    """Dados do usuário logado (o frontend usa para saber o papel e montar o menu)."""
    return usuario


@router.put("/me/senha", status_code=status.HTTP_204_NO_CONTENT)
def trocar_minha_senha(dados: TrocarSenha, db: DbSession, usuario: UsuarioAtual):
    """Troca a própria senha."""
    service.trocar_senha(db, usuario, dados)


# --- Somente gestores: contas da equipe ---

@router.get("", response_model=Pagina[UsuarioSaida])
def listar_gestores(db: DbSession, _gestor: Gestor, paginacao: Paginacao):
    return service.listar_gestores(db, paginacao)


@router.post("", response_model=UsuarioSaida, status_code=status.HTTP_201_CREATED)
def criar_gestor(dados: UsuarioCriar, db: DbSession, _gestor: Gestor):
    """Cadastra outro membro da equipe com papel GESTOR."""
    return service.criar_gestor(db, dados)


@router.patch("/{usuario_id}", response_model=UsuarioSaida)
def atualizar_gestor(usuario_id: int, dados: UsuarioAtualizar, db: DbSession, gestor: Gestor):
    """Altera nome, e-mail ou ativa/desativa um gestor."""
    return service.atualizar_gestor(db, usuario_id, dados, gestor)
