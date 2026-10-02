"""Proteção de dados sensíveis do leitor (documento/matrícula).

- cifrar/decifrar: criptografia reversível (Fernet = AES + HMAC), para poder exibir o documento.
- hmac_documento: "hash de busca" irreversível, para achar o leitor pelo documento e evitar duplicidade
  sem precisar decifrar a tabela inteira.
"""

import hashlib
import hmac
from functools import lru_cache

from cryptography.fernet import Fernet

from app.core.config import get_settings


@lru_cache
def _fernet() -> Fernet:
    """Instância única do Fernet com a chave configurada."""
    return Fernet(get_settings().chave_fernet.encode())


def normalizar_documento(documento: str) -> str:
    """Mantém só letras e números em maiúsculas ("123.456.789-00" -> "12345678900")."""
    return "".join(c for c in documento if c.isalnum()).upper()


def cifrar(texto: str) -> str:
    """Criptografa o texto; o resultado é o que fica salvo no banco."""
    return _fernet().encrypt(texto.encode()).decode()


def decifrar(texto_cifrado: str) -> str:
    """Desfaz a criptografia para exibir o dado."""
    return _fernet().decrypt(texto_cifrado.encode()).decode()


def hmac_documento(documento_normalizado: str) -> str:
    """Gera o HMAC-SHA256 do documento (mesma entrada -> mesmo resultado, sem ser reversível)."""
    chave = get_settings().chave_hmac.encode()
    return hmac.new(chave, documento_normalizado.encode(), hashlib.sha256).hexdigest()
