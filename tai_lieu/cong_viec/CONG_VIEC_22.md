# CONG_VIEC_22: Ứng dụng nhân viên kinh doanh (MODULE_07)

- Mô tả: Ứng dụng di động Expo `apps/mobile-sales` cho nhân viên kinh doanh: đăng nhập bằng token, khách của tôi, lập đơn bán, hoa hồng của tôi, ghé thăm khách (vị trí, ảnh, ghi chú); web-crm có màn hình ghé thăm cho trưởng phòng, quản lý.
- Phiên bản: 0.1
- Ngày cập nhật: 2026-11-10
- Trạng thái: Bản nháp. Người dùng xác nhận thiết kế ngày 2026-11-10 (không làm bản mẫu giao diện riêng, xem trước từng lát thay cho bản mẫu).
- Nguồn: tài liệu `05` mục 2.1 (ứng dụng nhân viên kinh doanh), `12` (`apps/mobile-sales`, Expo), `13`, `22` mục 3 (token làm mới 90 ngày cho ứng dụng kinh doanh); THAY_DOI_13; quyết định của người dùng ngày 2026-11-10 trong tài liệu `02`.

## 1. Mục tiêu

Nhân viên kinh doanh làm việc với khách của mình ngay trên điện thoại: xem khách, công nợ, lập đơn, ghi lượt ghé thăm có bằng chứng, theo dõi hoa hồng.

## 2. Phạm vi

Trong phạm vi:
- Ứng dụng Expo SDK 58 (expo-router, expo-secure-store, expo-location, expo-image-picker; xem trước bằng react-native-web), dùng chung `packages/contracts`, `packages/i18n`.
- API đăng nhập cho ứng dụng (trả token, làm mới, đăng xuất); xác thực hai lớp như web.
- Khách của tôi: danh sách, tìm, chi tiết (liên hệ, công nợ, đơn gần đây), gọi điện, chỉ đường, thêm khách, nhận đối tác có sẵn.
- Đơn bán: danh sách đơn của tôi, lập, sửa, gửi đơn (dùng API đơn bán hiện có).
- Hoa hồng của tôi: phát sinh tháng, bảng hoa hồng tháng của chính mình.
- Ghé thăm khách: ghi lượt ghé thăm trên ứng dụng; xem lịch sử trên ứng dụng và web-crm.

Ngoài phạm vi: dùng khi mất mạng; đóng gói lên App Store, Google Play; thông báo đẩy; đăng nhập bằng Google, Microsoft, Zalo, mã OTP trên ứng dụng (dùng mật khẩu); ứng dụng kho.

## 3. Yêu cầu nghiệp vụ và chức năng

- YCAU_NGHIEPVU_47: Nhân viên kinh doanh làm việc với khách của mình trên điện thoại; ghi ghé thăm khách có vị trí; xem hoa hồng của mình.
- CHUC_NANG_99: Đăng nhập ứng dụng di động bằng token.
- CHUC_NANG_100: Khách của tôi trên ứng dụng (danh sách, tóm tắt khách, thêm, nhận khách).
- CHUC_NANG_101: Đơn bán trên ứng dụng.
- CHUC_NANG_102: Hoa hồng của tôi.
- CHUC_NANG_103: Ghé thăm khách (ghi, xem trên ứng dụng và web-crm).

## 4. Quy tắc nghiệp vụ

- QUYTAC_NGHIEPVU_136: Ứng dụng đăng nhập bằng thư điện tử, mật khẩu; tài khoản bắt buộc xác thực hai lớp thì nhập mã TOTP hoặc mã dự phòng (chưa đăng ký xác thực hai lớp thì đăng ký trên web trước). Phiên của ứng dụng: token truy cập 15 phút, token làm mới 90 ngày, đổi mới mỗi lần dùng, dùng lại token cũ thì thu hồi cả chuỗi (như web). Token lưu trong bộ nhớ an toàn của máy (trên bản xem trước web: bộ nhớ phiên của trình duyệt). Đăng xuất thu hồi phiên. Giới hạn số lần thử như web. Chỉ người có quyền `sales.access` ở công ty đang chọn dùng được ứng dụng; người khác thấy thông báo không có quyền. Chọn công ty như web (công ty mặc định, đổi được).
- QUYTAC_NGHIEPVU_137: Khách của tôi theo phạm vi xem của CONG_VIEC_21 (QUYTAC_NGHIEPVU_129). Tóm tắt một khách: thông tin liên hệ, điều khoản thanh toán, công nợ phải thu còn lại và phần quá hạn (theo sổ công nợ CONG_VIEC_13), 10 đơn bán gần nhất trong phạm vi (API_113); 5 lượt ghé thăm gần nhất lấy qua API_114 theo phạm vi xem ghé thăm. Hạn mức công nợ không hiện (thông tin nhạy cảm). Số âm (khách trả trước nhiều hơn nợ) hiện là "Khách trả trước".
- QUYTAC_NGHIEPVU_138: Ghé thăm khách: chọn khách trong phạm vi xem; bắt buộc vị trí (vĩ độ −90 đến 90, kinh độ −180 đến 180, độ chính xác 0 đến 10.000 mét) lấy từ máy lúc ghi; không cho phép hoặc không lấy được vị trí thì không ghi được. Ghi chú kết quả bắt buộc 1 đến 1.000 ký tự. 0 đến 3 ảnh, mỗi ảnh JPEG hoặc PNG (kiểm theo nội dung tệp), tối đa 5 MB; ứng dụng chỉ mở máy ảnh, không chọn từ thư viện. Thời điểm ghé thăm do máy chủ ghi. Lượt ghé thăm không sửa, không xóa.
- QUYTAC_NGHIEPVU_139: Xem ghé thăm: người có quyền `crm.customer.view_all` xem mọi lượt của công ty; người khác xem lượt do mình hoặc nhân viên phòng mình quản lý ghi (QUYTAC_NGHIEPVU_130). Lọc theo nhân viên, khách, khoảng ngày. Vị trí mở bằng liên kết bản đồ Google Maps; ảnh chỉ tải qua API có kiểm quyền.
- QUYTAC_NGHIEPVU_140: Hoa hồng của tôi (quyền `finance.commission.view_own`): theo tháng, tổng tiền thu tính hoa hồng và hoa hồng tạm tính từ các phát sinh của chính mình (CONG_VIEC_17), từng phát sinh theo đơn; các bảng hoa hồng tháng chờ duyệt, đã ghi sổ có dòng của mình (cơ sở, phần trăm đạt, hệ số, hoa hồng). Chỉ trả dữ liệu của người đang đăng nhập.

## 5. Vai trò và quyền

| Quyền | Vai trò hệ thống có sẵn |
|---|---|
| `crm.visit.manage` Ghi lượt ghé thăm khách | Nhân viên bán hàng, Quản trị công ty, Quản trị tập đoàn |
| `finance.commission.view_own` Xem hoa hồng của chính mình | Nhân viên bán hàng, Quản trị công ty, Quản trị tập đoàn |

Xem ghé thăm cần `crm.partner.view` (phạm vi theo QUYTAC_NGHIEPVU_139). Lập đơn bán dùng quyền đơn bán hiện có.

## 6. Luồng nghiệp vụ

Luồng 34: nhân viên đăng nhập ứng dụng → khách của tôi → mở khách → ghé thăm: bật vị trí, chụp ảnh, ghi chú, lưu → lập đơn bán cho khách, gửi (duyệt ngoại lệ như web) → xem hoa hồng của tôi. Trưởng phòng xem ghé thăm trên web-crm hoặc ứng dụng.

## 7. Màn hình

Ứng dụng (khổ điện thoại; bản xem trước web):
- MAN_HINH_66 Đăng nhập ứng dụng (thư điện tử, mật khẩu, mã xác thực hai lớp).
- MAN_HINH_67 Khách của tôi (tìm, danh sách; thêm khách, nhận đối tác có sẵn).
- MAN_HINH_68 Chi tiết khách (liên hệ, gọi, chỉ đường, công nợ, đơn gần đây, ghé thăm gần đây; nút Ghé thăm, Lập đơn).
- MAN_HINH_69 Đơn bán (danh sách đơn của tôi; lập, sửa, gửi đơn).
- MAN_HINH_70 Hoa hồng của tôi (chọn tháng; tổng, phát sinh; bảng tháng).
- MAN_HINH_71 Ghé thăm (ghi lượt mới; lịch sử của tôi hoặc của phòng).
- Thanh điều hướng dưới: Khách, Đơn, Ghé thăm, Hoa hồng, Tài khoản (đổi công ty, đăng xuất).

Web-crm:
- MAN_HINH_72 Ghé thăm khách (lọc nhân viên, khách, ngày; ảnh; liên kết bản đồ).
- Sửa MAN_HINH_37: thẻ "Ghé thăm gần đây".

## 8. Dữ liệu và API

- Database migration 0022: `crm.visits` (công ty, khách, người ghi, thời điểm, vĩ độ, kinh độ, độ chính xác, ghi chú); `core.attachments.owner_type` thêm `visit`; chỉ mục theo công ty và ngày, theo khách, theo người ghi; quyền mới.
- API_112 đăng nhập ứng dụng: `POST /auth/app/login`, `POST /auth/app/refresh`, `POST /auth/app/logout` (token trong thân yêu cầu, phản hồi); xác thực hai lớp dùng API hiện có với header `Authorization`.
- API_113 tóm tắt khách: `GET /crm/partners/:id/summary`.
- API_114 ghé thăm: `POST /crm/visits` (multipart: dữ liệu và ảnh), `GET /crm/visits`, `GET /crm/visits/:id`, `GET /crm/visits/:id/photos/:photoId`.
- API_115 hoa hồng của tôi: `GET /finance/my-commissions?month=YYYY-MM`.
- Ứng dụng dùng lại API_71, 72 (đối tác), API đơn bán, tùy chọn bán hàng, giá.

## 9. Điều kiện đặc biệt

Vị trí, ảnh là dữ liệu cá nhân: chỉ thu khi nhân viên chủ động ghi ghé thăm; ứng dụng xin quyền vị trí, máy ảnh lúc dùng, không theo dõi nền.

## 10. Tiêu chí nghiệm thu

| Mã | Tiêu chí | Mức | Kịch bản |
|---|---|---|---|
| TIEUCHI_NGHIEMTHU_157 | Ứng dụng đăng nhập bằng token (kèm xác thực hai lớp), làm mới xoay vòng 90 ngày, dùng lại token cũ thu hồi chuỗi, đăng xuất thu hồi; người không có quyền bán hàng không vào được | Bắt buộc | KICHBAN_KIEMTHU_287, 288 |
| TIEUCHI_NGHIEMTHU_158 | Khách của tôi, tóm tắt khách đúng phạm vi, công nợ, đơn gần đây; khách ngoài phạm vi nhận 404 | Bắt buộc | KICHBAN_KIEMTHU_289 |
| TIEUCHI_NGHIEMTHU_159 | Ghé thăm: bắt buộc vị trí, ghi chú; 0 đến 3 ảnh đúng định dạng, kích thước; chỉ khách trong phạm vi; xem theo phạm vi; ảnh kiểm quyền | Bắt buộc | KICHBAN_KIEMTHU_290, 291 |
| TIEUCHI_NGHIEMTHU_160 | Hoa hồng của tôi chỉ dữ liệu của mình, tổng khớp phát sinh, bảng tháng đúng dòng của mình | Bắt buộc | KICHBAN_KIEMTHU_292 |
| TIEUCHI_NGHIEMTHU_161 | Ứng dụng: đăng nhập, khách, chi tiết, lập và gửi đơn, ghé thăm, hoa hồng chạy được trên bản xem trước web khổ điện thoại | Bắt buộc | KICHBAN_KIEMTHU_293 |
| TIEUCHI_NGHIEMTHU_162 | MAN_HINH_72, thẻ ghé thăm trên MAN_HINH_37 hiển thị đúng trên máy tính và điện thoại | Mong muốn | KICHBAN_KIEMTHU_294 |

## 11. Kịch bản kiểm thử

- KICHBAN_KIEMTHU_287 đến 292: tự động, `apps/api/test/c22-sales-app.test.ts`.
- KICHBAN_KIEMTHU_293, 294: thủ công trên trình duyệt (bản xem trước web của ứng dụng khổ 390 điểm ảnh; web-crm).

## 12. Ràng buộc kỹ thuật

Thêm thư viện theo quyết định người dùng: expo 58, expo-router, expo-secure-store, expo-location, expo-image-picker, react-native, react-native-web, react-dom (bản web). Không thêm thư viện giao diện; dùng thành phần React Native cơ bản, màu và khoảng cách lấy từ tài liệu `15` (sao giá trị sang tệp chủ đề của ứng dụng). Lưu ảnh qua `FILE_STORAGE` và bảng `core.attachments` như đề xuất (CONG_VIEC_03).

## 13. Thành phần không được thay đổi

Đăng nhập web bằng cookie; phạm vi xem của CONG_VIEC_21; cách tính hoa hồng CONG_VIEC_17.

## 14. Các lát và điểm xem trước

- L0: API đăng nhập ứng dụng; khung ứng dụng Expo (đăng nhập, xác thực hai lớp, chọn công ty, thanh điều hướng). Điểm xem trước: đăng nhập trên bản web khổ điện thoại.
- L1: khách của tôi, tóm tắt khách, thêm, nhận khách.
- L2: đơn bán trên ứng dụng.
- L3: hoa hồng của tôi.
- L4: ghé thăm khách (API, ứng dụng, web-crm).

## 15. Kết quả đối chiếu định nghĩa hoàn thành

Chưa đối chiếu.

## 16. Giới hạn đã biết

Chưa có.
