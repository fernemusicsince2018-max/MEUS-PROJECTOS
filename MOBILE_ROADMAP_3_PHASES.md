# Mobile Roadmap - 3 Phases

Plano técnico para suportar o produto em duas formas ao mesmo tempo:

- `Web` para clientes finais que nao querem instalar nada
- `App` para lojistas que querem gerir a sua loja no celular

## Decisao de arquitetura

Manter `uma unica codebase` com `duas experiencias`:

- experiencia `publica` para o catalogo da loja
- experiencia `merchant` para o painel do lojista

Manter tambem:

- `backend unico` em Netlify Functions
- `PostgreSQL unico`
- `storage unico`
- `autenticacao unica`

Isto evita duplicar negocio, duplicar bugs e duplicar manutencao.

## Estado atual do projeto

Hoje a app ja tem a base certa para isto:

- catalogo publico
- autenticacao
- painel do lojista
- painel de super admin
- tracking de pedido

Mas tudo ainda esta concentrado em [CatalogApp.jsx](./src/catalog/CatalogApp.jsx) com controlo por `screen state`, e ainda nao existe:

- `PWA`
- `manifest`
- `service worker`
- `app shell` dedicada para lojista
- `build nativo` Android/iPhone

## Estrategia recomendada

1. `Fase 1`
   Entregar uma experiencia `web mobile + PWA`

2. `Fase 2`
   Transformar o painel do lojista numa experiencia clara de `app`

3. `Fase 3`
   Publicar a mesma app em `Android` e `iPhone` com `Capacitor`

## Fase 1 - Web Mobile + PWA

### Objetivo

Garantir que:

- o cliente final usa o catalogo muito bem no navegador do celular
- o lojista ja consegue "instalar" a app no ecrã inicial
- a base tecnica fica pronta para empacotamento nativo depois

### Entregaveis

- `manifest.webmanifest`
- icones de app
- `service worker`
- cache de shell da aplicacao
- cache segura para assets estaticos
- pagina offline minima
- prompt de instalacao da PWA
- prompt de atualizacao quando houver nova versao
- melhoria do layout mobile-first

### Decisoes tecnicas

- manter `React + Vite`
- adicionar `vite-plugin-pwa`
- adicionar `react-router-dom`
- estabilizar URLs reais em vez de depender apenas de `setScreen(...)`

### Refatoracoes recomendadas

Extrair o monolito atual em rotas:

- `/` ou `/s/:storeId` para catalogo publico
- `/tracking/:token` para acompanhamento
- `/auth` para login/registro/reset
- `/app` para area do lojista
- `/superadmin` para area interna

### Mudancas previstas no repositorio

- novo `public/manifest.webmanifest`
- novos icones em `public/`
- configuracao PWA em [vite.config.js](./vite.config.js)
- novo modulo de registo da PWA em `src/`
- refactor de [CatalogApp.jsx](./src/catalog/CatalogApp.jsx) para rotas
- separacao de layouts:
  - `PublicLayout`
  - `MerchantLayout`
  - `SuperAdminLayout`

### Criterios de pronto

- o catalogo abre bem no celular sem scrolls quebrados
- o utilizador consegue adicionar ao ecrã inicial
- a app abre com nome, icone e cor corretos
- a shell principal carrega mesmo com ligacao instavel
- as rotas publicas e do lojista ficam separadas de forma clara

### Riscos

- cache incorreta de dados dinamicos
- regressao na navegacao atual
- conflitos entre assets antigos e service worker

### Resultado esperado

- `clientes`: continuam a usar por link
- `lojistas`: ja podem usar como "app instalada" via navegador

## Fase 2 - App do lojista

### Objetivo

Dar ao lojista uma experiencia de app clara, focada em operacao diaria.

Aqui o foco nao e o catalogo publico. O foco e:

- gerir produtos
- gerir pedidos
- editar dados da loja
- partilhar catalogo
- acompanhar plano e estado da conta

### Entregaveis

- `Merchant App Shell`
- home do lojista com navegacao persistente
- sessao persistida no celular
- fluxo de login mobile-first
- painel de pedidos otimizado para uso no telefone
- upload de imagem com UX melhor
- estados de loading/empty/error mais claros
- estrutura pronta para notificacoes futuras

### Decisoes tecnicas

- separar o dominio do lojista do dominio do catalogo publico na interface
- manter a mesma API e a mesma autenticacao
- preparar a navegacao para futuro `Capacitor`

### Estrutura sugerida

- `src/catalog/routes/public/*`
- `src/catalog/routes/merchant/*`
- `src/catalog/routes/superadmin/*`
- `src/catalog/layouts/*`
- `src/catalog/pwa/*`

### Funcionalidades prioritarias da app do lojista

- dashboard inicial
- pedidos com alteracao de estado mais rapida
- produtos com edicao simplificada
- partilha do link da loja
- acesso rapido a suporte/plano

### Funcionalidades opcionais desta fase

- notificacoes push de novo pedido
- modo offline parcial para consulta
- fila de sincronizacao para edicoes pendentes

### Criterios de pronto

- lojista consegue gerir a loja confortavelmente so pelo celular
- navegacao e mais parecida com app do que com site adaptado
- sessao continua estavel depois de fechar/reabrir
- fluxo principal cabe em poucos toques

### Riscos

- a app do lojista competir visualmente com o catalogo publico dentro da mesma navegação
- excesso de logica no mesmo componente
- UX de pedidos ficar boa no desktop mas fraca no celular se nao for redesenhada

### Resultado esperado

- `cliente final`: continua em web
- `lojista`: passa a sentir que tem uma app propria de gestao

## Fase 3 - Publicacao em Android/iPhone

### Objetivo

Empacotar a experiencia do lojista como app real para:

- `Google Play`
- `App Store`

### Decisao recomendada

Usar `Capacitor` sobre a mesma app web.

Isto permite:

- reaproveitar praticamente todo o frontend existente
- gerar build Android/iOS sem reescrever em React Native ou Swift/Kotlin
- manter um unico produto e uma unica equipa

### Stack prevista

- `@capacitor/core`
- `@capacitor/cli`
- `@capacitor/android`
- `@capacitor/ios`

Plugins provaveis:

- `@capacitor/app`
- `@capacitor/splash-screen`
- `@capacitor/status-bar`
- `@capacitor/push-notifications` se push entrar nesta fase

### Entregaveis

- `capacitor.config.*`
- pasta `android/`
- pasta `ios/`
- icones e splash screens nativos
- deep links para abrir loja/pedido/app
- builds assinados
- checklist de publicacao em stores

### Regras de produto

- o `catalogo publico` continua prioritariamente web
- a `app publicada` e focada no lojista
- nao tentar publicar uma app diferente para cada loja nesta fase

### Publicacao recomendada

1. Android primeiro
2. iPhone depois

Motivo:

- Android costuma ser mais rapido para validacao inicial
- ajuda a testar distribuicao real antes da App Store

### Criterios de pronto

- login do lojista funciona no app nativo
- pedidos e produtos funcionam no app nativo
- upload de imagem funciona
- partilha do catalogo funciona
- a app abre com branding correto
- o processo de update e previsivel

### Riscos

- rejeicao por politicas das stores se a app parecer apenas um site empacotado
- problemas de sessao/cookies/webview
- push/deep links exigirem ajustes nativos adicionais

### Resultado esperado

- `clientes`: continuam a abrir o catalogo por link
- `lojistas`: podem instalar da Play Store/App Store

## Ordem real de execucao

### Sprint 1

- introduzir rotas
- separar layouts
- preparar base para PWA

### Sprint 2

- manifest
- service worker
- instalacao PWA
- offline fallback

### Sprint 3

- redesign do painel do lojista para mobile app shell
- simplificar fluxos de pedidos e produtos

### Sprint 4

- integrar Capacitor
- gerar Android build
- testar em dispositivos reais

### Sprint 5

- ajustar iOS
- preparar assets nativos
- checklist de publicacao

## O que eu recomendo para este projeto

### Caminho certo

- `clientes`: web
- `lojistas`: PWA primeiro
- `stores`: Android/iPhone depois via Capacitor

### Caminho que eu nao recomendo agora

- criar uma app nativa separada para clientes
- criar uma app diferente por cada loja
- manter duas codebases de frontend

## Definicao de sucesso final

O plano esta bem executado quando:

- o cliente compra por link sem friccao
- o lojista gere tudo pelo celular como se fosse app
- a mesma base serve web e mobile
- a publicacao em stores nao obriga reescrita do produto
