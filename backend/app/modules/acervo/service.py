"""Regras do acervo: cadastro (RF01), exemplares e consulta pública com disponibilidade (RF05)."""

from sqlalchemy import and_, case, exists, func, or_, select
from sqlalchemy.orm import Session, contains_eager, selectinload

from app.core.erros import Conflito, NaoEncontrado
from app.core.paginacao import Pagina, ParametrosPagina, montar_pagina, paginar
from app.modules.acervo.models import Autor, Categoria, Exemplar, Livro, SituacaoExemplar, livro_autor
from app.modules.acervo.schemas import (
    AdicionarExemplares,
    AutorEntrada,
    AutorSaida,
    CategoriaEntrada,
    CategoriaSaida,
    ExemplarAtualizar,
    ExemplarComLivro,
    ExemplarSaida,
    LivroAtualizar,
    LivroCriar,
    LivroDetalhe,
    LivroResumo,
    StatusLivro,
)
from app.modules.circulacao.models import Emprestimo


# =====================================================================
# Funções auxiliares de disponibilidade
# =====================================================================

def _exemplar_emprestado():
    """Condição SQL: o exemplar da consulta tem um empréstimo em aberto."""
    return exists().where(Emprestimo.exemplar_id == Exemplar.id, Emprestimo.data_devolucao.is_(None))


def _ids_emprestados(db: Session, exemplar_ids: list[int]) -> set[int]:
    """Dentre os exemplares informados, devolve os ids dos que estão emprestados agora."""
    if not exemplar_ids:
        return set()
    consulta = select(Emprestimo.exemplar_id).where(
        Emprestimo.exemplar_id.in_(exemplar_ids), Emprestimo.data_devolucao.is_(None)
    )
    return set(db.scalars(consulta))


def _contar_exemplares(db: Session, livro_ids: list[int]) -> dict[int, tuple[int, int]]:
    """Para cada livro devolve (exemplares ativos, exemplares disponíveis) em uma só consulta."""
    if not livro_ids:
        return {}
    consulta = (
        select(
            Exemplar.livro_id,
            func.count(Exemplar.id),
            func.sum(case((_exemplar_emprestado(), 0), else_=1)),
        )
        .where(Exemplar.livro_id.in_(livro_ids), Exemplar.situacao == SituacaoExemplar.ATIVO)
        .group_by(Exemplar.livro_id)
    )
    return {livro_id: (int(total), int(livres or 0)) for livro_id, total, livres in db.execute(consulta)}


def _status(total_ativos: int, disponiveis: int) -> StatusLivro:
    if disponiveis > 0:
        return StatusLivro.DISPONIVEL
    if total_ativos > 0:
        return StatusLivro.EMPRESTADO
    return StatusLivro.INDISPONIVEL


def _dados_basicos(livro: Livro) -> dict:
    """Campos comuns ao resumo e ao detalhe do livro."""
    return {
        "id": livro.id,
        "titulo": livro.titulo,
        "isbn": livro.isbn,
        "editora": livro.editora,
        "ano_publicacao": livro.ano_publicacao,
        "categoria": CategoriaSaida.model_validate(livro.categoria) if livro.categoria else None,
        "autores": [AutorSaida.model_validate(a) for a in sorted(livro.autores, key=lambda a: a.nome)],
    }


def _para_detalhe(db: Session, livro: Livro) -> LivroDetalhe:
    """Monta o detalhe do livro com a disponibilidade de cada exemplar."""
    emprestados = _ids_emprestados(db, [e.id for e in livro.exemplares])
    exemplares = [
        ExemplarSaida(
            id=e.id,
            codigo=e.codigo,
            situacao=e.situacao,
            disponivel=e.situacao == SituacaoExemplar.ATIVO and e.id not in emprestados,
        )
        for e in sorted(livro.exemplares, key=lambda e: e.codigo)
    ]
    ativos = sum(1 for e in exemplares if e.situacao == SituacaoExemplar.ATIVO)
    disponiveis = sum(1 for e in exemplares if e.disponivel)
    return LivroDetalhe(
        **_dados_basicos(livro),
        total_exemplares=ativos,
        exemplares_disponiveis=disponiveis,
        status=_status(ativos, disponiveis),
        exemplares=exemplares,
    )


def _gerar_exemplares(livro: Livro, quantidade: int) -> None:
    """Cria exemplares com códigos sequenciais, ex.: LL000042-001, LL000042-002..."""
    proximo = len(livro.exemplares) + 1
    for numero in range(proximo, proximo + quantidade):
        livro.exemplares.append(Exemplar(codigo=f"LL{livro.id:06d}-{numero:03d}", situacao=SituacaoExemplar.ATIVO))


# =====================================================================
# Autores
# =====================================================================

def listar_autores(db: Session, params: ParametrosPagina, q: str | None = None) -> Pagina:
    consulta = select(Autor).order_by(Autor.nome, Autor.id)
    if q:
        consulta = consulta.where(Autor.nome.ilike(f"%{q.strip()}%"))
    autores, total = paginar(db, consulta, params)
    return montar_pagina([AutorSaida.model_validate(a) for a in autores], total, params)


def criar_autor(db: Session, dados: AutorEntrada) -> Autor:
    autor = Autor(nome=dados.nome)
    db.add(autor)
    db.commit()
    return autor


def atualizar_autor(db: Session, autor_id: int, dados: AutorEntrada) -> Autor:
    autor = db.get(Autor, autor_id)
    if autor is None:
        raise NaoEncontrado("Autor não encontrado.")
    autor.nome = dados.nome
    db.commit()
    return autor


def excluir_autor(db: Session, autor_id: int) -> None:
    autor = db.get(Autor, autor_id)
    if autor is None:
        raise NaoEncontrado("Autor não encontrado.")
    if db.scalar(select(exists().where(livro_autor.c.autor_id == autor_id))):
        raise Conflito("Autor vinculado a livros não pode ser excluído.")
    db.delete(autor)
    db.commit()


# =====================================================================
# Categorias
# =====================================================================

def listar_categorias(db: Session) -> list[CategoriaSaida]:
    categorias = db.scalars(select(Categoria).order_by(Categoria.nome))
    return [CategoriaSaida.model_validate(c) for c in categorias]


def _verificar_nome_categoria(db: Session, nome: str, ignorar_id: int | None = None) -> None:
    """Impede duas categorias com o mesmo nome (sem diferenciar maiúsculas)."""
    consulta = select(Categoria.id).where(func.lower(Categoria.nome) == nome.lower())
    if ignorar_id is not None:
        consulta = consulta.where(Categoria.id != ignorar_id)
    if db.scalar(consulta):
        raise Conflito("Já existe uma categoria com este nome.")


def criar_categoria(db: Session, dados: CategoriaEntrada) -> Categoria:
    _verificar_nome_categoria(db, dados.nome)
    categoria = Categoria(nome=dados.nome)
    db.add(categoria)
    db.commit()
    return categoria


def atualizar_categoria(db: Session, categoria_id: int, dados: CategoriaEntrada) -> Categoria:
    categoria = db.get(Categoria, categoria_id)
    if categoria is None:
        raise NaoEncontrado("Categoria não encontrada.")
    _verificar_nome_categoria(db, dados.nome, ignorar_id=categoria_id)
    categoria.nome = dados.nome
    db.commit()
    return categoria


def excluir_categoria(db: Session, categoria_id: int) -> None:
    categoria = db.get(Categoria, categoria_id)
    if categoria is None:
        raise NaoEncontrado("Categoria não encontrada.")
    if db.scalar(select(exists().where(Livro.categoria_id == categoria_id))):
        raise Conflito("Categoria em uso por livros não pode ser excluída.")
    db.delete(categoria)
    db.commit()


# =====================================================================
# Livros
# =====================================================================

def _carregar_autores(db: Session, autor_ids: list[int]) -> list[Autor]:
    """Busca os autores informados; todos precisam existir."""
    ids = set(autor_ids)
    autores = list(db.scalars(select(Autor).where(Autor.id.in_(ids))))
    if len(autores) != len(ids):
        raise NaoEncontrado("Um ou mais autores não foram encontrados.")
    return autores


def _validar_categoria(db: Session, categoria_id: int | None) -> None:
    if categoria_id is not None and db.get(Categoria, categoria_id) is None:
        raise NaoEncontrado("Categoria não encontrada.")


def _validar_isbn_unico(db: Session, isbn: str | None, ignorar_id: int | None = None) -> None:
    if not isbn:
        return
    consulta = select(Livro.id).where(Livro.isbn == isbn)
    if ignorar_id is not None:
        consulta = consulta.where(Livro.id != ignorar_id)
    if db.scalar(consulta):
        raise Conflito("Já existe um livro com este ISBN.")


def _obter_livro(db: Session, livro_id: int) -> Livro:
    """Busca o livro já carregando autores, categoria e exemplares."""
    consulta = (
        select(Livro)
        .where(Livro.id == livro_id)
        .options(selectinload(Livro.autores), selectinload(Livro.categoria), selectinload(Livro.exemplares))
    )
    livro = db.scalar(consulta)
    if livro is None:
        raise NaoEncontrado("Livro não encontrado.")
    return livro


def buscar_livros(
    db: Session,
    params: ParametrosPagina,
    q: str | None = None,
    categoria_id: int | None = None,
    autor_id: int | None = None,
    somente_disponiveis: bool = False,
) -> Pagina:
    """RF05: busca por título, ISBN, autor ou categoria, com o status de disponibilidade."""
    consulta = select(Livro)

    if q:
        termo = f"%{q.strip()}%"
        consulta = consulta.where(
            or_(
                Livro.titulo.ilike(termo),
                Livro.isbn.ilike(termo),
                Livro.autores.any(Autor.nome.ilike(termo)),
                Livro.categoria.has(Categoria.nome.ilike(termo)),
            )
        )
    if categoria_id is not None:
        consulta = consulta.where(Livro.categoria_id == categoria_id)
    if autor_id is not None:
        consulta = consulta.where(Livro.autores.any(Autor.id == autor_id))
    if somente_disponiveis:
        consulta = consulta.where(
            Livro.exemplares.any(and_(Exemplar.situacao == SituacaoExemplar.ATIVO, ~_exemplar_emprestado()))
        )
    consulta = consulta.order_by(Livro.titulo, Livro.id)

    livros, total = paginar(db, consulta, params, selectinload(Livro.autores), selectinload(Livro.categoria))
    contagens = _contar_exemplares(db, [livro.id for livro in livros])

    itens = []
    for livro in livros:
        ativos, disponiveis = contagens.get(livro.id, (0, 0))
        itens.append(
            LivroResumo(
                **_dados_basicos(livro),
                total_exemplares=ativos,
                exemplares_disponiveis=disponiveis,
                status=_status(ativos, disponiveis),
            )
        )
    return montar_pagina(itens, total, params)


def detalhar_livro(db: Session, livro_id: int) -> LivroDetalhe:
    return _para_detalhe(db, _obter_livro(db, livro_id))


def criar_livro(db: Session, dados: LivroCriar) -> LivroDetalhe:
    """RF01: cadastra o livro e já gera os exemplares informados."""
    _validar_categoria(db, dados.categoria_id)
    _validar_isbn_unico(db, dados.isbn)

    livro = Livro(
        titulo=dados.titulo,
        isbn=dados.isbn,
        editora=dados.editora,
        ano_publicacao=dados.ano_publicacao,
        categoria_id=dados.categoria_id,
        autores=_carregar_autores(db, dados.autor_ids),
    )
    db.add(livro)
    db.flush()  # gera o id do livro, usado no código dos exemplares
    _gerar_exemplares(livro, dados.quantidade_exemplares)
    db.commit()
    return detalhar_livro(db, livro.id)


def atualizar_livro(db: Session, livro_id: int, dados: LivroAtualizar) -> LivroDetalhe:
    livro = _obter_livro(db, livro_id)
    campos = dados.model_dump(exclude_unset=True)

    if "autor_ids" in campos:
        livro.autores = _carregar_autores(db, campos.pop("autor_ids"))
    if "categoria_id" in campos:
        _validar_categoria(db, campos["categoria_id"])
    if "isbn" in campos:
        _validar_isbn_unico(db, campos["isbn"], ignorar_id=livro.id)

    for campo, valor in campos.items():
        setattr(livro, campo, valor)
    db.commit()
    return detalhar_livro(db, livro.id)


def excluir_livro(db: Session, livro_id: int) -> None:
    """Só exclui livros que nunca foram emprestados (para preservar o histórico)."""
    livro = _obter_livro(db, livro_id)
    ja_emprestado = db.scalar(
        select(exists().where(Emprestimo.exemplar_id == Exemplar.id, Exemplar.livro_id == livro.id))
    )
    if ja_emprestado:
        raise Conflito("Livro com histórico de empréstimos não pode ser excluído. Dê baixa nos exemplares.")
    db.delete(livro)
    db.commit()


# =====================================================================
# Exemplares
# =====================================================================

def adicionar_exemplares(db: Session, livro_id: int, dados: AdicionarExemplares) -> LivroDetalhe:
    livro = _obter_livro(db, livro_id)
    _gerar_exemplares(livro, dados.quantidade)
    db.commit()
    return detalhar_livro(db, livro.id)


def listar_exemplares(
    db: Session, params: ParametrosPagina, q: str | None = None, somente_disponiveis: bool = False
) -> Pagina:
    """Busca exemplares por código ou título (autocomplete do balcão de empréstimo)."""
    consulta = select(Exemplar).join(Exemplar.livro)
    if q:
        termo = q.strip()
        consulta = consulta.where(or_(Exemplar.codigo.ilike(f"{termo}%"), Livro.titulo.ilike(f"%{termo}%")))
    if somente_disponiveis:
        consulta = consulta.where(Exemplar.situacao == SituacaoExemplar.ATIVO, ~_exemplar_emprestado())
    consulta = consulta.order_by(Livro.titulo, Exemplar.codigo)

    exemplares, total = paginar(db, consulta, params, contains_eager(Exemplar.livro))
    emprestados = _ids_emprestados(db, [e.id for e in exemplares])
    itens = [_exemplar_com_livro(e, e.id in emprestados) for e in exemplares]
    return montar_pagina(itens, total, params)


def _exemplar_com_livro(exemplar: Exemplar, emprestado: bool) -> ExemplarComLivro:
    return ExemplarComLivro(
        id=exemplar.id,
        codigo=exemplar.codigo,
        situacao=exemplar.situacao,
        disponivel=exemplar.situacao == SituacaoExemplar.ATIVO and not emprestado,
        livro_id=exemplar.livro_id,
        livro_titulo=exemplar.livro.titulo,
    )


def atualizar_exemplar(db: Session, exemplar_id: int, dados: ExemplarAtualizar) -> ExemplarComLivro:
    """Marca um exemplar como ATIVO, EXTRAVIADO ou BAIXADO."""
    exemplar = db.get(Exemplar, exemplar_id)
    if exemplar is None:
        raise NaoEncontrado("Exemplar não encontrado.")

    emprestado = bool(_ids_emprestados(db, [exemplar.id]))
    if emprestado and dados.situacao != SituacaoExemplar.ATIVO:
        raise Conflito("Exemplar emprestado. Registre a devolução antes de alterar a situação.")

    exemplar.situacao = dados.situacao
    db.commit()
    return _exemplar_com_livro(exemplar, emprestado)
