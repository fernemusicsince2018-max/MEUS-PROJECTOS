import { runRuntimePolicyTests } from "../tests/runtimePolicy.test.js";
import { runAssetServiceTests } from "../tests/assetService.test.js";
import { runIntegrationTests } from "../tests/integrations.test.js";
import { runOfflineFallbackTests } from "../tests/offlineFallback.test.js";
import { runMerchantOrdersPaginationTests } from "../tests/merchantOrdersPagination.test.js";
import { runNotificationJobsTests } from "../tests/notificationJobs.test.js";
import { runOrderReviewEligibilityTests } from "../tests/orderReviewEligibility.test.js";
import { runOrderStatsTests } from "../tests/orderStats.test.js";
import { runPlanSelectionTests } from "../tests/planSelection.test.js";
import { runPlanRequestsTests } from "../tests/planRequests.test.js";
import { runMerchantPlanSnapshotTests } from "../tests/merchantPlanSnapshot.test.js";
import { runPublicCatalogSnapshotTests } from "../tests/publicCatalogSnapshots.test.js";
import { runPublicCatalogAccessTests } from "../tests/publicCatalogAccess.test.js";
import { runCorsHeadersTests } from "../tests/corsHeaders.test.js";
import { runAppRoutesTests } from "../tests/appRoutes.test.js";
import { runAppServerTests } from "../tests/appServer.test.js";
import { runAuthSessionRecoveryTests } from "../tests/authSessionRecovery.test.js";
import { runAuthSessionScalingTests } from "../tests/authSessionScaling.test.js";
import { runNetlifyConfigTests } from "../tests/netlifyConfig.test.js";
import { runPasswordResetConfigTests } from "../tests/passwordResetConfig.test.js";
import { runOrderMetricsTests } from "../tests/orderMetrics.test.js";
import { runRegisterServiceWorkerTests } from "../tests/registerServiceWorker.test.js";
import { runRegistrationFlowTests } from "../tests/registrationFlow.test.js";
import { runStorefrontTests } from "../tests/storefront.test.js";
import { runStoreReviewsTests } from "../tests/storeReviews.test.js";
import { runStoreReviewsRuntimeTests } from "../tests/storeReviewsRuntime.test.js";
import { runStorePaymentColumnsTests } from "../tests/storePaymentColumns.test.js";
import { runMerchantReviewsAutoRefreshTests } from "../tests/merchantReviewsAutoRefresh.test.js";
import { runSuperAdminAccessTests } from "../tests/superAdminAccess.test.js";
import { runSystemSettingsTests } from "../tests/systemSettings.test.js";
import { runLoadEnvTests } from "../tests/loadEnv.test.js";
import { runNativeScriptsTests } from "../tests/nativeScripts.test.js";
import { runFunctionsRuntimeTests } from "../tests/functionsRuntime.test.js";

const suites = [
  ["runtimePolicy", runRuntimePolicyTests],
  ["assetService", runAssetServiceTests],
  ["integrations", runIntegrationTests],
  ["offlineFallback", runOfflineFallbackTests],
  ["merchantOrdersPagination", runMerchantOrdersPaginationTests],
  ["notificationJobs", runNotificationJobsTests],
  ["orderReviewEligibility", runOrderReviewEligibilityTests],
  ["orderStats", runOrderStatsTests],
  ["planSelection", runPlanSelectionTests],
  ["planRequests", runPlanRequestsTests],
  ["merchantPlanSnapshot", runMerchantPlanSnapshotTests],
  ["publicCatalogAccess", runPublicCatalogAccessTests],
  ["publicCatalogSnapshots", runPublicCatalogSnapshotTests],
  ["corsHeaders", runCorsHeadersTests],
  ["appRoutes", runAppRoutesTests],
  ["appServer", runAppServerTests],
  ["authSessionRecovery", runAuthSessionRecoveryTests],
  ["authSessionScaling", runAuthSessionScalingTests],
  ["netlifyConfig", runNetlifyConfigTests],
  ["orderMetrics", runOrderMetricsTests],
  ["passwordResetConfig", runPasswordResetConfigTests],
  ["registerServiceWorker", runRegisterServiceWorkerTests],
  ["registrationFlow", runRegistrationFlowTests],
  ["storefront", runStorefrontTests],
  ["storePaymentColumns", runStorePaymentColumnsTests],
  ["merchantReviewsAutoRefresh", runMerchantReviewsAutoRefreshTests],
  ["storeReviews", runStoreReviewsTests],
  ["storeReviewsRuntime", runStoreReviewsRuntimeTests],
  ["superAdminAccess", runSuperAdminAccessTests],
  ["systemSettings", runSystemSettingsTests],
  ["loadEnv", runLoadEnvTests],
  ["nativeScripts", runNativeScriptsTests],
  ["functionsRuntime", runFunctionsRuntimeTests],
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
