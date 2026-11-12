# CONG_VIEC_59: Văn phòng số phần 2 (MODULE_13) – chữ ký số, kho hợp đồng

- Mô tả: Ký số tài liệu PDF trên hệ thống qua nhà cung cấp ký số từ xa (lớp kết nối chung, bộ giả lập để thử); trình ký tài liệu PDF bất kỳ cho nhiều người ký theo thứ tự (người trong công ty, chữ ký số của công ty, đối tác bên ngoài qua đường dẫn); kiểm tra chữ ký số trong tệp PDF; kho hợp đồng (mua, bán, dịch vụ, thuê, khác) có duyệt, ký số, phụ lục, nhắc hạn, phân quyền xem; gắn ký số vào công văn đi (CONG_VIEC_52) và hợp đồng lao động (CONG_VIEC_46).
- Phiên bản: 0.1
- Ngày cập nhật: 2026-11-12
- Trạng thái: Bản nháp, chờ người dùng duyệt.
- Mức: Lớn (nghiệp vụ mới, tích hợp dịch vụ ngoài, thêm thư viện, chạm ba module: Văn phòng số, Nhân sự, Quan hệ khách hàng).
- Nguồn: tài liệu `01` mục 4 (MODULE_13: chữ ký số, kho hợp đồng); CONG_VIEC_52 mục 2 (ngoài phạm vi phần 1); CONG_VIEC_46 (ký số hợp đồng lao động để công việc sau); quyết định của người dùng ngày 2026-11-12 (mục 17).

## 1. Mục tiêu

Văn bản, hợp đồng được ký số ngay trên hệ thống, không phải in, ký tay, quét; hợp đồng của mọi công ty trong tập đoàn nằm ở một kho, đúng người xem, không bị quên hạn.

## 2. Phạm vi

Trong phạm vi: CHUC_NANG_210 đến CHUC_NANG_213, trong mini app Văn phòng số `apps/web-office` (CONG_VIEC_52).

Ngoài phạm vi (đề xuất công việc sau):
- Kết nối thật một nhà cung cấp ký số từ xa (VNPT SmartCA, Viettel MySign, FPT CA…): làm khi công ty có tài khoản kết nối và tài liệu API chính thức; lớp kết nối của công việc này là chỗ cắm.
- Ký bằng USB token qua phần mềm cài trên máy người ký.
- Kiểm tra trạng thái thu hồi chứng thư (OCSP, CRL) và gắn dấu thời gian của tổ chức cung cấp dịch vụ dấu thời gian (mục 18).
- Ký tệp Word, XML; ký hàng loạt nhiều tài liệu một lần.
- Liên kết hợp đồng với đơn mua, đơn bán, theo dõi giá trị đã thực hiện, công nợ theo hợp đồng.
- Gửi văn bản điện tử đã ký qua Trục liên thông văn bản quốc gia.

## 3. Căn cứ pháp lý

Ngày 2026-11-12 chưa tra được nguyên văn (công cụ tra cứu văn bản pháp luật hết lượt trong ngày). Các văn bản dưới đây **phải tra nguyên văn, ghi Điều, khoản trước khi người dùng duyệt đặc tả**; chưa trích dẫn nội dung.

| Văn bản | Nội dung cần đối chiếu |
|---|---|
| Luật Giao dịch điện tử số 20/2023/QH15 | Giá trị pháp lý của chữ ký điện tử, chữ ký số; điều kiện chữ ký số được bảo đảm an toàn; hợp đồng điện tử; giá trị của thông điệp dữ liệu như bản gốc |
| Nghị định quy định chi tiết về chữ ký điện tử và dịch vụ tin cậy (thay Nghị định 130/2018/NĐ-CP) | Chữ ký số từ xa, kiểm tra hiệu lực chứng thư, dấu thời gian, chữ ký số của tổ chức |
| Nghị định 30/2020/NĐ-CP | Ký số văn bản điện tử: chữ ký số của người có thẩm quyền, chữ ký số của cơ quan, tổ chức; vị trí, hình ảnh chữ ký số (Phụ lục I) |
| Bộ luật Lao động 2019 | Hợp đồng lao động giao kết bằng phương tiện điện tử |

## 4. Yêu cầu nghiệp vụ và chức năng

| Mã | Yêu cầu | Người dùng |
|---|---|---|
| YCAU_NGHIEPVU_149 | Người có thẩm quyền ký số tài liệu ngay trên hệ thống bằng chứng thư ký số từ xa của mình, xác nhận trên điện thoại | Người ký |
| YCAU_NGHIEPVU_150 | Công ty đóng chữ ký số của tổ chức lên văn bản phát hành (thay con dấu) | Văn thư, người được giao |
| YCAU_NGHIEPVU_151 | Trình ký một tài liệu PDF cho nhiều người ký theo thứ tự, theo dõi đến khi ký xong | Mọi nhân viên được phép |
| YCAU_NGHIEPVU_152 | Đối tác bên ngoài ký số hợp đồng qua đường dẫn, không cần tài khoản trên hệ thống | Đối tác |
| YCAU_NGHIEPVU_153 | Biết một tệp PDF có chữ ký số hợp lệ không, ai ký, lúc nào, tệp có bị sửa sau khi ký không | Mọi nhân viên được phép |
| YCAU_NGHIEPVU_154 | Lưu mọi hợp đồng mua, bán, dịch vụ, thuê, khác của công ty ở một kho: tìm, lọc, duyệt, ký, phụ lục, thanh lý; xem cả hợp đồng lao động khi có quyền | Người phụ trách hợp đồng, pháp chế, lãnh đạo |
| YCAU_NGHIEPVU_155 | Được nhắc trước khi hợp đồng hết hạn; chỉ người liên quan, người được phép xem hợp đồng | Người phụ trách, quản lý kho hợp đồng |

| Mã | Chức năng | Truy vết |
|---|---|---|
| CHUC_NANG_210 | Ký số: lớp kết nối nhà cung cấp ký số từ xa và bộ giả lập; tài khoản ký số của người dùng; chứng thư số của công ty; danh sách chứng thư gốc tin cậy; ký PDF theo chuẩn PAdES; kiểm tra chữ ký số trong PDF | YCAU_NGHIEPVU_149, 150, 153 |
| CHUC_NANG_211 | Trình ký tài liệu: phiên ký PDF, người ký theo thứ tự (người dùng, chữ ký công ty, đối tác), vị trí chữ ký, ký, từ chối, hủy, nhắc, đường dẫn ký cho đối tác | YCAU_NGHIEPVU_151, 152 |
| CHUC_NANG_212 | Kho hợp đồng: loại hợp đồng, hợp đồng, phụ lục, duyệt, ký qua phiên ký, nhập hợp đồng đã ký, thanh lý, chấm dứt, chia sẻ, hợp đồng mật, nhắc hạn, hiển thị hợp đồng lao động | YCAU_NGHIEPVU_154, 155 |
| CHUC_NANG_213 | Gắn ký số: công văn đi ký số rồi phát hành không cần bản quét; hợp đồng lao động, phụ lục ký số qua phiên ký | YCAU_NGHIEPVU_149, 150, 151 |

## 5. Quy tắc nghiệp vụ

| Mã | Quy tắc | Truy vết |
|---|---|---|
| QUYTAC_NGHIEPVU_454 | Nhà cung cấp ký số cài đặt theo công ty: loại nhà cung cấp (giai đoạn này: Bộ giả lập), môi trường (thử, chính thức), thông tin kết nối (mã hóa khi lưu, không trả về giao diện, không ghi log). Kiểm tra kết nối trước khi lưu. Bộ giả lập chỉ dùng được ở môi trường thử (`NODE_ENV` khác `production`); tệp ký bằng bộ giả lập có chứng thư của tổ chức chứng thực giả lập, không tin cậy với phần mềm đọc PDF | YCAU_NGHIEPVU_149 |
| QUYTAC_NGHIEPVU_455 | Tài khoản ký số của người dùng: người dùng tự khai mã định danh tại nhà cung cấp (theo nhà cung cấp của công ty đang chọn) → hệ thống lấy danh sách chứng thư từ nhà cung cấp → người dùng chọn một chứng thư → lưu chứng thư (số hiệu, chủ thể, tổ chức cấp, hiệu lực từ, đến). Mỗi người dùng một chứng thư đang dùng cho mỗi công ty. Chứng thư hết hạn hoặc chưa đến hiệu lực thì không ký được, báo cần cập nhật. Không lưu khóa bí mật (khóa nằm ở nhà cung cấp) | YCAU_NGHIEPVU_149 |
| QUYTAC_NGHIEPVU_456 | Chữ ký số của công ty: người có `office.signing.manage` khai mã định danh của tổ chức tại nhà cung cấp, chọn chứng thư như QUYTAC_NGHIEPVU_455; chủ thể chứng thư phải có mã số thuế trùng mã số thuế của công ty, không trùng thì không lưu. Chỉ người có `office.signing.company_seal` bao trùm công ty được đóng chữ ký công ty | YCAU_NGHIEPVU_150 |
| QUYTAC_NGHIEPVU_457 | Ký một chữ ký: hệ thống thêm vào bản PDF hiện hành một ô chữ ký (trang, vị trí của người ký) có hình hiển thị "Ký bởi: <tên chủ thể chứng thư>", "Thời gian ký: <dd/mm/yyyy hh:mm, giờ Việt Nam>", với chữ ký công ty thêm "Ký thay mặt: <tên công ty>"; tính mã băm SHA-256 của phần tài liệu được ký, gửi nhà cung cấp kèm mã định danh người ký → nhà cung cấp gửi yêu cầu xác nhận tới ứng dụng của người ký → hệ thống hỏi kết quả mỗi 5 giây, tối đa 5 phút → nhận chữ ký, chèn vào tệp theo chuẩn PAdES (bổ sung tăng dần, giữ nguyên chữ ký trước), kiểm tra lại toàn bộ chữ ký trong tệp, lưu thành bản mới. Người ký từ chối trên ứng dụng hoặc hết 5 phút thì lần ký thất bại, người ký ký lại được. Mọi lần gửi, kết quả ghi lịch sử phiên ký | YCAU_NGHIEPVU_149 |
| QUYTAC_NGHIEPVU_458 | Phiên ký thuộc công ty đang chọn của người lập (`office.signing.use`). Tệp gốc: một tệp PDF, tối đa 20 MB, không mã hóa bằng mật khẩu; tệp đã có chữ ký số thì giữ nguyên chữ ký cũ (ký bổ sung). Trường: tiêu đề (bắt buộc, tối đa 200 ký tự), ghi chú cho người ký (tối đa 2.000 ký tự), hạn ký (ngày, mặc định 14 ngày, tối đa 60 ngày), danh sách người ký (1 đến 10). Mỗi người ký: loại (người dùng trong tập đoàn, chữ ký số công ty, đối tác bên ngoài), thứ tự (người cùng số thứ tự ký song song, không theo trước sau), vị trí chữ ký (trang: đầu, cuối, số trang; góc: dưới phải, dưới trái, trên phải, trên trái; nhiều người cùng trang, cùng góc thì xếp lần lượt lên trên). Đối tác: họ tên hoặc tên tổ chức, thư điện tử (bắt buộc), mã số thuế (tổ chức) hoặc số định danh cá nhân (cá nhân), mã định danh tại nhà cung cấp; chọn từ đối tác trong `crm.partners` thì điền sẵn | YCAU_NGHIEPVU_151 |
| QUYTAC_NGHIEPVU_459 | Trạng thái phiên ký: nháp → đang ký → đã ký xong; đang ký → bị từ chối (một người ký từ chối, bắt buộc lý do) / đã hủy (người lập hủy, lý do) / hết hạn (qua hạn ký chưa xong). Gửi: kiểm người ký nội bộ có tài khoản ký số còn hiệu lực, công ty có chữ ký số khi có bước chữ ký công ty; thiếu thì báo, không gửi. Đến lượt ai thì người đó (hoặc người có `office.signing.company_seal` với bước chữ ký công ty) nhận thông báo, đối tác nhận thư điện tử có đường dẫn. Người lập nhắc lại người đang đến lượt tối đa một lần mỗi ngày. Sửa người ký, tệp chỉ khi nháp. Phiên bị từ chối, hủy, hết hạn thì người lập sao chép thành phiên mới (bản PDF gốc) | YCAU_NGHIEPVU_151 |
| QUYTAC_NGHIEPVU_460 | Đường dẫn ký cho đối tác: mã ngẫu nhiên 32 byte, chỉ lưu mã băm; dùng được khi phiên đang ký, đến lượt đối tác và chưa quá hạn ký; hết dùng khi đối tác đã ký, từ chối, phiên kết thúc. Trang ký (không đăng nhập) hiện tiêu đề, tên công ty gửi, ghi chú, xem và tải bản PDF hiện hành, nút Ký số, Từ chối (lý do). Ký số: hệ thống gửi yêu cầu ký đến nhà cung cấp theo mã định danh đã khai cho đối tác (đối tác không sửa được), như QUYTAC_NGHIEPVU_457; chữ ký nhận về được chấp nhận khi chủ thể chứng thư có mã số thuế (tổ chức) hoặc số định danh cá nhân (cá nhân) trùng thông tin đã khai, không trùng thì loại bỏ và báo. Giới hạn 10 yêu cầu mỗi phút cho mỗi đường dẫn, 60 mỗi phút cho mỗi địa chỉ IP. Người lập gửi lại thư (tạo mã mới, mã cũ hết dùng) | YCAU_NGHIEPVU_152 |
| QUYTAC_NGHIEPVU_461 | Kiểm tra chữ ký số trong PDF (`office.signing.use`; tệp tối đa 20 MB, không lưu tệp): với mỗi chữ ký báo: người ký (chủ thể chứng thư), tổ chức cấp, thời gian ký ghi trong chữ ký, toàn vẹn (tài liệu không bị sửa sau khi ký), chứng thư còn hiệu lực tại thời gian ký, chuỗi chứng thư đến một chứng thư gốc trong danh sách tin cậy, chữ ký có bao trùm toàn bộ tệp hay sau đó tệp còn được bổ sung. Kết luận mỗi chữ ký: Hợp lệ (toàn vẹn, còn hiệu lực, tin cậy), Chưa xác định tin cậy (toàn vẹn, còn hiệu lực, không đến chứng thư gốc tin cậy), Không hợp lệ (còn lại). Không kiểm tra thu hồi chứng thư (mục 18), kết quả ghi rõ "Chưa kiểm tra thu hồi". Danh sách chứng thư gốc tin cậy: người có `office.signing.manage` ở phạm vi tập đoàn thêm, ngừng (tải tệp chứng thư, hiện chủ thể, hạn) | YCAU_NGHIEPVU_153 |
| QUYTAC_NGHIEPVU_462 | Loại hợp đồng: danh mục theo công ty, nạp sẵn: Mua hàng (đối tác là nhà cung cấp), Bán hàng (khách hàng), Dịch vụ, Thuê, Hợp tác, Bảo mật thông tin, Khác; người có `office.contract.manage` thêm, đổi tên, ngừng. Mỗi loại có chiều: mua (công ty trả tiền), bán (công ty thu tiền), không có giá trị | YCAU_NGHIEPVU_154 |
| QUYTAC_NGHIEPVU_463 | Hợp đồng thuộc công ty đang chọn của người lập (`office.contract.create`). Trường: mã nội bộ (hệ thống cấp theo dãy số chứng từ `office.contract`), số hợp đồng (do hai bên thỏa thuận, tối đa 100 ký tự, không bắt buộc; cảnh báo không chặn khi trùng số trong công ty), tên (bắt buộc, tối đa 300 ký tự), loại, đối tác (bắt buộc, một hoặc nhiều, từ `crm.partners`; hợp đồng giữa hai công ty trong tập đoàn chọn đối tác nội bộ), giá trị (`numeric`, không âm, không bắt buộc; loại không có giá trị thì để trống), tiền tệ (mặc định VND), ngày ký, ngày hiệu lực (bắt buộc), ngày hết hạn (không bắt buộc, không trước ngày hiệu lực; để trống là không thời hạn), người phụ trách (bắt buộc, mặc định người lập), phòng ban, mật (có, không), mô tả (tối đa 5.000 ký tự), tệp nội dung (PDF, bắt buộc trước khi trình), tệp kèm theo như QUYTAC_NGHIEPVU_359, số ngày nhắc trước (mặc định 30 và 7, mỗi số từ 1 đến 365, tối đa 3 mốc) | YCAU_NGHIEPVU_154 |
| QUYTAC_NGHIEPVU_464 | Trạng thái hợp đồng: nháp → chờ duyệt → chờ ký → đã ký; chờ duyệt bị từ chối hoặc người lập rút thì sửa, trình lại; nháp, bị từ chối, đã rút, chờ ký hủy được (lý do; chờ ký thì hủy cả phiên ký). Duyệt qua luồng duyệt chung (loại chứng từ `office.contract`, giá trị duyệt là giá trị hợp đồng quy đổi VND theo tỷ giá ngày trình; công ty chưa có chính sách thì một cấp do trưởng phòng của người phụ trách duyệt, không có trưởng phòng thì người có `office.contract.manage`). Duyệt xong: người phụ trách lập phiên ký từ tệp nội dung (người ký mặc định: chữ ký công ty, đại diện từng đối tác theo thứ tự công ty ký trước) → phiên ký xong thì hợp đồng đã ký, ngày ký là ngày chữ ký cuối, tệp đã ký lưu vào hợp đồng; phiên bị từ chối, hết hạn thì hợp đồng về chờ ký, lập phiên mới được. Đã ký: nhãn Chưa hiệu lực, Đang hiệu lực, Sắp hết hạn (trong mốc nhắc đầu tiên), Hết hạn tính theo ngày (giờ Việt Nam), không phải trạng thái. Đã ký → đã thanh lý hoặc đã chấm dứt (ngày, lý do, tệp biên bản bắt buộc; người phụ trách hoặc `office.contract.manage`). Hợp đồng đã ký không sửa nội dung, chỉ sửa người phụ trách, phòng ban, mốc nhắc, chia sẻ, tệp kèm theo | YCAU_NGHIEPVU_154 |
| QUYTAC_NGHIEPVU_465 | Nhập hợp đồng đã ký (ký giấy hoặc ký ngoài hệ thống): người có `office.contract.create` nhập trường như QUYTAC_NGHIEPVU_463 kèm tệp đã ký (bắt buộc), ngày ký (bắt buộc) → hợp đồng đã ký ngay, không qua duyệt; tệp PDF có chữ ký số thì chạy kiểm tra QUYTAC_NGHIEPVU_461 và lưu kết quả cùng tệp. Phụ lục: lập trên hợp đồng đã ký, chưa thanh lý, chấm dứt; trường: số phụ lục, nội dung tóm tắt, ngày hiệu lực, thay đổi ngày hết hạn, thay đổi giá trị (không bắt buộc), tệp; đi cùng trạng thái, duyệt, ký như hợp đồng (loại chứng từ `office.contract_appendix`) hoặc nhập phụ lục đã ký; phụ lục đã ký mà có thay đổi thì ngày hết hạn, giá trị của hợp đồng cập nhật, giữ lịch sử | YCAU_NGHIEPVU_154 |
| QUYTAC_NGHIEPVU_466 | Người xem được hợp đồng: người lập, người phụ trách, người duyệt, người ký nội bộ của phiên ký, người được chia sẻ (người phụ trách chia sẻ cho người dùng trong công ty, quyền xem); hợp đồng không mật thì thêm người có `office.contract.view_all` bao trùm công ty. Hợp đồng mật: chỉ người liên quan nêu trên. Người không xem được nhận `404`. Danh sách kho chỉ hiện hợp đồng xem được; tìm theo mã nội bộ, số, tên, đối tác; lọc loại, trạng thái, nhãn hiệu lực, người phụ trách, khoảng ngày hết hạn. Hợp đồng lao động hiện trong kho (chỉ đọc: số, nhân viên, loại, ngày hiệu lực, ngày hết hạn, trạng thái; không hiện lương) khi người xem có `hr.contract.manage` bao trùm công ty; mở chi tiết sang Nhân sự. Mọi lần xem chi tiết, tải tệp hợp đồng mật ghi nhật ký thao tác | YCAU_NGHIEPVU_154 |
| QUYTAC_NGHIEPVU_467 | Nhắc hạn hợp đồng (tác vụ nền hằng ngày 7 giờ, giờ Việt Nam): hợp đồng đã ký, có ngày hết hạn, chưa thanh lý, chấm dứt: nhắc ở mỗi mốc nhắc trước của hợp đồng (mặc định còn 30, còn 7 ngày) và sau hạn ngày thứ 1, 8, 15, 22, 29; mỗi mốc một lần; không nhắc khi đã có phụ lục đã ký kéo dài ngày hết hạn qua mốc. Người nhận: người phụ trách, người có `office.contract.manage` bao trùm công ty (với hợp đồng mật chỉ người phụ trách). Phiên ký: nhắc người đang đến lượt khi còn 2 ngày đến hạn ký; hết hạn ký thì chuyển hết hạn, báo người lập | YCAU_NGHIEPVU_155 |

Gắn ký số vào chức năng đã có (CHUC_NANG_213, nằm trong QUYTAC_NGHIEPVU_457 đến 460, bổ sung quy tắc của công việc trước, lập phiếu tài liệu `24` khi duyệt):
- Công văn đi (QUYTAC_NGHIEPVU_365): sau khi cấp số, văn thư chọn "Ký số" thay cho "Phát hành bằng bản quét": hệ thống lập phiên ký từ tệp PDF đã cấp số, người ký là người ký của công văn (thứ tự 1) và chữ ký công ty (thứ tự 2, văn thư có `office.signing.company_seal` đóng). Phiên xong thì bản đã ký là tệp của phiên, văn thư bấm Phát hành (không cần tải bản quét). Phiên bị từ chối, hết hạn thì văn thư chọn lại Ký số hoặc phát hành bằng bản quét như cũ.
- Hợp đồng lao động, phụ lục (CONG_VIEC_46): sau khi duyệt, người có `hr.contract.manage` chọn "Ký số": tải tệp hợp đồng (PDF), người ký phía công ty (người dùng) và người lao động (người dùng trong tập đoàn nếu có tài khoản và tài khoản ký số, ngược lại là đối tác bên ngoài với thư điện tử, số định danh cá nhân lấy từ hồ sơ). Phiên xong thì Nhân sự nhận sự kiện, lưu tệp đã ký, chuyển hợp đồng sang đã ký như thao tác Ký hiện có (Văn phòng số không ghi vào schema `hr`).

## 6. Vai trò và quyền

| Quyền | Ý nghĩa | Nhạy cảm |
|---|---|---|
| `office.signing.use` | Lập phiên ký, kiểm tra chữ ký số PDF | Không |
| `office.signing.company_seal` | Đóng chữ ký số của công ty | Có |
| `office.signing.manage` | Cài đặt nhà cung cấp ký số, chữ ký số công ty; ở phạm vi tập đoàn: danh sách chứng thư gốc tin cậy | Có |
| `office.contract.create` | Lập, nhập hợp đồng, phụ lục | Không |
| `office.contract.view_all` | Xem mọi hợp đồng không mật của công ty | Có |
| `office.contract.manage` | Danh mục loại hợp đồng; sửa người phụ trách, thanh lý, chấm dứt mọi hợp đồng xem được; nhận nhắc hạn | Có |

- Ký với tư cách người dùng không cần quyền riêng: ai được chọn làm người ký và có tài khoản ký số thì ký phần của mình.
- Vai trò Nhân viên (`employee`) thêm `office.signing.use`. Vai trò Văn thư (`office_clerk`) thêm `office.signing.use`, `office.signing.company_seal`. Vai trò mới, phạm vi công ty: `office_contract_admin` (Quản lý hợp đồng): `office.access`, `office.signing.use`, `office.contract.create`, `office.contract.view_all`, `office.contract.manage`. Quản trị công ty, Quản trị tập đoàn có mọi quyền mới. Gán ở phạm vi tập đoàn hoặc công ty như CONG_VIEC_52.
- Loại chứng từ mới: `office.contract` (Hợp đồng, cần duyệt), `office.contract_appendix` (Phụ lục hợp đồng, cần duyệt), `office.signing_request` (Phiên ký, chỉ dùng dãy số).

## 7. Luồng nghiệp vụ (Luồng 56)

- Luồng 56a – Cài đặt: quản trị công ty cài nhà cung cấp ký số (bộ giả lập ở môi trường thử), kiểm tra kết nối, khai chữ ký số công ty; mỗi người ký khai tài khoản ký số của mình (mã định danh, chọn chứng thư).
- Luồng 56b – Trình ký tài liệu: nhân viên tải PDF, thêm người ký (Trưởng phòng thứ tự 1, Giám đốc thứ tự 2, chữ ký công ty thứ tự 3), gửi → Trưởng phòng nhận thông báo, mở, bấm Ký số, xác nhận trên điện thoại → Giám đốc ký → văn thư đóng chữ ký công ty → phiên đã ký xong, người lập tải tệp.
- Luồng 56c – Hợp đồng mua: nhân viên mua hàng lập hợp đồng với nhà cung cấp, tải tệp nội dung, trình duyệt → duyệt xong lập phiên ký (chữ ký công ty, đại diện nhà cung cấp) → văn thư đóng chữ ký công ty → nhà cung cấp nhận thư, mở đường dẫn, ký số → hợp đồng đã ký, đang hiệu lực → còn 30, 7 ngày nhận nhắc → lập phụ lục gia hạn hoặc để hết hạn, thanh lý.
- Luồng 56d – Công văn đi ký số: duyệt, cấp số → văn thư chọn Ký số → người ký ký, văn thư đóng chữ ký công ty → phát hành.
- Luồng 56e – Hợp đồng lao động ký số: duyệt → nhân sự chọn Ký số → giám đốc ký, người lao động ký (trong hệ thống hoặc qua đường dẫn) → hợp đồng lao động đã ký.

## 8. Màn hình (giai đoạn 06.1)

| Mã | Màn hình | Nội dung | Vai trò |
|---|---|---|---|
| MAN_HINH_210 | Trình ký | Thẻ Chờ tôi ký (gồm bước chữ ký công ty khi có quyền), Tôi gửi, Đã ký; cột mã, tiêu đề, nguồn (tài liệu, hợp đồng, công văn đi, hợp đồng lao động), người đang đến lượt, hạn ký, trạng thái; nút "Trình ký tài liệu"; ô "Tài khoản ký số của tôi" (chứng thư đang dùng, hạn, nút khai, đổi) | `office.access` |
| MAN_HINH_211 | Lập phiên ký | Tải PDF, tiêu đề, ghi chú, hạn ký; danh sách người ký (loại, người, thứ tự, trang, góc), xem trước vị trí ô chữ ký trên hình thu nhỏ trang; Lưu nháp, Gửi | `office.signing.use` |
| MAN_HINH_212 | Chi tiết phiên ký | Xem PDF hiện hành, tiến trình người ký (đã ký lúc, đang chờ xác nhận trên điện thoại, từ chối kèm lý do), nút Ký số, Từ chối, Nhắc, Gửi lại thư đối tác, Hủy, Sao chép thành phiên mới, Tải bản đã ký; lịch sử | Người lập, người ký, người xem được nguồn |
| MAN_HINH_213 | Trang ký của đối tác | Trang công khai: tên công ty gửi, tiêu đề, ghi chú, xem, tải PDF, Ký số (chờ xác nhận trên ứng dụng của nhà cung cấp), Từ chối; báo đường dẫn hết hạn, đã dùng | Đối tác (không đăng nhập) |
| MAN_HINH_214 | Kiểm tra chữ ký PDF | Tải tệp, bảng kết quả từng chữ ký (người ký, tổ chức cấp, thời gian, toàn vẹn, hiệu lực, tin cậy, kết luận) | `office.signing.use` |
| MAN_HINH_215 | Kho hợp đồng | Danh sách hợp đồng (và hợp đồng lao động khi có quyền), tìm, lọc, nhãn hiệu lực, ô tóm tắt (đang hiệu lực, sắp hết hạn, hết hạn); nút Lập hợp đồng, Nhập hợp đồng đã ký | `office.contract.create`, `office.contract.view_all`, người liên quan |
| MAN_HINH_216 | Chi tiết, lập hợp đồng | Biểu mẫu trường; chi tiết: thông tin, đối tác, tệp nội dung, tệp đã ký và kết quả kiểm tra chữ ký, phụ lục, tiến trình duyệt, phiên ký, chia sẻ, lịch sử; nút theo trạng thái (Trình, Rút, Hủy, Lập phiên ký, Lập phụ lục, Thanh lý, Chấm dứt) | Người xem được hợp đồng |
| MAN_HINH_217 | Cài đặt ký số và hợp đồng | Thẻ Nhà cung cấp ký số (loại, môi trường, thông tin kết nối, kiểm tra), Chữ ký số công ty, Chứng thư gốc tin cậy (phạm vi tập đoàn), Loại hợp đồng | `office.signing.manage`, `office.contract.manage` |

Điều hướng: menu Văn phòng số thêm Trình ký (210 → 211, 212), Kiểm tra chữ ký (214), Hợp đồng (215 → 216), Cài đặt ký số và hợp đồng (217, khi có quyền). Thông báo phiên ký mở 212, nhắc hạn hợp đồng mở 216. MAN_HINH_158 (công văn đi) thêm nút Ký số và tiến trình phiên ký; màn hình hợp đồng lao động của Nhân sự thêm nút Ký số.

## 9. Dữ liệu và API (phác thảo, chi tiết ở giai đoạn 07)

- Schema `office` (CONG_VIEC_52). Tệp lưu ở `office.files` như CONG_VIEC_52; thêm cột mã băm SHA-256 cho tệp dùng trong ký số.
- Database migration `0121_office_signing.sql`: `office.signing_settings` (nhà cung cấp theo công ty, thông tin kết nối mã hóa bằng `common/secret-box.ts`), `office.signing_identities` (chứng thư của người dùng, của công ty), `office.trusted_roots`, `office.signing_requests`, `office.signing_signers` (mã băm của mã đường dẫn đối tác, hạn), `office.signing_attempts` (mỗi lần gửi nhà cung cấp, mã giao dịch, kết quả), `office.signing_events` (lịch sử).
- Database migration `0122_office_contracts.sql`: `office.contract_types`, `office.contracts`, `office.contract_partners`, `office.contract_appendices`, `office.contract_shares`, `office.contract_events`, `office.contract_reminders` (khóa duy nhất hợp đồng, mốc).
- Database migration `0123_office_signing_links.sql`: liên kết phiên ký với công văn đi (`office.outgoing_documents.signing_request_id`), loại nguồn của phiên ký; quyền, vai trò, loại chứng từ mới.
- Database migration `0124`: dự phòng.
- API_241 `/office/signing-settings` (xem, lưu, kiểm tra kết nối, chữ ký số công ty), `/office/trusted-roots`; API_242 `/office/signing-identities/me` (lấy chứng thư từ nhà cung cấp, chọn, xem); API_243 `/office/signing-requests` (danh sách theo thẻ, lập, sửa nháp, gửi, chi tiết, tệp, ký, từ chối, nhắc, gửi lại thư, hủy, sao chép); API_244 `/public/signing/{mã}` (xem, tệp, ký, kết quả, từ chối; không đăng nhập, giới hạn tần suất); API_245 `/office/signature-verifications`; API_246 `/office/contracts` (danh sách, chi tiết, lập, nhập đã ký, sửa, tệp, trình, rút, hủy, lập phiên ký, thanh lý, chấm dứt, chia sẻ, phụ lục); API_247 `/office/contract-types`, `/office/contract-options`; API_248 `/office/outgoing/{id}/digital-signing`, `/hr/contracts/{id}/digital-signing`, `/hr/contract-appendices/{id}/digital-signing`.
- Lớp kết nối nhà cung cấp (`apps/api/src/office/signing/providers/`): giao diện chung (kiểm tra kết nối, danh sách chứng thư theo mã định danh, gửi yêu cầu ký mã băm, tra kết quả theo mã giao dịch); bộ giả lập (tổ chức chứng thực giả lập sinh khi khởi động môi trường thử, chứng thư cho mỗi mã định danh, xác nhận tự động sau 2 giây, tình huống từ chối, quá giờ theo mã định danh đặc biệt để kiểm thử).
- Xử lý PDF: `pdf-lib` thêm ô chữ ký, `@signpdf/placeholder-pdf-lib` tạo chỗ ký PAdES (`ETSI.CAdES.detached`), `@signpdf/signpdf` chèn chữ ký, `node-forge` đọc chữ ký, chứng thư khi kiểm tra (người dùng duyệt ngày 2026-11-12).
- Sự kiện outbox: `office.signing.completed`, `office.signing.ended` (nguồn, mã nguồn, mã tệp); Nhân sự, công văn đi nghe để cập nhật chứng từ của mình.
- Tác vụ nền mới (BullMQ): `office-signing-poll` (mỗi 5 giây, lần ký đang chờ xác nhận), `office-contract-reminders` (7 giờ hằng ngày), `office-signing-expiry` (mỗi giờ).

## 10. Điều kiện đặc biệt

- Ký tuần tự trên một tệp: mỗi chữ ký mới đọc bản hiện hành trong giao dịch có khóa phiên ký (`FOR UPDATE`); hai người cùng thứ tự ký đồng thời thì người sau chờ bản mới rồi mới tạo chỗ ký, không ghi đè chữ ký của người trước.
- Chữ ký nhận từ nhà cung cấp chỉ chèn khi mã băm trong chữ ký khớp mã băm đã gửi; tệp sau khi chèn phải qua kiểm tra QUYTAC_NGHIEPVU_461 mới lưu.
- Trang ký của đối tác: không trả thông tin khác của công ty; không lộ việc mã có tồn tại hay không ngoài thông báo chung "Đường dẫn không dùng được".
- Mọi truy vấn hợp đồng có điều kiện quyền xem (QUYTAC_NGHIEPVU_466) trong truy vấn.

## 11. Tiêu chí nghiệm thu

| Mã | Tiêu chí | Mức |
|---|---|---|
| TIEUCHI_NGHIEMTHU_422 | Cài đặt nhà cung cấp: kiểm tra kết nối; thông tin kết nối không trả về giao diện; bộ giả lập bị chặn ở môi trường chính thức; chữ ký số công ty chỉ lưu khi mã số thuế trùng | Bắt buộc |
| TIEUCHI_NGHIEMTHU_423 | Tài khoản ký số: khai mã định danh, chọn chứng thư; chứng thư hết hạn không ký được | Bắt buộc |
| TIEUCHI_NGHIEMTHU_424 | Ký một chữ ký: tệp kết quả có chữ ký PAdES hợp lệ đọc được bằng phần mềm đọc PDF (báo chứng thư giả lập không tin cậy), hình chữ ký đúng vị trí, nội dung; từ chối, quá 5 phút thì lần ký thất bại, ký lại được | Bắt buộc |
| TIEUCHI_NGHIEMTHU_425 | Phiên ký nhiều người: đúng thứ tự, cùng thứ tự ký song song không mất chữ ký; mọi chữ ký trước vẫn hợp lệ sau chữ ký cuối; thông báo đúng người đến lượt | Bắt buộc |
| TIEUCHI_NGHIEMTHU_426 | Trạng thái phiên ký: từ chối, hủy, hết hạn, nhắc (tối đa một lần mỗi ngày), sao chép thành phiên mới; chỉ sửa khi nháp | Bắt buộc |
| TIEUCHI_NGHIEMTHU_427 | Đối tác ký qua đường dẫn: mở không cần đăng nhập; mã hết dùng đúng lúc; chủ thể chứng thư không trùng thông tin đối tác thì bị loại; giới hạn tần suất; gửi lại thư làm mã cũ hết dùng | Bắt buộc |
| TIEUCHI_NGHIEMTHU_428 | Kiểm tra chữ ký PDF: tệp ký đúng báo Hợp lệ hoặc Chưa xác định tin cậy theo danh sách gốc tin cậy; tệp bị sửa sau khi ký báo Không hợp lệ; tệp bổ sung sau chữ ký được báo | Bắt buộc |
| TIEUCHI_NGHIEMTHU_429 | Hợp đồng: lập, trình duyệt qua luồng duyệt, lập phiên ký, đã ký với ngày ký và tệp đã ký; nhập hợp đồng đã ký; nhãn hiệu lực đúng theo ngày; thanh lý, chấm dứt; đã ký không sửa nội dung | Bắt buộc |
| TIEUCHI_NGHIEMTHU_430 | Phụ lục: duyệt, ký hoặc nhập đã ký; cập nhật ngày hết hạn, giá trị, giữ lịch sử | Bắt buộc |
| TIEUCHI_NGHIEMTHU_431 | Quyền xem hợp đồng đúng QUYTAC_NGHIEPVU_466 (người liên quan, chia sẻ, xem tất cả, mật, `404`, hợp đồng lao động chỉ đọc không có lương, khác công ty không thấy) | Bắt buộc |
| TIEUCHI_NGHIEMTHU_432 | Nhắc hạn đúng mốc, mỗi mốc một lần, đúng người nhận; không nhắc khi phụ lục đã gia hạn; nhắc người ký trước hạn ký | Bắt buộc |
| TIEUCHI_NGHIEMTHU_433 | Công văn đi ký số rồi phát hành không cần bản quét; hợp đồng lao động ký số chuyển đã ký với tệp đã ký; MAN_HINH_210 đến MAN_HINH_217 đạt danh sách rà soát giao diện trên máy tính và điện thoại | Bắt buộc |

## 12. Kịch bản kiểm thử

KICHBAN_KIEMTHU_597 đến KICHBAN_KIEMTHU_610 (chi tiết ở tài liệu `21` khi lập trình): 597 cài đặt nhà cung cấp, chữ ký công ty (422); 598 tài khoản ký số (423); 599 ký một chữ ký, đọc lại bằng phần mềm đọc PDF (424); 600 nhiều người, song song, đồng thời (425); 601 trạng thái phiên ký (426); 602 đối tác ký, sai chủ thể, hết hạn mã, giới hạn tần suất (427); 603 kiểm tra chữ ký, tệp bị sửa (428); 604 vòng đời hợp đồng (429); 605 nhập hợp đồng đã ký, thanh lý (429); 606 phụ lục (430); 607 quyền xem theo vai trò (431); 608 nhắc hạn (432); 609 công văn đi, hợp đồng lao động ký số (433); 610 rà soát giao diện (433).

## 13. Lát và điểm xem trước

| Lát | Nội dung | Điểm xem trước |
|---|---|---|
| L0 | Đặc tả, bản mẫu MAN_HINH_210 đến 217 | Người dùng duyệt đặc tả, bản mẫu |
| L1 | CHUC_NANG_210, 211: lớp ký số, bộ giả lập, tài khoản ký số, chữ ký công ty, phiên ký, đối tác ký, kiểm tra chữ ký (0121) | Trình ký một PDF cho hai người và chữ ký công ty, mở tệp kết quả, kiểm tra chữ ký |
| L2 | CHUC_NANG_212: kho hợp đồng, phụ lục, quyền xem, nhắc hạn (0122) | Lập, duyệt, ký hợp đồng mua với đối tác qua đường dẫn; kho, nhắc hạn |
| L3 | CHUC_NANG_213: công văn đi, hợp đồng lao động ký số (0123) | Phát hành công văn ký số; ký hợp đồng lao động |

Mọi lát cần mã của CONG_VIEC_52 (schema `office`, mini app `web-office`): lập trình sau khi CONG_VIEC_52 vào `main`; cần trước thì hợp nhất nhánh CONG_VIEC_52 vào nhánh này và báo phiên cha.

## 16. Quyết định AI tự đưa ra (chờ người dùng xác nhận khi duyệt đặc tả)

- Đối tác hợp đồng lấy từ `crm.partners` (dùng chung nhà cung cấp, khách hàng); đối tác chưa có thì lập ở Quan hệ khách hàng.
- Vị trí chữ ký chọn theo trang và góc, không kéo thả trên trang (không cần thêm thư viện hiển thị PDF); xem PDF bằng trình xem có sẵn của trình duyệt.
- Không dùng OTP cho đối tác: nhà cung cấp ký số từ xa đã xác thực người ký trên ứng dụng của họ; hệ thống đối chiếu chủ thể chứng thư với thông tin đối tác.
- Nhập hợp đồng đã ký không qua duyệt.
- Phiên bản thư viện: `@signpdf/signpdf` 4.0.0, `@signpdf/placeholder-pdf-lib` 4.0.0, `@signpdf/utils` 4.0.0 (MIT, phát hành 2026-10-19), `pdf-lib` 1.17.1 (MIT), `node-forge` 1.4.2 (chọn giấy phép BSD-3-Clause; bản 1.4.3 phát hành 2026-11-04 chưa đủ hai tuần), `@types/node-forge` 1.3.14 (MIT).

## 17. Quyết định của người dùng (2026-11-12)

- Cách ký số: lớp kết nối chung kèm bộ giả lập; nhà cung cấp thật nối khi có tài khoản và tài liệu API.
- Văn bản ký số: công văn đi, hợp đồng trong kho, hợp đồng lao động, mọi tệp PDF tải lên.
- Kho hợp đồng: mua với nhà cung cấp, bán với khách hàng, dịch vụ, thuê, khác; hiện cả hợp đồng lao động.
- Quyền xem: người liên quan cộng quyền xem tất cả; hợp đồng mật chỉ người liên quan.
- Chia lát: lõi ký và trình ký trước, kho hợp đồng, rồi gắn vào công văn đi và hợp đồng lao động.
- Người ký: người ký cá nhân và chữ ký số của công ty.
- Đối tác ký qua đường dẫn, bằng chữ ký số từ xa của đối tác qua nhà cung cấp.
- Nhắc hạn như hợp đồng lao động, mốc nhắc trước sửa được theo từng hợp đồng.
- Duyệt thư viện `@signpdf`, `pdf-lib`, `node-forge`.

## 18. Rủi ro và giới hạn

- Căn cứ pháp lý chưa tra nguyên văn (mục 3): phải tra trước khi duyệt đặc tả.
- Đối tác chỉ ký được khi có tài khoản ký số từ xa ở cùng nhà cung cấp mà công ty kết nối; đối tác dùng nhà cung cấp khác thì không ký qua đường dẫn được (cần phương án dự phòng, ví dụ đối tác tải lên bản đã ký số, nếu người dùng đồng ý).
- Không kiểm tra thu hồi chứng thư, không có dấu thời gian của tổ chức cung cấp dịch vụ dấu thời gian: thời gian ký lấy theo đồng hồ hệ thống; chữ ký có thể không đạt yêu cầu lưu trữ dài hạn. Cần đánh giá theo nghị định về chữ ký điện tử khi tra luật.
- Bộ giả lập không có giá trị pháp lý; môi trường chính thức cần nhà cung cấp thật.
- `pdf-lib` không còn được phát triển tích cực (bản cuối 2021); một số tệp PDF lạ có thể không xử lý được, báo lỗi rõ cho người dùng.
