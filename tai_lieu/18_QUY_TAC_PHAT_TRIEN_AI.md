# 18. QUY TẮC PHÁT TRIỂN AI

- Mô tả: Quy tắc viết mã, quy ước Git, nguồn mã riêng, cách chạy ứng dụng để xem trước.
- Phiên bản: 1.0
- Ngày cập nhật: 2026-11-09
- Trạng thái: Đã phê duyệt

## 1. Quy trình

- Mọi công việc theo skill `.claude/skills/vibecoding-flow/SKILL.md`. Tài liệu này chỉ ghi phần riêng của dự án.
- Trước khi làm: đọc `tai_lieu/index.md`, tài liệu `01`, `03`, đặc tả công việc và tài liệu liên quan.

## 2. Quy ước Git

Dùng quy ước mặc định trong `.claude/skills/vibecoding-flow/QUY_UOC_GIT.md`: nhánh `chuc-nang/`, `sua-loi/`, `khan-cap/`, `phat-hanh/`, `tai-lieu/`; nội dung commit `<loại>(<mã>): <mô tả tiếng Việt>`; tag `v<x.y.z>`.

Bổ sung riêng:
- Kho mã: GitHub `vinhngtienmdb-ui/vcomm`. Mỗi nhánh mở một pull request; AI không tự hợp nhất vào `main`, người dùng bấm hợp nhất.
- Tag phiên bản do GitHub Actions tự gắn (`.github/workflows/gan-tag-phat-hanh.yml`): khi CI trên `main` đạt cho commit hợp nhất nhánh `phat-hanh/vX.Y.Z`, gắn tag `vX.Y.Z` lên đúng commit đó. Môi trường của AI không được đẩy tag. Tag của bản vá khẩn cấp (gắn trên nhánh `khan-cap/`) và tag `v0.2.0` (phát hành trước khi có tự động) do người dùng tạo tay.
- Pull request nhánh `tai-lieu/...` cần được hợp nhất ngay để mã mới cấp có hiệu lực.

## 3. Quy ước mã

| Mục | Quy ước |
|---|---|
| Ngôn ngữ | TypeScript 6.0.3 chế độ nghiêm ngặt (`tsconfig.base.json`); kiểm tra mã bằng ESLint và typescript-eslint. NestJS chạy bằng `tsc` hoặc SWC (không dùng `tsx` vì mất metadata của decorator); khai báo `rootDir` khi có `outDir` |
| Tên trong mã | Tiếng Anh (từ chuyên môn), viết đầy đủ, không viết tắt: `approvalRequest`, không `apprReq`. Ngoại lệ được dùng: `id`, `url`, `api`, `otp`, `mfa`, `sql` |
| Tên trong cơ sở dữ liệu | Theo tài liệu `16`: chữ thường, gạch dưới, tiếng Anh |
| Chú thích mã | Tiếng Việt có dấu, chỉ viết khi giải thích lý do, ghi mã quy tắc liên quan (ví dụ `// QUYTAC_NGHIEPVU_20`) |
| Chuỗi giao diện | Chỉ nằm trong tệp dịch `packages/i18n` (vi, en) |
| Giá trị giao diện | Chỉ dùng biến sinh từ tài liệu `15` (`packages/ui`) |
| Kiểm tra dữ liệu | Lược đồ zod trong `packages/contracts`, dùng chung backend và giao diện |
| Truy vấn | Drizzle ORM; không ghép chuỗi SQL; điều kiện phạm vi quyền nằm trong truy vấn |
| Database migration | `database/migrations`, mỗi tệp một thay đổi, không sửa tệp đã chạy |
| Định dạng | Prettier mặc định, thụt lề 2 dấu cách (`.editorconfig`) |
| Kiểm thử | Vitest (đơn vị, tích hợp với PostgreSQL thật qua Docker), Playwright (giao diện). Mỗi tiêu chí nghiệm thu có kiểm thử tự động khi làm được |
| Phiên bản thư viện | Ghi cố định số phiên bản; thêm thư viện mới phải có trong tài liệu `13` hoặc được người dùng duyệt |

## 4. Nguồn mã riêng của người dùng

| Nguồn | Nội dung | Cách dùng |
|---|---|---|
| `github.com/vinhngtienmdb-ui/V-com-ERP` | Bản làm trước của VComm: tài liệu thiết kế, kế hoạch 26 app, đặc tả `specs/`, mã React và Supabase | Theo quyết định của người dùng ở tài liệu `13` mục 4. Đọc ở thư mục riêng, không chép mã khi chưa được duyệt |

## 5. Chạy ứng dụng để xem trước

| Việc | Lệnh |
|---|---|
| Cài thư viện | `pnpm install` |
| Bật PostgreSQL, Redis | `docker compose up -d` |
| Tạo tệp môi trường | Sao chép `.env.example` thành `.env` |
| Chạy mọi ứng dụng | `pnpm dev` |
| Chạy riêng mini app Nền tảng | `pnpm --filter web-platform dev` (cổng 3000) |
| Chạy backend | `pnpm --filter api dev` (cổng 4000) |
| Kiểm thử | `pnpm test` |
| Kiểm tra kiểu | `pnpm typecheck` |

- Trình duyệt tích hợp của Claude desktop: cấu hình `.claude/launch.json`, mục `web-platform`.
- Email, SMS trên máy phát triển ghi ra log (`EMAIL_DRIVER=log`, `SMS_DRIVER=log`), không gửi thật.
- Lệnh `pnpm --filter web-platform dev`, `pnpm --filter api dev` chạy được sau lát đầu tiên của CONG_VIEC_02.

Tài khoản thử (dữ liệu giả, nạp bằng `pnpm --filter api db:seed`; mật khẩu chung `MatKhauThu@2026`):

| Tài khoản | Vai trò | Phạm vi |
|---|---|---|
| `quantri.tapdoan@vcomm.test` | Quản trị tập đoàn | Tập đoàn VCG |
| `quantri.vcr@vcomm.test` | Quản trị công ty | Công ty VCR |
| `tygia@vcomm.test` | Quản lý tỷ giá | Tập đoàn VCG |
| `phuc.le@vcomm.test` | Nhân viên, trưởng phòng Mua hàng | Công ty VCR |
| `thukho.bd@vcomm.test` | Nhân viên, thủ kho | Chi nhánh VCR-BD |

## 6. Tệp ở thư mục gốc

Được người dùng đồng ý ngày 2026-11-09: `package.json`, `pnpm-workspace.yaml`, `pnpm-lock.yaml` (pnpm tự sinh), `turbo.json`, `tsconfig.base.json`, `.gitignore`, `.env.example`, `docker-compose.yml`, `.editorconfig`, `.claude/launch.json`, `CLAUDE.md`, `README.md`.

## 7. CLAUDE.md cho từng phần

Tạo cùng lúc với thư mục của phần đó (`apps/api/CLAUDE.md`, `apps/web-platform/CLAUDE.md`…): phần này làm gì, không làm gì, lệnh chạy và kiểm thử của phần.
