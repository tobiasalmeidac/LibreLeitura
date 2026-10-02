"""Tabela de empréstimos. Um empréstimo "em aberto" é aquele sem data de devolução."""

from datetime import date, datetime

from sqlalchemy import CheckConstraint, Date, DateTime, ForeignKey, Index, func, text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base


class Emprestimo(Base):
    __tablename__ = "emprestimo"
    __table_args__ = (
        # Garantia no próprio banco: um exemplar só pode ter UM empréstimo em aberto por vez,
        # mesmo que dois bibliotecários cliquem em "emprestar" ao mesmo tempo.
        Index(
            "uq_emprestimo_exemplar_ativo",
            "exemplar_id",
            unique=True,
            postgresql_where=text("data_devolucao IS NULL"),
            sqlite_where=text("data_devolucao IS NULL"),
        ),
        # O prazo de devolução não pode ser anterior à retirada
        CheckConstraint("data_prevista >= data_saida", name="prazo_valido"),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    exemplar_id: Mapped[int] = mapped_column(ForeignKey("exemplar.id", ondelete="RESTRICT"), index=True)
    leitor_id: Mapped[int] = mapped_column(ForeignKey("leitor.id", ondelete="RESTRICT"), index=True)

    data_saida: Mapped[date] = mapped_column(Date)
    data_prevista: Mapped[date] = mapped_column(Date, index=True)
    data_devolucao: Mapped[date | None] = mapped_column(Date)

    # Auditoria: quem registrou a saída e quem recebeu a devolução
    registrado_por_id: Mapped[int] = mapped_column(ForeignKey("usuario.id", ondelete="RESTRICT"))
    recebido_por_id: Mapped[int | None] = mapped_column(ForeignKey("usuario.id", ondelete="RESTRICT"))

    criado_em: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    exemplar: Mapped["Exemplar"] = relationship("Exemplar")  # noqa: F821
    leitor: Mapped["Leitor"] = relationship("Leitor")  # noqa: F821
