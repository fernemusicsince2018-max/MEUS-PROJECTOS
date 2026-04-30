# Netlify Env Setup

Guia pratico para configurar no Netlify o nucleo de staging/producao e as integracoes opcionais do projeto:

- PostgreSQL com pooler para serverless
- Reset de senha por email com Resend
- Notificacoes automaticas com WhatsApp Cloud API
- Dispatcher agendado da fila de notificacoes
- Upload/CDN de imagens com Supabase Storage

Atalhos prontos no repositorio:

- `.env.staging.example`: baseline fechado para staging web + app nativo
- `.env.production.example`: baseline fechado para producao web + app nativo
- `NATIVE_LOGIN_SESSION_CHECKLIST.md`: smoke/checklist de login e sessao no app nativo

## Onde configurar no Netlify

No painel do site:

1. `Site configuration`
2. `Environment variables`
3. `Add a variable`

Sugestao:

- aplica estas variaveis em `Production`
- se usares preview/staging, replica tambem em `Deploy previews` ou no contexto equivalente

## 0. PostgreSQL e pooler

Variaveis do nucleo:

- `POSTGRES_POOLER_URL`
  Valor esperado: connection string do pooler PostgreSQL
  Exemplo: `postgres://user:password@pooler-host:6543/database?sslmode=require`
  Onde obter: fornecedor da base de dados / pooler gerido

- `POSTGRES_USE_POOLER`
  Valor esperado: `true`
  Onde obter: definido por ti

- `POSTGRES_POOL_MAX`
  Valor esperado: `3`
  Onde obter: definido por ti
  Nota: em serverless convem manter baixo por instancia

- `POSTGRES_IDLE_TIMEOUT_MS`
  Valor esperado: `10000`

- `POSTGRES_CONNECTION_TIMEOUT_MS`
  Valor esperado: `10000`

- `POSTGRES_QUERY_TIMEOUT_MS`
  Valor esperado: `0`

- `POSTGRES_STATEMENT_TIMEOUT_MS`
  Valor esperado: `0`

- `POSTGRES_KEEPALIVE`
  Valor esperado: `true`

- `POSTGRES_APPLICATION_NAME`
  Valor esperado: nome da app/ambiente
  Exemplo: `kastrozap-staging`

Bloco pronto para Netlify:

```env
POSTGRES_POOLER_URL=postgres://user:password@pooler-host:6543/database?sslmode=require
POSTGRES_USE_POOLER=true
POSTGRES_POOL_MAX=3
POSTGRES_IDLE_TIMEOUT_MS=10000
POSTGRES_CONNECTION_TIMEOUT_MS=10000
POSTGRES_QUERY_TIMEOUT_MS=0
POSTGRES_STATEMENT_TIMEOUT_MS=0
POSTGRES_KEEPALIVE=true
POSTGRES_APPLICATION_NAME=kastrozap-staging
```

Checklist rapido desta frente:

- o pooler aponta para a mesma base do catalogo
- `POSTGRES_USE_POOLER=true`
- novo deploy feito apos gravar as envs

## 1. Reset de senha por email

Variaveis:

- `APP_BASE_URL`
  Valor esperado: URL publica final da app
  Exemplo: `https://catalogofernagest.com`
  Onde obter: teu dominio publicado no Netlify ou dominio customizado

- `PASSWORD_RESET_FROM_NAME`
  Valor esperado: nome amigavel do remetente
  Exemplo: `KASTROZAPP`
  Onde obter: definido por ti

- `PASSWORD_RESET_FROM_EMAIL`
  Valor esperado: email remetente valido e verificado no Resend
  Exemplo: `no-reply@catalogofernagest.com`
  Onde obter: dominio/remetente configurado no Resend

- `PASSWORD_RESET_REPLY_TO`
  Valor esperado: email de resposta
  Exemplo: `suporte@catalogofernagest.com`
  Onde obter: definido por ti

- `RESEND_API_KEY`
  Valor esperado: chave privada do Resend
  Exemplo: `re_xxxxxxxxxxxxx`
  Onde obter: painel do Resend

- `CATALOG_EXPOSE_RESET_CODE`
  Valor esperado: `false`
  Onde obter: definido por ti
  Nota: em producao deve ficar `false`

Bloco pronto para Netlify:

```env
APP_BASE_URL=https://catalogofernagest.com
PASSWORD_RESET_FROM_NAME=KASTROZAPP
PASSWORD_RESET_FROM_EMAIL=no-reply@catalogofernagest.com
PASSWORD_RESET_REPLY_TO=suporte@catalogofernagest.com
RESEND_API_KEY=re_xxxxxxxxxxxxx
CATALOG_EXPOSE_RESET_CODE=false
```

Checklist rapido desta frente:

- dominio verificado no Resend
- remetente autorizado no Resend
- `APP_BASE_URL` sem barra final desnecessaria

## 2. WhatsApp Cloud API

Variaveis:

- `WHATSAPP_CLOUD_API_TOKEN`
  Valor esperado: token valido da Graph API / WhatsApp Cloud
  Exemplo: `EAAG...`
  Onde obter: Meta for Developers / Business Manager

- `WHATSAPP_CLOUD_PHONE_NUMBER_ID`
  Valor esperado: ID numerico do numero WhatsApp Business
  Exemplo: `123456789012345`
  Onde obter: configuracao da WhatsApp Cloud API no Meta

- `WHATSAPP_CLOUD_API_VERSION`
  Valor esperado: versao da Graph API
  Exemplo: `v23.0`
  Onde obter: definido por ti; o projeto usa `v23.0` por default

- `WHATSAPP_CLOUD_TEMPLATE_LANGUAGE`
  Valor esperado: locale aprovado nos templates
  Exemplo: `pt_PT`
  Onde obter: idioma configurado nos templates aprovados

- `WHATSAPP_CLOUD_ORDER_SUMMARY_TEMPLATE_NAME`
  Valor esperado: nome exato do template de resumo
  Exemplo: `catalog_order_summary_v1`
  Onde obter: nome do template aprovado no WhatsApp Manager

- `WHATSAPP_CLOUD_ORDER_ITEM_TEMPLATE_NAME`
  Valor esperado: nome exato do template com imagem por item
  Exemplo: `catalog_order_item_image_v1`
  Onde obter: nome do template aprovado no WhatsApp Manager

Bloco pronto para Netlify:

```env
WHATSAPP_CLOUD_API_TOKEN=EAAGxxxxxxxxxxxxx
WHATSAPP_CLOUD_PHONE_NUMBER_ID=123456789012345
WHATSAPP_CLOUD_API_VERSION=v23.0
WHATSAPP_CLOUD_TEMPLATE_LANGUAGE=pt_PT
WHATSAPP_CLOUD_ORDER_SUMMARY_TEMPLATE_NAME=catalog_order_summary_v1
WHATSAPP_CLOUD_ORDER_ITEM_TEMPLATE_NAME=catalog_order_item_image_v1
```

Checklist rapido desta frente:

- numero oficial configurado no WhatsApp Cloud
- token com permissao de envio
- templates aprovados com nomes exatamente iguais aos definidos acima
- idioma do template igual a `WHATSAPP_CLOUD_TEMPLATE_LANGUAGE`

### 2.1 Dispatcher da fila de notificacoes

Variaveis:

- `NOTIFICATION_DISPATCH_SECRET`
  Valor esperado: segredo forte e unico
  Exemplo: `kz-prod-dispatch-2026`
  Onde obter: gerado por ti
  Nota: protege o `POST` manual de `/.netlify/functions/notifications-dispatch`

- `NOTIFICATION_JOB_BATCH_SIZE`
  Valor esperado: tamanho do lote por execucao
  Exemplo: `20`
  Onde obter: definido por ti
  Nota: aumenta so se o tempo total de processamento continuar dentro do limite da scheduled function

Bloco pronto para Netlify:

```env
NOTIFICATION_DISPATCH_SECRET=kz-prod-dispatch-2026
NOTIFICATION_JOB_BATCH_SIZE=20
```

Notas:

- este repositorio ja agenda `notifications-dispatch-scheduled` no `netlify.toml`
- a cadence atual e `* * * * *`, ou seja, uma execucao por minuto
- scheduled functions do Netlify correm apenas em deploys published e usam UTC
- para testes manuais, podes usar `Run now` na UI de Functions do Netlify ou continuar a chamar o endpoint manual com `Authorization: Bearer <NOTIFICATION_DISPATCH_SECRET>`

## 3. Supabase Storage

Variaveis:

- `SUPABASE_URL`
  Valor esperado: URL do projeto Supabase
  Exemplo: `https://abcxyzcompany.supabase.co`
  Onde obter: painel do projeto Supabase

- `SUPABASE_SERVICE_ROLE_KEY`
  Valor esperado: chave `service_role`
  Exemplo: `eyJ...`
  Onde obter: `Project Settings` > `API` no Supabase
  Nota: esta chave e sensivel e deve ficar so no backend

- `SUPABASE_STORAGE_BUCKET`
  Valor esperado: nome do bucket publico
  Exemplo: `catalog-assets`
  Onde obter: definido por ti
  Nota: o projeto usa `catalog-assets` por default

Bloco pronto para Netlify:

```env
SUPABASE_URL=https://abcxyzcompany.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJxxxxxxxxxxxxx
SUPABASE_STORAGE_BUCKET=catalog-assets
```

Checklist rapido desta frente:

- projeto Supabase criado
- chave `service_role` copiada corretamente
- bucket publico disponivel ou permissao para o backend cria-lo

## 4. Resumo completo para o Netlify

Se quiseres preencher tudo de uma vez no deploy, este e o conjunto completo do nucleo serverless e das integracoes:

```env
POSTGRES_POOLER_URL=postgres://user:password@pooler-host:6543/database?sslmode=require
POSTGRES_USE_POOLER=true
POSTGRES_POOL_MAX=3
POSTGRES_IDLE_TIMEOUT_MS=10000
POSTGRES_CONNECTION_TIMEOUT_MS=10000
POSTGRES_QUERY_TIMEOUT_MS=0
POSTGRES_STATEMENT_TIMEOUT_MS=0
POSTGRES_KEEPALIVE=true
POSTGRES_APPLICATION_NAME=kastrozap-staging

APP_BASE_URL=https://catalogofernagest.com
PASSWORD_RESET_FROM_NAME=KASTROZAPP
PASSWORD_RESET_FROM_EMAIL=no-reply@catalogofernagest.com
PASSWORD_RESET_REPLY_TO=suporte@catalogofernagest.com
RESEND_API_KEY=re_xxxxxxxxxxxxx
CATALOG_EXPOSE_RESET_CODE=false

WHATSAPP_CLOUD_API_TOKEN=EAAGxxxxxxxxxxxxx
WHATSAPP_CLOUD_PHONE_NUMBER_ID=123456789012345
WHATSAPP_CLOUD_API_VERSION=v23.0
WHATSAPP_CLOUD_TEMPLATE_LANGUAGE=pt_PT
WHATSAPP_CLOUD_ORDER_SUMMARY_TEMPLATE_NAME=catalog_order_summary_v1
WHATSAPP_CLOUD_ORDER_ITEM_TEMPLATE_NAME=catalog_order_item_image_v1

NOTIFICATION_DISPATCH_SECRET=kz-prod-dispatch-2026
NOTIFICATION_JOB_BATCH_SIZE=20

SUPABASE_URL=https://abcxyzcompany.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJxxxxxxxxxxxxx
SUPABASE_STORAGE_BUCKET=catalog-assets
```

## 5. Validacao apos deploy

Depois de gravar as variaveis no Netlify:

1. faz um novo deploy
2. testa recuperacao de senha com email real
3. cria um pedido real e confirma se o envio automatico no WhatsApp aconteceu
4. abre `Functions` no Netlify e confirma que `notifications-dispatch-scheduled` aparece com badge `Scheduled`
5. usa `Run now` nessa funcao para validar a drenagem da fila sem esperar pelo proximo minuto
6. faz upload de logo ou foto de produto a partir de ficheiro e confirma se a imagem ficou com URL publica
7. no staging, corre o load test com `merchantPageLimit=20`, `50` e `100`

## 6. Leitura do readiness

O comando local:

```bash
npm run readiness
```

deve ser lido assim:

- `Nucleo operacional: OK` = a base da app esta pronta para funcionar
- `Status geral: OK` = nucleo + integracoes complementares completas

## 7. Ficheiros relacionados

- [README.md](./README.md)
- [PRODUCTION_CHECKLIST.md](./PRODUCTION_CHECKLIST.md)
- [STAGING_LOAD_TEST.md](./STAGING_LOAD_TEST.md)
- [WHATSAPP_TEMPLATE_CURLS.md](./WHATSAPP_TEMPLATE_CURLS.md)
