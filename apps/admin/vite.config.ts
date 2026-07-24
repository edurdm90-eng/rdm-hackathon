import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
  build: {
    rollupOptions: {
      onwarn(warning, warn) {
        if (warning.code === "INVALID_ANNOTATION") {
          return;
        }

        warn(warning);
      },
    },
  },
  plugins: [react()],
  server: {
    port: 3002,
  },
});
