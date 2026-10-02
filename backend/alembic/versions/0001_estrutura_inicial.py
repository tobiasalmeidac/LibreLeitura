"""Estrutura inicial: usuários, sessões, leitores, acervo, empréstimos e configuração.

Revision ID: 0001
Revises:
Create Date: 2026-10-02
"""

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

revision: str = "0001"
down_revision: str | None = None
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    # --- usuario: quem faz login (GESTOR ou LEITOR) ---
    op.create_table(
        "usuario",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("nome", sa.String(150), nullable=False),
        sa.Column("email", sa.String(254), nullable=False),
        sa.Column("senha_hash", sa.String(255), nullable=False),
        sa.Column("papel", sa.Enum("GESTOR", "LEITOR", name="papel", native_enum=False, length=20), nullable=False),
        sa.Column("ativo", sa.Boolean(), nullable=False),
        sa.Column("tentativas_login_falhas", sa.Integer(), nullable=False),
        sa.Column("bloqueado_ate", sa.DateTime(timezone=True), nullable=True),
        sa.Column("criado_em", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_usuario")),
        sa.UniqueConstraint("email", name=op.f("uq_usuario_email")),
    )

    # --- refresh_token: sessões de login ---
    op.create_table(
        "refresh_token",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("usuario_id", sa.Integer(), nullable=False),
        sa.Column("token_hash", sa.String(64), nullable=False),
        sa.Column("expira_em", sa.DateTime(timezone=True), nullable=False),
        sa.Column("revogado_em", sa.DateTime(timezone=True), nullable=True),
        sa.Column("criado_em", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.ForeignKeyConstraint(
            ["usuario_id"], ["usuario.id"], name=op.f("fk_refresh_token_usuario_id_usuario"), ondelete="CASCADE"
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_refresh_token")),
        sa.UniqueConstraint("token_hash", name=op.f("uq_refresh_token_token_hash")),
    )
    op.create_index(op.f("ix_refresh_token_usuario_id"), "refresh_token", ["usuario_id"])

    # --- leitor: dados pessoais (documento cifrado + HMAC) ---
    op.create_table(
        "leitor",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("usuario_id", sa.Integer(), nullable=True),
        sa.Column("nome", sa.String(150), nullable=False),
        sa.Column("email", sa.String(254), nullable=True),
        sa.Column("telefone", sa.String(30), nullable=True),
        sa.Column("documento_cifrado", sa.Text(), nullable=True),
        sa.Column("documento_hmac", sa.String(64), nullable=True),
        sa.Column("ativo", sa.Boolean(), nullable=False),
        sa.Column("criado_em", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("excluido_em", sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(
            ["usuario_id"], ["usuario.id"], name=op.f("fk_leitor_usuario_id_usuario"), ondelete="SET NULL"
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_leitor")),
        sa.UniqueConstraint("usuario_id", name=op.f("uq_leitor_usuario_id")),
        sa.UniqueConstraint("documento_hmac", name=op.f("uq_leitor_documento_hmac")),
    )
    op.create_index(op.f("ix_leitor_nome"), "leitor", ["nome"])

    # --- autor e categoria ---
    op.create_table(
        "autor",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("nome", sa.String(150), nullable=False),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_autor")),
    )
    op.create_index(op.f("ix_autor_nome"), "autor", ["nome"])

    op.create_table(
        "categoria",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("nome", sa.String(80), nullable=False),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_categoria")),
        sa.UniqueConstraint("nome", name=op.f("uq_categoria_nome")),
    )

    # --- livro (obra) ---
    op.create_table(
        "livro",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("titulo", sa.String(255), nullable=False),
        sa.Column("isbn", sa.String(13), nullable=True),
        sa.Column("editora", sa.String(150), nullable=True),
        sa.Column("ano_publicacao", sa.Integer(), nullable=True),
        sa.Column("categoria_id", sa.Integer(), nullable=True),
        sa.Column("criado_em", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.ForeignKeyConstraint(
            ["categoria_id"], ["categoria.id"], name=op.f("fk_livro_categoria_id_categoria"), ondelete="RESTRICT"
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_livro")),
        sa.UniqueConstraint("isbn", name=op.f("uq_livro_isbn")),
    )
    op.create_index(op.f("ix_livro_titulo"), "livro", ["titulo"])
    op.create_index(op.f("ix_livro_categoria_id"), "livro", ["categoria_id"])

    # --- livro_autor (N:N) ---
    op.create_table(
        "livro_autor",
        sa.Column("livro_id", sa.Integer(), nullable=False),
        sa.Column("autor_id", sa.Integer(), nullable=False),
        sa.ForeignKeyConstraint(
            ["livro_id"], ["livro.id"], name=op.f("fk_livro_autor_livro_id_livro"), ondelete="CASCADE"
        ),
        sa.ForeignKeyConstraint(
            ["autor_id"], ["autor.id"], name=op.f("fk_livro_autor_autor_id_autor"), ondelete="RESTRICT"
        ),
        sa.PrimaryKeyConstraint("livro_id", "autor_id", name=op.f("pk_livro_autor")),
    )

    # --- exemplar (cópia física) ---
    op.create_table(
        "exemplar",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("livro_id", sa.Integer(), nullable=False),
        sa.Column("codigo", sa.String(30), nullable=False),
        sa.Column(
            "situacao",
            sa.Enum("ATIVO", "EXTRAVIADO", "BAIXADO", name="situacaoexemplar", native_enum=False, length=20),
            nullable=False,
        ),
        sa.Column("criado_em", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.ForeignKeyConstraint(
            ["livro_id"], ["livro.id"], name=op.f("fk_exemplar_livro_id_livro"), ondelete="CASCADE"
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_exemplar")),
        sa.UniqueConstraint("codigo", name=op.f("uq_exemplar_codigo")),
    )
    op.create_index(op.f("ix_exemplar_livro_id"), "exemplar", ["livro_id"])

    # --- emprestimo ---
    op.create_table(
        "emprestimo",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("exemplar_id", sa.Integer(), nullable=False),
        sa.Column("leitor_id", sa.Integer(), nullable=False),
        sa.Column("data_saida", sa.Date(), nullable=False),
        sa.Column("data_prevista", sa.Date(), nullable=False),
        sa.Column("data_devolucao", sa.Date(), nullable=True),
        sa.Column("registrado_por_id", sa.Integer(), nullable=False),
        sa.Column("recebido_por_id", sa.Integer(), nullable=True),
        sa.Column("criado_em", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.CheckConstraint("data_prevista >= data_saida", name=op.f("ck_emprestimo_prazo_valido")),
        sa.ForeignKeyConstraint(
            ["exemplar_id"], ["exemplar.id"], name=op.f("fk_emprestimo_exemplar_id_exemplar"), ondelete="RESTRICT"
        ),
        sa.ForeignKeyConstraint(
            ["leitor_id"], ["leitor.id"], name=op.f("fk_emprestimo_leitor_id_leitor"), ondelete="RESTRICT"
        ),
        sa.ForeignKeyConstraint(
            ["registrado_por_id"],
            ["usuario.id"],
            name=op.f("fk_emprestimo_registrado_por_id_usuario"),
            ondelete="RESTRICT",
        ),
        sa.ForeignKeyConstraint(
            ["recebido_por_id"],
            ["usuario.id"],
            name=op.f("fk_emprestimo_recebido_por_id_usuario"),
            ondelete="RESTRICT",
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_emprestimo")),
    )
    op.create_index(op.f("ix_emprestimo_exemplar_id"), "emprestimo", ["exemplar_id"])
    op.create_index(op.f("ix_emprestimo_leitor_id"), "emprestimo", ["leitor_id"])
    op.create_index(op.f("ix_emprestimo_data_prevista"), "emprestimo", ["data_prevista"])
    # Um exemplar só pode ter um empréstimo em aberto (índice único parcial)
    op.create_index(
        "uq_emprestimo_exemplar_ativo",
        "emprestimo",
        ["exemplar_id"],
        unique=True,
        postgresql_where=sa.text("data_devolucao IS NULL"),
        sqlite_where=sa.text("data_devolucao IS NULL"),
    )

    # --- configuracao (linha única com os valores padrão) ---
    configuracao = op.create_table(
        "configuracao",
        sa.Column("id", sa.Integer(), autoincrement=False, nullable=False),
        sa.Column("prazo_padrao_dias", sa.Integer(), nullable=False),
        sa.Column("max_emprestimos_por_leitor", sa.Integer(), nullable=False),
        sa.Column("bloquear_leitor_com_atraso", sa.Boolean(), nullable=False),
        sa.Column("dias_aviso_vencimento", sa.Integer(), nullable=False),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_configuracao")),
    )
    op.bulk_insert(
        configuracao,
        [
            {
                "id": 1,
                "prazo_padrao_dias": 14,
                "max_emprestimos_por_leitor": 3,
                "bloquear_leitor_com_atraso": True,
                "dias_aviso_vencimento": 3,
            }
        ],
    )

    # --- Busca rápida por trecho de texto (somente PostgreSQL) ---
    if op.get_bind().dialect.name == "postgresql":
        op.execute("CREATE EXTENSION IF NOT EXISTS pg_trgm")
        op.create_index(
            "ix_livro_titulo_trgm",
            "livro",
            ["titulo"],
            postgresql_using="gin",
            postgresql_ops={"titulo": "gin_trgm_ops"},
        )
        op.create_index(
            "ix_autor_nome_trgm",
            "autor",
            ["nome"],
            postgresql_using="gin",
            postgresql_ops={"nome": "gin_trgm_ops"},
        )


def downgrade() -> None:
    # Remove na ordem inversa da criação (por causa das chaves estrangeiras)
    op.drop_table("configuracao")
    op.drop_table("emprestimo")
    op.drop_table("exemplar")
    op.drop_table("livro_autor")
    op.drop_table("livro")
    op.drop_table("categoria")
    op.drop_table("autor")
    op.drop_table("leitor")
    op.drop_table("refresh_token")
    op.drop_table("usuario")
