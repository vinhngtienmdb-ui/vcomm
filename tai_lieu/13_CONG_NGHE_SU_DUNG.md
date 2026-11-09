# 13. CÔNG NGHỆ SỬ DỤNG

- Mô tả: Công nghệ, thư viện, dịch vụ hạ tầng và phân tích giải pháp có sẵn.
- Phiên bản: 0.1
- Ngày cập nhật: 2026-11-09
- Trạng thái: Bản nháp

## 1. Danh sách công nghệ

| Lớp | Lựa chọn | Lý do |
|---|---|---|
| Ngôn ngữ | TypeScript | Một ngôn ngữ cho mọi phần, AI viết tốt |
| Quản lý monorepo | pnpm, Turborepo | Chia sẻ kiểu dữ liệu và thư viện giữa các phần |
| Backend | NestJS | Cấu trúc module rõ, phổ biến |
| Truy cập cơ sở dữ liệu | **CHƯA XÁC ĐỊNH:** Prisma hoặc Drizzle | Chọn ở giai đoạn 05 sau khi so sánh khả năng làm việc với nhiều schema |
| Giao diện web | Next.js, shadcn/ui | Một bộ thành phần cho mọi mini app |
| Ứng dụng di động | React Native (Expo) | Một mã nguồn cho iOS và Android |
| Cơ sở dữ liệu | PostgreSQL 16 (Amazon Aurora) | Giao dịch toàn vẹn cho kế toán và sổ cái điểm |
| Bộ nhớ đệm, hàng đợi nhẹ | Redis (ElastiCache), BullMQ | Phiên, quyền, giỏ hàng, tác vụ nền |
| Sự kiện giữa module | Outbox, Amazon SQS/SNS | Không mất sự kiện |
| Tìm kiếm | Amazon OpenSearch | Tìm sản phẩm tiếng Việt có dấu và không dấu |
| Lưu tệp | S3, CloudFront | Ảnh, video sản phẩm và cộng đồng |
| Chạy ứng dụng | ECS Fargate, vùng Singapore | Không quản trị máy chủ, tự co giãn |
| Hạ tầng bằng mã | **CHƯA XÁC ĐỊNH:** Terraform hoặc AWS CDK | |
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

Phân tích chi tiết thư viện cho từng chức năng (đăng nhập, phân quyền, hàng đợi…) làm trong đặc tả công việc tương ứng.
