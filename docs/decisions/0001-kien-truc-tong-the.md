# 0001 – Kiến trúc tổng thể

Trạng thái: **Đã chấp nhận** · Ngày: 2026-11-09

Tài liệu tổng thể đầy đủ (phạm vi, sàn TMĐT, loyalty, lộ trình, rủi ro) nằm ở Claude Docs "VComm – Nền tảng TMĐT cộng đồng & Loyalty". File này chỉ ghi các quyết định kỹ thuật ảnh hưởng trực tiếp đến code.

## Bối cảnh

- Tập đoàn nhiều công ty con, trên 5 kho/chi nhánh, trên 200 người dùng ERP, nhập khẩu thường xuyên.
- Thứ tự ra mắt: ERP → Sàn TMĐT → Loyalty + cửa hàng offline. Mục tiêu trên 200.000 người dùng cuối năm đầu.
- Tự xây 100%, phát triển chủ yếu cùng AI, có kế toán trưởng, một dev senior và tư vấn theo đợt để review.

## Quyết định

1. **Một ngôn ngữ: TypeScript** cho backend, web và mobile.
2. **Monorepo** (pnpm + Turborepo). Dự kiến cấu trúc:

   ```
   apps/
     api/              NestJS – một backend, chia module theo mini app
     web-platform/     Next.js – mini app Nền tảng + trang chủ app
     web-catalog/      Next.js – mini app Sản phẩm & Nhà bán
     web-inventory/    Next.js – mini app Kho
     ...               mỗi mini app ERP một thư mục web-*
     mobile-warehouse/ Expo – app kho (quét mã vạch)
     mobile-sales/     Expo – app nhân viên kinh doanh
   packages/
     ui/               design system dùng chung
     auth/             SSO, kiểm tra quyền phía client
     i18n/             file dịch vi/en
     contracts/        kiểu dữ liệu và schema API dùng chung
   docs/
   ```

3. **Mini app:** mỗi phân hệ ERP là một ứng dụng web riêng, triển khai riêng, nhưng dùng chung đăng nhập (SSO), design system và **một CSDL PostgreSQL**.
4. **Một CSDL, mỗi mini app một schema:** `core`, `catalog`, `inventory`, `purchasing`, `sales`, `finance`, `crm`, `hr`, sau này `loyalty`, `marketplace`.
   - Khóa ngoại được phép trỏ vào `core` và vào schema của mini app đứng trước trong chuỗi phụ thuộc (ví dụ `inventory` → `catalog`), không được tạo vòng.
   - Module chỉ ghi vào schema của mình. Cần thay đổi dữ liệu module khác thì gọi service của module đó hoặc phát sự kiện.
5. **Backend modular monolith** (NestJS). Loyalty Engine và Tìm kiếm là ứng viên tách thành dịch vụ riêng khi tải tăng.
6. **Đa pháp nhân từ ngày đầu:** mọi bảng nghiệp vụ có `company_id`; mọi truy vấn lọc theo phạm vi quyền.
7. **Không xóa cứng, không sửa chứng từ đã duyệt:** dùng trạng thái và chứng từ đảo.
8. **Sự kiện qua outbox** trong cùng giao dịch, worker đẩy sang SQS/SNS.
9. **Hạ tầng AWS** region Singapore: ECS Fargate, Aurora PostgreSQL, ElastiCache Redis, OpenSearch, S3 + CloudFront. Hạ tầng viết bằng code (Terraform hoặc CDK).

## Hệ quả

- Phải có test tự động cho phân quyền theo phạm vi ngay từ mini app đầu tiên, vì lỗi ở đây làm lộ dữ liệu giữa các công ty.
- Dùng chung một CSDL giúp báo cáo và liên kết chéo dễ, nhưng phải kỷ luật về ranh giới schema để sau này tách được.
