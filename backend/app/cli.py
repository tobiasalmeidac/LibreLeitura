"""Comandos administrativos.

Uso:
    python -m app.cli gerar-chaves
    python -m app.cli criar-gestor --nome "Maria Silva" --email maria@biblioteca.com.br
"""

import argparse
import getpass
import secrets

from cryptography.fernet import Fernet


def gerar_chaves() -> None:
    """Imprime valores novos e aleatórios para os segredos do .env (ou do Secrets Manager)."""
    print(f"JWT_SECRET={secrets.token_urlsafe(48)}")
    print(f"CHAVE_FERNET={Fernet.generate_key().decode()}")
    print(f"CHAVE_HMAC={secrets.token_urlsafe(48)}")


def criar_gestor(nome: str, email: str) -> None:
    """Cria um usuário GESTOR. Necessário para o primeiro acesso ao sistema."""
    # Imports aqui dentro: 'gerar-chaves' precisa funcionar mesmo sem banco e sem .env
    from pydantic import ValidationError

    from app import models  # noqa: F401
    from app.core.database import SessionLocal
    from app.core.erros import ErroDeNegocio
    from app.modules.usuarios.schemas import UsuarioCriar
    from app.modules.usuarios.service import criar_gestor as criar_gestor_no_banco

    senha = getpass.getpass("Senha (mínimo 8 caracteres): ")
    if senha != getpass.getpass("Confirme a senha: "):
        raise SystemExit("As senhas não conferem.")

    try:
        dados = UsuarioCriar(nome=nome, email=email, senha=senha)
        with SessionLocal() as db:
            usuario = criar_gestor_no_banco(db, dados)
    except ValidationError as erro:
        raise SystemExit(f"Dados inválidos:\n{erro}") from erro
    except ErroDeNegocio as erro:
        raise SystemExit(erro.mensagem) from erro

    print(f"Gestor criado: {usuario.email} (id {usuario.id})")


def main() -> None:
    parser = argparse.ArgumentParser(prog="python -m app.cli", description="Comandos administrativos do LibreLeitura")
    comandos = parser.add_subparsers(dest="comando", required=True)

    comandos.add_parser("gerar-chaves", help="Gera JWT_SECRET, CHAVE_FERNET e CHAVE_HMAC")

    gestor = comandos.add_parser("criar-gestor", help="Cria um usuário com papel GESTOR")
    gestor.add_argument("--nome", required=True)
    gestor.add_argument("--email", required=True)

    args = parser.parse_args()
    if args.comando == "gerar-chaves":
        gerar_chaves()
    elif args.comando == "criar-gestor":
        criar_gestor(args.nome, args.email)


if __name__ == "__main__":
    main()
