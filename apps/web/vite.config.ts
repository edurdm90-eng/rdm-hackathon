import tailwindcss from "@tailwindcss/vite";
import { tanstackRouter } from "@tanstack/router-plugin/vite";
import react from "@vitejs/plugin-react";
import { defineConfig, loadEnv } from "vite";

export default defineConfig(({ mode }) => {
  const viteEnv = loadEnv(mode, process.cwd(), "");
  const proxyTarget = viteEnv.VITE_PROXY_SERVER_URL?.replace(/\/+$/, "");

  return {
    server: {
      port: 3001,
      proxy: proxyTarget
        ? {
            "/api/auth": {
              changeOrigin: true,
              secure: true,
              target: proxyTarget,
            },
            "/metadata": {
              changeOrigin: true,
              secure: true,
              target: proxyTarget,
            },
            "/trpc": {
              changeOrigin: true,
              secure: true,
              target: proxyTarget,
            },
          }
        : undefined,
    },
    resolve: {
      tsconfigPaths: true,
    },
    plugins: [
      tailwindcss(),
      tanstackRouter({
        target: "react",
        autoCodeSplitting: true,
      }),
      react(),
    ],
  };
});
