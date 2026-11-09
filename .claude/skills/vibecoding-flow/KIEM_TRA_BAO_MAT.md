# QUY TRÌNH KIỂM TRA BẢO MẬT

Chi tiết của mục 17 trong [SKILL.md](SKILL.md). Số "mục" trong tệp này là số mục của SKILL.md.

Phần nào áp dụng khi nào, nơi ghi kết quả và cổng bảo mật: xem mục 17.

**Mức độ lỗ hổng**
- Nghiêm trọng: truy cập trái phép dữ liệu hoặc hệ thống mà không cần đăng nhập; lộ khóa bí mật; chèn mã thực thi được.
- Cao: vượt quyền giữa các vai trò hoặc giữa người dùng; lộ dữ liệu cá nhân; thư viện có lỗ hổng Nghiêm trọng hoặc Cao đã công bố.
- Trung bình: thiếu header bảo mật, thiếu giới hạn số lần thử, thông báo lỗi lộ thông tin kỹ thuật.
- Thấp: cấu hình chưa tối ưu, không trực tiếp khai thác được.

**A. Thiết kế** (giai đoạn 05, 07)
1. Liệt kê dữ liệu nhạy cảm: mật khẩu, dữ liệu cá nhân, dữ liệu tài chính, khóa bí mật. Xác định cách lưu trữ và người được truy cập.
2. Liệt kê điểm tiếp nhận dữ liệu từ bên ngoài: biểu mẫu, API, tải tệp lên, liên kết với hệ thống khác.
3. Xác định cách xác thực, thời hạn phiên đăng nhập, ma trận phân quyền theo tài liệu `08`.
4. Ghi vào tài liệu `22`, trình người dùng phê duyệt cùng kiến trúc.

**B. Lập trình** (thực hiện cùng danh sách tự rà soát mã trong [QUY_UOC_GIT.md](QUY_UOC_GIT.md))
1. Mật khẩu băm bằng thuật toán chuyên dụng (bcrypt, Argon2); không lưu dạng có thể giải ngược.
2. Mọi truy vấn cơ sở dữ liệu dùng tham số hóa hoặc ORM; không ghép chuỗi.
3. Dữ liệu đầu vào kiểm tra phía máy chủ: kiểu, độ dài, định dạng, giá trị cho phép.
4. Dữ liệu hiển thị ra giao diện được mã hóa ký tự đặc biệt, chống chèn mã.
5. Mỗi API kiểm tra xác thực và quyền; kiểm tra người dùng chỉ truy cập được dữ liệu của mình.
6. Tải tệp lên: giới hạn loại tệp, kích thước; đổi tên tệp; không lưu trong thư mục chạy được mã.
7. Đăng nhập và thao tác nhạy cảm có giới hạn số lần thử.
8. Khóa bí mật đọc từ biến môi trường hoặc kho khóa bí mật; không nằm trong mã, tệp cấu hình được commit, log.
9. Thông báo lỗi cho người dùng không chứa thông tin kỹ thuật; chi tiết chỉ ghi vào log.

**C. Kiểm thử** (mục 7)

Phạm vi: C1, C2 luôn chạy. C3 đến C6 chỉ cho phần mà thay đổi của công việc chạm tới (API, quyền, dữ liệu đầu vào, phiên đăng nhập); điểm không bị chạm ghi "Không áp dụng" kèm lý do.

1. Chạy công cụ quét thư viện phụ thuộc của ngôn ngữ đang dùng (ví dụ `npm audit`, `pip-audit`, `dotnet list package --vulnerable`).
2. Chạy công cụ quét khóa bí mật (ví dụ `gitleaks`) trên mã nguồn hiện tại và các commit của công việc (từ điểm tách khỏi `main`). Quét toàn bộ lịch sử Git khi bắt đầu áp dụng quy trình cho dự án và định kỳ ở phần E. Khóa đã thu hồi nhưng còn trong lịch sử: ghi vào bảng quản lý khóa bí mật trong tài liệu `22` với trạng thái "Đã thu hồi", cấu hình công cụ bỏ qua đúng các phát hiện đó. Công cụ chưa có thì đề xuất cài, chờ người dùng đồng ý.
3. Kiểm thử phân quyền: gọi trực tiếp API khi chưa đăng nhập; với từng vai trò, gọi API của vai trò khác và dữ liệu của người dùng khác. Kết quả phải bị từ chối.
4. Kiểm thử dữ liệu đầu vào độc hại: chuỗi chèn truy vấn, chuỗi chèn mã, tệp sai loại, dữ liệu vượt độ dài.
5. Kiểm thử phiên đăng nhập: hết hạn, đăng xuất, dùng lại phiên cũ; giới hạn số lần thử của đăng nhập và thao tác nhạy cảm.
6. Đối chiếu với 10 nhóm lỗ hổng phổ biến (OWASP Top 10), ghi nhóm nào đã kiểm tra, nhóm nào không áp dụng.

**D. Trước triển khai** (mục 8)
1. Chạy lại bước C1 trên đúng commit đã gắn tag. Chạy bước C2 trên các commit giữa lần quét ở phần C và commit đã gắn tag. Lỗ hổng Nghiêm trọng, Cao chưa xử lý thì không đạt cổng triển khai.
2. Môi trường đích: bắt buộc HTTPS; tắt chế độ gỡ lỗi; không hiển thị trang lỗi chi tiết.
3. Có header bảo mật: Content-Security-Policy, Strict-Transport-Security, X-Content-Type-Options, X-Frame-Options; cookie phiên đặt HttpOnly, Secure, SameSite.
4. Tài khoản cơ sở dữ liệu của ứng dụng chỉ có quyền tối thiểu cần thiết; không dùng tài khoản quản trị.
5. Khóa bí mật của môi trường thật khác môi trường phát triển và thử nghiệm.
6. Chỉ mở các cổng mạng cần thiết.

**E. Vận hành** (giai đoạn 13)
1. Định kỳ chạy lại bước C1 và quét khóa bí mật trên toàn bộ lịch sử Git. Lỗ hổng mới mức Nghiêm trọng hoặc Cao: báo người dùng ngay. Vào luồng khẩn cấp hay không do điều kiện áp dụng của mục 13 quyết định; không đủ điều kiện thì xử lý theo chu trình mục 6 với ưu tiên cao nhất.
2. Cập nhật bản vá bảo mật của framework, thư viện, hệ điều hành theo quy trình quản lý thay đổi.
3. Theo dõi log: đăng nhập thất bại hàng loạt, truy cập bị từ chối bất thường, lưu lượng bất thường.
4. Kiểm tra bản sao lưu được mã hóa hoặc được bảo vệ quyền truy cập.
5. Rà lại các rủi ro người dùng đã chấp nhận trong tài liệu `22`; rủi ro hết thời hạn thì báo người dùng.

**Ứng phó sự cố bảo mật** (lộ khóa bí mật, lộ dữ liệu, bị truy cập trái phép)

1. Báo người dùng ngay, không chờ hoàn tất phân tích.
2. Ngăn chặn: khóa bí mật bị lộ thì đề xuất thu hồi và tạo khóa mới ngay, thực hiện khi người dùng đồng ý. Khóa đã từng commit vào Git thì coi là đã lộ, kể cả khi đã xóa khỏi mã.
3. Xác định dữ liệu, người dùng và khoảng thời gian bị ảnh hưởng.
4. Không xóa log, dữ liệu liên quan đến sự cố.
5. Ghi biên bản sự cố vào tài liệu `22` (phần 7 của mẫu) và tài liệu `02`. Nghĩa vụ thông báo cho người dùng cuối hoặc cơ quan quản lý do người dùng quyết định.
6. Sự cố cần sửa mã: cấp mã `LOI_<số>` theo mục 4 (quy trình khẩn cấp dùng lại mã này), chọn luồng theo điều kiện áp dụng của mục 13 (đủ điều kiện thì theo quy trình khẩn cấp, không đủ thì theo mục 6). Sự cố không cần sửa mã (ví dụ chỉ thay khóa) thì không đi qua quy trình sửa lỗi.

**Cổng bảo mật:** xem mục 17 trong [SKILL.md](SKILL.md).
