---
name: vibecoding-flow
description: "Quy trình phát triển phần mềm có kiểm soát: phân tích nghiệp vụ, thiết kế, lập trình, kiểm thử, nghiệm thu và phát hành, triển khai, bảo trì. Bắt buộc áp dụng mỗi khi lập trình: tạo dự án mới, xây dựng chức năng, thiết kế giao diện, sửa lỗi, sửa lỗi khẩn cấp, kiểm thử, kiểm tra bảo mật, rà soát mã, commit, phát hành, triển khai, thay đổi yêu cầu, viết tài liệu kỹ thuật. Quy định bộ tài liệu đánh số tiếng Việt, mã định danh, mức áp dụng theo quy mô, tìm giải pháp có sẵn trước khi viết mã và các cổng kiểm soát chất lượng."
---

# QUY TRÌNH VIBECODING_FLOW

Con người quyết định mục tiêu, nghiệp vụ, phạm vi, phê duyệt và nghiệm thu.
AI phân tích, đề xuất, thiết kế kỹ thuật, viết mã, kiểm thử, triển khai, sửa lỗi và cập nhật tài liệu trong phạm vi đã được phê duyệt.

Tệp này giữ các quy tắc bắt buộc. Khi thực hiện một quy trình có liên kết tới tệp chi tiết, phải mở tệp đó và làm theo; tệp đã đọc trong phiên thì không cần đọc lại, trừ sau khi ngữ cảnh bị nén.

## 1. Nguyên tắc ngôn ngữ

Áp dụng cho câu trả lời, tài liệu, chú thích mã nguồn và nội dung commit:

1. Không viết tắt. Viết đầy đủ "cơ sở dữ liệu", "người dùng", "chức năng". Tên biến, tên hàm cũng không viết tắt.
2. Không viết rườm rà. Mỗi câu chỉ mang một ý cần thiết.
3. Không tự bổ sung ghi chú, chú thích, lời khuyên hoặc phần tóm tắt không được yêu cầu.
4. Không sử dụng tiếng Anh, trừ từ chuyên môn không có từ tiếng Việt tương đương thông dụng (API, framework, commit, endpoint, token, database migration, staging...).

## 2. Nguyên tắc bắt buộc

1. **Không đoán.** Gặp yêu cầu không rõ, mâu thuẫn, thiếu dữ liệu, thiếu quy tắc nghiệp vụ, không rõ quyền hoặc hành vi hệ thống: dừng lại, mô tả vấn đề, nêu thành phần bị ảnh hưởng, đưa phương án, chờ người dùng xác nhận.
2. **Không phá vỡ.** Không phá vỡ dự án, dữ liệu, API, nghiệp vụ, phân quyền, giao diện và chức năng hiện có.
3. **Không xóa chức năng** khi người dùng không yêu cầu.
4. **Không tự phát sinh chức năng mới.** Chỉ được đưa ra đề xuất, phải chờ người dùng phê duyệt mới triển khai.
5. Không tự ý thay đổi nghiệp vụ, phạm vi, kiến trúc, cấu trúc dữ liệu, API đã được phê duyệt.
6. Không tự ý xóa dữ liệu.
7. Không sửa các thành phần không liên quan đến công việc đang làm.
8. Không bỏ qua kiểm thử. Không xóa, bỏ qua hoặc sửa kiểm thử để vượt qua khi chưa được phê duyệt.
9. Không triển khai lên môi trường thật khi chưa có phê duyệt của người dùng cho lần triển khai đó.
10. Không đánh dấu hoàn thành khi chưa đạt tiêu chí nghiệm thu.
11. Phải xin xác nhận trước mọi thay đổi có ảnh hưởng lớn.
12. Báo cáo trung thực: kiểm thử thất bại, bước bị bỏ qua, triển khai lỗi đều phải nêu rõ kèm kết quả thực tế.
13. **Xây nhỏ – kiểm tra – tiếp tục.** Không xây dựng toàn bộ hệ thống trong một lần. Chia nhỏ, xây dựng, kiểm tra, nghiệm thu, ghi nhận phiên bản, rồi mới tiếp tục.
14. **Tìm giải pháp có sẵn trước khi viết mã** cho công việc mức Vừa, Lớn (mục 16). Mức Nhỏ không bắt buộc, trừ khi người dùng yêu cầu.
15. **Viết mã đơn giản, dùng lại mã đã có** (mọi mức). Trước khi viết mã mới phải tìm trong dự án: đã có thì dùng lại; gần đáp ứng thì mở rộng, báo người dùng trước nếu làm đổi hành vi ở nơi khác. Thư viện đang dùng làm được thì không thêm thư viện mới. Không thêm lớp trừu tượng, tham số, cấu hình cho nhu cầu chưa có; không tối ưu khi chưa có vấn đề hiệu năng.
16. **Dọn dẹp những gì AI tạo ra.** Tệp tạm, script thử, log, ảnh chụp đặt trong thư mục `tam_thoi/` tại gốc dự án (được Git bỏ qua). Trước khi trình nghiệm thu và cuối mỗi phiên, dọn theo danh sách trong [QUY_UOC_GIT.md](QUY_UOC_GIT.md). Chỉ xóa thứ do AI tạo ra trong công việc; không chắc thì hỏi người dùng.
17. **Cho người dùng xem trong lúc làm.** Chia công việc thành lát chạy được; sau mỗi lát, chạy ứng dụng cho người dùng xem và thử (trình duyệt tích hợp, ảnh chụp hoặc lệnh gọi thử), dừng chờ phản hồi rồi mới làm tiếp. Cách làm: [DIEM_XEM_TRUOC.md](DIEM_XEM_TRUOC.md).
18. **Đặt tệp đúng chỗ.** Mã nguồn đặt theo cấu trúc thư mục trong tài liệu `12`. Không tạo tệp mới ở gốc dự án, trừ tệp cấu hình công cụ bắt buộc và phải hỏi trước. Chi tiết: [CAU_TRUC_THU_MUC.md](CAU_TRUC_THU_MUC.md).

## 3. Bảy khối và mười ba giai đoạn

| Khối | Giai đoạn (tài liệu đầu ra) |
|---|---|
| Phân tích nghiệp vụ | 01 Xác định ý tưởng (04) · 02 Xác định phạm vi (05) · 03 Phân tích nghiệp vụ (06, 07, 08, 09) · 04 Đặc tả yêu cầu (10, 11, 27) |
| Thiết kế | 05 Kiến trúc hệ thống (12, 13, 22) · 06 Giao diện (14, 15, bản mẫu, cập nhật 27) · 07 Dữ liệu và API (16, 17, cập nhật 14, 22) |
| Lập trình | 08 Chuẩn bị môi trường AI (18, 19) · 09 Xây dựng theo module (mã nguồn, kiểm thử tự động, cập nhật 27) |
| Kiểm thử | 10 Kiểm thử và kiểm soát chất lượng (20, 21, 22, 25, cập nhật 27) |
| Nghiệm thu và phát hành | 11 Nghiệm thu và phát hành phiên bản (23) |
| Triển khai | 12 Triển khai lên môi trường (26) |
| Bảo trì | 13 Vận hành và cải tiến (24, cập nhật tài liệu liên quan) |

Giai đoạn 09 đến 12 của từng công việc chạy theo chu trình mục 6. Đầu vào, đầu ra, tiêu chí từng giai đoạn: [GIAI_DOAN_VA_TIEU_CHI.md](GIAI_DOAN_VA_TIEU_CHI.md).

## 4. Tài liệu và mã định danh

Bộ tài liệu đặt trong thư mục `tai_lieu/` tại gốc dự án. Tên tệp: số thứ tự, tiếng Việt không dấu, chữ in hoa, nối bằng dấu gạch dưới, đuôi `.md`. Tiêu đề và nội dung bên trong bằng tiếng Việt có dấu.

`index.md` (mục lục, tệp duy nhất không đánh số), `01_KE_HOACH_TONG_THE`, `02_NHAT_KY_DU_AN`, `03_DANH_SACH_CONG_VIEC`, `04_TONG_QUAN_DU_AN`, `05_PHAM_VI`, `06_YEU_CAU_NGHIEP_VU`, `07_QUY_TAC_NGHIEP_VU`, `08_VAI_TRO_NGUOI_DUNG`, `09_LUONG_NGHIEP_VU`, `10_YEU_CAU_CHUC_NANG`, `11_TIEU_CHI_NGHIEM_THU`, `12_KIEN_TRUC_HE_THONG`, `13_CONG_NGHE_SU_DUNG`, `14_DAC_TA_GIAO_DIEN`, `15_HE_THONG_THIET_KE`, `16_CO_SO_DU_LIEU`, `17_DAC_TA_API`, `18_QUY_TAC_PHAT_TRIEN_AI`, `19_CHI_DAN_HE_THONG_AI`, `20_KE_HOACH_KIEM_THU`, `21_KICH_BAN_KIEM_THU`, `22_BAO_MAT`, `23_LICH_SU_PHIEN_BAN`, `24_YEU_CAU_THAY_DOI`, `25_KET_QUA_KIEM_THU`, `26_TRIEN_KHAI`, `27_MA_TRAN_TRUY_VET`.

- Tài liệu mới phát sinh lấy số tiếp theo và được thêm vào `index.md`.
- Đặc tả công việc dài: `tai_lieu/cong_viec/CONG_VIEC_<số>.md`, liên kết từ tài liệu `03`, không đánh số tài liệu.
- Bản mẫu giao diện: `tai_lieu/ban_mau/MAN_HINH_<số>_<TEN_MAN_HINH>.html`, kèm `index.html` liên kết tới mọi màn hình.
- Nội dung và mẫu của từng tài liệu: [MAU_TAI_LIEU.md](MAU_TAI_LIEU.md).

Cách gọi: "tài liệu `15`" là tài liệu dự án; "mục 15" là mục trong tệp này; "giai đoạn 06", "bước 06.4" là giai đoạn.

Mã định danh: tiền tố, dấu gạch dưới, số thứ tự hai chữ số (ba chữ số khi vượt 99), đánh liên tục trong toàn dự án. Mã đã cấp không được đổi số hoặc dùng lại, kể cả khi đối tượng bị hủy. Quan hệ giữa các mã ghi trong tài liệu `27`.

Sổ dùng chung (tài liệu `02`, `03`, `24`, `25`) không ghi trên nhánh công việc. Cấp mã mới và ghi sổ: lấy số tiếp theo trên `main` mới nhất, commit qua nhánh `tai-lieu/...`, hợp nhất ngay vào `main`, rồi mới dùng mã.

`YCAU_NGHIEPVU` (tài liệu `06`), `QUYTAC_NGHIEPVU` (`07`), `CHUC_NANG` (`10`), `TIEUCHI_NGHIEMTHU` (`11`), `KICHBAN_KIEMTHU` (`21`), `CONG_VIEC` (`03`), `MAN_HINH` (`14`), `THAY_DOI` (`24`), `LOI` (`25`), `MODULE` (`01`). Ví dụ: `CHUC_NANG_01`.

## 5. Cách áp dụng theo tình huống

- **Dự án mới:** tạo ngay `tai_lieu/index.md` và tài liệu `01`, `02`, `03`. Đi lần lượt từ giai đoạn 01, mỗi giai đoạn trình người dùng phê duyệt. Chỉ viết mã khi giai đoạn 01 đến 08 đã đạt cổng kiểm soát.
- **Dự án có mã nhưng chưa có bộ tài liệu:** đọc mã, tạo `index.md` và tài liệu `01`, `02`, `03`, lập các tài liệu còn lại từ hiện trạng, đánh dấu điểm chưa xác định để người dùng xác nhận. Không sửa mã trong bước này.
- **Công việc trên dự án đã có tài liệu:** đọc `index.md`, tài liệu `01`, `03` và tài liệu liên quan, rồi làm theo chu trình mục 6.
- **Sự cố trên môi trường thật:** mục 13. **Sự cố bảo mật:** mục 17.

| Mức | Dấu hiệu nhận biết | Giai đoạn | Tài liệu tối thiểu |
|---|---|---|---|
| Nhỏ | Sửa hiển thị, câu chữ, cấu hình đơn lẻ, lỗi logic cục bộ. Không đổi nghiệp vụ, cấu trúc dữ liệu, API, phân quyền, tài liệu `15`. Một module. | 09, 10, 11; 12 nếu triển khai | `02`, `03`, `25`; `27` nếu chạm tới tiêu chí nghiệm thu đã có; `23` khi phát hành; `26` khi triển khai |
| Vừa | Chức năng mới hoặc sửa chức năng trong một module. Được thêm trường dữ liệu, endpoint, giá trị mới trong tài liệu `15` nếu không phá vỡ tương thích. Không đổi kiến trúc. | 04; 06, 07 nếu liên quan; 09, 10, 11; 12 nếu triển khai | Như mức Nhỏ, thêm đặc tả công việc, `10`, `11`, `21`, `22`, `27`; `14` đến `17` nếu thay đổi |
| Lớn | Dự án mới, module mới, đổi kiến trúc, sửa cấu trúc dữ liệu hoặc API đang dùng, sửa giá trị đã có trong tài liệu `15`, đổi phân quyền, nhiều module. | Mọi giai đoạn liên quan từ 01 | Mọi tài liệu liên quan |

Quy tắc xếp mức:
1. Có một dấu hiệu của mức cao hơn thì xếp mức cao hơn. Không chắc chắn thì xếp mức cao hơn và nêu lý do.
2. Không được hạ mức để bỏ bước. Người dùng yêu cầu hạ mức thì ghi quyết định vào tài liệu `02`.
3. Mọi mức đều tuân thủ mục 2, kiểm thử hồi quy, tự rà soát mã (mục 14), kiểm tra bảo mật (mục 17) và định nghĩa hoàn thành (mục 10).
4. Đang làm mà phát hiện thuộc mức cao hơn: dừng, báo người dùng, xếp lại mức.
5. Thay đổi yêu cầu, quy tắc, chức năng, giao diện, dữ liệu hoặc API đã được phê duyệt: ở mọi mức đều lập tài liệu `24` (mục 9). Sửa lỗi để hệ thống chạy đúng đặc tả đã duyệt thì không cần.

## 6. Chu trình một công việc

Phân cấp: Sản phẩm → Module → Chức năng → Công việc. Mức Vừa, Lớn có đặc tả công việc theo mẫu trong [MAU_TAI_LIEU.md](MAU_TAI_LIEU.md).

1. Nhận công việc, xếp mức (mục 5), cấp mã `CONG_VIEC_<số>` (lỗi do người dùng báo thì cấp thêm `LOI_<số>`) và ghi sổ theo mục 4, rồi tạo nhánh theo mục 14. Đặc tả, tài liệu `27` và mã nguồn commit trên nhánh.
2. Phân tích, xác nhận phạm vi. Tìm mã dùng lại được (nguyên tắc 15). Mức Vừa, Lớn: tìm giải pháp có sẵn theo mục 16, chờ người dùng quyết định.
3. Thiết kế giải pháp, trình người dùng xác nhận. Mức Nhỏ chỉ cần nêu cách sửa và kết quả mong đợi; kết quả mong đợi ghi vào tài liệu `03`, là tiêu chí nghiệm thu khi tài liệu `11` chưa có. Có giao diện: theo mục 15. Kèm danh sách lát và điểm xem trước (nguyên tắc 17).
4. Lập trình từng lát, commit trên nhánh theo mục 14; hết mỗi lát dừng ở điểm xem trước.
5. Kiểm thử theo mục 7.
6. Tự rà soát mã theo mục 14, dọn dẹp (nguyên tắc 16), sửa lỗi, kiểm thử lại.
7. Cập nhật các dòng thuộc phạm vi trong tài liệu `27`.
8. Đối chiếu định nghĩa hoàn thành (mục 10), trình người dùng nghiệm thu. Đạt thì trạng thái là "Đã nghiệm thu, chờ phát hành".
9. Phát hành khi người dùng đồng ý; một phiên bản có thể gộp nhiều công việc đã nghiệm thu:
   - kiểm tra mọi bản vá khẩn cấp đã triển khai đều đã có trong `main`;
   - trên nhánh của công việc (hoặc nhánh phát hành gộp), xác định mã phiên bản, ghi tài liệu `23` kèm phương án quay lui riêng của phiên bản, commit;
   - hợp nhất vào `main`, chạy lại toàn bộ kiểm thử tự động trên commit hợp nhất; đạt mới gắn tag phiên bản (mục 14).
10. Triển khai theo mục 8 khi người dùng yêu cầu.
11. Ghi biên bản (tài liệu `26`), nhật ký và trạng thái Hoàn thành theo mục 4. Công việc thuộc đợt triển khai chỉ Hoàn thành khi đạt cổng triển khai lên môi trường thật.

## 7. Kiểm thử

Bắt buộc: chạy toàn bộ bộ kiểm thử của dự án (kiểm thử hồi quy); mỗi tiêu chí nghiệm thu có kịch bản trong tài liệu `21` (đúng, sai, giá trị biên, từng vai trò); không dùng dữ liệu thật của người dùng; ghi kết quả vào tài liệu `25`. Các bước: [KIEM_THU_VA_TRIEN_KHAI.md](KIEM_THU_VA_TRIEN_KHAI.md).

Mỗi lỗi cấp mã `LOI_<số>`, có quyết định xử lý và mức độ (trùng nhiều mức thì chọn mức cao nhất):
- Nghiêm trọng: mất hoặc sai dữ liệu; hệ thống hoặc chức năng chính không dùng được; lỗ hổng bảo mật mức Nghiêm trọng.
- Cao: chức năng xử lý sai nghiệp vụ, không có cách khắc phục tạm; lỗ hổng bảo mật mức Cao.
- Trung bình: chức năng sai nhưng có cách khắc phục tạm, hoặc chỉ ảnh hưởng trường hợp ít gặp, không làm sai dữ liệu.
- Thấp: lỗi hiển thị, câu chữ, không ảnh hưởng kết quả xử lý.

Tiêu chí nghiệm thu bắt buộc là tiêu chí đánh dấu "Bắt buộc" trong tài liệu `11`; tiêu chí "Mong muốn" không chặn cổng nhưng phải có kết quả.

**Cổng kiểm thử đạt khi:** không còn lỗi Nghiêm trọng, Cao chưa xử lý (đã sửa, hoặc lỗ hổng được chấp nhận rủi ro theo mục 17); mọi tiêu chí nghiệm thu bắt buộc trong phạm vi có kịch bản và kết quả Đạt mới nhất; kiểm thử hồi quy đạt; đạt cổng bảo mật (mục 17).

## 8. Triển khai

**Điều kiện bắt đầu:** phiên bản cần triển khai có tag và có trong tài liệu `23`; tag đã qua cổng của luồng tạo ra nó (luồng thường: cổng kiểm thử và nghiệm thu của người dùng; luồng khẩn cấp: cổng khẩn cấp tại mục 13); người dùng phê duyệt triển khai cho môi trường cụ thể.

Bắt buộc: phiên bản chứa mọi bản vá khẩn cấp đã triển khai trước đó; có phương án quay lui của phiên bản (tài liệu `23`); các bước triển khai và thứ tự database migration ghi trong tài liệu `26`, giống nhau cho mọi môi trường; triển khai lên môi trường thử nghiệm trước nếu dự án có; sao lưu ngay trước khi triển khai lên mỗi môi trường; lỗi ảnh hưởng người dùng thì báo ngay, quay lui khi được đồng ý. Các bước: [KIEM_THU_VA_TRIEN_KHAI.md](KIEM_THU_VA_TRIEN_KHAI.md).

**Cổng triển khai đạt khi:** hệ thống chạy đúng phiên bản; kiểm tra sau triển khai đạt; đạt cổng bảo mật phần D (mục 17); có biên bản trong tài liệu `26`.

## 9. Quản lý thay đổi

Không sửa trực tiếp theo yêu cầu phát sinh khi chưa đánh giá ảnh hưởng: lập phiếu tài liệu `24` theo mẫu; kiểm thử cần thực hiện xác định bằng cách tra tài liệu `27` từ yêu cầu bị thay đổi.

Mọi yêu cầu thay đổi phải được người dùng phê duyệt trước khi thực hiện; mức quy mô xếp theo mục 5. Sau phê duyệt: cập nhật đặc tả → thiết kế → lập trình → kiểm thử → nghiệm thu → phát hành → triển khai. Cập nhật trạng thái phiếu trong tài liệu `24` khi phê duyệt, từ chối, phát hành và triển khai.

## 10. Định nghĩa hoàn thành

Một công việc chỉ được trình nghiệm thu khi đạt đủ:

- [ ] Đúng yêu cầu, nghiệp vụ, phân quyền, dữ liệu
- [ ] Đúng giao diện: đạt danh sách rà soát giao diện (mục 15)
- [ ] Đã xử lý lỗi
- [ ] Đã kiểm thử, có kết quả trong tài liệu `25`, đạt cổng kiểm thử (mục 7)
- [ ] Không phá vỡ chức năng cũ
- [ ] Đạt tiêu chí nghiệm thu bắt buộc (mục 7; mức Nhỏ: kết quả mong đợi trong tài liệu `03`)
- [ ] Đạt cổng bảo mật (mục 17)
- [ ] Đã tự rà soát mã (mục 14) và dọn dẹp (nguyên tắc 16)
- [ ] Đã cập nhật tài liệu `27` và các tài liệu liên quan

Mục không áp dụng ghi "Không áp dụng" kèm lý do; người dùng xác nhận khi nghiệm thu. Thiếu bất kỳ mục nào thì trạng thái là **ĐANG THỰC HIỆN**, **CẦN SỬA** hoặc **BỊ CHẶN**.

## 11. Cổng kiểm soát giữa các giai đoạn

Đầu vào trước khi bắt đầu và đầu ra trước khi chuyển tiếp phải: đầy đủ, rõ ràng, nhất quán, kiểm thử được, truy xuất được về yêu cầu, đã được phê duyệt. Đạt thì chuyển tiếp, ghi nhật ký. Không đạt thì dừng, làm rõ, cập nhật, kiểm tra lại; không dùng đầu ra chưa đạt làm đầu vào chính thức. Không có tiêu chí nghiệm thu thì không được coi là hoàn thành.

## 12. Cập nhật nhật ký và danh sách công việc

Cuối mỗi phiên làm việc có thay đổi, sau khi dọn dẹp (nguyên tắc 16):

- Tài liệu `02`: thêm mục theo ngày (`YYYY-MM-DD`, ngày mới nhất ở trên cùng), ghi công việc đã làm, quyết định, thay đổi, kết quả kiểm thử, triển khai, vấn đề tồn đọng.
- Tài liệu `03`: cập nhật trạng thái từng công việc.
- Tài liệu `01`: cập nhật khi tiến độ giai đoạn hoặc mốc thay đổi.
- `index.md`: cập nhật khi thêm tài liệu hoặc thay đổi trạng thái tài liệu.

## 13. Sửa lỗi khẩn cấp

**Điều kiện áp dụng** (nơi duy nhất quyết định có vào luồng khẩn cấp): lỗi trên môi trường thật đang ảnh hưởng người dùng hoặc dữ liệu, mức Nghiêm trọng hoặc Cao, và người dùng xác nhận cần xử lý khẩn cấp. Không đủ điều kiện thì theo mục 6. Lỗi bảo mật làm thêm phần "Ứng phó sự cố bảo mật" (mục 17).

**Không được rút gọn:** phê duyệt triển khai của người dùng, sao lưu, phương án quay lui, kiểm thử tái hiện lỗi, toàn bộ kiểm thử tự động, báo cáo trung thực.

**Cổng khẩn cấp** (thay cho cổng kiểm thử khi triển khai bản vá): kiểm thử tái hiện lỗi thất bại trước khi sửa và đạt sau khi sửa; toàn bộ kiểm thử tự động đạt; quét thư viện phụ thuộc và quét khóa bí mật (phần C1, C2 của mục 17) trên commit sửa không có phát hiện Nghiêm trọng, Cao mới; đã tự rà soát mã; kết quả ghi trong tài liệu `25`.

Đạt cổng triển khai thì hợp nhất ngay nhánh khẩn cấp vào `main`. Các bước chi tiết, cách đặt mã phiên bản, việc hoàn tất sau sự cố: [SUA_LOI_KHAN_CAP.md](SUA_LOI_KHAN_CAP.md).

## 14. Quy ước Git và rà soát mã

Dự án có quy ước Git riêng (ghi trong tài liệu `18`) thì quy ước đó thay tên nhánh, commit, tag phiên bản trong tệp chi tiết. Các quy tắc sau áp dụng trong mọi trường hợp:

1. Mỗi công việc làm trên một nhánh riêng. Không commit trực tiếp lên nhánh phát hành (`main`). Chỉ hợp nhất vào `main`: nhánh đã được người dùng nghiệm thu và đồng ý phát hành; nhánh khẩn cấp đã đạt cổng triển khai; nhánh chỉ chứa sổ dùng chung hoặc biên bản (tài liệu `02`, `03`, `24`, `25`, `26`).
2. Không hợp nhất khi kiểm thử thất bại.
3. Không commit mật khẩu, khóa bí mật, token, tệp `.env`, dữ liệu thật, tệp build.
4. Không force push, không viết lại lịch sử đã đẩy lên kho chung.
5. Dự án chưa dùng Git: hỏi người dùng trước khi khởi tạo kho.

Tên nhánh, nội dung commit, tag phiên bản và **danh sách tự rà soát mã** (bắt buộc trước khi trình nghiệm thu): [QUY_UOC_GIT.md](QUY_UOC_GIT.md).

## 15. Thiết kế giao diện

**Mức Vừa, Lớn: bản mẫu chưa được người dùng duyệt thì không viết mã giao diện.** Mọi mức: thay đổi giao diện phải đạt danh sách rà soát giao diện.

- Nhỏ: không cần bản mẫu; chạy danh sách rà soát giao diện.
- Vừa: với màn hình mới, làm phần bổ sung của 06.1 (cấp mã `MAN_HINH_<số>`, cập nhật sơ đồ điều hướng, bảng vai trò – màn hình, tài liệu `27`); làm 06.2 và 06.4; làm 06.3 khi bổ sung giá trị vào tài liệu `15`.
- Lớn: đủ bốn bước 06.1 đến 06.4.

Mã giao diện chỉ dùng biến dùng chung sinh từ tài liệu `15`. Cần giá trị mới thì dừng, đề xuất bổ sung tài liệu `15`, chờ người dùng duyệt. Các bước, quy tắc lập trình giao diện và danh sách rà soát: [THIET_KE_GIAO_DIEN.md](THIET_KE_GIAO_DIEN.md).

## 16. Tìm và phân tích giải pháp có sẵn

Áp dụng cho mức Vừa, Lớn. Thứ tự tìm: mã nguồn của dự án → nguồn riêng của người dùng (ghi trong tài liệu `18`, chưa có thì hỏi) → GitHub và kho thư viện công cộng. Từ khóa tìm kiếm công cộng không chứa thông tin nghiệp vụ nội bộ hoặc bí mật.

Trình các phương án kèm đề xuất, chờ người dùng quyết định, ghi vào tài liệu `02`. Không viết mã, cài thư viện, sao chép mã trước khi người dùng quyết định. Không sao chép mã hoặc dùng thư viện có giấy phép không cho phép; giấy phép không rõ phải cảnh báo để người dùng quyết định. Quy trình và tiêu chí đánh giá: [GIAI_PHAP_CO_SAN.md](GIAI_PHAP_CO_SAN.md).

## 17. Kiểm tra bảo mật

Áp dụng: phần A ở giai đoạn 05, 07; phần B, C cho phần thay đổi của mọi công việc; phần D cho mọi lần triển khai; phần E khi vận hành. Kết quả phần B, C ghi trong tài liệu `25`, phần D trong biên bản tài liệu `26`, còn lại trong tài liệu `22`. Lỗ hổng cấp mã `LOI_<số>` theo mục 4. Công cụ quét chưa có thì đề xuất cài, chờ người dùng đồng ý.

Mức độ lỗ hổng, danh sách kiểm tra từng phần, ứng phó sự cố: [KIEM_TRA_BAO_MAT.md](KIEM_TRA_BAO_MAT.md). Khi thực hiện một phần phải mở tệp này và làm theo danh sách của phần đó.

**Cổng bảo mật đạt khi:** không còn lỗ hổng Nghiêm trọng, Cao chưa xử lý; đã quét thư viện phụ thuộc và khóa bí mật trên các commit của công việc; phần C (và D khi triển khai) có kết quả; lỗ hổng Trung bình, Thấp giữ lại có quyết định của người dùng. "Xử lý" là sửa; riêng lỗ hổng trong thư viện bên thứ ba chưa có bản vá thì người dùng có thể chấp nhận rủi ro có thời hạn, kèm biện pháp giảm thiểu, ghi vào tài liệu `22`.

**Sự cố bảo mật** (lộ khóa bí mật, lộ dữ liệu, bị truy cập trái phép): báo người dùng ngay, làm theo phần "Ứng phó sự cố bảo mật" trong tệp chi tiết. Không xóa log. Thu hồi, thay khóa bí mật khi người dùng đồng ý. Cần sửa mã thì chọn luồng theo điều kiện áp dụng của mục 13.
