# QUY TRÌNH THIẾT KẾ GIAO DIỆN

Chi tiết của mục 15 trong [SKILL.md](SKILL.md). Số "mục" trong tệp này là số mục của SKILL.md.

Giao diện dựa trên nghiệp vụ và quyền người dùng, không dựa trên sở thích thẩm mỹ của AI. Bước nào áp dụng cho mức nào và quy tắc bản mẫu: xem mục 15.

Hình thức bản mẫu mặc định: HTML chạy được, mở bằng trình duyệt, dùng dữ liệu giả. Dự án dùng công cụ khác (ví dụ Figma) thì ghi vào tài liệu `18` và làm theo.

**06.1 Kiến trúc thông tin**

1. Lập danh sách màn hình từ tài liệu `10` và `09`. Mỗi màn hình có mã `MAN_HINH_<số>`.
2. Lập sơ đồ điều hướng: menu, đường đi giữa các màn hình, màn hình mở đầu của từng vai trò.
3. Lập bảng vai trò – màn hình theo tài liệu `08`: vai trò nào thấy màn hình nào, thao tác nào.
4. Trình người dùng duyệt: đủ màn hình, đúng luồng nghiệp vụ, đúng quyền.

**06.2 Khung giao diện (wireframe)**

5. Mỗi màn hình: bố cục, vùng nội dung, vị trí thành phần, thao tác chính. Chưa dùng màu, chỉ dùng thang xám.
6. Ghi đặc tả màn hình vào tài liệu `14` theo mẫu. Tên thành phần trong tài liệu `15` bổ sung sau bước 06.3; mã API trong tài liệu `17` bổ sung ở giai đoạn 07. Không tự đặt tên khi chưa có.
7. Trình người dùng duyệt bố cục và thao tác.

**06.3 Hệ thống thiết kế**

8. Hỏi người dùng nhận diện thương hiệu sẵn có: logo, màu, phông chữ. Không có thì đề xuất hai đến ba phương án để người dùng chọn.
9. Định nghĩa trong tài liệu `15`: bảng màu (màu chính, màu phụ, màu trạng thái thành công, cảnh báo, lỗi, thông tin), kiểu chữ, thang khoảng cách, bo góc, đổ bóng, điểm ngắt responsive, các thành phần dùng chung và trạng thái của chúng.
10. Màu chữ trên nền đạt tỷ lệ tương phản tối thiểu 4,5:1 cho chữ thường, 3:1 cho chữ lớn.
11. Phông chữ phải hiển thị đầy đủ tiếng Việt có dấu.
12. Trình người dùng duyệt phong cách. Sau khi duyệt, bổ sung tên thành phần vào đặc tả màn hình trong tài liệu `14`.

**06.4 Bản mẫu và phê duyệt**

13. Dựng bản mẫu trong `tai_lieu/ban_mau/` áp dụng tài liệu `15`, bấm được giữa các màn hình theo sơ đồ điều hướng.
14. Mỗi màn hình thể hiện đủ trạng thái: có dữ liệu, rỗng, đang tải, lỗi, không có quyền; thông báo thành công và thất bại.
15. Dữ liệu giả bằng tiếng Việt có dấu, gồm cả nội dung dài để kiểm tra tràn chữ.
16. Chạy danh sách rà soát giao diện bên dưới trên bản mẫu.
17. Trình người dùng bản mẫu kèm kết quả rà soát. Ghi quyết định duyệt vào tài liệu `02`, cập nhật trạng thái tài liệu `14`, `15` thành Đã phê duyệt.

**Khi lập trình giao diện**

- Chuyển các giá trị trong tài liệu `15` thành biến dùng chung trong mã (design token, biến CSS hoặc cấu hình theme của framework). Mã chỉ dùng các biến này.
- Thành phần dùng chung xây một lần, dùng lại ở mọi màn hình.
- Cần thành phần hoặc giá trị chưa có trong tài liệu `15`: dừng, đề xuất bổ sung tài liệu `15`, chờ người dùng duyệt.
- Giao diện thực tế khác bản mẫu đã duyệt: phải được người dùng đồng ý và cập nhật lại bản mẫu, tài liệu `14`.

**Danh sách rà soát giao diện**

1. Khớp bản mẫu và đặc tả tài liệu `14` đã duyệt. Mức Nhỏ ở dự án chưa có bản mẫu: khớp giao diện hiện tại, chỉ khác ở phần được sửa.
2. Chỉ dùng giá trị và thành phần trong tài liệu `15`.
3. Đủ trạng thái: có dữ liệu, rỗng, đang tải, lỗi, không có quyền.
4. Thông báo rõ ràng bằng tiếng Việt, nói được lỗi gì và cách xử lý.
5. Responsive tại các điểm ngắt trong tài liệu `15`; không có thanh cuộn ngang ngoài ý muốn.
6. Chữ tiếng Việt có dấu hiển thị đúng, không bị cắt dấu, không tràn khung với nội dung dài.
7. Tương phản màu tối thiểu 4,5:1 cho chữ thường, 3:1 cho chữ lớn (bước 10 của tệp này).
8. Thao tác được bằng bàn phím; có viền nhận biết phần tử đang được chọn; ô nhập có nhãn.
9. Thành phần chỉ hiển thị cho vai trò có quyền theo tài liệu `08`; quyền vẫn được kiểm tra phía máy chủ.
10. Nút thao tác có trạng thái đang xử lý, không gửi lặp khi bấm nhiều lần; thao tác xóa hoặc không hoàn tác được phải có bước xác nhận.
11. Kiểm tra dữ liệu đầu vào hiển thị lỗi tại đúng ô nhập.
12. Màn hình cũ không bị ảnh hưởng: so sánh ảnh chụp trước và sau khi sửa.
