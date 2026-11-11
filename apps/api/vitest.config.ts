import swc from "unplugin-swc";
import { defineConfig } from "vitest/config";

// SWC giữ metadata của decorator cho NestJS (tài liệu 18 mục 3).
export default defineConfig({
  plugins: [swc.vite({ module: { type: "es6" } })],
  // Mỗi tệp kiểm thử dựng lại cơ sở dữ liệu thử và chạy toàn bộ database migration trong beforeAll; mặc định 10 giây không đủ trên CI (LOI_05).
  test: { include: ["test/**/*.test.ts"], fileParallelism: false, testTimeout: 30000, hookTimeout: 60000 },
});
