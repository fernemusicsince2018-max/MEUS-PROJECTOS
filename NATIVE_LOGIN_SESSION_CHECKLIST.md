# Native Login / Session Checklist

Checklist operacional para validar login e sessao no app nativo Capacitor antes da release.

## 1. Pre-flight de configuracao

- `VITE_NATIVE_CATALOG_API_BASE` aponta para uma URL absoluta HTTPS, por exemplo `https://catalogofernagest.com/api`
- `VITE_CATALOG_API_BASE=/api` continua definido para o canal web
- `APP_BASE_URL` usa o mesmo host principal publicado no browser
- `CORS_ALLOWED_ORIGINS` inclui `capacitor://localhost` e `http://localhost`
- `SESSION_COOKIE_SAME_SITE=None`
- `SESSION_COOKIE_SECURE=true`
- o backend publicado responde em HTTPS e nao faz redirect de `/api` para HTTP
- o build nativo foi regenerado depois da troca das envs com `npm run native:sync`

## 2. Smoke de login

- abrir o app com internet e confirmar que a rota inicial cai em `/auth`, sem ecran de configuracao em falta
- fazer login com conta valida
- confirmar `POST /auth-login` com `200`
- confirmar `Set-Cookie` para `catalog_session` com `Path=/`, `HttpOnly`, `SameSite=None` e `Secure`
- confirmar que o app navega para `/app` sem loop para `/auth`
- confirmar que `GET /auth-me` devolve `200` apos o login

## 3. Persistencia de sessao

- fechar totalmente o app e abrir de novo com internet
- confirmar que o utilizador continua autenticado e entra direto no painel
- colocar o app em background por alguns minutos e voltar
- confirmar que a sessao continua valida e que nao existe refresh manual obrigatorio
- repetir o teste com uma conta `super_admin` e validar entrada direta em `/superadmin`

## 4. Logout e invalidacao

- usar o botao de logout no painel
- confirmar `POST /auth-logout` com `200`
- confirmar `Set-Cookie` de expiracao para `catalog_session`
- fechar e reabrir o app
- confirmar retorno a `/auth`
- invalidar a sessao no backend e reabrir online
- confirmar `GET /auth-me` com `401` e limpeza do cache local da sessao

## 5. Offline e reidratacao

- fazer login online pelo menos uma vez
- abrir o painel do lojista e carregar dados da loja
- desligar a rede e reabrir o app
- confirmar que a app nao entra em loop infinito de autenticacao
- confirmar um destes comportamentos aceitaveis:
  - abre com sessao em cache e dados locais ja sincronizados
  - mostra o ecran de fallback offline com mensagem clara
- voltar a ligar a rede e confirmar recuperacao normal da sessao

## 6. Reset de palavra-passe

- pedir recuperacao a partir de `/auth`
- confirmar `POST /auth-request-password-reset` com `200`
- abrir o link recebido por email
- concluir `POST /auth-reset-password` com `200`
- voltar ao app nativo e autenticar com a nova palavra-passe

## 7. Sinais de falha para bloquear release

- `VITE_NATIVE_CATALOG_API_BASE` vazio, relativo ou sem HTTPS
- cookie de sessao sem `SameSite=None`
- cookie de sessao sem `Secure`
- ausencia de `Access-Control-Allow-Credentials: true`
- `CORS_ALLOWED_ORIGINS` sem `capacitor://localhost`
- login funciona no browser mas falha so no app nativo
- reabertura do app volta sempre para `/auth` apesar de `auth-login` ter funcionado
- app offline perde a sessao imediatamente apos um login online bem sucedido
