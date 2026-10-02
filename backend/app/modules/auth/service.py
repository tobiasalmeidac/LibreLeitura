"""Login, emissão e renovação de tokens, e logout."""

from datetime import timedelta

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.core.datas import agora_utc, garantir_utc
from app.core.erros import MuitasTentativas, NaoAutorizado
from app.core.seguranca import (
    criar_access_token,
    gerar_hash_senha,
    gerar_refresh_token,
    hash_refresh_token,
    precisa_rehash,
    verificar_senha,
)
from app.modules.auth.models import RefreshToken
from app.modules.usuarios.models import Usuario
from app.modules.usuarios.service import buscar_por_email

MENSAGEM_LOGIN_INVALIDO = "E-mail ou senha inválidos."

# Hash de uma senha qualquer, verificado quando o e-mail não existe: o tempo de resposta fica
# igual ao de um e-mail existente, e ninguém descobre quais e-mails estão cadastrados.
_HASH_FICTICIO = gerar_hash_senha("senha-ficticia-para-tempo-constante")


def autenticar(db: Session, email: str, senha: str) -> Usuario:
    """Confere e-mail e senha, aplicando bloqueio temporário após muitas tentativas erradas."""
    settings = get_settings()
    agora = agora_utc()
    usuario = buscar_por_email(db, email)

    # E-mail inexistente: mesma mensagem e mesmo tempo de um erro de senha
    if usuario is None:
        verificar_senha(senha, _HASH_FICTICIO)
        raise NaoAutorizado(MENSAGEM_LOGIN_INVALIDO)

    # Conta bloqueada temporariamente
    if usuario.bloqueado_ate and garantir_utc(usuario.bloqueado_ate) > agora:
        raise MuitasTentativas("Muitas tentativas de login. Tente novamente em alguns minutos.")

    # Senha errada: conta a tentativa e bloqueia ao atingir o limite
    if not verificar_senha(senha, usuario.senha_hash):
        usuario.tentativas_login_falhas += 1
        if usuario.tentativas_login_falhas >= settings.max_tentativas_login:
            usuario.bloqueado_ate = agora + timedelta(minutes=settings.bloqueio_login_minutos)
            usuario.tentativas_login_falhas = 0
        db.commit()
        raise NaoAutorizado(MENSAGEM_LOGIN_INVALIDO)

    if not usuario.ativo:
        raise NaoAutorizado("Usuário inativo. Procure a equipe da biblioteca.")

    # Login certo: zera o contador e, se preciso, atualiza o hash para parâmetros mais novos
    usuario.tentativas_login_falhas = 0
    usuario.bloqueado_ate = None
    if precisa_rehash(usuario.senha_hash):
        usuario.senha_hash = gerar_hash_senha(senha)
    db.commit()
    return usuario


def emitir_tokens(db: Session, usuario: Usuario) -> tuple[str, str]:
    """Cria o par (access token, refresh token) e guarda o hash do refresh token no banco."""
    settings = get_settings()
    access_token = criar_access_token(usuario.id, usuario.papel.value)
    refresh_token = gerar_refresh_token()
    db.add(
        RefreshToken(
            usuario_id=usuario.id,
            token_hash=hash_refresh_token(refresh_token),
            expira_em=agora_utc() + timedelta(days=settings.refresh_token_dias),
        )
    )
    db.commit()
    return access_token, refresh_token


def renovar(db: Session, refresh_token: str) -> tuple[Usuario, str, str]:
    """Troca um refresh token válido por um par novo (rotação: o antigo deixa de valer)."""
    registro = db.scalar(select(RefreshToken).where(RefreshToken.token_hash == hash_refresh_token(refresh_token)))
    if registro is None or registro.revogado_em is not None or garantir_utc(registro.expira_em) <= agora_utc():
        raise NaoAutorizado("Sessão expirada. Faça login novamente.")

    usuario = db.get(Usuario, registro.usuario_id)
    if usuario is None or not usuario.ativo:
        raise NaoAutorizado("Usuário inexistente ou inativo.")

    registro.revogado_em = agora_utc()
    access_token, novo_refresh = emitir_tokens(db, usuario)  # o commit aqui grava também a revogação
    return usuario, access_token, novo_refresh


def revogar(db: Session, refresh_token: str) -> None:
    """Logout: invalida o refresh token informado."""
    registro = db.scalar(select(RefreshToken).where(RefreshToken.token_hash == hash_refresh_token(refresh_token)))
    if registro is not None and registro.revogado_em is None:
        registro.revogado_em = agora_utc()
        db.commit()
