import { loadLocalEnv } from "./loadEnv.mjs";

loadLocalEnv();

const { getPool } = await import("../netlify/functions/_postgres.js");

function formatRange(min, max) {
  return `${min} a ${max}`;
}

function parsePositiveInteger(value, fallback, minimum = 1) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return fallback;
  const rounded = Math.floor(numeric);
  if (rounded < minimum) return fallback;
  return rounded;
}

function parseBoolean(value, fallback = false) {
  const normalized = String(value || "").trim().toLowerCase();
  if (!normalized) return fallback;
  if (["1", "true", "yes", "on"].includes(normalized)) return true;
  if (["0", "false", "no", "off"].includes(normalized)) return false;
  return fallback;
}

async function main() {
  const pool = getPool();
  const poolMax = Math.max(1, Number(process.env.POSTGRES_POOL_MAX || 5) || 5);
  const publicCatalogCacheTtlMs = parsePositiveInteger(process.env.PUBLIC_CATALOG_CACHE_TTL_MS, 45000, 0);
  const usePooler =
    parseBoolean(process.env.POSTGRES_USE_POOLER || process.env.POSTGRES_POOLER, false)
    || Boolean(String(process.env.POSTGRES_POOLER_URL || "").trim());
  const countsResult = await pool.query(`
    select
      (select count(*)::int from catalog_users) as users_count,
      (select count(*)::int from catalog_stores) as stores_count,
      (select count(*)::int from catalog_products) as products_count
  `);

  const counts = countsResult.rows[0];
  const storesCount = Number(counts.stores_count || 0);
  const productsCount = Number(counts.products_count || 0);
  const averageProductsPerStore = storesCount ? (productsCount / storesCount).toFixed(1) : "0.0";

  const cacheHotMultiplier = publicCatalogCacheTtlMs > 0 ? 4 : 1;
  const poolerMultiplier = usePooler ? 1.5 : 1;
  const safeConcurrentPublicCold = Math.max(30, Math.floor(poolMax * 15 * poolerMultiplier));
  const warningConcurrentPublicCold = Math.max(75, Math.floor(poolMax * 30 * poolerMultiplier));
  const safeConcurrentPublicHot = Math.max(
    safeConcurrentPublicCold,
    Math.floor(safeConcurrentPublicCold * cacheHotMultiplier),
  );
  const warningConcurrentPublicHot = Math.max(
    warningConcurrentPublicCold,
    Math.floor(warningConcurrentPublicCold * cacheHotMultiplier),
  );
  const safeConcurrentAdmins = Math.max(8, Math.floor(poolMax * 4 * poolerMultiplier));
  const warningConcurrentAdmins = Math.max(15, Math.floor(poolMax * 8 * poolerMultiplier));
  const safeStores = Math.max(150, Math.floor(poolMax * 90 * poolerMultiplier));
  const warningStores = Math.max(300, Math.floor(poolMax * 180 * poolerMultiplier));

  console.log("Estimativa heuristica de capacidade do catalogo");
  console.log(`Pool da base de dados configurado: ${poolMax} ligacoes por instancia`);
  console.log(`Pooler ativo: ${usePooler ? "sim" : "nao"}`);
  console.log(`Cache publica do catalogo: ${publicCatalogCacheTtlMs > 0 ? `${publicCatalogCacheTtlMs} ms` : "desligada"}`);
  console.log(`Utilizadores atuais: ${counts.users_count}`);
  console.log(`Lojas atuais: ${storesCount}`);
  console.log(`Produtos atuais: ${productsCount}`);
  console.log(`Media atual de produtos por loja: ${averageProductsPerStore}`);
  console.log("");
  console.log(`Faixa confortavel de lojas ativas: ${formatRange(safeStores, warningStores)}`);
  console.log(`Faixa confortavel de clientes a navegar ao mesmo tempo (cache fria): ${formatRange(safeConcurrentPublicCold, warningConcurrentPublicCold)}`);
  console.log(`Faixa confortavel de clientes a navegar ao mesmo tempo (cache quente): ${formatRange(safeConcurrentPublicHot, warningConcurrentPublicHot)}`);
  console.log(`Faixa confortavel de admins a editar ao mesmo tempo: ${formatRange(safeConcurrentAdmins, warningConcurrentAdmins)}`);
  console.log("");
  console.log("Alertas principais:");
  console.log("- O catalogo publico agora beneficia de cache em memoria por instancia, headers HTTP de cache e snapshots persistentes, por isso trafego repetido tende a sair mais barato do que trafego frio.");
  console.log("- A criacao de pedidos agora pode empurrar a notificacao WhatsApp para uma fila persistida, tirando a chamada externa do caminho critico.");
  console.log("- A lista de encomendas do lojista continua paginada e o resumo global passou a usar estatisticas persistidas por loja, mantendo apenas a janela recente na base de dados.");
  console.log("- O guardar do catalogo agora faz upsert em lote dos produtos, reduzindo bastante o custo por publicacao grande.");
  console.log("- Mesmo com estas melhorias, o ponto real de degradacao precisa de confirmacao em staging com a suite de carga.");
  console.log("- Se a meta for milhares de acessos simultaneos sustentados, combina pooler, cache publica curta, storage externo e load test regular.");
}

main()
  .catch((error) => {
    console.error("Falha ao estimar a capacidade.");
    console.error(error.message || error);
    process.exitCode = 1;
  })
  .finally(async () => {
    const pool = getPool();
    await pool.end().catch(() => {});
  });
