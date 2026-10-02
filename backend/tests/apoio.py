"""Constantes e funções auxiliares compartilhadas pelos testes."""

from fastapi.testclient import TestClient

SENHA = "senha-segura-123"
EMAIL_GESTOR = "gestora@libreleitura.com.br"


def fazer_login(client: TestClient, email: str, senha: str = SENHA) -> dict:
    """Faz login e devolve o header Authorization pronto."""
    resposta = client.post("/api/auth/login", json={"email": email, "senha": senha})
    assert resposta.status_code == 200, resposta.text
    return {"Authorization": f"Bearer {resposta.json()['access_token']}"}
