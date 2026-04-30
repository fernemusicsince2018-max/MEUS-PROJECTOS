# Client Release Pipeline

Este pipeline fecha a esteira minima para o canal cliente e o app do lojista:

- validar testes automatizados
- gerar `dist` para web/PWA
- sincronizar o projeto Android com Capacitor

## Workflow

Ficheiro:

- `.github/workflows/client-release.yml`

Jobs incluidos:

1. `web-quality`
   corre `npm ci`, `npm run test` e `npm run build`

2. `android-sync`
   corre `npm ci`, `npm run build` e `npm run native:sync`

## Variaveis importantes

Para storefront publico por loja:

```env
VITE_PUBLIC_CATALOG_BASE_URL=https://teu-dominio.com
VITE_PUBLIC_CATALOG_BASE_DOMAIN=teu-dominio.com
```

Para app movel:

```env
VITE_NATIVE_CATALOG_API_BASE=https://teu-dominio.com/api
```

## Antes de usar em producao

1. Aplica a migration `backend/postgresql/migrations/20260428_storefront_domains_and_seo.sql`.
2. Configura DNS wildcard ou subdominios individuais se fores usar `publicSlug`.
3. Configura o host final no frontend com `VITE_PUBLIC_CATALOG_BASE_DOMAIN`.
4. Mantem `APP_BASE_URL` coerente com o dominio principal da plataforma.

## Proximo endurecimento recomendado

- acrescentar assinatura Android no CI com keystore e secrets
- gerar APK/AAB de release no workflow
- publicar preview/staging automatico para validar OG por loja antes da release final
