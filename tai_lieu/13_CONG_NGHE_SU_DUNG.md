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
