#!/usr/bin/env bash
# Prepara um shell DENTRO da instância EC2 do Elastic Beanstalk:
#   1) ativa o ambiente virtual Python criado pelo EB;
#   2) exporta as variáveis de ambiente configuradas no EB (AWS_SECRET_*, DB_HOST...).
# Uso manual (via SSM Session Manager):  cd /var/app/current && source scripts/ambiente_eb.sh

# 1) Ativa o venv do Elastic Beanstalk
source "$(ls -d /var/app/venv/*/bin | head -n 1)/activate"

# 2) Converte o JSON do get-config em linhas "export NOME='valor'"
eval "$(/opt/elasticbeanstalk/bin/get-config environment | python -c 'import json, shlex, sys; [print("export " + k + "=" + shlex.quote(v)) for k, v in json.load(sys.stdin).items()]')"
