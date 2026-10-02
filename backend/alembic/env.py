"""Configuração do Alembic: conecta no banco com as mesmas configurações da aplicação."""

from logging.config import fileConfig

from sqlalchemy import create_engine, pool

from alembic import context
from app import models  # noqa: F401  (registra todas as tabelas)
from app.core.config import get_settings
from app.core.database import Base

config = context.config
if config.config_file_name is not None:
    fileConfig(config.config_file_name)

# Metadados dos modelos: usados pelo "alembic revision --autogenerate"
target_metadata = Base.metadata
URL_BANCO = get_settings().database_url


def run_migrations_offline() -> None:
    """Gera o SQL das migrações sem conectar no banco (alembic upgrade head --sql)."""
    context.configure(
        url=URL_BANCO,
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
    )
    with context.begin_transaction():
        context.run_migrations()


def run_migrations_online() -> None:
    """Conecta no banco e aplica as migrações pendentes."""
    engine = create_engine(URL_BANCO, poolclass=pool.NullPool)
    with engine.connect() as conexao:
        context.configure(connection=conexao, target_metadata=target_metadata, compare_type=True)
        with context.begin_transaction():
            context.run_migrations()


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
