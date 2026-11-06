import path from "path";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src")
    }
  },
  server: {
    host: true,         // Keeps the network exposed for Docker
    port: 5173,
    watch: {
      usePolling: true  // <-- THIS is the magic line that fixes hot reloading on Windows
    }
  }
});
