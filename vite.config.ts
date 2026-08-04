import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

const cRoutes: Record<string, string> = {
  health: "/health",
  catalog: "/api/catalog",
  queue: "/api/queue",
  player: "/api/player",
  state: "/api/state",
  request: "/api/request",
  vote: "/api/vote",
  remove: "/api/queue/remove",
  clear: "/api/queue/clear",
  shuffle: "/api/queue/shuffle",
  next: "/api/player/next",
  previous: "/api/player/previous",
  reset: "/api/reset",
};

export default defineConfig({
  base: "./",
  plugins: [react()],
  server: {
    host: "127.0.0.1",
    port: 1420,
    strictPort: true,
    proxy: {
      // Production/NAS uses public/api.php. During Vite development this proxy
      // preserves the same frontend URL but sends commands directly to C11.
      "/api.php": {
        target: "http://127.0.0.1:8081",
        changeOrigin: true,
        rewrite(path) {
          const route = new URL(path, "http://localhost").searchParams.get(
            "route",
          );
          return (route && cRoutes[route]) || "/route-not-found";
        },
      },
    },
    watch: {
      ignored: ["**/dist/**", "**/output/**", "**/release/**", "**/tmp/**"],
    },
  },
});
