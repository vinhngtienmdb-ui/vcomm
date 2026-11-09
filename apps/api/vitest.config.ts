import swc from "unplugin-swc";
import { defineConfig } from "vitest/config";

// SWC giữ metadata của decorator cho NestJS (tài liệu 18 mục 3).
export default defineConfig({
  plugins: [swc.vite({ module: { type: "es6" } })],
  test: { include: ["test/**/*.test.ts"], fileParallelism: false, testTimeout: 30000 },
});
