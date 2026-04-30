import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  const functionsPort = process.env.LOCAL_FUNCTIONS_PORT || env.LOCAL_FUNCTIONS_PORT || "8888";

  return {
    plugins: [react()],
    server: {
      proxy: {
        "/api": {
          target: `http://127.0.0.1:${functionsPort}`,
          changeOrigin: true,
        },
        "/.netlify/functions": {
          target: `http://127.0.0.1:${functionsPort}`,
          changeOrigin: true,
        },
      },
    },
  };
});
