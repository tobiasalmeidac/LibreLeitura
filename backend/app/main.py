"""Ponto de entrada da API: cria o app FastAPI e registra middlewares, erros e rotas."""

import logging

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from sqlalchemy import text

from app import models as _models  # noqa: F401  (registra todas as tabelas no SQLAlchemy)
from app.core.config import get_settings
from app.core.dependencias import DbSession
from app.core.erros import registrar_tratadores_de_erro
from app.modules.acervo.router import router as acervo_router
from app.modules.alertas.router import router as alertas_router
from app.modules.auth.router import router as auth_router
from app.modules.circulacao.router import router as circulacao_router
from app.modules.configuracao.router import router as configuracao_router
from app.modules.leitores.router import router as leitores_router
from app.modules.usuarios.router import router as usuarios_router

# Logs vão para a saída padrão; no Elastic Beanstalk eles seguem para o CloudWatch
logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s: %(message)s")
logger = logging.getLogger("libreleitura")

settings = get_settings()

# Documentação interativa (Swagger) em /api/docs, desligada em produção
app = FastAPI(
    title="LibreLeitura API",
    version="0.1.0",
    description="Cadastro de livros e leitores, empréstimos, devoluções e alertas de pendências.",
    docs_url=None if settings.ambiente == "prod" else "/api/docs",
    redoc_url=None,
    openapi_url=None if settings.ambiente == "prod" else "/api/openapi.json",
)

# CORS só é necessário em desenvolvimento (na AWS, site e API ficam no mesmo domínio via CloudFront)
if settings.cors_origins:
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origins,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

registrar_tratadores_de_erro(app)

# Todas as rotas ficam sob /api (o CloudFront encaminha /api/* para o ALB)
for router in (
    auth_router,
    usuarios_router,
    leitores_router,
    acervo_router,
    circulacao_router,
    alertas_router,
    configuracao_router,
):
    app.include_router(router, prefix="/api")


@app.get("/api/health", tags=["Saúde"])
def health(db: DbSession):
    """Usado pelo ALB/Elastic Beanstalk para saber se a instância está saudável."""
    try:
        db.execute(text("SELECT 1"))
    except Exception:
        logger.exception("Banco de dados indisponível no health check")
        return JSONResponse(status_code=503, content={"status": "erro", "banco": "indisponivel"})
    return {"status": "ok", "banco": "ok"}
