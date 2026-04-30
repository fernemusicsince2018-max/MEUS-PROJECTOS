import { loadLocalEnv } from "./loadEnv.mjs";

loadLocalEnv();

const { getSystemReadiness } = await import("../netlify/functions/_integrations.js");

const readiness = getSystemReadiness();

console.log("Prontidao de producao");
console.log(`Status geral: ${readiness.ready ? "OK" : "PENDENTE"}`);
console.log(`Nucleo operacional: ${readiness.coreReady ? "OK" : "PENDENTE"}`);
console.log(`Integracoes prontas: ${readiness.readyCount}/${readiness.totalCount}`);
console.log(`Itens obrigatorios prontos: ${readiness.requiredReadyCount}/${readiness.requiredTotalCount}`);

for (const item of readiness.items) {
  console.log(`- ${item.title} (${item.required ? "obrigatorio" : "opcional"}): ${item.ready ? "OK" : "FALTA CONFIGURAR"}`);
  console.log(`  ${item.details}`);
  if (item.missing.length) {
    console.log(`  Em falta: ${item.missing.join(", ")}`);
  }
  if (item.nextStep && !item.ready) {
    console.log(`  Proximo passo: ${item.nextStep}`);
  }
}

if (!readiness.ready) {
  console.log("");
  if (readiness.coreReady) {
    console.log("Resumo: o nucleo da aplicacao esta pronto para funcionar, mas ainda faltam integracoes complementares para cobertura completa de producao.");
  } else {
    console.log("Resumo: ainda faltam dependencias obrigatorias antes de considerar a aplicacao pronta para producao.");
  }

  if (readiness.missingVariables.length) {
    console.log(`Variaveis pendentes: ${readiness.missingVariables.join(", ")}`);
  }
}

if (!readiness.ready) {
  process.exitCode = 1;
}
