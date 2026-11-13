import { defineConfig } from "vite";
const relayerPort = process.env.TONG_RELAYER_PORT ?? "5311";
export default defineConfig({
  server: { proxy: { "/api": `http://127.0.0.1:${relayerPort}` } },
  preview: { proxy: { "/api": `http://127.0.0.1:${relayerPort}` } },
  build: { target: "es2022" },
});
