# BookSpace — versão adaptada para Netlify (com MySQL)

Este ZIP foi reorganizado a partir do projeto enviado. O visual HTML/CSS foi preservado. Ele inclui rotas de API no formato **Netlify Functions**, autenticação com token e o SQL completo para criar as tabelas.

## IMPORTANTE: NÃO FUNCIONA COM MYSQL LOCAL QUANDO ESTIVER ONLINE

Para login, cadastro e empréstimos funcionarem, crie **um banco MySQL acessível pela internet** (não basta o MySQL instalado no seu PC). O provedor deve permitir conexões do ambiente do Netlify e pode exigir TLS (`DB_SSL=true`). O Netlify não fornece automaticamente um servidor MySQL.

## Passos para publicar (recomendado: GitHub → Netlify)

1. Extraia este ZIP. Coloque **todos os arquivos e pastas da raiz** em um repositório GitHub, incluindo `public/`, `netlify/`, `app.js`, `netlify.toml` e `package.json`.
2. Crie o banco MySQL remoto, abra o painel SQL desse banco e execute **`banco_bookspace.sql`**. Se o banco ainda não existir, crie-o antes no provedor. Não execute no banco errado.
3. No Netlify: Add new project → Import an existing project → GitHub → selecione o repositório.
4. Configurações de build: raiz do repositório; build command `npm run build` (ou o `netlify.toml` já define comando); publish directory `public`. A API será compilada em `netlify/functions/api.js`.
5. No painel Netlify, configure estas variáveis de ambiente (em Environment variables), com escopo **Functions** ou All:
   - `DB_HOST`: host do seu MySQL online
   - `DB_PORT`: geralmente `3306` (confira no provedor)
   - `DB_USER`: usuário do banco
   - `DB_PASSWORD`: senha do banco
   - `DB_NAME`: nome do banco (ex.: `bookspace`)
   - `DB_SSL`: `true` se o provedor exigir conexão TLS, caso contrário `false`
   - `JWT_SECRET`: um texto aleatório secreto de no mínimo 32 caracteres
6. Faça um novo deploy após alterar variáveis. Não coloque as senhas no GitHub, `public/` ou `netlify.toml`.
7. Teste `https://SEU-SITE.netlify.app/api/status`. Resposta esperada: `{"ok":true,"message":"BookSpace conectado ao MySQL"}`. Se surgir erro, confira logs de Functions e conexão com banco.
8. Teste criar conta, entrar, listar livros, adicionar ao carrinho, alugar, devolver e atualizar perfil.

**Importante sobre ZIP e arrastar-e-soltar:** o deploy por ZIP/pasta não é equivalente à importação via Git com instalação de dependências e build das Functions. Para publicar **site + API**, use GitHub integrado ao Netlify (recomendado) ou Netlify CLI. Arrastar somente a pasta `public` pode mostrar o site, mas as rotas `/api/` não funcionarão.

## Desenvolvimento local

1. Abra o projeto no VS Code e execute `npm install`.
2. Crie `.env` a partir de `.env.example` e preencha com seu MySQL local ou remoto. O banco precisa conter as tabelas (`banco_bookspace.sql`).
3. Execute `npm start`, abra `http://localhost:3000` e verifique `http://localhost:3000/api/status`.
4. Para simular Functions localmente, instale `netlify-cli` e execute `netlify dev` após configurar `.env`.

## Arquivos

- `public/`: HTML, CSS, JS e imagens do site; publicado publicamente.
- `app.js`: API Express (não publicado como arquivo estático).
- `server.js`: inicia API/website no computador para testes.
- `netlify/functions/api.js`: adapta Express para Netlify Functions.
- `netlify.toml`: diretório publicado e reescrita `/api/*`.
- `banco_bookspace.sql`: cria tabelas e inclui os quatro livros iniciais.
- `.env.example`: modelo de configuração, sem credenciais reais.

## Segurança

Esta adaptação usa `JWT_SECRET` para login, senhas com bcrypt e verificações de acesso às contas/alugueis. Para uso real com clientes/dados pessoais, ainda é recomendada avaliação de segurança, proteção anti-abuso, política de privacidade e fluxo de recuperação de senha. O sistema **não** implementa recuperação de senha. Faça backup do seu banco.
