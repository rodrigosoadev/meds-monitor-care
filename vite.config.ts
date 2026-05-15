// Custom build target for Cloudflare deployment.
// - Enables the Cloudflare plugin.
// - Tells TanStack Start to emit the Cloudflare preset.
import { defineConfig } from "@lovable.dev/vite-tanstack-config";

export default defineConfig({
  cloudflare: true,
  tanstackStart: {
    target: "cloudflare",
  },
  server: {
    host: '0.0.0.0',  // Allow connections from network
    port: 8081,
  },
});
