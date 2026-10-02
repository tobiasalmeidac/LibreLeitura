"""Regras de contas de usuário."""

from sqlalchemy import select, update
from sqlalchemy.orm import Session

from app.core.datas import agora_utc
from app.core.erros import Conflito, NaoEncontrado, RegraViolada
from app.core.paginacao import Pagina, ParametrosPagina, montar_pagina, paginar
from app.core.seguranca import gerar_hash_senha, verificar_senha
from app.modules.auth.models import RefreshToken
from app.modules.usuarios.models import Papel, Usuario
from app.modules.usuarios.schemas import TrocarSenha, UsuarioAtualizar, UsuarioCriar, UsuarioSaida


def normalizar_email(email: str) -> str:
    """E-mails ficam em minúsculas para o login não diferenciar maiúsculas."""
    return email.strip().lower()


def buscar_por_email(db: Session, email: str) -> Usuario | None:
    return db.scalar(select(Usuario).where(Usuario.email == normalizar_email(email)))


def criar_usuario(db: Session, nome: str, email: str, senha: str, papel: Papel) -> Usuario:
    """Cria o usuário com a senha em hash. Não faz commit: quem chama decide quando gravar."""
    if buscar_por_email(db, email):
        raise Conflito("Já existe um usuário com este e-mail.")
    usuario = Usuario(
        nome=nome,
        email=normalizar_email(email),
        senha_hash=gerar_hash_senha(senha),
        papel=papel,
        ativo=True,
        tentativas_login_falhas=0,
    )
    db.add(usuario)
    db.flush()
    return usuario


def revogar_sessoes(db: Session, usuario_id: int) -> None:
    """Invalida todos os refresh tokens do usuário (força novo login em todos os dispositivos)."""
    db.execute(
        update(RefreshToken)
        .where(RefreshToken.usuario_id == usuario_id, RefreshToken.revogado_em.is_(None))
        .values(revogado_em=agora_utc())
    )


def criar_gestor(db: Session, dados: UsuarioCriar) -> Usuario:
    usuario = criar_usuario(db, dados.nome, dados.email, dados.senha, Papel.GESTOR)
    db.commit()
    db.refresh(usuario)
    return usuario


def listar_gestores(db: Session, params: ParametrosPagina) -> Pagina:
    consulta = select(Usuario).where(Usuario.papel == Papel.GESTOR).order_by(Usuario.nome)
    usuarios, total = paginar(db, consulta, params)
    return montar_pagina([UsuarioSaida.model_validate(u) for u in usuarios], total, params)


def atualizar_gestor(db: Session, usuario_id: int, dados: UsuarioAtualizar, gestor_atual: Usuario) -> Usuario:
    """Altera nome, e-mail ou situação de um gestor. Contas de leitores são geridas pelo módulo leitores."""
    usuario = db.get(Usuario, usuario_id)
    if usuario is None or usuario.papel != Papel.GESTOR:
        raise NaoEncontrado("Gestor não encontrado.")

    campos = dados.model_dump(exclude_unset=True)

    # E-mail novo não pode pertencer a outro usuário
    if "email" in campos:
        campos["email"] = normalizar_email(campos["email"])
        existente = buscar_por_email(db, campos["email"])
        if existente and existente.id != usuario.id:
            raise Conflito("Já existe um usuário com este e-mail.")

    # Evita que o sistema fique sem ninguém para administrá-lo
    if campos.get("ativo") is False:
        if usuario.id == gestor_atual.id:
            raise RegraViolada("Você não pode desativar a própria conta.")
        revogar_sessoes(db, usuario.id)

    for campo, valor in campos.items():
        setattr(usuario, campo, valor)
    db.commit()
    return usuario


def trocar_senha(db: Session, usuario: Usuario, dados: TrocarSenha) -> None:
    """O próprio usuário troca a senha; todas as sessões abertas são encerradas."""
    if not verificar_senha(dados.senha_atual, usuario.senha_hash):
        raise RegraViolada("Senha atual incorreta.")
    usuario.senha_hash = gerar_hash_senha(dados.nova_senha)
    revogar_sessoes(db, usuario.id)
    db.commit()
