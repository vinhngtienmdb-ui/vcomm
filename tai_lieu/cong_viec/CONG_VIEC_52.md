# CONG_VIEC_52: Văn phòng số phần 1 (MODULE_13)

- Mô tả: Mini app Văn phòng số `apps/web-office`: quản lý công việc (giao việc, hạn, người theo dõi, bình luận, đính kèm, việc liên công ty trong tập đoàn); quy trình công việc theo mẫu có nhánh rẽ, song song; công văn đến, đi theo Nghị định 30/2020/NĐ-CP (sổ, số đến, số đi, ký hiệu, độ khẩn, soạn đúng thể thức, xuất PDF và Word, trình ký qua luồng duyệt chung); bảng tin nội bộ.
- Phiên bản: 0.1
- Ngày cập nhật: 2026-11-11
- Trạng thái: Bản nháp, chờ người dùng duyệt đặc tả. Người dùng cho AI tự làm theo kế hoạch, chỉ hỏi điểm nghiệp vụ chưa rõ.
- Mức: Lớn (module mới, mini app mới, thêm thư viện `docx`, dữ liệu liên công ty).
- Nguồn: tài liệu `01` mục 4 (MODULE_13), tài liệu `05` (Văn phòng số: công việc, quy trình, công văn, bảng tin nội bộ); quyết định của người dùng ngày 2026-11-11 (mục 17).

## 1. Mục tiêu

Nhân viên các công ty trong tập đoàn giao, nhận, theo dõi công việc trên một hệ thống; quy trình lặp lại được chuẩn hóa thành mẫu chạy tự động; công văn đến, đi được vào sổ, đánh số, trình ký, phát hành đúng Nghị định 30/2020/NĐ-CP và theo dõi đến khi xử lý xong; thông tin nội bộ đến đúng người, biết ai đã đọc.

## 2. Phạm vi

Trong phạm vi: CHUC_NANG_182 đến CHUC_NANG_185; mini app Văn phòng số `apps/web-office` (cổng 3011), đường dẫn `/office`, mã mini app `office` (thêm vào `core.apps`).

Ngoài phạm vi (công việc sau):
- Chữ ký số (người ký ký trên hệ thống), kho hợp đồng (tài liệu `01` mục 4).
- Độ mật (Mật, Tối mật, Tuyệt mật) và quy trình bảo vệ bí mật nhà nước; văn bản quy phạm pháp luật.
- Gửi, nhận văn bản điện tử với hệ thống ngoài (Trục liên thông văn bản quốc gia, email tự động); lập hồ sơ, nộp lưu vào lưu trữ cơ quan.
- Trình thiết kế quy trình kéo thả (người dùng chọn biểu mẫu bước và điều kiện); ứng dụng điện thoại riêng (giao diện web dùng được trên điện thoại).
- Công việc lặp lại theo lịch; tính thời hạn theo ngày làm việc, ngày lễ; báo cáo hiệu suất công việc.

## 3. Căn cứ pháp lý

Nghị định 30/2020/NĐ-CP về công tác văn thư (ban hành 05/03/2020). Ngày 2026-11-11 chưa tra được toàn văn trên kho văn bản luật (hết lượt tra cứu trong ngày); nội dung dưới đây theo hiểu biết của AI và bộ quy tắc thể thức có sẵn, **phải đối chiếu bản gốc trên Công báo trước khi phát hành** (ghi rủi ro ở mục 18).

| Điều, phụ lục | Nội dung dùng trong đặc tả |
|---|---|
| Điều 2 | Áp dụng bắt buộc với cơ quan, tổ chức nhà nước và doanh nghiệp nhà nước; doanh nghiệp khác áp dụng theo lựa chọn của người dùng (áp dụng đầy đủ, mục 17) |
| Điều 7, 8 | 29 loại văn bản hành chính (Nghị quyết cá biệt, Quyết định cá biệt, Chỉ thị, Quy chế, Quy định, Thông cáo, Thông báo, Hướng dẫn, Chương trình, Kế hoạch, Phương án, Đề án, Dự án, Báo cáo, Biên bản, Tờ trình, Hợp đồng, Công văn, Công điện, Bản ghi nhớ, Bản thỏa thuận, Giấy ủy quyền, Giấy mời, Giấy giới thiệu, Giấy nghỉ phép, Phiếu gửi, Phiếu chuyển, Phiếu báo, Thư công) |
| Điều 15 | Số văn bản theo thứ tự đăng ký tại văn thư trong năm, bắt đầu từ 01 ngày 01 tháng 01, kết thúc ngày 31 tháng 12; hội đồng, ban, tổ có hệ thống số riêng |
| Điều 16 | Văn thư kiểm tra thể thức, ghi số, ngày tháng, đóng dấu, đăng ký văn bản đi rồi phát hành |
| Điều 20 đến 24 | Văn bản đến: tiếp nhận, đăng ký (số đến theo thứ tự trong năm), trình người có thẩm quyền cho ý kiến phân phối, chuyển giao, giải quyết và theo dõi, đôn đốc |
| Phụ lục I | Thể thức, kỹ thuật trình bày: khổ A4, lề, phông Times New Roman, cỡ chữ, kiểu chữ từng thành phần (mục 5, QUYTAC_NGHIEPVU_366) |
| Phụ lục III | Chữ viết tắt tên loại văn bản (QĐ, TB, BC, TTr, KH…); công văn không có tên loại, ký hiệu gồm viết tắt tên cơ quan và đơn vị soạn thảo |
| Phụ lục IV | Mẫu sổ đăng ký văn bản đi, văn bản đến (các cột ở QUYTAC_NGHIEPVU_363) |

## 4. Yêu cầu nghiệp vụ và chức năng

| Mã | Yêu cầu | Người cần |
|---|---|---|
| YCAU_NGHIEPVU_98 | Giao việc có người chủ trì, người phối hợp, người theo dõi, hạn, mức ưu tiên; trao đổi, đính kèm tệp ngay trên việc; biết việc sắp đến hạn, quá hạn | Mọi nhân viên, trưởng phòng |
| YCAU_NGHIEPVU_99 | Giao việc cho người ở công ty khác trong tập đoàn mà không lộ dữ liệu khác của công ty giao việc | Ban giám đốc, nhân viên |
| YCAU_NGHIEPVU_100 | Chuẩn hóa quy trình lặp lại thành mẫu có bước, nhánh rẽ theo kết quả hoặc dữ liệu, bước song song; chạy mẫu thì hệ thống tự giao việc từng bước | Trưởng phòng, Ban giám đốc |
| YCAU_NGHIEPVU_101 | Công văn đến được vào sổ, cấp số đến, trình lãnh đạo, giao xử lý và theo dõi đến khi xong | Văn thư, lãnh đạo, người xử lý |
| YCAU_NGHIEPVU_102 | Công văn đi soạn đúng thể thức Nghị định 30, trình ký qua luồng duyệt, văn thư cấp số sau khi duyệt, lưu bản đã ký, phát hành đến nơi nhận | Người soạn, người ký, văn thư |
| YCAU_NGHIEPVU_103 | Sổ công văn đến, đi theo năm, tra cứu, xuất sổ theo mẫu | Văn thư, lãnh đạo |
| YCAU_NGHIEPVU_104 | Thông tin nội bộ đến đúng công ty, chi nhánh, phòng ban; biết ai đã đọc tin quan trọng | Ban giám đốc, hành chính, nhân viên |

| Mã | Chức năng | Yêu cầu |
|---|---|---|
| CHUC_NANG_182 | Công việc: lập, giao (cả người công ty khác trong tập đoàn), việc con, cập nhật tiến độ, chuyển trạng thái, người theo dõi, bình luận, đính kèm, nhắc hạn; danh sách Việc của tôi, Tôi giao, Theo dõi, Việc của công ty | YCAU_NGHIEPVU_98, 99 |
| CHUC_NANG_183 | Quy trình theo mẫu: thiết kế mẫu (biểu mẫu khởi tạo, bước, kết quả, điều kiện chuyển, song song, gộp), kiểm tra hợp lệ, phiên bản; khởi tạo, chạy, theo dõi, hủy phiên quy trình; sơ đồ luồng chỉ xem | YCAU_NGHIEPVU_100 |
| CHUC_NANG_184 | Công văn đến, đi: sổ, loại văn bản, thông tin thể thức của công ty; vào sổ công văn đến, trình, giao xử lý thành công việc; soạn công văn đi theo thể thức, xuất PDF, Word, trình ký qua luồng duyệt, cấp số, tải bản đã ký, phát hành nội bộ và liên công ty; xuất sổ | YCAU_NGHIEPVU_101, 102, 103 |
| CHUC_NANG_185 | Bảng tin nội bộ: đăng tin theo đối tượng, ghim, hẹn giờ, hết hạn hiển thị, đính kèm, xác nhận đã đọc, bình luận, thu hồi | YCAU_NGHIEPVU_104 |

## 5. Quy tắc nghiệp vụ

| Mã | Quy tắc | Yêu cầu |
|---|---|---|
| QUYTAC_NGHIEPVU_356 | Công việc thuộc công ty nơi lập (công ty đang chọn của người lập). Trường: tiêu đề (bắt buộc, tối đa 200 ký tự), mô tả (tối đa 10.000 ký tự), người chủ trì (bắt buộc, đúng một người), người phối hợp, người theo dõi (không bắt buộc, tối đa 20 người mỗi loại, một người chỉ một vai trò trên một việc), ngày bắt đầu, hạn hoàn thành (ngày giờ, không trước ngày bắt đầu), mức ưu tiên (thấp, bình thường, cao, khẩn), tiến độ phần trăm (0 đến 100, người chủ trì cập nhật). Trạng thái: mới → đang làm → chờ xác nhận → hoàn thành; chờ xác nhận bị trả lại thì về đang làm (bắt buộc nhập lý do); mới, đang làm, chờ xác nhận hủy được (nhập lý do). Người chủ trì chuyển đang làm, báo xong (sang chờ xác nhận; tiến độ thành 100). Người giao (người lập) xác nhận hoàn thành hoặc trả lại; khi người giao cũng là người chủ trì thì báo xong là hoàn thành. Người giao sửa tiêu đề, mô tả, hạn, ưu tiên, người tham gia khi việc chưa hoàn thành, chưa hủy; việc hoàn thành, hủy không sửa. Việc quá hạn: chưa hoàn thành, chưa hủy và hạn đã qua (hiển thị nhãn, không phải trạng thái) | YCAU_NGHIEPVU_98 |
| QUYTAC_NGHIEPVU_357 | Người tham gia (người giao, chủ trì, phối hợp, theo dõi) là người dùng đang hoạt động, là thành viên đang hoạt động của công ty bất kỳ trong cùng tập đoàn với công ty của việc. Người xem được việc: người tham gia; người có quyền `office.task.view_all` bao trùm công ty của việc. Người ở công ty khác chỉ xem được việc mình tham gia (tiêu đề, mô tả, bình luận, tệp của việc đó, tên người tham gia), không xem được dữ liệu khác của công ty giao việc. Người không xem được nhận `404`. Bình luận, đính kèm: mọi người xem được việc (trừ việc đã hủy). Việc liên công ty hiện ở danh sách Việc của tôi của người nhận dù đang chọn công ty nào; danh sách Việc của công ty chỉ hiện việc thuộc công ty đang chọn | YCAU_NGHIEPVU_99 |
| QUYTAC_NGHIEPVU_358 | Việc con: một cấp (việc con không có việc con), cùng công ty với việc cha, hạn không sau hạn việc cha. Việc cha chỉ báo xong được khi mọi việc con đã hoàn thành hoặc hủy. Hủy việc cha hủy mọi việc con chưa hoàn thành. Nhắc hạn: việc nền chạy mỗi 15 phút gửi thông báo cho người chủ trì, người phối hợp khi còn 24 giờ đến hạn (một lần) và khi vừa quá hạn (một lần, gửi cả người giao). Thông báo khi: được giao (chủ trì, phối hợp, theo dõi), có bình luận mới (mọi người tham gia trừ người viết), đổi trạng thái (người giao, người theo dõi) | YCAU_NGHIEPVU_98 |
| QUYTAC_NGHIEPVU_359 | Bình luận: tối đa 5.000 ký tự; người viết sửa được bình luận của mình (hiện "đã sửa"), xóa mềm (hiện "Bình luận đã xóa"). Đính kèm: dùng bảng tệp đính kèm của Nền tảng (`core.attachments`), tệp tối đa 20 MB, đuôi cho phép: PDF, DOC, DOCX, XLS, XLSX, PPT, PPTX, JPG, PNG, TXT, ZIP; người tải lên xóa được tệp của mình khi việc chưa hoàn thành; mọi tải lên, xóa ghi lịch sử việc. Lịch sử việc ghi mọi thay đổi (ai, lúc nào, trường nào) | YCAU_NGHIEPVU_98 |
| QUYTAC_NGHIEPVU_360 | Mẫu quy trình thuộc một công ty; tên, mô tả, biểu mẫu khởi tạo (trường như mẫu đề xuất: văn bản, số, ngày, chọn một, có hoặc không, người dùng; nhãn, bắt buộc). Bước: mã (duy nhất trong mẫu), tên, hướng dẫn, số ngày được làm (1 đến 365, tính theo ngày lịch từ lúc bước mở), người thực hiện (người cụ thể, vai trò trong công ty, trưởng phòng của người khởi tạo, người khởi tạo, giá trị trường người dùng của biểu mẫu khởi tạo), các kết quả (mặc định một kết quả "Hoàn thành"; tối đa 5), loại bước: công việc hoặc gộp. Quy tắc chuyển của mỗi bước: danh sách có thứ tự, mỗi dòng gồm điều kiện (kết quả bằng X; và tùy chọn so sánh một trường biểu mẫu: bằng, khác, lớn hơn, lớn hơn hoặc bằng, nhỏ hơn, nhỏ hơn hoặc bằng) và đích (một hoặc nhiều bước chạy song song, hoặc Kết thúc); dòng cuối là "Trường hợp còn lại" bắt buộc. Kiểm tra khi kích hoạt: có bước đầu; mọi bước đến được từ bước đầu; từ mọi bước có đường tới Kết thúc; mọi kết quả có quy tắc phủ; bước gộp có ít nhất hai đường vào; trường được so sánh có kiểu phù hợp | YCAU_NGHIEPVU_100 |
| QUYTAC_NGHIEPVU_361 | Trạng thái mẫu: nháp → đang dùng → ngừng dùng (dùng lại được). Sửa mẫu đang dùng tạo phiên bản nháp mới; kích hoạt phiên bản mới thì phiên bản cũ thôi dùng cho khởi tạo mới, phiên quy trình đang chạy giữ phiên bản lúc khởi tạo. Quyền khởi tạo: mọi người có `office.access` trong công ty, hoặc giới hạn theo danh sách phòng ban do người thiết kế chọn | YCAU_NGHIEPVU_100 |
| QUYTAC_NGHIEPVU_362 | Phiên quy trình: người khởi tạo chọn mẫu đang dùng, nhập biểu mẫu khởi tạo, tiêu đề; số phiên tự cấp (dãy số chứng từ loại `office.workflow_run`, mặc định `QT` + năm + 5 chữ số). Mở một bước = tạo công việc (QUYTAC_NGHIEPVU_356) gắn với phiên và bước; người giao là người khởi tạo; hạn = lúc mở + số ngày; người thực hiện theo vai trò thì việc chưa có chủ trì, mọi người giữ vai trò thấy và bấm "Nhận việc" (người đầu tiên thành chủ trì). Không xác định được người thực hiện (không có trưởng phòng, trường người dùng trống, vai trò không ai giữ) thì phiên chuyển "Bị chặn", báo người khởi tạo và người có `office.workflow.manage`; họ chỉ định người thực hiện để chạy tiếp. Báo xong việc của bước bắt buộc chọn kết quả; việc chuyển hoàn thành ngay (không chờ xác nhận); hệ thống xét quy tắc chuyển theo thứ tự, dòng đầu thỏa thì mở các bước đích. Bước gộp mở khi đến lượt và không còn bước nào khác đang mở trong phiên; đến sớm thì chờ. Phiên kết thúc khi đến Kết thúc và không còn bước đang mở. Một phiên mở tối đa 100 bước (tính cả lặp lại); vượt thì "Bị chặn". Người khởi tạo, người có `office.workflow.manage` hủy được phiên đang chạy (nhập lý do), các việc đang mở bị hủy. Trạng thái phiên: đang chạy, bị chặn, hoàn thành, đã hủy | YCAU_NGHIEPVU_100 |
| QUYTAC_NGHIEPVU_363 | Sổ công văn thuộc một công ty, chiều đến hoặc đi; mỗi công ty có sẵn "Sổ công văn đến", "Sổ công văn đi"; thêm được sổ riêng (hội đồng, ban). Số trong sổ đếm theo năm (giờ Việt Nam), bắt đầu từ 1 ngày 01 tháng 01, không trùng, không bỏ số; hiện số dạng hai chữ số trở lên (01, 02, …). Loại văn bản: danh mục 29 loại của Điều 8 kèm chữ viết tắt Phụ lục III nạp sẵn cho mỗi công ty, quản trị bật, tắt, thêm loại riêng. Ký hiệu văn bản đi: văn bản có tên loại `<số>/<viết tắt loại>-<viết tắt công ty>` (ví dụ `15/QĐ-VCR`); công văn `<số>/<viết tắt công ty>-<viết tắt phòng ban soạn thảo>` (ví dụ `16/VCR-KD`). Viết tắt công ty mặc định là mã công ty, sửa được ở thông tin thể thức; viết tắt phòng ban là mã phòng ban. Cột sổ đến: số đến, ngày đến, nơi gửi, số ký hiệu, ngày văn bản, tên loại và trích yếu, độ khẩn, người nhận xử lý, hạn xử lý, ghi chú. Cột sổ đi: số, ký hiệu, ngày văn bản, tên loại và trích yếu, người ký, nơi nhận, số bản, ghi chú. Xuất sổ theo năm, khoảng ngày ra Excel. Độ khẩn: thường, khẩn, thượng khẩn, hỏa tốc | YCAU_NGHIEPVU_103 |
| QUYTAC_NGHIEPVU_364 | Công văn đến: văn thư (`office.document.clerk`) vào sổ: chọn sổ đến, ngày đến (mặc định hôm nay), nơi gửi, số ký hiệu, ngày văn bản, loại văn bản, trích yếu (bắt buộc, tối đa 500 ký tự), độ khẩn, hạn xử lý (không bắt buộc), phương thức nhận (giấy, thư điện tử, liên công ty, khác), tệp bản quét (bắt buộc, PDF hoặc ảnh, tối đa 20 MB, nhiều tệp). Số đến cấp khi vào sổ. Cảnh báo (không chặn) khi trùng nơi gửi, số ký hiệu, ngày văn bản với công văn đến khác cùng năm. Trình: văn thư chọn một lãnh đạo (người có `office.document.direct`) → lãnh đạo ghi ý kiến chỉ đạo, chọn người chủ trì, người phối hợp, hạn → hệ thống tạo công việc gắn công văn (người giao là lãnh đạo, tệp công văn xem được từ việc). Lãnh đạo có thể chuyển lãnh đạo khác hoặc ghi "Lưu, không cần xử lý". Trạng thái: chờ trình, chờ ý kiến, đang xử lý, đã xử lý (việc gắn công văn hoàn thành), đã lưu; việc gắn bị hủy thì về chờ ý kiến. Người xem được công văn đến: văn thư, người có `office.document.view_all`, lãnh đạo được trình, người tham gia việc gắn. Sửa thông tin vào sổ khi chưa trình (văn thư); số đến không đổi; vào nhầm thì "Hủy vào sổ" (giữ số, ghi lý do, hiện trong sổ) | YCAU_NGHIEPVU_101 |
| QUYTAC_NGHIEPVU_365 | Công văn đi: người có `office.document.draft` soạn: sổ đi, loại văn bản, phòng ban soạn thảo (phòng ban của người soạn, đổi được), trích yếu, độ khẩn, nội dung (soạn trong hệ thống theo thể thức hoặc tải tệp dự thảo Word, PDF), người ký (người dùng trong công ty) và dòng quyền hạn (không, TM., KT., TL., TUQ., Q.) với chức vụ người ký, nơi nhận ngoài (danh sách dòng chữ), nơi nhận nội bộ (người dùng, phòng ban của công ty; công ty khác trong tập đoàn), số bản, ký hiệu người soạn thảo, trả lời cho công văn đến (không bắt buộc). Trình ký qua luồng duyệt chung (loại chứng từ `office.outgoing_document`, giá trị duyệt 0; công ty chưa có chính sách thì một cấp do người ký duyệt). Trạng thái: nháp → chờ duyệt → chờ cấp số → đã cấp số → đã phát hành; bị từ chối, đã rút sửa rồi trình lại; nháp, bị từ chối, đã rút, chờ cấp số hủy được (lý do). Văn thư cấp số: số lấy từ sổ đi tại lúc cấp, ngày văn bản là ngày cấp (giờ Việt Nam); tệp xuất có số, ký hiệu, ngày. Phát hành: văn thư tải bản đã ký, đóng dấu (bản quét, bắt buộc) → đã phát hành; người nhận nội bộ nhận thông báo và xem được công văn; mỗi công ty khác trong tập đoàn được gửi sinh một công văn đến "Chờ vào sổ" ở công ty đó (văn thư công ty nhận vào sổ, số đến cấp lúc vào sổ, tệp lấy từ bản đã ký). Văn bản đã cấp số không sửa, không hủy; sai thì ban hành văn bản khác. Người xem được: người soạn, người ký, người duyệt, văn thư, `office.document.view_all`, người nhận nội bộ sau phát hành | YCAU_NGHIEPVU_102 |
| QUYTAC_NGHIEPVU_366 | Thể thức xuất tệp (Phụ lục I): khổ A4 dọc; lề trên 20 mm, dưới 20 mm, trái 30 mm, phải 20 mm (mặc định, quản trị chỉnh trong khoảng Phụ lục I); phông Times New Roman (Word), PDF dùng phông Liberation Serif cùng kích thước chữ (giấy phép SIL OFL 1.1, đóng gói kèm mã); cỡ chữ theo phương án 13 (quốc hiệu 12; tiêu ngữ, nội dung 13) hoặc 14 (quốc hiệu 13; còn lại 14), chọn trong thông tin thể thức. Bố cục: trái trên tên cơ quan chủ quản (in hoa, đứng, không bắt buộc), tên công ty (in hoa, đậm, kẻ dưới), số ký hiệu ("Số: …", 13); công văn có "V/v <trích yếu>" dưới số ký hiệu (12–13, đứng); phải trên quốc hiệu (in hoa, đậm), tiêu ngữ (đậm, kẻ dưới), địa danh và ngày ("<địa danh>, ngày dd tháng mm năm yyyy", nghiêng; ngày, tháng nhỏ hơn 10 thêm số 0 với ngày 01–09, tháng 01–02 theo Phụ lục I); độ khẩn (in hoa, đậm) dưới số ký hiệu; văn bản có tên loại: tên loại (in hoa, đậm) và trích yếu (đậm) giữa trang; nội dung (căn đều hai lề, thụt đầu dòng 1 cm); dưới cùng: trái "Nơi nhận:" (12, nghiêng, đậm) và danh sách (11), cuối là "- Lưu: VT, <viết tắt phòng ban>"; phải quyền hạn, chức vụ (in hoa, đậm), khoảng ký, họ tên người ký (đậm); ký hiệu người soạn thảo, số bản (11). Văn bản chưa cấp số xuất có số để trống ("Số:      /…") và dòng "DỰ THẢO" | YCAU_NGHIEPVU_102 |
| QUYTAC_NGHIEPVU_367 | Bảng tin: người có `office.bulletin.post` đăng tin cho công ty đang chọn: tiêu đề (tối đa 200 ký tự), nội dung (văn bản có định dạng cơ bản: đoạn, đậm, nghiêng, danh sách, đường dẫn; lọc mã độc khi lưu), đối tượng (toàn công ty hoặc danh sách chi nhánh, phòng ban), tệp đính kèm (như QUYTAC_NGHIEPVU_359), ghim (tối đa 5 tin ghim mỗi công ty), thời điểm đăng (ngay hoặc hẹn giờ), hết hạn hiển thị (không bắt buộc), cần xác nhận đã đọc, cho bình luận. Người có `office.bulletin.post` ở phạm vi tập đoàn đăng được tin toàn tập đoàn (mọi thành viên của mọi công ty). Người nhận: thành viên đang hoạt động thuộc đối tượng tại lúc xem. Không duyệt bài. Đến giờ đăng: gửi thông báo cho người nhận khi tin cần xác nhận đã đọc (tin thường không gửi thông báo). Người đăng sửa được tin (hiện "đã sửa"), thu hồi (tin ẩn với người nhận). Người đăng, người có `office.bulletin.post` cùng phạm vi xem danh sách đã đọc, chưa đọc. Bình luận như QUYTAC_NGHIEPVU_359; người đăng xóa được bình luận bất kỳ trong tin của mình | YCAU_NGHIEPVU_104 |

## 6. Vai trò và quyền

| Quyền | Ý nghĩa | Nhạy cảm |
|---|---|---|
| `office.access` | Vào mini app Văn phòng số; giao việc, khởi tạo quy trình, xem bảng tin | Không |
| `office.task.view_all` | Xem mọi công việc, phiên quy trình của công ty | Không |
| `office.workflow.manage` | Thiết kế, kích hoạt, ngừng mẫu quy trình; chỉ định người thực hiện cho phiên bị chặn; hủy phiên | Không |
| `office.document.clerk` | Văn thư: quản lý sổ, loại văn bản, thông tin thể thức; vào sổ, trình công văn đến; cấp số, phát hành công văn đi; xuất sổ | Có |
| `office.document.direct` | Lãnh đạo: nhận trình công văn đến, cho ý kiến, giao xử lý | Không |
| `office.document.draft` | Soạn, trình ký công văn đi | Không |
| `office.document.view_all` | Xem mọi công văn đến, đi của công ty | Có |
| `office.bulletin.post` | Đăng, sửa, thu hồi tin; xem danh sách đã đọc. Gán ở phạm vi tập đoàn thì đăng tin toàn tập đoàn | Không |

- Quyền gán ở phạm vi tập đoàn hoặc công ty (gán ở chi nhánh không dùng được), như module Tài chính – Kế toán.
- Vai trò Nhân viên (`employee`) thêm `office.access`, `office.document.draft`. Vai trò mới, phạm vi công ty: `office_clerk` (Văn thư): `office.access`, `office.document.clerk`, `office.document.draft`, `office.document.view_all`, `office.bulletin.post`. Quản trị công ty, Quản trị tập đoàn có mọi quyền mới. Lãnh đạo (`office.document.direct`), thiết kế quy trình (`office.workflow.manage`) gán qua vai trò do quản trị tạo (MAN_HINH_14).
- Loại chứng từ mới: `office.outgoing_document` (Công văn đi, cần duyệt), `office.workflow_run` (Phiên quy trình, chỉ dùng dãy số).

## 7. Luồng nghiệp vụ

- Luồng 1 – Giao việc: người giao lập việc, chọn chủ trì (có thể ở công ty khác trong tập đoàn), phối hợp, theo dõi, hạn → người chủ trì nhận thông báo, chuyển đang làm, cập nhật tiến độ, trao đổi, đính kèm → báo xong → người giao xác nhận hoặc trả lại.
- Luồng 2 – Quy trình: người thiết kế lập mẫu (ví dụ "Mua văn phòng phẩm": bước Trưởng phòng xem xét có kết quả Đồng ý, Không đồng ý; nếu Đồng ý và số tiền lớn hơn 5 triệu thì sang Giám đốc duyệt, còn lại sang Hành chính mua; Không đồng ý thì Kết thúc) → kích hoạt → nhân viên khởi tạo, nhập biểu mẫu → hệ thống giao việc từng bước theo kết quả và điều kiện → kết thúc.
- Luồng 3 – Công văn đến: văn thư nhận văn bản giấy hoặc thư điện tử, quét, vào sổ (số đến tự cấp) → trình lãnh đạo → lãnh đạo cho ý kiến, giao chủ trì, phối hợp, hạn → công việc tạo ra → hoàn thành việc thì công văn "Đã xử lý".
- Luồng 4 – Công văn đi: người soạn soạn theo thể thức (hoặc tải dự thảo), xem trước PDF, Word → trình ký qua luồng duyệt → duyệt xong văn thư cấp số → in, người ký ký tay, đóng dấu → văn thư tải bản quét, phát hành → người nhận nội bộ nhận thông báo; công ty khác trong tập đoàn nhận công văn đến chờ vào sổ.
- Luồng 5 – Bảng tin: hành chính đăng tin cần xác nhận đã đọc cho phòng Kinh doanh, hẹn 8 giờ sáng → đến giờ người nhận nhận thông báo, đọc, bấm xác nhận → người đăng xem ai chưa đọc.

## 8. Màn hình (giai đoạn 06.1)

| Mã | Màn hình | Nội dung | Vai trò |
|---|---|---|---|
| MAN_HINH_153 | Danh sách công việc | Thẻ Việc của tôi (chủ trì, phối hợp; mọi công ty), Tôi giao, Theo dõi, Của công ty (khi có `office.task.view_all`); lọc trạng thái, ưu tiên, hạn (quá hạn, hôm nay, tuần này), tìm theo tiêu đề; cột tiêu đề, công ty (khi khác công ty đang chọn), chủ trì, hạn, ưu tiên, tiến độ, trạng thái, nhãn quá hạn; nút "Giao việc" mở biểu mẫu (ngăn kéo bên phải) | `office.access` |
| MAN_HINH_154 | Chi tiết công việc | Đầu trang: tiêu đề, trạng thái, nhãn quá hạn, nút theo trạng thái (Bắt đầu, Báo xong, Xác nhận, Trả lại, Hủy, Nhận việc, chọn kết quả với việc của quy trình); thông tin (người tham gia, hạn, ưu tiên, tiến độ), việc con, liên kết (phiên quy trình, công văn đến), bình luận, tệp, lịch sử | Người xem được việc |
| MAN_HINH_155 | Mẫu quy trình | Danh sách mẫu (tên, phiên bản, trạng thái); trình thiết kế: thông tin, biểu mẫu khởi tạo, danh sách bước (mỗi bước: người thực hiện, số ngày, kết quả, quy tắc chuyển), sơ đồ luồng tự vẽ (chỉ xem), kết quả kiểm tra hợp lệ, nút Kích hoạt, Ngừng dùng | `office.workflow.manage` |
| MAN_HINH_156 | Phiên quy trình | Danh sách (của tôi, công ty khi có quyền); khởi tạo (chọn mẫu, biểu mẫu); chi tiết: biểu mẫu khởi tạo, sơ đồ có tô bước đã xong, đang mở, các việc của từng bước, nút Chỉ định người thực hiện (phiên bị chặn), Hủy | `office.access` |
| MAN_HINH_157 | Công văn đến | Danh sách theo sổ, năm (cột theo sổ đến), lọc trạng thái, độ khẩn, tìm; vào sổ (ngăn kéo); chi tiết: thông tin, tệp xem trực tiếp, tiến trình trình, ý kiến, việc xử lý; nút Trình, Cho ý kiến và giao xử lý, Chuyển lãnh đạo khác, Lưu, Hủy vào sổ, Xuất sổ | Văn thư, lãnh đạo, người xem được |
| MAN_HINH_158 | Công văn đi | Danh sách theo sổ, năm, lọc trạng thái; soạn: các ô thể thức, nội dung, nơi nhận, người ký, xem trước PDF, tải Word; chi tiết: tiến trình duyệt, nút Trình ký, Rút, Hủy, Cấp số (văn thư), Phát hành (tải bản đã ký), tải PDF, Word, bản đã ký, Xuất sổ | `office.document.draft`, văn thư, người xem được |
| MAN_HINH_159 | Bảng tin | Danh sách tin (ghim trên cùng, chưa đọc in đậm), chi tiết tin (nội dung, tệp, nút Xác nhận đã đọc, bình luận); đăng, sửa tin (ngăn kéo); thống kê đã đọc, chưa đọc | `office.access`; đăng: `office.bulletin.post` |
| MAN_HINH_160 | Cài đặt văn thư | Thẻ Sổ công văn (thêm, đổi tên, ngừng), Loại văn bản (bật, tắt, thêm, viết tắt), Thông tin thể thức (cơ quan chủ quản, viết tắt công ty, địa danh, phương án cỡ chữ, lề) | `office.document.clerk` |

Điều hướng: trang chủ mini app → Văn phòng số → menu: Công việc (153 → 154), Quy trình (156; Mẫu quy trình 155 khi có quyền), Công văn đến (157), Công văn đi (158), Bảng tin (159), Cài đặt văn thư (160, khi có quyền). Thông báo công việc mở 154, công văn mở 157 hoặc 158, tin mở 159.

## 9. Dữ liệu và API (phác thảo, chi tiết ở giai đoạn 07)

- Schema `office` (chỉ module Văn phòng số ghi); khóa ngoại trỏ `core`. Tệp dùng `core.attachments` (thêm giá trị `owner_type`: `office_task`, `office_incoming`, `office_outgoing`, `office_outgoing_signed`, `office_post`).
- Database migration `0090_office_tasks.sql`: `core.apps` thêm `office`; `office.tasks`, `office.task_participants`, `office.task_comments`, `office.task_events` (lịch sử), `office.task_reminders`; mở rộng ràng buộc `core.attachments.owner_type`.
- Database migration `0091_office_workflows.sql`: `office.workflow_templates`, `office.workflow_template_versions` (biểu mẫu, bước, quy tắc chuyển dạng `jsonb` đã kiểm bằng lược đồ zod), `office.workflow_runs`, `office.workflow_step_instances`; `office.tasks.workflow_step_instance_id`.
- Database migration `0092_office_documents.sql`: `office.document_settings`, `office.registers`, `office.register_counters` (sổ, năm, số tiếp theo), `office.document_types`, `office.incoming_documents`, `office.incoming_routings` (trình, ý kiến), `office.outgoing_documents`, `office.outgoing_recipients`; `office.tasks.incoming_document_id`.
- Database migration `0093_office_bulletin.sql`: `office.posts`, `office.post_audiences`, `office.post_reads`, `office.post_comments`.
- API_184 `/office/tasks` (danh sách theo thẻ, chi tiết, lập, sửa, chuyển trạng thái, nhận việc, việc con, lịch sử, tùy chọn người dùng trong tập đoàn); API_185 `/office/tasks/{id}/comments`, `/attachments`; API_186 `/office/workflow-templates` (danh sách, chi tiết, lập, sửa phiên bản nháp, kiểm tra, kích hoạt, ngừng); API_187 `/office/workflow-runs` (danh sách, khởi tạo, chi tiết, chỉ định người thực hiện, hủy); API_188 `/office/incoming-documents` (danh sách, vào sổ, sửa, trình, cho ý kiến, chuyển, lưu, hủy vào sổ, tệp, chờ vào sổ từ công ty khác); API_189 `/office/outgoing-documents` (danh sách, soạn, sửa, xuất PDF, Word, trình, rút, hủy, cấp số, phát hành, tệp); API_190 `/office/registers`, `/office/document-types`, `/office/document-settings`, `/office/registers/{id}/export`; API_191 `/office/posts` (danh sách, chi tiết, đăng, sửa, thu hồi, đọc, xác nhận, danh sách đã đọc, bình luận, tệp).
- Dịch vụ Nền tảng dùng lại: luồng duyệt (`submitWithin`, `withdraw`, nghe `core.approval.completed`), dãy số chứng từ, lưu tệp (`createFileStorage`), `core.attachments`, thông báo (`notify`), nhật ký thao tác, xuất Excel (`write-excel-file`), PDF (`pdfmake`, thêm phông Liberation Serif).
- Việc nền mới (BullMQ): `office-task-reminders` (mỗi 15 phút), `office-post-publish` (mỗi phút, tin hẹn giờ).

## 10. Điều kiện đặc biệt

- Cấp số đến, số đi: khóa dòng bộ đếm (`UPDATE … RETURNING` trong cùng giao dịch với vào sổ, cấp số) để không trùng, không bỏ số khi đồng thời.
- Xét quy tắc chuyển, mở bước, kiểm bước gộp trong một giao dịch có khóa phiên (`FOR UPDATE`) để hai việc xong cùng lúc không mở bước gộp hai lần.
- Việc liên công ty: mọi truy vấn công việc lọc theo người tham gia hoặc quyền xem toàn công ty; truy vấn người dùng để chọn người tham gia chỉ trả họ tên, công ty, phòng ban, không trả dữ liệu khác.
- Nội dung có định dạng (công văn, tin) lưu dạng cấu trúc đoạn có kiểu, không lưu HTML tự do; hiển thị không dùng chèn HTML thô.

## 11. Tiêu chí nghiệm thu

| Mã | Tiêu chí | Mức |
|---|---|---|
| TIEUCHI_NGHIEMTHU_339 | Công việc: lập, sửa, chuyển trạng thái đúng QUYTAC_NGHIEPVU_356; việc con đúng QUYTAC_NGHIEPVU_358; trả lại, hủy cần lý do | Bắt buộc |
| TIEUCHI_NGHIEMTHU_340 | Quyền xem việc: người tham gia, người có quyền xem toàn công ty thấy; người khác nhận `404`; giao cho người công ty khác trong tập đoàn được, người ngoài tập đoàn bị chặn; người công ty khác không xem được việc khác của công ty giao | Bắt buộc |
| TIEUCHI_NGHIEMTHU_341 | Bình luận, tệp, lịch sử, thông báo giao việc, nhắc sắp đến hạn và quá hạn mỗi mốc một lần | Bắt buộc |
| TIEUCHI_NGHIEMTHU_342 | Mẫu quy trình: kiểm tra hợp lệ chặn mẫu sai (bước không đến được, không tới Kết thúc, thiếu "Trường hợp còn lại", so sánh sai kiểu); phiên bản mới không ảnh hưởng phiên đang chạy | Bắt buộc |
| TIEUCHI_NGHIEMTHU_343 | Chạy quy trình: rẽ nhánh theo kết quả và trường biểu mẫu, song song, gộp mở một lần, lặp lại, giới hạn 100 bước, bị chặn và chỉ định người thực hiện, nhận việc theo vai trò, hủy phiên | Bắt buộc |
| TIEUCHI_NGHIEMTHU_344 | Công văn đến: số đến theo sổ, theo năm, bắt đầu từ 01, không trùng khi đồng thời; trình, cho ý kiến tạo việc; trạng thái theo việc; quyền xem đúng | Bắt buộc |
| TIEUCHI_NGHIEMTHU_345 | Công văn đi: trình ký qua luồng duyệt; chỉ cấp số sau khi duyệt; số, ký hiệu đúng QUYTAC_NGHIEPVU_363; phát hành cần bản đã ký; người nhận nội bộ được thông báo; công ty khác trong tập đoàn có công văn đến chờ vào sổ; đã cấp số không sửa | Bắt buộc |
| TIEUCHI_NGHIEMTHU_346 | Tệp PDF, Word xuất đúng thể thức QUYTAC_NGHIEPVU_366 (khổ, lề, phông, cỡ, kiểu chữ, bố cục); xuất sổ Excel đủ cột | Bắt buộc |
| TIEUCHI_NGHIEMTHU_347 | Bảng tin: đúng đối tượng (công ty, chi nhánh, phòng ban, toàn tập đoàn), hẹn giờ, hết hạn, ghim tối đa 5, xác nhận đã đọc và danh sách chưa đọc, bình luận, thu hồi | Bắt buộc |
| TIEUCHI_NGHIEMTHU_348 | MAN_HINH_153 đến MAN_HINH_160 đạt danh sách rà soát giao diện trên máy tính và điện thoại | Bắt buộc |

## 12. Kịch bản kiểm thử

KICHBAN_KIEMTHU_498 đến KICHBAN_KIEMTHU_507 tự động (`apps/api/test/c52-*.test.ts`): 498 công việc, trạng thái, việc con; 499 quyền xem, liên công ty, cách ly; 500 bình luận, tệp, nhắc hạn; 501 kiểm tra hợp lệ, phiên bản mẫu; 502 chạy quy trình rẽ nhánh, song song, gộp, lặp, giới hạn, bị chặn; 503 công văn đến, số đến đồng thời, trình, giao xử lý; 504 công văn đi, luồng duyệt, cấp số, phát hành, liên công ty; 505 thể thức PDF, Word (đọc lại tệp kiểm khổ, lề, phông, cỡ chữ), xuất sổ; 506 bảng tin; 507 phân quyền mọi API (`403`, `404`). KICHBAN_KIEMTHU_508 (trình duyệt máy tính), KICHBAN_KIEMTHU_509 (điện thoại) thủ công; ghi trong tài liệu `21` khi trình nghiệm thu (gửi phiên cha ghi sổ).

## 13. Ràng buộc kỹ thuật

- Thêm thư viện `docx` 9.15.3 (giấy phép MIT, cập nhật 2026-11-06) cho `apps/api` để xuất Word (người dùng chọn 2026-11-11); ghi vào tài liệu `13`. Phông Liberation Serif 2.x (SIL OFL 1.1) đóng gói trong `apps/api/assets/fonts/` cho PDF, kèm tệp giấy phép.
- Mini app mới theo mẫu `apps/web-finance` (Next.js, cổng 3011, mini app Nền tảng chuyển tiếp `/office` theo biến `OFFICE_ORIGIN`).
- Module `apps/api/src/office`; chỉ ghi schema `office` và `core.attachments` qua dịch vụ đính kèm có sẵn.
- Chuỗi giao diện trong `packages/i18n`; lược đồ zod trong `packages/contracts`; giá trị giao diện từ tài liệu `15` (không cần giá trị mới; nếu cần sẽ đề xuất trước).

## 14. Thành phần không được thay đổi

Luồng duyệt chung, dãy số chứng từ, mẫu đề xuất, đăng nhập, phân quyền hiện có; hành vi tệp đính kèm của đề xuất (chỉ thêm giá trị `owner_type`).

## 15. Các lát và điểm xem trước

- L0: database migration 0090; quyền, vai trò; công việc, việc con, người tham gia liên công ty, bình luận, tệp, nhắc hạn; mini app, MAN_HINH_153, MAN_HINH_154. Điểm xem trước: giao việc cho người công ty khác, bình luận, báo xong, xác nhận.
- L1: database migration 0091; mẫu quy trình, kiểm tra hợp lệ, phiên quy trình; MAN_HINH_155, MAN_HINH_156. Điểm xem trước: thiết kế mẫu "Mua văn phòng phẩm" có nhánh rẽ, chạy hai nhánh.
- L2: database migration 0092; sổ, loại văn bản, thông tin thể thức, công văn đến, công văn đi, PDF, Word, xuất sổ; MAN_HINH_157, MAN_HINH_158, MAN_HINH_160. Điểm xem trước: vào sổ, giao xử lý; soạn, trình ký, cấp số, tệp PDF và Word.
- L3: database migration 0093; bảng tin; MAN_HINH_159. Điểm xem trước: tin hẹn giờ cần xác nhận đã đọc.

## 16. Quyết định AI tự đưa ra (trong phạm vi quyết định của người dùng)

- Việc liên công ty thuộc công ty giao việc; người công ty khác chỉ thấy đúng việc mình tham gia (QUYTAC_NGHIEPVU_357).
- Hạn tính theo ngày lịch; nhắc trước 24 giờ và khi quá hạn.
- Bước gộp mở khi không còn bước nào khác đang mở trong phiên (đơn giản, xác định được); giới hạn 100 bước để chặn lặp vô hạn.
- Ký hiệu, số theo năm theo Điều 15 và Phụ lục III; không làm độ mật.
- PDF dùng Liberation Serif thay Times New Roman (Times New Roman có bản quyền, không đóng gói được); Word ghi phông Times New Roman.
- Công văn đi gửi công ty khác trong tập đoàn tự sinh công văn đến chờ vào sổ ở công ty nhận.
- Công ty chưa có chính sách duyệt công văn đi thì một cấp do người ký duyệt (người ký phải đồng ý trước khi cấp số).
- Nội dung có định dạng lưu dạng cấu trúc, không lưu HTML (chống chèn mã).

## 17. Quyết định của người dùng (2026-11-11)

- Áp dụng đầy đủ Nghị định 30/2020/NĐ-CP, cả thể thức trình bày; xuất cả PDF và Word.
- Công văn đi: soạn hoặc tải dự thảo, trình ký qua luồng duyệt chung, văn thư cấp số sau khi duyệt, tải bản đã ký rồi phát hành; chữ ký số làm sau.
- Công văn đến: văn thư vào sổ, trình lãnh đạo, lãnh đạo giao xử lý thành công việc.
- Quy trình có nhánh rẽ, làm bằng biểu mẫu bước và điều kiện, sơ đồ chỉ xem; không kéo thả.
- Bảng tin: người có quyền đăng, chọn đối tượng; không duyệt; có ghim, hẹn giờ, hết hạn, đính kèm, xác nhận đã đọc, bình luận.
- Giao việc được cho cả người công ty khác trong tập đoàn.

## 18. Rủi ro

- Nội dung Nghị định 30 chưa đối chiếu bản gốc trong phiên (mục 3); phải đối chiếu điều 8, 15, 16, 20 đến 24, Phụ lục I, III, IV trước khi phát hành.
- Thêm thư viện `docx` cần người dùng duyệt ghi tài liệu `13` (đã chọn 2026-11-11).

## 19. Kết quả đối chiếu định nghĩa hoàn thành

Chưa đối chiếu.
