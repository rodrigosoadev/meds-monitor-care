// Custom build target for Vercel deployment.
// - Disables the Cloudflare plugin (default in Lovable's preset).
// - Tells TanStack Start to emit the Vercel preset (.vercel/output/).
// In the Lovable sandbox this still runs fine for `vite dev`; the preset only
// affects production output.
import { defineConfig } from "@lovable.dev/vite-tanstack-config";

export default defineConfig({
  cloudflare: false,
  tanstackStart: {
    target: "vercel",
  },
});
