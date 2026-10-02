"""Testes de autenticação e controle de acesso (RF07)."""

import pytest

from app.core.erros import NaoAutorizado
from app.modules.auth import service as auth_service
from app.modules.auth.router import NOME_COOKIE
from tests.apoio import EMAIL_GESTOR, SENHA, fazer_login


def test_login_devolve_token_e_rota_protegida_funciona(client, gestor):
    resposta = client.get("/api/usuarios/me", headers=gestor)
    assert resposta.status_code == 200
    assert resposta.json()["papel"] == "GESTOR"


def test_senha_nunca_e_salva_em_texto_puro(client, gestor, db):
    from app.modules.usuarios.models import Usuario

    usuario = db.query(Usuario).filter_by(email=EMAIL_GESTOR).one()
    assert usuario.senha_hash != SENHA
    assert usuario.senha_hash.startswith("$argon2id$")


def test_senha_errada_retorna_401(client, gestor):
    resposta = client.post("/api/auth/login", json={"email": EMAIL_GESTOR, "senha": "errada"})
    assert resposta.status_code == 401


def test_bloqueio_apos_muitas_tentativas(client, gestor):
    for _ in range(5):
        client.post("/api/auth/login", json={"email": EMAIL_GESTOR, "senha": "errada"})
    # Mesmo com a senha certa, a conta fica bloqueada temporariamente
    resposta = client.post("/api/auth/login", json={"email": EMAIL_GESTOR, "senha": SENHA})
    assert resposta.status_code == 429


def test_rota_protegida_sem_token_retorna_401(client):
    assert client.get("/api/leitores").status_code == 401


def test_leitor_nao_acessa_rotas_de_gestor(client, gestor):
    leitor = client.post(
        "/api/leitores", json={"nome": "Bruno Lima", "email": "bruno@libreleitura.com.br"}, headers=gestor
    ).json()
    resposta = client.post(f"/api/leitores/{leitor['id']}/acesso", json={"senha": SENHA}, headers=gestor)
    assert resposta.status_code == 201
    assert resposta.json()["possui_acesso"] is True

    headers_leitor = fazer_login(client, "bruno@libreleitura.com.br")
    assert client.get("/api/leitores", headers=headers_leitor).status_code == 403
    assert client.get("/api/me/emprestimos", headers=headers_leitor).status_code == 200


def test_refresh_gera_novo_token_e_invalida_o_antigo(client, gestor, db):
    login = client.post("/api/auth/login", json={"email": EMAIL_GESTOR, "senha": SENHA})
    refresh_antigo = login.cookies.get(NOME_COOKIE)
    assert refresh_antigo

    resposta = client.post("/api/auth/refresh")
    assert resposta.status_code == 200
    assert resposta.json()["access_token"]

    # Rotação: o refresh token antigo não pode ser reutilizado
    with pytest.raises(NaoAutorizado):
        auth_service.renovar(db, refresh_antigo)


def test_logout_encerra_a_sessao(client, gestor):
    client.post("/api/auth/login", json={"email": EMAIL_GESTOR, "senha": SENHA})
    assert client.post("/api/auth/logout").status_code == 204
    assert client.post("/api/auth/refresh").status_code == 401
