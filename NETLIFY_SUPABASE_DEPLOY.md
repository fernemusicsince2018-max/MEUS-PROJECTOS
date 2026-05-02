# Netlify + Supabase Deploy

Guia directo para publicar este projeto com:

- frontend na Netlify
- API em `netlify/functions`
- base de dados no Supabase Postgres
- uploads no Supabase Storage

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

## 2. Carregar o schema correcto

No `SQL Editor` do Supabase:

1. executa `backend/postgresql/schema.sql`
2. aplica as migrations em `backend/postgresql/migrations/`

Nao uses `backend/supabase/schema.sql`.
Esse ficheiro ficou apenas como proteccao para bloquear setups antigos e incompletos.

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

O repositório já ficou preparado com o redirect:

```toml
[[redirects]]
  from = "/api/*"
  to = "/.netlify/functions/:splat"
  status = 200
  force = true
```

Isto é importante porque o frontend chama a API como `/api/...`.

## 5. Variáveis de ambiente na Netlify

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

## 7. Validar depois do deploy

1. abre `/`
2. abre `/auth`
3. cria ou entra com uma conta
4. testa um `GET /api/catalog-get` real no domínio publicado
5. faz upload de uma imagem no painel para confirmar Supabase Storage
6. cria um pedido para validar escrita no Supabase Postgres

## 8. Ficheiros úteis

- `netlify.toml`
- `.env.production.example`
- `NETLIFY_ENV_SETUP.md`
- `PRODUCTION_CHECKLIST.md`
