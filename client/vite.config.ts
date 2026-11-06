import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// In development, any request starting with /api is forwarded to the Express server,
// so the browser only ever talks to one origin (localhost:5173) and cookies just work.
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: { "/api": "http://localhost:5000" },
  },
});
