# TÌM VÀ PHÂN TÍCH GIẢI PHÁP CÓ SẴN

Chi tiết của mục 16 trong [SKILL.md](SKILL.md). Số "mục" trong tệp này là số mục của SKILL.md.

Phạm vi áp dụng và thứ tự nguồn: xem mục 16. Nguồn riêng của người dùng là kho mã, thư mục, dự án cũ ghi trong tài liệu `18`. Nguồn công cộng gồm GitHub, kho thư viện của ngôn ngữ đang dùng (npm, PyPI, NuGet, Maven...), tài liệu chính thức của framework.

Ở giai đoạn 05 của dự án mới (chưa có tài liệu `12`, `13`, chưa có công việc): đánh giá tương thích theo kiến trúc và công nghệ đang đề xuất; ghi báo cáo vào tài liệu `13`, mục "Phân tích giải pháp có sẵn", thay cho đặc tả công việc.

**Quy trình**

1. Tóm tắt yêu cầu nghiệp vụ cần đáp ứng theo các mã `YCAU_NGHIEPVU_<số>`, `QUYTAC_NGHIEPVU_<số>`, `CHUC_NANG_<số>` liên quan.
2. Tìm theo thứ tự: mã nguồn hiện có của dự án, nguồn riêng của người dùng, nguồn công cộng. Dự án đã có mã đáp ứng thì dừng tìm, đề xuất dùng lại.
3. Từ khóa tìm kiếm chỉ mô tả chức năng kỹ thuật. Không đưa tên khách hàng, dữ liệu, quy tắc nghiệp vụ nội bộ hoặc thông tin bí mật lên công cụ tìm kiếm công cộng.
4. Chọn tối đa năm ứng viên phù hợp nhất. Với mỗi ứng viên, đánh giá:
   - Mức đáp ứng: đối chiếu từng mã yêu cầu và quy tắc nghiệp vụ, ghi Đáp ứng, Đáp ứng một phần hoặc Không đáp ứng.
   - Giấy phép: loại giấy phép, có cho phép dùng trong dự án thương mại hay không.
   - Tình trạng duy trì: lần cập nhật gần nhất, số lỗi đang mở, mức độ được sử dụng.
   - Tương thích: với công nghệ trong tài liệu `13` và kiến trúc trong tài liệu `12`.
   - Bảo mật: lỗ hổng đã công bố, thư viện phụ thuộc.
   - Công sức điều chỉnh: phần cần sửa hoặc viết thêm để đáp ứng đủ nghiệp vụ.
5. Lập phương án theo mẫu "Phân tích giải pháp có sẵn" trong [MAU_TAI_LIEU.md](MAU_TAI_LIEU.md):
   - Dùng lại nguyên trạng.
   - Dùng lại có điều chỉnh.
   - Tham khảo cách làm, tự viết.
   - Tự viết mới hoàn toàn (khi không có ứng viên phù hợp).
6. Nêu phương án đề xuất kèm lý do, trình người dùng. Chờ người dùng quyết định.
7. Ghi quyết định vào tài liệu `02`. Thư viện mới được chọn thì cập nhật tài liệu `13`.

**Không được**

- Viết mã, cài thư viện hoặc sao chép mã nguồn trước khi người dùng quyết định.
- Sao chép mã, hoặc đề xuất dùng thư viện, có giấy phép không cho phép dùng trong dự án. Giấy phép không rõ: chỉ đưa vào bảng đánh giá kèm cảnh báo, để người dùng quyết định.
- Báo một ứng viên đáp ứng nghiệp vụ khi chưa đối chiếu từng yêu cầu.
- Chọn thay người dùng. Không tìm được ứng viên phù hợp thì báo rõ và đề xuất tự viết.
