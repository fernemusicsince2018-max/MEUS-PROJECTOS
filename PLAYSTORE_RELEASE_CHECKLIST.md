# Play Store Release Checklist

Checklist pratica para fechar a publicacao Android do `KASTROZAPP`.

## 0. Pre-flight da maquina

Antes do primeiro bundle:

- instalar `Android Studio`
- instalar um `JDK` compativel com o Android Gradle Plugin atual
- garantir `JAVA_HOME` configurado
- garantir `java -version` funcional no terminal
- abrir a pasta `android/` no Android Studio pelo menos uma vez para deixar o SDK pronto

## 1. Identidade atual do app

- `appName`: `KASTROZAPP`
- `appId` / `applicationId`: `shop.kastrozapp`
- dominio publico: `https://kastrozapp.shop`
- API nativa esperada: `https://kastrozapp.shop/api`

Importante:

- o `applicationId` e fixo depois da primeira publicacao na Play Store
- se quiseres outro package id, troca antes do primeiro upload do `.aab`

## 2. Variaveis web/nativas

Confirma no build usado para o app:

```env
VITE_CATALOG_API_BASE=/api
VITE_NATIVE_CATALOG_API_BASE=https://kastrozapp.shop/api
VITE_PUBLIC_CATALOG_BASE_URL=https://kastrozapp.shop
VITE_PUBLIC_CATALOG_BASE_DOMAIN=kastrozapp.shop
APP_BASE_URL=https://kastrozapp.shop
CORS_ALLOWED_ORIGINS=capacitor://localhost,http://localhost,https://*.kastrozapp.shop
SESSION_COOKIE_SAME_SITE=None
SESSION_COOKIE_SECURE=true
```

## 3. Keystore de release

Cria uma keystore de upload antes do primeiro release.

Atalho rapido para este projeto em Windows:

```powershell
npm run native:release:prepare
```

Exemplo:

```powershell
keytool -genkeypair -v -keystore android/app/kastrozapp-upload.jks -alias kastrozapp-upload -keyalg RSA -keysize 2048 -validity 10000
```

Depois:

1. copia `android/keystore.properties.example` para `android/keystore.properties`
2. preenche:
   - `KASTROZAPP_UPLOAD_STORE_FILE`
   - `KASTROZAPP_UPLOAD_STORE_PASSWORD`
   - `KASTROZAPP_UPLOAD_KEY_ALIAS`
   - `KASTROZAPP_UPLOAD_KEY_PASSWORD`
   - `ANDROID_VERSION_CODE`
   - `ANDROID_VERSION_NAME`

Notas:

- `ANDROID_VERSION_CODE` tem de subir a cada release
- `ANDROID_VERSION_NAME` e o nome visivel da versao, por exemplo `1.0.0`
- guarda a keystore num local seguro; sem ela, atualizar a app depois fica muito mais dificil

## 4. Build do Android

Sincronizar projeto nativo:

```bash
npm run native:sync
```

Gerar `AAB` para Play Store:

```bash
npm run native:bundle:release
```

Gerar `APK` de release para testes manuais:

```bash
npm run native:apk:release
```

Artefactos esperados:

- `android/app/build/outputs/bundle/release/app-release.aab`
- `android/app/build/outputs/apk/release/app-release.apk`

## 5. Smoke antes do upload

- login de lojista funciona no app
- sessao persiste ao fechar e reabrir
- logout limpa a sessao
- reset de palavra-passe abre o link e permite entrar com a nova password
- painel de pedidos abre sem loops
- upload de imagens funciona
- partilha do catalogo abre o link publico correto
- app sem internet mostra fallback claro e nao entra em loop infinito

Checklist detalhada:

- consultar `NATIVE_LOGIN_SESSION_CHECKLIST.md`

## 6. Materiais da ficha Play Store

Prepara antes do upload:

- nome publico da app
- descricao curta
- descricao completa
- email de suporte
- politica de privacidade publica
- icone 512x512
- feature graphic 1024x500
- screenshots de telemovel
- categoria da app
- classificacao etaria
- declaracao de seguranca de dados

## 7. Primeiro upload na Play Console

1. criar a app na Play Console
2. preencher a ficha da loja
3. ir a `Production` ou `Internal testing`
4. enviar o ficheiro `.aab`
5. confirmar `versionCode` e `versionName`
6. completar `Data safety`, `App access`, `Content rating` e `Target audience`
7. submeter para revisao

## 8. Ritmo recomendado de release

- `Internal testing` primeiro
- validar login, sessao, pedidos e upload
- depois promover para `Closed testing` ou `Production`
