# 22. BẢO MẬT

- Mô tả: Dữ liệu nhạy cảm, điểm tiếp nhận dữ liệu, xác thực, ma trận phân quyền, khóa bí mật, kết quả kiểm tra, rủi ro đã chấp nhận, sự cố bảo mật.
- Phiên bản: 1.0
- Ngày cập nhật: 2026-11-09
- Trạng thái: Đã phê duyệt

Phạm vi hiện tại: MODULE_01 Nền tảng. Các module sau bổ sung vào cùng tài liệu.

## 1. Dữ liệu nhạy cảm

| Dữ liệu | Loại | Cách lưu trữ | Vai trò được truy cập |
|---|---|---|---|
| Mật khẩu | Xác thực | Băm bằng argon2id | Không ai đọc được |
| Bí mật ứng dụng xác thực hai lớp (TOTP) | Xác thực | Mã hóa bằng khóa AWS KMS | Chỉ máy chủ khi kiểm tra mã |
| Mã dự phòng xác thực hai lớp | Xác thực | Băm bằng argon2id | Không ai đọc được |
| Mã OTP qua SMS, email | Xác thực | Băm, lưu trong Redis, hết hạn 5 phút | Không ai đọc được |
| Token làm mới, đường dẫn kích hoạt, đường dẫn đặt lại mật khẩu | Xác thực | Chỉ lưu bản băm SHA-256 | Không ai đọc được |
| Email, số điện thoại, họ tên nhân viên | Cá nhân | Thường, cơ sở dữ liệu mã hóa khi lưu (Aurora) | Chính nhân viên; quản trị công ty của họ; quản trị tập đoàn |
| Địa chỉ IP, thiết bị trong phiên và nhật ký | Cá nhân | Thường, mã hóa khi lưu | Chính nhân viên (phiên của mình); quản trị xem nhật ký |
| Mã số thuế công ty | Tổ chức | Thường | Mọi nhân viên của công ty |
| Tỷ giá | Tài chính | Thường | Mọi nhân viên xem; quản lý tỷ giá sửa |
| Khóa bí mật hệ thống (xem mục 5) | Khóa bí mật | AWS Secrets Manager | Chỉ ứng dụng khi chạy |

## 2. Điểm tiếp nhận dữ liệu từ bên ngoài

| Điểm | Loại | Kiểm tra đầu vào | Yêu cầu xác thực |
|---|---|---|---|
| Đăng nhập mật khẩu, gửi mã OTP, đặt lại mật khẩu, kích hoạt | API | Định dạng email, số điện thoại E.164, độ dài; giới hạn số lần thử theo địa chỉ IP và theo tài khoản | Không |
| Phản hồi đăng nhập Google, Microsoft | Tích hợp (OpenID Connect) | Kiểm tra chữ ký token, `state`, `nonce`, đối tượng nhận, email đã xác minh | Không |
| Mọi API quản trị và hồ sơ cá nhân của MODULE_01 | API | Lược đồ kiểm tra kiểu, độ dài, giá trị cho phép phía máy chủ | Có |
| Nhập nhân viên từ tệp Excel | Tải tệp lên | Chỉ `.xlsx`, tối đa 5 MB, tối đa 1.000 dòng; đổi tên tệp; xử lý trong bộ nhớ, không lưu tệp gốc | Có |
| Gửi duyệt, quyết định duyệt từ mini app khác | API nội bộ | Lược đồ kiểm tra; mã chứng từ phải thuộc công ty của người gọi | Có |
| Lấy tỷ giá tự động | Tích hợp | Giá trị số dương, đủ cặp tiền tệ; lỗi thì không ghi | Không áp dụng (hệ thống gọi ra) |

## 3. Xác thực và phiên đăng nhập

- Cách xác thực: mật khẩu; Google Workspace, Microsoft 365 (OpenID Connect); số điện thoại kèm mã OTP. Xác thực hai lớp bằng TOTP hoặc mã OTP qua SMS, email; bắt buộc theo QUYTAC_NGHIEPVU_09.
- Thời hạn phiên đăng nhập: token truy cập 15 phút; token làm mới 30 ngày (web), 90 ngày (ứng dụng kho, ứng dụng kinh doanh); token làm mới đổi mới mỗi lần dùng, phát hiện dùng lại token cũ thì thu hồi cả chuỗi phiên.
- Lưu phiên trên web: cookie `HttpOnly`, `Secure`, `SameSite=Lax`; thao tác ghi kèm chống giả mạo yêu cầu (CSRF token).
- Giới hạn số lần thử: mật khẩu sai 5 lần liên tiếp khóa 15 phút; mã OTP sai 5 lần thì hủy mã; gửi mã OTP tối đa 5 lần mỗi giờ mỗi số; mọi API không cần đăng nhập giới hạn 20 yêu cầu mỗi phút mỗi địa chỉ IP.

## 4. Ma trận phân quyền

Vai trò theo tài liệu `08`. Mọi API kiểm tra quyền phía máy chủ và lọc dữ liệu theo phạm vi ngay trong câu truy vấn (QUYTAC_NGHIEPVU_12).

| Chức năng | Quản trị tập đoàn | Quản trị công ty | Quản lý tỷ giá | Nhân viên | Chỉ dữ liệu của chính mình |
|---|---|---|---|---|---|
| CHUC_NANG_01 Quản lý công ty | Được | Không | Không | Không | Không |
| CHUC_NANG_02 Quản lý chi nhánh | Được | Trong công ty mình | Không | Không | Không |
| CHUC_NANG_03 Quản lý phòng ban | Được | Trong công ty mình | Không | Không | Không |
| CHUC_NANG_04, CHUC_NANG_05 Mời, nhập nhân viên | Được | Trong công ty mình | Không | Không | Không |
| CHUC_NANG_06, CHUC_NANG_07, CHUC_NANG_08 Đăng nhập | Được | Được | Được | Được | Có |
| CHUC_NANG_09 Xác thực hai lớp (của mình) | Được | Được | Được | Được | Có |
| CHUC_NANG_09 Đặt lại xác thực hai lớp người khác | Được | Trong công ty mình | Không | Không | Không |
| CHUC_NANG_10 Hồ sơ cá nhân | Được | Được | Được | Được | Có |
| CHUC_NANG_11 Chuyển công ty | Được | Được | Được | Được | Có |
| CHUC_NANG_12 Quản lý vai trò | Được, cả vai trò dùng chung | Vai trò riêng công ty mình | Không | Không | Không |
| CHUC_NANG_13 Gán vai trò | Mọi phạm vi | Công ty mình, chi nhánh của công ty mình | Không | Không | Không |
| CHUC_NANG_14 Trang chủ mini app | Được | Được | Được | Được | Có |
| CHUC_NANG_15 Chính sách duyệt | Được | Trong công ty mình | Không | Không | Không |
| CHUC_NANG_16, CHUC_NANG_17 Duyệt chứng từ, hộp duyệt | Khi được chỉ định | Khi được chỉ định | Khi được chỉ định | Khi được chỉ định | Có |
| CHUC_NANG_19 Khóa, vô hiệu hóa nhân viên | Được | Trong công ty mình, trừ chính mình | Không | Không | Không |
| CHUC_NANG_20 Dãy số chứng từ | Được | Trong công ty mình | Không | Không | Không |
| CHUC_NANG_21 Tỷ giá (sửa) | Được | Không | Được | Không | Không |
| CHUC_NANG_21 Tỷ giá (xem) | Được | Được | Được | Được | Không |
| CHUC_NANG_22 Đổi ngôn ngữ | Được | Được | Được | Được | Có |
| CHUC_NANG_23 Nhật ký thao tác | Toàn tập đoàn | Trong công ty mình | Không | Không | Không |

## 5. Quản lý khóa bí mật

| Khóa | Nơi lưu | Môi trường | Ngày đổi gần nhất | Trạng thái |
|---|---|---|---|---|
| Chuỗi kết nối cơ sở dữ liệu (tài khoản ứng dụng, quyền tối thiểu) | AWS Secrets Manager, tự đổi mỗi 90 ngày | Phát triển, thử nghiệm, thật (khác nhau) | Chưa tạo | Chưa tạo |
| Khóa ký token truy cập | AWS Secrets Manager | Từng môi trường | Chưa tạo | Chưa tạo |
| Khóa KMS mã hóa bí mật TOTP | AWS KMS | Từng môi trường | Chưa tạo | Chưa tạo |
| Mã ứng dụng Google, Microsoft (client secret) | AWS Secrets Manager | Từng môi trường | Chưa tạo | Chưa tạo |
| Khóa nhà cung cấp SMS | AWS Secrets Manager | Từng môi trường | Chưa tạo | Chưa tạo |
| Khóa gửi email (Amazon SES) | Vai trò IAM, không dùng khóa tĩnh | Từng môi trường | Không áp dụng | Chưa tạo |

Máy phát triển dùng tệp `.env` không commit; kho mã có `.env.example` không chứa giá trị thật.

## 6. Kết quả kiểm tra phần E (vận hành)

Chưa vận hành.

## 7. Sự cố bảo mật

Chưa có.

## 8. Rủi ro đã chấp nhận

Chưa có.

## Nội dung do AI đề xuất, người dùng đã xác nhận ngày 2026-11-09

| Vị trí | Nội dung |
|---|---|
| Mục 2 | Tệp Excel tối đa 5 MB |
| Mục 3 | Đổi mới token làm mới mỗi lần dùng; giới hạn 20 yêu cầu mỗi phút mỗi địa chỉ IP cho API không cần đăng nhập |
| Mục 5 | Gửi email qua Amazon SES; tự đổi mật khẩu cơ sở dữ liệu mỗi 90 ngày |
