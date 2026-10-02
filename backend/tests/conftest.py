"""Preparação dos testes: banco SQLite em memória e usuários prontos para uso."""

import os

from cryptography.fernet import Fernet

# Configurações de teste definidas ANTES de importar a aplicação (ela lê as configurações ao ser importada)
os.environ.update(
    {
        "AMBIENTE": "teste",
        "DATABASE_URL": "sqlite://",
        "JWT_SECRET": "segredo-jwt-apenas-para-testes-com-mais-de-32-bytes",
        "CHAVE_FERNET": Fernet.generate_key().decode(),
        "CHAVE_HMAC": "chave-hmac-apenas-para-testes",
        "COOKIE_SECURE": "false",
        "CORS_ORIGINS": "[]",
    }
)

import pytest  # noqa: E402
from fastapi.testclient import TestClient  # noqa: E402

from app.core.database import Base, SessionLocal, engine  # noqa: E402
from app.main import app  # noqa: E402
from app.modules.usuarios.models import Papel  # noqa: E402
from app.modules.usuarios.service import criar_usuario  # noqa: E402
from tests.apoio import EMAIL_GESTOR, SENHA, fazer_login  # noqa: E402


@pytest.fixture
def client():
    """Cliente HTTP da API com um banco vazio, recriado a cada teste."""
    Base.metadata.create_all(engine)
    with TestClient(app) as cliente:
        yield cliente
    Base.metadata.drop_all(engine)


@pytest.fixture
def db(client):
    """Sessão do banco para preparar cenários ou conferir dados gravados."""
    with SessionLocal() as sessao:
        yield sessao


@pytest.fixture
def gestor(client, db) -> dict:
    """Cria um gestor e devolve o header de autenticação dele."""
    criar_usuario(db, "Gestora", EMAIL_GESTOR, SENHA, Papel.GESTOR)
    db.commit()
    return fazer_login(client, EMAIL_GESTOR)


@pytest.fixture
def cenario(client, gestor) -> dict:
    """Um autor, uma categoria, um livro com 2 exemplares e um leitor, prontos para empréstimo."""
    autor = client.post("/api/autores", json={"nome": "Machado de Assis"}, headers=gestor).json()
    categoria = client.post("/api/categorias", json={"nome": "Romance"}, headers=gestor).json()
    livro = client.post(
        "/api/livros",
        json={
            "titulo": "Dom Casmurro",
            "isbn": "978-85-359-0277-7",
            "editora": "Companhia das Letras",
            "ano_publicacao": 1899,
            "categoria_id": categoria["id"],
            "autor_ids": [autor["id"]],
            "quantidade_exemplares": 2,
        },
        headers=gestor,
    ).json()
    leitor = client.post(
        "/api/leitores",
        json={"nome": "Ana Souza", "email": "ana@libreleitura.com.br", "documento": "2024001"},
        headers=gestor,
    ).json()
    return {"autor": autor, "categoria": categoria, "livro": livro, "leitor": leitor}
