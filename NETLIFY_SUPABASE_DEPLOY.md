# Netlify + Supabase Deploy

Guia direto para publicar este projeto com:

- frontend na Netlify
- API em `netlify/functions`
- base de dados no Supabase Postgres
- uploads no Supabase Storage
- cadastro do lojista com aprovacao por email

## 1. Criar o projeto Supabase

1. Cria um novo projeto no Supabase.
2. Guarda estes dados:
   - `SUPABASE_URL`
   - `SUPABASE_SERVICE_ROLE_KEY`
   - connection string do `Session pooler` ou `Transaction pooler`

Para este app, a env principal da base deve ficar em:

```env
POSTGRES_POOLER_URL=postgres://user:password@host:6543/postgres?sslmode=require
POSTGRES_USE_POOLER=true
POSTGRES_POOL_MAX=3
```

## 2. Carregar o schema correto

No `SQL Editor` do Supabase:

1. executa `backend/postgresql/schema.sql`
2. aplica as migrations em `backend/postgresql/migrations/`

## 3. Preparar o Storage

O projeto usa Supabase Storage para logo, imagens de produto e ficheiros privados.

Env minima:

```env
SUPABASE_URL=https://teu-projeto.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJ...
SUPABASE_STORAGE_BUCKET=catalog-assets
```

O backend consegue criar o bucket automaticamente se a `service_role` tiver permissao.

## 4. Configurar a Netlify

No site da Netlify:

1. `Build command`: `npm run build`
2. `Publish directory`: `dist`
3. `Functions directory`: `netlify/functions`
4. `Deploy source`: preferir `Git` ligado ao repositorio ou `netlify deploy --build --prod` corrido na raiz do projeto

Importante:

- nao publiques apenas a pasta `dist` por drag-and-drop quando o objetivo inclui login, cadastro e email de aprovacao
- esse tipo de publish costuma deixar o frontend online, mas sem as Netlify Functions do cadastro
- o ficheiro `public/_redirects` agora tambem entra em `dist` e protege o rewrite `/api/*`, mas isso nao substitui o deploy das functions

O repositorio ja ficou preparado com o redirect:

```toml
[[redirects]]
  from = "/api/*"
  to = "/.netlify/functions/:splat"
  status = 200
  force = true
```

Isto e importante porque o frontend chama a API como `/api/...`.

## 5. Variaveis de ambiente na Netlify

Usa `.env.production.example` como base e preenche no painel da Netlify.

Bloco minimo para o nucleo:

```env
VITE_CATALOG_API_BASE=/api
VITE_PUBLIC_CATALOG_BASE_URL=https://teu-dominio.netlify.app
APP_BASE_URL=https://teu-dominio.netlify.app

POSTGRES_POOLER_URL=postgres://user:password@host:6543/postgres?sslmode=require
POSTGRES_USE_POOLER=true
POSTGRES_POOL_MAX=3
POSTGRES_SSL=true

SUPABASE_URL=https://teu-projeto.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJ...
SUPABASE_STORAGE_BUCKET=catalog-assets
```

Para email real de aprovacao e recuperacao:

```env
PASSWORD_RESET_FROM_NAME=KASTROZAPP
PASSWORD_RESET_FROM_EMAIL=no-reply@teu-dominio.com
PASSWORD_RESET_REPLY_TO=suporte@teu-dominio.com
RESEND_API_KEY=re_xxxxxxxxxxxxx
CATALOG_EXPOSE_RESET_CODE=false
```

Se fores usar app movel ou dominio externo, acrescenta tambem:

```env
VITE_NATIVE_CATALOG_API_BASE=https://teu-dominio.netlify.app/api
CORS_ALLOWED_ORIGINS=capacitor://localhost,http://localhost,https://teu-dominio.netlify.app
SESSION_COOKIE_SAME_SITE=None
SESSION_COOKIE_SECURE=true
```

## 6. Validar antes de publicar

Corre localmente:

```bash
npm run test
npm run build
npm run readiness
```

## 7. Checklist exato de redeploy

1. confirma que o schema e as migrations mais recentes estao aplicados no Supabase
2. confirma as envs da Netlify, com foco em:
   - `VITE_CATALOG_API_BASE=/api`
   - `APP_BASE_URL=https://teu-dominio.com`
   - `POSTGRES_POOLER_URL`
   - `POSTGRES_USE_POOLER=true`
   - `RESEND_API_KEY`
   - `PASSWORD_RESET_FROM_EMAIL`
   - `CATALOG_EXPOSE_RESET_CODE=false`
3. faz o deploy pela raiz do repositorio, nunca so da pasta `dist`
4. espera o deploy published terminar
5. abre `Functions` na UI da Netlify e confirma que `auth-register`, `auth-register-availability` e `auth-register-approve` aparecem na lista
6. abre `/catalog-config.js` e confirma `apiBaseUrl: "/api"`
7. testa o endpoint publico do cadastro

PowerShell:

```powershell
$body = @{
  email = "qa-signup-$(Get-Random)@example.com"
  phone = "244923456789"
} | ConvertTo-Json

Invoke-WebRequest `
  -Uri "https://teu-dominio.com/api/auth-register-availability" `
  -Method POST `
  -ContentType "application/json" `
  -Body $body
```

Resultado esperado:

- `200 OK`
- corpo JSON com `ok: true`
- nunca uma pagina HTML `Page not found`

## 8. Validar depois do deploy

1. abre `/auth`
2. cria uma conta nova de lojista
3. confirma que o email de aprovacao chegou na caixa real
4. abre o link do email e confirma que a loja foi aprovada
5. entra com o mesmo email e palavra-passe no painel
6. faz upload de uma imagem no painel para confirmar Supabase Storage
7. cria um pedido para validar escrita no Supabase Postgres

## 9. Ficheiros uteis

- `netlify.toml`
- `public/_redirects`
- `.env.production.example`
- `NETLIFY_ENV_SETUP.md`
- `PRODUCTION_CHECKLIST.md`
