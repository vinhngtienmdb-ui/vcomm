# 12. KIẾN TRÚC HỆ THỐNG

- Mô tả: Kiến trúc tổng thể, kiến trúc thành phần, cấu trúc thư mục, ràng buộc kỹ thuật.
- Phiên bản: 0.1
- Ngày cập nhật: 2026-11-09
- Trạng thái: Bản nháp

Tài liệu được lập trước giai đoạn 03, 04 từ các quyết định của người dùng. Phải rà soát lại khi giai đoạn 04 hoàn thành, trước khi trình phê duyệt giai đoạn 05.

## 1. Kiến trúc tổng thể

```
Ứng dụng người dùng cuối          Trang nhà bán      Cửa hàng liên kết     Mini app quản trị doanh nghiệp
(iOS, Android, web)               (web)              (web, máy tính bảng)  (web) + ứng dụng kho + ứng dụng kinh doanh
        │                            │                    │                         │
        └────────────────────────────┴─────────┬──────────┴─────────────────────────┘
                                               ▼
                          Cổng API: xác thực, phân quyền, giới hạn tần suất
                                               ▼
              Backend NestJS – một ứng dụng chia module (modular monolith)
   core │ catalog │ inventory │ purchasing │ sales │ finance │ crm │ hr │ (sau: marketplace, community, loyalty)
                                               ▼
     PostgreSQL (Aurora) │ Redis │ OpenSearch │ S3 + CloudFront │ SQS/SNS (sự kiện từ outbox)
                                               ▼
     Bên ngoài: cổng thanh toán │ đơn vị vận chuyển │ hóa đơn điện tử │ ngân hàng hoặc ví đối tác │ Google, Microsoft (đăng nhập)
```

## 2. Quyết định kiến trúc

1. **Một ngôn ngữ TypeScript** cho backend, web và di động.
2. **Monorepo** quản lý bằng pnpm và Turborepo.
3. **Mini app:** mỗi phân hệ quản trị doanh nghiệp là một ứng dụng web riêng, triển khai riêng, dùng chung đăng nhập một lần (SSO), hệ thống thiết kế và một cơ sở dữ liệu. Người dùng vào từ trang chủ mini app và chỉ thấy mini app mình có quyền.
4. **Một cơ sở dữ liệu PostgreSQL, mỗi module một schema:** `core`, `catalog`, `inventory`, `purchasing`, `sales`, `finance`, `crm`, `hr`; sau này `marketplace`, `community`, `loyalty`.
   - Khóa ngoại chỉ được trỏ vào `core` và vào schema của module đứng trước trong thứ tự phụ thuộc; không tạo vòng.
   - Module chỉ ghi vào schema của mình; thay đổi dữ liệu module khác qua service của module đó hoặc qua sự kiện.
5. **Backend một ứng dụng chia module.** Điểm thưởng và tìm kiếm là ứng viên tách thành dịch vụ riêng khi tải tăng.
6. **Đa pháp nhân từ ngày đầu:** mọi bảng nghiệp vụ có `company_id`; mọi truy vấn lọc theo phạm vi quyền ngay trong câu truy vấn.
7. **Không xóa cứng dữ liệu nghiệp vụ, không sửa chứng từ đã duyệt:** dùng trạng thái và chứng từ đảo.
8. **Sự kiện giữa module qua outbox:** ghi sự kiện trong cùng giao dịch với dữ liệu, tiến trình nền đẩy sang SQS/SNS.
9. **Hạ tầng AWS vùng Singapore:** ECS Fargate, Aurora PostgreSQL, ElastiCache Redis, OpenSearch, S3, CloudFront; hạ tầng viết bằng mã (Terraform hoặc CDK).

## 3. Cấu trúc thư mục

Chia theo phần chạy riêng của hệ thống, bên trong chia theo module. Chỉ tạo thư mục khi có mã cần đặt vào.

```
apps/
  api/                  Backend NestJS. Mỗi module một thư mục: src/core, src/catalog, src/inventory...
                        Không chứa mã giao diện.
  web-platform/         Mini app Nền tảng và trang chủ mini app.
  web-<module>/         Mỗi mini app quản trị doanh nghiệp một thư mục (web-catalog, web-inventory...).
                        Chỉ gọi API, không truy cập cơ sở dữ liệu.
  mobile-warehouse/     Ứng dụng kho (Expo).
  mobile-sales/         Ứng dụng nhân viên kinh doanh (Expo).
packages/
  ui/                   Thành phần giao diện dùng chung, sinh từ tài liệu 15.
  auth/                 Đăng nhập một lần và kiểm tra quyền phía giao diện.
  i18n/                 Tệp dịch tiếng Việt, tiếng Anh.
  contracts/            Kiểu dữ liệu và lược đồ API dùng chung giữa backend và giao diện.
database/
  migrations/           Database migration theo thứ tự, mỗi tệp thuộc một schema.
tai_lieu/               Bộ tài liệu dự án.
```

## 4. Ràng buộc kỹ thuật

- Phải có kiểm thử tự động cho phân quyền theo phạm vi ngay từ MODULE_01, vì lỗi ở đây làm lộ dữ liệu giữa các công ty.
- Ranh giới schema phải được giữ nghiêm để có thể tách dịch vụ sau này.
- **CHƯA XÁC ĐỊNH:** yêu cầu lưu trữ dữ liệu cá nhân trong nước có áp dụng hay không (chờ ý kiến luật sư).
