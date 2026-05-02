# Production Checklist

Este ficheiro resume o que precisa de estar pronto para considerar o sistema operacional em producao.

## 1. Nucleo obrigatorio

- `npm run test`
- `npm run build`
- `npm run db:check`
- `npm run db:check:schema`
- `npm run readiness`

Sem estes itens, a app nao deve ser publicada.

Variaveis obrigatorias do nucleo:

- `VITE_CATALOG_API_BASE`
- `POSTGRES_POOLER_URL` ou `DATABASE_URL`

Ou, em alternativa a uma connection string:

- `POSTGRES_HOST`
- `POSTGRES_PORT`
- `POSTGRES_DATABASE`
- `POSTGRES_USER`
- `POSTGRES_PASSWORD`

## 2. Integracoes recomendadas

Estas integracoes nao bloqueiam o nucleo da app, mas fazem falta para cobertura completa de producao:

- Reset de senha por email
- WhatsApp Cloud API
- Storage/CDN de imagens

Variaveis correspondentes:

- `APP_BASE_URL`
- `NOTIFICATION_DISPATCH_SECRET`
- `RESEND_API_KEY`
- `PASSWORD_RESET_FROM_EMAIL`
- `WHATSAPP_CLOUD_API_TOKEN`
- `WHATSAPP_CLOUD_PHONE_NUMBER_ID`
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`

## 3. Regras praticas

- Se `npm run readiness` mostrar `Nucleo operacional: OK`, a base da aplicacao esta pronta para funcionar.
- Se `Status geral` ainda estiver `PENDENTE`, faltam integracoes complementares.
- Sem WhatsApp Cloud, o pedido continua por abertura manual do WhatsApp.
- Com WhatsApp Cloud e fila assincrona, mantem `NOTIFICATION_DISPATCH_SECRET` configurado e confirma um cron ou scheduler regular para `npm run notifications:dispatch`.
- Sem Supabase Storage, o painel aceita links publicos, mas uploads locais de ficheiro ficam bloqueados.
- Sem Resend, o reset de senha real por email nao fica disponivel.

## 4. Antes do deploy

- Partir de `.env.staging.example` ou `.env.production.example` em vez de preencher as envs criticas do zero
- Se a base for Supabase, carregar `backend/postgresql/schema.sql` e depois aplicar as migrations em `backend/postgresql/migrations/`
- Se a base for Supabase, usar o pooler em `POSTGRES_POOLER_URL` e nao o ficheiro legado `backend/supabase/schema.sql`
- Confirmar dominio publico e `APP_BASE_URL`
- Confirmar variaveis no hosting web e na API
- Confirmar que a Netlify esta a reencaminhar `/api/*` para `/.netlify/functions/:splat`
- Se o alvo for staging/previews serverless, confirmar `POSTGRES_POOLER_URL` e `POSTGRES_USE_POOLER=true`
- Se o alvo incluir app movel, confirmar `VITE_NATIVE_CATALOG_API_BASE`, `CORS_ALLOWED_ORIGINS`, `SESSION_COOKIE_SAME_SITE=None` e `SESSION_COOKIE_SECURE=true`
- Se o alvo incluir app movel, correr o fluxo de `NATIVE_LOGIN_SESSION_CHECKLIST.md`
- Se o alvo for alto volume, confirmar `NOTIFICATION_DISPATCH_SECRET`, o cron de `notifications:dispatch` e o `NOTIFICATION_JOB_BATCH_SIZE`
- Correr `npm run test:smoke`
- Correr `npm run readiness`
- Correr `npm run loadtest:staging:matrix -- --seedProductCount=300 --prefillOrders=1000 --scenarios=all` no staging quando o objetivo for validar carga
- Para validar escala por alvo, correr `npm run loadtest:staging:targets` e rever os relatorios de `1000`, `5000` e `10000` concorrentes
- Fazer smoke test manual no ambiente publicado

## 5. Fluxo de planos pagos

- Aplicar `backend/postgresql/migrations/20260426_plan_payment_flow.sql`
- Aplicar `backend/postgresql/migrations/20260427_scale_architecture.sql`
- Correr `npm run db:check:schema`
- Publicar frontend e Netlify Functions no mesmo deploy
- Se precisares dos indices concorrentes em producao, aplicar `backend/postgresql/migrations/20260426_production_safe_create_indexes.sql` com autocommit ativo
- Validar como lojista: criar pedido, abrir o painel de pagamento, enviar comprovativo com ficheiro, nome, telefone, valor pago e data
- Validar como super admin: abrir o pedido, confirmar os metadados do comprovativo e aprovar a ativacao
- Confirmar que a loja reativada volta a abrir o catalogo publico e a aceitar novos pedidos

## 6. Referencias

- `.env.staging.example`
- `.env.production.example`
- `NATIVE_LOGIN_SESSION_CHECKLIST.md`
