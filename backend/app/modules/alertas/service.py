"""Monta o painel de pendências do gestor (RF06). Tudo é calculado na hora, sem tarefas agendadas."""

from datetime import date

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.core.datas import hoje
from app.modules.alertas.schemas import ItemPendencia, PainelPendencias, ResumoPendencias
from app.modules.circulacao.models import Emprestimo
from app.modules.circulacao.service import OPCOES_CARREGAMENTO, consulta_a_vencer, consulta_atrasados, em_aberto
from app.modules.configuracao.service import obter_configuracao


def _para_item(emprestimo: Emprestimo, data_hoje: date) -> ItemPendencia:
    diferenca = (emprestimo.data_prevista - data_hoje).days  # negativo = atrasado
    return ItemPendencia(
        emprestimo_id=emprestimo.id,
        leitor_id=emprestimo.leitor_id,
        leitor_nome=emprestimo.leitor.nome,
        leitor_email=emprestimo.leitor.email,
        leitor_telefone=emprestimo.leitor.telefone,
        livro_titulo=emprestimo.exemplar.livro.titulo,
        exemplar_codigo=emprestimo.exemplar.codigo,
        data_saida=emprestimo.data_saida,
        data_prevista=emprestimo.data_prevista,
        dias_atraso=max(0, -diferenca),
        dias_para_vencer=max(0, diferenca),
    )


def painel_pendencias(db: Session) -> PainelPendencias:
    """Lista atrasados e "a vencer" (próximos N dias) com um resumo numérico para os cartões."""
    data_hoje = hoje()
    dias_aviso = obter_configuracao(db).dias_aviso_vencimento

    atrasados = db.scalars(consulta_atrasados(data_hoje).options(*OPCOES_CARREGAMENTO)).all()
    a_vencer = db.scalars(consulta_a_vencer(data_hoje, dias_aviso).options(*OPCOES_CARREGAMENTO)).all()
    total_em_aberto = db.scalar(select(func.count()).select_from(Emprestimo).where(em_aberto()))

    return PainelPendencias(
        data_referencia=data_hoje,
        dias_aviso=dias_aviso,
        resumo=ResumoPendencias(em_aberto=total_em_aberto or 0, atrasados=len(atrasados), a_vencer=len(a_vencer)),
        atrasados=[_para_item(e, data_hoje) for e in atrasados],
        a_vencer=[_para_item(e, data_hoje) for e in a_vencer],
    )
