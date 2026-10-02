"""Rota do painel de pendências (somente gestores)."""

from fastapi import APIRouter

from app.core.dependencias import DbSession, Gestor
from app.modules.alertas import service
from app.modules.alertas.schemas import PainelPendencias

router = APIRouter(prefix="/alertas", tags=["Alertas"])


@router.get("/pendencias", response_model=PainelPendencias)
def pendencias(db: DbSession, _gestor: Gestor):
    """RF06: empréstimos atrasados e prestes a vencer, com contato do leitor."""
    return service.painel_pendencias(db)
