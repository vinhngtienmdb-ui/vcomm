# ĐIỂM XEM TRƯỚC

Chi tiết của nguyên tắc 17 tại mục 2 trong [SKILL.md](SKILL.md). Số "mục" trong tệp này là số mục của SKILL.md.

Mục đích: người dùng thấy giao diện và chức năng ngay trong lúc AI làm, phát hiện sai khi phần sai còn nhỏ, không phải chờ tới nghiệm thu cuối.

## 1. Chia công việc thành lát

- Mỗi lát là một phần chạy được từ đầu đến cuối mà người dùng xem hoặc thử được. Ví dụ: "màn hình danh sách học sinh hiển thị dữ liệu giả", không phải "xong phần cơ sở dữ liệu".
- Thứ tự ưu tiên: lát giúp người dùng kiểm tra sớm nhất điều dễ hiểu sai nhất (luồng thao tác, bố cục, quy tắc nghiệp vụ chính).
- Được dùng dữ liệu giả hoặc API giả ở lát đầu, miễn là nói rõ phần nào còn giả.

Số điểm xem trước theo mức:

| Mức | Điểm xem trước |
|---|---|
| Nhỏ | Một điểm, sau khi sửa xong |
| Vừa | Sau mỗi màn hình hoặc mỗi chức năng |
| Lớn | Sau mỗi lát |

Danh sách lát và điểm xem trước ghi vào đặc tả công việc (mức Nhỏ: cột Ghi chú của tài liệu `03`), trình người dùng duyệt ở bước 3 của mục 6.

## 2. Cách cho người dùng xem

Chọn theo thứ tự, dùng cách đầu tiên làm được:

1. **Có giao diện:** chạy máy chủ phát triển theo lệnh trong tài liệu `18`, mở ứng dụng trong trình duyệt tích hợp của công cụ đang dùng (ví dụ khung Browser của Claude desktop, cấu hình trong `.claude/launch.json`) để người dùng tự bấm thử. Kèm đường dẫn `localhost` để mở trên máy và ảnh chụp các màn hình chính.
2. **Không có giao diện** (API, xử lý nền, báo cáo): đưa lệnh gọi thử hoặc trang thử API, kèm kết quả thực tế đã chạy.
3. **Không chạy được trên máy:** đưa ảnh chụp, kết quả chạy kiểm thử, và lệnh để người dùng tự chạy. Nêu rõ lý do không chạy được.

Ảnh chụp và tệp kết quả đặt trong `tam_thoi/<mã>/` theo danh sách dọn dẹp.

## 3. Nội dung trình ở mỗi điểm xem trước

- Đã làm gì trong lát này (một đến hai câu).
- Cần xem gì và thử thao tác nào (tối đa ba việc cụ thể).
- Phần nào còn là dữ liệu giả hoặc chưa làm.
- Kết quả kiểm thử của lát (đạt, chưa đạt).

## 4. Sau khi trình

- Dừng, chờ người dùng phản hồi rồi mới làm lát tiếp theo.
- Người dùng chỉ ra sai: sửa ngay trong lát đó, trình lại. Sai do hiểu sai yêu cầu đã duyệt thì theo mục 9.
- Người dùng cho phép làm tiếp mà không chờ (ghi quyết định vào tài liệu `02`): AI làm các lát còn lại, vẫn trình kết quả từng lát, và dừng hẳn ở điểm xem trước cuối.
- Phản hồi ở điểm xem trước không thay cho nghiệm thu; nghiệm thu vẫn theo mục 10 và bước 8 của mục 6.

## 5. Chuẩn bị một lần cho mỗi dự án

Ở giai đoạn 08 (hoặc lần đầu áp dụng quy trình cho dự án có sẵn):

- Ghi vào tài liệu `18`: lệnh chạy máy chủ phát triển, cổng, tài khoản thử cho từng vai trò, cách nạp dữ liệu giả.
- Tạo `.claude/launch.json` cho máy chủ phát triển nếu công cụ đang dùng hỗ trợ trình duyệt tích hợp. Hỏi người dùng trước khi thêm tệp này vào kho mã.
