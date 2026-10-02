"""Formato do painel de pendências."""

from datetime import date

from pydantic import BaseModel


class ItemPendencia(BaseModel):
    """Uma linha do painel, com o contato do leitor para cobrança."""

    emprestimo_id: int
    leitor_id: int
    leitor_nome: str
    leitor_email: str | None
    leitor_telefone: str | None
    livro_titulo: str
    exemplar_codigo: str
    data_saida: date
    data_prevista: date
    dias_atraso: int       # > 0 apenas nos atrasados
    dias_para_vencer: int  # > 0 apenas nos que ainda estão no prazo


class ResumoPendencias(BaseModel):
    em_aberto: int
    atrasados: int
    a_vencer: int


class PainelPendencias(BaseModel):
    data_referencia: date  # "hoje" no fuso da biblioteca
    dias_aviso: int
    resumo: ResumoPendencias
    atrasados: list[ItemPendencia]
    a_vencer: list[ItemPendencia]
