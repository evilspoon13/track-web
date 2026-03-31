import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, path.resolve(__dirname, ".."), "");
  const port = env.PORT || "3000";
  const rawTarget = env.TARGET || "localhost";

  const httpTarget = rawTarget.replace(/^ws(s?):\/\//, "http$1://");
  const wsTarget = rawTarget.replace(/^http(s?):\/\//, "ws$1://");

  return {
    plugins: [react()],
    envDir: "..",
    resolve: {
      alias: { "@": path.resolve(__dirname, "./src") },
    },
    server: {
      proxy: {
        "/api": { target: httpTarget, changeOrigin: true, secure: true },
        "/ws": { target: wsTarget, ws: true, changeOrigin: true, secure: true },
      },
    },
  };
});
