# 28. HƯỚNG DẪN ĐĂNG KÝ DỊCH VỤ NGOÀI
- Mô tả: Hướng dẫn chủ dự án đăng ký tài khoản Zalo, Google, Microsoft và tin nhắn thương hiệu để gửi thông tin cấu hình cho lập trình viên.
- Phiên bản: 0.1
- Ngày cập nhật: 2026-11-09
- Trạng thái: Bản nháp

## 0. Quy tắc chung

1. Mỗi dịch vụ cần đăng ký bằng tài khoản của công ty, không dùng tài khoản cá nhân của nhân viên sắp nghỉ việc.
2. Ghi lại tài khoản quản trị, người giữ mật khẩu và ngày hết hạn (nếu có) vào sổ quản lý của công ty.
3. Giá trị bí mật (mã bí mật, Secret Key, Client Secret) chỉ gửi cho lập trình viên qua kênh an toàn: trình quản lý mật khẩu dùng chung của công ty hoặc liên kết tự hủy sau một lần xem.
4. Không gửi giá trị bí mật qua tin nhắn Zalo, Messenger, email thường, không chụp màn hình gửi nhóm chat, không đưa vào Git.
5. Mã ứng dụng (App ID, Client ID) không phải bí mật, có thể gửi qua kênh thường.
6. Mỗi môi trường (máy phát triển, thử nghiệm, thật) nên có địa chỉ chuyển hướng riêng. Khi có tên miền thật, thay phần `<tên miền thử nghiệm>` và `<tên miền thật>` trong tài liệu này.
7. Chi tiết ghi "chưa xác minh" là chi tiết chưa đọc được trên trang chính thức (trang Zalo hiển thị bằng JavaScript). Khi làm thực tế, đối chiếu lại trên trang và báo lập trình viên nếu khác.

Các biến hiện có trong `.env.example`: `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `MICROSOFT_CLIENT_ID`, `MICROSOFT_CLIENT_SECRET`, `ZALO_APP_ID`, `ZALO_APP_SECRET`, `SMS_DRIVER`. Biến cho ZNS, tin nhắn thương hiệu và mã thư mục Microsoft chưa có; lập trình viên sẽ bổ sung khi tích hợp.

## 1. Zalo Official Account (OA) và Zalo ZNS

### 1.1. Dùng để làm gì trong VComm

- Gửi mã OTP qua Zalo đến số điện thoại người dùng (lát L6).
- Gửi liên kết kích hoạt tài khoản qua Zalo thay cho SMS (lát L4).
- Trang giá hiện gọi dịch vụ này là "ZBS Template Message" (tên cũ ZNS).

### 1.2. Điều kiện trước

1. Một tài khoản Zalo cá nhân của người đại diện, dùng để đăng nhập ZBS và Zalo for Developers.
2. Giấy chứng nhận đăng ký kinh doanh của công ty (để xác thực OA).
3. Thông tin doanh nghiệp: tên công ty, mã số thuế, địa chỉ, tên người đại diện, số điện thoại, email liên hệ. Tên người đại diện phải khớp căn cước công dân, sai thông tin có thể làm hóa đơn bị hủy.
4. Người đăng ký phải là quản trị viên OA, và OA phải được xác thực.
5. Số điện thoại dùng tạo tài khoản ZBS chưa từng là quản trị viên cấp cao nhất của tài khoản ZBS khác.

### 1.3. Các bước

Phần A. Tạo và xác thực OA (trang https://oa.zalo.me):

1. Đăng nhập https://oa.zalo.me bằng tài khoản Zalo của người đại diện.
2. Tạo OA, đặt tên OA trùng hoặc liên quan rõ đến tên trên giấy đăng ký kinh doanh.
3. Vào mục xác thực OA, tải lên giấy đăng ký kinh doanh và điền thông tin khớp với giấy tờ.
4. Chờ kết quả duyệt.

Chi tiết chưa xác minh trên trang chính thức (chỉ thấy ở trang bên thứ ba): bộ hồ sơ theo từng trường hợp tên OA, thời hạn 14 ngày phải nộp hồ sơ xác thực, thời gian duyệt khoảng 7 ngày, phí xác thực OA.

Phần B. Đăng ký ZBS và mẫu tin xác thực (trang https://zalo.solutions):

1. Đăng nhập ZBS bằng tài khoản Zalo cá nhân, đặt tên tài khoản không dấu, không ký tự đặc biệt. Tên này không đổi được sau khi tạo.
2. Điền thông tin doanh nghiệp, chọn OA, đồng ý điều khoản.
3. Vào Cài đặt → Quản lý tài sản → thẻ Liên kết OA, liên kết OA đã xác thực.
4. Tạo ứng dụng trên https://developers.zalo.me và kích hoạt (có thể dùng chung ứng dụng ở mục 2).
5. Vào Cài đặt → Quản lý tài sản → thẻ Liên kết ứng dụng, liên kết ứng dụng ở bước 4. Tài khoản Zalo phải là quản trị viên của cả OA và ứng dụng.
6. Cấp quyền OA cho ứng dụng để lập trình viên lấy mã truy cập (access token). Bước này lập trình viên có thể làm cùng chủ dự án.
7. Vào Công cụ → Dịch vụ tin nhắn → Tạo mẫu, tạo mẫu tin loại "xác thực" chứa mã OTP, gửi duyệt.
8. Theo dõi trạng thái mẫu ở Thiết kế nội dung → Quản lý mẫu.
9. Nạp tiền vào tài khoản ZBS.

Quy định duyệt mẫu cần nhớ khi soạn mẫu xác thực:

1. Tiếng Việt có dấu, không lỗi chính tả, không viết tắt, không biểu tượng cảm xúc, không trộn ngôn ngữ.
2. Không đặt liên kết hoặc số điện thoại trong nội dung, phải đặt ở nút thao tác.
3. Tham số đặt trong `< >`, không dấu, nối bằng dấu gạch dưới, ví dụ `<ma_xac_thuc>`.
4. Mẫu chứa mã xác thực gắn nhãn Tag 1 – Giao dịch.
5. Gửi mã xác thực cho khách tạo tài khoản mới là trường hợp duy nhất được gửi khi chưa có giao dịch trước.
6. Mẫu cần tên khách hàng hoặc một tham số cá nhân. Nếu không có, cần ít nhất ba tham số định danh phù hợp.

Cần tạo ít nhất hai mẫu: mẫu mã OTP (L6) và mẫu liên kết kích hoạt tài khoản (L4). Nội dung chi tiết lập trình viên sẽ gửi.

### 1.4. Giá trị gửi lại lập trình viên

| Giá trị | Bí mật | Biến trong `.env` |
|---|---|---|
| Mã OA (OA ID) | Không | Chưa có biến |
| Mã từng mẫu đã duyệt (Template ID) và danh sách tham số | Không | Chưa có biến |
| Mã ứng dụng đã liên kết | Không | `ZALO_APP_ID` (nếu dùng chung ứng dụng mục 2) |
| Mã bí mật ứng dụng | Có | `ZALO_APP_SECRET` |
| Quyền quản trị viên ứng dụng cho lập trình viên (để lấy access token) | Không | Không áp dụng |

### 1.5. Địa chỉ chuyển hướng

Bước cấp quyền OA cho ứng dụng cần một địa chỉ chuyển hướng (callback) khai báo trong ứng dụng Zalo. Đường dẫn cụ thể: chưa xác minh, lập trình viên sẽ cung cấp khi làm bước 6.

### 1.6. Thời gian và chi phí

- Giá mẫu xác thực: 300 đồng một tin, chỉ tính tin xử lý thành công, chưa gồm thuế giá trị gia tăng.
- Nút thao tác: nút đầu tiên miễn phí, từ nút thứ hai 100 đồng mỗi nút.
- Thời gian duyệt mẫu: chưa xác minh (trang chính thức không nêu). Bộ phận hỗ trợ phản hồi trong 24 giờ làm việc.
- Phí xác thực OA: chưa xác minh.

### 1.7. Nguồn chính thức

- Bảng giá: https://zalo.solutions/zns/pricing
- Giới thiệu dịch vụ: https://zalo.solutions/zns
- Hướng dẫn đăng ký: https://zalo.solutions/blog/huong-dan-dang-ky-su-dung-dich-vu-zns/aeuzvbjag8amvmnnv8
- Quy định duyệt mẫu: https://zalo.solutions/news/quy-dinh-chung-khi-kiem-duyet-mau-tin-nhan-zbs/xdygqtrjjm97k28rsh07wr72
- Trang OA: https://oa.zalo.me

## 2. Ứng dụng Zalo cho Đăng nhập bằng Zalo

### 2.1. Dùng để làm gì trong VComm

- Cho người dùng đăng nhập VComm bằng tài khoản Zalo (lát L6).
- VComm dùng OAuth v4 của Zalo với PKCE, trang cấp quyền: `https://oauth.zaloapp.com/v4/permission`.

### 2.2. Điều kiện trước

1. Tài khoản Zalo của người đại diện công ty.
2. Nên dùng chung ứng dụng với mục 1 để quản lý tập trung (có thể tách nếu muốn).

### 2.3. Các bước

1. Đăng nhập https://developers.zalo.me bằng tài khoản Zalo.
2. Tạo ứng dụng mới, đặt tên "VComm", chọn danh mục phù hợp.
3. Kích hoạt ứng dụng.
4. Thêm sản phẩm Đăng nhập (Social API / Login) cho ứng dụng.
5. Khai báo địa chỉ chuyển hướng (callback) ở mục 2.5.
6. Mở trang cài đặt ứng dụng, sao chép mã ứng dụng (App ID) và mã bí mật (Secret Key).
7. Thêm tài khoản Zalo của lập trình viên làm quản trị viên hoặc người thử nghiệm ứng dụng.

Tên chính xác của các mục menu ở bước 3 đến bước 7: chưa xác minh (trang hiển thị bằng JavaScript).

### 2.4. Giá trị gửi lại lập trình viên

| Giá trị | Bí mật | Biến trong `.env` |
|---|---|---|
| Mã ứng dụng (App ID) | Không | `ZALO_APP_ID` |
| Mã bí mật (Secret Key) | Có | `ZALO_APP_SECRET` |

### 2.5. Địa chỉ chuyển hướng cần khai báo

- Máy phát triển: `http://localhost:4000/api/v1/auth/oauth/zalo/callback`
- Thử nghiệm: `https://<tên miền thử nghiệm>/api/v1/auth/oauth/zalo/callback`
- Thật: `https://<tên miền thật>/api/v1/auth/oauth/zalo/callback`

Zalo có chấp nhận địa chỉ `http://localhost` hay không: chưa xác minh. Nếu bị từ chối, báo lập trình viên để dùng địa chỉ thay thế.

### 2.6. Thời gian và chi phí

- Thời gian, chi phí tạo ứng dụng và dùng Đăng nhập bằng Zalo: chưa xác minh (không đọc được trang chính thức).

### 2.7. Nguồn chính thức

- Trang nhà phát triển: https://developers.zalo.me
- Tài liệu mã truy cập người dùng v4: https://developers.zalo.me/docs/social-api/tham-khao/user-access-token-v4 (chưa đọc được nội dung)

## 3. Google OAuth (Đăng nhập bằng Google)

### 3.1. Dùng để làm gì trong VComm

- Cho người dùng đăng nhập bằng tài khoản Google hoặc Google Workspace (lát L6).
- Quyền xin người dùng: `openid email profile` (định danh, email, tên và ảnh đại diện).

### 3.2. Điều kiện trước

1. Một tài khoản Google của công ty (nên là tài khoản Google Workspace nếu công ty dùng Workspace).
2. Email hỗ trợ người dùng: email tài khoản đang đăng nhập hoặc một Google Group công ty quản lý.
3. Khi đưa lên môi trường thật cho người ngoài công ty: trang chủ, trang chính sách quyền riêng tư, trang điều khoản trên tên miền công ty sở hữu.

### 3.3. Các bước

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
2. Nếu chọn External nhưng chỉ muốn cho email công ty: báo lập trình viên tên miền công ty (ví dụ `congty.vn`). Google yêu cầu ứng dụng tự kiểm tra trường `hd` trong mã định danh trả về, không dựa vào tham số `hd` trên trang đăng nhập.

### 3.4. Giá trị gửi lại lập trình viên

| Giá trị | Bí mật | Biến trong `.env` |
|---|---|---|
| Client ID | Không | `GOOGLE_CLIENT_ID` |
| Client Secret | Có | `GOOGLE_CLIENT_SECRET` |
| Lựa chọn Internal hay External, tên miền Workspace (nếu có) | Không | Chưa có biến |
| Danh sách email người thử nghiệm (nếu External, Testing) | Không | Không áp dụng |

### 3.5. Địa chỉ chuyển hướng cần khai báo

- Máy phát triển: `http://localhost:4000/api/v1/auth/oauth/google/callback`
- Thử nghiệm: `https://<tên miền thử nghiệm>/api/v1/auth/oauth/google/callback`
- Thật: `https://<tên miền thật>/api/v1/auth/oauth/google/callback`

Lưu ý: địa chỉ phải khớp tuyệt đối (giao thức, chữ hoa thường, dấu `/` cuối). Chỉ `localhost` được dùng `http`, các địa chỉ khác bắt buộc `https`, không dùng địa chỉ IP.

### 3.6. Thời gian và chi phí

- Tạo mã khách: làm xong trong khoảng 15 đến 30 phút (ước lượng, không phải số liệu chính thức).
- Ứng dụng External muốn hiện tên, biểu tượng trên màn hình đồng ý phải qua xác minh thương hiệu. Sau khi đạt, phải công bố trong 7 ngày, nếu không phải xác minh lại.
- Chi phí: trang hướng dẫn chính thức không nêu phí.

### 3.7. Nguồn chính thức

- https://developers.google.com/identity/protocols/oauth2/web-server
- https://developers.google.com/identity/openid-connect/openid-connect
- https://support.google.com/cloud/answer/10311615

## 4. Microsoft Entra ID (Đăng nhập bằng Microsoft)

### 4.1. Dùng để làm gì trong VComm

- Cho người dùng đăng nhập bằng tài khoản Microsoft 365 hoặc tài khoản Microsoft (lát L6).

### 4.2. Điều kiện trước

1. Một tài khoản Microsoft có quyền tối thiểu Application Developer trong thư mục (tenant) của công ty.
2. Nếu công ty dùng Microsoft 365, dùng tenant của công ty. Nếu chưa có, có thể dùng Default Directory khi tạo tài khoản Azure.

### 4.3. Các bước

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

Lưu ý: Microsoft khuyến nghị không dùng client secret cho môi trường thật mà dùng chứng chỉ (certificate). Lập trình viên sẽ quyết định trước khi lên môi trường thật.

### 4.4. Giá trị gửi lại lập trình viên

| Giá trị | Bí mật | Biến trong `.env` |
|---|---|---|
| Application (client) ID | Không | `MICROSOFT_CLIENT_ID` |
| Client secret Value | Có | `MICROSOFT_CLIENT_SECRET` |
| Directory (tenant) ID và loại tài khoản đã chọn | Không | Chưa có biến |
| Ngày hết hạn client secret | Không | Không áp dụng |

### 4.5. Địa chỉ chuyển hướng cần khai báo

- Máy phát triển: `http://localhost:4000/api/v1/auth/oauth/microsoft/callback`
- Thử nghiệm: `https://<tên miền thử nghiệm>/api/v1/auth/oauth/microsoft/callback`
- Thật: `https://<tên miền thật>/api/v1/auth/oauth/microsoft/callback`

### 4.6. Thời gian và chi phí

- Đăng ký: làm xong trong khoảng 15 đến 30 phút (ước lượng, không phải số liệu chính thức).
- Chi phí đăng ký ứng dụng: trang hướng dẫn chính thức không nêu phí.

### 4.7. Nguồn chính thức

- https://learn.microsoft.com/en-us/entra/identity-platform/quickstart-register-app
- https://learn.microsoft.com/en-us/entra/identity-platform/how-to-add-credentials

## 5. Tin nhắn thương hiệu (SMS brandname)

### 5.1. Dùng để làm gì trong VComm

- Phương án dự phòng gửi OTP khi người dùng không nhận được tin Zalo (lát L6).
- Gửi liên kết kích hoạt tài khoản qua SMS (lát L4).
- Máy phát triển hiện ghi SMS ra log, không gửi thật (`SMS_DRIVER=log`).

### 5.2. Điều kiện trước

1. Chọn tên thương hiệu hiển thị: theo nguồn tham khảo gồm 11 ký tự, không dùng ký tự đặc biệt như `@ % * #`. Ký tự phân cách cho phép khác nhau theo nhà mạng:
   - Viettel, Vinaphone, Gtel: khoảng trắng hoặc `.` `_` `-`.
   - Mobifone: chỉ `.` `_` `-`, không dùng khoảng trắng.
   - Vietnamobile: chỉ khoảng trắng.
2. Hồ sơ khi công ty tự dùng dịch vụ:
   - Công văn khai báo thương hiệu.
   - Giấy chứng nhận đăng ký kinh doanh hoặc quyết định thành lập.
   - Nếu tên thương hiệu là tên công ty: tên phải thể hiện trên giấy đăng ký kinh doanh hoặc quyết định thành lập.
   - Nếu tên thương hiệu là tên sản phẩm, dịch vụ hoặc tên miền (ví dụ "VComm"): giấy tờ hoặc ảnh chụp chứng minh quyền sử dụng.
3. Nếu đăng ký qua đại lý: thêm giấy ủy quyền theo chuỗi từ công ty đến đại lý và nhà cung cấp.

### 5.3. Các bước

1. Chưa chọn nhà cung cấp lúc này. Lập danh sách 2 đến 3 nhà cung cấp, xin báo giá theo số tin dự kiến mỗi tháng, loại tin chăm sóc khách hàng (không phải quảng cáo).
2. Hỏi nhà cung cấp: có API gửi tin không, có môi trường thử nghiệm không, có gửi được đủ các nhà mạng không.
3. Chọn một nhà cung cấp, ký hợp đồng.
4. Nộp hồ sơ ở mục 5.2 để nhà cung cấp khai báo thương hiệu với các nhà mạng.
5. Đăng ký mẫu tin OTP và mẫu tin liên kết kích hoạt theo yêu cầu của nhà cung cấp.
6. Nhận thông tin kết nối API, gửi lập trình viên.

### 5.4. Giá trị gửi lại lập trình viên

| Giá trị | Bí mật | Biến trong `.env` |
|---|---|---|
| Tên nhà cung cấp, đường dẫn tài liệu API | Không | `SMS_DRIVER` (lập trình viên đặt giá trị) |
| Tên thương hiệu đã duyệt | Không | Chưa có biến |
| Tên đăng nhập, mật khẩu hoặc khóa API | Có | Chưa có biến |
| Mẫu tin đã duyệt | Không | Chưa có biến |

### 5.5. Địa chỉ chuyển hướng

Không có. Nếu nhà cung cấp hỗ trợ báo trạng thái gửi tin (callback), lập trình viên sẽ cung cấp địa chỉ sau.

### 5.6. Thời gian và chi phí

- Thời gian khai báo thương hiệu: không quá 2 ngày trong mạng Viettel, không quá 5 ngày với mạng ngoài Viettel, tính từ khi nhận hồ sơ hoàn chỉnh, không tính cuối tuần, ngày lễ.
- Cước tin: khác nhau theo nhà mạng nhận tin và loại tin. Phải xin báo giá trước khi ký hợp đồng.

### 5.7. Nguồn

- https://viettelnet.vn/sms-brandname-viettel/ (trang đại lý, không phải trang chính thức của nhà mạng)

## 6. Bảng kiểm tra cuối

| Dịch vụ | Việc người dùng làm | Giá trị gửi lại | Biến trong .env | Chặn lát nào |
|---|---|---|---|---|
| Zalo OA | Tạo OA, xác thực bằng giấy đăng ký kinh doanh | Mã OA | Chưa có biến | L6, L4 |
| Zalo ZNS (ZBS) | Tạo tài khoản ZBS, liên kết OA và ứng dụng, tạo và chờ duyệt mẫu xác thực, nạp tiền | Mã mẫu, danh sách tham số, mã bí mật ứng dụng | Chưa có biến, `ZALO_APP_SECRET` | L6 (OTP), L4 (liên kết kích hoạt) |
| Đăng nhập Zalo | Tạo, kích hoạt ứng dụng trên developers.zalo.me, khai báo địa chỉ chuyển hướng | App ID, Secret Key | `ZALO_APP_ID`, `ZALO_APP_SECRET` | L6 |
| Đăng nhập Google | Tạo dự án, màn hình đồng ý, mã khách Web application, khai báo địa chỉ chuyển hướng | Client ID, Client Secret, Internal hay External | `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` | L6 |
| Đăng nhập Microsoft | Đăng ký ứng dụng, chọn loại tài khoản, khai báo địa chỉ chuyển hướng, tạo client secret | Client ID, tenant ID, client secret, ngày hết hạn | `MICROSOFT_CLIENT_ID`, `MICROSOFT_CLIENT_SECRET` | L6 |
| SMS thương hiệu | Chọn nhà cung cấp, nộp hồ sơ thương hiệu, đăng ký mẫu tin | Thông tin kết nối API, tên thương hiệu | `SMS_DRIVER`, chưa có biến cho khóa | L6, L4 |

Trước khi đánh dấu xong mỗi dòng:

1. Đã gửi giá trị bí mật qua kênh an toàn, không qua tin nhắn hoặc Git.
2. Đã khai báo đủ địa chỉ chuyển hướng cho máy phát triển.
3. Đã ghi ngày hết hạn (client secret Microsoft, mẫu tin, hợp đồng SMS) vào lịch.
4. Lập trình viên đã xác nhận đăng nhập thử hoặc gửi thử thành công.
