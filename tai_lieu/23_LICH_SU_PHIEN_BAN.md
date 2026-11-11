# 23. LỊCH SỬ PHIÊN BẢN

- Mô tả: Các phiên bản đã phát hành, nội dung và phương án quay lui riêng của từng phiên bản.
- Phiên bản: 1.0
- Ngày cập nhật: 2026-11-09
- Trạng thái: Đang cập nhật

## Phiên bản 0.4.0 – 2026-11-11 – Đã phát hành

- Chức năng mới:
  - Ứng dụng kho trên điện thoại `apps/mobile-warehouse` (CONG_VIEC_44): nhận hàng mua, xuất giao hàng, nhập, xuất khác, chuyển kho, kiểm kê bằng máy quét hoặc camera; đếm cộng dồn, đếm mù (cả web).
  - Nhân sự (MODULE_08, mini app `apps/web-hr`): hồ sơ nhân sự, giấy tờ mã hóa, người phụ thuộc, quá trình công tác, hợp đồng, phụ lục, nghỉ việc, nhắc hết hạn (CONG_VIEC_46); ca làm, chấm công (nhập tệp, ghi tay, ứng dụng GPS, mạng công ty, mã QR động), nghỉ phép, tăng ca, bảng công tháng (CONG_VIEC_47); bảng lương, bảo hiểm, thuế thu nhập cá nhân, bút toán lương, phiếu lương (CONG_VIEC_48, THAY_DOI_21).
  - Báo cáo quản trị toàn tập đoàn, mini app `apps/web-analytics` (CONG_VIEC_50): bán hàng, tồn kho, công nợ, hoa hồng và ví, tổng quan.
  - Khung nhiều cổng thanh toán và 10 cổng: MoMo, SePay, PayOS, chuyển khoản VietQR, BIDV, Ecopay, GPay, Google Pay, Apple Pay, ZaloPay (CONG_VIEC_32 đến 42). Đơn vị vận chuyển VNPost, Viettel Post, J&T, GHTK (CONG_VIEC_28 đến 31, THAY_DOI_20). Theo quyết định của người dùng 2026-11-11: phát hành ở trạng thái tắt; mỗi cổng, đơn vị chỉ bật được khi đã cấu hình khóa, và chỉ bật trên môi trường thật sau khi đã thử với tài khoản thử nghiệm của nhà cung cấp.
- Lỗi đã sửa: LOI_06 (sự kiện đơn VComm cùng giao dịch đảo thứ tự); LOI_07 (ngày duyệt bảng lương ghi theo đồng hồ cơ sở dữ liệu, lệch đồng hồ ứng dụng).
- Thay đổi dữ liệu: database migration `0040` đến `0043` (đơn vị vận chuyển), `0050` đến `0060` (cổng thanh toán), `0064` (kiểm kê), `0070` đến `0078` (Nhân sự), `0083` (báo cáo quản trị). Các tệp số nhỏ hơn `0063` của 0.3.0 vẫn được chạy vì trình chạy database migration ghi nhận theo tên tệp.
- Thay đổi API: thêm API theo tài liệu `17` (API_137 đến 139, 144 đến 161, 170 đến 175, API của cổng thanh toán, đơn vị vận chuyển); `GET /inventory/sales-orders` thêm trường `warehouseId` (tương thích).
- Thư viện mới: `expo-camera` (ứng dụng kho), `qrcode-generator` 2.0.4 (web-hr), `react-native-qrcode-svg` 6.3.26, `react-native-svg` 15.16.0 (ứng dụng VComm, cổng chuyển khoản).
- Biến môi trường mới: khóa kết nối từng cổng thanh toán (`MOMO_*`, `SEPAY_*`, `PAYOS_*`, `BANK_TRANSFER_*`, `BIDV_*`, `ECOPAY_*`, `GPAY_*`, `ZALOPAY_*`) và đơn vị vận chuyển (`VNPOST_*`, `VIETTEL_POST_*`, `JT_*`, `GHTK_*`); thiếu biến thì cổng, đơn vị không bật được.
- Rủi ro:
  - Cổng thanh toán, đơn vị vận chuyển chỉ thử trên bản giả lập; phải thử với tài khoản thử nghiệm của nhà cung cấp trước khi bật thật.
  - Nhân sự: thời hạn lưu, xóa hồ sơ người đã nghỉ chưa quy định (phải xử lý trước khi triển khai MODULE_08 lên môi trường thật); mức tham số pháp luật (lương cơ sở, lương tối thiểu vùng, giảm trừ gia cảnh) phải đối chiếu Công báo trước khi dùng thật; người dùng chấp nhận rủi ro giả vị trí GPS khi chấm công.
  - Ứng dụng kho chưa thử camera trên điện thoại thật.
  - 2 lỗ hổng Trung bình đã biết trong `@expo/cli` (rủi ro đã chấp nhận).
- Khả năng tương thích: tương thích ngược với 0.3.0; database migration chỉ thêm schema, bảng, cột.
- Công việc gộp trong phiên bản: CONG_VIEC_28 đến 42, 44, 46, 47, 48, 50; LOI_06, LOI_07; THAY_DOI_20, 21.
- Kiểm thử trên nhánh phát hành: xem tài liệu `25`.
- Tag: `v0.4.0` trên commit hợp nhất nhánh `phat-hanh/v0.4.0` vào `main` (gắn tự động khi CI trên `main` đạt).
- Phương án quay lui riêng của phiên bản:
  - Mã nguồn: triển khai lại tag `v0.3.0`.
  - Database migration: bản 0.3.0 không đọc schema `hr`, bảng mới của cổng, đơn vị vận chuyển, báo cáo; giữ nguyên khi quay lui mã. Khi cần gỡ hẳn: khôi phục bản sao lưu cơ sở dữ liệu chụp ngay trước khi chạy database migration của 0.4.0.
  - Dữ liệu cần sao lưu thêm: tệp giấy tờ nhân sự, tệp hợp đồng đã ký trong thư mục hoặc bucket lưu tệp.

## Phiên bản 0.3.0 – 2026-11-11 – Đã phát hành

- Chức năng mới:
  - Sản phẩm (CONG_VIEC_04): ngành hàng, đơn vị tính, sản phẩm, biến thể, mã vạch, ảnh; nhập Excel; liên kết, sao chép giữa công ty; kênh bán, nhóm khách, bảng giá, phiếu điều chỉnh giá.
  - Kho (CONG_VIEC_05): kho, vị trí, chủ hàng; phiếu nhập, xuất, điều chỉnh; tồn, lô, serial, giá vốn, thẻ kho; chuyển kho, kiểm kê, giữ hàng, tồn an toàn, in tem.
  - Đối tác (CONG_VIEC_06), Mua hàng (CONG_VIEC_07), Bán hàng (CONG_VIEC_08), Giao dịch nội bộ giữa công ty con (CONG_VIEC_09), Khuyến mãi (CONG_VIEC_12), Công nợ (CONG_VIEC_13).
  - Kế toán tổng hợp (CONG_VIEC_14), báo cáo tài chính theo Thông tư 99, Thông tư 133 (CONG_VIEC_15), hóa đơn điện tử (CONG_VIEC_16), đối soát ngân hàng (CONG_VIEC_18), đối soát thu hộ (CONG_VIEC_19), báo cáo tài chính hợp nhất (CONG_VIEC_20).
  - Mô hình B2C (THAY_DOI_14): tài khoản người mua VComm, giới thiệu (CONG_VIEC_23); đội kinh doanh nhiều cấp (CONG_VIEC_27); đặt hàng trên VComm, giao vận GHN (CONG_VIEC_24); thanh toán VNPAY, COD, hoàn tiền (CONG_VIEC_25); hoa hồng theo đơn, ví hoa hồng, rút tiền, thuế thu nhập cá nhân cộng dồn theo tháng, phí rút tiền (CONG_VIEC_26, THAY_DOI_17, THAY_DOI_19).
  - Sửa các công việc đã nghiệm thu theo mô hình B2C (CONG_VIEC_43, THAY_DOI_18): bỏ hoa hồng đội kinh doanh cũ (CONG_VIEC_17), tắt gán khách (CONG_VIEC_21), chặn đơn bán tay có hàng hóa theo cài đặt công ty, chứng từ dịch vụ không ghi thẻ kho, giao dịch nội bộ chỉ cho dịch vụ.
  - Ứng dụng: 6 mini app web mới (`web-catalog`, `web-inventory`, `web-purchasing`, `web-sales`, `web-finance`, `web-crm`), ứng dụng VComm (`mobile-vcomm`, Expo SDK 58).
- Lỗi đã sửa: LOI_03 (phiếu kho đồng thời tranh hàng khả dụng trả `400` thống nhất), LOI_04 (danh sách chỉ nhận phản hồi của lần tải mới nhất, CONG_VIEC_10), LOI_05 (giới hạn thời gian bước chuẩn bị kiểm thử, CONG_VIEC_11).
- Thay đổi dữ liệu: database migration `0003_catalog.sql` đến `0031_marketplace_shipping_fee_document.sql`, `0044` đến `0048` (hoa hồng, ví, rút tiền), `0061` đến `0063` (CONG_VIEC_43). Số `0032` đến `0043`, `0049` đến `0060` dành cho khung cổng thanh toán và các cổng chưa phát hành; trình chạy database migration chạy mọi tệp chưa có trong `public.schema_migrations` theo thứ tự tên nên các tệp số nhỏ hơn phát hành sau vẫn được chạy.
- Thay đổi API: thêm API theo tài liệu `17` của các module trên; API của 0.2.0 giữ nguyên.
- Thư viện mới: Next.js 16.4.5, next-intl 4.14.9, React 19.3.1 cho các mini app mới; Expo SDK 58, React Native 0.88.1, expo-router, expo-secure-store, expo-image-picker, react-native-web cho ứng dụng VComm.
- Biến môi trường mới: `APP_WEB_ORIGINS`; `GHN_API_TOKEN`, `GHN_SHOP_ID`, `GHN_WEBHOOK_KEY`, `GHN_BASE_URL`; `VNPAY_TMN_CODE`, `VNPAY_HASH_SECRET`, `VNPAY_PAYMENT_URL`, `VNPAY_RETURN_URL`.
- Không gồm trong phiên bản: khung nhiều cổng thanh toán và các cổng CONG_VIEC_32 đến 42 (phải thử với tài khoản thử nghiệm của nhà cung cấp trước khi phát hành); đơn vị vận chuyển VNPost, Viettel Post, J&T, GHTK (CONG_VIEC_28 đến 31, đang làm). Mã của ứng dụng nhân viên kinh doanh (CONG_VIEC_22, tạm dừng theo THAY_DOI_14) có trong mã nguồn vì công việc sau xây trên nó.
- Rủi ro:
  - GHN, VNPAY, hóa đơn điện tử, ngân hàng chỉ thử trên bản giả lập; phải nhập khóa và thử trên môi trường thử nghiệm trước môi trường thật.
  - Số lượng database migration lớn (32 tệp); phải sao lưu trước khi chạy.
  - LOI_01 còn mở; 2 lỗ hổng Trung bình đã biết trong `@expo/cli` (rủi ro đã chấp nhận, tài liệu `22`).
- Khả năng tương thích: tương thích ngược với 0.2.0; database migration chỉ thêm schema, bảng, cột, không xóa dữ liệu của 0.2.0.
- Công việc gộp trong phiên bản: CONG_VIEC_04 đến 21, 23 đến 27, 43; LOI_03; CONG_VIEC_10 (LOI_04), CONG_VIEC_11 (LOI_05).
- Kiểm thử trên nhánh phát hành: xem tài liệu `25`.
- Tag: `v0.3.0` trên commit hợp nhất nhánh `phat-hanh/v0.3.0` vào `main` (gắn tự động khi CI trên `main` đạt).
- Phương án quay lui riêng của phiên bản:
  - Mã nguồn: triển khai lại tag `v0.2.0`.
  - Database migration: bản 0.2.0 không đọc schema, bảng mới nên giữ nguyên khi quay lui mã. Khi cần gỡ hẳn: khôi phục bản sao lưu cơ sở dữ liệu chụp ngay trước khi chạy database migration của 0.3.0 (không xóa tay từng bảng vì các module có khóa ngoại chéo).
  - Dữ liệu cần sao lưu thêm: thư mục hoặc bucket lưu ảnh sản phẩm, tệp đính kèm, tệp hóa đơn điện tử.

## Phiên bản 0.2.0 – 2026-11-09 – Đã phát hành

- Chức năng mới (CONG_VIEC_03, hoàn thiện MODULE_01):
  - Cài đặt tích hợp (MAN_HINH_19): nhập mã ứng dụng Google, Microsoft, Zalo và khóa eSMS.vn trên giao diện, khóa bí mật mã hóa, kiểm tra kết nối, gửi thử tin, nhật ký gửi tin;
  - đăng nhập bằng số điện thoại (mã OTP qua Zalo ZNS, không được thì SMS), Google, Microsoft, Zalo; liên kết, hủy liên kết ở hồ sơ; kích hoạt tài khoản bằng Google, Microsoft;
  - Zalo ZNS cho chứng từ chờ duyệt, nhắc quá hạn, kết quả duyệt;
  - mẫu đề xuất do quản trị công ty tạo, 3 mẫu có sẵn (phiếu đề nghị chi, đề nghị tạm ứng, đề nghị mua sắm) (MAN_HINH_20);
  - đề xuất theo mẫu, gửi duyệt qua luồng duyệt có sẵn, tệp đính kèm (tối đa 10 tệp, 10 MB), in PDF (MAN_HINH_21); người duyệt xem nội dung đề xuất ở MAN_HINH_08.
- Lỗi đã sửa: không có lỗi đã cấp mã.
- Thay đổi dữ liệu: database migration `database/migrations/0002_cong_viec_03.sql` thêm 6 bảng (`integration_settings`, `otp_codes`, `message_deliveries`, `proposal_templates`, `proposals`, `attachments`), không sửa bảng cũ. Khi khởi động, API đồng bộ thêm 3 quyền (`platform.integration.manage`, `platform.proposal_template.manage`, `platform.proposal.create`) vào vai trò có sẵn.
- Thay đổi API: thêm API_02 đến API_05, API_49 đến API_54 (tài liệu `17`); API cũ giữ nguyên.
- Thư viện mới: pdfmake 0.3.12 (MIT), @aws-sdk/client-s3 3.1156.0 (Apache-2.0).
- Biến môi trường mới: `STORAGE_DRIVER` (`local` hoặc `s3`), `STORAGE_DIRECTORY`, `S3_BUCKET`, `AWS_REGION`. Bỏ `GOOGLE_CLIENT_*`, `MICROSOFT_CLIENT_*`, `ZALO_APP_*`, `SMS_DRIVER` (chuyển sang Cài đặt tích hợp).
- Rủi ro:
  - Chưa thử với eSMS, Google, Microsoft, Zalo, S3 thật; chỉ thử trên bản giả lập. Phải nhập khóa và thử trên môi trường thử nghiệm trước môi trường thật.
  - Khóa trong Cài đặt tích hợp mã hóa bằng `MFA_SECRET_KEY`; đổi khóa này thì phải nhập lại mọi khóa tích hợp và đăng ký lại xác thực hai lớp.
  - Môi trường thật phải đặt `STORAGE_DRIVER=s3`; để `local` thì tệp đính kèm mất khi thay máy chủ.
  - Chưa có tác vụ dọn bảng `otp_codes`, `message_deliveries`.
  - LOI_01 còn mở.
- Khả năng tương thích: tương thích ngược với 0.1.0; dữ liệu, API cũ không đổi.
- Công việc gộp trong phiên bản: CONG_VIEC_03.
- Tag: `v0.2.0` trên commit hợp nhất nhánh `phat-hanh/v0.2.0` vào `main`.
- Phương án quay lui riêng của phiên bản:
  - Mã nguồn: triển khai lại tag `v0.1.0`.
  - Database migration `0002_cong_viec_03.sql`: bản 0.1.0 không đọc các bảng mới nên có thể giữ nguyên khi quay lui mã. Chỉ xóa khi cần: sao lưu, rồi `DROP TABLE core.attachments, core.proposals, core.proposal_templates, core.message_deliveries, core.otp_codes, core.integration_settings;` và xóa dòng `0002_cong_viec_03.sql` khỏi `public.schema_migrations`.
  - Dữ liệu cần sao lưu thêm: thư mục hoặc bucket lưu tệp đính kèm; các dòng loại chứng từ `platform.proposal_*` và dãy số, chính sách duyệt của chúng do mẫu đề xuất tạo ra (giữ lại không ảnh hưởng 0.1.0).

## Phiên bản 0.1.0 – 2026-11-09 – Đã phát hành

- Chức năng mới: mini app Nền tảng (MODULE_01) trừ phần đăng nhập Google, Microsoft, Zalo, số điện thoại:
  - đăng nhập mật khẩu, phiên, xác thực hai lớp TOTP và mã dự phòng, quên và đặt lại mật khẩu, hồ sơ cá nhân;
  - công ty, chi nhánh, phòng ban; mời, kích hoạt, nhập Excel, khóa, vô hiệu hóa kèm bàn giao nhân viên;
  - vai trò, ma trận quyền, gán vai trò theo tập đoàn, công ty, chi nhánh;
  - chính sách duyệt theo hạn mức, hộp duyệt, nhắc và chuyển duyệt quá hạn;
  - dãy số chứng từ, tiền tệ và tỷ giá (lấy tự động từ Vietcombank lúc 8:30 sáng), nhật ký thao tác, thông báo trong ứng dụng;
  - giao diện tiếng Việt, tiếng Anh (MAN_HINH_01 đến 18).
- Lỗi đã sửa: LOI_02 (giới hạn 20 yêu cầu mỗi phút mỗi địa chỉ IP cho API không cần đăng nhập).
- Thay đổi dữ liệu: database migration `database/migrations/0001_core.sql` tạo schema `core` (29 bảng, partition nhật ký thao tác tháng 11, 12/2026) và dữ liệu khởi tạo (tiền tệ, mini app). API tự tạo trước partition nhật ký 3 tháng khi khởi động và mỗi ngày.
- Thay đổi API: API_01, API_06 đến API_48 dưới `/api/v1` (tài liệu `17`). API_02 đến API_05 chưa có.
- Rủi ro:
  - LOI_01 còn mở: đăng nhập dưới tải 200 người dùng đồng thời chưa đạt mốc 200 ms trên máy phát triển; cần đo lại trên môi trường thử nghiệm.
  - Cần Redis cho tác vụ nền và giới hạn số yêu cầu; không có Redis thì tác vụ nền không chạy, giới hạn đếm riêng từng tiến trình.
  - Máy chủ API cần gọi ra `portal.vietcombank.com.vn`; không gọi được thì quản lý tỷ giá nhận thông báo và nhập tay.
  - Khóa `MFA_SECRET_KEY`, `ACCESS_TOKEN_SECRET` của môi trường thật phải tạo mới, khác máy phát triển.
- Khả năng tương thích: phiên bản đầu tiên, không có phiên bản trước.
- Công việc gộp trong phiên bản: CONG_VIEC_01, CONG_VIEC_02, LOI_02.
- Tag: `v0.1.0` trên commit hợp nhất nhánh `phat-hanh/v0.1.0` vào `main`.
- Phương án quay lui riêng của phiên bản:
  - Mã nguồn: phiên bản đầu tiên nên quay lui là gỡ bản triển khai (dừng API, web), không có phiên bản cũ để chạy lại.
  - Database migration `0001_core.sql`: sao lưu toàn bộ cơ sở dữ liệu ngay trước khi chạy; quay lui bằng `DROP SCHEMA core CASCADE` và xóa dòng `0001_core.sql` khỏi `public.schema_migrations`, chỉ làm khi chưa có dữ liệu thật hoặc đã sao lưu và người dùng đồng ý.
  - Dữ liệu cần sao lưu thêm: không có.
