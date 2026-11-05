# LibreLeitura — Especificação do frontend (para o Lovable)

Use este documento como contexto principal ao criar o projeto no Lovable. Ele descreve **o que construir**, **com qual API conversar** e **como a interface deve se comportar**. A API já existe (backend FastAPI) e não deve ser alterada.

---

## 0. Instruções para o Lovable (leia primeiro)

1. **Não use Supabase, Lovable Cloud nem banco de dados próprio.** Todos os dados vêm da API REST descrita abaixo, via `fetch`. Não crie tabelas, edge functions ou autenticação do Supabase.
2. **Não invente endpoints.** Use somente as rotas da seção 6. Se um campo de corpo de requisição não estiver descrito aqui, confira o Swagger da API em `/api/docs` (disponível em desenvolvimento) antes de adivinhar.
3. **Construa em etapas pequenas**, uma tela por vez, na ordem da seção 9. Não tente gerar tudo de uma vez.
4. **Textos da interface em português do Brasil.** Mensagens de erro vêm da API já em português; exiba-as como estão.
5. **Não crie testes de unidade extensos** nem páginas que não estejam listadas aqui.

---

## 1. Visão geral

**LibreLeitura** é um sistema para pequenas bibliotecas e salas de leitura. Ele faz:

- cadastro de livros (obra), exemplares (cópias físicas), autores e categorias;
- cadastro de leitores;
- empréstimos e devoluções;
- consulta pública do acervo com disponibilidade em tempo real;
- painel de pendências (atrasados e a vencer).

O sistema tem dois públicos:

- **GESTOR**: bibliotecário/administrador. Usa o sistema no balcão, em um computador de mesa. Precisa de agilidade.
- **LEITOR**: usuário final. Consulta o catálogo e vê os próprios empréstimos. Pode usar celular.

---

## 2. Stack e restrições técnicas

- **React + TypeScript + Vite + Tailwind CSS** (padrão do Lovable). Use uma biblioteca de componentes já disponível no Lovable (shadcn/ui) para tabelas, modais, formulários e toasts.
- **Roteamento**: React Router.
- **Estado do servidor**: TanStack Query (React Query) para cache, loading e erros.
- **Formulários**: react-hook-form + zod.
- **Cliente HTTP**: `fetch` encapsulado num único módulo `src/lib/api.ts`. Não espalhe chamadas `fetch` pelos componentes.
- **Base da API**: variável de ambiente `VITE_API_URL`. Se estiver vazia, use `/api` (o site e a API ficam no mesmo domínio em produção). Em desenvolvimento local, o Vite deve ter proxy de `/api` para `http://localhost:8000`.
- **Sem SSR.** É uma SPA estática, hospedada no S3 + CloudFront.
- **Tokens**: o access token fica **somente em memória** (variável/estado do React, ou contexto de autenticação). **Nunca** em `localStorage` ou `sessionStorage`.
- **Refresh token**: é um cookie `httpOnly` gerenciado pelo navegador. O frontend nunca o lê. Use `credentials: "include"` em todas as chamadas à API.

---

## 3. Autenticação e sessão

### Fluxo de login
1. `POST /api/auth/login` com corpo `{ "email": "...", "senha": "..." }`.
2. A resposta traz `access_token`, `expira_em_segundos` e `usuario` (com `papel`: `GESTOR` ou `LEITOR`). O cookie de refresh é gravado automaticamente.
3. Guarde o token em memória e o usuário no contexto de autenticação.
4. Redirecione conforme o papel: **GESTOR → Painel**; **LEITOR → Meus empréstimos**.

### Chamadas autenticadas
- Header: `Authorization: Bearer <access_token>`.
- Se a resposta for **401**, chame `POST /api/auth/refresh` (sem corpo; o cookie vai sozinho), guarde o novo token e **repita a requisição original uma vez**.
- Se o refresh também falhar, limpe a sessão e leve o usuário para o login com a mensagem "Sua sessão expirou".

### Logout
- `POST /api/auth/logout`, depois limpe o estado em memória e vá para o login.

### Proteção de rotas
- Rotas de GESTOR só são acessíveis se `usuario.papel === "GESTOR"`. Caso contrário, redirecione para o catálogo.
- Rotas de LEITOR exigem usuário logado.
- Use `GET /api/usuarios/me` ao recarregar a página, se houver token válido, para restaurar o usuário.

### Erros de login
- E-mail ou senha incorretos: exibir a mensagem da API.
- **429** (conta bloqueada após 5 tentativas): exibir a mensagem da API, que informa o tempo de bloqueio.

---

## 4. Convenções da API

- **Base**: `/api`. Todas as rotas abaixo são relativas a ela.
- **Erros** sempre no formato `{ "detail": "mensagem em português" }`.
- **Erro de validação (422)**: `detail` é uma lista de campos. Mostre a mensagem junto do campo correspondente quando possível.
- **Listagens paginadas** respondem `{ "itens": [...], "total": 0, "limite": 20, "deslocamento": 0 }`. Use `?limite=20&deslocamento=0`. Implemente paginação com botões Anterior/Próximo e o texto "Mostrando X–Y de Z".
- **Status HTTP usados**: 401 (não autenticado), 403 (sem permissão), 404, 409 (conflito, ex.: exemplar já emprestado), 422 (regra de negócio violada, ex.: limite atingido), 429 (bloqueio).

---

## 5. Modelo de domínio (para entender a interface)

- **Livro**: a obra (título, autores, editora, ano, ISBN opcional, categoria).
- **Exemplar**: cópia física de um livro, com código no formato `LL000042-001` e situação `ATIVO`, `EXTRAVIADO` ou `BAIXADO`.
- **Empréstimo**: um exemplar retirado por um leitor. Está **em aberto** enquanto não tiver data de devolução.
- **Disponibilidade** (calculada pela API): o exemplar está `ATIVO` e não tem empréstimo em aberto.
- **Atraso**: empréstimo em aberto cuja data prevista já passou.

Na interface do catálogo, o status de um livro é:
- `DISPONIVEL` (verde): há exemplar disponível;
- `EMPRESTADO` (âmbar): há exemplares, mas todos estão emprestados;
- `INDISPONIVEL` (cinza): não há exemplar ativo.

**Regra de exibição:** sempre mostrar o texto do status junto da cor (ícone + texto). Nunca só a cor.

---

## 6. Rotas da API usadas pelo frontend

| Método e rota | Acesso | Uso no frontend |
|---|---|---|
| `POST /auth/login` | público | Tela de login |
| `POST /auth/refresh` | cookie | Renovar sessão em 401 |
| `POST /auth/logout` | cookie | Sair |
| `GET /usuarios/me` | logado | Restaurar sessão; dados de "Meus dados" |
| `PUT /usuarios/me/senha` | logado | Trocar a própria senha |
| `GET, POST /usuarios` · `PATCH /usuarios/{id}` | GESTOR | Tela Equipe |
| `GET, POST /leitores` · `GET, PATCH, DELETE /leitores/{id}` | GESTOR | Tela Leitores |
| `POST /leitores/{id}/acesso` | GESTOR | Criar login do leitor |
| `GET /livros` · `GET /livros/{id}` | **público** | Catálogo e detalhe do livro |
| `POST /livros` · `PATCH, DELETE /livros/{id}` | GESTOR | Cadastro/edição de livros |
| `POST /livros/{id}/exemplares` | GESTOR | Adicionar exemplares |
| `GET /exemplares` · `PATCH /exemplares/{id}` | GESTOR | Busca no balcão; extravio/baixa |
| `GET /autores` · `GET /categorias` | público | Filtros e seleção em formulários |
| `POST, PUT, DELETE /autores` · `/categorias` | GESTOR | Manutenção de autores e categorias |
| `POST /emprestimos` | GESTOR | Registrar empréstimo |
| `GET /emprestimos?situacao=EM_ABERTO\|ATRASADO\|A_VENCER\|DEVOLVIDO` | GESTOR | Tela Empréstimos |
| `POST /devolucoes` | GESTOR | Devolução pelo código do exemplar (balcão) |
| `POST /emprestimos/{id}/devolucao` | GESTOR | Devolução pelo painel/lista |
| `GET /me/emprestimos` | logado | Meus empréstimos (LEITOR) |
| `GET /alertas/pendencias` | GESTOR | Painel de pendências |
| `GET, PATCH /configuracao` | GESTOR | Tela Configurações |
| `GET /health` | público | Não usar no frontend |

**Campos de corpo a confirmar no Swagger (`/api/docs`) antes de implementar:**
- `POST /emprestimos`: `{ leitor_id, exemplar_id }`. Também aceita código do exemplar no lugar do id. Use `exemplar_id` por padrão.
- `POST /devolucoes`: informe o código do exemplar (confirme o nome exato do campo).
- Estruturas de `Livro`, `Exemplar`, `Leitor`, `Emprestimo` e `Pendencias`: use o que o Swagger mostrar.

---

## 7. Telas

### 7.1 Login (pública)
- Campos: e-mail, senha (com botão mostrar/ocultar).
- Botão "Entrar". Desabilitado durante a requisição.
- Erros exibidos abaixo do formulário.
- Sem cadastro: o leitor não se cadastra sozinho.

### 7.2 Catálogo (pública, também acessível logado)
- Cabeçalho simples com logo, link para Entrar (ou "Meus empréstimos" e "Sair" se logado).
- Campo de busca grande no topo (pesquisa por título e autor; use `GET /livros` com o parâmetro de busca que o Swagger indicar).
- Filtro por categoria (`GET /categorias`) e por status de disponibilidade.
- Grade de cards em desktop e lista em celular. Cada card: título, autor(es), categoria, badge de status com texto.
- Clique no card abre o **detalhe do livro**: dados completos, lista de exemplares com situação e status de disponibilidade, e a data prevista de devolução do próximo exemplar quando indisponível (se a API informar).
- Paginação no final da lista.

### 7.3 Meus empréstimos (LEITOR logado)
- Lista de `GET /me/emprestimos`: título, código do exemplar, data de retirada, data prevista de devolução, data de devolução (se houver).
- Destaque visual para atrasados (ícone + texto "Atrasado há X dias").
- Sem ações de devolução para o leitor.

### 7.4 Painel de pendências (GESTOR, tela inicial)
- Cartões no topo com contagens (de `GET /alertas/pendencias`): **Atrasados**, **Vencem em N dias**, e outros totais que a resposta trouxer.
- Duas tabelas: **Atrasados** e **A vencer**.
- Colunas: leitor (nome), e-mail, telefone (clicável para `mailto:` e `tel:`), livro, código do exemplar, data prevista, dias de atraso ou faltantes.
- Ação por linha: "Registrar devolução" (chama `POST /emprestimos/{id}/devolucao` após confirmação em modal).
- Atualizar a lista após devolução.

### 7.5 Balcão (GESTOR) — **tela mais importante**
Objetivo: registrar empréstimo e devolução com o mínimo de cliques, em teclado e leitor de código de barras.

**Aba Empréstimo (fluxo em 3 passos na mesma tela):**
1. **Leitor**: campo de busca com autocomplete (`GET /leitores?q=...`). Mostra nome, matrícula/e-mail. Ao selecionar, o leitor fica fixado no topo com um resumo: número de empréstimos ativos e se há atraso (se a API informar). Se o leitor estiver bloqueado, mostrar aviso e desabilitar o próximo passo com a mensagem da API.
2. **Exemplar**: campo de busca com autocomplete (`GET /exemplares?q=...&somente_disponiveis=true`). Aceita código de barras: um leitor USB digita o código seguido de Enter. Quando o código bater exatamente com um exemplar, selecione-o automaticamente.
3. **Confirmar**: botão "Confirmar empréstimo" (`POST /emprestimos`). A data limite é calculada pela API; mostre-a na confirmação, vinda da resposta.

Após sucesso: toast "Empréstimo registrado", limpe o exemplar, **mantenha o leitor selecionado** (várias retiradas seguidas da mesma pessoa), e devolva o foco ao campo de exemplar.

Erros: 409 (exemplar já emprestado) e 422 (limite atingido, leitor com atraso, exemplar não disponível) mostram a mensagem da API em um alerta e não limpam os campos.

**Aba Devolução:**
- Campo com foco automático para código do exemplar (leitor de código de barras).
- Enter envia `POST /devolucoes`. Mostra resultado (título, leitor, se estava atrasado) e limpa o campo para a próxima.
- Mensagem de sucesso visível por alguns segundos, e foco de volta no campo.

**Teclado:** Enter confirma no passo atual; Esc limpa a seleção; o foco nunca deve sair do fluxo sem ação do usuário.

### 7.6 Empréstimos (GESTOR)
- Filtros: situação (Em aberto, Atrasado, A vencer, Devolvido) e busca por leitor ou livro.
- Tabela paginada (`GET /emprestimos`): leitor, livro, código do exemplar, retirada, prevista, devolução, situação.
- Ação "Devolver" nas linhas em aberto.

### 7.7 Acervo (GESTOR)
- Lista de livros com busca, paginação e botão "Novo livro".
- **Formulário de livro**: título (obrigatório), autores (seleção múltipla a partir de `GET /autores`, com opção de criar novo), editora, ano, ISBN (opcional, validar formato), categoria (opcional, de `GET /categorias`).
- **Detalhe do livro**: dados + tabela de exemplares + botão "Adicionar exemplares" (`POST /livros/{id}/exemplares`, com quantidade). Cada exemplar pode ser marcado como extraviado ou baixado (`PATCH /exemplares/{id}`), com confirmação.
- Exclusão de livro: confirmação em modal. Se a API recusar (livro já emprestado), mostrar a mensagem da API.
- Autores e categorias: uma sub-aba ou modais simples de listar, criar, editar e excluir.

### 7.8 Leitores (GESTOR)
- Lista com busca e paginação (`GET /leitores`).
- Formulário: nome, e-mail, telefone, documento (validar; o backend cifra). O documento **não é exibido** após salvar, só mascarado se a API devolver máscara.
- Detalhe do leitor: dados, empréstimos (histórico), botão "Criar acesso" (`POST /leitores/{id}/acesso`, pede e-mail e senha inicial).
- Exclusão: confirmação em modal. Explicar na confirmação: "Se o leitor tiver histórico, os dados pessoais serão anonimizados. Empréstimos em aberto impedem a exclusão." A mensagem final vem da API.

### 7.9 Equipe (GESTOR)
- Lista de usuários do sistema (`GET /usuarios`), com papel e status ativo/inativo.
- Criar gestor e editar (ativar/desativar) via `PATCH /usuarios/{id}`.

### 7.10 Configurações (GESTOR)
- Campos: prazo padrão em dias, máximo de empréstimos por leitor, bloquear leitor com atraso (liga/desliga), dias de aviso antes do vencimento.
- Carregar com `GET /configuracao` e salvar com `PATCH /configuracao`.

### 7.11 Meus dados (logado, ambos os papéis)
- Exibir nome e e-mail (`GET /usuarios/me`).
- Trocar senha: senha atual e nova senha com confirmação (`PUT /usuarios/me/senha`).

---

## 8. Navegação

- **Visitante**: cabeçalho com Catálogo e Entrar.
- **LEITOR**: cabeçalho com Catálogo, Meus empréstimos, Meus dados e Sair.
- **GESTOR**: menu lateral fixo com Painel, Balcão, Empréstimos, Acervo, Leitores, Equipe, Configurações, Meus dados e Sair. Em telas pequenas, o menu vira gaveta.
- Página 404 simples com link para a tela inicial do papel.

---

## 9. Ordem de construção (sugestão de prompts)

1. Estrutura base: rotas, layout público, layout do gestor (menu lateral), cliente `api.ts`, contexto de autenticação com o refresh automático.
2. Tela de Login com integração real (`POST /auth/login`).
3. Catálogo público com busca, filtros e detalhe do livro.
4. Meus empréstimos (LEITOR).
5. Painel de pendências (GESTOR).
6. Balcão: aba Empréstimo, depois aba Devolução.
7. Empréstimos (consulta).
8. Acervo: livros, exemplares, autores e categorias.
9. Leitores.
10. Equipe e Configurações.
11. Meus dados.

Após cada etapa, teste com o backend rodando localmente antes de seguir.

---

## 10. Design visual

- **Tom**: sóbrio, limpo e funcional. Parece um sistema de gestão, não um site comercial.
- **Paleta**: fundo claro, texto escuro, um azul como cor principal (ações), verde para sucesso/disponível, âmbar para atenção/a vencer, vermelho para atraso/erro, cinza para neutro/indisponível. Contraste de texto WCAG AA.
- **Tipografia**: uma fonte sans-serif legível (ex.: Inter). Tamanho base 16px.
- **Densidade**: tabelas compactas no gestor; espaçamento generoso no catálogo público.
- **Estados obrigatórios em toda lista e formulário**:
  - *Carregando*: skeleton ou spinner, sem tela em branco.
  - *Vazio*: mensagem clara (ex.: "Nenhum empréstimo em aberto").
  - *Erro*: mensagem da API + botão "Tentar novamente".
- **Feedback**: toast para sucesso; confirmação em modal para ações destrutivas (excluir, baixar exemplar, devolver).
- **Acessibilidade**: todo campo com rótulo; foco visível; status com texto e ícone; navegação por teclado.
- **Responsivo**: funcional em celular para o catálogo e meus empréstimos; desktop otimizado para o balcão.

---

## 11. Textos e formatos

- Datas: `dd/mm/aaaa` (fuso `America/Sao_Paulo`). A API envia datas em ISO; converta na exibição.
- Números e contagens: separador de milhar em português.
- Mensagens de erro: vêm da API; não traduza nem reescreva.
- Não exibir hashes, senhas nem o documento do leitor em texto puro.

---

## 12. O que não fazer

- Não usar Supabase, Lovable Cloud ou qualquer banco próprio.
- Não guardar token em `localStorage`/`sessionStorage`.
- Não inventar campos ou rotas fora das listadas.
- Não implementar cadastro público de leitor (o gestor cadastra).
- Não implementar funções fora do escopo: envio de e-mail, redefinição de senha por e-mail, renovação, reserva, multa.
- Não exibir o link do Swagger para o usuário final.

---

## 13. Critérios de aceite

- [ ] Login funciona; gestor e leitor caem nas telas certas.
- [ ] Refresh automático em 401 funciona e não pede login de novo sem necessidade.
- [ ] Catálogo mostra disponibilidade correta e funciona sem login.
- [ ] Balcão registra empréstimo e devolução usando teclado e código de barras.
- [ ] Erros 409 e 422 aparecem com a mensagem da API.
- [ ] Painel mostra atrasados e a vencer, com contatos clicáveis.
- [ ] Todas as listas têm paginação, estados de carregamento, vazio e erro.
- [ ] Nenhuma rota fora da seção 6 é chamada.
- [ ] Nenhum token é salvo em armazenamento do navegador.
- [ ] Interface em português, sem textos em inglês.
