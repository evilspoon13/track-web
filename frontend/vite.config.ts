import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, path.resolve(__dirname, ".."), "");
  const port = env.PORT || "3000";

  return {
    plugins: [react()],
    envDir: "..",
    resolve: {
      alias: { "@": path.resolve(__dirname, "./src") },
    },
    server: {
      proxy: {
        "/api": `http://localhost:${port}`,
        "/ws": { target: `ws://localhost:${port}`, ws: true },
      },
    },
  };
});
