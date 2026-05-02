# KASTROZAPP

Sua loja no WhatsApp com catalogo digital e painel simples de administracao.

O projeto usa:

- frontend em React + Vite
- funcoes serverless em Netlify
- base de dados PostgreSQL
- `pgAdmin` para criar e gerir a base localmente
- login/cadastro de lojista com sessao protegida

## Estrutura

- `src/catalog/components`: interface por areas
- `src/catalog/services`: persistencia local, storage da plataforma e API remota
- `src/catalog/utils`: regras de negocio e formatacao
- `netlify/functions`: backend serverless
- `backend/postgresql/schema.sql`: estrutura relacional para PostgreSQL

## Canais e rotas

- `/`: entrada publica da plataforma
- `/catalog/:storeId`: vitrine web da loja para clientes
- `/tracking/:token`: acompanhamento publico de pedido
- `/auth`: autenticacao do lojista
- `/app`: painel/app do lojista
- `/superadmin`: area protegida da plataforma

## Storefront por loja

O canal cliente agora suporta:

- meta tags server-side por loja em `/catalog/:storeId`
- OG/Twitter metadata por tracking em `/tracking/:token`
- `subdominio` da loja via `publicSlug`
- `dominio proprio` da loja via `customDomain`

Quando configurares `VITE_PUBLIC_CATALOG_BASE_DOMAIN`, o painel passa a gerar links como:

- `https://minha-loja.teu-dominio.com/catalog/<storeId>`

Se a loja tiver `customDomain`, o link publico passa a preferir:

- `https://loja.exemplo.com/catalog/<storeId>`

## Como correr localmente

1. Cria um ficheiro `.env.local` com base em `.env.example`.
2. Instala dependencias:
   `npm install`
3. Cria a base PostgreSQL:
   `npm run db:create`
4. Prepara a base PostgreSQL:
   `npm run db:init`
5. Confirma a ligacao:
   `npm run db:check`
6. Arranca o ambiente local completo:
   `npm run dev`
7. Abre a app e cria a conta do lojista com email e palavra-passe.

Para validar a separacao dos canais no browser:

- abre `/` para a entrada publica
- abre `/auth` ou `/app` para o fluxo do lojista
- abre `/catalog/<storeId>` para a vitrine publica da loja

Se `VITE_CATALOG_API_BASE` nao estiver configurado, a app so aceita fallback local em ambiente de desenvolvimento (`localhost`) ou quando `VITE_ALLOW_LOCAL_FALLBACK=true`.
Fora disso, a interface bloqueia o arranque para evitar que dados reais caiam em `localStorage`.
Com `VITE_CATALOG_API_BASE=/api`, o comando `npm run dev` sobe:

- o frontend Vite em `http://localhost:5173`
- as funcoes locais em `http://127.0.0.1:8888`

## Arranque em producao

Fora do Netlify, o servidor Node agora serve a SPA compilada, os assets estaticos e a API no mesmo processo.

Fluxo recomendado:

```bash
npm run build
npm start
```

Isto garante refresh direto em rotas como `/`, `/app`, `/catalog/:storeId` e `/tracking/:token` sem depender de rewrites externos.

## Configuracao PostgreSQL

Para usar Supabase como base de dados, nao precisas de adapter especial: o backend ja fala com PostgreSQL via `pg`.
Na pratica, Supabase entra aqui como `Postgres gerido + pooler + storage`.
Em producao serverless na Netlify, a combinacao recomendada e:

- `POSTGRES_POOLER_URL` com a connection string do Supabase Session/Transaction Pooler
- `POSTGRES_USE_POOLER=true`
- `POSTGRES_SSL=true` ou `sslmode=require` na propria connection string

O frontend ja esta preparado para falar com funcoes serverless que leem e gravam dados num PostgreSQL real.

### Variaveis de ambiente

Usa `.env.example` como referencia.

Podes configurar de duas formas:

- `DATABASE_URL`
- ou `POSTGRES_HOST`, `POSTGRES_PORT`, `POSTGRES_DATABASE`, `POSTGRES_USER`, `POSTGRES_PASSWORD`

Exemplo:

```env
VITE_CATALOG_API_BASE=/api
VITE_NATIVE_CATALOG_API_BASE=https://teu-dominio.com/api
VITE_PUBLIC_CATALOG_BASE_URL=https://teu-dominio.com
VITE_PUBLIC_CATALOG_BASE_DOMAIN=teu-dominio.com
POSTGRES_HOST=127.0.0.1
POSTGRES_PORT=5432
POSTGRES_DATABASE=ferna_catalogo
POSTGRES_USER=postgres
POSTGRES_PASSWORD=your-password
POSTGRES_SSL=false
```

Tambem podes ajustar:

```env
LOCAL_FUNCTIONS_PORT=8888
```

### Pooler e cache

Para ambientes serverless com mais carga, podes ativar um pooler de PostgreSQL e ajustar a cache do catalogo publico:

```env
POSTGRES_POOLER_URL=postgres://...
POSTGRES_USE_POOLER=true
POSTGRES_POOL_MAX=3
POSTGRES_IDLE_TIMEOUT_MS=10000
POSTGRES_CONNECTION_TIMEOUT_MS=10000
POSTGRES_QUERY_TIMEOUT_MS=0
POSTGRES_STATEMENT_TIMEOUT_MS=0
SYSTEM_SETTINGS_CACHE_TTL_MS=10000
PUBLIC_CATALOG_CACHE_TTL_MS=45000
PUBLIC_CATALOG_CACHE_STALE_WHILE_REVALIDATE_SECONDS=180
NOTIFICATION_DISPATCH_SECRET=troca-este-segredo
NOTIFICATION_JOB_BATCH_SIZE=20
```

Notas:

- `POSTGRES_POOLER_URL` tem prioridade sobre `DATABASE_URL` quando quiseres forcar o uso do pooler.
- em serverless, costuma ser melhor manter `POSTGRES_POOL_MAX` baixo por instancia e deixar o pooler absorver o pico.
- o catalogo publico agora envia `Cache-Control` e `ETag`, usa cache curta em memoria por instancia e pode servir snapshots persistentes da vitrine para reduzir leituras repetidas ao PostgreSQL.
- as definicoes globais do sistema usam cache curta em memoria e sao invalidadas quando o super admin grava novas configuracoes.
- a criacao de pedidos agora tira a notificacao WhatsApp do caminho critico: o pedido entra numa fila persistida e o endpoint `notifications-dispatch` entrega em lote com retry.
- `NOTIFICATION_DISPATCH_SECRET` protege o disparo manual de `/api/notifications-dispatch`.
- para app movel com Capacitor, usa `VITE_NATIVE_CATALOG_API_BASE` ou `nativeApiBaseUrl` com URL absoluta HTTPS da API.
- para subdominios por loja, define `VITE_PUBLIC_CATALOG_BASE_DOMAIN` no frontend e o mesmo host base em producao.
- se a API for consumida por um app movel em origem diferente, configura tambem `CORS_ALLOWED_ORIGINS`, `SESSION_COOKIE_SAME_SITE=None` e `SESSION_COOKIE_SECURE=true`.
- o resumo global de pedidos do lojista deixou de recalcular contagens completas a cada refresh e passou a usar estatisticas persistidas por loja.

### Recuperacao de senha por email

Para enviar um link real de recuperacao em nome de `KASTROZAPP`, configura:

```env
APP_BASE_URL=https://teu-dominio.com
RESEND_API_KEY=re_xxxxx
PASSWORD_RESET_FROM_NAME=KASTROZAPP
PASSWORD_RESET_FROM_EMAIL=no-reply@teu-dominio.com
PASSWORD_RESET_REPLY_TO=suporte@teu-dominio.com
CATALOG_EXPOSE_RESET_CODE=false
```

Notas:

- `APP_BASE_URL` deve apontar para a URL publica da app.
- `PASSWORD_RESET_FROM_EMAIL` precisa de um remetente valido no teu dominio de email.
- em ambiente local, se o email nao estiver configurado, o backend pode expor o link de teste para acelerar validacao.

### Notificacoes de pedidos no WhatsApp Cloud API

Se quiseres que o pedido seja enviado automaticamente para o WhatsApp do lojista com imagem anexada, configura:

```env
WHATSAPP_CLOUD_API_TOKEN=EAAG...
WHATSAPP_CLOUD_PHONE_NUMBER_ID=123456789012345
WHATSAPP_CLOUD_API_VERSION=v23.0
WHATSAPP_CLOUD_TEMPLATE_LANGUAGE=pt_PT
WHATSAPP_CLOUD_ORDER_SUMMARY_TEMPLATE_NAME=catalog_order_summary_v1
WHATSAPP_CLOUD_ORDER_ITEM_TEMPLATE_NAME=catalog_order_item_image_v1
```

Notas:

- Com `WHATSAPP_CLOUD_API_TOKEN` e `WHATSAPP_CLOUD_PHONE_NUMBER_ID`, o backend tenta enviar o resumo do pedido e as imagens dos produtos pelo numero oficial do WhatsApp Business.
- Se os nomes dos templates ficarem vazios, o sistema tenta enviar mensagens livres com media. Isto costuma exigir uma janela ativa de 24 horas entre o numero oficial e o lojista.
- Para um fluxo estavel em producao, o ideal e criares templates no WhatsApp Manager:
  `catalog_order_summary_v1`: template de resumo do pedido.
  `catalog_order_item_image_v1`: template com cabecalho de imagem para cada item.
- O template por item deve esperar, pela ordem, estes parametros no corpo:
  `codigo do pedido`, `nome do produto`, `quantidade`, `preco unitario`, `subtotal`.
- O template de resumo deve esperar, pela ordem, estes parametros no corpo:
  `codigo do pedido`, `nome da loja`, `nome do cliente`, `tipo de recebimento`, `localidade`, `total`, `link de acompanhamento`.
- No painel da loja, o campo de WhatsApp agora aceita tanto numero como link direto `wa.me` ou `api.whatsapp.com/send?phone=...`. O sistema extrai o numero e continua a direcionar os pedidos para a loja certa.
- Para copiar os comandos prontos no terminal, consulta [WHATSAPP_TEMPLATE_CURLS.md](./WHATSAPP_TEMPLATE_CURLS.md).

### Storage/CDN para logo e fotos

Para publicar logo e imagens de produto como URLs publicas em vez de base64 dentro da base de dados, configura:

```env
SUPABASE_URL=https://teu-projeto.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJ...
SUPABASE_STORAGE_BUCKET=catalog-assets
```

Notas:

- O upload local do painel passa a enviar a imagem para o bucket publico antes de guardar a loja ou o produto.
- Sem storage configurado, o painel continua a aceitar links publicos colados manualmente.
- Se ainda existirem logos ou fotos antigas em base64, o backend tenta migrar esses assets para URL publica no momento do save.

### Criar a base

#### No Supabase

1. Cria o projeto no Supabase.
2. Abre `SQL Editor`.
3. Executa `backend/postgresql/schema.sql`.
4. Aplica tambem as migrations em `backend/postgresql/migrations/` pela ordem necessaria ao teu ambiente.
5. Em `Project Settings` > `Database`, copia a connection string do pooler para `POSTGRES_POOLER_URL`.

Importante:

- nao uses `backend/supabase/schema.sql` para provisionar a base actual; esse ficheiro ficou apenas como guardrail para evitar um setup incompleto
- para Netlify + Supabase, o schema correcto e o de `backend/postgresql`

#### No pgAdmin

1. Abre o `pgAdmin`.
2. Cria uma database chamada `ferna_catalogo`.
3. Abre o Query Tool dessa database.
4. Executa o ficheiro `backend/postgresql/schema.sql`.

Se a base ja estiver em producao e precisares atualizar o fluxo de pagamento manual dos planos sem recriar tudo, aplica primeiro `backend/postgresql/migrations/20260426_plan_payment_flow.sql`.

Para a arquitetura de maior carga com fila assincrona de notificacoes e estatisticas de pedidos por loja, aplica tambem `backend/postgresql/migrations/20260427_scale_architecture.sql`.

Para ativar os campos de `subdominio` e `dominio proprio` por loja, aplica tambem `backend/postgresql/migrations/20260428_storefront_domains_and_seo.sql`.

Para reduzir o custo do catálogo público em cache miss e preparar melhor a app para muita navegação simultânea, aplica tambem `backend/postgresql/migrations/20260428_public_catalog_snapshots.sql`.

Se depois precisares aplicar so os indices com menos bloqueio, usa `backend/postgresql/migrations/20260426_production_safe_create_indexes.sql` com autocommit ativo.

Se preferires terminal em vez de `pgAdmin`, podes correr:

```bash
npm run db:create
npm run db:init
```

Ou apenas:

```bash
npm run db:init
```

Esse script cria:

- `catalog_stores`
- `catalog_products`

O backend faz leitura e escrita nessas duas tabelas.
Com autenticacao ativa, o schema tambem cria:

- `catalog_users`
- `catalog_sessions`

### Validar e semear a base

Para verificar se a ligacao esta correta:

```bash
npm run db:check
```

Para validar a prontidao operacional de producao:

```bash
npm run readiness
```

Esse comando devolve dois niveis de estado:

- `Nucleo operacional`: base minima obrigatoria para a app funcionar em producao
- `Status geral`: cobertura completa com integracoes complementares

Esse comando valida:

- a ligacao ao PostgreSQL
- a configuracao de `VITE_CATALOG_API_BASE` para evitar fallback inseguro em producao
- a existencia das tabelas `catalog_users`
- a existencia das tabelas `catalog_sessions`
- a existencia das tabelas `catalog_stores`
- a existencia das tabelas `catalog_products`
- reset de senha por email
- WhatsApp Cloud API
- storage/CDN de imagens

### Fila assincrona de notificacoes

Quando `WHATSAPP_CLOUD_API_TOKEN` estiver configurado, os pedidos deixam de esperar pela chamada externa ao WhatsApp no endpoint `order-create`.

Fora do Netlify, agenda a drenagem da fila com cron a correr `npm run notifications:dispatch`.

Se precisares disparar manualmente, usa:

```bash
POST /api/notifications-dispatch
Authorization: Bearer <NOTIFICATION_DISPATCH_SECRET>
```

Notas:

- em cPanel/VPS, podes usar cron para correr `node scripts/notifications-dispatch.mjs`
- se preferires cron externo ou workflow agendado, o endpoint manual continua disponivel com `NOTIFICATION_DISPATCH_SECRET`
- o endpoint manual e o script de cron usam a mesma logica do dispatcher

Checklist rapido:

- [PRODUCTION_CHECKLIST.md](./PRODUCTION_CHECKLIST.md)
- [NETLIFY_ENV_SETUP.md](./NETLIFY_ENV_SETUP.md)
- [ANGOWEB_DEPLOY.md](./ANGOWEB_DEPLOY.md)
- [DIGITALOCEAN_DEPLOY.md](./DIGITALOCEAN_DEPLOY.md)
- [.env.staging.example](./.env.staging.example)
- [.env.production.example](./.env.production.example)
- [NATIVE_LOGIN_SESSION_CHECKLIST.md](./NATIVE_LOGIN_SESSION_CHECKLIST.md)

## Testes automatizados

Para correr a suite automatizada:

```bash
npm run test
```

Hoje ela cobre:

- politica de runtime para bloquear fallback local fora de desenvolvimento
- integracoes e checklist de prontidao de producao
- comportamento de upload de assets com e sem API remota
- utilitarios de escolha de plano e links de ativacao

Smoke E2E com browser:

```bash
npm run test:e2e
```

O smoke atual valida:

- cadastro do lojista
- publicacao e configuracao da loja
- adicao de produto
- criacao de pedido
- tracking do pedido
- logout, reset de senha e novo login

## Fluxo do catalogo

1. O lojista cria conta ou entra com email e palavra-passe.
2. O sistema associa essa conta a uma loja no PostgreSQL.
3. A loja configura nome, descricao, WhatsApp e identidade visual.
4. A loja adiciona produtos, preco, stock, imagem e categoria.
5. O cliente abre o link publico do catalogo sem precisar de login.
6. O cliente monta o carrinho.
7. O app gera a mensagem e abre o WhatsApp da loja com o pedido.

## Marca

O tema base da marca esta em `public/catalog-config.js`.

Podes ajustar:

- `brandName`
- `brandTagline`
- `brandAccent`
- `brandDark`
- `brandHighlight`
- `brandLogoUrl`
- `brandInitials`

Tambem podes passar estes valores por variaveis `VITE_BRAND_*`.
O default atual do projeto e `KASTROZAPP`.

## Roadmap Mobile

Se quiseres evoluir o produto para `web + app` sem duplicar a codebase, consulta:

- [MOBILE_ROADMAP_3_PHASES.md](./MOBILE_ROADMAP_3_PHASES.md)

Base nativa atual:

- `capacitor.config.ts`
- projeto `android/`
- sincronizacao do build web para Android com `npm run native:sync`
- abertura do projeto Android Studio com `npm run native:android`

Nota:

- o Android ja ficou scaffoldado no repositorio
- para gerar e publicar iPhone/iOS continua a ser preciso um Mac com Xcode

## Rotas principais

A base da Fase 1 ja suporta URLs web reais com fallback para os hashes antigos:

- `/auth`
- `/app`
- `/superadmin`
- `/catalog/:storeId`
- `/tracking/:token`

Os links antigos em hash (`#v:...` e `#o:...`) continuam a abrir e sao convertidos para as rotas novas.

## Base PWA

A Fase 1 ja inclui:

- `manifest.webmanifest`
- `service worker`
- prompt de instalacao da app no celular para o lojista
- redirect SPA no hosting web e API separada em `/api`

## Deploy Web + API

### Netlify + Supabase

Para este stack, o repositorio espera:

- frontend estatico publicado pela Netlify
- `netlify/functions` como API serverless
- redirect `"/api/*" -> "/.netlify/functions/:splat"` no `netlify.toml`
- Supabase Postgres no `POSTGRES_POOLER_URL`
- Supabase Storage em `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` e `SUPABASE_STORAGE_BUCKET`

Guia rapido:

1. carrega o schema actual no Supabase com `backend/postgresql/schema.sql`
2. aplica as migrations de `backend/postgresql/migrations/`
3. preenche as envs a partir de `.env.production.example`
4. cria o site na Netlify com `Build command = npm run build`, `Publish directory = dist` e `Functions directory = netlify/functions`
5. faz deploy e valida `npm run readiness`

Para o passo-a-passo completo, consulta [NETLIFY_SUPABASE_DEPLOY.md](./NETLIFY_SUPABASE_DEPLOY.md) e [NETLIFY_ENV_SETUP.md](./NETLIFY_ENV_SETUP.md).

1. Corre `npm run build`.
2. Publica a app Node com `npm start` se quiseres servir frontend compilado + SPA + API no mesmo processo.
3. Para app movel, define `VITE_NATIVE_CATALOG_API_BASE=https://teu-dominio.com/api` antes do build nativo.
4. Define as variaveis de ambiente do PostgreSQL.
5. Define tambem as variaveis de email, WhatsApp Cloud, storage, `NOTIFICATION_DISPATCH_SECRET`, `CORS_ALLOWED_ORIGINS` e as opcoes de cookie se fores usar o app movel.
6. Agenda `npm run notifications:dispatch` no cron da infraestrutura.
7. Antes de publicar, corre:

```bash
npm run test:smoke
npm run readiness
```
8. Faz deploy.

Se a release incluir Android/iPhone, corre tambem o fluxo de [NATIVE_LOGIN_SESSION_CHECKLIST.md](./NATIVE_LOGIN_SESSION_CHECKLIST.md).

O `server.js` agora serve:

- a entrada publica em `/`
- a SPA do lojista em `/app`, `/auth` e `/superadmin`
- os catalogos e tracking em `/catalog/:storeId` e `/tracking/:token`
- a API em `/api`

Isto funciona em alojamento Node tradicional, incluindo cPanel/Node App ou VPS, sem depender de rewrites externos para refresh das rotas SPA.

O ficheiro `server.js` expõe a API em `/api` para alojamento Node tradicional, incluindo cPanel/Node App ou VPS. O nome foi ajustado para evitar conflito com a rota SPA `/app` durante o desenvolvimento local com Vite.
Se quiseres uma lista curta do que falta para cobertura completa de producao, consulta [PRODUCTION_CHECKLIST.md](./PRODUCTION_CHECKLIST.md).
Se fores publicar na DigitalOcean, usa [DIGITALOCEAN_DEPLOY.md](./DIGITALOCEAN_DEPLOY.md) e o app spec exemplo [.do/app-platform.example.yaml](./.do/app-platform.example.yaml).
Se ainda fores usar Netlify noutro ambiente, o projeto continua com compatibilidade legada em `/.netlify/functions`.

Pipeline inicial de release cliente:

- workflow: [.github/workflows/client-release.yml](./.github/workflows/client-release.yml)
- guia: [CLIENT_RELEASE_PIPELINE.md](./CLIENT_RELEASE_PIPELINE.md)

## Ponto de entrada

`CatalogApp.jsx` na raiz foi mantido como ponte.
A app modular real esta em `src/catalog/CatalogApp.jsx`.
