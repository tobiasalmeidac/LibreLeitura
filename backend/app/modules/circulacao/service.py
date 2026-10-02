"""Regras de empréstimo (RF03) e devolução (RF04)."""

from datetime import date, timedelta

from sqlalchemy import Select, exists, func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session, joinedload

from app.core.datas import hoje
from app.core.erros import Conflito, NaoEncontrado, RegraViolada
from app.core.paginacao import Pagina, ParametrosPagina, montar_pagina, paginar
from app.modules.acervo.models import Exemplar, SituacaoExemplar
from app.modules.circulacao.models import Emprestimo
from app.modules.circulacao.schemas import EmprestimoCriar, EmprestimoSaida, FiltroEmprestimo, SituacaoEmprestimo
from app.modules.configuracao.service import obter_configuracao
from app.modules.leitores.models import Leitor
from app.modules.usuarios.models import Usuario


# =====================================================================
# Consultas reutilizadas (também pelo módulo de alertas)
# =====================================================================

def em_aberto():
    """Condição SQL: empréstimo ainda não devolvido."""
    return Emprestimo.data_devolucao.is_(None)


def consulta_atrasados(data_hoje: date) -> Select:
    """Empréstimos em aberto com prazo vencido, do mais antigo para o mais recente."""
    return select(Emprestimo).where(em_aberto(), Emprestimo.data_prevista < data_hoje).order_by(Emprestimo.data_prevista)


def consulta_a_vencer(data_hoje: date, dias_aviso: int) -> Select:
    """Empréstimos em aberto que vencem entre hoje e hoje + dias_aviso."""
    limite = data_hoje + timedelta(days=dias_aviso)
    return (
        select(Emprestimo)
        .where(em_aberto(), Emprestimo.data_prevista >= data_hoje, Emprestimo.data_prevista <= limite)
        .order_by(Emprestimo.data_prevista)
    )


# Carrega leitor, exemplar e livro junto com o empréstimo (evita várias consultas)
OPCOES_CARREGAMENTO = (joinedload(Emprestimo.leitor), joinedload(Emprestimo.exemplar).joinedload(Exemplar.livro))


def para_saida(emprestimo: Emprestimo, data_hoje: date) -> EmprestimoSaida:
    """Converte o modelo em resposta, calculando situação e dias de atraso."""
    if emprestimo.data_devolucao is not None:
        situacao = SituacaoEmprestimo.DEVOLVIDO
        dias_atraso = max(0, (emprestimo.data_devolucao - emprestimo.data_prevista).days)
    elif emprestimo.data_prevista < data_hoje:
        situacao = SituacaoEmprestimo.ATRASADO
        dias_atraso = (data_hoje - emprestimo.data_prevista).days
    else:
        situacao = SituacaoEmprestimo.EM_DIA
        dias_atraso = 0

    return EmprestimoSaida(
        id=emprestimo.id,
        leitor_id=emprestimo.leitor_id,
        leitor_nome=emprestimo.leitor.nome,
        exemplar_id=emprestimo.exemplar_id,
        exemplar_codigo=emprestimo.exemplar.codigo,
        livro_id=emprestimo.exemplar.livro_id,
        livro_titulo=emprestimo.exemplar.livro.titulo,
        data_saida=emprestimo.data_saida,
        data_prevista=emprestimo.data_prevista,
        data_devolucao=emprestimo.data_devolucao,
        situacao=situacao,
        dias_atraso=dias_atraso,
    )


# =====================================================================
# Empréstimo (RF03)
# =====================================================================

def _buscar_exemplar(db: Session, exemplar_id: int | None, codigo: str | None) -> Exemplar:
    if exemplar_id is not None:
        exemplar = db.get(Exemplar, exemplar_id)
    else:
        exemplar = db.scalar(select(Exemplar).where(Exemplar.codigo == codigo.strip().upper()))
    if exemplar is None:
        raise NaoEncontrado("Exemplar não encontrado.")
    return exemplar


def registrar_emprestimo(db: Session, dados: EmprestimoCriar, gestor: Usuario) -> EmprestimoSaida:
    """Associa um exemplar disponível a um leitor, validando todas as regras da biblioteca."""
    config = obter_configuracao(db)
    data_hoje = hoje()

    # 1. Leitor precisa existir e estar ativo.
    #    with_for_update trava a linha do leitor até o commit: dois empréstimos simultâneos
    #    para o mesmo leitor não conseguem furar o limite.
    leitor = db.scalar(
        select(Leitor).where(Leitor.id == dados.leitor_id, Leitor.excluido_em.is_(None)).with_for_update()
    )
    if leitor is None:
        raise NaoEncontrado("Leitor não encontrado.")
    if not leitor.ativo:
        raise RegraViolada("Leitor inativo não pode realizar empréstimos.")

    # 2. Exemplar precisa estar ativo e livre
    exemplar = _buscar_exemplar(db, dados.exemplar_id, dados.codigo_exemplar)
    if exemplar.situacao != SituacaoExemplar.ATIVO:
        raise RegraViolada(f"O exemplar {exemplar.codigo} está {exemplar.situacao.value.lower()}.")
    if db.scalar(select(exists().where(Emprestimo.exemplar_id == exemplar.id, em_aberto()))):
        raise Conflito(f"O exemplar {exemplar.codigo} já está emprestado.")

    # 3. Regras do leitor: limite de empréstimos e bloqueio por atraso
    qtd_em_aberto = db.scalar(
        select(func.count()).select_from(Emprestimo).where(Emprestimo.leitor_id == leitor.id, em_aberto())
    )
    if qtd_em_aberto >= config.max_emprestimos_por_leitor:
        raise RegraViolada(f"O leitor atingiu o limite de {config.max_emprestimos_por_leitor} empréstimos simultâneos.")

    if config.bloquear_leitor_com_atraso:
        possui_atraso = db.scalar(
            select(
                exists().where(
                    Emprestimo.leitor_id == leitor.id, em_aberto(), Emprestimo.data_prevista < data_hoje
                )
            )
        )
        if possui_atraso:
            raise RegraViolada("O leitor possui empréstimo em atraso. Registre a devolução antes de um novo empréstimo.")

    # 4. Prazo: o informado ou o padrão da biblioteca
    data_prevista = dados.data_prevista or data_hoje + timedelta(days=config.prazo_padrao_dias)
    if data_prevista < data_hoje:
        raise RegraViolada("A data limite de devolução não pode ser anterior a hoje.")

    # 5. Grava. O índice único do banco é a última barreira contra empréstimo duplicado.
    emprestimo = Emprestimo(
        leitor=leitor,
        exemplar=exemplar,
        data_saida=data_hoje,
        data_prevista=data_prevista,
        registrado_por_id=gestor.id,
    )
    db.add(emprestimo)
    try:
        db.commit()
    except IntegrityError as erro:
        db.rollback()
        raise Conflito(f"O exemplar {exemplar.codigo} acabou de ser emprestado em outro atendimento.") from erro
    return para_saida(emprestimo, data_hoje)


# =====================================================================
# Devolução (RF04)
# =====================================================================

def registrar_devolucao(
    db: Session, gestor: Usuario, codigo_exemplar: str | None = None, emprestimo_id: int | None = None
) -> EmprestimoSaida:
    """Encerra o empréstimo em aberto (pelo código do exemplar ou pelo id do empréstimo)."""
    consulta = select(Emprestimo).where(em_aberto())
    if emprestimo_id is not None:
        consulta = consulta.where(Emprestimo.id == emprestimo_id)
    else:
        consulta = consulta.join(Emprestimo.exemplar).where(Exemplar.codigo == codigo_exemplar.strip().upper())

    emprestimo = db.scalar(consulta.with_for_update(of=Emprestimo))
    if emprestimo is None:
        raise NaoEncontrado("Não há empréstimo em aberto para este exemplar.")

    data_hoje = hoje()
    emprestimo.data_devolucao = data_hoje
    emprestimo.recebido_por_id = gestor.id
    db.commit()
    return para_saida(emprestimo, data_hoje)


# =====================================================================
# Consultas
# =====================================================================

def listar_emprestimos(
    db: Session,
    params: ParametrosPagina,
    filtro: FiltroEmprestimo | None = None,
    leitor_id: int | None = None,
) -> Pagina:
    """Lista empréstimos com filtro de situação e/ou leitor."""
    data_hoje = hoje()

    if filtro == FiltroEmprestimo.ATRASADO:
        consulta = consulta_atrasados(data_hoje)
    elif filtro == FiltroEmprestimo.A_VENCER:
        consulta = consulta_a_vencer(data_hoje, obter_configuracao(db).dias_aviso_vencimento)
    elif filtro == FiltroEmprestimo.EM_ABERTO:
        consulta = select(Emprestimo).where(em_aberto()).order_by(Emprestimo.data_prevista, Emprestimo.id)
    elif filtro == FiltroEmprestimo.DEVOLVIDO:
        consulta = (
            select(Emprestimo)
            .where(Emprestimo.data_devolucao.is_not(None))
            .order_by(Emprestimo.data_devolucao.desc(), Emprestimo.id.desc())
        )
    else:
        consulta = select(Emprestimo).order_by(Emprestimo.data_saida.desc(), Emprestimo.id.desc())

    if leitor_id is not None:
        consulta = consulta.where(Emprestimo.leitor_id == leitor_id)

    emprestimos, total = paginar(db, consulta, params, *OPCOES_CARREGAMENTO)
    return montar_pagina([para_saida(e, data_hoje) for e in emprestimos], total, params)


def meus_emprestimos(db: Session, usuario: Usuario, params: ParametrosPagina, filtro: FiltroEmprestimo | None) -> Pagina:
    """Empréstimos do leitor logado (vazio se o usuário não estiver vinculado a um leitor)."""
    leitor_id = db.scalar(select(Leitor.id).where(Leitor.usuario_id == usuario.id))
    if leitor_id is None:
        return montar_pagina([], 0, params)
    return listar_emprestimos(db, params, filtro, leitor_id)
