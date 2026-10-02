"""Formato dos dados de configuração na API."""

from typing import ClassVar

from pydantic import BaseModel, ConfigDict, Field

from app.core.esquemas import EntradaParcial


class ConfiguracaoSaida(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    prazo_padrao_dias: int
    max_emprestimos_por_leitor: int
    bloquear_leitor_com_atraso: bool
    dias_aviso_vencimento: int


class ConfiguracaoAtualizar(EntradaParcial):
    """Envie apenas os campos que deseja alterar."""

    CAMPOS_OBRIGATORIOS: ClassVar[tuple[str, ...]] = (
        "prazo_padrao_dias",
        "max_emprestimos_por_leitor",
        "bloquear_leitor_com_atraso",
        "dias_aviso_vencimento",
    )

    prazo_padrao_dias: int | None = Field(None, ge=1, le=365)
    max_emprestimos_por_leitor: int | None = Field(None, ge=1, le=50)
    bloquear_leitor_com_atraso: bool | None = None
    dias_aviso_vencimento: int | None = Field(None, ge=0, le=30)
