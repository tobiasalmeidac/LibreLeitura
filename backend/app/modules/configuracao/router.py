"""Rotas de configuração (somente gestores)."""

from fastapi import APIRouter

from app.core.dependencias import DbSession, Gestor
from app.modules.configuracao import service
from app.modules.configuracao.schemas import ConfiguracaoAtualizar, ConfiguracaoSaida

router = APIRouter(prefix="/configuracao", tags=["Configuração"])


@router.get("", response_model=ConfiguracaoSaida)
def obter(db: DbSession, _gestor: Gestor):
    """Mostra prazo padrão, limite de empréstimos e regras de bloqueio."""
    return service.obter_configuracao(db)


@router.patch("", response_model=ConfiguracaoSaida)
def atualizar(dados: ConfiguracaoAtualizar, db: DbSession, _gestor: Gestor):
    """Altera as regras de empréstimo da biblioteca."""
    return service.atualizar_configuracao(db, dados)
