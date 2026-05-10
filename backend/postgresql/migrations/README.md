Migracoes SQL pontuais para PostgreSQL.

- `20260426_plan_payment_flow.sql`: cria e atualiza a estrutura do fluxo de pagamento manual dos planos, incluindo pedidos de ativacao, comprovativos e eventos financeiros.
- `20260426_production_safe_create_indexes.sql`: aplica apenas os indices do schema atual usando `CREATE INDEX CONCURRENTLY`, pensado para rollout manual em producao com menos bloqueio.
- `20260427_scale_architecture.sql`: ativa a fila assincrona de notificacoes, estatisticas persistidas por loja e tabelas operacionais para maior carga.
- `20260428_storefront_domains_and_seo.sql`: adiciona `public_slug`, `custom_domain` e os indices unicos usados pelos links publicos e SEO da vitrine.
- `20260428_public_catalog_snapshots.sql`: adiciona snapshots persistentes do catalogo publico para reduzir leituras repetidas e aliviar picos de navegacao.
- `20260502_self_approved_store_registration.sql`: cria o fluxo de cadastro com confirmacao por email do proprio lojista, incluindo pendencias temporarias e indices unicos de telemovel/WhatsApp.
