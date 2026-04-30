# Deploy na AngoWeb

Guia pratico para publicar este sistema na AngoWeb.

## Resumo rapido

Este projeto pode correr na AngoWeb com `Node.js` via cPanel/Passenger, mas ha um detalhe importante:

- a aplicacao exige `PostgreSQL`
- os planos de hospedagem da AngoWeb destacam `MySQL/MariaDB`, nao `PostgreSQL`

Por isso, tens 2 caminhos viaveis:

1. `Hospedagem cPanel + PostgreSQL externo`
   Usa AngoWeb para o site/app e uma base PostgreSQL gerida fora, por exemplo Supabase, Neon, Railway ou outro fornecedor.

2. `VPS/Servidor na AngoWeb`
   Publicas a app e instalas o PostgreSQL no proprio servidor, ou apontas para um PostgreSQL externo.

Para este projeto, o caminho mais simples costuma ser:

- AngoWeb cPanel com suporte a `Node.js`
- PostgreSQL externo

## O que o projeto precisa

- `Node.js`
- `npm`
- `Application Manager` no cPanel
- `Terminal SSH` ou Terminal web do cPanel
- `SSL`
- `PostgreSQL`

## Antes de comprar o plano

Confirma com a AngoWeb estes 3 pontos:

1. o teu plano mostra `NodeJS` e `cPanel`
2. o cPanel da conta tem `Application Manager`
3. tens `Terminal SSH` ativo

Se fores usar o ambiente de hospedagem web da AngoWeb, confirma tambem que vais ligar a app a um PostgreSQL externo.

## Estrategia recomendada

### Opcao A: cPanel da AngoWeb + PostgreSQL externo

Usa esta opcao se queres gastar menos e publicar mais rapido.

- app web e API Node ficam na AngoWeb
- base de dados fica fora da AngoWeb
- uploads podem continuar no Supabase Storage

### Opcao B: VPS da AngoWeb

Usa esta opcao se queres mais controlo.

- instalas Node.js e PostgreSQL no VPS
- podes correr cron, migrations e monitorizacao com mais liberdade
- melhor para carga mais alta ou operacao mais tecnica

## Passo 1: preparar a configuracao

Parte de `.env.production.example`.

Valores minimos para este projeto:

```env
VITE_CATALOG_API_BASE=/api
VITE_NATIVE_CATALOG_API_BASE=https://teu-dominio.com/api
VITE_PUBLIC_CATALOG_BASE_URL=https://teu-dominio.com
VITE_PUBLIC_CATALOG_BASE_DOMAIN=teu-dominio.com
VITE_ALLOW_LOCAL_FALLBACK=false

APP_BASE_URL=https://teu-dominio.com
CORS_ALLOWED_ORIGINS=capacitor://localhost,http://localhost,https://*.teu-dominio.com
SESSION_COOKIE_SAME_SITE=None
SESSION_COOKIE_SECURE=true

POSTGRES_POOLER_URL=postgres://user:password@host:6543/database?sslmode=require
POSTGRES_USE_POOLER=true

RESEND_API_KEY=re_xxxxx
PASSWORD_RESET_FROM_EMAIL=no-reply@teu-dominio.com
NOTIFICATION_DISPATCH_SECRET=troca-este-segredo

SUPABASE_URL=https://teu-projeto.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJ...
SUPABASE_STORAGE_BUCKET=catalog-assets
```

Se nao fores publicar app nativo agora, podes manter `VITE_NATIVE_CATALOG_API_BASE` mesmo assim para ja deixares a release pronta.

## Passo 2: preparar o pacote da aplicacao

No teu computador:

```bash
npm install
npm run test
npm run build
```

O projeto ja tem um `app.js` compativel com Passenger/cPanel e ele apenas encaminha para o `server.js`.

## Passo 3: enviar os ficheiros para a AngoWeb

Envia o projeto para uma pasta fora de `public_html`, por exemplo:

```text
/home/SEU_USUARIO/apps/catalogo
```

Podes enviar por:

- Git Version Control do cPanel
- File Manager
- SFTP/SSH

Se fores fazer upload manual, envia pelo menos:

- `app.js`
- `server.js`
- `package.json`
- `package-lock.json`
- `shared/`
- `src/`
- `public/`
- `dist/` se ja fores com build pronto
- `netlify/functions/`
- `scripts/`
- `backend/postgresql/`

Nao precisas subir:

- `node_modules/`
- `tests/`
- `test-results/`
- `playwright-report/`
- `android/`

## Passo 4: instalar dependencias no servidor

Abre o Terminal da AngoWeb e executa:

```bash
cd ~/apps/catalogo
npm install
```

Se subiste o codigo sem `dist`, corre tambem:

```bash
npm run build
```

Se subiste `dist` pronto do teu PC, podes saltar este build no servidor.

## Passo 5: criar a app Node.js no cPanel

No cPanel:

1. abre `Application Manager`
2. clica em `Register Application`
3. preenche:

- `Application Name`: `catalogo`
- `Deployment Domain`: o teu dominio ou subdominio
- `Base Application URL`: `/`
- `Application Path`: `apps/catalogo`
- `Environment`: `Production`

Se o cPanel mostrar o campo de ficheiro inicial, usa:

- `app.js`

Se nao mostrar, tudo bem: o Passenger procura `app.js` por defeito, e o projeto agora ja tem esse ficheiro.

## Passo 6: configurar as variaveis de ambiente

No mesmo `Application Manager`, adiciona as envs de runtime:

- `APP_BASE_URL`
- `POSTGRES_POOLER_URL` ou `DATABASE_URL`
- `POSTGRES_USE_POOLER`
- `NOTIFICATION_DISPATCH_SECRET`
- `RESEND_API_KEY`
- `PASSWORD_RESET_FROM_EMAIL`
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- restantes integracoes que fores usar

Importante:

- as `VITE_*` sao usadas no build do frontend
- as envs como `APP_BASE_URL`, `POSTGRES_*`, `SUPABASE_*` e `RESEND_*` sao usadas em runtime pelo servidor

Se fores compilar no servidor, garante que as `VITE_*` tambem existem antes do `npm run build`.

## Passo 7: inicializar a base de dados

Quando a app ja conseguir aceder ao PostgreSQL:

```bash
cd ~/apps/catalogo
npm run db:check
npm run db:init
npm run db:check:schema
```

Se a base ja existir e estiveres a atualizar um ambiente em curso, aplica as migrations necessarias em vez de recriar tudo.

## Passo 8: reiniciar a aplicacao

Depois de mudar codigo ou envs:

- usa `Deploy`/`Restart` no `Application Manager`
- ou cria o ficheiro `tmp/restart.txt`

Exemplo:

```bash
cd ~/apps/catalogo
mkdir -p tmp
touch tmp/restart.txt
```

## Passo 9: configurar o cron

Como fora do Netlify nao tens scheduled functions, agenda no cPanel Cron Jobs:

```bash
cd ~/apps/catalogo && npm run notifications:dispatch
```

Frequencia recomendada:

- a cada 1 minuto

## Passo 10: validacao final

Corre estes checks:

```bash
cd ~/apps/catalogo
npm run readiness
```

E testa no browser:

- `/`
- `/auth`
- `/app`
- `/superadmin`
- `/catalog/:storeId`
- `/tracking/:token`

Se fores publicar Android/iPhone tambem:

- segue `NATIVE_LOGIN_SESSION_CHECKLIST.md`

## Problemas mais provaveis

### 1. A app sobe, mas a autenticacao falha

Verifica:

- `APP_BASE_URL`
- `CORS_ALLOWED_ORIGINS`
- `SESSION_COOKIE_SAME_SITE=None`
- `SESSION_COOKIE_SECURE=true`

### 2. O site abre, mas a API devolve erro de base de dados

Verifica:

- este projeto usa `PostgreSQL`, nao `MySQL`
- `POSTGRES_POOLER_URL` ou `DATABASE_URL`
- acesso remoto liberado no fornecedor do PostgreSQL

### 3. O cPanel nao mostra Application Manager

Isso significa que a funcionalidade nao esta ativa no plano/servidor.

Neste caso:

- pede ativacao ao suporte da AngoWeb
- ou sobe para um plano/VPS com suporte real a Node.js

### 4. O dominio abre, mas o app nao encontra o build

Corre:

```bash
npm run build
```

E confirma que a pasta `dist/` existe dentro da app.

## Recomendacao objetiva

Se queres publicar rapido e com menos risco:

1. compra hospedagem cPanel da AngoWeb com `NodeJS` + `Application Manager`
2. usa `PostgreSQL` externo
3. sobe este projeto com `app.js`
4. configura as envs
5. corre `npm run build`, `npm run db:init` e `npm run readiness`
6. agenda o cron de `notifications:dispatch`

Se quiseres, no proximo passo eu posso preparar contigo um plano exato de deploy para o teu dominio na AngoWeb, incluindo:

- quais envs preencher com os teus valores reais
- que ficheiros subir
- que comandos correr no terminal
- e a ordem certa dentro do cPanel
