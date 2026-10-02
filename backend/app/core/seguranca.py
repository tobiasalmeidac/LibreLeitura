"""Hash de senhas (Argon2id) e tokens de acesso (JWT)."""

import hashlib
import secrets
from datetime import timedelta

import jwt
from argon2 import PasswordHasher
from argon2.exceptions import InvalidHashError, VerificationError

from app.core.config import get_settings
from app.core.datas import agora_utc
from app.core.erros import NaoAutorizado

# Argon2id com os parâmetros padrão recomendados pela biblioteca
_hasher = PasswordHasher()
_ALGORITMO_JWT = "HS256"


# --- Senhas ---

def gerar_hash_senha(senha: str) -> str:
    """Gera o hash irreversível da senha (é isso que vai para o banco, nunca a senha)."""
    return _hasher.hash(senha)


def verificar_senha(senha: str, senha_hash: str) -> bool:
    """Confere se a senha digitada corresponde ao hash salvo."""
    try:
        return _hasher.verify(senha_hash, senha)
    except (VerificationError, InvalidHashError):
        return False


def precisa_rehash(senha_hash: str) -> bool:
    """Indica se o hash foi gerado com parâmetros antigos e deve ser refeito no próximo login."""
    return _hasher.check_needs_rehash(senha_hash)


# --- Token de acesso (JWT, curta duração, enviado no header Authorization) ---

def criar_access_token(usuario_id: int, papel: str) -> str:
    """Cria o JWT assinado com o id e o papel do usuário."""
    settings = get_settings()
    agora = agora_utc()
    payload = {
        "sub": str(usuario_id),
        "papel": papel,
        "iat": agora,
        "exp": agora + timedelta(minutes=settings.access_token_minutos),
    }
    return jwt.encode(payload, settings.jwt_secret, algorithm=_ALGORITMO_JWT)


def decodificar_access_token(token: str) -> dict:
    """Valida assinatura e validade do JWT; lança NaoAutorizado se algo estiver errado."""
    try:
        return jwt.decode(token, get_settings().jwt_secret, algorithms=[_ALGORITMO_JWT])
    except jwt.ExpiredSignatureError as erro:
        raise NaoAutorizado("Sessão expirada. Renove o token.") from erro
    except jwt.PyJWTError as erro:
        raise NaoAutorizado("Token inválido.") from erro


# --- Refresh token (longa duração, guardado em cookie httpOnly) ---

def gerar_refresh_token() -> str:
    """Gera um valor aleatório e imprevisível para o refresh token."""
    return secrets.token_urlsafe(48)


def hash_refresh_token(token: str) -> str:
    """O banco guarda só o SHA-256 do refresh token; um vazamento do banco não expõe sessões."""
    return hashlib.sha256(token.encode()).hexdigest()
