# apps/api

Backend NestJS dùng chung cho mọi mini app (tài liệu `12`, `17`).

Làm: xác thực, phiên, phân quyền theo tập đoàn – công ty – chi nhánh, API `/api/v1/*`, database migration trong `database/migrations/`.
Không làm: giao diện; logic hiển thị; nạp dữ liệu thử trên môi trường thật (`seed.ts` tự từ chối khi `NODE_ENV=production`).

Lệnh (chạy tại gốc dự án, nạp biến từ `.env`):

- Chạy phát triển: `pnpm --filter api dev`
- Database migration: `pnpm --filter api build && pnpm --filter api db:migrate`
- Dữ liệu thử: `pnpm --filter api db:seed`
- Kiểm thử: `pnpm --filter api test` (cần PostgreSQL và cơ sở dữ liệu `vcomm_test`; đổi bằng `TEST_DATABASE_URL`, tên phải kết thúc bằng `_test`)
- Kiểm tra kiểu: `pnpm --filter api typecheck`
