# 28. HƯỚNG DẪN ĐĂNG KÝ DỊCH VỤ NGOÀI
- Mô tả: Hướng dẫn chủ dự án đăng ký eSMS.vn (SMS Brandname, Zalo ZNS), Zalo, Google, Microsoft, AWS S3 và nhập khóa vào VComm.
- Phiên bản: 0.2
- Ngày cập nhật: 2026-11-09
- Trạng thái: Đang dùng (khớp phiên bản 0.2.0)

## 0. Quy tắc chung

1. Mỗi dịch vụ đăng ký bằng tài khoản của công ty, không dùng tài khoản cá nhân của nhân viên sắp nghỉ việc.
2. Ghi tài khoản quản trị, người giữ mật khẩu và ngày hết hạn (nếu có) vào sổ quản lý của công ty.
3. Khóa nhà cung cấp do quản trị tập đoàn tự nhập ở màn hình **Cài đặt tích hợp** (menu Nền tảng → Cài đặt tích hợp), không gửi cho lập trình viên, không đặt trong tệp `.env`. Khóa bí mật được mã hóa, sau khi lưu chỉ hiện 4 ký tự cuối.
4. Không gửi khóa bí mật qua tin nhắn Zalo, Messenger, email thường, không chụp màn hình gửi nhóm chat.
5. Mỗi môi trường (thử nghiệm, thật) có Cài đặt tích hợp riêng và địa chỉ chuyển hướng riêng. Làm trên môi trường thử nghiệm trước.
6. Chi tiết ghi "chưa xác minh" là chi tiết chưa đọc được trên trang chính thức. Khi làm thực tế, đối chiếu trên trang và báo lập trình viên nếu khác.
7. Thứ tự nên làm: eSMS (mục 1, 2, lâu nhất vì chờ duyệt Brandname, OA, mẫu tin) → Google, Microsoft (mục 4, 5, làm trong một buổi) → Zalo đăng nhập (mục 3) → S3 (mục 6, khi chọn hạ tầng).

## 1. eSMS.vn: tài khoản và SMS Brandname

### 1.1. Dùng để làm gì trong VComm

- Gửi mã OTP đăng nhập bằng số điện thoại: VComm gửi qua Zalo ZNS trước, không được thì gửi SMS Brandname (một lần gọi eSMS).
- Gửi Zalo ZNS cho thông báo duyệt (mục 2).

### 1.2. Điều kiện trước

1. Giấy chứng nhận đăng ký kinh doanh của công ty.
2. Tên Brandname dự kiến, ví dụ `VCOMM`: tối đa 11 ký tự, không dấu, không ký tự đặc biệt như `@ % * #`; ký tự phân cách cho phép khác nhau theo nhà mạng (Viettel, Vinaphone: khoảng trắng hoặc `.` `_` `-`; Mobifone: không khoảng trắng; Vietnamobile: chỉ khoảng trắng).
3. Nếu Brandname không phải tên công ty (ví dụ tên sản phẩm "VComm"): giấy tờ chứng minh quyền sử dụng tên (đăng ký nhãn hiệu, tên miền).

### 1.3. Các bước

1. Đăng ký tài khoản doanh nghiệp tại https://esms.vn, đăng nhập. Tài khoản mới có sẵn 5.000 đồng dùng thử.
2. Vào menu **Quản lý API**, lấy **ApiKey** và **SecretKey** (có thể tạo khóa mới tại đây).
3. Liên hệ eSMS đăng ký Brandname cho tin **chăm sóc khách hàng** (không phải quảng cáo), nộp hồ sơ ở mục 1.2. eSMS khai báo Brandname với các nhà mạng.
4. Đăng ký **mẫu tin SMS chăm sóc khách hàng** cho mã OTP với nội dung đúng như sau (VComm gửi đúng nội dung này, khác một ký tự là nhà mạng chặn):

   `{mã} la ma dang nhap VComm cua ban, hieu luc 5 phut. Khong chia se ma nay.`

   Trong đó `{mã}` là 6 chữ số. Hỏi eSMS cách ghi phần biến trong mẫu (thường là `{P1}` hoặc tương tự).
5. Nạp tiền vào tài khoản eSMS.

### 1.4. Nhập vào VComm

Màn hình Cài đặt tích hợp, nhóm "eSMS.vn (SMS, Zalo ZNS)":

| Giá trị | Bí mật | Ô nhập |
|---|---|---|
| ApiKey | Có | API key |
| SecretKey | Có | Secret key |
| Brandname đã duyệt | Không | Brandname SMS |
| Chế độ thử | Không | Chế độ thử (không gửi tin thật): chọn "Bật" để eSMS nhận lệnh nhưng không gửi tin thật, không trừ tiền |

Sau khi lưu:

1. Bấm **Kiểm tra kết nối eSMS**: đúng khóa thì hiện "Kết nối eSMS thành công" và danh sách Zalo OA đã liên kết.
2. Nhập số điện thoại của mình vào ô **Số điện thoại nhận tin thử**, bấm **Gửi thử tin**: nhận được tin chứa 6 chữ số (mã ngẫu nhiên, không dùng đăng nhập được) là đạt. Có tính phí một tin. Lỗi xem ở bảng "Tin gửi gần đây" cuối màn hình.
3. Khi đã có ApiKey, SecretKey, Brandname, màn hình đăng nhập tự hiện thẻ "Số điện thoại".

### 1.5. Thời gian và chi phí

- Khai báo Brandname: không quá 2 ngày với Viettel, không quá 5 ngày với nhà mạng khác, tính từ khi đủ hồ sơ, không tính ngày nghỉ (theo nguồn đại lý, chưa xác minh với eSMS).
- Cước tin: khác nhau theo nhà mạng, loại tin; xin báo giá eSMS trước khi nạp tiền.

### 1.6. Nguồn

- Lấy ApiKey, SecretKey: https://developers.esms.vn/readme/lay-thong-tin-apikey-va-secretkey
- Môi trường thử (Sandbox): https://developers.esms.vn/esms-api/moi-truong-test-sandbox
- Gửi OTP đa kênh Zalo rồi SMS: https://developers.esms.vn/esms-api/ham-gui-tin/tin-mutichanel-zalo-greater-than-sms-otp-cskh

## 2. Zalo Official Account (OA) và Zalo ZNS qua eSMS

### 2.1. Dùng để làm gì trong VComm

- Gửi mã OTP đăng nhập qua Zalo (trước SMS).
- Báo người duyệt có chứng từ chờ duyệt, nhắc chứng từ quá hạn duyệt, báo người lập kết quả duyệt.
- VComm gửi ZNS **qua eSMS**, không gọi trực tiếp Zalo, nên không cần tạo tài khoản ZBS riêng nếu eSMS làm thay. Hỏi eSMS: OA liên kết với eSMS thế nào, ai đăng ký mẫu với Zalo.

### 2.2. Điều kiện trước

1. Tài khoản Zalo của người đại diện công ty.
2. Giấy chứng nhận đăng ký kinh doanh (để xác thực OA).
3. Thông tin doanh nghiệp: tên công ty, mã số thuế, địa chỉ, người đại diện, số điện thoại, email.

### 2.3. Các bước

Phần A. Tạo và xác thực OA:

1. Đăng nhập https://oa.zalo.me bằng tài khoản Zalo của người đại diện.
2. Tạo OA, tên trùng hoặc liên quan rõ đến tên trên giấy đăng ký kinh doanh.
3. Xác thực OA bằng giấy đăng ký kinh doanh, chờ duyệt.
4. Lấy **mã OA (OA ID)** ở trang quản trị OA.

Phần B. Liên kết OA với eSMS và đăng ký mẫu ZNS:

1. Liên hệ eSMS liên kết OA vào tài khoản eSMS (eSMS yêu cầu OA đăng ký trước khi gửi). Kiểm tra bằng nút **Kiểm tra kết nối eSMS** trong VComm: OA hiện trong danh sách là đã liên kết.
2. Đăng ký 4 mẫu ZNS qua eSMS. Tham số đặt theo đúng tên dưới đây (VComm gửi đúng các tên này):

| Mẫu | Ô nhập trong VComm | Tham số | Nội dung gợi ý |
|---|---|---|---|
| Mã OTP đăng nhập | Mã mẫu ZNS: mã OTP đăng nhập | một tham số mã xác thực (hỏi eSMS tên tham số; VComm truyền mã ở vị trí đầu tiên) | Mã xác thực đăng nhập VComm của bạn là `<otp>`. Mã có hiệu lực 5 phút, không chia sẻ mã này. |
| Có chứng từ chờ duyệt | Mã mẫu ZNS: có chứng từ chờ duyệt | `document_no`, `document_type`, `amount`, `requester` | Bạn có `<document_type>` số `<document_no>` của `<requester>`, giá trị `<amount>`, đang chờ duyệt trên VComm. |
| Nhắc quá hạn duyệt | Mã mẫu ZNS: nhắc quá hạn duyệt | `document_no`, `document_type`, `amount`, `requester` | `<document_type>` số `<document_no>` của `<requester>`, giá trị `<amount>`, đã quá hạn duyệt. Vui lòng xử lý trên VComm. |
| Kết quả duyệt | Mã mẫu ZNS: kết quả duyệt | `document_no`, `document_type`, `amount`, `result` | `<document_type>` số `<document_no>`, giá trị `<amount>`, của bạn đã có kết quả: `<result>`. |

   Giá trị tham số VComm gửi: `amount` dạng `80.000.000 VND`; `result` là "Đã duyệt" hoặc "Bị từ chối".

3. Quy định duyệt mẫu của Zalo cần nhớ: tiếng Việt có dấu, không lỗi chính tả, không biểu tượng cảm xúc; không đặt liên kết, số điện thoại trong nội dung (đặt ở nút); mẫu mã xác thực gắn nhãn Giao dịch; mẫu cần ít nhất một tham số cá nhân hoặc ba tham số định danh.
4. Khi mẫu được duyệt, lấy **mã mẫu (Template ID)** từng mẫu.

### 2.4. Nhập vào VComm

| Giá trị | Bí mật | Ô nhập |
|---|---|---|
| Mã OA | Không | Mã Zalo OA (OAID) |
| Mã mẫu OTP | Không | Mã mẫu ZNS: mã OTP đăng nhập |
| Mã mẫu chờ duyệt | Không | Mã mẫu ZNS: có chứng từ chờ duyệt |
| Mã mẫu nhắc quá hạn | Không | Mã mẫu ZNS: nhắc quá hạn duyệt |
| Mã mẫu kết quả duyệt | Không | Mã mẫu ZNS: kết quả duyệt |

Mẫu nào để trống thì VComm không gửi ZNS cho sự kiện đó (mã OTP vẫn gửi SMS). Nhân viên phải có số điện thoại trong hồ sơ mới nhận được ZNS. Kiểm tra bằng nút **Gửi thử tin**: có mã OA và mẫu OTP thì tin thử đi qua Zalo trước.

### 2.5. Thời gian và chi phí

- Giá mẫu xác thực trên bảng giá Zalo: 300 đồng một tin thành công, chưa gồm thuế; giá qua eSMS hỏi eSMS.
- Thời gian xác thực OA, duyệt mẫu: chưa xác minh (trang chính thức không nêu).

### 2.6. Nguồn

- Trang OA: https://oa.zalo.me
- Bảng giá ZNS: https://zalo.solutions/zns/pricing
- Quy định duyệt mẫu: https://zalo.solutions/news/quy-dinh-chung-khi-kiem-duyet-mau-tin-nhan-zbs/xdygqtrjjm97k28rsh07wr72
- Đăng ký mẫu Zalo qua eSMS: https://developers.esms.vn/esms-api/ham-truy-xuat-va-dang-ky/ham-dang-ky-template-zalo

## 3. Ứng dụng Zalo cho Đăng nhập bằng Zalo

### 3.1. Dùng để làm gì trong VComm

- Cho nhân viên đăng nhập VComm bằng tài khoản Zalo. Nhân viên phải đăng nhập bằng cách khác rồi liên kết Zalo ở Hồ sơ cá nhân trước (Zalo không trả email nên không tự gắn được).
- VComm dùng OAuth v4 của Zalo với PKCE, trang cấp quyền: `https://oauth.zaloapp.com/v4/permission`.

### 3.2. Điều kiện trước

1. Tài khoản Zalo của người đại diện công ty.
2. Ứng dụng này chỉ dùng cho đăng nhập; tin ZNS gửi qua eSMS (mục 2) nên không cần liên kết ứng dụng với ZBS.

### 3.3. Các bước

1. Đăng nhập https://developers.zalo.me bằng tài khoản Zalo.
2. Tạo ứng dụng mới, đặt tên "VComm", chọn danh mục phù hợp.
3. Kích hoạt ứng dụng.
4. Thêm sản phẩm Đăng nhập (Social API / Login) cho ứng dụng.
5. Khai báo địa chỉ chuyển hướng (callback) ở mục 3.5.
6. Mở trang cài đặt ứng dụng, sao chép mã ứng dụng (App ID) và mã bí mật (Secret Key).
7. Thêm tài khoản Zalo của lập trình viên làm quản trị viên hoặc người thử nghiệm ứng dụng.

Tên chính xác của các mục menu ở bước 3 đến bước 7: chưa xác minh (trang hiển thị bằng JavaScript).

### 3.4. Nhập vào VComm

Màn hình Cài đặt tích hợp, nhóm "Zalo (đăng nhập)":

| Giá trị | Bí mật | Ô nhập |
|---|---|---|
| Mã ứng dụng (App ID) | Không | App ID |
| Mã bí mật (Secret Key) | Có | Secret key |

### 3.5. Địa chỉ chuyển hướng cần khai báo

- Máy phát triển: `http://localhost:3000/api/v1/auth/oauth/zalo/callback`
- Thử nghiệm: `https://<tên miền thử nghiệm>/api/v1/auth/oauth/zalo/callback`
- Thật: `https://<tên miền thật>/api/v1/auth/oauth/zalo/callback`

Địa chỉ đúng của từng môi trường hiện sẵn trên màn hình Cài đặt tích hợp (lấy theo biến `WEB_ORIGIN`), sao chép từ đó để tránh gõ sai.

Zalo có chấp nhận địa chỉ `http://localhost` hay không: chưa xác minh. Nếu bị từ chối, báo lập trình viên để dùng địa chỉ thay thế.

### 3.6. Thời gian và chi phí

- Thời gian, chi phí tạo ứng dụng và dùng Đăng nhập bằng Zalo: chưa xác minh (không đọc được trang chính thức).

### 3.7. Nguồn chính thức

- Trang nhà phát triển: https://developers.zalo.me
- Tài liệu mã truy cập người dùng v4: https://developers.zalo.me/docs/social-api/tham-khao/user-access-token-v4 (chưa đọc được nội dung)

## 4. Google OAuth (Đăng nhập bằng Google)

### 4.1. Dùng để làm gì trong VComm

- Cho nhân viên đăng nhập bằng tài khoản Google hoặc Google Workspace có email trùng email được mời; lần đầu tự gắn vào tài khoản nhân viên. Kích hoạt tài khoản bằng Google cũng dùng ứng dụng này.
- Quyền xin người dùng: `openid email profile` (định danh, email, tên và ảnh đại diện).

### 4.2. Điều kiện trước

1. Một tài khoản Google của công ty (nên là tài khoản Google Workspace nếu công ty dùng Workspace).
2. Email hỗ trợ người dùng: email tài khoản đang đăng nhập hoặc một Google Group công ty quản lý.
3. Khi đưa lên môi trường thật cho người ngoài công ty: trang chủ, trang chính sách quyền riêng tư, trang điều khoản trên tên miền công ty sở hữu.

### 4.3. Các bước

Phần A. Tạo dự án và màn hình đồng ý (consent screen):

1. Vào https://console.cloud.google.com, tạo dự án mới tên "VComm".
2. Vào Google Auth Platform (mục OAuth consent screen), bấm bắt đầu cấu hình.
3. Điền tên ứng dụng (không gây nhầm với Google hoặc thương hiệu khác) và email hỗ trợ người dùng.
4. Chọn đối tượng người dùng (Audience):
   - Internal: chỉ tài khoản trong tổ chức Google Workspace của công ty đăng nhập được. Chọn nếu VComm chỉ dành cho nhân viên công ty.
   - External: mọi tài khoản Google đăng nhập được. Khi ở trạng thái Testing, chỉ người thử nghiệm được thêm vào danh sách đăng nhập được.
5. Điền email liên hệ nhà phát triển (Google gửi thông báo thay đổi đến đây).
6. Ở mục Branding, thêm tên miền được phép (Authorized domains) trước khi thêm địa chỉ chuyển hướng của môi trường thử nghiệm, thật.
7. Ở mục Data Access, thêm các quyền `openid`, `email`, `profile`.

Phần B. Tạo mã khách (OAuth client):

1. Vào https://console.cloud.google.com/apis/credentials (mục Clients).
2. Bấm Create Client, chọn loại Web application, đặt tên "VComm Web".
3. Ở Authorized redirect URIs, thêm các địa chỉ ở mục 3.5.
4. Bấm Create.
5. Sao chép Client ID và Client Secret ngay. Tải tệp `client_secret.json` về nơi an toàn. Mã bí mật chỉ hiển thị đầy đủ một lần.

Giới hạn theo tên miền Workspace của công ty:

1. Cách chắc chắn nhất ở phía tài khoản: chọn Internal ở bước A4.
2. Chọn External: VComm vẫn chỉ nhận email đã được mời làm nhân viên.

### 4.4. Nhập vào VComm

Màn hình Cài đặt tích hợp, nhóm "Google":

| Giá trị | Bí mật | Ô nhập |
|---|---|---|
| Client ID | Không | Client ID |
| Client Secret | Có | Client secret |

Chọn Internal hay External: VComm chỉ cho đăng nhập khi email Google trùng email nhân viên đã được mời, nên chọn External cũng không cho người ngoài vào. Chọn Internal nếu mọi nhân viên dùng Google Workspace của công ty.


### 4.5. Địa chỉ chuyển hướng cần khai báo

- Máy phát triển: `http://localhost:3000/api/v1/auth/oauth/google/callback`
- Thử nghiệm: `https://<tên miền thử nghiệm>/api/v1/auth/oauth/google/callback`
- Thật: `https://<tên miền thật>/api/v1/auth/oauth/google/callback`

Địa chỉ đúng của từng môi trường hiện sẵn trên màn hình Cài đặt tích hợp (lấy theo biến `WEB_ORIGIN`), sao chép từ đó để tránh gõ sai.

Lưu ý: địa chỉ phải khớp tuyệt đối (giao thức, chữ hoa thường, dấu `/` cuối). Chỉ `localhost` được dùng `http`, các địa chỉ khác bắt buộc `https`, không dùng địa chỉ IP.

### 4.6. Thời gian và chi phí

- Tạo mã khách: làm xong trong khoảng 15 đến 30 phút (ước lượng, không phải số liệu chính thức).
- Ứng dụng External muốn hiện tên, biểu tượng trên màn hình đồng ý phải qua xác minh thương hiệu. Sau khi đạt, phải công bố trong 7 ngày, nếu không phải xác minh lại.
- Chi phí: trang hướng dẫn chính thức không nêu phí.

### 4.7. Nguồn chính thức

- https://developers.google.com/identity/protocols/oauth2/web-server
- https://developers.google.com/identity/openid-connect/openid-connect
- https://support.google.com/cloud/answer/10311615

## 5. Microsoft Entra ID (Đăng nhập bằng Microsoft)

### 5.1. Dùng để làm gì trong VComm

- Cho nhân viên đăng nhập bằng tài khoản Microsoft 365 của công ty. Kích hoạt tài khoản bằng Microsoft cũng dùng ứng dụng này.

### 5.2. Điều kiện trước

1. Một tài khoản Microsoft có quyền tối thiểu Application Developer trong thư mục (tenant) của công ty.
2. Nếu công ty dùng Microsoft 365, dùng tenant của công ty. Nếu chưa có, có thể dùng Default Directory khi tạo tài khoản Azure.

### 5.3. Các bước

Phần A. Đăng ký ứng dụng:

1. Đăng nhập https://entra.microsoft.com.
2. Nếu có nhiều tenant, bấm biểu tượng Settings để chuyển sang tenant của công ty.
3. Vào Entra ID → App registrations → New registration.
4. Đặt tên "VComm" (người dùng sẽ thấy tên này, đổi được sau).
5. Chọn Supported account types:
   - Single tenant only: chỉ tài khoản trong tenant công ty. Microsoft khuyến nghị cho đa số ứng dụng. Chọn nếu VComm chỉ dành cho nhân viên công ty.
   - Multiple Entra ID tenants: tài khoản công việc của mọi tổ chức dùng Entra ID.
   - Any Entra ID Tenant + Personal Microsoft accounts: thêm cả tài khoản cá nhân (Outlook, Hotmail, Xbox).
   - Personal accounts only: chỉ tài khoản cá nhân.
6. Bấm Register. Lưu ý: không chuyển được ứng dụng sang tenant khác sau khi tạo.
7. Ở trang Overview, sao chép Application (client) ID và Directory (tenant) ID.

Phần B. Khai báo địa chỉ chuyển hướng:

1. Vào Authentication → Add a platform → Web.
2. Thêm các địa chỉ ở mục 4.5, bấm Configure hoặc Save.

Phần C. Tạo mã bí mật (client secret):

1. Vào Certificates & secrets → Client secrets → New client secret.
2. Nhập mô tả, ví dụ "VComm thử nghiệm 2026".
3. Chọn thời hạn. Tối đa 24 tháng, Microsoft khuyến nghị dưới 12 tháng.
4. Bấm Add.
5. Sao chép cột Value ngay. Giá trị này không hiển thị lại sau khi rời trang.
6. Ghi ngày hết hạn vào lịch, nhắc tạo mã mới trước hạn ít nhất 2 tuần và gửi lại lập trình viên.

Lưu ý: VComm hiện dùng client secret; Microsoft khuyến nghị chứng chỉ (certificate) cho môi trường thật, có thể đổi sau.

### 5.4. Nhập vào VComm

Màn hình Cài đặt tích hợp, nhóm "Microsoft":

| Giá trị | Bí mật | Ô nhập |
|---|---|---|
| Application (client) ID | Không | Application (client) ID |
| Client secret Value | Có | Client secret |
| Directory (tenant) ID hoặc tên miền công ty | Không | Tenant |

Nên nhập tenant của công ty (mã GUID ở trang Overview, hoặc tên miền như `luckyshop.vn`). Khi đó lần đầu đăng nhập, VComm tự gắn tài khoản Microsoft với nhân viên cùng email. Để trống thì VComm dùng `organizations` (mọi tổ chức) và nhân viên phải liên kết Microsoft ở Hồ sơ cá nhân trước.

Ghi ngày hết hạn client secret vào lịch; tạo mã mới trước hạn, nhập lại ở Cài đặt tích hợp.


### 5.5. Địa chỉ chuyển hướng cần khai báo

- Máy phát triển: `http://localhost:3000/api/v1/auth/oauth/microsoft/callback`
- Thử nghiệm: `https://<tên miền thử nghiệm>/api/v1/auth/oauth/microsoft/callback`
- Thật: `https://<tên miền thật>/api/v1/auth/oauth/microsoft/callback`

Địa chỉ đúng của từng môi trường hiện sẵn trên màn hình Cài đặt tích hợp (lấy theo biến `WEB_ORIGIN`), sao chép từ đó để tránh gõ sai.

### 5.6. Thời gian và chi phí

- Đăng ký: làm xong trong khoảng 15 đến 30 phút (ước lượng, không phải số liệu chính thức).
- Chi phí đăng ký ứng dụng: trang hướng dẫn chính thức không nêu phí.

### 5.7. Nguồn chính thức

- https://learn.microsoft.com/en-us/entra/identity-platform/quickstart-register-app
- https://learn.microsoft.com/en-us/entra/identity-platform/how-to-add-credentials

## 6. Lưu tệp đính kèm (AWS S3)

### 6.1. Dùng để làm gì trong VComm

- Lưu tệp đính kèm của đề xuất. Môi trường thật bắt buộc dùng S3; lưu trên máy chủ (`STORAGE_DRIVER=local`) thì tệp mất khi thay máy chủ.

### 6.2. Các bước (khi đã chọn hạ tầng)

1. Tạo bucket S3 riêng cho mỗi môi trường, ví dụ `vcomm-thu-nghiem-tep`, `vcomm-that-tep`, vùng `ap-southeast-1` (Singapore).
2. Bật **Block all public access** (tệp chỉ tải qua VComm sau khi kiểm quyền), bật mã hóa mặc định.
3. Cấp cho máy chủ API quyền IAM tối thiểu trên bucket: `s3:PutObject`, `s3:GetObject`, `s3:DeleteObject`.
4. Đặt biến môi trường của máy chủ API: `STORAGE_DRIVER=s3`, `S3_BUCKET=<tên bucket>`, `AWS_REGION=ap-southeast-1`. Việc này lập trình viên làm khi triển khai.

## 7. Bảng kiểm tra cuối

| Dịch vụ | Việc người dùng làm | Nhập ở Cài đặt tích hợp | Kiểm tra |
|---|---|---|---|
| eSMS, SMS Brandname | Tạo tài khoản, lấy ApiKey, SecretKey, đăng ký Brandname và mẫu SMS OTP, nạp tiền | API key, Secret key, Brandname | Kiểm tra kết nối; Gửi thử tin nhận được SMS |
| Zalo OA, ZNS | Tạo, xác thực OA, liên kết với eSMS, đăng ký 4 mẫu ZNS | Mã OA, 4 mã mẫu | OA hiện khi kiểm tra kết nối; Gửi thử tin nhận được Zalo |
| Đăng nhập Zalo | Tạo ứng dụng, bật Đăng nhập, khai báo địa chỉ chuyển hướng | App ID, Secret Key | Liên kết Zalo ở Hồ sơ cá nhân, rồi đăng nhập bằng Zalo |
| Đăng nhập Google | Tạo dự án, màn hình đồng ý, mã khách Web application, địa chỉ chuyển hướng | Client ID, Client Secret | Đăng nhập bằng Google với email nhân viên |
| Đăng nhập Microsoft | Đăng ký ứng dụng, địa chỉ chuyển hướng, client secret | Client ID, Client secret, tenant | Đăng nhập bằng Microsoft với email nhân viên |
| AWS S3 | Tạo bucket, quyền IAM | Không (biến môi trường máy chủ) | Đính kèm tệp vào đề xuất, tải lại được |

Trước khi đánh dấu xong mỗi dòng:

1. Khóa bí mật chỉ nhập trực tiếp vào Cài đặt tích hợp, không gửi qua tin nhắn.
2. Đã khai báo địa chỉ chuyển hướng cho đúng môi trường (sao chép từ Cài đặt tích hợp).
3. Đã ghi ngày hết hạn (client secret Microsoft, hợp đồng eSMS) vào lịch.
4. Đã thử theo cột Kiểm tra; lỗi gửi tin xem ở bảng Tin gửi gần đây. Báo lập trình viên nếu không đạt.
