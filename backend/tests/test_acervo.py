"""Testes do acervo: cadastro de livros (RF01) e consulta pública (RF05)."""


def test_cadastro_de_livro_gera_exemplares(cenario):
    livro = cenario["livro"]
    assert livro["isbn"] == "9788535902777"  # normalizado, sem traços
    assert livro["total_exemplares"] == 2
    assert livro["exemplares_disponiveis"] == 2
    assert livro["status"] == "DISPONIVEL"
    codigos = [e["codigo"] for e in livro["exemplares"]]
    assert len(set(codigos)) == 2


def test_busca_publica_por_titulo_autor_e_categoria(client, cenario):
    for termo in ("casmurro", "machado", "romance"):
        resposta = client.get("/api/livros", params={"q": termo})  # sem login
        assert resposta.status_code == 200
        assert resposta.json()["total"] == 1, termo


def test_busca_sem_resultado(client, cenario):
    assert client.get("/api/livros", params={"q": "inexistente"}).json()["total"] == 0


def test_isbn_duplicado_retorna_409(client, gestor, cenario):
    dados = {"titulo": "Outro", "isbn": "9788535902777", "autor_ids": [cenario["autor"]["id"]]}
    assert client.post("/api/livros", json=dados, headers=gestor).status_code == 409


def test_isbn_invalido_retorna_422(client, gestor, cenario):
    dados = {"titulo": "Outro", "isbn": "123", "autor_ids": [cenario["autor"]["id"]]}
    assert client.post("/api/livros", json=dados, headers=gestor).status_code == 422


def test_cadastro_exige_gestor(client):
    resposta = client.post("/api/livros", json={"titulo": "X", "autor_ids": [1]})
    assert resposta.status_code == 401


def test_exemplar_baixado_deixa_livro_indisponivel(client, gestor, cenario):
    livro = cenario["livro"]
    for exemplar in livro["exemplares"]:
        resposta = client.patch(f"/api/exemplares/{exemplar['id']}", json={"situacao": "BAIXADO"}, headers=gestor)
        assert resposta.status_code == 200
    detalhe = client.get(f"/api/livros/{livro['id']}").json()
    assert detalhe["status"] == "INDISPONIVEL"
