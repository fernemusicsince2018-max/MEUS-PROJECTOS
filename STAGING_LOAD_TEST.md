## Teste de carga em staging

Este projeto agora tem uma suite de carga HTTP pensada para staging, sem assumir producao:

- `scripts/seed-staging-synthetic-catalog.mjs`
- `scripts/load-test-staging-http.mjs`
- `scripts/load-test-staging-matrix.mjs`
- `scripts/load-test-staging-targets.mjs`

### O que ela cobre

- seed de catalogo sintetico com `100-1000` produtos
- carga HTTP real contra `catalog-get`
- carga HTTP real contra `order-create`
- carga HTTP real contra `merchant-orders`
- prefill opcional de pedidos para tornar `merchant-orders` mais representativo
- relatorio automatico em `test-results/load-tests`

### Variaveis esperadas

- `LOADTEST_BASE_URL`
- `LOADTEST_MERCHANT_EMAIL`
- `LOADTEST_MERCHANT_PASSWORD`
- `LOADTEST_MERCHANT_PAGE_LIMIT` opcional, por omissao `50`

### 0. Configurar o pooler nas envs de staging

Antes do teste, confirma no Netlify do ambiente de staging ou preview:

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

Notas:

- `POSTGRES_POOLER_URL` tem prioridade sobre `DATABASE_URL`
- em serverless, mantem `POSTGRES_POOL_MAX` baixo e deixa o pooler absorver o pico
- faz um novo deploy do staging depois de gravar as envs

Para o runner local do load test:

1. copia `.env.staging.example` para `.env.staging.local`
2. preenche os `LOADTEST_*` reais
3. usa a matriz de staging, que carrega automaticamente `.env.staging.local`

O valor de `LOADTEST_BASE_URL` pode ser:

- a URL do site staging, por exemplo `https://staging.exemplo.com`
- ou diretamente a base das funcoes, por exemplo `https://staging.exemplo.com/.netlify/functions`

### Credenciais opcionais

Para semear mais de `10` produtos numa conta que ainda esteja em `trial`, tambem podes fornecer:

- `LOADTEST_SUPER_ADMIN_EMAIL`
- `LOADTEST_SUPER_ADMIN_PASSWORD`
- `LOADTEST_PLAN_ID` opcional

Se `LOADTEST_PLAN_ID` nao for informado, o script tenta usar o primeiro plano ativo encontrado no dashboard do super admin.

### 1. Dry run

```bash
node scripts/seed-staging-synthetic-catalog.mjs --dryRun --productCount=100
node scripts/load-test-staging-http.mjs --dryRun
npm run loadtest:staging:targets -- --dryRun
```

### 2. Seed de catalogo sintetico

Exemplo com `100` produtos:

```bash
node scripts/seed-staging-synthetic-catalog.mjs ^
  --baseUrl=https://staging.exemplo.com ^
  --merchantEmail=lojista-teste@exemplo.com ^
  --merchantPassword=SenhaForte123 ^
  --productCount=100
```

Exemplo com `1000` produtos e preparacao por super admin:

```bash
node scripts/seed-staging-synthetic-catalog.mjs ^
  --baseUrl=https://staging.exemplo.com ^
  --merchantEmail=lojista-teste@exemplo.com ^
  --merchantPassword=SenhaForte123 ^
  --superAdminEmail=admin@exemplo.com ^
  --superAdminPassword=SenhaForte123 ^
  --productCount=1000
```

### 3. Rodar o teste completo

Exemplo com seed previo de `300` produtos, prefill de `1000` pedidos e todos os cenarios:

```bash
node scripts/load-test-staging-http.mjs ^
  --baseUrl=https://staging.exemplo.com ^
  --merchantEmail=lojista-teste@exemplo.com ^
  --merchantPassword=SenhaForte123 ^
  --superAdminEmail=admin@exemplo.com ^
  --superAdminPassword=SenhaForte123 ^
  --seedProductCount=300 ^
  --prefillOrders=1000 ^
  --scenarios=all
```

### 4. Matriz rapida por merchantPageLimit

Para correr os tres limites pedidos com labels separadas no relatorio:

```bash
npm run loadtest:staging:matrix
```

Exemplo com seed previo e prefill:

```bash
npm run loadtest:staging:matrix -- ^
  --seedProductCount=300 ^
  --prefillOrders=1000 ^
  --scenarios=all
```

O runner executa automaticamente:

- `merchantPageLimit=20`
- `merchantPageLimit=50`
- `merchantPageLimit=100`

### 4B. Perfis 1k / 5k / 10k

Para preparar a fase de escala com alvos de concorrencia mais altos sem montar stages manualmente:

```bash
npm run loadtest:staging:targets
```

Por omissao, este runner:

- corre targets `1000`, `5000` e `10000`
- gera stages automaticamente com ratios `0.1,0.25,0.5,1`
- usa `merchantPageLimit=50`
- prepara seeds/prefill coerentes com cada alvo
- aplica `merchant-orders` a `10%` do alvo por omissao, porque este cenario representa painel interno e nao trafego cliente

Exemplo com matrix de page limits:

```bash
npm run loadtest:staging:targets -- ^
  --merchantPageLimits=20,50,100
```

Exemplo para forcar `merchant-orders` ao mesmo alvo de concorrencia do cliente:

```bash
npm run loadtest:staging:targets -- ^
  --merchantTargetFactor=1
```

Exemplo para mexer nos ratios e workers:

```bash
npm run loadtest:staging:targets -- ^
  --stageRatios=0.05,0.2,0.4,0.7,1 ^
  --stageDurations=15,20,20,25,35 ^
  --maxWorkers=32
```

### 5. Matriz recomendada

Para um teste mais representativo, roda pelo menos estas combinacoes:

- catalogo com `100` produtos
- catalogo com `300` produtos
- catalogo com `1000` produtos
- `merchant-orders` com `500`, `1000` e `3000` pedidos acumulados
- testa tambem `--merchantPageLimit=20`, `50` e `100` para perceber o custo por pagina

### 6. Stages padrao

`catalog-get`

- `1x10x15,2x10x15,4x10x15,8x10x15`

`merchant-orders`

- `1x2x15,2x2x15,4x2x15`

`order-create`

- `1x4x15,2x4x15,4x4x15`

Podes sobrescrever com:

- `--catalogStages=...`
- `--merchantStages=...`
- `--orderStages=...`
- `--merchantPageLimit=...`

Formato: `workers x concurrencyPorWorker x duracaoEmSegundos`

No runner `loadtest:staging:targets`, estas strings sao geradas automaticamente e injetadas como:

- `LOADTEST_CATALOG_STAGES`
- `LOADTEST_ORDER_STAGES`
- `LOADTEST_MERCHANT_STAGES`

### 7. Relatorio

O runner gera:

- um `.json` com os dados brutos
- um `.md` com resumo executivo

Ambos ficam em:

- `test-results/load-tests`

O relatorio destaca:

- p50, p95, p99
- RPS
- taxa de erro
- ponto de degradacao por cenario
- meta operacional conservadora recomendada
- `merchantPageLimit` usado naquela execucao

### Notas importantes

- `order-create` cria pedidos reais em staging. Usa uma loja dedicada para testes.
- `merchant-orders` agora devolve uma pagina ordenada por recencia, mas o resumo continua a refletir a loja inteira. O custo do endpoint passa a depender do volume acumulado e do `merchantPageLimit`.
- para evitar vies por conta trial, usa uma loja de teste com plano ativo quando fores testar `100+` produtos.
