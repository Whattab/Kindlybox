import { defineConfig } from "vitest/config";
import tsconfigPaths from "vite-tsconfig-paths";

// Unit tests for pure logic (no DOM, no Supabase). Test files live next to the
// code they cover as `*.test.ts`. The tsconfig-paths plugin resolves `@/` imports.
export default defineConfig({
  plugins: [tsconfigPaths()],
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
  },
});
