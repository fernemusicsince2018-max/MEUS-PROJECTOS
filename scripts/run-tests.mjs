import { runRuntimePolicyTests } from "../tests/runtimePolicy.test.js";
import { runAssetServiceTests } from "../tests/assetService.test.js";
import { runIntegrationTests } from "../tests/integrations.test.js";
import { runOfflineFallbackTests } from "../tests/offlineFallback.test.js";
import { runMerchantOrdersPaginationTests } from "../tests/merchantOrdersPagination.test.js";
import { runNotificationJobsTests } from "../tests/notificationJobs.test.js";
import { runOrderStatsTests } from "../tests/orderStats.test.js";
import { runPlanSelectionTests } from "../tests/planSelection.test.js";
import { runPlanRequestsTests } from "../tests/planRequests.test.js";
import { runPublicCatalogSnapshotTests } from "../tests/publicCatalogSnapshots.test.js";
import { runCorsHeadersTests } from "../tests/corsHeaders.test.js";
import { runAppRoutesTests } from "../tests/appRoutes.test.js";
import { runAppServerTests } from "../tests/appServer.test.js";
import { runNetlifyConfigTests } from "../tests/netlifyConfig.test.js";
import { runSuperAdminAccessTests } from "../tests/superAdminAccess.test.js";
import { runSystemSettingsTests } from "../tests/systemSettings.test.js";

const suites = [
  ["runtimePolicy", runRuntimePolicyTests],
  ["assetService", runAssetServiceTests],
  ["integrations", runIntegrationTests],
  ["offlineFallback", runOfflineFallbackTests],
  ["merchantOrdersPagination", runMerchantOrdersPaginationTests],
  ["notificationJobs", runNotificationJobsTests],
  ["orderStats", runOrderStatsTests],
  ["planSelection", runPlanSelectionTests],
  ["planRequests", runPlanRequestsTests],
  ["publicCatalogSnapshots", runPublicCatalogSnapshotTests],
  ["corsHeaders", runCorsHeadersTests],
  ["appRoutes", runAppRoutesTests],
  ["appServer", runAppServerTests],
  ["netlifyConfig", runNetlifyConfigTests],
  ["superAdminAccess", runSuperAdminAccessTests],
  ["systemSettings", runSystemSettingsTests],
];

let failed = 0;

for (const [name, run] of suites) {
  try {
    await run();
    console.log(`OK ${name}`);
  } catch (error) {
    failed += 1;
    console.error(`FALHOU ${name}`);
    console.error(error?.stack || error?.message || error);
  }
}

if (failed > 0) {
  console.error(`Total de suites com falha: ${failed}`);
  process.exitCode = 1;
} else {
  console.log("Todos os testes passaram.");
}
