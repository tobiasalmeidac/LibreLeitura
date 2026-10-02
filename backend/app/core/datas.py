"""Funções de data e hora que respeitam o fuso horário da biblioteca."""

from datetime import UTC, date, datetime
from zoneinfo import ZoneInfo

from app.core.config import get_settings


def hoje() -> date:
    """Data de hoje no fuso da biblioteca (os servidores da AWS rodam em UTC)."""
    return datetime.now(ZoneInfo(get_settings().timezone)).date()


def agora_utc() -> datetime:
    """Momento atual em UTC, usado em campos de data e hora (tokens, bloqueios)."""
    return datetime.now(UTC)


def garantir_utc(momento: datetime) -> datetime:
    """Alguns bancos (ex.: o SQLite dos testes) devolvem datas sem fuso; tratamos como UTC."""
    return momento if momento.tzinfo else momento.replace(tzinfo=UTC)
