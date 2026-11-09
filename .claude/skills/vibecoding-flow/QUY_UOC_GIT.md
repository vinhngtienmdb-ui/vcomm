# QUY ƯỚC GIT VÀ RÀ SOÁT MÃ

Chi tiết của mục 14 trong [SKILL.md](SKILL.md). Số "mục" trong tệp này là số mục của SKILL.md. Các quy tắc bắt buộc trong mọi trường hợp, gồm điều kiện hợp nhất vào `main`, chỉ được định nghĩa tại mục 14. Dự án có quy ước Git riêng (tài liệu `18`) thì phần tên nhánh, nội dung commit và tag phiên bản dưới đây được thay bằng quy ước của dự án.

## Nhánh

| Nhánh | Mục đích |
|---|---|
| `main` | Mã đã phát hành. Điều kiện hợp nhất: quy tắc 1 tại mục 14. |
| `chuc-nang/CONG_VIEC_<số>-<mo-ta-ngan>` | Chức năng mới, cải tiến |
| `sua-loi/LOI_<số>-<mo-ta-ngan>` | Sửa lỗi thông thường |
| `khan-cap/LOI_<số>-<mo-ta-ngan>` | Sửa lỗi khẩn cấp, tạo từ tag đang chạy |
| `phat-hanh/v<x.y.z>` | Gộp nhiều công việc đã nghiệm thu vào một phiên bản |
| `tai-lieu/<mo-ta-ngan>` | Chỉ sổ dùng chung và biên bản (tài liệu `02`, `03`, `24`, `25`, `26`): cấp mã, ghi trạng thái, nhật ký, biên bản. Tạo từ `main` mới nhất, hợp nhất ngay. |

Mã định danh trong tên nhánh giữ nguyên chữ in hoa để tìm kiếm theo mã. Phần mô tả ngắn viết tiếng Việt không dấu, chữ thường, nối bằng dấu gạch ngang. Ví dụ: `sua-loi/LOI_07-sai-tong-tien-hoa-don`.

Xung đột khi hợp nhất ở tài liệu dạng sổ (`02`, `03`, `23`, `25`, `27`): giữ đủ mục của cả hai bên, sắp lại theo ngày hoặc theo mã; không xóa mục nào.

## Nội dung commit

```
<loại>(CONG_VIEC_<số> hoặc LOI_<số>): <mô tả ngắn bằng tiếng Việt có dấu>

- Lý do: <vì sao thay đổi>
- Thay đổi: <nội dung chính>
- Kiểm thử: <lệnh đã chạy và kết quả>
```

Loại: `chuc-nang`, `sua-loi`, `khan-cap`, `tai-lieu`, `kiem-thu`, `tai-cau-truc`, `cau-hinh`, `du-lieu` (database migration), `phat-hanh`.

1. Mỗi commit một mục đích. Không gộp chức năng, sửa lỗi và tái cấu trúc vào cùng commit.
2. Commit trên nhánh làm việc khi còn kiểm thử thất bại thì ghi rõ ở dòng "Kiểm thử".

## Phiên bản

Tag dạng `v<x.y.z>`: tăng `x` khi phá vỡ tương thích, `y` khi thêm chức năng, `z` khi sửa lỗi. Số phiên bản mới lấy từ tag lớn nhất đã có, không lấy từ phiên bản đang chạy (trừ sửa lỗi khẩn cấp, xem [SUA_LOI_KHAN_CAP.md](SUA_LOI_KHAN_CAP.md)). Trước khi tính: lấy tag mới từ kho chung (`git fetch --tags`), so theo thứ tự phiên bản, không theo thứ tự chữ (`git tag -l "v*" --sort=-v:refname`). Tag gắn trên commit hợp nhất vào `main` sau khi kiểm thử lại đạt, hoặc trên nhánh khẩn cấp.

## Danh sách tự rà soát mã

Thực hiện trên toàn bộ phần thay đổi trước khi trình nghiệm thu.

1. Phạm vi: mọi dòng thay đổi thuộc công việc đang làm; không sửa thành phần không liên quan.
2. Nghiệp vụ: xử lý đúng đặc tả tài liệu `10` và quy tắc tài liệu `07`; đối chiếu từng mã `QUYTAC_NGHIEPVU_<số>`.
3. Xử lý lỗi: có xử lý trường hợp lỗi, giá trị rỗng, giá trị biên; không bỏ qua lỗi im lặng.
4. Phân quyền: kiểm tra quyền phía máy chủ, không chỉ ẩn trên giao diện.
5. Bảo mật: đạt danh sách phần B trong [KIEM_TRA_BAO_MAT.md](KIEM_TRA_BAO_MAT.md).
6. Dữ liệu: database migration đạt yêu cầu tại bước 3 phần triển khai trong [KIEM_THU_VA_TRIEN_KHAI.md](KIEM_THU_VA_TRIEN_KHAI.md); không làm mất dữ liệu hiện có.
7. Tương thích: không thay đổi API, cấu trúc dữ liệu, giao diện ngoài phạm vi đã phê duyệt.
8. Hiệu năng: không truy vấn trong vòng lặp, không tải dữ liệu không giới hạn, có chỉ mục cho trường truy vấn thường xuyên.
9. Chất lượng mã: tên rõ nghĩa, không viết tắt; không còn mã chết, mã gỡ lỗi, chú thích thừa; theo quy ước mã trong tài liệu `18`.
10. Kiểm thử: có kiểm thử cho phần thay đổi; tuân thủ nguyên tắc 8 tại mục 2 về sửa, bỏ qua, xóa kiểm thử.
11. Giao diện: chỉ dùng biến dùng chung sinh từ tài liệu `15`; không đặt giá trị cố định mới trong mã.
12. Dùng lại: không có hàm, thành phần, truy vấn mới trùng chức năng với mã đã có; không có đoạn mã sao chép lặp lại.
13. Đơn giản: không có lớp trừu tượng, tham số, cấu hình không dùng đến; không viết phức tạp hơn mức yêu cầu cần.
14. Vị trí tệp: tệp mới nằm đúng thư mục theo tài liệu `12`; không có tệp mới ở gốc dự án khi chưa được người dùng đồng ý (nguyên tắc 18 tại mục 2).
15. Dọn dẹp: đạt danh sách dọn dẹp bên dưới.

Lỗi phát hiện khi rà soát: sửa ngay và kiểm thử lại, hoặc ghi vào tài liệu `25` nếu cần người dùng quyết định. Công việc mức Lớn: trình danh sách rà soát kèm kết quả từng mục khi nghiệm thu.

## Danh sách dọn dẹp

Thực hiện trước khi trình nghiệm thu và cuối mỗi phiên làm việc (nguyên tắc 16 tại mục 2).

**Nơi đặt tệp tạm**

- Tệp tạm, script thử, log, ảnh chụp, dữ liệu xuất thử đặt trong `tam_thoi/<mã công việc hoặc mã lỗi>/` tại gốc dự án.
- Git bỏ qua thư mục này bằng dòng `tam_thoi/` trong `.git/info/exclude` (áp dụng cho mọi nhánh, không sửa tệp của dự án). Kiểm tra bằng `git check-ignore tam_thoi/` trước khi đặt tệp.
- Dữ liệu thử chèn vào cơ sở dữ liệu, tiến trình, container do AI khởi động: ghi ngay lúc tạo vào `tam_thoi/<mã>/da_tao.md`. Danh sách này là căn cứ để dọn.
- Không đặt tệp tạm rải rác trong thư mục mã nguồn hoặc `tai_lieu/`.
- Ảnh chụp trước và sau khi sửa giao diện dùng làm bằng chứng nghiệm thu: giữ trong `tam_thoi/` đến khi người dùng nghiệm thu.

**Kiểm tra và dọn**

1. Chạy `git status --ignored`: tệp mới do AI tạo phải nằm trong `tam_thoi/` hoặc thuộc thay đổi của công việc. Tệp không do AI tạo: không di chuyển, không xóa; không chắc thì liệt kê và hỏi người dùng.
2. Mã nguồn: không còn lệnh in gỡ lỗi (`console.log`, `print`, `var_dump`...), đoạn mã bị chú thích bỏ đi, hàm hoặc tệp thử không được dùng, `TODO` do AI để lại mà chưa ghi vào tài liệu `03`.
3. Tệp sao lưu và bản sao: không còn tệp dạng `*.bak`, `*_cu.*`, `*_ban_sao.*`, `*_old.*`, `*.orig` do AI tạo.
4. Phụ thuộc: thư viện cài thử nhưng không dùng thì gỡ khỏi tệp khai báo phụ thuộc (`package.json`, `requirements.txt`...) và tệp khóa phiên bản.
5. Dữ liệu: dữ liệu thử ghi trong `da_tao.md` thì xóa, hoặc ghi rõ trong tài liệu `25` nếu cần giữ cho kiểm thử. Không đụng dữ liệu không có trong danh sách.
6. Tiến trình: dừng máy chủ phát triển, tiến trình chạy nền, container ghi trong `da_tao.md` mà không còn cần.
7. Nhánh Git: nhánh đã hợp nhất vào `main` thì đề xuất xóa nhánh cục bộ; xóa nhánh trên kho chung chỉ khi người dùng đồng ý.
8. Thư mục `tam_thoi/<mã>/`: xóa sau khi người dùng nghiệm thu, hoặc sau bước hoàn tất của sửa lỗi khẩn cấp. Log và dữ liệu của sự cố bảo mật không xóa; lưu giữ theo quyết định của người dùng.

**Không được**

- Di chuyển hoặc xóa tệp, dữ liệu, nhánh, tiến trình không do AI tạo ra trong công việc.
- Xóa tệp đã được theo dõi trong Git mà không thuộc phạm vi công việc.
- Không chắc một tệp có do AI tạo hay không: liệt kê và hỏi người dùng trước khi động tới.

Kết quả tự rà soát mã và dọn dẹp ghi một dòng trong lần kiểm thử cuối của công việc ở tài liệu `25`: đạt, hoặc các mục chưa đạt; thứ còn giữ và lý do.
