# QUY TRÌNH SỬA LỖI KHẨN CẤP

Chi tiết của mục 13 trong [SKILL.md](SKILL.md). Số "mục" trong tệp này là số mục của SKILL.md. Điều kiện áp dụng, các việc không được rút gọn và cổng khẩn cấp chỉ được định nghĩa tại mục 13.

**Khoanh vùng**

1. Cấp mã `LOI_<số>` theo mục 4; sự cố bảo mật đã được cấp mã ở phần ứng phó thì dùng mã đó. Cùng lần ghi sổ đó: ghi lỗi vào tài liệu `25`, ghi sự cố vào tài liệu `02` theo mẫu "Sự cố" (thời điểm phát hiện, hiện tượng, phạm vi ảnh hưởng, phiên bản đang chạy), ghi dòng công việc `LOI_<số>` vào tài liệu `03`. Sau đó tạo nhánh `khan-cap/LOI_<số>-<mo-ta-ngan>` từ tag của phiên bản đang chạy.
2. Thu thập log, dữ liệu lỗi, bước tái hiện. Xác định nguyên nhân trực tiếp. Chưa xác định được nguyên nhân thì báo người dùng, không sửa theo phỏng đoán.
3. Đánh giá quay lui về phiên bản trước. Quay lui khắc phục được và an toàn với dữ liệu thì đề xuất quay lui trước, sửa lỗi sau theo chu trình mục 6.

**Sửa lỗi**

4. Viết kiểm thử tái hiện lỗi. Kiểm thử phải thất bại trước khi sửa.
5. Sửa tối thiểu đúng nguyên nhân trực tiếp. Không cải tiến, không tái cấu trúc, không thêm chức năng, không sửa thành phần khác.
6. Kiểm thử tái hiện lỗi phải đạt. Chạy toàn bộ kiểm thử tự động của dự án.
7. Quét thư viện phụ thuộc và quét khóa bí mật (phần C1, C2 trong [KIEM_TRA_BAO_MAT.md](KIEM_TRA_BAO_MAT.md)) trên commit sửa.
8. Tự rà soát mã theo danh sách trong [QUY_UOC_GIT.md](QUY_UOC_GIT.md). Tệp chẩn đoán, log thu thập ở bước 2 đặt trong `tam_thoi/LOI_<số>/`; log của sự cố bảo mật không được xóa.
9. Ghi kết quả vào tài liệu `25`, đối chiếu cổng khẩn cấp tại mục 13.

**Phê duyệt và triển khai**

10. Trình người dùng: nguyên nhân, thay đổi, kết quả kiểm thử, rủi ro, phương án quay lui. Chờ phê duyệt.
11. Mã phiên bản (theo phần "Phiên bản" trong [QUY_UOC_GIT.md](QUY_UOC_GIT.md), trừ khi dự án có quy ước riêng): tăng số bản vá từ tag đang chạy (ví dụ `v1.2.3` → `v1.2.4`). Số đó đã có tag thì dùng số bản vá nhỏ nhất chưa có tag trong cùng `x.y` (ví dụ đã có `v1.2.4` thì dùng `v1.2.5`). Trên nhánh khẩn cấp: ghi tài liệu `23` kèm phương án quay lui, commit, gắn tag.
12. Triển khai theo mục 8; tag đã qua cổng khẩn cấp đáp ứng điều kiện bắt đầu. Chỉ được bỏ môi trường thử nghiệm (staging) khi người dùng đồng ý rõ ràng cho lần triển khai này.
13. Xác nhận sau triển khai, ghi biên bản vào tài liệu `26` theo mục 4. Đã quay lui thì không hợp nhất nhánh khẩn cấp; báo người dùng và quay lại bước 2.

**Hoàn tất sau sự cố**

14. Đạt cổng triển khai: hợp nhất ngay nhánh khẩn cấp vào `main` và các nhánh đang phát triển bị ảnh hưởng; kiểm thử tái hiện lỗi đi cùng vào `main`. Xung đột ở tài liệu dạng sổ xử lý theo [QUY_UOC_GIT.md](QUY_UOC_GIT.md). Chưa hợp nhất được thì ghi việc hợp nhất vào dòng `LOI_<số>` trong tài liệu `03` và báo người dùng.
15. Làm nốt phần C của mục 17, cập nhật tài liệu `27`. Bản sửa làm thay đổi yêu cầu, quy tắc, chức năng, giao diện, dữ liệu hoặc API thì lập tài liệu `24` theo quy tắc xếp mức 5 tại mục 5.
16. Phân tích nguyên nhân gốc. Đề xuất biện pháp phòng ngừa vào mục "Chờ phê duyệt" của tài liệu `03`. Không tự triển khai biện pháp phòng ngừa.
17. Trình người dùng kết quả bước 14 đến 16. Người dùng đồng ý thì đặt dòng `LOI_<số>` trong tài liệu `03` thành Hoàn thành và dọn `tam_thoi/LOI_<số>/` theo danh sách dọn dẹp.

Sổ dùng chung và biên bản ghi theo mục 4.
