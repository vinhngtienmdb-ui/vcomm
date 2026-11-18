# Ảnh backend VComm (CONG_VIEC_76): API NestJS, tác vụ nền, database migration, dữ liệu thử.
# Build từ thư mục gốc của mã đúng tag: docker build -f infra/docker/api.Dockerfile .
# Giữ cấu trúc apps/api/dist và database/migrations vì bộ chạy migration tìm thư mục theo đường dẫn tương đối.
FROM node:22-bookworm-slim AS build
ENV PNPM_HOME=/pnpm PATH=/pnpm:$PATH CI=true TURBO_TELEMETRY_DISABLED=1
RUN corepack enable
WORKDIR /app
COPY . .
RUN pnpm install --frozen-lockfile --filter "api..." \
 && pnpm --filter "api..." run build \
 && rm -rf node_modules apps/*/node_modules packages/*/node_modules \
 && pnpm install --frozen-lockfile --prod --offline --filter "api..." \
 && find apps -mindepth 1 -maxdepth 1 ! -name api -exec rm -rf {} + \
 && rm -rf apps/api/src apps/api/test packages/*/src packages/ui infra/docker

FROM node:22-bookworm-slim
ENV NODE_ENV=production API_PORT=4000
# Ảnh chạy không cần npm, corepack (chỉ chạy node); bỏ để không mang lỗ hổng của công cụ đi kèm ảnh nền.
RUN rm -rf /usr/local/lib/node_modules/npm /usr/local/lib/node_modules/corepack /usr/local/bin/npm /usr/local/bin/npx /usr/local/bin/corepack
WORKDIR /app
COPY --from=build --chown=node:node /app /app
USER node
EXPOSE 4000
# Lệnh khác dùng cùng ảnh: database migration `node apps/api/dist/database/run-migrations.js`,
# dữ liệu thử `node apps/api/dist/database/seed.js` (chỉ môi trường thử nghiệm).
CMD ["node", "apps/api/dist/main.js"]
