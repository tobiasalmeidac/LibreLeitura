#!/usr/bin/env bash
# Aplica as migrações pendentes do banco (Alembic).
# Executado automaticamente no deploy, apenas na instância líder (ver .ebextensions/01_libreleitura.config).
set -eo pipefail  # para no primeiro erro (sem -u: o script "activate" do venv usa variáveis opcionais)

source "$(dirname "$0")/ambiente_eb.sh"
alembic upgrade head
