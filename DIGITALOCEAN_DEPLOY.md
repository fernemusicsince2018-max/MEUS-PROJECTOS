# Deploy na DigitalOcean

Guia recomendado para este projeto usando:

- `DigitalOcean App Platform` para a app Node
- `DigitalOcean Managed PostgreSQL` para a base
- `connection pool` do PostgreSQL para reduzir pressao de ligacoes
- `scheduled job` do App Platform para `npm run notifications:dispatch`

## Arquitetura recomendada

Para este repositorio, a configuracao mais limpa e:

1. `1 web service` no App Platform
   Serve frontend compilado + SPA + API no mesmo processo com `npm start`.
2. `1 managed PostgreSQL cluster`
   Guarda dados da app.
3. `1 PostgreSQL connection pool`
   Alimenta `POSTGRES_POOLER_URL`.
4. `1 scheduled job`
   Executa `npm run notifications:dispatch` a cada minuto.

## Regiao sugerida

Para Angola, eu sugiro comecar em:

- `App Platform region`: `fra`
- `PostgreSQL region`: `fra1`

Isto e uma inferencia pratica a partir das regioes oficiais disponiveis da DigitalOcean, e `Frankfurt` costuma ser uma escolha equilibrada para trafego vindo de Africa/Europa.

## O que ja bate com este repo

O projeto ja esta alinhado com este modelo:

- `npm run build` gera o frontend Vite
- `npm start` arranca o servidor Node unificado
- o health endpoint existe em `/health` e `/api/health`
- o dispatcher de notificacoes existe em `npm run notifications:dispatch`
- as envs de producao ja estao mapeadas em [.env.production.example](./.env.production.example)
- o checklist nativo ja existe em [NATIVE_LOGIN_SESSION_CHECKLIST.md](./NATIVE_LOGIN_SESSION_CHECKLIST.md)

Tambem deixei um app spec exemplo em [.do/app-platform.example.yaml](./.do/app-platform.example.yaml).

## Passo 1: subir o codigo

Publica o repositorio num destes providers suportados pelo App Platform:

- `GitHub`
- `GitLab`
- `Bitbucket`

Recomendo `GitHub` porque e o fluxo mais simples para deploy continuo.

## Passo 2: criar o PostgreSQL gerido

No painel da DigitalOcean:

1. Cria um cluster `PostgreSQL`.
2. Escolhe a regiao `fra1`.
3. Escolhe uma major version estavel, por exemplo `17`.
4. Cria a base `kastrozap_prod`.
5. Cria um utilizador dedicado, por exemplo `kastrozap_app`.
6. Cria um connection pool chamado `catalog-pool` em `transaction mode`.

Sugestao inicial:

- usa um cluster de producao pequeno para arrancar
- usa pool size conservador, por exemplo `10`
- mantem o acesso privado/VPC sempre que possivel

## Passo 3: criar a app no App Platform

No painel da DigitalOcean:

1. `Create` -> `Apps`
2. liga o teu repositorio
3. escolhe a branch principal
4. configura um `Web Service`

Valores recomendados:

- `Source dir`: `/`
- `Environment`: `Node.js`
- `Build command`: `npm install && npm run build`
- `Run command`: `npm start`
- `HTTP Port`: `8080`
- `Instance size`: `apps-s-1vcpu-1gb`
- `Instance count`: `1`

O servidor deste projeto le `PORT` do ambiente, por isso funciona bem com a porta injetada pelo App Platform.

## Passo 4: health checks

Configura o health check para:

- `path`: `/health`
- `port`: `8080`
- `initial delay`: `20s`
- `timeout`: `5s`
- `failure threshold`: `5`

Se o deploy falhar por health check, quase sempre o problema e:

- porta errada
- app a arrancar devagar
- build sem `dist`

## Passo 5: ligar a base a app

Depois do primeiro deploy:

1. entra na app
2. `Add component` -> `Create or attach database`
3. anexa o cluster PostgreSQL criado
4. seleciona a base `kastrozap_prod`
5. seleciona o user `kastrozap_app`

Depois disso, o App Platform disponibiliza bindable variables para o cluster e para o pool.

## Passo 6: preencher as envs

Usa [.env.production.example](./.env.production.example) como checklist e mapeia assim na DigitalOcean.

### Frontend e URLs

- `VITE_CATALOG_API_BASE=/api`
- `VITE_NATIVE_CATALOG_API_BASE=https://teu-dominio.com/api`
- `VITE_PUBLIC_CATALOG_BASE_URL=https://teu-dominio.com`
- `VITE_PUBLIC_CATALOG_BASE_DOMAIN=teu-dominio.com`
- `VITE_ALLOW_LOCAL_FALLBACK=false`
- `APP_BASE_URL=https://teu-dominio.com`

### Sessao e CORS

- `CORS_ALLOWED_ORIGINS=capacitor://localhost,http://localhost,https://*.teu-dominio.com`
- `SESSION_COOKIE_SAME_SITE=None`
- `SESSION_COOKIE_SECURE=true`
- `SUPER_ADMIN_EMAILS=admin@teu-dominio.com`

### PostgreSQL

- `DATABASE_URL=${catalog-db.DATABASE_URL}`
- `POSTGRES_POOLER_URL=${catalog-db.catalog-pool.DATABASE_URL}`
- `POSTGRES_USE_POOLER=true`
- `POSTGRES_POOL_MAX=3`
- `POSTGRES_IDLE_TIMEOUT_MS=10000`
- `POSTGRES_CONNECTION_TIMEOUT_MS=10000`
- `POSTGRES_QUERY_TIMEOUT_MS=0`
- `POSTGRES_STATEMENT_TIMEOUT_MS=0`
- `POSTGRES_POOL_MAX_USES=0`
- `POSTGRES_KEEPALIVE=true`
- `POSTGRES_KEEPALIVE_INITIAL_DELAY_MS=0`
- `POSTGRES_ALLOW_EXIT_ON_IDLE=false`
- `POSTGRES_APPLICATION_NAME=kastrozap-production`

### Cache

- `SYSTEM_SETTINGS_CACHE_TTL_MS=10000`
- `PUBLIC_CATALOG_CACHE_TTL_MS=45000`
- `PUBLIC_CATALOG_CACHE_STALE_WHILE_REVALIDATE_SECONDS=180`

### Email

- `PASSWORD_RESET_FROM_NAME=KASTROZAPP`
- `PASSWORD_RESET_FROM_EMAIL=no-reply@teu-dominio.com`
- `PASSWORD_RESET_REPLY_TO=suporte@teu-dominio.com`
- `RESEND_API_KEY=...`
- `CATALOG_EXPOSE_RESET_CODE=false`

### WhatsApp

- `WHATSAPP_CLOUD_API_TOKEN=...`
- `WHATSAPP_CLOUD_PHONE_NUMBER_ID=...`
- `WHATSAPP_CLOUD_API_VERSION=v23.0`
- `WHATSAPP_CLOUD_TEMPLATE_LANGUAGE=pt_PT`
- `WHATSAPP_CLOUD_ORDER_SUMMARY_TEMPLATE_NAME=catalog_order_summary_v1`
- `WHATSAPP_CLOUD_ORDER_ITEM_TEMPLATE_NAME=catalog_order_item_image_v1`

### Dispatcher

- `NOTIFICATION_DISPATCH_SECRET=segredo-forte`
- `NOTIFICATION_JOB_BATCH_SIZE=20`

### Storage

- `SUPABASE_URL=https://teu-projeto.supabase.co`
- `SUPABASE_SERVICE_ROLE_KEY=...`
- `SUPABASE_STORAGE_BUCKET=catalog-assets`

### Branding opcional

- `VITE_BRAND_NAME=KASTROZAPP`
- `VITE_BRAND_TAGLINE=Vende mais no WhatsApp.`
- `VITE_BRAND_ACCENT=#25ae82`
- `VITE_BRAND_DARK=#1b1c48`
- `VITE_BRAND_HIGHLIGHT=#ffc61a`
- `VITE_BRAND_LOGO_URL=/pwa-icon.svg`
- `VITE_BRAND_INITIALS=KZ`

## Passo 7: criar o scheduled job

Cria um `Job` no App Platform com:

- `Kind`: `Scheduled`
- `Build command`: `npm install`
- `Run command`: `npm run notifications:dispatch`
- `Cron`: `* * * * *`
- `Time zone`: `Africa/Lagos`
- `Instance size`: `apps-s-1vcpu-0.5gb`

O App Platform indica oficialmente que jobs agendados nao sao roteaveis e sao cobrados apenas enquanto estao a correr.

## Passo 8: dominio

Depois da app estar live:

1. abre `Networking`
2. adiciona o teu dominio
3. marca o dominio principal

Se a tua DNS estiver fora da DigitalOcean:

- usa o `CNAME` para o alias `ondigitalocean.app`
- se o apex/root domain nao aceitar CNAME flattening, usa os `A records` que o painel mostrar

Se o teu dominio usar `CAA`, autoriza:

- `letsencrypt.org`
- `pki.goog`

## Passo 9: inicializar a base

Quando o web service e a base estiverem ligados, abre o console da app e corre:

```bash
npm run db:check
npm run db:init
npm run db:check:schema
npm run readiness
```

Ordem recomendada:

1. `db:check`
2. `db:init`
3. `db:check:schema`
4. `readiness`

Se `db:init` falhar, nao avances para publicar o dominio final nem o app nativo.

## Passo 10: publicar o app nativo

Antes de gerar o Android/iPhone:

1. confirma que `VITE_NATIVE_CATALOG_API_BASE` aponta para o dominio HTTPS final
2. faz novo build web
3. sincroniza o projeto nativo
4. corre o checklist de sessao

Checklist:

- [NATIVE_LOGIN_SESSION_CHECKLIST.md](./NATIVE_LOGIN_SESSION_CHECKLIST.md)

## Ordem final recomendada

1. criar PostgreSQL gerido
2. criar pool `catalog-pool`
3. criar app no App Platform
4. anexar a base
5. preencher envs
6. fazer deploy
7. correr `db:check`, `db:init`, `db:check:schema`, `readiness`
8. configurar dominio
9. testar login web
10. testar login/sessao no app nativo

## Notas importantes

- o filesystem local do App Platform nao e persistente, por isso nao uses disco local para uploads
- este projeto ja esta preparado para storage externo via Supabase
- para este sistema, prefere sempre `POSTGRES_POOLER_URL` em producao
- mantem `SESSION_COOKIE_SAME_SITE=None` e `SESSION_COOKIE_SECURE=true` se fores usar o app nativo

## Quando usar o app spec

Usa [.do/app-platform.example.yaml](./.do/app-platform.example.yaml) se quiseres:

- automatizar a criacao com `doctl` ou API
- versionar a infraestrutura no repo
- repetir staging/producao com menos cliques

Se fores fazer tudo manualmente no painel, o ficheiro continua util como checklist exato de configuracao.
