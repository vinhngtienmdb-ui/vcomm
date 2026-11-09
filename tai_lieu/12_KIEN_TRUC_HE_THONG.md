# 12. KIẾN TRÚC HỆ THỐNG

- Mô tả: Kiến trúc tổng thể, kiến trúc thành phần, cấu trúc thư mục, ràng buộc kỹ thuật.
- Phiên bản: 1.2
- Ngày cập nhật: 2026-11-10
- Trạng thái: Đã phê duyệt
- Thay đổi theo: THAY_DOI_01, THAY_DOI_02 (2026-11-09); CONG_VIEC_05 (2026-11-10): mini app Kho `apps/web-inventory`, thành phần phụ trợ của MODULE_03 (mục 3a, 3b)

Đã rà soát theo tài liệu `10`, `11` của MODULE_01 ngày 2026-11-09.

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
     Bên ngoài: cổng thanh toán │ đơn vị vận chuyển │ hóa đơn điện tử │ ngân hàng hoặc ví đối tác │ Google, Microsoft, Zalo (đăng nhập) │ tổ chức cung cấp dịch vụ xác thực điện tử (VNeID)
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

## 3. Thành phần phụ trợ cho MODULE_01

| Thành phần | Công nghệ | Chức năng dùng |
|---|---|---|
| Tác vụ nền | BullMQ trên Redis, chạy trong tiến trình riêng của `apps/api` | CHUC_NANG_18 (nhắc, chuyển duyệt quá hạn mỗi 15 phút), CHUC_NANG_21 (lấy tỷ giá mỗi sáng), đẩy sự kiện outbox |
| Lưu đệm quyền, mã OTP, giới hạn số lần thử | Redis | CHUC_NANG_06, CHUC_NANG_08, CHUC_NANG_13, yêu cầu phi chức năng hiệu năng |
| Gửi email | Amazon SES | CHUC_NANG_04, CHUC_NANG_06, CHUC_NANG_09 |
| Gửi mã OTP, đường dẫn qua điện thoại | Zalo ZNS trước, SMS thương hiệu dự phòng; **CHƯA XÁC ĐỊNH:** nhà cung cấp SMS | CHUC_NANG_04, CHUC_NANG_08, CHUC_NANG_09 |
| Đăng nhập liên kết | Google, Microsoft qua OpenID Connect; Zalo qua OAuth 2.0 của Zalo for Developers | CHUC_NANG_07, CHUC_NANG_24 |
| Xác thực nhà bán qua VNeID | Tổ chức cung cấp dịch vụ xác thực điện tử (**CHƯA XÁC ĐỊNH**), theo Nghị định 69/2024/NĐ-CP sửa đổi bởi Nghị định 320/2026/NĐ-CP | MODULE_02 (THAY_DOI_02) |
| Khóa bí mật, mã hóa | AWS Secrets Manager, AWS KMS | Tài liệu `22` mục 5 |

## 3a. Mini app web và cách vào chung tên miền

Mini app Nền tảng (`apps/web-platform`) là cửa vào chung: chuyển tiếp (rewrite của Next.js) đường dẫn của mini app khác sang ứng dụng web riêng của mini app đó, để mọi mini app dùng chung tên miền, cookie phiên HttpOnly và CSRF. Mỗi mini app đặt `basePath` bằng đường dẫn của mình và tự chuyển tiếp `/api/v1` sang backend (`API_ORIGIN`, mặc định `http://localhost:4000`).

| Mini app | Thư mục | Đường dẫn | Cổng phát triển | Biến môi trường ở `web-platform` (mặc định) |
|---|---|---|---|---|
| Nền tảng, trang chủ mini app | `apps/web-platform` | `/` | 3000 | Không áp dụng |
| Sản phẩm (CONG_VIEC_04) | `apps/web-catalog` | `/catalog` | 3001 | `CATALOG_ORIGIN` (`http://localhost:3001`) |
| Kho (CONG_VIEC_05) | `apps/web-inventory` | `/inventory` | 3002 | `INVENTORY_ORIGIN` (`http://localhost:3002`) |

Chạy riêng mini app Kho: `pnpm --filter web-inventory dev` (cổng 3002), vào qua `http://localhost:3000/inventory` khi mini app Nền tảng và backend đang chạy.

## 3b. Thành phần phụ trợ cho MODULE_03 Kho (CONG_VIEC_05)

| Thành phần | Công nghệ | Chức năng dùng |
|---|---|---|
| Sổ kho | Dịch vụ `StockLedgerService` (`apps/api/src/inventory/stock-ledger.service.ts`), chạy trong giao dịch của phiếu; MODULE_04, MODULE_05 gọi khi nhập, xuất kho | CHUC_NANG_40, CHUC_NANG_41, CHUC_NANG_42 |
| Giữ hàng | Dịch vụ `ReservationsService`, gọi trong giao dịch của bên giữ; MODULE_05 dùng cho đơn bán | CHUC_NANG_43 |
| Tác vụ nền | BullMQ: `inventory-reservation-expiry` mỗi 5 phút nhả hàng giữ hết hạn; `inventory-stock-alerts` lúc 7 giờ sáng giờ Việt Nam (`Asia/Ho_Chi_Minh`) gửi thông báo cảnh báo tồn an toàn | CHUC_NANG_43, CHUC_NANG_44 |
| Duyệt phiếu kho | Dịch vụ duyệt của MODULE_01 (CHUC_NANG_16); nghe sự kiện `core.approval.completed` qua outbox để ghi sổ hoặc nhả hàng giữ | CHUC_NANG_40, CHUC_NANG_41, CHUC_NANG_42 |
| Tem PDF | `pdfmake` (đã có), mã vạch Code 128 vẽ bằng mã trong `apps/api/src/inventory/code128.ts`, không thêm thư viện | CHUC_NANG_45 |

## 4. Kiến trúc triển khai

| Môi trường | Mục đích | Hạ tầng |
|---|---|---|
| Phát triển | Máy lập trình viên và phiên AI | Docker Compose: PostgreSQL 16, Redis; gửi email, SMS giả lập ghi ra log |
| Thử nghiệm (staging) | Người dùng nghiệm thu trước khi lên môi trường thật | AWS, cấu hình nhỏ, Aurora Serverless v2 tự dừng, không NAT, tắt ngoài giờ làm việc, dữ liệu giả |
| Thật | Vận hành | AWS vùng Singapore, ECS Fargate chip Arm tối thiểu 2 bản chạy song song mỗi dịch vụ, Aurora PostgreSQL nhiều vùng sẵn sàng (giai đoạn 1: 2×db.t4g.medium, 1 NAT gateway) |

- Mọi môi trường AWS dựng bằng AWS CDK; khóa bí mật mỗi môi trường khác nhau.
- Database migration chạy một lần trước khi bật phiên bản mới, cùng thứ tự ở mọi môi trường.

## 5. Sao lưu, phục hồi, ghi log, giám sát

- Sao lưu: Aurora tự sao lưu hằng ngày, giữ 35 ngày, phục hồi về một thời điểm bất kỳ trong khoảng đó; sao lưu được mã hóa.
- Phục hồi: diễn tập phục hồi vào môi trường thử nghiệm mỗi quý.
- Ghi log: log có cấu trúc (JSON) đẩy về CloudWatch, mỗi yêu cầu có mã yêu cầu; không ghi mật khẩu, mã OTP, token.
- Giám sát: Sentry cho lỗi ứng dụng; cảnh báo CloudWatch khi tỷ lệ lỗi, độ trễ, đăng nhập thất bại tăng bất thường.

## 6. Cấu trúc thư mục

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

## 7. Ràng buộc kỹ thuật

- Phải có kiểm thử tự động cho phân quyền theo phạm vi ngay từ MODULE_01, vì lỗi ở đây làm lộ dữ liệu giữa các công ty.
- Ranh giới schema phải được giữ nghiêm để có thể tách dịch vụ sau này.
- **CHƯA XÁC ĐỊNH:** yêu cầu lưu trữ dữ liệu cá nhân trong nước có áp dụng hay không (chờ ý kiến luật sư). Không chặn MODULE_01 vì dữ liệu cá nhân chỉ gồm thông tin nhân viên; chặn trước giai đoạn 2.

## Nội dung do AI đề xuất, người dùng đã xác nhận ngày 2026-11-09

| Vị trí | Nội dung |
|---|---|
| Mục 4 | Có môi trường thử nghiệm (staging) riêng; môi trường thật chạy tối thiểu 2 bản mỗi dịch vụ, Aurora nhiều vùng sẵn sàng |
| Mục 5 | Giữ sao lưu 35 ngày; diễn tập phục hồi mỗi quý |
