# LibreLeitura — roteiro (seção 9 da especificação)

- [x] 1. Estrutura base: rotas, layouts, cliente da API, sessão com renovação automática
- [x] 2. Login
- [x] 3. Catálogo público com busca, filtros e detalhe do livro
- [x] 4. Meus empréstimos (LEITOR)
- [x] 5. Painel de pendências (GESTOR)
- [x] 6. Balcão: Empréstimo e Devolução
- [x] 7. Empréstimos (consulta)
- [x] 8. Acervo: livros, exemplares, autores e categorias
- [x] 9. Leitores
- [x] 10. Equipe e Configurações
- [x] 11. Meus dados (adiantado: já está no menu do leitor)
- [x] Campos conferidos com o `openapi.json` (gerado de `app.openapi()` e salvo nesta pasta)

Verificado no navegador (Chrome, backend em SQLite de teste): login, balcão (empréstimo e devolução),
catálogo público, leitor, cadastros de leitor, livro, gestor e configurações, e detalhe do acervo.
Pendente: rodar contra PostgreSQL real e checar o deploy (CloudFront/S3).
