# WhatsApp Template CURLs

Usa estes comandos no terminal e troca apenas:

- `TOKEN`
- `WABA_ID`
- `HEADER_HANDLE`

No Windows PowerShell, usa `curl.exe` para evitar conflito com o alias do `curl`.

## 1. Criar o template de resumo do pedido

Nome do template: `catalog_order_summary_v1`

```powershell
curl.exe -X POST "https://graph.facebook.com/v23.0/WABA_ID/message_templates" `
  -H "Authorization: Bearer TOKEN" `
  -H "Content-Type: application/json" `
  -d '{
    "name": "catalog_order_summary_v1",
    "language": "pt_PT",
    "category": "UTILITY",
    "components": [
      {
        "type": "BODY",
        "text": "Novo pedido {{1}} na loja {{2}}. Cliente: {{3}}. Recebimento: {{4}}. Localidade: {{5}}. Total: {{6}}. Acompanhar: {{7}}",
        "example": {
          "body_text": [
            [
              "PED-AB12CD34",
              "Minha Loja",
              "Joao Manuel",
              "Entrega",
              "Maianga, Luanda",
              "Kz 25.000,00",
              "https://teu-dominio.com/#o:abc123"
            ]
          ]
        }
      }
    ]
  }'
```

## 2. Criar o template do item com imagem

Nome do template: `catalog_order_item_image_v1`

```powershell
curl.exe -X POST "https://graph.facebook.com/v23.0/WABA_ID/message_templates" `
  -H "Authorization: Bearer TOKEN" `
  -H "Content-Type: application/json" `
  -d '{
    "name": "catalog_order_item_image_v1",
    "language": "pt_PT",
    "category": "UTILITY",
    "components": [
      {
        "type": "HEADER",
        "format": "IMAGE",
        "example": {
          "header_handle": [
            "HEADER_HANDLE"
          ]
        }
      },
      {
        "type": "BODY",
        "text": "Pedido {{1}}. Produto: {{2}}. Quantidade: {{3}}. Preco unitario: {{4}}. Subtotal: {{5}}",
        "example": {
          "body_text": [
            [
              "PED-AB12CD34",
              "Camiseta Basica",
              "2",
              "Kz 5.000,00",
              "Kz 10.000,00"
            ]
          ]
        }
      }
    ]
  }'
```

## 3. Como obter o `HEADER_HANDLE`

No WhatsApp Manager / Meta, ao criar um template com cabecalho de imagem, a interface pede uma imagem de exemplo.
Se estiveres a criar pela API, esse `header_handle` precisa vir de um asset de exemplo aceite pela Meta.
Se preferires evitar esta parte pela API, cria apenas o template `catalog_order_item_image_v1` pela interface do WhatsApp Manager com:

- Header: `IMAGE`
- Body: `Pedido {{1}}. Produto: {{2}}. Quantidade: {{3}}. Preco unitario: {{4}}. Subtotal: {{5}}`

## 4. Variaveis do projeto

Depois de criares os templates, confirma no `.env`:

```env
WHATSAPP_CLOUD_API_TOKEN=EAAG...
WHATSAPP_CLOUD_PHONE_NUMBER_ID=123456789012345
WHATSAPP_CLOUD_API_VERSION=v23.0
WHATSAPP_CLOUD_TEMPLATE_LANGUAGE=pt_PT
WHATSAPP_CLOUD_ORDER_SUMMARY_TEMPLATE_NAME=catalog_order_summary_v1
WHATSAPP_CLOUD_ORDER_ITEM_TEMPLATE_NAME=catalog_order_item_image_v1
```

## 5. Link direto do WhatsApp do lojista

O painel da loja ja aceita:

- `923000000`
- `244923000000`
- `https://wa.me/244923000000`
- `https://api.whatsapp.com/send?phone=244923000000`

O sistema extrai o numero e direciona os pedidos para essa loja.

## 6. Listar templates existentes

```powershell
curl.exe -G "https://graph.facebook.com/v23.0/WABA_ID/message_templates" `
  -H "Authorization: Bearer TOKEN"
```

Se quiseres ver melhor no PowerShell:

```powershell
(curl.exe -G "https://graph.facebook.com/v23.0/WABA_ID/message_templates" `
  -H "Authorization: Bearer TOKEN" | ConvertFrom-Json).data |
  Select-Object id, name, language, category, status
```

## 7. Verificar se `catalog_order_summary_v1` ficou aprovado

```powershell
curl.exe -G "https://graph.facebook.com/v23.0/WABA_ID/message_templates" `
  -H "Authorization: Bearer TOKEN" `
  --data-urlencode "name=catalog_order_summary_v1"
```

No PowerShell, para mostrar so o estado:

```powershell
((curl.exe -G "https://graph.facebook.com/v23.0/WABA_ID/message_templates" `
  -H "Authorization: Bearer TOKEN" `
  --data-urlencode "name=catalog_order_summary_v1" | ConvertFrom-Json).data |
  Select-Object id, name, status, language, category)
```

## 8. Verificar se `catalog_order_item_image_v1` ficou aprovado

```powershell
curl.exe -G "https://graph.facebook.com/v23.0/WABA_ID/message_templates" `
  -H "Authorization: Bearer TOKEN" `
  --data-urlencode "name=catalog_order_item_image_v1"
```

No PowerShell, para mostrar so o estado:

```powershell
((curl.exe -G "https://graph.facebook.com/v23.0/WABA_ID/message_templates" `
  -H "Authorization: Bearer TOKEN" `
  --data-urlencode "name=catalog_order_item_image_v1" | ConvertFrom-Json).data |
  Select-Object id, name, status, language, category)
```

## 9. Verificar por ID, se tiveres guardado o ID devolvido na criacao

```powershell
curl.exe "https://graph.facebook.com/v23.0/TEMPLATE_ID" `
  -H "Authorization: Bearer TOKEN"
```

## 10. Passo mais seguro para obter o `HEADER_HANDLE` sem erro

O caminho mais seguro e com menos falhas e:

1. Cria o template `catalog_order_summary_v1` pela API ou por `curl.exe`.
2. Cria o template `catalog_order_item_image_v1` diretamente no WhatsApp Manager, nao pela API.
3. No WhatsApp Manager, escolhe:
   Header: `IMAGE`
   Body: `Pedido {{1}}. Produto: {{2}}. Quantidade: {{3}}. Preco unitario: {{4}}. Subtotal: {{5}}`
4. Faz upload da imagem de exemplo na propria interface do Manager.
5. Submete o template.

Porque este e o passo mais seguro:

- o Meta Postman oficial mostra que o payload de criacao com header de imagem exige `example.header_handle`
- nas fontes oficiais abertas nesta sessao eu consegui confirmar o formato do payload e os endpoints de templates, mas nao encontrei uma pagina first-party recuperavel com o fluxo completo em `curl` para gerar esse `header_handle`
- na pratica, o WhatsApp Manager trata esse upload de exemplo por ti e evita o erro mais comum dessa etapa

Se quiseres mesmo insistir no caminho por API, usa uma imagem:

- publica em `https`
- sem autenticacao
- sem redirecionamentos estranhos
- em `jpg` ou `png`
- pequena, estavel e com nome simples

Mesmo assim, a recomendacao mais segura continua a ser a interface do WhatsApp Manager para o template com imagem.
