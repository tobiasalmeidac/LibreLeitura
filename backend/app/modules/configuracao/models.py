"""Tabela de configuração da biblioteca (sempre uma única linha, id = 1)."""

from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base

ID_CONFIGURACAO = 1


class Configuracao(Base):
    __tablename__ = "configuracao"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=False)
    prazo_padrao_dias: Mapped[int] = mapped_column(default=14)               # prazo sugerido no empréstimo
    max_emprestimos_por_leitor: Mapped[int] = mapped_column(default=3)       # empréstimos simultâneos
    bloquear_leitor_com_atraso: Mapped[bool] = mapped_column(default=True)   # impede novo empréstimo se atrasado
    dias_aviso_vencimento: Mapped[int] = mapped_column(default=3)            # "prestes a vencer" no painel
