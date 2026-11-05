"""Regras do cadastro de leitores (RF02)."""

from sqlalchemy import exists, or_, select
from sqlalchemy.orm import Session

from app.core.cripto import cifrar, decifrar, hmac_documento, normalizar_documento
from app.core.datas import agora_utc
from app.core.erros import Conflito, NaoEncontrado, RegraViolada
from app.core.paginacao import Pagina, ParametrosPagina, montar_pagina, paginar
from app.modules.circulacao.models import Emprestimo
from app.modules.leitores.models import Leitor
from app.modules.leitores.schemas import CriarAcessoLeitor, LeitorAtualizar, LeitorCriar, LeitorSaida
from app.modules.usuarios.models import Papel
from app.modules.usuarios.service import criar_usuario

NOME_ANONIMIZADO = "Leitor removido"


def mascarar_documento(documento: str) -> str:
    """Mostra só os 3 últimos caracteres (ex.: '*****678'). Nunca devolvemos o documento inteiro."""
    return "*" * max(len(documento) - 3, 0) + documento[-3:]


def para_saida(leitor: Leitor) -> LeitorSaida:
    """Converte o modelo em resposta da API. O documento sai mascarado; o valor real nunca é devolvido."""
    return LeitorSaida(
        id=leitor.id,
        nome=leitor.nome,
        email=leitor.email,
        telefone=leitor.telefone,
        documento=mascarar_documento(decifrar(leitor.documento_cifrado)) if leitor.documento_cifrado else None,
        ativo=leitor.ativo,
        possui_acesso=leitor.usuario_id is not None,
        criado_em=leitor.criado_em,
    )


def obter_leitor(db: Session, leitor_id: int) -> Leitor:
    """Busca um leitor não excluído; lança NaoEncontrado se não existir."""
    leitor = db.get(Leitor, leitor_id)
    if leitor is None or leitor.excluido_em is not None:
        raise NaoEncontrado("Leitor não encontrado.")
    return leitor


def _definir_documento(db: Session, leitor: Leitor, documento: str | None) -> None:
    """Grava o documento cifrado + HMAC, impedindo dois leitores com o mesmo documento."""
    normalizado = normalizar_documento(documento) if documento else ""
    if not normalizado:
        leitor.documento_cifrado = None
        leitor.documento_hmac = None
        return

    hash_busca = hmac_documento(normalizado)
    duplicado = db.scalar(select(Leitor.id).where(Leitor.documento_hmac == hash_busca, Leitor.id != leitor.id))
    if duplicado:
        raise Conflito("Já existe um leitor com este documento.")
    leitor.documento_cifrado = cifrar(normalizado)
    leitor.documento_hmac = hash_busca


def criar_leitor(db: Session, dados: LeitorCriar) -> Leitor:
    leitor = Leitor(nome=dados.nome, email=dados.email, telefone=dados.telefone, ativo=True)
    _definir_documento(db, leitor, dados.documento)
    db.add(leitor)
    db.commit()
    db.refresh(leitor)
    return leitor


def listar_leitores(db: Session, params: ParametrosPagina, q: str | None = None, ativo: bool | None = None) -> Pagina:
    """Lista leitores. A busca 'q' procura no nome, no e-mail e no documento (documento exato)."""
    consulta = select(Leitor).where(Leitor.excluido_em.is_(None))
    if ativo is not None:
        consulta = consulta.where(Leitor.ativo == ativo)
    if q:
        termo = f"%{q.strip()}%"
        condicoes = [Leitor.nome.ilike(termo), Leitor.email.ilike(termo)]
        # O documento está cifrado, então só dá para achar pelo valor completo (via HMAC)
        documento = normalizar_documento(q)
        if documento:
            condicoes.append(Leitor.documento_hmac == hmac_documento(documento))
        consulta = consulta.where(or_(*condicoes))
    consulta = consulta.order_by(Leitor.nome, Leitor.id)

    leitores, total = paginar(db, consulta, params)
    return montar_pagina([para_saida(leitor) for leitor in leitores], total, params)


def atualizar_leitor(db: Session, leitor_id: int, dados: LeitorAtualizar) -> Leitor:
    leitor = obter_leitor(db, leitor_id)
    campos = dados.model_dump(exclude_unset=True)

    if "documento" in campos:
        _definir_documento(db, leitor, campos.pop("documento"))

    for campo, valor in campos.items():
        setattr(leitor, campo, valor)

    # Mantém o login do leitor coerente com o cadastro
    if leitor.usuario is not None:
        leitor.usuario.nome = leitor.nome
        leitor.usuario.ativo = leitor.ativo

    db.commit()
    return leitor


def excluir_leitor(db: Session, leitor_id: int) -> None:
    """Sem histórico: apaga de vez. Com histórico: anonimiza os dados pessoais (LGPD) e mantém os empréstimos."""
    leitor = obter_leitor(db, leitor_id)

    em_aberto = db.scalar(
        select(exists().where(Emprestimo.leitor_id == leitor.id, Emprestimo.data_devolucao.is_(None)))
    )
    if em_aberto:
        raise Conflito("O leitor possui empréstimos em aberto. Registre as devoluções antes de excluir.")

    possui_historico = db.scalar(select(exists().where(Emprestimo.leitor_id == leitor.id)))
    usuario = leitor.usuario

    if possui_historico:
        leitor.nome = NOME_ANONIMIZADO
        leitor.email = None
        leitor.telefone = None
        leitor.documento_cifrado = None
        leitor.documento_hmac = None
        leitor.ativo = False
        leitor.excluido_em = agora_utc()
        leitor.usuario = None
    else:
        db.delete(leitor)

    # O login do leitor (se existir) é sempre removido
    if usuario is not None:
        db.delete(usuario)
    db.commit()


def criar_acesso(db: Session, leitor_id: int, dados: CriarAcessoLeitor) -> Leitor:
    """Cria o login (papel LEITOR) para o leitor consultar seus empréstimos."""
    leitor = obter_leitor(db, leitor_id)
    if leitor.usuario_id is not None:
        raise Conflito("Este leitor já possui acesso ao sistema.")

    email = dados.email or leitor.email
    if not email:
        raise RegraViolada("Informe um e-mail para o login do leitor.")

    leitor.usuario = criar_usuario(db, leitor.nome, email, dados.senha, Papel.LEITOR)
    db.commit()
    return leitor
