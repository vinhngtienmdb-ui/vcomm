# Ảnh 12 mini app web VComm (CONG_VIEC_76): một tiến trình khởi động chạy 12 máy chủ Next.js.
# Build từ thư mục gốc của mã đúng tag: docker build -f infra/docker/web.Dockerfile .
# Địa chỉ chuyển tiếp (rewrites) được đọc lúc build nên đặt cố định: mini app ở localhost, API ở tên dịch vụ `api` trong Docker Compose (infra/compose).
FROM node:22-bookworm-slim AS build
ARG API_ORIGIN=http://api:4000
ENV PNPM_HOME=/pnpm PATH=/pnpm:$PATH CI=true TURBO_TELEMETRY_DISABLED=1 NEXT_TELEMETRY_DISABLED=1 API_ORIGIN=$API_ORIGIN
RUN corepack enable
WORKDIR /app
COPY . .
RUN pnpm install --frozen-lockfile --filter "web-*..." \
 && pnpm --filter "web-*..." run build \
 && rm -rf apps/api apps/mobile-* database \
 && find apps -path '*/.next/cache' -prune -exec rm -rf {} +

FROM node:22-bookworm-slim
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1 PORT=3000
# Ảnh chạy không cần npm, corepack (chỉ chạy node); bỏ để không mang lỗ hổng của công cụ đi kèm ảnh nền.
RUN rm -rf /usr/local/lib/node_modules/npm /usr/local/lib/node_modules/corepack /usr/local/bin/npm /usr/local/bin/npx /usr/local/bin/corepack
WORKDIR /app
COPY --from=build --chown=node:node /app /app
USER node
EXPOSE 3000
CMD ["node", "infra/docker/start-web.mjs"]
