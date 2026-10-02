"""Conexão com o banco de dados, sessão por requisição e classe base dos modelos."""

from collections.abc import Iterator

from sqlalchemy import MetaData, create_engine, event
from sqlalchemy.engine import Engine
from sqlalchemy.orm import DeclarativeBase, Session, sessionmaker
from sqlalchemy.pool import StaticPool

from app.core.config import get_settings

# Padrão de nomes de índices e restrições: deixa as migrações do Alembic previsíveis
CONVENCAO_NOMES = {
    "ix": "ix_%(column_0_label)s",
    "uq": "uq_%(table_name)s_%(column_0_name)s",
    "ck": "ck_%(table_name)s_%(constraint_name)s",
    "fk": "fk_%(table_name)s_%(column_0_name)s_%(referred_table_name)s",
    "pk": "pk_%(table_name)s",
}


class Base(DeclarativeBase):
    """Classe mãe de todos os modelos: cada subclasse vira uma tabela."""

    metadata = MetaData(naming_convention=CONVENCAO_NOMES)


def _criar_engine(url: str) -> Engine:
    """Cria o engine do SQLAlchemy. SQLite em memória é usado apenas pelos testes automatizados."""
    if url.startswith("sqlite"):
        engine = create_engine(url, connect_args={"check_same_thread": False}, poolclass=StaticPool)

        # SQLite só respeita chaves estrangeiras com este PRAGMA ligado
        @event.listens_for(engine, "connect")
        def _ativar_chaves_estrangeiras(conexao, _registro):
            cursor = conexao.cursor()
            cursor.execute("PRAGMA foreign_keys=ON")
            cursor.close()

        return engine

    # PostgreSQL: pool pequeno por processo (2 workers x 7 conexões por instância EC2).
    # pre_ping descarta conexões quebradas, por exemplo após um failover Multi-AZ do RDS.
    return create_engine(url, pool_pre_ping=True, pool_size=5, max_overflow=2)


engine = _criar_engine(get_settings().database_url)
SessionLocal = sessionmaker(bind=engine, autoflush=False, expire_on_commit=False)


def get_db() -> Iterator[Session]:
    """Abre uma sessão por requisição HTTP e garante que ela seja fechada no final."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
