import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    // allow sharing via an ngrok tunnel (Vite blocks unknown hosts otherwise).
    // The BE is reached through this same tunnel via the /api + /media proxy below.
    allowedHosts: [".ngrok-free.app", ".ngrok.app", ".ngrok.io", ".ngrok-free.dev"],
    proxy: {
      // proxy API + media to the FastAPI backend
      "/api": { target: "http://127.0.0.1:8000", changeOrigin: true, rewrite: (p) => p.replace(/^\/api/, "") },
      "/media": "http://127.0.0.1:8000",
    },
  },
});
