process.env.APP_BASE_URL = "http://localhost:4173";
process.env.LOCAL_FUNCTIONS_PORT = "8890";
process.env.CATALOG_EXPOSE_RESET_CODE = "true";
process.env.CATALOG_DISABLE_RATE_LIMITS = "true";

const { startDevFunctionsServer } = await import("./dev-functions.mjs");

await startDevFunctionsServer(8890);
