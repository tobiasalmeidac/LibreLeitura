"""Importa todos os modelos para que o SQLAlchemy e o Alembic conheçam todas as tabelas."""

from app.modules.acervo.models import Autor, Categoria, Exemplar, Livro, SituacaoExemplar, livro_autor
from app.modules.auth.models import RefreshToken
from app.modules.circulacao.models import Emprestimo
from app.modules.configuracao.models import Configuracao
from app.modules.leitores.models import Leitor
from app.modules.usuarios.models import Papel, Usuario

__all__ = [
    "Autor",
    "Categoria",
    "Configuracao",
    "Emprestimo",
    "Exemplar",
    "Leitor",
    "Livro",
    "Papel",
    "RefreshToken",
    "SituacaoExemplar",
    "Usuario",
    "livro_autor",
]
