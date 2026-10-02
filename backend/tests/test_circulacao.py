"""Testes de empréstimo (RF03), devolução (RF04) e painel de pendências (RF06)."""

from datetime import timedelta

from sqlalchemy import update

from app.core.datas import hoje
from app.modules.circulacao.models import Emprestimo


def _emprestar(client, gestor, leitor_id, codigo, **extra):
    return client.post(
        "/api/emprestimos", json={"leitor_id": leitor_id, "codigo_exemplar": codigo, **extra}, headers=gestor
    )


def test_emprestimo_e_devolucao_atualizam_disponibilidade(client, gestor, cenario):
    livro, leitor = cenario["livro"], cenario["leitor"]
    codigo = livro["exemplares"][0]["codigo"]

    resposta = _emprestar(client, gestor, leitor["id"], codigo)
    assert resposta.status_code == 201, resposta.text
    emprestimo = resposta.json()
    assert emprestimo["situacao"] == "EM_DIA"
    assert emprestimo["data_prevista"] == (hoje() + timedelta(days=14)).isoformat()  # prazo padrão
    assert client.get(f"/api/livros/{livro['id']}").json()["exemplares_disponiveis"] == 1

    resposta = client.post("/api/devolucoes", json={"codigo_exemplar": codigo}, headers=gestor)
    assert resposta.status_code == 200
    assert resposta.json()["situacao"] == "DEVOLVIDO"
    assert client.get(f"/api/livros/{livro['id']}").json()["exemplares_disponiveis"] == 2


def test_exemplar_ja_emprestado_retorna_409(client, gestor, cenario):
    codigo = cenario["livro"]["exemplares"][0]["codigo"]
    _emprestar(client, gestor, cenario["leitor"]["id"], codigo)
    outro = client.post("/api/leitores", json={"nome": "Carlos Dias"}, headers=gestor).json()
    assert _emprestar(client, gestor, outro["id"], codigo).status_code == 409


def test_limite_de_emprestimos_por_leitor(client, gestor, cenario):
    client.patch("/api/configuracao", json={"max_emprestimos_por_leitor": 1}, headers=gestor)
    exemplares = cenario["livro"]["exemplares"]
    leitor_id = cenario["leitor"]["id"]
    assert _emprestar(client, gestor, leitor_id, exemplares[0]["codigo"]).status_code == 201
    assert _emprestar(client, gestor, leitor_id, exemplares[1]["codigo"]).status_code == 422


def test_devolucao_sem_emprestimo_retorna_404(client, gestor, cenario):
    codigo = cenario["livro"]["exemplares"][0]["codigo"]
    assert client.post("/api/devolucoes", json={"codigo_exemplar": codigo}, headers=gestor).status_code == 404


def test_atraso_aparece_no_painel_e_bloqueia_novo_emprestimo(client, gestor, cenario, db):
    exemplares = cenario["livro"]["exemplares"]
    leitor_id = cenario["leitor"]["id"]
    emprestimo = _emprestar(client, gestor, leitor_id, exemplares[0]["codigo"]).json()

    # Simula um empréstimo feito há 20 dias com prazo vencido há 5 dias
    db.execute(
        update(Emprestimo)
        .where(Emprestimo.id == emprestimo["id"])
        .values(data_saida=hoje() - timedelta(days=20), data_prevista=hoje() - timedelta(days=5))
    )
    db.commit()

    painel = client.get("/api/alertas/pendencias", headers=gestor).json()
    assert painel["resumo"] == {"em_aberto": 1, "atrasados": 1, "a_vencer": 0}
    assert painel["atrasados"][0]["dias_atraso"] == 5
    assert painel["atrasados"][0]["leitor_nome"] == "Ana Souza"

    # Leitor com atraso não pode pegar outro livro (regra padrão da configuração)
    assert _emprestar(client, gestor, leitor_id, exemplares[1]["codigo"]).status_code == 422


def test_emprestimo_prestes_a_vencer_aparece_no_painel(client, gestor, cenario):
    codigo = cenario["livro"]["exemplares"][0]["codigo"]
    prazo = (hoje() + timedelta(days=2)).isoformat()
    assert _emprestar(client, gestor, cenario["leitor"]["id"], codigo, data_prevista=prazo).status_code == 201

    painel = client.get("/api/alertas/pendencias", headers=gestor).json()
    assert painel["resumo"]["a_vencer"] == 1
    assert painel["a_vencer"][0]["dias_para_vencer"] == 2
