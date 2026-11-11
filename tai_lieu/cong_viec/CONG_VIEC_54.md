# CONG_VIEC_54: Tuyển dụng, đánh giá hiệu suất (MODULE_08, phần 4)

- Mô tả: Mini app Nhân sự `apps/web-hr`: nhu cầu tuyển dụng qua luồng duyệt, tin tuyển dụng, trang tuyển dụng công khai chung tập đoàn, hồ sơ ứng viên, vòng phỏng vấn, đánh giá ứng viên, email cho ứng viên, đề nghị nhận việc qua luồng duyệt, chuyển ứng viên nhận việc thành hồ sơ nhân sự (CONG_VIEC_46), lưu giữ và xóa dữ liệu ứng viên; đánh giá hiệu suất theo kỳ (mẫu tiêu chí, mục tiêu, tự đánh giá, người quản lý chấm, nhân sự chốt, công bố).
- Phiên bản: 0.1
- Ngày cập nhật: 2026-11-11
- Trạng thái: Đặc tả, bản mẫu đã duyệt 2026-11-11; đang làm lát L0.
- Mức: Lớn (nghiệp vụ mới, dữ liệu cá nhân của người chưa phải người lao động, bề mặt công khai không đăng nhập, đổi quy tắc giới hạn yêu cầu của tài liệu `22`).
- Nguồn: tài liệu `01` mục 4 (MODULE_08: tuyển dụng, đánh giá hiệu suất), tài liệu `05`; quyết định của người dùng ngày 2026-11-11 (mục 17).
- Nền: CONG_VIEC_46 (hồ sơ nhân sự, schema `hr`, mini app cổng 3007), nhánh `chuc-nang/CONG_VIEC_46-nhan-su-ho-so` chưa hợp nhất vào `main`.

## 1. Mục tiêu

Mỗi công ty con tuyển người theo nhu cầu đã duyệt, nhận hồ sơ trực tiếp từ một trang tuyển dụng chung của tập đoàn, theo dõi ứng viên đến khi nhận việc và chuyển thẳng thành hồ sơ nhân sự; dữ liệu ứng viên được thu, lưu, xóa đúng Luật Bảo vệ dữ liệu cá nhân. Đánh giá hiệu suất định kỳ trên hệ thống, điểm và xếp loại tính thống nhất, nhân viên xem được kết quả của mình.

## 2. Phạm vi

Trong phạm vi: CHUC_NANG_190 đến CHUC_NANG_192.

Ngoài phạm vi (công việc sau):
- Đăng tin tự động lên trang việc làm bên ngoài; nhận hồ sơ từ hộp thư email.
- Ứng viên tự đăng nhập xem trạng thái, tự rút hồ sơ trên trang công khai (ứng viên liên hệ email tuyển dụng của công ty; nhân sự ghi nhận).
- Lịch phỏng vấn nối lịch Google, Microsoft; bài kiểm tra trực tuyến.
- Đánh giá 360 độ (đồng nghiệp, cấp dưới); phân bổ xếp loại bắt buộc theo tỷ lệ; nối kết quả đánh giá vào lương, thưởng (CONG_VIEC_48).
- Tự đề xuất chấm dứt hợp đồng theo kết quả đánh giá.
- Giới hạn số yêu cầu, ô ẩn chống máy, mã OTP ở trang tuyển dụng công khai (người dùng quyết định không chặn, mục 17; THAY_DOI_23).

## 3. Căn cứ pháp lý đã tra (2026-11-11)

| Văn bản | Điều | Nội dung dùng trong đặc tả |
|---|---|---|
| Luật Bảo vệ dữ liệu cá nhân 91/2025/QH15 (hiệu lực 2026-01-01) | Điều 25 khoản 1 điểm a | Tuyển dụng chỉ được yêu cầu cung cấp thông tin phục vụ mục đích tuyển dụng |
| | Điều 25 khoản 1 điểm b | Thông tin chỉ dùng cho tuyển dụng hoặc mục đích khác đã thỏa thuận; xử lý phải có sự đồng ý của người dự tuyển |
| | Điều 25 khoản 1 điểm c | Phải xóa, hủy thông tin đã cung cấp của người dự tuyển khi không tuyển dụng, trừ trường hợp có thỏa thuận khác |
| | Điều 25 khoản 2 điểm b, c | Dữ liệu người lao động lưu theo thời hạn pháp luật hoặc thỏa thuận; xóa khi chấm dứt hợp đồng (áp dụng cho ứng viên đã thành nhân viên theo CONG_VIEC_46) |
| | Điều 9 khoản 4 | Đồng ý thể hiện riêng cho từng mục đích; im lặng, không phản hồi không là đồng ý |
| | Điều 10 | Chủ thể được rút lại đồng ý (văn bản, kể cả điện tử); không áp dụng cho xử lý đã diễn ra |
| | Điều 4 khoản 1 điểm b, d | Quyền đồng ý, rút đồng ý; yêu cầu xóa, hạn chế xử lý |
| | Điều 14 khoản 1, 3 | Xóa khi đạt mục đích, hết thời hạn lưu, theo yêu cầu; xóa bằng biện pháp ngăn khôi phục trái phép |
| Nghị định 356/2025/NĐ-CP (hiệu lực 2026-01-01, thay Nghị định 13/2023/NĐ-CP) | Điều 6 khoản 1, 2, 3 | Đồng ý phải kiểm chứng được người đã đồng ý, ở dạng in, sao chép được (kể cả điện tử); bên kiểm soát lưu bằng chứng và chịu trách nhiệm chứng minh; không đặt mặc định đồng ý |
| | Điều 5 khoản 2 | Rút đồng ý: phản hồi trong 02 ngày làm việc, ngừng xử lý trong 15 ngày |
| | Điều 5 khoản 4 | Yêu cầu xóa: phản hồi trong 02 ngày làm việc, thực hiện trong 20 ngày |

Ghi chú: nguyên văn các điều trên đọc từ bản đăng lại trên trang thứ cấp; trước khi triển khai môi trường thật cần đối chiếu Công báo. Bộ luật Lao động 45/2019/QH14 Điều 8 khoản 1 (cấm phân biệt đối xử trong tuyển dụng) và Điều 36 khoản 1 điểm a (tiêu chí đánh giá mức độ hoàn thành công việc do người sử dụng lao động ban hành trong quy chế) được dùng làm lý do thiết kế (không thu giới tính ở trang công khai; hệ thống chỉ ghi kết quả đánh giá) nhưng chưa tra lại nguyên văn trong phiên này.

## 4. Yêu cầu nghiệp vụ và chức năng

| Mã | Yêu cầu | Người cần |
|---|---|---|
| YCAU_NGHIEPVU_112 | Phòng ban đề xuất nhu cầu tuyển dụng (vị trí, số lượng, khoảng lương, lý do) và được duyệt trước khi tuyển | Trưởng phòng, Ban giám đốc, Nhân sự |
| YCAU_NGHIEPVU_113 | Đăng tin tuyển dụng của mọi công ty con trên một trang công khai chung; người tìm việc nộp hồ sơ không cần tài khoản; nhân sự nhập được hồ sơ từ nguồn khác | Nhân sự, ứng viên |
| YCAU_NGHIEPVU_114 | Theo dõi ứng viên qua các giai đoạn, vòng phỏng vấn, đánh giá của người phỏng vấn; gửi email mời phỏng vấn và báo kết quả | Nhân sự, người phỏng vấn, ứng viên |
| YCAU_NGHIEPVU_115 | Đề nghị nhận việc được duyệt trước khi gửi; ứng viên nhận việc trở thành hồ sơ nhân sự không phải nhập lại | Nhân sự, Ban giám đốc |
| YCAU_NGHIEPVU_116 | Dữ liệu ứng viên chỉ thu thông tin cần cho tuyển dụng, có đồng ý kiểm chứng được, xóa khi không tuyển theo thời hạn hoặc theo yêu cầu; giữ lâu hơn chỉ khi ứng viên đồng ý vào kho ứng viên | Công ty (bên kiểm soát dữ liệu), ứng viên |
| YCAU_NGHIEPVU_117 | Đánh giá hiệu suất theo kỳ: mục tiêu cá nhân và tiêu chí năng lực có trọng số, tự đánh giá, người quản lý chấm, nhân sự chốt và công bố; nhân viên xem kết quả của mình | Nhân sự, Trưởng phòng, người lao động |

| Mã | Chức năng | Yêu cầu |
|---|---|---|
| CHUC_NANG_190 | Nhu cầu tuyển dụng (lập, gửi duyệt, rút, hủy, đóng, hoàn thành); tin tuyển dụng (lập, sửa, đăng, đóng, tự đóng khi hết hạn); trang tuyển dụng công khai chung tập đoàn (danh sách, chi tiết tin, nộp hồ sơ, ghi nhận đồng ý) | YCAU_NGHIEPVU_112, 113, 116 |
| CHUC_NANG_191 | Ứng viên: nhập tay, nộp công khai, đánh dấu trùng, kho ứng viên; giai đoạn hồ sơ ứng tuyển; vòng phỏng vấn, đánh giá của người phỏng vấn; email mời phỏng vấn, kết quả, đề nghị; đề nghị nhận việc qua luồng duyệt; lập hồ sơ nhân sự từ ứng viên; lưu giữ, xóa theo hạn và theo yêu cầu | YCAU_NGHIEPVU_113, 114, 115, 116 |
| CHUC_NANG_192 | Đánh giá hiệu suất: mẫu tiêu chí, kỳ đánh giá, phiếu, mục tiêu, tự đánh giá, người quản lý chấm, hiệu chỉnh, chốt, công bố, nhân viên xác nhận đã xem | YCAU_NGHIEPVU_117 |

## 5. Quy tắc nghiệp vụ

| Mã | Quy tắc | Yêu cầu |
|---|---|---|
| QUYTAC_NGHIEPVU_380 | Nhu cầu tuyển dụng thuộc một công ty. Trường: phòng ban, chi nhánh làm việc (thuộc công ty, đang dùng), chức danh (tối đa 100 ký tự), số lượng (1 đến 100), loại hợp đồng dự kiến (thử việc rồi chính thức, xác định thời hạn, không xác định thời hạn), lương tối thiểu và tối đa (VND, `numeric`, lớn hơn 0, tối thiểu không lớn hơn tối đa), ngày cần người (không trước hôm nay khi gửi), lý do (thay thế, mở rộng, vị trí mới), mô tả (tối đa 4000 ký tự). Số tự cấp khi gửi lần đầu (loại `hr.recruitment_request`). Trạng thái: nháp → chờ duyệt → đã duyệt → hoàn thành hoặc đã đóng; bị từ chối, đã rút về sửa rồi gửi lại; nháp, bị từ chối, đã rút hủy được (lý do). Luồng duyệt chung, giá trị duyệt = lương tối đa × số lượng; công ty chưa có chính sách duyệt thì gửi xong là đã duyệt; rút khi cấp đầu chưa quyết định. Đã duyệt: đóng tay được (lý do), đóng nhu cầu thì đóng mọi tin của nhu cầu. Số đã tuyển = số ứng viên đã lập hồ sơ nhân sự từ nhu cầu; bằng số lượng thì tự chuyển hoàn thành và đóng tin | YCAU_NGHIEPVU_112 |
| QUYTAC_NGHIEPVU_381 | Tin tuyển dụng thuộc nhu cầu đã duyệt (một nhu cầu nhiều tin). Trường: tiêu đề (tối đa 150 ký tự), nơi làm việc hiển thị (tối đa 100 ký tự, mặc định địa chỉ chi nhánh), hình thức (toàn thời gian, bán thời gian), mô tả công việc, yêu cầu, quyền lợi (mỗi mục tối đa 8000 ký tự, chữ thường có xuống dòng, không nhận HTML), hiển thị lương (khoảng của nhu cầu, khoảng nhập riêng nằm trong khoảng nhu cầu, thỏa thuận), hạn nộp (từ hôm nay), email liên hệ tuyển dụng (bắt buộc), đăng công khai (có, không). Trạng thái: nháp → đang đăng → đã đóng. Đăng: hạn nộp không trước hôm nay, nhu cầu còn đã duyệt. Đang đăng sửa được mọi trường (ghi nhật ký). Việc nền 0 giờ 10 phút giờ Việt Nam đóng tin quá hạn nộp; đóng tay được; đã đóng mở lại được khi nhu cầu còn đã duyệt và đặt hạn nộp mới | YCAU_NGHIEPVU_113 |
| QUYTAC_NGHIEPVU_382 | Trang tuyển dụng công khai (không đăng nhập) liệt kê tin đang đăng, đăng công khai, chưa quá hạn nộp của mọi công ty đang hoạt động; lọc theo công ty, nơi làm việc, hình thức; tìm theo tiêu đề; mỗi trang 20 tin, mới đăng trước. Chi tiết tin chỉ hiện: tiêu đề, tên công ty, nơi làm việc, hình thức, lương theo cách hiển thị, mô tả, yêu cầu, quyền lợi, hạn nộp, email liên hệ; không lộ mã nhu cầu, lương nội bộ, số lượng, người lập. Biểu mẫu nộp: họ tên (bắt buộc, tối đa 200), email (bắt buộc), điện thoại (bắt buộc, số Việt Nam 10 chữ số hoặc dạng quốc tế), tỉnh hoặc thành nơi ở (không bắt buộc), trình độ (danh mục như hồ sơ nhân sự, không bắt buộc), số năm kinh nghiệm (0 đến 50, không bắt buộc), mức lương mong muốn (không bắt buộc), thư giới thiệu (tối đa 2000 ký tự, không bắt buộc), tệp sơ yếu lý lịch (bắt buộc, PDF hoặc DOCX, tối đa 10 MB, kiểm chữ ký đầu tệp). Không thu giới tính, ngày sinh, số giấy tờ, ảnh (Điều 25 khoản 1 điểm a). Hai ô đồng ý riêng, không đánh sẵn: (1) bắt buộc: đồng ý xử lý dữ liệu để tuyển dụng cho tin này, nêu dữ liệu thu, mục đích, công ty nhận, thời hạn xóa khi không trúng tuyển, cách yêu cầu xóa; (2) không bắt buộc: đồng ý lưu vào kho ứng viên của công ty để xét tin khác trong 12 tháng. Bằng chứng đồng ý lưu: nguyên văn điều khoản đã hiện, mã phiên bản điều khoản, ngôn ngữ, thời điểm, địa chỉ IP, trình duyệt. Không giới hạn số lần nộp, không giới hạn theo IP (mục 17); nộp tin đã đóng hoặc quá hạn thì báo lỗi. Nộp xong hiện mã hồ sơ và email liên hệ để yêu cầu xóa; không gửi email xác nhận. Ngôn ngữ vi, en | YCAU_NGHIEPVU_113, 116 |
| QUYTAC_NGHIEPVU_383 | Ứng viên thuộc một công ty; hồ sơ ứng tuyển là ứng viên × tin (một ứng viên mỗi tin tối đa một hồ sơ chưa kết thúc). Nộp công khai luôn tạo ứng viên mới (không tự gộp vào ứng viên đã có), nguồn "Trang tuyển dụng"; hệ thống đánh dấu "Có thể trùng" khi cùng công ty có ứng viên khác trùng email hoặc điện thoại (không phân biệt hoa thường, bỏ khoảng trắng). Nhân sự nhập tay cùng các trường, nguồn: giới thiệu nội bộ, trang việc làm, email, khác (ghi chú nguồn tối đa 200 ký tự); nhập tay phải ghi nhận đồng ý tuyển dụng bằng tệp bằng chứng (văn bản đồng ý, ảnh chụp email hoặc tin nhắn đồng ý; PDF, JPG, PNG tối đa 10 MB) và ngày đồng ý (không sau hôm nay); đồng ý kho ứng viên ghi tương tự, không bắt buộc. Thêm ứng viên trong kho (đồng ý kho còn hạn) vào tin khác đang đăng của cùng công ty. Giai đoạn hồ sơ ứng tuyển: mới → sàng lọc → phỏng vấn → đề nghị → nhận việc; chuyển tới, lùi tự do giữa mới, sàng lọc, phỏng vấn; vào "đề nghị" khi lập đề nghị nhận việc; vào "nhận việc" khi đề nghị được chấp nhận. Kết thúc: bị loại (lý do: không đạt yêu cầu, không đạt phỏng vấn, từ chối đề nghị, không liên lạc được, tin đã đóng, khác), ứng viên rút. Kết thúc không mở lại. Tin đóng: hồ sơ chưa kết thúc ở giai đoạn mới, sàng lọc tự kết thúc lý do "tin đã đóng"; giai đoạn phỏng vấn, đề nghị, nhận việc giữ nguyên để nhân sự xử lý tiếp | YCAU_NGHIEPVU_113, 114 |
| QUYTAC_NGHIEPVU_384 | Vòng phỏng vấn thuộc hồ sơ ứng tuyển chưa kết thúc: tên vòng (tối đa 100), thời điểm bắt đầu, thời lượng (15 đến 480 phút), hình thức (trực tiếp: địa điểm bắt buộc; trực tuyến: liên kết bắt buộc), người phỏng vấn (1 đến 5 thành viên đang hoạt động của công ty). Lập vòng chuyển hồ sơ sang giai đoạn phỏng vấn (nếu đang mới, sàng lọc). Trạng thái vòng: đã lên lịch → đã xong hoặc đã hủy; đổi giờ khi đã lên lịch. Người phỏng vấn nhận thông báo chuông; xem được thông tin, tệp sơ yếu lý lịch của ứng viên mình được giao (vòng chưa hủy) mà không cần quyền tuyển dụng; mỗi người một phiếu đánh giá mỗi vòng: điểm 1 đến 5, đề xuất (đạt, cân nhắc, không đạt), nhận xét (tối đa 4000); sửa được đến khi hồ sơ kết thúc. Vòng có ít nhất một phiếu thì đánh dấu đã xong được. Người phỏng vấn không thấy phiếu của người khác cho đến khi nộp phiếu của mình | YCAU_NGHIEPVU_114 |
| QUYTAC_NGHIEPVU_385 | Email cho ứng viên gửi qua dịch vụ gửi tin của Nền tảng tới email của ứng viên: mời phỏng vấn (khi lập hoặc đổi giờ vòng, nhân sự chọn gửi; nội dung: tin, thời điểm, thời lượng, hình thức, địa điểm hoặc liên kết, email liên hệ), báo kết quả không đạt (khi loại với lý do không đạt yêu cầu, không đạt phỏng vấn; nhân sự chọn gửi), thư đề nghị nhận việc (khi đề nghị đã duyệt, nhân sự bấm gửi; nội dung: chức danh, nơi làm, mức lương, ngày bắt đầu, hạn trả lời). Mẫu cố định trong tệp dịch theo ngôn ngữ ứng viên đã nộp (nhập tay: vi); nhân sự xem trước, thêm lời nhắn (tối đa 2000 ký tự). Lịch sử email lưu: loại, tiêu đề, thân thư, thời điểm, người gửi; ứng viên bị xóa thì xóa thân thư | YCAU_NGHIEPVU_114, 115 |
| QUYTAC_NGHIEPVU_386 | Đề nghị nhận việc thuộc hồ sơ ứng tuyển chưa kết thúc, mỗi hồ sơ tối đa một đề nghị chưa kết thúc. Trường: chức danh, phòng ban, chi nhánh (mặc định theo nhu cầu), loại hợp đồng dự kiến, mức lương (lớn hơn 0), ngày bắt đầu dự kiến (không trước hôm nay khi gửi), hạn trả lời (từ hôm nay đến trước ngày bắt đầu), ghi chú. Mức lương ngoài khoảng lương của nhu cầu thì cảnh báo và bắt buộc nhập lý do (hiện trên yêu cầu duyệt). Số tự cấp khi gửi lần đầu (loại `hr.job_offer`). Trạng thái: nháp → chờ duyệt → đã duyệt → đã gửi → đã chấp nhận hoặc bị từ chối hoặc hết hạn; bị từ chối duyệt, đã rút về sửa rồi gửi lại; hủy được khi chưa chấp nhận (lý do). Luồng duyệt chung, giá trị duyệt = mức lương; chưa có chính sách thì gửi xong là duyệt. "Đã gửi" ghi khi gửi thư đề nghị qua email hoặc nhân sự đánh dấu đã báo ngoài hệ thống. Nhân sự ghi trả lời của ứng viên (ngày trả lời); chấp nhận chuyển hồ sơ sang "nhận việc"; ứng viên từ chối thì hồ sơ kết thúc lý do "từ chối đề nghị". Việc nền 0 giờ 10 phút chuyển đề nghị đã gửi quá hạn trả lời sang hết hạn (hồ sơ giữ giai đoạn đề nghị) | YCAU_NGHIEPVU_115 |
| QUYTAC_NGHIEPVU_387 | Lập hồ sơ nhân sự từ ứng viên: hồ sơ ứng tuyển ở giai đoạn nhận việc, chưa có hồ sơ nhân sự. Mở biểu mẫu hồ sơ nhân sự (MAN_HINH_115) điền sẵn họ tên, điện thoại, email cá nhân, trình độ, phòng ban, chi nhánh, chức danh, ngày vào làm = ngày bắt đầu của đề nghị; nhân sự nhập các trường bắt buộc còn lại theo QUYTAC_NGHIEPVU_292 đến 294. Lưu: tạo hồ sơ nhân sự và trong cùng giao dịch ghi liên kết hồ sơ ứng tuyển → hồ sơ nhân sự, chép tệp sơ yếu lý lịch thành giấy tờ loại "Sơ yếu lý lịch" của hồ sơ nhân sự, tăng số đã tuyển của nhu cầu (QUYTAC_NGHIEPVU_380). Sau đó gợi ý lập hợp đồng (MAN_HINH_118). Ứng viên đã có hồ sơ nhân sự không bị xóa theo QUYTAC_NGHIEPVU_388; dữ liệu ứng viên theo thời hạn lưu của hồ sơ nhân sự | YCAU_NGHIEPVU_115 |
| QUYTAC_NGHIEPVU_388 | Lưu giữ dữ liệu ứng viên. Cài đặt theo công ty: số ngày giữ sau khi không tuyển (mặc định 30, từ 0 đến 90), số tháng giữ trong kho ứng viên (mặc định 12, từ 1 đến 24). Ngày xóa của ứng viên chưa có hồ sơ nhân sự: có đồng ý kho còn hiệu lực thì ngày đồng ý kho gần nhất cộng số tháng kho; không thì khi mọi hồ sơ ứng tuyển đã kết thúc, ngày kết thúc muộn nhất cộng số ngày giữ; còn hồ sơ chưa kết thúc thì chưa có ngày xóa. Việc nền 1 giờ giờ Việt Nam xóa ứng viên đến ngày xóa. Xóa (khử nhận dạng, không khôi phục): xóa mọi tệp trên kho lưu trữ, đặt họ tên "Ứng viên đã xóa", xóa email, điện thoại, nơi ở, thư giới thiệu, lương mong muốn, ghi chú, nguyên văn điều khoản, địa chỉ IP, trình duyệt của bằng chứng đồng ý, nhận xét phỏng vấn, thân email đã gửi, ghi chú đề nghị; giữ nguồn, tin, giai đoạn, lý do kết thúc, điểm phỏng vấn, ngày, mức lương đề nghị để thống kê; nhật ký thao tác ghi việc xóa (không ghi dữ liệu đã xóa). Theo yêu cầu của ứng viên: nhân sự ghi "Yêu cầu xóa" (ngày nhận, kênh, tệp bằng chứng không bắt buộc) → hồ sơ chưa kết thúc kết thúc "ứng viên rút", đề nghị chưa kết thúc bị hủy, xóa ngay (trong hạn 20 ngày của Nghị định 356/2025/NĐ-CP Điều 5 khoản 4); "Rút đồng ý kho" → tính lại ngày xóa. Danh sách "Sắp đến hạn xóa" (7 ngày tới) | YCAU_NGHIEPVU_116 |
| QUYTAC_NGHIEPVU_389 | Đánh giá hiệu suất. Mẫu đánh giá: tên, danh sách tiêu chí năng lực (tên tối đa 150, mô tả tối đa 1000, trọng số phần trăm nguyên từ 1), tổng trọng số 100; mẫu đã dùng trong kỳ không sửa tiêu chí (sao chép thành mẫu mới). Kỳ đánh giá: tên, từ ngày đến ngày, mẫu, tỷ trọng mục tiêu và tỷ trọng năng lực (số nguyên 0 đến 100, tổng 100), ngưỡng xếp loại A, B, C (điểm tối thiểu, mặc định 4,5; 3,5; 2,5; dưới C là D; giảm dần), hạn đặt mục tiêu, hạn tự đánh giá, hạn người quản lý chấm (tăng dần), đối tượng (mọi phòng ban hoặc chọn phòng ban). Trạng thái kỳ: nháp → đang mở → đã chốt → đã công bố. Mở kỳ: tạo phiếu cho mỗi hồ sơ đang làm thuộc đối tượng (theo phòng ban hiện hành tại ngày mở) có ngày vào làm không sau ngày kết thúc kỳ; người chấm mặc định = trưởng phòng của phòng ban hiện hành có tài khoản liên kết; không có trưởng phòng, hoặc trưởng phòng chính là nhân viên, thì để trống để nhân sự gán; nhân sự thêm, loại phiếu (lý do), đổi người chấm khi kỳ đang mở. Phiếu: (1) mục tiêu (tỷ trọng mục tiêu lớn hơn 0): nhân viên hoặc người chấm lập mục tiêu (tên tối đa 200, chỉ tiêu tối đa 1000, trọng số nguyên từ 1, tổng 100), người chấm xác nhận; (2) tự đánh giá: nhân viên chấm 1 đến 5 từng mục tiêu, tiêu chí kèm nhận xét, nộp (không bắt buộc; quá hạn tự đánh giá thì khóa); (3) người chấm chấm 1 đến 5 mọi mục tiêu, tiêu chí (bắt buộc), nhận xét chung, nộp; nộp xong nhân sự mở lại được. Nhân viên chưa có tài khoản liên kết thì bỏ qua bước tự đánh giá. Điểm mục tiêu = tổng (trọng số × điểm) / 100; điểm năng lực tương tự; điểm tổng = (tỷ trọng mục tiêu × điểm mục tiêu + tỷ trọng năng lực × điểm năng lực) / 100, làm tròn 2 chữ số thập phân; xếp loại theo ngưỡng. Chỉ điểm người chấm tính vào kết quả. Nhân sự hiệu chỉnh điểm tổng cuối (1,00 đến 5,00, lý do bắt buộc, ghi nhật ký; xếp loại theo điểm hiệu chỉnh). Chốt kỳ khi mọi phiếu chưa loại đã nộp; công bố: nhân viên có tài khoản liên kết nhận thông báo, xem điểm từng mục, điểm tổng, xếp loại, nhận xét người chấm, xác nhận đã xem và ghi ý kiến (tối đa 2000, một lần). Trước công bố nhân viên chỉ thấy mục tiêu và tự đánh giá của mình. Hạn quá thì nhắc qua thông báo chuông lúc 8 giờ giờ Việt Nam ngày sau hạn (một lần mỗi hạn mỗi phiếu), không khóa bước của người chấm | YCAU_NGHIEPVU_117 |

## 6. Vai trò và quyền

| Quyền | Ý nghĩa | Nhạy cảm |
|---|---|---|
| `hr.recruitment.request` | Lập, sửa, gửi, rút, hủy nhu cầu tuyển dụng của mình; xem nhu cầu mình lập và số đã tuyển | Không |
| `hr.recruitment.manage` | Xem mọi nhu cầu, đóng nhu cầu; tin tuyển dụng; ứng viên, hồ sơ ứng tuyển, vòng phỏng vấn, email, đề nghị nhận việc (có mức lương); tải tệp ứng viên; yêu cầu xóa; cài đặt lưu giữ; lập hồ sơ nhân sự từ ứng viên (kèm `hr.employee.manage`) | Có |
| `hr.review.manage` | Mẫu đánh giá, kỳ đánh giá, mọi phiếu, gán người chấm, hiệu chỉnh, chốt, công bố | Có |

- Quyền gán ở phạm vi tập đoàn hoặc công ty, như CONG_VIEC_46.
- Vai trò có sẵn: `hr_manager` thêm cả ba quyền; `hr_staff` thêm `hr.recruitment.manage`, `hr.review.manage`. Quản trị công ty, Quản trị tập đoàn có mọi quyền mới. Trưởng phòng được quản trị gán `hr.recruitment.request` qua vai trò tùy chỉnh (không tạo vai trò mới).
- Không cần quyền: người phỏng vấn với ứng viên được giao; người chấm với phiếu được giao; nhân viên với phiếu của mình (như "Hồ sơ của tôi", chỉ cần là thành viên công ty đang chọn).
- Trang tuyển dụng công khai: không đăng nhập.
- Loại chứng từ mới: `hr.recruitment_request` (Nhu cầu tuyển dụng, cần duyệt), `hr.job_offer` (Đề nghị nhận việc, cần duyệt).

## 7. Luồng nghiệp vụ

- Luồng 1 – Nhu cầu: Trưởng phòng lập nhu cầu → gửi duyệt → duyệt xong nhân sự lập tin tuyển dụng → đăng công khai.
- Luồng 2 – Nhận hồ sơ: Người tìm việc mở trang tuyển dụng chung → chọn tin → điền biểu mẫu, tải sơ yếu lý lịch, đánh dấu đồng ý → nộp → thấy mã hồ sơ. Hoặc nhân sự nhập tay kèm bằng chứng đồng ý.
- Luồng 3 – Sàng lọc, phỏng vấn: Nhân sự chuyển giai đoạn → lập vòng phỏng vấn, gửi email mời → người phỏng vấn ghi đánh giá → nhân sự loại (gửi email kết quả) hoặc lập đề nghị.
- Luồng 4 – Nhận việc: Đề nghị gửi duyệt → duyệt xong gửi thư đề nghị qua email → ghi ứng viên chấp nhận → lập hồ sơ nhân sự từ ứng viên → lập hợp đồng (CONG_VIEC_46). Đủ số lượng thì nhu cầu hoàn thành, tin đóng.
- Luồng 5 – Xóa: Ứng viên không trúng tuyển → 30 ngày sau hồ sơ cuối kết thúc hệ thống tự xóa; đồng ý kho thì giữ 12 tháng. Ứng viên yêu cầu xóa qua email liên hệ → nhân sự ghi yêu cầu → xóa ngay.
- Luồng 6 – Đánh giá: Nhân sự lập mẫu, kỳ → mở kỳ (tạo phiếu, gán người chấm) → nhân viên đặt mục tiêu, người chấm xác nhận → nhân viên tự đánh giá → người chấm chấm, nộp → nhân sự hiệu chỉnh, chốt, công bố → nhân viên xem, xác nhận.

## 8. Màn hình (giai đoạn 06.1)

| Mã | Màn hình | Nội dung | Vai trò |
|---|---|---|---|
| MAN_HINH_168 | Nhu cầu tuyển dụng | Danh sách (số, chức danh, phòng ban, số lượng, đã tuyển, ngày cần, trạng thái; lọc trạng thái, phòng ban); biểu mẫu; chi tiết: thông tin, tiến trình duyệt, danh sách tin, nút gửi, rút, hủy, đóng, lập tin | `hr.recruitment.request` (của mình), `hr.recruitment.manage` |
| MAN_HINH_169 | Tin tuyển dụng | Danh sách tin (tiêu đề, nhu cầu, hạn nộp, công khai, số hồ sơ theo giai đoạn, trạng thái); biểu mẫu tin; chi tiết tin: đầu trang, thẻ đếm theo giai đoạn, bảng hồ sơ ứng tuyển (họ tên, nguồn, nộp lúc, giai đoạn, nhãn trùng), nút thêm ứng viên, thêm từ kho, đăng, đóng, xem trang công khai | `hr.recruitment.manage` |
| MAN_HINH_170 | Ứng viên | Danh sách mọi ứng viên (thẻ: tất cả, kho ứng viên, sắp đến hạn xóa; tìm theo tên, email, điện thoại); chi tiết ứng viên: thông tin, tệp, bằng chứng đồng ý, ngày xóa dự kiến, hồ sơ ứng tuyển (giai đoạn, chuyển, loại), vòng phỏng vấn và phiếu đánh giá, đề nghị nhận việc (tiến trình duyệt, gửi thư, ghi trả lời), email đã gửi, nút lập hồ sơ nhân sự, yêu cầu xóa, rút đồng ý kho; cài đặt lưu giữ. Người phỏng vấn: danh sách chỉ ứng viên được giao, chi tiết rút gọn và phiếu đánh giá của mình | `hr.recruitment.manage`; người phỏng vấn được giao |
| MAN_HINH_171 | Trang tuyển dụng công khai | Danh sách tin (lọc công ty, nơi làm việc, hình thức, tìm); chi tiết tin; biểu mẫu nộp hồ sơ có hai ô đồng ý; trang đã nộp (mã hồ sơ, email liên hệ); chọn ngôn ngữ | Không đăng nhập |
| MAN_HINH_172 | Quản lý đánh giá hiệu suất | Thẻ Kỳ đánh giá (danh sách, biểu mẫu kỳ, chi tiết kỳ: bảng phiếu với người chấm, tiến độ, điểm, xếp loại, phân bố xếp loại; gán người chấm, thêm, loại phiếu, hiệu chỉnh, chốt, công bố) và thẻ Mẫu đánh giá (danh sách, biểu mẫu tiêu chí, sao chép) | `hr.review.manage` |
| MAN_HINH_173 | Phiếu đánh giá | Danh sách "Đánh giá của tôi" (phiếu của mình, phiếu mình chấm); phiếu: mục tiêu (lập, xác nhận), tự đánh giá, người chấm chấm, điểm tạm tính, kết quả sau công bố, xác nhận đã xem, ý kiến; nhân sự xem mọi phiếu, hiệu chỉnh | Nhân viên, người chấm, `hr.review.manage` |

Điều hướng: trang chủ mini app → Nhân sự → menu thêm: Tuyển dụng (168 → 169 → 170), Ứng viên (170), Đánh giá hiệu suất (172 → 173), Đánh giá của tôi (173, mọi nhân viên). Menu "Ứng viên" hiện cho người có `hr.recruitment.manage` hoặc đang được giao phỏng vấn. MAN_HINH_171 ở đường dẫn công khai `/hr/careers`, không có khung mini app. Thông báo phỏng vấn mở 170; thông báo đánh giá mở 173.

## 9. Dữ liệu và API (phác thảo, chi tiết ở giai đoạn 07)

- Schema `hr` (chỉ module Nhân sự ghi).
- Database migration `0098_hr_recruitment.sql`: `hr.recruitment_settings` (công ty, số ngày giữ, số tháng kho), `hr.recruitment_requests`, `hr.job_postings`, `hr.candidates` (ngày xóa dự kiến, ngày đã xóa, đánh dấu trùng, ngôn ngữ), `hr.candidate_files` (sơ yếu lý lịch, bằng chứng đồng ý, bằng chứng yêu cầu xóa), `hr.candidate_consents` (mục đích tuyển dụng hoặc kho, phiên bản, nguyên văn, ngày đồng ý, ngày rút, IP, trình duyệt, kênh), `hr.applications` (giai đoạn, lý do kết thúc, hồ sơ nhân sự đã lập); quyền, vai trò, loại chứng từ, dãy số.
- Database migration `0099_hr_recruitment_process.sql`: `hr.interviews`, `hr.interview_evaluations` (người phỏng vấn, điểm, đề xuất, nhận xét; duy nhất theo vòng và người), `hr.candidate_emails`, `hr.job_offers`.
- Database migration `0100_hr_performance.sql`: `hr.review_templates`, `hr.review_criteria`, `hr.review_cycles`, `hr.review_cycle_departments`, `hr.reviews`, `hr.review_goals`, `hr.review_scores` (mục tiêu hoặc tiêu chí, người chấm hoặc tự đánh giá), `hr.review_reminders`.
- API_200 `/hr/recruitment-requests` (danh sách, chi tiết, lập, sửa, gửi, rút, hủy, đóng); API_201 `/hr/job-postings` (danh sách, chi tiết kèm hồ sơ ứng tuyển, lập, sửa, đăng, đóng, mở lại); API_202 `/hr/candidates` (danh sách, chi tiết, lập, sửa, tệp, đồng ý, thêm vào tin, giai đoạn, kết thúc, vòng phỏng vấn, phiếu đánh giá, email xem trước và gửi, yêu cầu xóa, rút đồng ý kho, cài đặt lưu giữ, danh sách được giao phỏng vấn); API_203 `/hr/job-offers` (lập, sửa, gửi duyệt, rút, hủy, gửi thư, ghi trả lời, lập hồ sơ nhân sự); API_204 `/careers` công khai (danh sách tin, chi tiết, điều khoản đồng ý theo ngôn ngữ, nộp hồ sơ); API_205 `/hr/review-templates`, `/hr/review-cycles`, `/hr/reviews` (mẫu, kỳ, mở, chốt, công bố, phiếu, mục tiêu, chấm, nộp, hiệu chỉnh, của tôi, xác nhận đã xem).
- Dịch vụ dùng lại: dãy số chứng từ, luồng duyệt (`submitWithin`, `withdraw`, `cancelWithin`, `core.approval.completed`), lưu tệp, thông báo, nhật ký thao tác, gửi tin (`OUTBOUND_MESSAGES`), `EmployeesService.create` và lưu giấy tờ của CONG_VIEC_46.
- Việc nền mới (BullMQ, múi giờ `Asia/Ho_Chi_Minh`): `hr-recruitment-daily` (0 giờ 10 phút: đóng tin quá hạn, đề nghị hết hạn), `hr-candidate-erasure` (1 giờ), `hr-review-reminders` (8 giờ).

## 10. Điều kiện đặc biệt

- Trang công khai không lộ dữ liệu nội bộ; API công khai trả lỗi chung "không tìm thấy" cho tin không đăng công khai, đã đóng, của công ty ngừng hoạt động.
- Nộp hồ sơ: lưu tệp trước, ghi cơ sở dữ liệu trong giao dịch; lỗi thì xóa tệp vừa lưu.
- Xóa ứng viên: xóa tệp trên kho lưu trữ trước, rồi khử nhận dạng trong giao dịch; tệp xóa lỗi thì giữ ứng viên ở hàng chờ, việc nền chạy lại; chạy lại không lỗi khi tệp đã mất.
- Lập hồ sơ nhân sự từ ứng viên, tăng số đã tuyển: khóa nhu cầu (`FOR UPDATE`) để không vượt số lượng khi hai yêu cầu đồng thời.
- Bỏ giới hạn yêu cầu theo IP ở API_204 là thay đổi quy tắc tài liệu `22` mục 3 (LOI_02): THAY_DOI_23; chấp nhận rủi ro ghi trong tài liệu `22` mục 8 (hồ sơ rác hàng loạt, đầy kho lưu trữ, tốn tài nguyên). Giới hạn kích thước tệp 10 MB, kiểm loại tệp, kiểm dữ liệu vẫn giữ.

## 11. Tiêu chí nghiệm thu

| Mã | Tiêu chí | Mức |
|---|---|---|
| TIEUCHI_NGHIEMTHU_359 | Nhu cầu tuyển dụng: kiểm trường, khoảng lương; qua luồng duyệt (có, không có chính sách); rút, hủy, đóng; tin chỉ lập từ nhu cầu đã duyệt; đủ số đã tuyển thì hoàn thành và đóng tin; người chỉ có `hr.recruitment.request` chỉ thấy nhu cầu của mình | Bắt buộc |
| TIEUCHI_NGHIEMTHU_360 | Trang công khai: chỉ hiện tin đang đăng công khai chưa quá hạn; không lộ trường nội bộ; nộp không cần đăng nhập; thiếu đồng ý tuyển dụng bị chặn; bằng chứng đồng ý lưu đủ; tệp sai loại, quá 10 MB bị chặn; tin đã đóng bị chặn; đánh dấu trùng đúng | Bắt buộc |
| TIEUCHI_NGHIEMTHU_361 | Ứng viên: nhập tay cần bằng chứng đồng ý; giai đoạn chuyển đúng quy tắc, kết thúc không mở lại; tin đóng kết thúc hồ sơ mới, sàng lọc; vòng phỏng vấn, phiếu đánh giá; người phỏng vấn chỉ thấy ứng viên được giao; công ty khác nhận `404`, người không có quyền nhận `403` | Bắt buộc |
| TIEUCHI_NGHIEMTHU_362 | Email mời phỏng vấn, báo kết quả, thư đề nghị gửi tới đúng email ứng viên, đúng ngôn ngữ, có lời nhắn thêm; lịch sử email ghi đủ | Bắt buộc |
| TIEUCHI_NGHIEMTHU_363 | Đề nghị nhận việc: qua luồng duyệt, ngoài khoảng lương phải có lý do, một đề nghị chưa kết thúc mỗi hồ sơ, trả lời, hết hạn; lập hồ sơ nhân sự từ ứng viên điền sẵn đúng, chép sơ yếu lý lịch, liên kết, tăng số đã tuyển, không vượt số lượng | Bắt buộc |
| TIEUCHI_NGHIEMTHU_364 | Lưu giữ: ngày xóa tính đúng (không tuyển, kho, rút đồng ý kho, cài đặt công ty); việc nền xóa đúng hạn, xóa hết tệp và trường cá nhân, giữ trường thống kê, chạy lại không lỗi; yêu cầu xóa xóa ngay; ứng viên đã thành nhân viên không bị xóa | Bắt buộc |
| TIEUCHI_NGHIEMTHU_365 | Đánh giá hiệu suất: trọng số tổng 100; mở kỳ tạo phiếu đúng đối tượng, người chấm; điểm, xếp loại đúng công thức và ngưỡng; hạn tự đánh giá khóa đúng; hiệu chỉnh cần lý do; chốt chỉ khi đủ phiếu; nhân viên chỉ thấy kết quả sau công bố; người chấm chỉ phiếu được giao; nhắc quá hạn mỗi hạn một lần | Bắt buộc |
| TIEUCHI_NGHIEMTHU_366 | MAN_HINH_168 đến MAN_HINH_173 đạt danh sách rà soát giao diện trên máy tính và điện thoại | Bắt buộc |

## 12. Kịch bản kiểm thử

KICHBAN_KIEMTHU_522 đến KICHBAN_KIEMTHU_529 tự động (`apps/api/test/c54-*.test.ts`): 522 nhu cầu tuyển dụng và luồng duyệt; 523 tin tuyển dụng, tự đóng; 524 trang công khai, nộp hồ sơ, đồng ý, trùng; 525 ứng viên, giai đoạn, phỏng vấn, quyền, cách ly công ty; 526 email ứng viên; 527 đề nghị nhận việc, lập hồ sơ nhân sự; 528 lưu giữ, xóa; 529 đánh giá hiệu suất. KICHBAN_KIEMTHU_530 (trình duyệt máy tính), KICHBAN_KIEMTHU_531 (điện thoại) thủ công; ghi trong tài liệu `21` khi trình nghiệm thu (gửi phiên cha ghi sổ nếu cần).

## 13. Ràng buộc kỹ thuật

- Không thêm thư viện.
- Module `apps/api/src/hr` (tệp mới `recruitment-*.ts`, `reviews*.ts`; controller riêng `recruitment.controller.ts`, `careers.controller.ts`, `reviews.controller.ts` để không sửa cùng chỗ với CONG_VIEC_47, 48); chỉ ghi schema `hr`.
- Mini app `apps/web-hr`: trang mới dưới `src/app/recruitment`, `src/app/candidates`, `src/app/reviews`, `src/app/careers`; khung mini app bỏ qua đường dẫn `/careers`.
- Chuỗi giao diện, mẫu email trong `packages/i18n`; lược đồ zod trong `packages/contracts` (tệp mới); giá trị giao diện từ tài liệu `15` (không cần giá trị mới).
- Tệp dùng chung phải sửa (thêm dòng, không đổi dòng cũ): danh mục quyền, đăng ký module, lịch việc nền, menu `HrShell`.

## 14. Thành phần không được thay đổi

Luồng duyệt chung, dãy số chứng từ, đăng nhập, phân quyền; hồ sơ nhân sự, hợp đồng của CONG_VIEC_46 (chỉ gọi hàm có sẵn; nếu cần tách hàm lập hồ sơ dùng trong giao dịch thì giữ nguyên hành vi API cũ); giới hạn yêu cầu theo IP của các API công khai khác.

## 15. Các lát và điểm xem trước

- L0: database migration 0098; quyền, vai trò, loại chứng từ; nhu cầu tuyển dụng, tin tuyển dụng, trang công khai, nộp hồ sơ, nhập tay ứng viên, đồng ý, giai đoạn cơ bản; MAN_HINH_168, MAN_HINH_169, MAN_HINH_171, MAN_HINH_170 (danh sách, thông tin, tệp, đồng ý). Điểm xem trước: lập và duyệt nhu cầu, đăng tin, nộp hồ sơ từ trang công khai, thấy ứng viên trong tin.
- L1: database migration 0099; vòng phỏng vấn, phiếu đánh giá, email, đề nghị nhận việc, lập hồ sơ nhân sự, lưu giữ và xóa, việc nền; MAN_HINH_170 đủ. Điểm xem trước: phỏng vấn, email trong log, duyệt đề nghị, chuyển thành hồ sơ nhân sự, xóa ứng viên.
- L2: database migration 0100; đánh giá hiệu suất; MAN_HINH_172, MAN_HINH_173. Điểm xem trước: mở kỳ, đặt mục tiêu, tự đánh giá, chấm, chốt, công bố, nhân viên xem.

## 16. Quyết định AI tự đưa ra (trong phạm vi quyết định của người dùng)

- Ứng viên thuộc công ty của tin (pháp nhân tuyển dụng là bên kiểm soát dữ liệu); không chia sẻ ứng viên giữa công ty con.
- Nộp công khai không tự gộp vào ứng viên đã có (người ngoài không gắn được dữ liệu vào hồ sơ người khác); chỉ đánh dấu trùng.
- Trang công khai không thu giới tính, ngày sinh, số giấy tờ, ảnh (tối thiểu hóa dữ liệu, tránh phân biệt đối xử); các trường này nhập khi lập hồ sơ nhân sự.
- Tệp sơ yếu lý lịch nhận PDF, DOCX (DOCX là định dạng phổ biến của sơ yếu lý lịch).
- Thời gian giữ 30 ngày sau khi không tuyển để trả lời khiếu nại, xem lại; cấu hình 0 đến 90 ngày.
- Xóa là khử nhận dạng: giữ số liệu không định danh để thống kê tuyển dụng.
- Người phỏng vấn, người chấm không cần quyền nhân sự, chỉ thấy đúng phần được giao.
- Không gửi email xác nhận đã nhận hồ sơ (người dùng chỉ chọn email mời phỏng vấn và kết quả; thư đề nghị là kết quả trúng tuyển).

## 17. Quyết định của người dùng (2026-11-11)

- Ứng viên không trúng tuyển: tự xóa sau 30 ngày; đồng ý vào kho ứng viên thì giữ 12 tháng; thời hạn cấu hình theo công ty.
- Có trang ứng tuyển công khai; một trang chung cả tập đoàn.
- Trang công khai không OTP, không giới hạn số lần nộp, bỏ cả giới hạn theo IP: THAY_DOI_23 (chấp nhận rủi ro ghi ở tài liệu `22` mục 8).
- Gửi email mời phỏng vấn và kết quả cho ứng viên.
- Đề nghị nhận việc qua luồng duyệt chung.
- Đánh giá hiệu suất: mục tiêu và năng lực có trọng số, thang 1 đến 5, xếp loại A, B, C, D theo ngưỡng của kỳ; người quản lý chấm là điểm chính thức, tự đánh giá để tham khảo.
- Trưởng phòng chấm, nhân sự hiệu chỉnh, chốt và công bố; nhân viên xem, xác nhận, ghi ý kiến; không đi luồng duyệt chung.
- Nhu cầu tuyển dụng qua luồng duyệt (giao việc của phiên cha).
