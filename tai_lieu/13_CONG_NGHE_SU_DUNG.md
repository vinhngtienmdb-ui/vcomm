# 13. CÔNG NGHỆ SỬ DỤNG

- Mô tả: Công nghệ, thư viện, dịch vụ hạ tầng và phân tích giải pháp có sẵn.
- Phiên bản: 1.4
- Ngày cập nhật: 2026-11-11
- Trạng thái: Đã phê duyệt
- Thay đổi theo: THAY_DOI_01, THAY_DOI_02 (2026-11-09); CONG_VIEC_16 (2026-11-10): nhà cung cấp hóa đơn điện tử (mục 1); CONG_VIEC_24 (2026-11-11): đơn vị vận chuyển GHN (REST bằng `fetch`, không thêm thư viện), biến môi trường kết nối; danh mục tỉnh xã từ bộ dữ liệu giấy phép MIT; CONG_VIEC_25 (2026-11-11): cổng thanh toán VNPAY (ký bằng `node:crypto`, không thêm thư viện), biến môi trường kết nối

## 1. Danh sách công nghệ

| Lớp | Lựa chọn | Lý do |
|---|---|---|
| Ngôn ngữ | TypeScript 6.0.3 (ghim cố định) | Một ngôn ngữ cho mọi phần. Bản 7.0.2 chạy được với NestJS, Drizzle, Vitest, CDK nhưng chưa dùng được với typescript-eslint, ts-node; người dùng chọn 6.0.3 ngày 2026-11-09 |
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
| Gửi mã OTP, đường dẫn | Zalo ZNS trước, SMS thương hiệu dự phòng (người dùng chọn 2026-11-09); **CHƯA XÁC ĐỊNH:** nhà cung cấp SMS, Zalo Official Account | Mã OTP, đường dẫn kích hoạt |
| Xác thực nhà bán qua VNeID | **CHƯA XÁC ĐỊNH:** tổ chức cung cấp dịch vụ xác thực điện tử | MODULE_02 (THAY_DOI_02) |
| Hóa đơn điện tử | MISA meInvoice (REST, gọi bằng `fetch` của Node.js, không thêm thư viện); bộ giả lập tự viết cho môi trường không phải môi trường thật; nhà cung cấp chọn theo từng công ty | CONG_VIEC_16; tài liệu API chính thức chưa đối chiếu (đặc tả `cong_viec/CONG_VIEC_16.md` mục 9, 16) |
| Đơn vị vận chuyển | Giao Hàng Nhanh (GHN) qua REST, gọi bằng `fetch` của Node.js, không thêm thư viện; biến môi trường `GHN_API_TOKEN`, `GHN_SHOP_ID`, `GHN_WEBHOOK_KEY`, `GHN_BASE_URL` (để trống: môi trường thử nghiệm `https://dev-online-gateway.ghn.vn`); kiểm thử dùng máy chủ giả lập | CONG_VIEC_24 (người dùng chọn GHN ngày 2026-11-11) |
| Cổng thanh toán | VNPAY theo đặc tả công khai phiên bản 2.1.0 (QR VNPAY, thẻ ATM nội địa, thẻ quốc tế), ký HMAC SHA512 bằng `node:crypto`, không thêm thư viện; biến môi trường `VNPAY_TMN_CODE`, `VNPAY_HASH_SECRET`, `VNPAY_RETURN_URL`, `VNPAY_PAYMENT_URL` (để trống: môi trường thử nghiệm `https://sandbox.vnpayment.vn/paymentv2/vpcpay.html`), `VCOMM_APP_LINK_BASE` (liên kết mở ứng dụng từ trang trả về, mặc định `vcomm://`); kiểm thử dùng giả lập; phải thử với tài khoản môi trường thử nghiệm của VNPAY trước khi phát hành | CONG_VIEC_25 (người dùng chọn VNPAY ngày 2026-11-11) |
| Danh mục tỉnh, xã hai cấp | Bộ dữ liệu `thanglequoc/vietnamese-provinces-database` v5.2.0 (giấy phép MIT, mã Tổng cục Thống kê), chuyển thành câu lệnh nạp trong database migration 0025; không thêm thư viện | CONG_VIEC_24 (người dùng chọn ngày 2026-11-11) |
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
- Quyết định của người dùng: phương án 3, tham khảo và viết lại – 2026-11-09

## 5. Ước tính chi phí hạ tầng AWS – 2026-11-09

- Phương pháp: giá theo yêu cầu (on-demand) vùng ap-southeast-1 lấy từ AWS Price List API (`https://pricing.us-east-1.amazonaws.com/offers/v1.0/aws/{Service}/current/ap-southeast-1/index.json`), các tệp phát hành từ 2026-09 đến 2026-11; CloudFront gói cố định theo `https://aws.amazon.com/cloudfront/pricing/`. Một tháng 730 giờ. Môi trường thật chạy 2 vùng sẵn sàng; môi trường thử nghiệm 1 vùng, 1 bản mỗi dịch vụ.
- Lưu lượng, dung lượng log là giả định của AI; chưa tính giảm giá Reserved Instance, Savings Plans; chưa tính ECR, Route 53, VPC endpoint dạng interface.

| Giai đoạn | Giả định chính | Môi trường thật (USD/tháng) | Thử nghiệm (USD/tháng) | Tổng |
|---|---|---|---|---|
| 1. Hệ thống quản trị doanh nghiệp | 200–300 nhân viên; api, worker, 8 mini app chung 1 image; Aurora 2×db.t4g.large; Redis 2×t4g.small | ~830 | ~245 | ~1.075 |
| 2. Thêm sàn thương mại điện tử | ~10.000 người dùng hoạt động mỗi ngày, ~3.000 đơn mỗi ngày; Aurora 2×r7g.large; OpenSearch 2 nút | ~2.220 | ~355 | ~2.575 |
| 3. Thêm điểm thưởng, cửa hàng liên kết | ~1.000 cửa hàng, ~20.000 giao dịch điểm mỗi ngày; Aurora 2×r7g.xlarge | ~3.420 | ~400 | ~3.820 |

- Khoản lớn nhất: Aurora (34–42% chi phí môi trường thật), Fargate (22–27%), từ giai đoạn 2 thêm Redis và OpenSearch (~25%).
- Aurora Serverless v2 tương đương ở giai đoạn 1, đắt gấp 1,5–3 lần ở giai đoạn 2, 3 khi tải ổn định. Đề xuất: môi trường thật dùng máy cố định; môi trường thử nghiệm dùng Serverless v2 tự dừng khi không dùng.
- Cách giảm chi phí giai đoạn 1 (người dùng duyệt áp dụng cả 3 cách ngày 2026-11-09):
  1. Aurora 2×db.t4g.medium thay vì t4g.large (giảm ~167 USD).
  2. Fargate chạy chip Arm (Graviton), tắt môi trường thử nghiệm ngoài giờ.
  3. Một NAT gateway ở giai đoạn 1, không dùng NAT ở môi trường thử nghiệm.

## 6. Nhà cung cấp VNeID, SMS, Zalo – tra cứu 2026-11-09

### VNeID (THAY_DOI_02)
- Nghị định 69/2024/NĐ-CP Điều 23 khoản 1: điều kiện cung cấp dịch vụ xác thực điện tử là "Đơn vị sự nghiệp công lập, doanh nghiệp trong Công an nhân dân". Nghị định 320/2026/NĐ-CP không sửa Điều 23. VComm không tự trở thành nhà cung cấp được; phải ký hợp đồng với một tổ chức đã được cấp phép.
- Tổ chức đã xác nhận được: Trung tâm RAR thuộc C06, Bộ Công an (công bố 15/08/2024; `https://voh.com.vn/phap-luat/bo-cong-an-trien-khai-cung-cap-dich-vu-xac-thuc-dien-tu-545434.html`). Dịch vụ: đăng nhập bằng VNeID, chia sẻ thông tin, đối chiếu dữ liệu, xác thực khuôn mặt. Đối tác đã triển khai: VNDIRECT, 9Pay, FPT Telecom, Agribank, Pharmacity.
- **CHƯA XÁC ĐỊNH:** danh sách chính thức các tổ chức được cấp phép; tài liệu API; xác thực tài khoản tổ chức (nhà bán là doanh nghiệp); giá; thời gian ký kết. Cần liên hệ trực tiếp Trung tâm RAR.

### Gửi mã OTP
- Zalo ZNS: mẫu xác thực (OTP) 300 đồng mỗi tin thành công, chưa gồm VAT (`https://zalo.solutions/zns/pricing`); mẫu phải được duyệt; gửi theo số điện thoại không cần người dùng theo dõi Official Account.
- SMS thương hiệu: phí duy trì khoảng 50.000 đồng mỗi thương hiệu mỗi tháng mỗi nhà mạng; giá mỗi tin OTP khoảng 350–800 đồng theo các đại lý (`https://v9.com.vn/sms-brandname-mobifone/`, `https://smarketing.vn/bao-gia-sms-brandname`). Viettel duyệt thương hiệu tối đa 2 ngày trên mạng Viettel, 5 ngày cho mạng khác (`https://viettelnet.vn/sms-brandname-viettel/`). Giá chính thức của nhà mạng chưa xác minh.
- Quyết định (2026-11-09): gửi OTP qua Zalo ZNS trước, chuyển sang SMS thương hiệu khi số điện thoại không dùng Zalo hoặc gửi ZNS thất bại.

### Zalo Login (THAY_DOI_01)
- OAuth phiên bản 4: `https://oauth.zaloapp.com/v4/permission`, `https://oauth.zaloapp.com/v4/access_token`, thông tin người dùng `https://graph.zalo.me/v2.0/me` với `fields=id,name,picture` (`https://github.com/zaloplatform/zalo-php-sdk`). SDK chính thức dùng PKCE (`code_challenge`).
- Zalo Login trên web không trả số điện thoại; số điện thoại chỉ lấy được trong Zalo Mini App qua `getPhoneNumber` có sự đồng ý của người dùng. Phù hợp quy tắc đã duyệt: nhân viên liên kết Zalo sau khi kích hoạt (QUYTAC_NGHIEPVU_08); người mua đăng ký bằng Zalo vẫn cần xác minh số điện thoại bằng OTP.

## 7. Phân tích giải pháp có sẵn – CONG_VIEC_44 ứng dụng kho – 2026-11-11

- Yêu cầu cần đáp ứng: CHUC_NANG_159 (quét mã vạch bằng camera điện thoại, máy quét cầm tay).
- Nguồn đã tìm: mã nguồn dự án (`apps/mobile-vcomm`: Expo SDK 58, `expo-secure-store`, cách gọi API bằng token); kho npm.
- Từ khóa đã dùng: tên thư viện cụ thể; không chứa thông tin nghiệp vụ.

| Ứng viên | Dùng cho | Giấy phép | Phiên bản, cập nhật gần nhất | Tương thích công nghệ | Công sức điều chỉnh |
|---|---|---|---|---|---|
| `expo-camera` | Đọc mã vạch, mã QR bằng camera (`CameraView`, `onBarcodeScanned`) | MIT | 58.0.14 (Expo SDK 58) | Expo SDK 58 đang dùng | Thấp |
| Không thêm thư viện | Máy quét cầm tay Android chế độ bàn phím: ô nhập nhận chuỗi kèm Enter | Không áp dụng | Không áp dụng | React Native | Thấp |

Quyết định: người dùng đồng ý thêm `expo-camera` ngày 2026-11-11. Kiểm thử đơn vị của ứng dụng dùng `vitest` (đã có trong dự án). Không thêm thư viện âm thanh: báo lỗi quét bằng rung (`Vibration` của React Native).
## Phân tích giải pháp có sẵn – Xuất công văn PDF, Word cho MODULE_13 (CONG_VIEC_52) – 2026-11-11

- Yêu cầu cần đáp ứng: QUYTAC_NGHIEPVU_366 (thể thức Nghị định 30/2020/NĐ-CP: khổ A4, lề, phông Times New Roman, cỡ, kiểu chữ từng thành phần), xuất PDF và Word.
- PDF: dùng `pdfmake` 0.3.12 đang có; phông Liberation Serif (SIL OFL 1.1, kích thước chữ tương đương Times New Roman, có đủ chữ tiếng Việt) đóng gói trong `apps/api/assets/fonts` kèm tệp giấy phép. Times New Roman có bản quyền, không đóng gói được.
- Word: thêm `docx` 9.15.3 (giấy phép MIT, cập nhật 2026-11-06; phụ thuộc `fflate`, `nanoid` giấy phép MIT), tạo tệp `.docx` ghi phông Times New Roman.
- Quyết định của người dùng: xuất cả PDF và Word, thêm thư viện `docx` – 2026-11-11; duyệt thêm `docx` 9.15.3 và phông Liberation Serif đóng gói trong mã khi xem trước lát L2 – 2026-11-11.
