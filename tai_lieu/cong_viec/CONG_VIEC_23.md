# CONG_VIEC_23: Tài khoản người mua VComm (MODULE_09, phần lõi 1)

- Mô tả: Khách tự đăng ký tài khoản trên ứng dụng sàn VComm bằng số điện thoại và mã OTP, gắn với người giới thiệu qua mã giới thiệu (số điện thoại) hoặc đường dẫn giới thiệu. Tài khoản nhân viên kinh doanh là tài khoản người mua được quản trị đánh dấu. Ứng dụng Expo của CONG_VIEC_22 trở thành ứng dụng VComm cho người mua.
- Phiên bản: 0.3
- Ngày cập nhật: 2026-11-10
- Trạng thái: Người dùng xác nhận thiết kế ngày 2026-11-10 (không làm bản mẫu giao diện riêng, xem trước từng lát thay cho bản mẫu). Đã làm L0 đến L3, sửa lỗi rà soát độc lập; chờ nghiệm thu.
- Nguồn: THAY_DOI_14; quyết định của người dùng ngày 2026-11-10 trong tài liệu `02`; tài liệu `05` (MODULE_09); CONG_VIEC_03 (OTP số điện thoại, eSMS); CONG_VIEC_22 (đăng nhập ứng dụng bằng token, khung Expo).

## 1. Mục tiêu

Khách tự tạo tài khoản mua hàng trên VComm và được gắn đúng người giới thiệu, làm căn cứ tính hoa hồng giới thiệu và hoa hồng đội kinh doanh ở CONG_VIEC_26.

## 2. Phạm vi

Trong phạm vi:
- Đăng ký bằng số điện thoại, OTP qua SMS (dùng lại OTP và eSMS của CONG_VIEC_03), họ tên, mật khẩu, mã giới thiệu không bắt buộc.
- Đăng nhập người mua bằng số điện thoại và mật khẩu hoặc OTP; quên mật khẩu qua OTP.
- Mã giới thiệu, đường dẫn giới thiệu, chia sẻ; danh sách người tôi đã giới thiệu; nhập mã người giới thiệu sau khi đăng ký (một lần, khi chưa có).
- Quản trị trên web-crm: danh sách, chi tiết tài khoản người mua; đổi người giới thiệu có lý do và lịch sử; đánh dấu, bỏ đánh dấu nhân viên kinh doanh.
- Ứng dụng VComm: đổi `apps/mobile-sales` thành `apps/mobile-vcomm`; màn hình đăng ký, đăng nhập, quên mật khẩu, tài khoản, người tôi giới thiệu; phần Kinh doanh (khách tôi phụ trách) chỉ hiện với nhân viên kinh doanh.
- Sửa các lỗi Cao của phần làm mới token ứng dụng (rà soát CONG_VIEC_22) và lỗi làm mới đồng thời cùng token.

Ngoài phạm vi: mua hàng, giỏ hàng, đơn (CONG_VIEC_24); thanh toán (CONG_VIEC_25); hoa hồng, ví (CONG_VIEC_26); đăng nhập Zalo trên ứng dụng; đóng gói lên App Store, Google Play; mở đường dẫn giới thiệu thẳng vào ứng dụng đã cài (deep link) — bản này mở trang đăng ký trên bản web.

Các màn hình khách B2B, lập đơn bán, ghé thăm, hoa hồng tháng của CONG_VIEC_22 (chưa nghiệm thu) được gỡ khỏi ứng dụng vì nhân viên kinh doanh không tạo đơn giùm, không bán B2B (THAY_DOI_14). API của các phần đó giữ nguyên, đánh giá lại ở công việc sửa CONG_VIEC_21, 17.

## 3. Yêu cầu nghiệp vụ và chức năng

- YCAU_NGHIEPVU_48: Khách tự đăng ký tài khoản sàn VComm, gắn với người giới thiệu; nhân viên kinh doanh là tài khoản thường được đánh dấu để cấp quyền.
- CHUC_NANG_104: Đăng ký tài khoản người mua bằng số điện thoại và OTP.
- CHUC_NANG_105: Đăng nhập người mua, quên mật khẩu.
- CHUC_NANG_106: Giới thiệu: mã, đường dẫn, chia sẻ, người tôi giới thiệu, nhập mã sau đăng ký.
- CHUC_NANG_107: Quản trị tài khoản người mua: xem, đổi người giới thiệu, lịch sử.
- CHUC_NANG_108: Đánh dấu nhân viên kinh doanh; khách tôi phụ trách.

## 4. Quy tắc nghiệp vụ

- QUYTAC_NGHIEPVU_141: Đăng ký: số điện thoại Việt Nam, chuẩn hóa dạng +84; số đã có tài khoản thì báo "Số điện thoại đã có tài khoản" và gợi ý đăng nhập. OTP như QUYTAC_NGHIEPVU_32 (6 chữ số, 5 phút, sai 5 lần thì hủy mã, tối đa 5 lần gửi mỗi giờ mỗi số, tính chung mọi mục đích; tổng 300 mã đăng ký mỗi giờ toàn hệ thống); mỗi lượt thử giữ trước bằng lệnh nguyên tử; mã OTP đăng ký chỉ dùng cho đăng ký. Họ tên 1 đến 100 ký tự; mật khẩu theo chính sách mật khẩu hiện có. Đăng ký xong tài khoản ở trạng thái hoạt động, đăng nhập ngay trên ứng dụng.
- QUYTAC_NGHIEPVU_142: Mã giới thiệu là số điện thoại của người giới thiệu (nhập dạng 0912345678 hoặc +84912345678). Người giới thiệu phải là tài khoản đang hoạt động; không tự giới thiệu mình; không chọn người mà chính mình đã giới thiệu. Mã không hợp lệ thì báo lỗi, không đăng ký. Đường dẫn giới thiệu: `<địa chỉ ứng dụng>/r/<số điện thoại dạng 0…>`; mở đường dẫn thì vào màn hình đăng ký, mã được điền sẵn, sửa được. Mã giới thiệu không bắt buộc. Khách chưa từng có người giới thiệu được tự nhập mã một lần trên màn hình tài khoản (quản trị đã bỏ người giới thiệu thì khách không tự đặt lại).
- QUYTAC_NGHIEPVU_143: Đổi người giới thiệu: chỉ người có quyền `marketplace.buyer.manage`; được đặt người khác hoặc để trống; bắt buộc lý do 1 đến 500 ký tự; kiểm tra như QUYTAC_NGHIEPVU_142; ghi lịch sử (người cũ, người mới, người đổi, thời điểm, lý do; cả lần gắn khi đăng ký và lần khách tự nhập). Đơn đặt trước lúc đổi vẫn tính cho người giới thiệu lúc đặt đơn (áp dụng ở CONG_VIEC_26).
- QUYTAC_NGHIEPVU_144: Đánh dấu nhân viên kinh doanh: người có quyền `marketplace.buyer.manage` chọn tài khoản người mua đang hoạt động, chọn phòng ban thuộc công ty vận hành sàn; hệ thống thêm tài khoản vào công ty với vai trò Nhân viên bán hàng và phòng ban đã chọn (phòng ban là căn cứ hoa hồng nhiều cấp theo cơ cấu tổ chức). Bỏ đánh dấu chỉ gỡ phần do thao tác đánh dấu tạo: lần gán vai trò Nhân viên bán hàng đã tạo; thành viên do đánh dấu tạo thì bỏ phòng ban, ngừng khi không còn vai trò; thành viên có sẵn thì trả lại phòng ban cũ. Giữ tài khoản người mua. Ghi lịch sử đánh dấu.
- QUYTAC_NGHIEPVU_145: Nhân viên kinh doanh phụ trách khách là người giới thiệu hiện tại của khách khi người đó đang được đánh dấu nhân viên kinh doanh; ngược lại khách không có nhân viên kinh doanh phụ trách (quyết định 2026-11-10). Bỏ đánh dấu thì các khách của người đó không còn nhân viên phụ trách.
- QUYTAC_NGHIEPVU_146: Người giới thiệu xem người mình đã giới thiệu: họ tên, số điện thoại che (giữ 4 số đầu và 3 số cuối, ví dụ 0912***678), ngày đăng ký. Nhân viên kinh doanh xem khách mình phụ trách trong phần Kinh doanh: họ tên, số điện thoại đầy đủ, ngày đăng ký.
- QUYTAC_NGHIEPVU_147: Công ty vận hành sàn là một công ty trong tập đoàn (cột trên công ty, tối đa một công ty); chỉ người có `marketplace.buyer.manage` ở phạm vi tập đoàn chọn, trên màn hình MAN_HINH_79; không đổi được khi còn nhân viên kinh doanh được đánh dấu ở công ty khác; chưa chọn thì chưa quản trị được người mua. Tài khoản người mua không thuộc công ty nào trừ khi được đánh dấu nhân viên kinh doanh; không vào được các mini app quản trị. Phiên ứng dụng như QUYTAC_NGHIEPVU_136 (token truy cập 15 phút, token làm mới 90 ngày, xoay vòng). Phiên chưa nhập mã xác thực hai lớp không làm mới được. Quên mật khẩu: OTP rồi đặt mật khẩu mới, chỉ cho tài khoản không có thư điện tử; thu hồi mọi phiên cũ.

## 5. Vai trò và quyền

| Quyền | Vai trò hệ thống có sẵn |
|---|---|
| `marketplace.buyer.view` Xem tài khoản người mua | Quản trị công ty, Quản trị tập đoàn |
| `marketplace.buyer.manage` Đổi người giới thiệu, đánh dấu nhân viên kinh doanh | Quản trị công ty, Quản trị tập đoàn |

Quyền xét tại công ty vận hành sàn. Người mua không cần quyền để dùng các API dành cho người mua.

## 6. Luồng nghiệp vụ

Luồng 35: người giới thiệu chia sẻ đường dẫn → khách mở đường dẫn → đăng ký (số điện thoại, OTP, họ tên, mật khẩu; mã giới thiệu điền sẵn) → vào ứng dụng. Quản trị đánh dấu một tài khoản là nhân viên kinh doanh, chọn phòng ban → người đó thấy phần Kinh doanh, các khách mình giới thiệu là khách mình phụ trách.

## 7. Màn hình

Ứng dụng VComm (khổ điện thoại; bản xem trước web):
- MAN_HINH_73 Đăng nhập (số điện thoại và mật khẩu, hoặc OTP).
- MAN_HINH_74 Đăng ký (số điện thoại, mã giới thiệu; OTP; họ tên, mật khẩu).
- MAN_HINH_75 Quên mật khẩu.
- MAN_HINH_76 Tài khoản (thông tin; mã và đường dẫn giới thiệu, chia sẻ, sao chép; nhập mã người giới thiệu khi chưa có; đăng xuất).
- MAN_HINH_77 Người tôi giới thiệu.
- MAN_HINH_78 Kinh doanh: khách tôi phụ trách (chỉ nhân viên kinh doanh).
- Thanh điều hướng dưới: Trang chủ (chờ CONG_VIEC_24), Kinh doanh (chỉ nhân viên kinh doanh), Tài khoản.

Web-crm:
- MAN_HINH_79 Tài khoản người mua (tìm theo tên, số điện thoại; lọc nhân viên kinh doanh; cột người giới thiệu, ngày đăng ký).
- MAN_HINH_80 Chi tiết tài khoản người mua (người giới thiệu, đổi người giới thiệu, lịch sử; người được giới thiệu; đánh dấu nhân viên kinh doanh).

## 8. Dữ liệu và API

- Database migration 0023: schema `marketplace`; `marketplace.buyer_accounts` (tài khoản, người giới thiệu, thời điểm đăng ký, là nhân viên kinh doanh); `marketplace.referrer_history`; `marketplace.sales_flag_history`; `core.otp_codes` thêm mục đích (`login`, `register`, `password_reset`); cột `core.companies.is_marketplace_operator`; phiên `vcomm_app`; quyền mới.
- API_116 đăng ký: `POST /buyer/register/otp`, `POST /buyer/register` (trả token).
- API_117 đăng nhập người mua: `POST /buyer/login` (mật khẩu), `POST /buyer/login/otp`, `POST /buyer/login/otp/verify`, `POST /buyer/password-reset/otp`, `POST /buyer/password-reset`; làm mới, đăng xuất dùng API_112.
- API_118 người mua: `GET /buyer/me`, `GET /buyer/referrals`, `POST /buyer/referrer`, `GET /buyer/sales/customers` (nhân viên kinh doanh).
- API_119 quản trị: `GET /marketplace/settings`, `PUT /marketplace/operator-company`, `GET /marketplace/buyers`, `GET /marketplace/buyers/:id`, `POST /marketplace/buyers/:id/referrer`, `POST /marketplace/buyers/:id/sales-flag`, `DELETE /marketplace/buyers/:id/sales-flag`.

## 9. Điều kiện đặc biệt

- Số điện thoại là dữ liệu cá nhân và đồng thời là mã giới thiệu công khai theo quyết định của người dùng; màn hình đăng ký nói rõ số điện thoại của mình là mã giới thiệu.
- API đăng ký, đăng nhập công khai giới hạn số lần gọi như đăng nhập web; dùng chung bộ đếm cho các đường dẫn đăng nhập.
- Hoa hồng đội kinh doanh tính theo cơ cấu tổ chức, không theo cây giới thiệu (tránh hoạt động bán hàng đa cấp theo Nghị định 40/2018/NĐ-CP).

## 10. Tiêu chí nghiệm thu

| Mã | Tiêu chí | Mức | Kịch bản |
|---|---|---|---|
| TIEUCHI_NGHIEMTHU_163 | Đăng ký bằng số điện thoại và OTP: đúng giới hạn OTP, số đã có tài khoản bị từ chối, mã giới thiệu đúng quy tắc, đăng ký xong có phiên | Bắt buộc | KICHBAN_KIEMTHU_295, 296 |
| TIEUCHI_NGHIEMTHU_164 | Đăng nhập bằng mật khẩu, bằng OTP; quên mật khẩu thu hồi phiên cũ; làm mới token thất bại thì ứng dụng về màn hình đăng nhập | Bắt buộc | KICHBAN_KIEMTHU_297 |
| TIEUCHI_NGHIEMTHU_165 | Người tôi giới thiệu che số điện thoại; nhập mã sau đăng ký chỉ một lần; quản trị đổi người giới thiệu có lý do, có lịch sử | Bắt buộc | KICHBAN_KIEMTHU_298 |
| TIEUCHI_NGHIEMTHU_166 | Đánh dấu, bỏ đánh dấu nhân viên kinh doanh cấp, gỡ đúng vai trò và phòng ban; khách tôi phụ trách đúng QUYTAC_NGHIEPVU_145; người mua không vào được mini app quản trị | Bắt buộc | KICHBAN_KIEMTHU_299 |
| TIEUCHI_NGHIEMTHU_167 | Ứng dụng: đường dẫn giới thiệu, đăng ký, đăng nhập, tài khoản, chia sẻ, phần Kinh doanh chạy được trên bản xem trước web khổ điện thoại | Bắt buộc | KICHBAN_KIEMTHU_300 |
| TIEUCHI_NGHIEMTHU_168 | MAN_HINH_79, 80 hiển thị đúng trên máy tính và điện thoại | Mong muốn | KICHBAN_KIEMTHU_301 |

## 11. Kịch bản kiểm thử

- KICHBAN_KIEMTHU_295 đến 299: tự động, `apps/api/test/c23-buyer-accounts.test.ts`.
- KICHBAN_KIEMTHU_300, 301: thủ công trên trình duyệt.

## 12. Ràng buộc kỹ thuật

Không thêm thư viện mới. Dùng lại `PhoneOtpService`, `MessagingService` (eSMS), phiên ứng dụng của CONG_VIEC_22, chính sách mật khẩu hiện có. Đổi tên thư mục ứng dụng giữ nguyên lịch sử Git.

## 13. Thành phần không được thay đổi

Đăng nhập web bằng cookie; đăng nhập OTP của nhân viên trên web; tài khoản nhân viên tạo bằng lời mời.

## 14. Các lát và điểm xem trước

- L0: database migration, API đăng ký, đăng nhập, quên mật khẩu; sửa lỗi làm mới token. Điểm xem trước: gọi thử API.
- L1: ứng dụng VComm: đổi tên, đăng ký, đăng nhập, quên mật khẩu, đường dẫn giới thiệu. Điểm xem trước: bản web khổ điện thoại.
- L2: tài khoản, mã giới thiệu, chia sẻ, người tôi giới thiệu, nhập mã sau.
- L3: quản trị web-crm (MAN_HINH_79, 80), đánh dấu nhân viên kinh doanh, phần Kinh doanh trên ứng dụng.

## 15. Kết quả đối chiếu định nghĩa hoàn thành

| Mục | Kết quả |
|---|---|
| Đúng yêu cầu, nghiệp vụ, phân quyền, dữ liệu | Đạt: QUYTAC_NGHIEPVU_141 đến 147 có kiểm thử tự động (KICHBAN_KIEMTHU_295 đến 299) |
| Đúng giao diện | Đạt: xem trước ứng dụng khổ iPhone 13, web-crm máy tính và điện thoại không cuộn ngang, không lỗi trình duyệt (KICHBAN_KIEMTHU_300, 301); không làm bản mẫu riêng theo quyết định của người dùng |
| Đã xử lý lỗi | Đạt: lỗi theo ô, lỗi chung, mất mạng, máy chủ bận, phiên bị từ chối trên ứng dụng; lỗi phiên bản, quyền trên web-crm |
| Đã kiểm thử, có kết quả trong tài liệu `25`, đạt cổng kiểm thử | Đạt: c23-buyer-accounts 9/9, toàn bộ 305/305; không còn lỗi Nghiêm trọng, Cao |
| Không phá vỡ chức năng cũ | Đạt: toàn bộ kiểm thử cũ đạt, không sửa kiểm thử đã duyệt (chỉ thêm schema `marketplace` vào danh sách dọn của bộ dựng cơ sở dữ liệu kiểm thử). Ứng dụng kinh doanh của CONG_VIEC_22 (chưa nghiệm thu) được thay theo THAY_DOI_14 |
| Đạt tiêu chí nghiệm thu bắt buộc | Đạt: TIEUCHI_NGHIEMTHU_163 đến 167; mong muốn TIEUCHI_NGHIEMTHU_168 đạt |
| Đạt cổng bảo mật | Đạt có điều kiện: lỗi Cao, Trung bình của rà soát đã sửa; 2 lỗ hổng Trung bình trong `@expo/cli` (công cụ phát triển) chờ quyết định; gitleaks trong CI chưa chạy do tài khoản GitHub lỗi thanh toán |
| Đã tự rà soát mã, dọn dẹp | Đạt: rà soát độc lập, sửa ở commit 70b9c29; tệp tạm trong `tam_thoi/CONG_VIEC_23/` (Git bỏ qua) |
| Đã cập nhật tài liệu `27` và tài liệu liên quan | Đạt: 06 đến 11, 12, 14, 16, 17, 21, 22, 27, mục lục |

## 16. Giới hạn đã biết

- Vai trò hệ thống Nhân viên bán hàng có quyền ghi đơn bán, đối tác ở công ty vận hành sàn; người mua được đánh dấu nhận đủ các quyền đó. Cần người dùng quyết định (đề xuất vai trò riêng hẹp hơn trong công việc sửa CONG_VIEC_21, CONG_VIEC_17).
- Đăng ký kiểm mã giới thiệu trước mã OTP nên phân biệt được số có tài khoản đang hoạt động (Thấp).
- Tin SMS đăng ký, đặt lại mật khẩu dùng chung mẫu tin mã đăng nhập của eSMS.
- Đường dẫn giới thiệu mở bản web của ứng dụng; mở thẳng ứng dụng đã cài (deep link), đóng gói lên kho ứng dụng làm sau.
- Mục menu "Người mua VComm" theo quyền ở công ty đang chọn.
