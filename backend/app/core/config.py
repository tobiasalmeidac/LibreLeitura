"""Configurações da aplicação, lidas de variáveis de ambiente (ou do arquivo .env)."""

import json
from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict
from sqlalchemy import URL


class Settings(BaseSettings):
    """Cada atributo vira uma variável de ambiente em maiúsculas (ex.: jwt_secret -> JWT_SECRET)."""

    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    # --- Geral ---
    ambiente: str = "local"  # local | teste | dev | prod
    timezone: str = "America/Sao_Paulo"
    cors_origins: list[str] = []  # só em desenvolvimento; na AWS o CloudFront serve tudo na mesma origem

    # --- Banco de dados (local). Na AWS a URL é montada com o segredo do RDS ---
    database_url: str = "postgresql+psycopg://libreleitura:libreleitura@localhost:5432/libreleitura"

    # --- Segredos da aplicação ---
    jwt_secret: str = ""    # assina os tokens de acesso
    chave_fernet: str = ""  # cifra o documento do leitor
    chave_hmac: str = ""    # gera o "hash de busca" do documento

    # --- Sessão ---
    access_token_minutos: int = 30
    refresh_token_dias: int = 7
    cookie_secure: bool = True

    # --- Proteção do login contra força bruta ---
    max_tentativas_login: int = 5
    bloqueio_login_minutos: int = 15

    # --- AWS (preenchidas só no Elastic Beanstalk) ---
    aws_region: str = "sa-east-1"
    aws_secret_app_id: str | None = None  # segredo com jwt_secret, chave_fernet e chave_hmac
    aws_secret_db_id: str | None = None   # segredo do RDS com username e password
    db_host: str | None = None
    db_port: int = 5432
    db_name: str = "libreleitura"


def _carregar_segredos_aws(settings: Settings) -> Settings:
    """Busca os segredos no AWS Secrets Manager e devolve uma cópia das configurações completas."""
    import boto3  # importado aqui para não ser necessário no desenvolvimento local

    cliente = boto3.client("secretsmanager", region_name=settings.aws_region)
    atualizacoes: dict = {}

    # Segredo da aplicação: {"jwt_secret": "...", "chave_fernet": "...", "chave_hmac": "..."}
    if settings.aws_secret_app_id:
        valor = cliente.get_secret_value(SecretId=settings.aws_secret_app_id)["SecretString"]
        segredo = json.loads(valor)
        atualizacoes["jwt_secret"] = segredo["jwt_secret"]
        atualizacoes["chave_fernet"] = segredo["chave_fernet"]
        atualizacoes["chave_hmac"] = segredo["chave_hmac"]

    # Segredo gerenciado pelo RDS: {"username": "...", "password": "..."}
    if settings.aws_secret_db_id:
        if not settings.db_host:
            raise RuntimeError("DB_HOST é obrigatório quando AWS_SECRET_DB_ID está definido.")
        valor = cliente.get_secret_value(SecretId=settings.aws_secret_db_id)["SecretString"]
        segredo = json.loads(valor)
        # URL.create escapa caracteres especiais da senha; sslmode=require força TLS até o RDS
        url = URL.create(
            "postgresql+psycopg",
            username=segredo["username"],
            password=segredo["password"],
            host=settings.db_host,
            port=settings.db_port,
            database=settings.db_name,
            query={"sslmode": "require"},
        )
        atualizacoes["database_url"] = url.render_as_string(hide_password=False)

    return settings.model_copy(update=atualizacoes)


@lru_cache
def get_settings() -> Settings:
    """Carrega as configurações uma única vez e valida se os segredos foram informados."""
    settings = Settings()
    if settings.aws_secret_app_id or settings.aws_secret_db_id:
        settings = _carregar_segredos_aws(settings)

    faltando = [nome.upper() for nome in ("jwt_secret", "chave_fernet", "chave_hmac") if not getattr(settings, nome)]
    if faltando:
        raise RuntimeError(
            f"Segredos não configurados: {', '.join(faltando)}. "
            "Gere valores com 'python -m app.cli gerar-chaves' e coloque no arquivo .env."
        )
    return settings
