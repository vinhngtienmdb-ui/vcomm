# QUY TRÌNH KIỂM THỬ VÀ TRIỂN KHAI

Chi tiết của mục 7 và mục 8 trong [SKILL.md](SKILL.md). Số "mục" trong tệp này là số mục của SKILL.md. Cổng kiểm thử, cổng triển khai và điều kiện bắt đầu triển khai chỉ được định nghĩa trong SKILL.md.

## Kiểm thử (mục 7)

**Chuẩn bị**

1. Đọc tiêu chí nghiệm thu (tài liệu `11`) và kịch bản kiểm thử (tài liệu `21`) của chức năng.
2. Xác định phạm vi: phần mới hoặc phần sửa, cộng các chức năng cũ có liên quan để kiểm thử hồi quy.
3. Chuẩn bị môi trường và dữ liệu kiểm thử. Không dùng dữ liệu thật của người dùng.

**Viết kiểm thử**

4. Mỗi tiêu chí nghiệm thu có ít nhất một kịch bản trong tài liệu `21`, gồm trường hợp đúng, sai, giá trị biên, từng vai trò được phép và không được phép.
5. Viết kiểm thử tự động: kiểm thử đơn vị cho xử lý nghiệp vụ, kiểm thử tích hợp cho API và cơ sở dữ liệu, kiểm thử đầu cuối cho luồng chính.

**Thực hiện**

6. Chạy toàn bộ bộ kiểm thử của dự án, không chỉ phần mới.
7. Có thay đổi giao diện: kiểm tra trên ứng dụng theo danh sách rà soát giao diện trong [THIET_KE_GIAO_DIEN.md](THIET_KE_GIAO_DIEN.md).
8. Kiểm tra bảo mật phần C trong [KIEM_TRA_BAO_MAT.md](KIEM_TRA_BAO_MAT.md).
9. Kiểm thử hiệu năng khi yêu cầu phi chức năng có quy định.

**Ghi nhận và xử lý**

10. Ghi vào tài liệu `25`: ngày, phạm vi, lệnh đã chạy, số kịch bản đạt và không đạt, lỗi phát hiện.
11. Cấp mã `LOI_<số>` cho mỗi lỗi theo mục 4, xếp mức độ theo thang tại mục 7, ghi quyết định xử lý.
12. Sửa lỗi, chạy lại toàn bộ kiểm thử, ghi lại kết quả.
13. Cập nhật các dòng thuộc phạm vi trong tài liệu `27` và kiểm tra bao phủ cho các dòng đó: mỗi tiêu chí có kịch bản, kịch bản có kết quả Đạt mới nhất, chức năng cần giao diện có màn hình. Kiểm tra bao phủ đủ bảy điểm (phần 2 của mẫu `27` trong [MAU_TAI_LIEU.md](MAU_TAI_LIEU.md)) chạy một lần cho mỗi phiên bản trước khi phát hành.
14. Ghi kết quả kiểm tra bảo mật phần B, C và kết quả tự rà soát mã, dọn dẹp vào lần kiểm thử cuối của công việc trong tài liệu `25`.

## Triển khai (mục 8)

**Chuẩn bị**

1. Kiểm tra phiên bản cần triển khai chứa mọi bản vá khẩn cấp đã triển khai trước đó: với mỗi tag của bản vá khẩn cấp đã lên môi trường thật, commit của tag đó phải là tổ tiên của commit cần triển khai (`git merge-base --is-ancestor <tag bản vá> <tag cần triển khai>`). Thiếu thì dừng, báo người dùng.
2. Kiểm tra cấu hình, biến môi trường của môi trường đích; mật khẩu, khóa bí mật, token không nằm trong mã nguồn. Kiểm tra bảo mật phần D trong [KIEM_TRA_BAO_MAT.md](KIEM_TRA_BAO_MAT.md); lỗ hổng Nghiêm trọng, Cao chưa xử lý thì dừng, báo người dùng.
3. Database migration chạy lặp lại an toàn, có bước đảo ngược hoặc phương án khôi phục.
4. Đối chiếu phương án quay lui của phiên bản (tài liệu `23`) với môi trường đích. Các bước triển khai và thứ tự chạy database migration ghi trong tài liệu `26`, giống nhau cho mọi môi trường.

**Thực hiện**

5. Build bản phát hành từ đúng commit đã gắn tag.
6. Môi trường thử nghiệm (staging), nếu dự án có: sao lưu, triển khai theo các bước trong tài liệu `26`, kiểm tra nhanh các chức năng chính.
7. Trình kết quả, chờ người dùng phê duyệt triển khai lên môi trường thật.
8. Sao lưu cơ sở dữ liệu và bản đang chạy của môi trường thật ngay trước khi triển khai.
9. Triển khai lên môi trường thật theo các bước trong tài liệu `26` (đã chạy thử ở bước 6 nếu có môi trường thử nghiệm).

**Xác nhận sau triển khai**

10. Kiểm tra nhanh các chức năng chính, chức năng vừa thay đổi, log lỗi, hiệu năng.
11. Có lỗi ảnh hưởng người dùng: báo ngay, thực hiện phương án quay lui khi được đồng ý, khôi phục dữ liệu từ bản sao lưu nếu cần. Sau khi quay lui:
    - cấp mã `LOI_<số>` cho lỗi theo mục 4; đưa các công việc trong phiên bản về trạng thái Cần sửa trong tài liệu `03`;
    - ghi phiên bản là "Đã thu hồi" trong tài liệu `23`, cập nhật phiếu tài liệu `24` liên quan;
    - đề xuất đảo các commit lỗi trong `main` qua nhánh `sua-loi/LOI_<số>-...` (git revert); thực hiện khi người dùng đồng ý. Phiên bản sau không được phát hành từ `main` còn chứa lỗi này.
12. Ghi biên bản triển khai vào tài liệu `26` theo mục 4: ngày giờ, phiên bản, môi trường, người phê duyệt, các bước đã làm, kết quả kiểm tra bảo mật phần D, kết quả. Ghi nhật ký vào tài liệu `02`.
