# 13. CÔNG NGHỆ SỬ DỤNG

- Mô tả: Công nghệ, thư viện, dịch vụ hạ tầng và phân tích giải pháp có sẵn.
- Phiên bản: 1.1
- Ngày cập nhật: 2026-11-09
- Trạng thái: Đã phê duyệt
- Thay đổi theo: THAY_DOI_01, THAY_DOI_02 (2026-11-09)

## 1. Danh sách công nghệ

| Lớp | Lựa chọn | Lý do |
|---|---|---|
| Ngôn ngữ | TypeScript | Một ngôn ngữ cho mọi phần, AI viết tốt |
| Quản lý monorepo | pnpm, Turborepo | Chia sẻ kiểu dữ liệu và thư viện giữa các phần |
| Backend | NestJS | Cấu trúc module rõ, phổ biến |
| Truy cập cơ sở dữ liệu, database migration | Drizzle ORM | Hỗ trợ nhiều schema, ràng buộc kiểm tra, chỉ mục có điều kiện; người dùng chọn ngày 2026-11-09 |
| Giao diện web | Next.js, shadcn/ui | Một bộ thành phần cho mọi mini app |
| Ứng dụng di động | React Native (Expo) | Một mã nguồn cho iOS và Android |
| Cơ sở dữ liệu | PostgreSQL 16 (Amazon Aurora) | Giao dịch toàn vẹn cho kế toán và sổ cái điểm |
| Bộ nhớ đệm, hàng đợi nhẹ | Redis (ElastiCache), BullMQ | Phiên, quyền, giỏ hàng, tác vụ nền |
| Sự kiện giữa module | Outbox, Amazon SQS/SNS | Không mất sự kiện |
| Tìm kiếm | Amazon OpenSearch | Tìm sản phẩm tiếng Việt có dấu và không dấu |
| Lưu tệp | S3, CloudFront | Ảnh, video sản phẩm và cộng đồng |
| Chạy ứng dụng | ECS Fargate, vùng Singapore | Không quản trị máy chủ, tự co giãn |
| Hạ tầng bằng mã | AWS CDK (TypeScript) | Cùng ngôn ngữ, cùng monorepo; người dùng chọn ngày 2026-11-09 |
| Tác vụ nền | BullMQ trên Redis | Nhắc duyệt quá hạn, lấy tỷ giá, đẩy sự kiện outbox |
| Gửi email | Amazon SES | Đường dẫn kích hoạt, đặt lại mật khẩu, mã OTP |
| Gửi SMS | **CHƯA XÁC ĐỊNH:** nhà cung cấp SMS | Mã OTP, đường dẫn kích hoạt |
| Xác thực nhà bán qua VNeID | **CHƯA XÁC ĐỊNH:** tổ chức cung cấp dịch vụ xác thực điện tử | MODULE_02 (THAY_DOI_02) |
| Bí mật hệ thống | AWS Secrets Manager | Tài liệu `22` mục 5 |
| Kiểm thử | Vitest (đơn vị, tích hợp với PostgreSQL thật), Playwright (giao diện) | |
| Giám sát | CloudWatch, Sentry | Log, lỗi, cảnh báo |
| Băm mật khẩu | argon2id | Chuẩn hiện hành |
| Mã hóa bí mật | AWS KMS | Bí mật xác thực hai lớp |

## 2. Phân tích giải pháp có sẵn – Giai đoạn 05 – 2026-11-09

- Yêu cầu cần đáp ứng: tài liệu `04` mục 8.
- Nguồn đã xét: nền ERP mã nguồn mở (Odoo, ERPNext), ERP thương mại (Misa, Base, SAP Business One).
- Phương án:
  1. Dùng lại nguyên trạng: không phù hợp vì cần sàn thương mại điện tử và điểm thưởng tích hợp sâu.
  2. Dùng lại có điều chỉnh: nền ERP mã nguồn mở cho kế toán, kho, nhân sự; tự xây sàn và điểm thưởng.
  3. Tham khảo cách làm, tự viết.
  4. Tự viết mới hoàn toàn.
- Đề xuất của AI: phương án 2 – lý do: giảm khối lượng phần kế toán, kho, nhân sự khi chưa có đội phát triển.
- Quyết định của người dùng: phương án 4, tự xây dựng 100% – 2026-11-09.

## 3. Phân tích giải pháp có sẵn – Thư viện cho MODULE_01 – 2026-11-09

- Yêu cầu cần đáp ứng: CHUC_NANG_04 đến CHUC_NANG_10 (đăng nhập, xác thực hai lớp), CHUC_NANG_05 (nhập Excel), mọi chức năng (kiểm tra dữ liệu đầu vào, hai ngôn ngữ).
- Nguồn đã tìm: kho npm; dự án chưa có mã nguồn; người dùng chưa có nguồn mã riêng.
- Từ khóa đã dùng: tên thư viện cụ thể; không chứa thông tin nghiệp vụ.

| Ứng viên | Dùng cho | Giấy phép | Phiên bản, cập nhật gần nhất | Tương thích công nghệ | Công sức điều chỉnh |
|---|---|---|---|---|---|
| NestJS (`@nestjs/core`) | Backend | MIT | 12.4.1, 2026-11-09 | TypeScript | Thấp |
| Next.js (`next`) | Giao diện web | MIT | 16.4.5, 2026-11-03 | TypeScript | Thấp |
| Drizzle ORM (`drizzle-orm`) | Cơ sở dữ liệu | Apache 2.0 | 0.45.4, 2026-10-08 | PostgreSQL | Thấp |
| AWS CDK (`aws-cdk-lib`) | Hạ tầng | Apache 2.0 | 2.275.0, 2026-10-26 | TypeScript | Thấp |
| BullMQ (`bullmq`) | Tác vụ nền | MIT | 6.7.2, 2026-11-07 | Redis | Thấp |
| openid-client | Đăng nhập Google, Microsoft | MIT | 6.8.9, 2026-11-02 | Node.js | Thấp |
| Không thêm thư viện | Đăng nhập Zalo: gọi trực tiếp API OAuth 2.0 của Zalo bằng `fetch` có sẵn (THAY_DOI_01) | Không áp dụng | Không áp dụng | Node.js | Thấp |
| argon2 | Băm mật khẩu, mã dự phòng | MIT | 0.45.2, 2026-11-03 | Node.js | Thấp |
| otplib | Mã TOTP | MIT | 13.6.0, 2026-10-31 | Node.js | Thấp |
| read-excel-file | Đọc tệp Excel nhập nhân viên | MIT | 9.3.14, 2026-10-29 | Node.js | Thấp |
| exceljs | Đọc tệp Excel (phương án thay thế) | MIT | 4.4.0, 2023-10-19 | Node.js | Thấp; không được cập nhật 3 năm |
| zod | Kiểm tra dữ liệu đầu vào, dùng chung backend và giao diện | MIT | 4.6.7, 2026-10-12 | TypeScript | Thấp |
| next-intl | Giao diện hai ngôn ngữ | MIT | 4.14.9, 2026-10-02 | Next.js | Thấp |
| Vitest | Kiểm thử đơn vị, tích hợp | MIT | 5.1.0, 2026-11-02 | TypeScript | Thấp |
| Playwright (`@playwright/test`) | Kiểm thử giao diện | Apache 2.0 | 1.65.0, 2026-11-05 | Trình duyệt | Thấp |

- Phương án: dùng lại nguyên trạng các thư viện trên; tự viết phần nghiệp vụ (phân quyền theo phạm vi, duyệt theo hạn mức, đánh số chứng từ) vì không thư viện nào đáp ứng đúng quy tắc trong tài liệu `07`.
- Đề xuất: dùng các thư viện trên, chọn read-excel-file thay exceljs – lý do: đều giấy phép MIT hoặc Apache 2.0, được cập nhật trong 2 tháng gần đây; exceljs không còn được cập nhật.
- Quyết định của người dùng: dùng các thư viện trên, chọn read-excel-file thay exceljs – 2026-11-09

## 4. Phân tích giải pháp có sẵn – Nguồn mã riêng V-com-ERP – 2026-11-09

- Nguồn: `github.com/vinhngtienmdb-ui/V-com-ERP` (người dùng cung cấp ngày 2026-11-09), commit `827e287` ngày 2026-10-06. Đọc bằng phiên con, không sửa repo.
- Hiện trạng repo:
  - Một ứng dụng React 19, Vite 6 kèm máy chủ Express `server.ts` (4.668 dòng). Trình duyệt gọi thẳng Supabase qua `src/services/dbService.ts`. Chế độ dữ liệu giả (`DEMO_MODE`) bật mặc định.
  - Mô hình một doanh nghiệp, tách khách thuê bằng `tenant_id`. Không có mô hình tập đoàn nhiều pháp nhân, trừ phần đơn vị trực thuộc trong kế toán (`acc_units`, `acc_internal_txn`, `acc_eliminations`).
  - Phân quyền theo vai trò cố định, không theo công ty, chi nhánh. Chính sách RLS của `user_roles` là `USING (true)`.
  - Khoảng 100 bảng, nhiều bảng lưu JSONB kiểu Firestore. Không có bộ chạy database migration thống nhất. Không dùng giao dịch cơ sở dữ liệu.
  - 84 tệp kiểm thử, phần lớn giả lập `dbService`.
  - Hơn 100 script sửa tệp mã bằng thay chuỗi (`fix_corruption*.ts`, `patch_*.cjs`), cho thấy mã sinh bằng AI được vá nhiều lần.
  - Một số nghiệp vụ là mô phỏng: xác thực VNeID bằng `setTimeout` (`VNeidVerificationModal.tsx`), token MISA giả.
  - Kế hoạch đích 26 app (MOD-01 đến MOD-26) chưa được áp vào mã.
- Đáp ứng yêu cầu đã duyệt của VComm:

| Yêu cầu | V-com-ERP |
|---|---|
| Tập đoàn nhiều công ty con, giao dịch nội bộ (tài liệu `04` mục 8.1) | Đáp ứng một phần (chỉ đơn vị trực thuộc trong kế toán) |
| Mini app dùng chung cơ sở dữ liệu, đăng nhập (mục 8.2) | Không đáp ứng (có kế hoạch, chưa có mã) |
| Phân quyền theo tập đoàn, công ty, chi nhánh (YCAU_NGHIEPVU_08) | Không đáp ứng |
| Đăng nhập Google, Microsoft, Zalo, số điện thoại (YCAU_NGHIEPVU_05) | Không đáp ứng (chỉ email, mật khẩu và TOTP) |
| Duyệt theo hạn mức có người thay thế (YCAU_NGHIEPVU_10, 11) | Đáp ứng một phần (có trình ký nhiều cấp) |
| Kiến trúc đã duyệt (tài liệu `12`) | Không đáp ứng (Supabase, Vercel, gọi cơ sở dữ liệu từ trình duyệt) |

- Phương án:
  1. Dùng lại nguyên trạng: không phù hợp (không đáp ứng kiến trúc, phân quyền, đa pháp nhân).
  2. Dùng lại có điều chỉnh: chuyển mã React sang kiến trúc mới. Công sức Cao vì chất lượng mã thấp, phải viết lại gần hết.
  3. Tham khảo cách làm, tự viết: dùng tài liệu nghiệp vụ, đặc tả (`specs/`), quyết định và logic đã có kiểm thử làm đầu vào khi phân tích từng module. Ví dụ:
     - sổ cái V-Xu (`vxuService.ts`);
     - kế toán Thông tư 99/2025, hợp nhất (`tt99Service.ts`);
     - hóa đơn điện tử (`einvoiceService.ts`), tính lương (`payrollEngine.ts`);
     - khấu trừ thuế cộng tác viên (`commissionWithholdingService.ts`);
     - trạng thái xác minh nhà bán (`sellerKycService.ts`);
     - SePay, Zalo ZNS.

     Viết lại theo tài liệu `12`, `16`, `17` và kiểm thử với PostgreSQL thật.
  4. Tự viết mới hoàn toàn, không đọc repo cũ.
- Đề xuất: phương án 3 – lý do: giữ kiến trúc và mô hình đa pháp nhân đã duyệt; tận dụng tri thức nghiệp vụ đã đầu tư; tránh mang theo lỗi bảo mật và cấu trúc của repo cũ.
- Phát hiện cần xử lý ngay: repo cũ dùng Thông tư 99/2025. Đã kiểm chứng Thông tư 99/2025/TT-BTC thay thế Thông tư 200 từ năm tài chính 2026 → lập THAY_DOI_03.
- Quyết định của người dùng: **CHƯA XÁC ĐỊNH**
