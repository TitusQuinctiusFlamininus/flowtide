import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

const host = process.env.FRONTEND_HOST ?? process.env.HOST ?? "localhost";
const port = Number.parseInt(process.env.FRONTEND_PORT ?? process.env.PORT ?? "5173", 10);

export default defineConfig({
  plugins: [react()],
  server: {
    host,
    port: Number.isFinite(port) ? port : 5173,
  },
});
