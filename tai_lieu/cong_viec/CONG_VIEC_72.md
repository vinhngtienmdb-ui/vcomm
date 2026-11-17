# CONG_VIEC_72: Ưu tiên Smart OTP thay tin nhắn SMS (MODULE_01, MODULE_09, MODULE_11, MODULE_12)

- Mô tả: Smart OTP (mã TOTP 6 số tạo trong ứng dụng VComm) thành cách xác thực chính của người mua cho giao dịch dùng điểm, đăng nhập trên thiết bị mới, quên mật khẩu; cổng cửa hàng liên kết đăng nhập bằng mật khẩu và ứng dụng xác thực (TOTP) thay mã SMS. Khách chưa kích hoạt dùng SMS dự phòng trong thời hạn chuyển đổi, sau đó bắt buộc.
- Phiên bản: 0.1
- Ngày cập nhật: 2026-11-17
- Trạng thái: Người dùng duyệt đặc tả, bản mẫu, 12 điểm AI đề xuất (mục 17) và thư viện `expo-local-authentication` 58.0.2 ngày 2026-11-17. Đang làm lát L1.
- Nhánh: `chuc-nang/CONG_VIEC_72-uu-tien-smart-otp`.
- Nguồn: yêu cầu người dùng 2026-11-17; quyết định người dùng 2026-11-17 (mục 17); CONG_VIEC_53 lát L6 (Smart OTP), CONG_VIEC_55 (cổng cửa hàng), CONG_VIEC_65 (đổi điểm đối tác liên minh), CONG_VIEC_67 (Open API cửa hàng liên kết, THAY_DOI_31), CONG_VIEC_02, 03, 23 (đăng nhập, xác thực hai lớp, tài khoản người mua), CONG_VIEC_60 (mã cài đặt ứng dụng).
- Mức: Lớn (đổi cách xác thực, sửa cấu trúc dữ liệu và API đã duyệt, thêm thư viện, nhiều module).
- Thay đổi: THAY_DOI_37.
- Mã do phiên điều phối cấp ngày 2026-11-17 (sổ ghi qua PR #178): YCAU_NGHIEPVU_202 đến 204, QUYTAC_NGHIEPVU_560 đến 572, CHUC_NANG_242 đến 246, TIEUCHI_NGHIEMTHU_536 đến 545, KICHBAN_KIEMTHU_734 đến 749, MAN_HINH_269 đến 274, API_318 đến 325, database migration 0158 đến 0160, Luồng 66.

## 1. Mục tiêu

- Giảm tin nhắn SMS (chi phí của công ty và phí tin OTP của cửa hàng liên kết theo THAY_DOI_31).
- Giảm rủi ro chiếm tài khoản bằng chiếm SIM: mã nằm trên máy của khách, có mã khóa hoặc vân tay, khuôn mặt.
- Có đường khôi phục rõ ràng khi mất máy mà không mở lại lỗ hổng SMS.

## 2. Phạm vi

Trong phạm vi:
- Người mua (ứng dụng VComm):
  - Mã khóa 6 số và vân tay, khuôn mặt để mở Smart OTP.
  - Kích hoạt Smart OTP ngay trong bước đăng ký bằng chính mã SMS đăng ký.
  - Chuyển Smart OTP sang máy mới bằng mã của máy cũ, không SMS.
  - Thiết bị tin cậy; đăng nhập trên thiết bị mới cần mật khẩu và mã Smart OTP.
  - Quên mật khẩu bằng Smart OTP.
  - Khôi phục khi mất máy: mật khẩu và SMS, sau đó khóa dùng điểm 24 giờ, kèm thông báo.
  - Không kích hoạt Smart OTP trên bản web của ứng dụng.
- Giao dịch dùng điểm theo thời hạn chuyển đổi:
  - Tại quầy: giữ nguyên, đã bắt buộc Smart OTP.
  - Cửa hàng liên kết qua Open API.
  - Đổi điểm ra đối tác liên minh.
  - Khóa dùng điểm sau khôi phục áp cho mọi cách dùng điểm, kể cả đặt hàng dùng điểm và cổng cửa hàng.
- Cổng cửa hàng liên kết:
  - Mọi tài khoản đăng nhập bằng số điện thoại, mật khẩu và mã ứng dụng xác thực, kèm 10 mã dự phòng; đăng nhập Zalo vẫn hỏi mã.
  - Quên mật khẩu bằng mã ứng dụng xác thực.
  - Đặt lại xác thực: chủ cửa hàng cho thu ngân, người quản lý cửa hàng liên kết của VComm cho chủ.
- Quản trị:
  - Tham số thời hạn chuyển đổi, số giờ khóa dùng điểm, thống kê kích hoạt và số tin SMS.
  - Chăm sóc khách hàng xem bảo mật đăng nhập của người mua và hủy Smart OTP (quyền riêng, ghi nhật ký).
- Nhắc kích hoạt: thẻ nhắc, thông báo trong ứng dụng, một tin ZNS 7 ngày trước hạn.

Ngoài phạm vi:
- Đăng nhập web của nhân viên (MAN_HINH_01, 02): giữ nguyên.
- Đăng nhập Zalo của người mua: giữ nguyên, không hỏi Smart OTP (quyết định người dùng).
- Thông báo ZNS khác: giữ nguyên.
- Đổi số điện thoại của tài khoản.
- Xác nhận bằng thông báo đẩy ("Bấm Đồng ý trên máy cũ").
- Cách 2 (mã thành viên) và cách 3 (xác nhận trên ứng dụng) của cửa hàng liên kết: không đổi, chỉ chịu khóa dùng điểm sau khôi phục.

## 3. Hiện trạng và phần đổi

| Luồng | Hiện nay | Sau CONG_VIEC_72 |
|---|---|---|
| Dùng điểm tại quầy (CONG_VIEC_53) | Bắt buộc Smart OTP | Giữ nguyên; thêm khóa dùng điểm sau khôi phục |
| Đổi điểm ra đối tác liên minh (CONG_VIEC_65) | Khách có Smart OTP thì hỏi mã; chưa kích hoạt thì không hỏi gì | Trong thời hạn giữ như cũ (không thêm SMS); hết hạn bắt buộc Smart OTP |
| Open API cửa hàng liên kết (CONG_VIEC_67) | Smart OTP, chưa kích hoạt thì SMS có phí | SMS chỉ cho khách chưa kích hoạt trong thời hạn; hết hạn API gửi mã trả lỗi `409` |
| Đăng nhập người mua bằng mật khẩu | Không xét thiết bị | Thiết bị mới cần mã Smart OTP |
| Đăng nhập người mua bằng mã SMS (không mật khẩu) | Mọi khách | Chỉ khách chưa kích hoạt, trong thời hạn |
| Quên mật khẩu người mua | Mã SMS | Mã Smart OTP; khách chưa kích hoạt trong thời hạn vẫn dùng SMS |
| Đăng ký | Mã SMS | Giữ SMS; kích hoạt Smart OTP luôn trong bước đăng ký |
| Kích hoạt Smart OTP | Mã SMS, kích hoạt được trên bản web | Lần đầu: mã SMS. Chuyển máy: mã của máy cũ. Mất máy: khôi phục. Không kích hoạt trên bản web |
| Đăng nhập cổng cửa hàng | Số điện thoại và mã SMS, Zalo | Số điện thoại, mật khẩu, mã ứng dụng xác thực; Zalo rồi mã ứng dụng xác thực |

## 4. Yêu cầu nghiệp vụ và chức năng

- YCAU_NGHIEPVU_202: Người mua xác thực bằng Smart OTP trên ứng dụng VComm cho giao dịch dùng điểm, đăng nhập trên thiết bị mới, quên mật khẩu; SMS chỉ còn cho đăng ký, kích hoạt lần đầu, khôi phục khi mất máy và dự phòng trong thời hạn chuyển đổi.
- YCAU_NGHIEPVU_203: Tài khoản cổng cửa hàng liên kết đăng nhập bằng mật khẩu và ứng dụng xác thực (TOTP) thay mã SMS.
- YCAU_NGHIEPVU_204: Khách mất máy khôi phục được Smart OTP mà kẻ chiếm SIM không dùng ngay được điểm; chăm sóc khách hàng hỗ trợ khi khách mất cả số điện thoại.
- CHUC_NANG_242: Smart OTP có mã khóa và sinh trắc học; kích hoạt trong bước đăng ký; chuyển máy bằng mã máy cũ.
- CHUC_NANG_243: Thiết bị tin cậy, đăng nhập trên thiết bị mới, quên mật khẩu bằng Smart OTP.
- CHUC_NANG_244: Khôi phục khi mất máy, khóa dùng điểm, chăm sóc khách hàng hủy Smart OTP.
- CHUC_NANG_245: Thời hạn chuyển đổi, nhắc kích hoạt, thống kê.
- CHUC_NANG_246: Cổng cửa hàng liên kết đăng nhập bằng ứng dụng xác thực.

## 5. Quy tắc nghiệp vụ

### QUYTAC_NGHIEPVU_560 – Cách xác thực theo luồng

| Luồng | Khách đã kích hoạt Smart OTP | Khách chưa kích hoạt, trong thời hạn | Khách chưa kích hoạt, hết thời hạn |
|---|---|---|---|
| Dùng điểm tại quầy | Smart OTP | Không dùng được điểm (như hiện nay) | Không dùng được điểm |
| Open API, cách mã OTP | Smart OTP | SMS (phí theo THAY_DOI_31) | Không dùng được điểm bằng cách này; vẫn tích điểm; dùng điểm qua mã thành viên hoặc xác nhận trên ứng dụng |
| Đổi điểm ra đối tác liên minh | Smart OTP | Không hỏi mã (như hiện nay) | Bắt buộc kích hoạt rồi mới đổi |
| Đặt hàng dùng điểm; cửa hàng liên kết cách 2, cách 3 | Không đổi | Không đổi | Không đổi |
| Đăng nhập trên thiết bị đã tin cậy | Không hỏi thêm | Không hỏi thêm | Không hỏi thêm |
| Đăng nhập mật khẩu trên thiết bị mới | Mật khẩu và Smart OTP | Mật khẩu và SMS | Mật khẩu, rồi kích hoạt Smart OTP trên máy này (mã SMS, như khôi phục) |
| Đăng nhập bằng mã SMS không mật khẩu | Không được (hướng dẫn dùng mật khẩu) | Được | Không được |
| Quên mật khẩu | Smart OTP | SMS | Chăm sóc khách hàng (mất cả hai yếu tố) hoặc kích hoạt Smart OTP trước nếu còn đăng nhập trên máy |
| Đăng nhập Zalo | Giữ nguyên | Giữ nguyên | Giữ nguyên |

- Khách đã kích hoạt Smart OTP không nhận mã SMS đăng nhập, quên mật khẩu, Open API ngay từ ngày bắt đầu chuyển đổi; SMS chỉ còn trong luồng khôi phục.
- Màn hình, API không cho biết số điện thoại có tài khoản hay đã kích hoạt Smart OTP hay chưa (giữ QUYTAC_NGHIEPVU_05): người dùng tự chọn "Nhập mã Smart OTP" hoặc "Gửi mã SMS"; máy chủ gửi SMS chỉ khi số có tài khoản, chưa kích hoạt, còn thời hạn, và luôn trả `204`.

### QUYTAC_NGHIEPVU_561 – Thời hạn chuyển đổi

- Tham số (MAN_HINH_86 thẻ "Xác thực"; xem: `marketplace.buyer.view`, sửa: `marketplace.buyer.manage`, đã có, nhạy cảm; ghi nhật ký thao tác):
  - Ngày bắt đầu chuyển đổi: mặc định ngày chạy database migration (ngày triển khai).
  - Số ngày chuyển đổi của người mua: 1 đến 180, mặc định 30.
  - Số ngày chuyển đổi của cổng cửa hàng liên kết: 1 đến 180, mặc định 30.
  - Số giờ khóa dùng điểm sau khôi phục: 0 đến 168, mặc định 24.
  - Số tổng đài chăm sóc khách hàng: tùy chọn, 8 đến 15 chữ số (quyết định người dùng 2026-11-17: nhập trên web quản trị). Để trống thì thông báo bỏ câu "Gọi tổng đài".
- Ngày cuối = ngày bắt đầu + số ngày − 1 (30 ngày tính cả ngày bắt đầu, ví dụ 18/11/2026 đến hết 17/12/2026), hết 23:59:59 giờ Việt Nam. Áp cho mọi khách như nhau (không theo ngày đăng ký).
- Sửa tham số áp ngay; không được đặt ngày bắt đầu sau hôm nay.

### QUYTAC_NGHIEPVU_562 – Kích hoạt Smart OTP

- Chỉ kích hoạt trên ứng dụng điện thoại (iOS, Android). Bản web của ứng dụng không kích hoạt được. Khách đã kích hoạt trên bản web giữ hiệu lực đến hết thời hạn chuyển đổi, được nhắc chuyển sang điện thoại; hết hạn hệ thống tự hủy, ghi nhật ký.
- Lần đầu (tài khoản chưa từng có Smart OTP): mã SMS mục đích `smart_otp` (như CONG_VIEC_53).
- Đăng ký mới trên ứng dụng điện thoại: sau khi nhập đúng mã SMS đăng ký, ứng dụng hỏi "Kích hoạt Smart OTP trên máy này" (mặc định chọn), đặt mã khóa, kích hoạt luôn. Không gửi thêm SMS. Khách bỏ qua thì dùng luồng lần đầu sau.
- Chuyển máy khi máy cũ còn dùng được: trên máy mới (đã đăng nhập), nhập mã Smart OTP đang hiện trên máy cũ; đúng thì máy mới nhận khóa mới, máy cũ mất hiệu lực. Không SMS, không khóa dùng điểm.
- Mỗi lần kích hoạt bằng mã SMS khi tài khoản đã từng có Smart OTP, hoặc trên thiết bị chưa tin cậy, tính là khôi phục (QUYTAC_NGHIEPVU_566).

### QUYTAC_NGHIEPVU_563 – Mã khóa và sinh trắc học

- Kích hoạt xong phải đặt mã khóa 6 số, nhập hai lần cho khớp. Không cho 6 số giống nhau, không cho dãy tăng, giảm liên tiếp (123456, 654321). Không cho trùng 6 số cuối của số điện thoại.
- Mã khóa chỉ lưu trên máy, băm có muối (PBKDF2-SHA256), trong bộ nhớ an toàn của máy. Không gửi lên máy chủ.
- Máy có và đã cài vân tay, khuôn mặt: ứng dụng hỏi "Dùng vân tay/khuôn mặt để mở Smart OTP"; bật thì mở bằng sinh trắc học, nút "Dùng mã khóa" luôn có. Thêm vân tay mới trên máy thì ứng dụng tắt sinh trắc học, hỏi mã khóa một lần rồi hỏi bật lại.
- Sai mã khóa 5 lần liên tiếp: xóa khóa Smart OTP trên máy, báo máy chủ hủy Smart OTP của tài khoản, ghi nhật ký. Khách kích hoạt lại theo khôi phục.
- Mỗi lần mở Smart OTP có hiệu lực 60 giây; trên máy giữ Smart OTP, ứng dụng tự điền mã vào giao dịch, không phải gõ.
- Khách đã kích hoạt trước khi cập nhật: lần mở Smart OTP đầu tiên sau cập nhật phải đặt mã khóa, không phải kích hoạt lại.
- Đổi mã khóa: nhập mã cũ (hoặc sinh trắc học) rồi đặt mã mới.

### QUYTAC_NGHIEPVU_564 – Thiết bị tin cậy

- Thiết bị = mã cài đặt ứng dụng (tiêu đề `X-Device-Id`, CONG_VIEC_60); máy chủ chỉ lưu băm HMAC-SHA256.
- Bản web của ứng dụng: mỗi trình duyệt là một thiết bị.
- Khi triển khai, coi là tin cậy:
  - Thiết bị đang có phiên đăng nhập còn hiệu lực.
  - Thiết bị đã ghi nhận cho tài khoản trong `loyalty.device_links` 12 tháng gần nhất.
- Thiết bị thành tin cậy khi:
  - Đăng nhập xác nhận xong (QUYTAC_NGHIEPVU_565).
  - Đăng ký xong.
  - Kích hoạt hoặc khôi phục Smart OTP trên máy đó.
  - Đăng nhập Zalo thành công: giữ nguyên Zalo, coi như đã xác nhận.
- Hết tin cậy khi:
  - 12 tháng không dùng.
  - Khách gỡ trong "Thiết bị đã đăng nhập"; mọi phiên của thiết bị đó cũng bị thu hồi.
  - Đặt lại mật khẩu: mọi thiết bị trừ thiết bị đang làm.
  - Chăm sóc khách hàng hủy Smart OTP: mọi thiết bị.
- Danh sách "Thiết bị đã đăng nhập": tên máy, nền tảng, lần đầu, lần cuối, "Máy này", "Đang giữ Smart OTP".

### QUYTAC_NGHIEPVU_565 – Đăng nhập trên thiết bị mới

- Mật khẩu đúng trên thiết bị chưa tin cậy: cấp phiên chờ xác nhận, chỉ gọi được API xác nhận, hiệu lực 10 phút. Dùng cách phiên chưa qua bước hai của xác thực hai lớp nhân viên.
- Xác nhận:
  - Khách đã kích hoạt: mã Smart OTP lấy từ máy giữ Smart OTP. Kiểm như CONG_VIEC_53: bước 30 giây, lệch một bước, mỗi bước dùng một lần; dùng chung bộ đếm sai, sai 5 lần khóa 15 phút.
  - Khách chưa kích hoạt, trong thời hạn: mã SMS mục đích `login`.
  - Khách chưa kích hoạt, hết thời hạn: kích hoạt Smart OTP trên máy này bằng mã SMS. Tính là khôi phục: khóa dùng điểm, thông báo.
- Xác nhận đúng:
  - Thiết bị thành tin cậy.
  - Gửi thông báo trong ứng dụng tới tài khoản: "Tài khoản vừa đăng nhập trên <tên máy> lúc <giờ>. Không phải bạn? Đổi mật khẩu và gỡ thiết bị."
- Liên kết "Không còn máy giữ Smart OTP" dẫn sang khôi phục.
- Phiên của tài khoản nhân viên có thư điện tử đăng nhập trên ứng dụng giữ xác thực hai lớp như cũ. Không hỏi thêm Smart OTP khi đã qua xác thực hai lớp.

### QUYTAC_NGHIEPVU_566 – Khôi phục khi mất máy

- Còn số điện thoại và nhớ mật khẩu, trên máy mới:
  1. Nhập số điện thoại, mật khẩu, rồi mã SMS mục đích `smart_otp`.
  2. Kích hoạt Smart OTP trên máy mới, đặt mã khóa. Máy cũ mất hiệu lực; máy mới thành tin cậy.
  3. Khóa mọi giao dịch dùng điểm của tài khoản trong số giờ tham số, mặc định 24, tính từ lúc khôi phục.
  4. Thông báo trong ứng dụng, và tin ZNS khi mẫu đã cài: "Smart OTP của bạn vừa chuyển sang <tên máy>. Dùng điểm tạm khóa đến <giờ>. Không phải bạn? Gọi <tổng đài>."
- Trong lúc khóa:
  - Tích điểm bình thường.
  - Mọi cách dùng điểm báo "Dùng điểm tạm khóa đến <giờ> do vừa khôi phục Smart OTP": quầy, Open API, đổi ra đối tác, đặt hàng dùng điểm, cửa hàng liên kết cách 2, 3.
  - Không ai mở sớm được, kể cả chăm sóc khách hàng (giữ đơn giản, chống lừa đảo qua điện thoại).
- Quên cả mật khẩu và mất máy, hoặc mất số điện thoại: không tự khôi phục; khách liên hệ chăm sóc khách hàng (QUYTAC_NGHIEPVU_567).
- Giới hạn gửi mã SMS giữ như cũ: 5 mã mỗi giờ mỗi số, tính chung mọi mục đích.

### QUYTAC_NGHIEPVU_567 – Chăm sóc khách hàng hủy Smart OTP

- Quyền mới `marketplace.buyer.security` (nhạy cảm), gán mặc định Quản trị tập đoàn, Quản trị công ty tại công ty vận hành sàn.
- MAN_HINH_80 khối "Bảo mật đăng nhập":
  - Người có `marketplace.buyer.view` xem: trạng thái Smart OTP, máy, ngày kích hoạt, khóa dùng điểm đến, số thiết bị tin cậy, thời hạn chuyển đổi.
  - Người có quyền mới bấm "Hủy Smart OTP", nhập lý do (bắt buộc, 10 đến 500 ký tự).
- Hủy:
  - Xóa Smart OTP của tài khoản.
  - Thu hồi mọi phiên và mọi thiết bị tin cậy.
  - Ghi nhật ký thao tác kèm lý do.
  - Thông báo trong ứng dụng và ZNS cho khách.
- Sau khi hủy:
  - Khách đăng nhập lại bằng mật khẩu và mã SMS: thiết bị mới, hết lựa chọn Smart OTP.
  - Khách quên mật khẩu: nhân viên hướng dẫn đặt lại bằng SMS. Ngoại lệ có kiểm soát: tài khoản vừa bị chăm sóc khách hàng hủy Smart OTP trong 24 giờ được đặt lại mật khẩu bằng SMS một lần.
  - Kích hoạt lại tính là khôi phục: khóa dùng điểm.

### QUYTAC_NGHIEPVU_568 – Quên mật khẩu người mua

- Màn hình hỏi số điện thoại, mã xác thực và mật khẩu mới:
  - "Mã Smart OTP": đọc từ máy giữ Smart OTP; trên chính máy đó, ứng dụng tự điền sau khi mở khóa.
  - "Gửi mã SMS": chỉ có tác dụng với khách chưa kích hoạt trong thời hạn, hoặc trường hợp ngoại lệ ở QUYTAC_NGHIEPVU_567.
- Kiểm mã Smart OTP như QUYTAC_NGHIEPVU_565, dùng chung bộ đếm sai và khóa.
- Đúng thì làm như hiện nay (QUYTAC_NGHIEPVU_147): đặt mật khẩu, bỏ khóa đăng nhập, thu hồi mọi phiên. Thêm: hết tin cậy mọi thiết bị trừ thiết bị đang làm.
- Tài khoản có thư điện tử (nhân viên): giữ đặt lại qua thư điện tử như cũ.

### QUYTAC_NGHIEPVU_569 – Giao dịch dùng điểm

- Open API (sửa CONG_VIEC_67):
  - Tra điểm trả thêm `otpMethod`: `smart_otp`, `sms` hoặc `unavailable`, và `redeemLockedUntil`.
  - API_297 gửi mã:
    - Khách đã kích hoạt: `409 affiliateSmartOtpActive`, như cũ.
    - Khách chưa kích hoạt, hết thời hạn: `409 affiliateSmartOtpRequired`.
  - Tạo giao dịch dùng điểm khi đang khóa: `409 loyaltyRedeemLocked` kèm thời điểm hết khóa.
  - Phí tin OTP (THAY_DOI_31) giữ cách tính; chỉ còn phát sinh trong thời hạn.
- Đổi ra đối tác liên minh (sửa QUYTAC_NGHIEPVU_542): hết thời hạn mà khách chưa kích hoạt thì báo "Kích hoạt Smart OTP để đổi điểm", nút "Kích hoạt".
- Mọi cách dùng điểm xét khóa dùng điểm (QUYTAC_NGHIEPVU_566) trước giới hạn và chống gian lận.
- Mã Smart OTP sai trong giao dịch dùng chung bộ đếm với đăng nhập, quên mật khẩu: 5 lần khóa 15 phút như CONG_VIEC_53.

### QUYTAC_NGHIEPVU_570 – Cổng cửa hàng liên kết

- Mọi tài khoản cổng (chủ, thu ngân) đăng nhập bằng:
  - Số điện thoại, mật khẩu, rồi mã 6 số của ứng dụng xác thực (Google Authenticator, Microsoft Authenticator hoặc ứng dụng TOTP bất kỳ), hoặc một mã dự phòng.
  - Hoặc Zalo, rồi mã ứng dụng xác thực.
- Ứng dụng xác thực dùng lại xác thực hai lớp của nhân viên: TOTP 30 giây, 10 mã dự phòng dùng một lần, sai 5 lần (QUYTAC_NGHIEPVU_09, CHUC_NANG_09).
- Yêu cầu xác thực hai lớp chỉ áp khi đăng nhập vào cổng cửa hàng. Người là thành viên cổng đồng thời là người mua: đăng nhập ứng dụng VComm vẫn theo QUYTAC_NGHIEPVU_565, không hỏi mã ứng dụng xác thực.
- Kích hoạt lời mời (sửa QUYTAC_NGHIEPVU_393): mã SMS một lần → đặt mật khẩu (nếu chưa có) → quét mã QR đăng ký ứng dụng xác thực → lưu 10 mã dự phòng → vào cổng.
- Tài khoản cổng có sẵn khi triển khai:
  - Trong thời hạn: vẫn đăng nhập bằng mã SMS. Mỗi lần vào được dẫn tới "Thiết lập bảo mật" (đặt mật khẩu, đăng ký ứng dụng xác thực), có nút "Để sau" kèm số ngày còn lại.
  - Hết hạn: cổng bỏ đăng nhập bằng mã SMS. Tài khoản chưa thiết lập nhờ người mời đặt lại xác thực.
- Đặt lại xác thực:
  - Chủ cửa hàng đặt cho thu ngân (MAN_HINH_177); người có `affiliate.manage` đặt cho chủ và thu ngân (MAN_HINH_178).
  - Hệ thống xóa ứng dụng xác thực, mã dự phòng và thu hồi phiên cổng.
  - Lần vào tới: số điện thoại, mã SMS một lần (như kích hoạt lời mời), đặt mật khẩu mới, đăng ký ứng dụng xác thực mới.
  - Ghi nhật ký thao tác.
- Quên mật khẩu cổng: số điện thoại, mã ứng dụng xác thực hoặc mã dự phòng, mật khẩu mới; thu hồi mọi phiên cổng. Mất cả mật khẩu và ứng dụng xác thực: đặt lại xác thực.

### QUYTAC_NGHIEPVU_571 – Nhắc kích hoạt và thông báo

- Ứng dụng VComm, khách chưa kích hoạt (hoặc đang dùng Smart OTP trên bản web), trong thời hạn:
  - Thẻ nhắc trên trang chủ và trang Điểm thưởng: "Kích hoạt Smart OTP trước <ngày> để tiếp tục dùng điểm và đăng nhập trên máy mới", nút "Kích hoạt", đóng được trong ngày.
  - Thông báo trong ứng dụng vào ngày bắt đầu, 14, 7, 1 ngày trước hạn.
  - Một tin ZNS 7 ngày trước hạn, khi mẫu ZNS "Nhắc kích hoạt Smart OTP" đã cài. Chưa cài thì bỏ qua, không gửi SMS thay. Mỗi khách nhận tối đa một tin.
- Cổng cửa hàng: dải nhắc trên đầu cổng với tài khoản chưa thiết lập: "Thiết lập bảo mật trước <ngày>".
- Mẫu ZNS mới người dùng đăng ký với eSMS rồi nhập mã mẫu ở Cài đặt tích hợp (tài liệu `28` mục 2.4; quyết định người dùng 2026-11-17: cấu hình sau trên web quản trị):
  - "Nhắc kích hoạt Smart OTP" (khóa `esms.template.smart_otp_reminder`).
  - "Smart OTP chuyển máy" (khóa `esms.template.smart_otp_transferred`).
  - "Smart OTP bị hủy" (khóa `esms.template.smart_otp_revoked`).
  - Mẫu nào để trống thì chỉ gửi thông báo trong ứng dụng, không gửi SMS thay.
- Việc nền chạy hằng ngày lúc 9 giờ, giờ Việt Nam; không gửi trùng.

### QUYTAC_NGHIEPVU_572 – Thống kê và nhật ký

- MAN_HINH_86 thẻ "Xác thực":
  - Số người mua đã kích hoạt trên tổng số người mua đang hoạt động; số kích hoạt trên bản web còn lại.
  - Số tài khoản cổng đã thiết lập trên tổng số.
  - Số tin SMS OTP 30 ngày gần nhất theo mục đích: đăng nhập, đăng ký, quên mật khẩu, kích hoạt, cửa hàng liên kết.
- Nhật ký thao tác (không ghi mã, khóa, mã khóa):
  - `smart_otp.activate`, `smart_otp.transfer`, `smart_otp.recover`, `smart_otp.revoke` (khách, chăm sóc khách hàng, sai mã khóa), `smart_otp.web_expired`.
  - `device.trust`, `device.remove`.
  - `merchant_portal.authentication_reset`.
  - `authentication_settings.update`.

## 6. Vai trò và quyền

| Thao tác | Quyền |
|---|---|
| Xem tham số chuyển đổi, thống kê; sửa tham số | Xem: `marketplace.buyer.view`; sửa: `marketplace.buyer.manage` (đã có, nhạy cảm) tại công ty vận hành sàn. Thẻ "Xác thực" của MAN_HINH_86 hiện khi có `marketplace.buyer.view`, các thẻ khác giữ quyền `marketplace.order.*` |
| Xem khối "Bảo mật đăng nhập" của người mua | `marketplace.buyer.view` (đã có) |
| Hủy Smart OTP của người mua | `marketplace.buyer.security` (mới, nhạy cảm) |
| Đặt lại xác thực cổng cho thu ngân | Chủ cửa hàng (vai trò cổng) |
| Đặt lại xác thực cổng cho chủ, thu ngân | `affiliate.manage` (đã có) |

## 7. Luồng nghiệp vụ (Luồng 66)

1. Ngày triển khai: database migration ghi ngày bắt đầu; nạp thiết bị tin cậy; nhắc kích hoạt bắt đầu.
2. Khách mới: đăng ký → mã SMS → kích hoạt Smart OTP và đặt mã khóa luôn.
3. Khách cũ chưa kích hoạt: thấy nhắc → Kích hoạt → mã SMS → đặt mã khóa (vân tay, khuôn mặt).
4. Đăng nhập máy mới: mật khẩu → mã Smart OTP từ máy cũ → tin cậy. Muốn dời Smart OTP sang máy mới: "Chuyển Smart OTP sang máy này" → mã máy cũ.
5. Mất máy: máy mới → "Không còn máy giữ Smart OTP" → mật khẩu → mã SMS → kích hoạt → khóa dùng điểm 24 giờ, thông báo.
6. Hết thời hạn: SMS dự phòng tắt; khách chưa kích hoạt phải kích hoạt khi cần dùng điểm, đăng nhập máy mới.
7. Cổng cửa hàng: kích hoạt lời mời hoặc thiết lập trong thời hạn → mật khẩu, ứng dụng xác thực → hết hạn bỏ SMS.

## 8. Màn hình

Bản mẫu: `tai_lieu/ban_mau/CONG_VIEC_72_SMART_OTP_UNG_DUNG.html` (ứng dụng VComm), `tai_lieu/ban_mau/CONG_VIEC_72_SMART_OTP_QUAN_TRI_CONG.html` (web quản trị, cổng cửa hàng).

| Mã | Tên | Nơi | Ghi chú |
|---|---|---|---|
| MAN_HINH_269 | Mở khóa Smart OTP (đặt mã khóa, nhập mã khóa, sinh trắc học) | Ứng dụng VComm | Hiện khi xem mã, khi giao dịch cần mã trên máy giữ Smart OTP |
| MAN_HINH_270 | Xác nhận đăng nhập trên thiết bị mới | Ứng dụng VComm | Sau MAN_HINH_73 |
| MAN_HINH_271 | Khôi phục Smart OTP khi mất máy | Ứng dụng VComm | Từ MAN_HINH_270, MAN_HINH_151 |
| MAN_HINH_272 | Thiết bị đã đăng nhập | Ứng dụng VComm | Từ MAN_HINH_76 Tài khoản |
| MAN_HINH_273 | Thiết lập bảo mật và nhập mã ứng dụng xác thực | Cổng cửa hàng | Sau đăng nhập, kích hoạt lời mời |
| MAN_HINH_274 | Quên mật khẩu cổng cửa hàng | Cổng cửa hàng | Từ trang đăng nhập cổng |

Sửa màn hình đã có:
- MAN_HINH_151, thẻ Smart OTP:
  - Mã khóa, sinh trắc học.
  - "Chuyển Smart OTP sang máy này" (nhập mã máy cũ), "Không còn máy cũ".
  - Đổi mã khóa.
  - Dải khóa dùng điểm, hạn chuyển đổi.
  - Bản web: chỉ xem trạng thái và hướng dẫn cài ứng dụng.
- MAN_HINH_73 Đăng nhập: thêm bước xác nhận thiết bị mới; đăng nhập bằng mã SMS ẩn sau thời hạn.
- MAN_HINH_74 Đăng ký: bước kích hoạt Smart OTP sau mã SMS.
- MAN_HINH_75 Quên mật khẩu: ô "Mã Smart OTP" là cách chính, "Gửi mã SMS" là liên kết phụ trong thời hạn.
- Trang chủ, MAN_HINH_151: thẻ nhắc kích hoạt.
- MAN_HINH_265 Đổi điểm đối tác: hết hạn bắt buộc kích hoạt; mã tự điền sau mở khóa.
- MAN_HINH_80 (web-crm): khối "Bảo mật đăng nhập".
- MAN_HINH_86 (web-crm): thẻ "Xác thực" (tham số, thống kê).
- Trang đăng nhập cổng: số điện thoại, mật khẩu; Zalo; trong thời hạn còn liên kết "Đăng nhập bằng mã SMS"; liên kết "Quên mật khẩu".
- MAN_HINH_177: nút "Đặt lại xác thực" cho thu ngân, cột "Bảo mật" (Đã thiết lập, Chưa thiết lập).
- MAN_HINH_178: như MAN_HINH_177, cho mọi thành viên.
- Cổng: dải nhắc thiết lập bảo mật.

## 9. Dữ liệu

- Database migration 0158 `core_smart_otp`:
  - Chuyển `loyalty.smart_otp_devices` sang `core.smart_otp_devices`, giữ nguyên dữ liệu.
  - Thêm `platform` (`ios`, `android`, `web`; dữ liệu cũ suy theo tên máy), `device_hash`.
  - Bảng `core.account_security` (một dòng mỗi tài khoản, sống qua các lần hủy, kích hoạt lại Smart OTP): `smart_otp_first_activated_at`, `smart_otp_recovered_at`, `redeem_locked_until`, `sms_password_reset_until`. Nạp lần kích hoạt đầu từ Smart OTP đang có. (Điều chỉnh khi lập trình L1: khóa dùng điểm đặt ở bảng tài khoản thay vì bảng Smart OTP để khách tự hủy Smart OTP không xóa được khóa.)
  - Bảng `core.trusted_devices`: `user_id`, `device_hash`, `device_name`, `platform`, `first_seen_at`, `last_seen_at`, `removed_at`; khóa `user_id`, `device_hash`. Nạp từ `loyalty.device_links` 12 tháng. Phiên có trước triển khai chưa có băm thiết bị: thiết bị được coi là tin cậy ở lần làm mới phiên đầu tiên (lát L3).
  - `core.sessions` thêm `device_hash`, `device_verified`.
- Database migration 0159 `core_authentication_settings`:
  - Bảng một dòng `core.authentication_settings`: `transition_starts_on` (mặc định ngày chạy), `buyer_transition_days` 30, `portal_transition_days` 30, `recovery_redeem_lock_hours` 24, `version`.
  - Bảng `core.smart_otp_reminders`: `user_id`, `kind` (`start`, `day_14`, `day_7`, `day_1`, `zns_7`), `sent_at`; khóa `user_id`, `kind`.
  - `core.message_deliveries` thêm `otp_purpose` (mục đích mã OTP của tin) để đếm số tin SMS đã gửi theo mục đích; tin cũ để trống.
  - `core.authentication_settings` thêm `support_hotline` (quyết định người dùng 2026-11-17).
- Database migration 0160 `merchant_portal_authentication`:
  - Quyền `marketplace.buyer.security` (gán Quản trị tập đoàn, Quản trị công ty qua danh mục quyền).
  - `affiliate.members` thêm `authentication_reset_at` (bắt kích hoạt lại bằng SMS).
- Không lưu mã khóa, mã Smart OTP, khóa bí mật dạng rõ. Khóa TOTP vẫn mã hóa bằng `secret-box`.

## 10. API

Mới:

| Mã | Đường dẫn | Mô tả |
|---|---|---|
| API_318 | `POST /buyer/login/device-verification` (`smartOtp` hoặc `smsCode`); `POST /buyer/login/device-verification/sms` | Xác nhận thiết bị mới với phiên chờ xác nhận; gửi SMS trả `204` luôn |
| API_319 | `POST /buyer/loyalty/smart-otp/transfer` (`code` của máy cũ, `deviceName`, `platform`) | Chuyển Smart OTP sang máy đang dùng, trả khóa một lần |
| API_320 | `POST /buyer/loyalty/smart-otp/recovery/otp` (`phone`, `password`); `POST /buyer/loyalty/smart-otp/recovery` (`phone`, `password`, `code`, `deviceName`, `platform`) | Khôi phục khi mất máy; đăng nhập, trả khóa một lần và `redeemLockedUntil` |
| API_321 | `GET /buyer/devices`; `DELETE /buyer/devices/{id}` | Thiết bị đã đăng nhập; gỡ thiết bị |
| API_322 | `GET /marketplace/buyers/{id}/security`; `POST /marketplace/buyers/{id}/smart-otp/revoke` (`reason`, `version`) | Khối bảo mật đăng nhập; hủy Smart OTP |
| API_323 | `GET`, `PUT /marketplace/authentication-settings` | Tham số chuyển đổi, thống kê |
| API_324 | `POST /merchant-portal/security/password`; `POST /merchant-portal/password-reset`; dùng lại API_06, 07, 08 cho ứng dụng xác thực | Thiết lập bảo mật cổng, quên mật khẩu cổng |
| API_325 | `POST /merchant-portal/members/{id}/reset-authentication` (chủ cửa hàng); `POST /affiliate/merchants/{id}/members/{memberId}/reset-authentication` (`affiliate.manage`) | Đặt lại xác thực cổng |

Sửa:
- API_116 `POST /buyer/register`: nhận thêm `smartOtp: { deviceName, platform }` (tùy chọn); trả thêm `smartOtpActivation` (khóa một lần) khi kích hoạt.
- API_117:
  - `POST /buyer/login` trả thêm `deviceVerificationRequired`, `verificationMethods`.
  - `/buyer/login/otp`: `409 smartOtpPreferred` với khách đã kích hoạt, hoặc khi hết thời hạn.
  - `/buyer/password-reset` nhận `smartOtp` hoặc `code`.
- API_199:
  - Trạng thái trả thêm `platform`, `redeemLockedUntil`, `transitionEndsAt`, `webActivationExpiresAt`.
  - `activate` từ bản web: `409 smartOtpWebNotAllowed`; trên thiết bị chưa tin cậy hoặc tài khoản đã từng có Smart OTP thì tính khôi phục.
  - Thêm `POST /buyer/loyalty/smart-otp/lockout`: ứng dụng báo sai mã khóa 5 lần, máy chủ hủy Smart OTP.
- API_198 tra khách tại quầy: thêm `redeemLockedUntil`; lý do không dùng điểm `redeem_locked`.
- API_297, tra điểm Open API: như QUYTAC_NGHIEPVU_569.
- API_307 đổi điểm đối tác: báo giá trả `smartOtpRequired` theo thời hạn; `redeemLockedUntil`.
- API_178 đặt hàng dùng điểm; API cửa hàng liên kết cách 2, 3: lỗi `loyaltyRedeemLocked` khi đang khóa.
- API_02, API_03 `/auth/otp/*` gọi từ cổng cửa hàng sau hạn cổng: `409 merchantPortalSmsDisabled`, không gửi SMS.

## 11. Dùng lại mã đã có

| Cần | Có sẵn | Cách dùng |
|---|---|---|
| Kiểm mã TOTP, bộ đếm sai, khóa 15 phút | `SmartOtpService` (CONG_VIEC_53) | Chuyển sang `auth`, giữ hàm `verify`, thêm ngữ cảnh (đăng nhập, quên mật khẩu, giao dịch) |
| Mã SMS, giới hạn gửi | `PhoneOtpService` | Thêm kiểm thời hạn và trạng thái Smart OTP trước khi gửi |
| Phiên chưa qua bước hai | `AuthService.completeLogin` với `needsMfa` | Thêm lý do `device_verification` |
| Ứng dụng xác thực, mã dự phòng | `MfaService`, API_06, 07, 08 | Dùng nguyên cho cổng; thêm điều kiện theo ứng dụng |
| Mã cài đặt ứng dụng | `X-Device-Id`, `loyalty.device_links` (CONG_VIEC_60) | Băm như cũ; nạp thiết bị tin cậy |
| Tạo, hiện mã TOTP trên máy | `SmartOtpCard`, thư viện `otpauth` | Thêm bước mở khóa |
| Lưu bí mật trên máy | `expo-secure-store` | Lưu khóa TOTP, băm mã khóa |
| Thông báo, ZNS | `notify`, `MessagingService` | Loại thông báo, mẫu ZNS mới |

## 12. Phân tích giải pháp có sẵn – CONG_VIEC_72 – 2026-11-17

- Yêu cầu cần đáp ứng: CHUC_NANG_242 (sinh trắc học).
- Nguồn đã tìm: mã dự án (không có sẵn); kho npm.
- Từ khóa đã dùng: "expo local authentication", "react native biometrics".
- Phương án:
  - A. `expo-local-authentication` của Expo:
    - Phiên bản 58.0.2, phát hành 2026-10-01, đã quá hai tuần; dòng 58 khớp Expo SDK 58 (`expo ~58.0.23`) đang dùng.
    - Bản 58.0.3 phát hành 2026-11-11, chưa đủ hai tuần nên không dùng.
    - Giấy phép MIT: đã đọc tệp `LICENSE` trong gói ("The MIT License (MIT) Copyright (c) 2015-present 650 Industries, Inc. (aka Expo)").
    - Phụ thuộc duy nhất `invariant`, cũng giấy phép MIT.
    - Có vân tay, khuôn mặt (Face ID cần khai báo `NSFaceIDUsageDescription` qua cấu hình plugin trong `app.json`); chạy được trong Expo Go.
    - Không có trên bản web, nên bản web không kích hoạt Smart OTP, khớp QUYTAC_NGHIEPVU_562.
  - B. `react-native-biometrics`: cần mã gốc riêng, không hợp quy trình Expo hiện dùng.
  - C. Tự viết mô-đun gốc: không đáng.
- Đề xuất: A, ghi cố định `"expo-local-authentication": "58.0.2"`. Người dùng đã đồng ý dùng thư viện sinh trắc học của Expo (2026-11-17); chờ người dùng xác nhận phiên bản này khi duyệt đặc tả, sau đó mới cài và ghi vào tài liệu `13`.
- Băm mã khóa PBKDF2-SHA256: React Native 0.88 trên Hermes không bảo đảm có `crypto.subtle`; người dùng chọn thêm `@noble/hashes` 2.4.0 làm phụ thuộc trực tiếp (giấy phép MIT, đã có trong dự án qua `otpauth`) ngày 2026-11-17. 20.000 vòng băm, muối 16 byte. Ghi vào tài liệu `13` mục 11.
- Giới hạn của `expo-local-authentication`: không cho biết máy vừa thêm vân tay, khuôn mặt mới, nên ứng dụng không tự tắt sinh trắc học khi đó như QUYTAC_NGHIEPVU_563 dự kiến. Bù lại: hệ điều hành bắt nhập mật mã máy khi thêm vân tay, khuôn mặt; ứng dụng không cho dùng mật mã máy thay sinh trắc học (chỉ mã khóa Smart OTP). Người dùng chấp nhận lệch này ngày 2026-11-17 (duyệt lát L2).

## 13. Tiêu chí nghiệm thu

| Mã | Nội dung | Mức |
|---|---|---|
| TIEUCHI_NGHIEMTHU_536 | Kích hoạt Smart OTP: lần đầu bằng SMS; trong bước đăng ký không thêm SMS; bản web không kích hoạt được; chuyển máy bằng mã máy cũ không SMS | Bắt buộc |
| TIEUCHI_NGHIEMTHU_537 | Mã khóa 6 số (từ chối mã yếu), vân tay, khuôn mặt; sai 5 lần xóa Smart OTP và hủy trên máy chủ; khách cũ đặt mã khóa ở lần mở đầu | Bắt buộc |
| TIEUCHI_NGHIEMTHU_538 | Đăng nhập mật khẩu trên thiết bị mới cần mã Smart OTP; thiết bị tin cậy không hỏi; thiết bị đang đăng nhập khi triển khai không bị hỏi; gỡ thiết bị thu hồi phiên | Bắt buộc |
| TIEUCHI_NGHIEMTHU_539 | Quên mật khẩu bằng Smart OTP; khách đã kích hoạt không nhận SMS đăng nhập, quên mật khẩu; API không lộ số có tài khoản | Bắt buộc |
| TIEUCHI_NGHIEMTHU_540 | Khôi phục bằng mật khẩu và SMS: máy cũ mất hiệu lực, khóa mọi cách dùng điểm đúng số giờ, tích điểm vẫn được, thông báo gửi | Bắt buộc |
| TIEUCHI_NGHIEMTHU_541 | Thời hạn chuyển đổi: trong hạn SMS dự phòng đúng luồng; hết hạn Open API trả `409`, đổi ra đối tác bắt buộc Smart OTP, đăng nhập SMS bị từ chối | Bắt buộc |
| TIEUCHI_NGHIEMTHU_542 | Chăm sóc khách hàng hủy Smart OTP cần quyền mới, lý do, ghi nhật ký, thu hồi phiên và thiết bị | Bắt buộc |
| TIEUCHI_NGHIEMTHU_543 | Cổng cửa hàng: mật khẩu và mã ứng dụng xác thực (hoặc mã dự phòng), Zalo vẫn hỏi mã; kích hoạt lời mời có thiết lập; hết hạn bỏ SMS; đặt lại xác thực; quên mật khẩu; người mua là thành viên cổng không bị hỏi mã ứng dụng xác thực trên ứng dụng VComm | Bắt buộc |
| TIEUCHI_NGHIEMTHU_544 | Nhắc kích hoạt: thẻ nhắc, thông báo đúng ngày, một tin ZNS 7 ngày trước hạn khi có mẫu, không gửi trùng | Mong muốn |
| TIEUCHI_NGHIEMTHU_545 | Tham số chuyển đổi sửa được có nhật ký; thống kê kích hoạt, số tin SMS theo mục đích | Mong muốn |

## 14. Kịch bản kiểm thử

| Mã | Nội dung | Tiêu chí | Cách |
|---|---|---|---|
| KICHBAN_KIEMTHU_734 | Kích hoạt lần đầu bằng SMS; kích hoạt từ bản web bị từ chối | 536 | Tự động |
| KICHBAN_KIEMTHU_735 | Đăng ký kèm kích hoạt Smart OTP: chỉ một mã SMS được tạo | 536 | Tự động |
| KICHBAN_KIEMTHU_736 | Chuyển máy bằng mã máy cũ: mã cũ hết hiệu lực, không tạo mã SMS, không khóa dùng điểm | 536 | Tự động |
| KICHBAN_KIEMTHU_737 | Mã khóa yếu bị từ chối; sai 5 lần gọi hủy; khách cũ đặt mã khóa | 537 | Tự động (giao diện) và thử tay trên máy |
| KICHBAN_KIEMTHU_738 | Sinh trắc học bật, tắt, đổi vân tay trên máy | 537 | Thử tay trên máy thật (Expo Go) |
| KICHBAN_KIEMTHU_739 | Thiết bị mới: mật khẩu đúng chỉ được phiên chờ xác nhận; gọi API khác trả `401`; mã Smart OTP đúng thì tin cậy, có thông báo; mã dùng lại bị từ chối; sai 5 lần khóa | 538 | Tự động |
| KICHBAN_KIEMTHU_740 | Thiết bị có phiên trước triển khai không bị hỏi; gỡ thiết bị thu hồi phiên | 538 | Tự động |
| KICHBAN_KIEMTHU_741 | Quên mật khẩu bằng Smart OTP; khách đã kích hoạt yêu cầu SMS: trả `204`, không tạo mã | 539 | Tự động |
| KICHBAN_KIEMTHU_742 | Khôi phục: mật khẩu sai, mã SMS sai; đúng thì máy cũ hết hiệu lực, khóa 24 giờ ở quầy, Open API, đổi ra đối tác, đặt hàng dùng điểm, cửa hàng liên kết cách 2, 3; tích điểm vẫn được; hết giờ dùng lại được | 540 | Tự động |
| KICHBAN_KIEMTHU_743 | Trong và sau thời hạn: đăng nhập SMS, quên mật khẩu SMS, Open API gửi mã, đổi ra đối tác chưa kích hoạt; tham số số ngày đổi thì hạn đổi | 541 | Tự động |
| KICHBAN_KIEMTHU_744 | Hủy Smart OTP thiếu quyền `403`, thiếu lý do `400`, đủ thì thu hồi phiên, thiết bị, ghi nhật ký; đặt lại mật khẩu ngoại lệ một lần | 542 | Tự động |
| KICHBAN_KIEMTHU_745 | Cổng: đăng nhập mật khẩu và mã ứng dụng xác thực, mã dự phòng, Zalo hỏi mã; tài khoản người mua cùng người không bị hỏi mã ứng dụng xác thực trên ứng dụng | 543 | Tự động |
| KICHBAN_KIEMTHU_746 | Cổng: kích hoạt lời mời có thiết lập; trong hạn "Để sau"; hết hạn `/auth/otp/send` từ cổng bị từ chối | 543 | Tự động |
| KICHBAN_KIEMTHU_747 | Cổng: đặt lại xác thực (chủ cho thu ngân, quản trị cho chủ, chủ không đặt được cho cửa hàng khác); quên mật khẩu cổng | 543 | Tự động |
| KICHBAN_KIEMTHU_748 | Việc nền nhắc: đúng ngày, không trùng, ZNS chỉ khi có mẫu | 544 | Tự động |
| KICHBAN_KIEMTHU_749 | Tham số: phạm vi giá trị, ngày bắt đầu không sau hôm nay, nhật ký; thống kê đúng số | 545 | Tự động |

## 15. Ràng buộc kỹ thuật

- Phần xác thực (`apps/api/src/auth`) đọc, ghi Smart OTP trong schema `core`, không ghi schema `loyalty` (tài liệu `12` mục 2). Phần điểm thưởng, bán lẻ, cửa hàng liên kết gọi dịch vụ Smart OTP, không truy vấn bảng trực tiếp.
- Cờ yêu cầu xác thực hai lớp của cổng xét theo ứng dụng đăng nhập. `mfaEnrolled` của thành viên cổng không được làm ứng dụng VComm (`vcomm_app`) đòi mã ứng dụng xác thực.
- Không ghi mã, khóa, mã khóa vào log, nhật ký, thông báo lỗi (tài liệu `19` mục 3.5).
- Kiểm mã Smart OTP luôn trong giao dịch có khóa dòng, như CONG_VIEC_53.
- Chuỗi giao diện chỉ trong `packages/i18n`; giao diện chỉ dùng biến tài liệu `15`.
- Thêm `expo-local-authentication` 58.0.2 sau khi người dùng duyệt; ghi tài liệu `13`.
- Database migration mới đánh số tiếp theo do phiên điều phối cấp; không sửa tệp đã chạy (chuyển bảng bằng `ALTER TABLE … SET SCHEMA`).

## 16. Thành phần không được thay đổi

- Đăng nhập web nhân viên, xác thực hai lớp của nhân viên ngoài cổng cửa hàng.
- Đăng nhập Zalo của người mua.
- Cách tính phí tin OTP, bảng đối soát tuần (THAY_DOI_31).
- Quy tắc tích điểm, giới hạn dùng điểm, chống gian lận (CONG_VIEC_51, 60).
- Cách 2, cách 3 của cửa hàng liên kết (chỉ thêm khóa dùng điểm).

## 17. Quyết định của người dùng (2026-11-17)

1. Áp cho giao dịch điểm (quầy, Open API, đổi ra đối tác), đăng nhập người mua thiết bị mới, quên mật khẩu, đăng nhập cổng cửa hàng bằng ứng dụng xác thực.
2. Đăng ký và kích hoạt lần đầu vẫn dùng SMS; giữ Zalo, ZNS.
3. Thời hạn chuyển đổi 30 ngày tính từ ngày triển khai cho mọi khách, tham số sửa được; cổng cửa hàng cũng 30 ngày. Khách đăng ký mới kích hoạt luôn trong bước đăng ký bằng mã SMS đăng ký (nêu ở QUYTAC_NGHIEPVU_562 để người dùng duyệt).
4. Mã khóa 6 số và vân tay, khuôn mặt (sinh trắc học khi máy hỗ trợ, không có thì mã khóa; sai 5 lần xóa Smart OTP); dùng thư viện sinh trắc học của Expo sau khi báo phiên bản, giấy phép (mục 12).
5. Khôi phục: mật khẩu và SMS, kích hoạt ngay, khóa mọi giao dịch dùng điểm 24 giờ (tham số), thông báo trong ứng dụng và ZNS. Mất cả số điện thoại: chăm sóc khách hàng hủy Smart OTP (quyền riêng, nhật ký).
6. Thiết bị mới cần mật khẩu và Smart OTP từ máy cũ; máy đang đăng nhập coi là đã biết; không kích hoạt Smart OTP trên bản web.
7. Quên mật khẩu bằng Smart OTP.
8. Zalo giữ nguyên.
9. Cổng cửa hàng: mọi tài khoản, số điện thoại, mật khẩu, ứng dụng xác thực, 10 mã dự phòng; Zalo vẫn hỏi mã.
10. Nhắc trong ứng dụng và một tin ZNS 7 ngày trước hạn.
11. Sau hạn Open API không gửi SMS; khách vẫn tích, dùng điểm qua mã thành viên hoặc xác nhận trên ứng dụng.
12. Khách không có điện thoại thông minh: sau hạn chỉ tích điểm.
13. Smart OTP đã có giữ nguyên; lần mở đầu sau cập nhật đặt mã khóa.

Điểm AI tự đề xuất trong đặc tả, người dùng duyệt ngày 2026-11-17 (cùng thư viện `expo-local-authentication` 58.0.2):
- Khách đã kích hoạt không còn nhận SMS đăng nhập, quên mật khẩu ngay từ ngày bắt đầu (QUYTAC_NGHIEPVU_560).
- Thiết bị tin cậy hết hạn sau 12 tháng không dùng.
- Kích hoạt trên bản web giữ hiệu lực đến hết thời hạn rồi tự hủy.
- Kích hoạt bằng SMS khi đã từng có Smart OTP, hoặc trên thiết bị chưa tin cậy, tính là khôi phục (có khóa dùng điểm).
- Ngoại lệ đặt lại mật khẩu bằng SMS một lần trong 24 giờ sau khi chăm sóc khách hàng hủy Smart OTP.
- Đặt lại xác thực cổng buộc kích hoạt lại bằng SMS một lần.
- Không ai mở sớm khóa dùng điểm.

## 18. Các lát và điểm xem trước

| Lát | Nội dung | Xem trước |
|---|---|---|
| L0 | Đặc tả, bản mẫu, mã chính thức | Người dùng duyệt đặc tả, bản mẫu |
| L1 | Database migration 0158 đến 0160; chuyển bảng Smart OTP sang `core`; thiết bị tin cậy nạp sẵn; tham số chuyển đổi, thẻ "Xác thực" MAN_HINH_86 | Thẻ Xác thực trên web-crm (ảnh), số liệu kích hoạt; hồi quy CONG_VIEC_53, 65, 67 đạt |
| L2 | Ứng dụng: mã khóa, sinh trắc học (`expo-local-authentication`), khách cũ đặt mã khóa; kích hoạt trong bước đăng ký; chặn bản web; chuyển máy bằng mã máy cũ | Ảnh ứng dụng (bản web cho phần mã khóa); người dùng thử sinh trắc học trên máy thật qua Expo Go |
| L3 | Thiết bị mới, thiết bị đã đăng nhập, quên mật khẩu bằng Smart OTP | Ảnh và lệnh gọi thử: đăng nhập máy lạ, nhập mã máy cũ |
| L4 | Khôi phục khi mất máy, khóa dùng điểm mọi luồng, khối "Bảo mật đăng nhập" MAN_HINH_80, thông báo | Ảnh khôi phục, quầy báo khóa, web-crm hủy Smart OTP |
| L5 | Giao dịch điểm theo thời hạn (Open API, đổi ra đối tác), nhắc kích hoạt, ZNS, thống kê SMS | Lệnh gọi Open API trước, sau hạn; ảnh thẻ nhắc |
| L6 | Cổng cửa hàng: thiết lập bảo mật, đăng nhập mật khẩu và ứng dụng xác thực, đặt lại xác thực, quên mật khẩu | Ảnh cổng; thử đăng nhập bằng ứng dụng xác thực |

Mỗi lát dừng ở điểm xem trước chờ phản hồi. Kết thúc: chạy toàn bộ kiểm thử API một tiến trình (`--no-file-parallelism`) trước khi trình nghiệm thu.

## 19. Điểm chưa xác định

- Mã mẫu ZNS và số tổng đài: người dùng nhập sau trên web quản trị; chưa có thì chỉ gửi thông báo trong ứng dụng.
- Không tra cứu pháp lý trong công việc này.

## 20. Kết quả đối chiếu định nghĩa hoàn thành

Chưa thực hiện.
