"""Testes do cadastro de leitores (RF02) e da proteção do documento."""

from app.modules.circulacao.models import Emprestimo
from app.modules.leitores.models import Leitor
from app.modules.leitores.service import NOME_ANONIMIZADO


def test_documento_e_cifrado_no_banco_e_exibido_na_api(client, gestor, db):
    resposta = client.post("/api/leitores", json={"nome": "Davi Rocha", "documento": "123.456.789-00"}, headers=gestor)
    assert resposta.status_code == 201
    leitor = resposta.json()
    assert leitor["documento"] == "12345678900"

    registro = db.get(Leitor, leitor["id"])
    assert "12345678900" not in registro.documento_cifrado
    assert len(registro.documento_hmac) == 64


def test_busca_por_documento_completo(client, gestor):
    client.post("/api/leitores", json={"nome": "Eva Prado", "documento": "123.456.789-00"}, headers=gestor)
    resposta = client.get("/api/leitores", params={"q": "123.456.789-00"}, headers=gestor)
    assert resposta.json()["total"] == 1


def test_documento_duplicado_retorna_409(client, gestor):
    client.post("/api/leitores", json={"nome": "Fabio Melo", "documento": "MAT-001"}, headers=gestor)
    resposta = client.post("/api/leitores", json={"nome": "Outro", "documento": "mat001"}, headers=gestor)
    assert resposta.status_code == 409


def test_excluir_leitor_com_historico_anonimiza_os_dados(client, gestor, cenario, db):
    leitor_id = cenario["leitor"]["id"]
    codigo = cenario["livro"]["exemplares"][0]["codigo"]
    client.post("/api/emprestimos", json={"leitor_id": leitor_id, "codigo_exemplar": codigo}, headers=gestor)

    # Com empréstimo em aberto não pode excluir
    assert client.delete(f"/api/leitores/{leitor_id}", headers=gestor).status_code == 409

    client.post("/api/devolucoes", json={"codigo_exemplar": codigo}, headers=gestor)
    assert client.delete(f"/api/leitores/{leitor_id}", headers=gestor).status_code == 204
    assert client.get(f"/api/leitores/{leitor_id}", headers=gestor).status_code == 404

    registro = db.get(Leitor, leitor_id)
    assert registro.nome == NOME_ANONIMIZADO
    assert registro.documento_cifrado is None
    assert db.query(Emprestimo).filter_by(leitor_id=leitor_id).count() == 1  # histórico preservado


def test_excluir_leitor_sem_historico_apaga_o_registro(client, gestor, db):
    leitor = client.post("/api/leitores", json={"nome": "Gabi Torres"}, headers=gestor).json()
    assert client.delete(f"/api/leitores/{leitor['id']}", headers=gestor).status_code == 204
    assert db.get(Leitor, leitor["id"]) is None
