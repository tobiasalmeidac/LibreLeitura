"""Leitura e alteração das configurações da biblioteca."""

from sqlalchemy.orm import Session

from app.modules.configuracao.models import ID_CONFIGURACAO, Configuracao
from app.modules.configuracao.schemas import ConfiguracaoAtualizar


def obter_configuracao(db: Session) -> Configuracao:
    """Devolve a linha de configuração; se ainda não existir, cria com os valores padrão."""
    config = db.get(Configuracao, ID_CONFIGURACAO)
    if config is None:
        config = Configuracao(id=ID_CONFIGURACAO)
        db.add(config)
        db.flush()
    return config


def atualizar_configuracao(db: Session, dados: ConfiguracaoAtualizar) -> Configuracao:
    """Altera somente os campos enviados."""
    config = obter_configuracao(db)
    for campo, valor in dados.model_dump(exclude_unset=True).items():
        setattr(config, campo, valor)
    db.commit()
    return config
