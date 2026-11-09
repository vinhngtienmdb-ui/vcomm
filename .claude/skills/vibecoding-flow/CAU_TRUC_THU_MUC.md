# CẤU TRÚC THƯ MỤC

Chi tiết của nguyên tắc 18 tại mục 2 trong [SKILL.md](SKILL.md). Số "mục" trong tệp này là số mục của SKILL.md.

Mục đích: AI đặt mỗi tệp vào đúng thư mục chịu trách nhiệm, không rải tệp ra gốc dự án, để dự án dễ tìm, dễ sửa và mở rộng được.

## 1. Thư mục gốc

Chỉ chứa:

- Các thư mục: mã nguồn theo tài liệu `12`, `tai_lieu/`, `tam_thoi/` (được Git bỏ qua).
- `CLAUDE.md` (và `AGENTS.md` nếu dùng thêm công cụ AI khác).
- Tệp mà công cụ bắt buộc đặt ở gốc: `.gitignore`, `README.md`, `.github/`, tệp cấu hình gói hoặc monorepo, `docker-compose.yml`, `.env.example`.

Quy tắc:

- Không tạo tệp mới ở gốc. Tệp cấu hình công cụ bắt buộc ở gốc: hỏi người dùng trước, nêu lý do.
- Tài liệu, ghi chú, báo cáo đặt trong `tai_lieu/` (mục 4). Log, script thử, ảnh chụp đặt trong `tam_thoi/` (nguyên tắc 16).
- Dự án có sẵn mà gốc đã có tệp khác: giữ nguyên, không tự di chuyển; liệt kê và hỏi người dùng nếu muốn sắp xếp lại.

## 2. Cấu trúc thư mục mã nguồn

- Thiết kế ở giai đoạn 05, ghi trong tài liệu `12` mục "Cấu trúc thư mục": cây thư mục, mỗi thư mục làm gì và không làm gì. Người dùng duyệt cùng kiến trúc.
- Chọn cách chia phù hợp quy mô, nêu lý do trong tài liệu `12`:
  - Theo phần của hệ thống (`frontend/`, `backend/`, `mobile/`…) khi các phần chạy và triển khai riêng.
  - Theo module nghiệp vụ bên trong mỗi phần (ví dụ `backend/thanh_toan/`, `frontend/thanh_toan/`), tên khớp danh sách module trong tài liệu `01`.
- Chỉ tạo thư mục khi có mã cần đặt vào (nguyên tắc 15). Không tạo sẵn thư mục rỗng cho phần chưa làm.
- Dự án có sẵn: ghi lại cấu trúc hiện có vào tài liệu `12` và làm theo cấu trúc đó.

## 3. Khi làm công việc

- Trước khi tạo tệp: xác định thư mục theo tài liệu `12`. Không có chỗ phù hợp: dừng lại, đề xuất vị trí, chờ người dùng xác nhận.
- Thêm thư mục mới ở cấp phần hoặc module, di chuyển, đổi tên thư mục là thay đổi kiến trúc: theo nguyên tắc 5 tại mục 2 và cập nhật tài liệu `12`.
- Mã của một phần không đặt trong thư mục của phần khác (ví dụ không viết API trong `frontend/`).

## 4. Quy tắc riêng cho từng phần

Áp dụng khi dự án có từ hai phần chạy riêng trở lên (ví dụ frontend và backend). Thiết lập ở giai đoạn 08.

- Mỗi phần có `CLAUDE.md` ngắn ở thư mục của phần đó: phần này làm gì, không làm gì, lệnh chạy và kiểm thử của phần. Claude Code tự nạp tệp này khi làm việc với tệp trong thư mục đó.
- Mỗi quy tắc chỉ ghi ở một chỗ: quy tắc chung ở `CLAUDE.md` gốc hoặc tài liệu `18`, quy tắc riêng ở `CLAUDE.md` của phần. Không lặp lại nội dung, không tạo thư mục riêng chứa quy tắc cho các phần.
- Dùng thêm công cụ AI đọc `AGENTS.md`: viết quy tắc trong `AGENTS.md`, `CLAUDE.md` cùng thư mục chỉ chứa dòng `@AGENTS.md`.
