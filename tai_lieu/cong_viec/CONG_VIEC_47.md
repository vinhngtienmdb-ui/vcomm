# CONG_VIEC_47: Ca làm, chấm công, nghỉ phép, tăng ca, bảng công tháng (MODULE_08, phần 2)

- Mô tả: Trong mini app Nhân sự `apps/web-hr`: ca làm, lịch làm việc, xếp ca; ngày lễ; ghi nhận chấm công từ máy chấm công (nhập tệp), ghi thủ công, chấm công trên ứng dụng (GPS, mạng công ty, mã QR động); đơn giải trình công; nghỉ phép (loại nghỉ, phép năm, đơn nghỉ); tăng ca (phiếu đăng ký, giới hạn theo luật); bảng công tháng có nhân viên xác nhận, nhân sự chốt, làm đầu vào cho lương (CONG_VIEC_48).
- Phiên bản: 0.1
- Ngày cập nhật: 2026-11-11
- Trạng thái: Chờ nghiệm thu (người dùng duyệt đặc tả, bản mẫu và điểm xem trước lát L0 đến L3 ngày 2026-11-11).
- Mức: Lớn (nghiệp vụ mới, dữ liệu mới, quyền mới, việc nền mới, dữ liệu vị trí).
- Nguồn: tài liệu `01` mục 4 (MODULE_08: chấm công), tài liệu `05` mục 2.1; quyết định của người dùng ngày 2026-11-11 (mục 17). Nền: CONG_VIEC_46 (hồ sơ, hợp đồng, schema `hr`, mini app `apps/web-hr`).

## 1. Mục tiêu

Mỗi công ty con ghi nhận đúng thời gian làm việc, nghỉ, tăng ca của người lao động trên một hệ thống, đúng Bộ luật Lao động; bảng công tháng được người lao động xác nhận và nhân sự chốt, đủ dữ liệu để tính lương mà không phải tổng hợp tay.

## 2. Phạm vi

Trong phạm vi: CHUC_NANG_165 đến CHUC_NANG_167, MAN_HINH_120 đến MAN_HINH_125, API_150 đến API_155, database migration 0073 đến 0075.

Ngoài phạm vi (công việc sau):
- Tính tiền lương, tiền tăng ca, bảo hiểm xã hội (CONG_VIEC_48 đọc bảng công của phần này).
- Kết nối trực tiếp máy chấm công qua mạng (chỉ nhập tệp xuất từ máy).
- Chấm công bằng ảnh khuôn mặt, ràng buộc thiết bị cá nhân, phát hiện giả lập vị trí.
- Hồ sơ hưởng chế độ ốm đau, thai sản với cơ quan bảo hiểm xã hội (chỉ ghi ngày nghỉ).
- Ca làm việc kéo dài quá 24 giờ; người làm công việc có tính chất đặc biệt (Điều 116); làm việc không trọn thời gian có quy định riêng.
- Báo cáo làm thêm từ trên 200 đến 300 giờ gửi Sở (hệ thống chỉ nhắc).

## 3. Căn cứ pháp lý đã tra (2026-11-11)

| Văn bản | Điều | Nội dung dùng trong đặc tả |
|---|---|---|
| Bộ luật Lao động 45/2019/QH14 (văn bản hợp nhất 125/VBHN-VPQH ngày 27/08/2025 đã đối chiếu: Luật 71/2025/QH15 chỉ thêm khoản 8a Điều 154; các điều dưới đây không đổi) | Điều 98 | Làm thêm ngày thường ít nhất 150%, ngày nghỉ hằng tuần 200%, ngày lễ, tết, ngày nghỉ có hưởng lương 300%; làm việc ban đêm trả thêm ít nhất 30%; làm thêm vào ban đêm trả thêm 20% |
| | Điều 105 | Thời giờ làm việc bình thường không quá 08 giờ/ngày, 48 giờ/tuần; quy định theo tuần thì không quá 10 giờ/ngày, 48 giờ/tuần; phải thông báo cho người lao động |
| | Điều 106 | Giờ làm việc ban đêm từ 22 giờ đến 06 giờ sáng hôm sau |
| | Điều 107 | Làm thêm phải được người lao động đồng ý; không quá 50% số giờ làm việc bình thường trong 01 ngày (theo tuần: tổng không quá 12 giờ/ngày); không quá 40 giờ/tháng; không quá 200 giờ/năm, 300 giờ với ngành, nghề, trường hợp ở khoản 3 (phải thông báo cơ quan chuyên môn về lao động cấp tỉnh) |
| | Điều 109, 110, 111 | Nghỉ giữa giờ ít nhất 30 phút (ban đêm 45 phút) khi làm từ 06 giờ; ca liên tục thì nghỉ giữa giờ tính vào giờ làm; nghỉ ít nhất 12 giờ trước khi chuyển ca; nghỉ hằng tuần ít nhất 24 giờ liên tục; nghỉ hằng tuần trùng ngày lễ thì nghỉ bù ngày làm việc kế tiếp |
| | Điều 112 | Nghỉ lễ, tết hưởng nguyên lương 11 ngày; người nước ngoài thêm 01 ngày Tết cổ truyền và 01 ngày Quốc khánh nước họ; Thủ tướng quyết định cụ thể ngày nghỉ Tết âm lịch, Quốc khánh hằng năm |
| | Điều 113 | Đủ 12 tháng: 12 ngày làm việc (điều kiện bình thường), 14 ngày (chưa thành niên, người khuyết tật, nặng nhọc, độc hại, nguy hiểm), 16 ngày (đặc biệt nặng nhọc, độc hại, nguy hiểm); chưa đủ 12 tháng thì theo tỷ lệ số tháng; thôi việc chưa nghỉ hết thì được thanh toán; nghỉ nhiều lần hoặc gộp tối đa 03 năm một lần |
| | Điều 114 | Đủ 05 năm làm việc cho một người sử dụng lao động thì tăng thêm 01 ngày |
| | Điều 115 | Việc riêng có lương: kết hôn 03 ngày; con kết hôn 01 ngày; cha, mẹ (đẻ, nuôi, của vợ hoặc chồng), vợ hoặc chồng, con chết 03 ngày. Không lương 01 ngày khi ông, bà, anh, chị, em ruột chết; cha hoặc mẹ kết hôn; anh, chị, em ruột kết hôn. Thỏa thuận nghỉ không lương khác |
| | Điều 127 khoản 3 | Cấm phạt tiền, cắt lương thay việc xử lý kỷ luật lao động |
| | Điều 137 khoản 1 | Không làm thêm giờ, làm đêm với lao động nữ mang thai từ tháng thứ 07 (thứ 06 ở vùng cao, vùng sâu, vùng xa, biên giới, hải đảo); nuôi con dưới 12 tháng tuổi trừ khi người lao động đồng ý |
| | Điều 146 khoản 2 | Từ đủ 15 đến chưa đủ 18 tuổi: không quá 08 giờ/ngày, 40 giờ/tuần; chỉ làm thêm, làm đêm trong danh mục của Bộ trưởng |
| Nghị định 145/2020/NĐ-CP (hết hiệu lực một phần) | Điều 55, 56, 57 | Cách tính tiền lương làm thêm, làm đêm; làm thêm vào ban đêm ngày thường có làm thêm ban ngày trước đó thì tiền lương giờ ban ngày tính ít nhất 150%; làm thêm vào ngày nghỉ bù khi lễ trùng nghỉ hằng tuần tính như ngày nghỉ hằng tuần |
| | Điều 58 | Thời giờ được tính vào thời giờ làm việc được hưởng lương (nghỉ giữa giờ ca liên tục, lao động nữ hành kinh, nuôi con dưới 12 tháng, ngừng việc không do lỗi người lao động, hội họp, học tập theo yêu cầu…) |
| | Điều 59 | Đồng ý làm thêm phải gồm thời gian, địa điểm, công việc làm thêm |
| | Điều 60 | Làm thêm ngày thường không quá 50% giờ bình thường; theo tuần hoặc không trọn thời gian: tổng không quá 12 giờ/ngày; làm thêm ngày lễ, tết, nghỉ hằng tuần không quá 12 giờ/ngày |
| | Điều 61, 62 | Trường hợp được làm thêm trên 200 đến 300 giờ/năm; thông báo Sở chậm nhất 15 ngày kể từ ngày làm thêm vượt 200 giờ |
| | Điều 63 | Ca làm việc gồm thời gian làm việc và nghỉ giữa giờ; ca liên tục khi ca từ 06 giờ và chuyển tiếp hai ca không quá 45 phút |
| | Điều 65 | Thời gian được coi là thời gian làm việc để tính nghỉ hằng năm: thử việc (nếu tiếp tục làm), việc riêng có lương, không lương được đồng ý cộng dồn không quá 01 tháng/năm, ốm đau không quá 02 tháng/năm, tai nạn lao động không quá 6 tháng, thai sản, ngừng việc không do lỗi người lao động… |
| | Điều 66 | Chưa đủ 12 tháng: (ngày nghỉ hằng năm + ngày thâm niên) / 12 × số tháng làm việc thực tế; tháng làm chưa đủ: ngày làm việc và ngày nghỉ có hưởng lương từ 50% số ngày làm việc bình thường của tháng thì tính là 01 tháng |
| | Điều 67 | Tiền lương ngày nghỉ lễ, phép năm, việc riêng có lương là tiền lương theo hợp đồng tại thời điểm nghỉ; ngày phép chưa nghỉ khi thôi việc tính theo lương hợp đồng tháng trước liền kề |

## 4. Yêu cầu nghiệp vụ và chức năng

| Mã | Yêu cầu | Người cần |
|---|---|---|
| YCAU_NGHIEPVU_66 | Khai báo ca làm, lịch làm việc theo tuần cho công ty, phòng ban, nhân viên; xếp ca theo ngày; lịch ngày lễ chung tập đoàn và ngày nghỉ riêng của công ty | Nhân sự, Trưởng phòng |
| YCAU_NGHIEPVU_67 | Ghi nhận giờ vào, giờ ra từ máy chấm công (nhập tệp), ghi thủ công, chấm trên ứng dụng (GPS, mạng công ty, mã QR động, cấu hình theo địa điểm); bổ sung công bằng đơn giải trình qua luồng duyệt | Nhân sự, người lao động |
| YCAU_NGHIEPVU_68 | Tính công từng ngày theo giờ làm thực tế, ghi đi muộn, về sớm, vắng; giờ làm ban đêm | Nhân sự |
| YCAU_NGHIEPVU_69 | Nghỉ phép đúng luật: loại nghỉ, phép năm cộng dần theo tháng, thâm niên, phép tồn, đơn nghỉ qua luồng duyệt chung | Người lao động, Trưởng phòng, Nhân sự |
| YCAU_NGHIEPVU_70 | Tăng ca có đồng ý của người lao động, đăng ký trước qua luồng duyệt, không vượt giới hạn luật | Người lao động, Trưởng phòng, Nhân sự |
| YCAU_NGHIEPVU_71 | Bảng công tháng: người lao động xác nhận hoặc giải trình, nhân sự chốt; đầu vào tính lương | Nhân sự, Kế toán lương, người lao động |

| Mã | Chức năng | Yêu cầu |
|---|---|---|
| CHUC_NANG_165 | Ca làm, lịch tuần, xếp ca theo ngày, ngày lễ, cài đặt chấm công và địa điểm chấm công; lượt chấm (nhập tệp, thủ công, ứng dụng, mã QR động); tính công ngày; đơn giải trình công | YCAU_NGHIEPVU_66, 67, 68 |
| CHUC_NANG_166 | Nghỉ phép: loại nghỉ, chế độ phép năm của nhân viên, sổ phép (cộng dần, điều chỉnh, hết hạn, thanh toán), đơn nghỉ qua luồng duyệt, nhân sự ghi nhận nghỉ | YCAU_NGHIEPVU_69 |
| CHUC_NANG_167 | Tăng ca (phiếu đăng ký, đồng ý, luồng duyệt, giới hạn); bảng công tháng (kỳ, tổng hợp, xác nhận, giải trình, chốt, mở lại, xuất Excel); trang "Chấm công của tôi" | YCAU_NGHIEPVU_70, 71 |

## 5. Quy tắc nghiệp vụ

| Mã | Quy tắc | Yêu cầu |
|---|---|---|
| QUYTAC_NGHIEPVU_302 | Ca làm thuộc công ty: mã (duy nhất trong công ty, tối đa 20 ký tự), tên, giờ bắt đầu, giờ kết thúc (kết thúc trước hoặc bằng giờ bắt đầu nghĩa là qua ngày hôm sau; độ dài ca không quá 24 giờ), nghỉ giữa ca (giờ bắt đầu, số phút; nằm trong ca), nghỉ giữa ca có tính vào giờ làm hay không, hệ số công (1 hoặc 0,5; mặc định 1), trạng thái đang dùng hoặc ngừng. Giờ chuẩn của ca = độ dài ca − nghỉ giữa ca không tính giờ làm. Cài đặt công ty "Thời giờ làm việc bình thường": theo ngày (giờ chuẩn của ca không quá 8) hoặc theo tuần (không quá 10); vượt thì chặn. Ca có từ 6 giờ chuẩn trở lên mà nghỉ giữa ca dưới 30 phút (dưới 45 phút nếu ca có từ 3 giờ trong khung 22–6 giờ) thì cảnh báo, không chặn (ca liên tục được tính nghỉ vào giờ làm). Giờ chuẩn ban đêm của ca là phần giờ làm trong khung 22–6 giờ | YCAU_NGHIEPVU_66 |
| QUYTAC_NGHIEPVU_303 | Lịch tuần: tên, 7 ngày (thứ hai đến chủ nhật), mỗi ngày một ca hoặc nghỉ; mỗi công ty có đúng một lịch tuần mặc định. Gán lịch tuần cho phòng ban hoặc nhân viên kèm ngày bắt đầu áp dụng. Ca dự kiến của một nhân viên trong một ngày lấy theo thứ tự: xếp ca theo ngày → lịch tuần gán cho nhân viên → lịch tuần gán cho phòng ban hiện hành → lịch mặc định. Xếp ca theo ngày: chọn ca hoặc "Nghỉ" cho từng nhân viên từng ngày (bảng tuần), nhập được từ Excel (mã nhân viên, ngày, mã ca hoặc "OFF"). Tổng giờ chuẩn dự kiến của nhân viên trong tuần (thứ hai đến chủ nhật) không quá 48 (chưa thành niên: 40, ngày không quá 8) thì mới lưu; mỗi tuần phải có ít nhất 1 ngày nghỉ, thiếu thì cảnh báo (Điều 111 cho phép bình quân 4 ngày/tháng). Khoảng nghỉ giữa hai ca liền nhau dưới 12 giờ thì cảnh báo. Không sửa lịch, xếp ca của ngày thuộc kỳ bảng công đã chốt. Ngày lễ: lịch chung tập đoàn (ngày, tên, áp dụng cho người nước ngoài hay mọi người) do người có quyền ở phạm vi tập đoàn khai báo; mỗi công ty thêm ngày nghỉ có hưởng lương riêng. Tạo năm mới tự điền 01/01, 30/4, 01/5, 02/9; người khai báo thêm ngày Tết âm lịch, Giỗ Tổ, ngày liền kề Quốc khánh, ngày nghỉ bù theo thông báo hằng năm. Ngày lễ không có ca dự kiến (có lương); ngày lễ của người nước ngoài chỉ áp dụng cho hồ sơ có quốc tịch khác Việt Nam | YCAU_NGHIEPVU_66 |
| QUYTAC_NGHIEPVU_304 | Lượt chấm (thời điểm, nguồn): máy chấm công (nhập tệp), thủ công, ứng dụng, giải trình. Mỗi hồ sơ có mã chấm công (mã người dùng trên máy, duy nhất trong công ty, mặc định trống). Nhập tệp CSV hoặc Excel (cột: mã chấm công, ngày giờ hoặc ngày và giờ riêng; mã máy không bắt buộc; có tệp mẫu): xem trước từng dòng (lỗi: mã chưa gán, thời điểm sai, thuộc kỳ đã chốt), bỏ qua lượt trùng (cùng người, cùng phút), xác nhận mới ghi; lưu lần nhập (tên tệp, số dòng đạt, lỗi, trùng, người nhập). Ghi thủ công: nhân sự thêm giờ vào, giờ ra cho một ngày kèm lý do (bắt buộc). Lượt từ máy, ứng dụng không sửa, không xóa; lượt thủ công xóa được (ghi nhật ký) khi kỳ chưa chốt. Chấm trên ứng dụng: địa điểm chấm công thuộc công ty (tên, chi nhánh, tọa độ và bán kính 50–1000 m, các dải địa chỉ IP mạng công ty dạng CIDR, bật mã QR động; ít nhất một cách được bật); cài đặt công ty chọn nhân viên được chấm ở mọi địa điểm hay chỉ địa điểm của chi nhánh làm việc. Lượt được nhận khi đạt ít nhất một cách đang bật của một địa điểm được phép: GPS (khoảng cách tới tâm không quá bán kính, độ chính xác báo về không quá 100 m), IP (địa chỉ của yêu cầu thuộc dải), QR (mã còn hạn). Mã QR động hiện trên màn hình đặt tại địa điểm (mở bởi người có `hr.attendance.manage`), đổi mỗi 30 giây, chứa liên kết tới trang chấm công kèm mã ký HMAC theo địa điểm và khung thời gian, nhận mã của khung hiện tại và khung liền trước. Người lao động quét bằng camera điện thoại, đăng nhập, bấm "Vào ca" hoặc "Ra ca". Lưu cách xác thực, địa điểm, tọa độ, độ chính xác, IP; hai lượt ứng dụng cách nhau ít nhất 1 phút. Chỉ hồ sơ đang làm có tài khoản liên kết, chấm cho chính mình | YCAU_NGHIEPVU_67 |
| QUYTAC_NGHIEPVU_305 | Công ngày (giờ Việt Nam): mỗi ngày có ca dự kiến, lượt chấm thuộc ca nếu trong khoảng [giờ bắt đầu − 4 giờ, giờ kết thúc + 8 giờ] và không thuộc khoảng của ca liền sau; ngày không có ca dùng khoảng 0–24 giờ của ngày đó. Giờ vào = lượt đầu, giờ ra = lượt cuối (ít nhất hai lượt; chỉ một lượt thì "Thiếu lượt chấm", 0 công đến khi giải trình hoặc ghi thủ công). Giờ làm thực tế = phần giao giữa [giờ vào, giờ ra] và ca, trừ phần nghỉ giữa ca không tính giờ làm. Ngưỡng ân hạn (cài đặt công ty, mặc định 5 phút, 0–30): vào muộn hoặc ra sớm không quá ngưỡng coi như đúng giờ. Đi muộn = giờ vào − giờ bắt đầu ca (vượt ngưỡng), về sớm = giờ kết thúc ca − giờ ra; ghi số lần, số phút. Công làm việc = hệ số ca × min(1, giờ làm thực tế / giờ chuẩn), làm tròn 2 chữ số; ngày có nghỉ nửa ngày thì giờ chuẩn còn một nửa và công làm việc không quá nửa hệ số ca. Không phạt, không trừ thêm ngoài giờ thiếu (Điều 127). Giờ ban đêm = phần giờ làm thực tế trong ca thuộc khung 22–6 giờ. Ngày làm việc theo lịch, không lễ, không nghỉ, không lượt chấm, đã qua thì "Vắng không phép" (công vắng = hệ số ca). Kết quả từng ngày lưu lại, tính lại khi có lượt mới, đơn nghỉ, phiếu tăng ca, giải trình được duyệt, đổi lịch hoặc ngày lễ; việc nền lúc 1 giờ giờ Việt Nam tính lại ngày hôm trước | YCAU_NGHIEPVU_68 |
| QUYTAC_NGHIEPVU_306 | Đơn giải trình công: người lao động có tài khoản liên kết lập cho ngày đã qua của kỳ chưa chốt; loại (quên chấm, đi công tác, làm việc bên ngoài, máy chấm công lỗi, khác), giờ vào, giờ ra (ít nhất một), lý do (bắt buộc), tệp đính kèm không bắt buộc (PDF, JPG, PNG, tối đa 5 MB). Số đơn tối đa mỗi tháng theo cài đặt công ty (mặc định 0 = không giới hạn). Đi luồng duyệt chung (loại chứng từ `hr.attendance_correction`, giá trị duyệt 1; công ty chưa có chính sách duyệt thì gửi xong là duyệt). Duyệt xong tạo lượt chấm nguồn "giải trình" và tính lại ngày. Rút được khi cấp đầu chưa quyết định; bị từ chối thì lập đơn mới | YCAU_NGHIEPVU_67 |
| QUYTAC_NGHIEPVU_307 | Loại nghỉ thuộc công ty; hệ thống tạo sẵn loại theo luật, không xóa được, chỉ đổi tên hiển thị: phép năm (có lương, trừ sổ phép); kết hôn 3 ngày, con kết hôn 1 ngày, tang cha mẹ, vợ chồng, con 3 ngày (có lương, mỗi lần nghỉ không quá số ngày); việc riêng không lương 1 ngày (ông bà, anh chị em ruột chết; cha mẹ, anh chị em ruột kết hôn); không lương theo thỏa thuận; ốm đau, thai sản, tai nạn lao động hoặc bệnh nghề nghiệp (bảo hiểm xã hội chi trả, công ty không trả lương, cần tệp chứng từ khi nhân sự ghi nhận). Công ty thêm loại riêng: tên, có lương hoặc không, số ngày tối đa mỗi năm (không bắt buộc), cần tệp đính kèm hay không. Ngày nghỉ của loại có lương được tính vào ngày công hưởng lương | YCAU_NGHIEPVU_69 |
| QUYTAC_NGHIEPVU_308 | Phép năm: số ngày cơ bản theo chế độ phép của hồ sơ (bình thường 12; chưa thành niên tự 14 theo ngày sinh; người khuyết tật hoặc nặng nhọc, độc hại, nguy hiểm 14; đặc biệt nặng nhọc, độc hại, nguy hiểm 16; nhân sự chọn) + thâm niên 1 ngày mỗi đủ 5 năm tính từ ngày tính thâm niên (mặc định ngày vào làm, nhân sự sửa được). Cộng dần: việc nền lúc 0 giờ 15 phút mỗi ngày cộng (số ngày cơ bản + thâm niên) / 12, làm tròn 2 chữ số, cho mỗi hồ sơ đang làm tại ngày đó chưa được cộng tháng đó (mỗi tháng một lần; người vào làm giữa tháng được cộng ngày hôm sau). Khi chốt bảng công tháng, tháng có ngày công hưởng lương dưới 50% công chuẩn của tháng (Nghị định 145 Điều 66 khoản 2) thì trừ lại phần đã cộng của tháng đó (thời gian nghỉ được coi là thời gian làm việc theo Điều 65 tính như ngày có lương). Sổ phép theo năm phát sinh: số dư = cộng dần + điều chỉnh − đã nghỉ − hết hạn − thanh toán. Nghỉ phép năm trừ vào năm cũ nhất còn dư. Phép tồn: cài đặt công ty "không hết hạn" hoặc "hết hạn sau N tháng của năm sau" (N từ 1 đến 36, mặc định 3 tức hết 31/3); việc nền ghi hết hạn phần còn dư khi qua hạn. Cài đặt "cho nghỉ trước": không (mặc định, chỉ nghỉ trong số dư) hoặc có (âm tối đa số ngày còn được cộng đến hết năm). Nhân sự điều chỉnh sổ phép (số ngày âm hoặc dương, năm, lý do bắt buộc), dùng nhập số dư ban đầu. Nghỉ việc: phần dư chưa hết hạn ghi "thanh toán" ngày nghỉ việc, đưa vào bảng công tháng đó (Điều 113 khoản 3); dư âm thì ghi số âm để nhân sự xử lý | YCAU_NGHIEPVU_69 |
| QUYTAC_NGHIEPVU_309 | Đơn nghỉ: hồ sơ đang làm, loại nghỉ đang dùng, từ ngày (cả ngày, buổi sáng hoặc buổi chiều) đến ngày (cả ngày hoặc buổi sáng), lý do, tệp đính kèm. Số ngày nghỉ = tổng hệ số ca của các ngày có ca dự kiến trong khoảng (bỏ ngày nghỉ hằng tuần, ngày lễ), nửa ngày tính một nửa; bằng 0 thì chặn. Chặn khi: trùng thời gian với đơn khác chưa hủy, chưa từ chối; vượt số dư phép năm (theo cài đặt nghỉ trước); vượt số ngày của loại theo luật hoặc tối đa năm của loại; thuộc kỳ đã chốt; ngày ngoài khoảng làm việc của hồ sơ. Người lao động có tài khoản liên kết tự lập đơn (cả ngày đã qua của kỳ chưa chốt): đi luồng duyệt chung (loại chứng từ `hr.leave_request`, giá trị duyệt là số ngày nghỉ; ngưỡng của cấp duyệt nhập theo số ngày; công ty chưa có chính sách thì gửi xong là duyệt); phép năm giữ chỗ trong số dư khi chờ duyệt. Nhân sự có `hr.leave.manage` ghi nhận nghỉ thay người lao động thì có hiệu lực ngay (không qua duyệt, ghi nhật ký). Trạng thái: chờ duyệt → đã duyệt; bị từ chối; đã rút; đã hủy. Người lao động hủy đơn đã duyệt khi chưa đến ngày bắt đầu; nhân sự hủy được khi kỳ chưa chốt (nhập lý do). Duyệt, hủy thì tính lại công các ngày liên quan, cập nhật sổ phép | YCAU_NGHIEPVU_69 |
| QUYTAC_NGHIEPVU_310 | Phiếu tăng ca: một hồ sơ, ngày, giờ bắt đầu, giờ kết thúc (qua 0 giờ được, tối đa 12 giờ), công việc, địa điểm (Nghị định 145 Điều 59). Người lao động tự lập (là đồng ý) hoặc trưởng phòng của phòng ban hiện hành, nhân sự lập thay rồi người lao động bấm "Đồng ý" trên ứng dụng (không đồng ý thì phiếu bị hủy); người không có tài khoản: nhân sự ghi nhận kèm tệp văn bản đồng ý (bắt buộc), có hiệu lực ngay. Sau khi đồng ý gửi luồng duyệt chung (loại chứng từ `hr.overtime_request`, giá trị duyệt là số giờ, người gửi là người lao động). Loại ngày: ngày lễ (QUYTAC_NGHIEPVU_303) → ngày nghỉ hằng tuần (không có ca dự kiến) → ngày thường. Ngày thường: khoảng tăng ca không chồng lên giờ ca dự kiến; số giờ không quá 50% giờ chuẩn của ca ngày đó (theo tuần: giờ chuẩn + tăng ca không quá 12). Ngày nghỉ, ngày lễ: không quá 12 giờ. Tổng tăng ca trong tháng không quá 40 giờ; trong năm không quá 200 giờ, hoặc 300 giờ khi công ty bật "Được làm thêm đến 300 giờ" (chọn trường hợp theo Điều 107 khoản 3, Nghị định 145 Điều 61); tính cả phiếu chờ duyệt, đã duyệt. Vượt 200 giờ lần đầu trong năm thì nhắc nhân sự thông báo Sở trong 15 ngày. Chặn với hồ sơ chưa thành niên. Biểu mẫu nhắc không bố trí lao động nữ mang thai từ tháng thứ 7 và nuôi con dưới 12 tháng (trừ khi đồng ý). Giờ tăng ca được tính = phần giao giữa khoảng đã duyệt và khoảng có mặt (lượt chấm), tách giờ đêm (22–6 giờ) và giờ đêm sau khi có tăng ca ban ngày cùng ngày; phiếu do nhân sự ghi nhận cho người không chấm công được tính đủ khoảng. Trạng thái: chờ đồng ý → chờ duyệt → đã duyệt; bị từ chối; đã rút; đã hủy (trước giờ bắt đầu hoặc nhân sự khi kỳ chưa chốt) | YCAU_NGHIEPVU_70 |
| QUYTAC_NGHIEPVU_311 | Bảng công tháng: mỗi công ty mỗi tháng một kỳ, gồm mọi hồ sơ có khoảng làm việc giao với tháng. Dòng tổng hợp từ công ngày: công chuẩn cả tháng, công chuẩn trong khoảng làm việc, giờ chuẩn, công và giờ làm thực tế, công ngày lễ, nghỉ theo nhóm (phép năm, việc riêng có lương, có lương khác, không lương, bảo hiểm xã hội), vắng không phép, ngày công hưởng lương, giờ đêm, giờ tăng ca theo 7 nhóm (ngày thường, đêm ngày thường, đêm ngày thường sau tăng ca ngày, nghỉ hằng tuần, đêm nghỉ hằng tuần, lễ, đêm lễ), số lần và số phút đi muộn, về sớm, ngày phép thanh toán khi nghỉ việc, số dư phép cuối kỳ. Trạng thái kỳ: đang mở → đang xác nhận → đã chốt. "Mở xác nhận" (sau khi tháng kết thúc, nhập hạn xác nhận ít nhất 1 ngày sau hôm nay): thông báo người lao động; người lao động xem dòng và chi tiết ngày của mình, bấm "Xác nhận" hoặc "Giải trình" (nội dung bắt buộc); nhân sự trả lời giải trình, sửa dữ liệu nếu cần. Dữ liệu dòng đổi sau khi đã xác nhận thì dòng về chờ xác nhận và thông báo lại. Hết hạn chưa xác nhận thì tự "Xác nhận do hết hạn" (việc nền lúc 0 giờ 30 phút). Chốt khi không còn giải trình chưa trả lời: đóng băng dòng, chặn mọi thay đổi dữ liệu thuộc tháng (lượt chấm, lịch, đơn, phiếu), trừ phép tháng không đủ điều kiện (QUYTAC_NGHIEPVU_308), ghi sự kiện `hr.timesheet.closed`. Mở lại kỳ đã chốt (nhập lý do, về đang mở) chỉ khi bảng lương của kỳ chưa chốt (`payroll_locked_at` trống, do CONG_VIEC_48 ghi); ghi sự kiện `hr.timesheet.reopened`, hoàn lại phần trừ phép đã ghi khi chốt. Xuất Excel bảng công tổng hợp và chi tiết ngày | YCAU_NGHIEPVU_71 |

## 6. Vai trò và quyền

| Quyền | Ý nghĩa | Nhạy cảm |
|---|---|---|
| `hr.attendance.view` | Xem chấm công, công ngày, đơn nghỉ, phiếu tăng ca, bảng công của công ty | Không |
| `hr.attendance.manage` | Ca, lịch tuần, xếp ca, ngày nghỉ riêng của công ty, cài đặt và địa điểm chấm công, mã chấm công, nhập tệp, ghi thủ công, mở màn hình mã QR, ghi nhận tăng ca thay, hủy phiếu tăng ca; ở phạm vi tập đoàn: khai báo ngày lễ chung | Có |
| `hr.leave.manage` | Loại nghỉ, chế độ phép của hồ sơ, điều chỉnh sổ phép, ghi nhận nghỉ thay, hủy đơn nghỉ đã duyệt | Có |
| `hr.timesheet.manage` | Mở xác nhận, trả lời giải trình, chốt, mở lại, xuất bảng công | Có |

- Quyền gán ở phạm vi tập đoàn hoặc công ty như CONG_VIEC_46. Vai trò `hr_manager`, `hr_staff` có thêm bốn quyền trên. Quản trị công ty, Quản trị tập đoàn có mọi quyền mới.
- Trưởng phòng (người quản lý phòng ban trong cơ cấu) không cần quyền thêm: xem công ngày, đơn, phiếu, xếp ca, lập phiếu tăng ca cho hồ sơ có phòng ban hiện hành là phòng mình hoặc phòng con; duyệt theo chính sách duyệt (loại người duyệt "trưởng phòng" đã có).
- Người có tài khoản liên kết hồ sơ dùng trang "Chấm công của tôi" (như "Hồ sơ của tôi" của CONG_VIEC_46): chấm công, xem lịch ca, công ngày, sổ phép, lập đơn nghỉ, đơn giải trình, phiếu tăng ca, đồng ý tăng ca, xác nhận bảng công của mình.
- Loại chứng từ mới (cần duyệt): `hr.leave_request` (Đơn nghỉ), `hr.overtime_request` (Phiếu tăng ca), `hr.attendance_correction` (Đơn giải trình công). Số chứng từ theo dãy số chung (`NP-`, `TC-`, `GT-` + mã công ty + năm + 6 chữ số, sửa được ở Dãy số chứng từ).

## 7. Luồng nghiệp vụ

- Luồng 1 – Thiết lập: Quản trị tập đoàn khai báo ngày lễ năm → nhân sự công ty khai báo ca, lịch tuần mặc định, lịch phòng ban; cài đặt chấm công (ân hạn, phép tồn, giới hạn 300 giờ); địa điểm chấm công (GPS, IP, QR); gán mã chấm công cho hồ sơ; chế độ phép, nhập số dư phép ban đầu.
- Luồng 2 – Chấm công hằng ngày: người lao động bấm Vào ca, Ra ca trên điện thoại (hoặc quét mã QR) hoặc chấm máy; cuối tuần nhân sự nhập tệp máy chấm công → hệ thống tính công ngày. Quên chấm: người lao động lập đơn giải trình → trưởng phòng duyệt → công cập nhật.
- Luồng 3 – Xếp ca: trưởng phòng hoặc nhân sự xếp ca tuần tới cho từng người (hoặc nhập Excel) → người lao động xem lịch ca của mình.
- Luồng 4 – Nghỉ phép: người lao động xem số dư, lập đơn nghỉ → duyệt → công các ngày nghỉ ghi theo loại; nhân sự ghi nhận nghỉ ốm có giấy tờ.
- Luồng 5 – Tăng ca: trưởng phòng lập phiếu cho nhân viên → nhân viên đồng ý → duyệt → hôm đó chấm công → giờ tăng ca tính theo thời gian có mặt.
- Luồng 6 – Bảng công: đầu tháng sau nhân sự rà soát, mở xác nhận → người lao động xác nhận hoặc giải trình → nhân sự trả lời, sửa → hết hạn → chốt → CONG_VIEC_48 tính lương. Sai sau khi chốt: mở lại (khi lương chưa chốt) → sửa → chốt lại.

## 8. Màn hình (giai đoạn 06.1)

| Mã | Màn hình | Nội dung | Vai trò |
|---|---|---|---|
| MAN_HINH_120 | Ca làm và lịch làm việc | Thẻ: Ca làm (bảng, biểu mẫu ca), Lịch tuần (lịch, gán phòng ban, nhân viên), Xếp ca (lưới nhân viên × 7 ngày, chọn ca từng ô, chép tuần trước, nhập Excel, cảnh báo 48 giờ, 12 giờ nghỉ), Ngày lễ (năm; chung tập đoàn chỉ xem nếu không có quyền tập đoàn, ngày riêng công ty), Cài đặt (thời giờ theo ngày hoặc tuần, ân hạn, chấm ở mọi địa điểm, phép tồn, nghỉ trước, giới hạn 300 giờ, số đơn giải trình), Địa điểm chấm công (bản đồ tọa độ nhập tay, bán kính, IP, QR; nút "Mở màn hình mã QR" hiện mã toàn màn hình đổi mỗi 30 giây) | `hr.attendance.manage`; trưởng phòng chỉ thẻ Xếp ca của phòng mình |
| MAN_HINH_121 | Chấm công | Bộ lọc tháng, phòng ban, chi nhánh, tình trạng (thiếu lượt, vắng, đi muộn); lưới nhân viên × ngày (ký hiệu công, màu theo tình trạng); mở ô xem chi tiết ngày (ca, lượt chấm và nguồn, giờ làm, muộn, sớm, nghỉ, tăng ca), ghi thủ công, xóa lượt thủ công; nút "Nhập tệp máy chấm công" (tải mẫu, chọn tệp, xem trước lỗi, xác nhận), lịch sử nhập; thẻ "Đơn giải trình" | `hr.attendance.view`; trưởng phòng xem phòng mình |
| MAN_HINH_122 | Chấm công của tôi | Thiết kế cho điện thoại: nút lớn Vào ca hoặc Ra ca (kèm trạng thái vị trí, mạng), ca hôm nay, lượt hôm nay; thẻ Lịch ca (tuần), Công tháng (từng ngày, tổng; xác nhận hoặc giải trình khi kỳ đang xác nhận), Đơn của tôi (đơn nghỉ, giải trình, phiếu tăng ca, phiếu chờ đồng ý); nút lập đơn nghỉ, giải trình, tăng ca; số dư phép. Trang mở từ mã QR: chọn Vào ca hoặc Ra ca | Người có hồ sơ liên kết |
| MAN_HINH_123 | Nghỉ phép | Thẻ: Đơn nghỉ (bảng, lọc trạng thái, loại, phòng ban; ghi nhận nghỉ thay; chi tiết, tiến trình duyệt, hủy), Sổ phép (bảng nhân viên: chế độ, được cộng, đã nghỉ, hết hạn, còn lại theo năm; chi tiết giao dịch; điều chỉnh; sửa chế độ phép), Loại nghỉ (danh sách, thêm, sửa) | `hr.attendance.view`, `hr.leave.manage` |
| MAN_HINH_124 | Tăng ca | Bảng phiếu (lọc tháng, trạng thái, phòng ban), biểu mẫu phiếu (kiểm giới hạn ngay khi nhập: giờ ngày, tháng còn lại, năm còn lại), chi tiết (đồng ý, tiến trình duyệt, giờ được tính), tổng giờ tăng ca theo nhân viên trong tháng và năm, cảnh báo gần giới hạn | `hr.attendance.view`; trưởng phòng phòng mình |
| MAN_HINH_125 | Bảng công tháng | Chọn tháng; trạng thái kỳ, hạn xác nhận; bảng dòng tổng hợp (cột nhóm thu gọn được), lọc phòng ban, tình trạng xác nhận; mở dòng xem chi tiết ngày, giải trình và trả lời; nút Mở xác nhận, Chốt, Mở lại, Xuất Excel | `hr.attendance.view`, `hr.timesheet.manage` |

Điều hướng: menu Nhân sự thêm Chấm công (121 → chi tiết ngày), Ca và lịch (120), Nghỉ phép (123), Tăng ca (124), Bảng công (125), Chấm công của tôi (122, với mọi người có hồ sơ liên kết). Thông báo đơn, phiếu mở 122 hoặc 123, 124; thông báo mở xác nhận mở 122 thẻ Công tháng.

## 9. Dữ liệu và API (phác thảo, chi tiết ở giai đoạn 07)

- Database migration `0073_hr_attendance.sql`: `hr.attendance_settings` (theo công ty), `hr.shifts`, `hr.work_schedules` + `hr.work_schedule_days`, `hr.work_schedule_assignments` (phòng ban hoặc hồ sơ, từ ngày), `hr.shift_assignments` (hồ sơ, ngày, ca hoặc nghỉ), `hr.holidays` (công ty trống = chung tập đoàn), `hr.attendance_locations`, cột `attendance_code` trên `hr.employees`, `hr.attendance_imports`, `hr.attendance_punches` (nguồn, cách xác thực, tọa độ, IP), `hr.attendance_days` (kết quả từng ngày), `hr.attendance_corrections`, `hr.timesheet_periods` (cột `payroll_locked_at` dành cho CONG_VIEC_48; tạo sớm để mọi ghi dữ liệu kiểm được kỳ đã chốt); quyền, loại chứng từ, dãy số.
- Database migration `0074_hr_leave.sql`: `hr.leave_types`, `hr.employee_leave_policies` (chế độ phép, ngày tính thâm niên), `hr.leave_ledger` (năm phát sinh, loại giao dịch, số ngày, nguồn; duy nhất cộng dần theo hồ sơ và tháng), `hr.leave_requests` + `hr.leave_request_days`.
- Database migration `0075_hr_overtime_timesheets.sql`: `hr.overtime_requests`, `hr.timesheet_lines`.
- API_150 `/hr/attendance/setup` (cài đặt, ca, lịch tuần, gán lịch, xếp ca, nhập xếp ca, ngày lễ, địa điểm, mã QR); API_151 `/hr/attendance` (lưới công, chi tiết ngày, lượt thủ công, nhập tệp xem trước và xác nhận, mã chấm công); API_152 `/hr/attendance/corrections`; API_153 `/hr/leave` (loại, chế độ, sổ phép, điều chỉnh, đơn nghỉ); API_154 `/hr/overtime`; API_155 `/hr/timesheets` (kỳ, dòng, xác nhận, giải trình, chốt, mở lại, xuất) và `/hr/me/attendance` (chấm công, lịch, công, đơn của tôi).
- Dịch vụ dùng lại: luồng duyệt (`submitWithin`, `withdraw`, nghe `core.approval.completed`; xử lý chưa có chính sách như hợp đồng của CONG_VIEC_46), dãy số chứng từ, lưu tệp, thông báo, nhật ký thao tác, `read-excel-file`, `write-excel-file`, `qrcode-generator` (đã có trong dự án), HMAC của `node:crypto`.
- Việc nền mới (BullMQ, múi giờ `Asia/Ho_Chi_Minh`): `hr-attendance-recalculate` (1 giờ), `hr-leave-accrual` (0 giờ 15 phút, gồm hết hạn phép tồn), `hr-timesheet-confirmation` (0 giờ 30 phút).

## 10. Điều kiện đặc biệt

- Tính lại công ngày, cập nhật sổ phép, cập nhật trạng thái đơn trong cùng giao dịch; việc nền chạy lại không cộng phép hai lần (khóa duy nhất theo hồ sơ, tháng).
- Gửi đơn nghỉ, phiếu tăng ca khóa hồ sơ (`FOR UPDATE`) để kiểm số dư, giới hạn giờ không bị hai yêu cầu đồng thời vượt qua.
- Chốt kỳ khóa dòng kỳ (`FOR UPDATE`); mọi ghi dữ liệu thuộc tháng kiểm trạng thái kỳ trong cùng giao dịch.
- Khóa ký mã QR dùng khóa sẵn có `MFA_SECRET_KEY` (như mã hóa của CONG_VIEC_46), mã chỉ chứa mã địa điểm và khung thời gian.
- Tọa độ GPS là dữ liệu cá nhân: chỉ lưu tại lượt chấm, chỉ người có `hr.attendance.manage` và chính người lao động xem; hiện thông báo trước khi trình duyệt xin quyền vị trí.

## 11. Tiêu chí nghiệm thu

| Mã | Tiêu chí | Mức |
|---|---|---|
| TIEUCHI_NGHIEMTHU_295 | Ca, lịch tuần, xếp ca, ngày lễ: giới hạn 8/10 giờ ca, 48 giờ tuần (40 giờ chưa thành niên), thứ tự lấy ca dự kiến đúng; ngày lễ chung và riêng, ngày lễ người nước ngoài đúng đối tượng; không sửa ngày thuộc kỳ đã chốt | Bắt buộc |
| TIEUCHI_NGHIEMTHU_296 | Lượt chấm thủ công, nhập tệp (xem trước lỗi, bỏ trùng, kỳ đã chốt bị chặn); công ngày tính đúng giờ thực tế, ân hạn, muộn, sớm, thiếu lượt, vắng, giờ đêm, ca qua ngày; đơn giải trình qua luồng duyệt cập nhật công | Bắt buộc |
| TIEUCHI_NGHIEMTHU_297 | Chấm công ứng dụng: nhận khi đạt GPS hoặc IP hoặc mã QR còn hạn của địa điểm được phép, từ chối khi không đạt, mã QR quá hạn, giả mã; chỉ chấm cho chính mình; công ty khác nhận `404` | Bắt buộc |
| TIEUCHI_NGHIEMTHU_298 | Phép năm: số ngày theo chế độ, thâm niên, cộng dần mỗi tháng một lần, trừ tháng dưới 50%, phép tồn hết hạn đúng cài đặt, nghỉ trừ năm cũ trước, thanh toán khi nghỉ việc | Bắt buộc |
| TIEUCHI_NGHIEMTHU_299 | Đơn nghỉ: số ngày theo lịch (nửa ngày, ca nửa công, bỏ ngày lễ, nghỉ tuần), chặn trùng, vượt số dư, vượt số ngày theo luật; qua luồng duyệt; nhân sự ghi nhận có hiệu lực ngay; hủy hoàn số dư và tính lại công | Bắt buộc |
| TIEUCHI_NGHIEMTHU_300 | Tăng ca: cần đồng ý, qua luồng duyệt; chặn vượt 50% giờ ngày, 12 giờ ngày nghỉ, 40 giờ tháng, 200 hoặc 300 giờ năm, chưa thành niên; loại ngày và giờ đêm đúng; giờ được tính theo thời gian có mặt | Bắt buộc |
| TIEUCHI_NGHIEMTHU_301 | Bảng công tháng: dòng tổng hợp khớp công ngày; xác nhận, giải trình, tự xác nhận khi hết hạn; chốt đóng băng và chặn sửa dữ liệu tháng; mở lại bị chặn khi lương đã chốt; người lao động chỉ thấy dòng của mình; quyền, cách ly công ty đúng | Bắt buộc |
| TIEUCHI_NGHIEMTHU_302 | MAN_HINH_120 đến MAN_HINH_125 đạt danh sách rà soát giao diện trên máy tính và điện thoại (MAN_HINH_122 ưu tiên điện thoại) | Bắt buộc |

## 12. Kịch bản kiểm thử

KICHBAN_KIEMTHU_444 đến KICHBAN_KIEMTHU_451 tự động (`apps/api/test/c47-*.test.ts`): 444 ca, lịch, xếp ca, ngày lễ; 445 lượt chấm thủ công, nhập tệp; 446 tính công ngày; 447 chấm công ứng dụng, mã QR, giải trình; 448 sổ phép năm; 449 đơn nghỉ; 450 tăng ca và giới hạn; 451 bảng công tháng, quyền, cách ly. KICHBAN_KIEMTHU_452 (trình duyệt máy tính), KICHBAN_KIEMTHU_453 (điện thoại) thủ công.

## 13. Ràng buộc kỹ thuật

- Không thêm thư viện (dùng `read-excel-file`, `write-excel-file`, `qrcode-generator` đã có; đọc CSV tự viết; định vị bằng API trình duyệt; bản đồ không dùng, nhập tọa độ tay hoặc lấy vị trí hiện tại của máy).
- Mã trong `apps/api/src/hr` (tệp mới cho chấm công, nghỉ phép, tăng ca, bảng công); chỉ ghi schema `hr`; `apps/web-hr` thêm trang.
- Chuỗi giao diện trong `packages/i18n`; lược đồ zod trong `packages/contracts`; giá trị giao diện từ tài liệu `15` (màu tình trạng công dùng màu trạng thái có sẵn; cần giá trị mới sẽ đề xuất trước).

## 14. Thành phần không được thay đổi

Luồng duyệt chung, dãy số chứng từ, đăng nhập, phân quyền hiện có; dữ liệu, API, quy tắc của CONG_VIEC_46 (chỉ thêm cột `attendance_code` vào `hr.employees` và mục trong menu).

## 15. Các lát và điểm xem trước

- L0: database migration 0073 (phần thiết lập và lượt chấm); quyền; ca, lịch tuần, xếp ca, ngày lễ, cài đặt; ghi thủ công, nhập tệp, tính công ngày; MAN_HINH_120 (trừ địa điểm), MAN_HINH_121. Điểm xem trước: khai báo ca, lịch; nhập tệp mẫu; lưới công tháng đúng.
- L1: địa điểm chấm công, chấm công ứng dụng (GPS, IP, mã QR động), đơn giải trình; MAN_HINH_122 (phần chấm công, lịch, công). Điểm xem trước: chấm trên điện thoại, quét mã QR, giải trình được duyệt cập nhật công.
- L2: database migration 0074; loại nghỉ, sổ phép, đơn nghỉ; MAN_HINH_123, phần nghỉ của MAN_HINH_122. Điểm xem trước: cộng phép, lập và duyệt đơn nghỉ, công ghi nghỉ.
- L3: database migration 0075; tăng ca, bảng công tháng; MAN_HINH_124, MAN_HINH_125, phần còn lại của MAN_HINH_122. Điểm xem trước: phiếu tăng ca chặn giới hạn; xác nhận, chốt bảng công.

## 16. Quyết định AI tự đưa ra (trong phạm vi quyết định của người dùng, chờ duyệt cùng đặc tả)

- Nhân sự ghi nhận nghỉ, tăng ca thay người lao động (có giấy tờ) thì có hiệu lực ngay, không qua duyệt; người lao động tự lập thì qua luồng duyệt.
- Giá trị duyệt của đơn nghỉ là số ngày, phiếu tăng ca là số giờ, đơn giải trình là 1; ngưỡng các cấp của chính sách duyệt hiểu theo đơn vị đó (đơn vị tiền tệ của chính sách bỏ qua).
- Phép năm cộng đầu tháng (không chờ hết tháng), trừ lại khi chốt nếu tháng không đủ 50%; mặc định không cho nghỉ trước.
- Lao động nữ mang thai, nuôi con nhỏ: hồ sơ chưa có dữ liệu này nên chỉ nhắc trên biểu mẫu tăng ca, không chặn.
- Mã QR đổi mỗi 30 giây, nhận khung liền trước; màn hình mã QR do người có quyền mở trên thiết bị đặt tại địa điểm.
- Không ràng buộc thiết bị cá nhân, không ảnh chụp khi chấm; rủi ro giả vị trí ghi tài liệu `22`.
- Ca dự kiến tối đa một ca mỗi ngày mỗi người.

## 17. Quyết định của người dùng (2026-11-11)

- Làm chấm công trên ứng dụng, giới hạn theo vị trí GPS, mạng wifi công ty hoặc mã QR động, cấu hình linh hoạt.
- Phép năm cộng dần theo tháng; phép tồn hết hạn cấu hình được (tối đa 3 năm) hoặc không hết hạn.
- Tăng ca đăng ký trước qua luồng duyệt.
- Công theo giờ làm thực tế; ghi số phút đi muộn, về sớm; ngưỡng ân hạn trong cài đặt.
- Bảng công: người lao động xác nhận, nhân sự chốt; mở lại khi lương kỳ đó chưa chốt.
- Quên chấm công, công tác: đơn giải trình qua luồng duyệt.
- Ngày lễ tập đoàn khai báo chung, công ty thêm riêng.
- Lịch tuần mặc định + xếp ca theo ngày.

## 18. Kết quả đối chiếu định nghĩa hoàn thành

| Mục | Kết quả |
|---|---|
| Đúng yêu cầu, nghiệp vụ, phân quyền, dữ liệu | Đạt: QUYTAC_NGHIEPVU_302 đến 311 có kiểm thử tự động; chỗ chỉnh cho khớp mã ghi ở mục 19 |
| Đúng giao diện | Đạt: MAN_HINH_120 đến 125 khớp bản mẫu đã duyệt; người dùng duyệt điểm xem trước từng lát; khổ 1366 và 390 điểm ảnh không lỗi trình duyệt, không cuộn ngang (KICHBAN_KIEMTHU_452, 453) |
| Đã xử lý lỗi | Đạt: lỗi theo ô, lỗi nghiệp vụ có câu dịch vi, en; vi phạm giới hạn tăng ca hiện ngay khi nhập |
| Đã kiểm thử, có kết quả trong tài liệu `25` | Kiểm thử tự động c47-calculator, c47-attendance, c47-app-attendance, c47-leave, c47-overtime-timesheet đạt; kết quả toàn bộ kiểm thử API gửi phiên cha ghi tài liệu `25` (sổ dùng chung) |
| Không phá vỡ chức năng cũ | Toàn bộ kiểm thử API (ghi ở báo cáo nghiệm thu); dữ liệu, API của CONG_VIEC_46 chỉ thêm cột `attendance_code` và mục menu |
| Đạt tiêu chí nghiệm thu bắt buộc | TIEUCHI_NGHIEMTHU_295 đến 302 có kịch bản và kết quả đạt |
| Đạt cổng bảo mật | Rà soát quyền, phạm vi công ty, mã QR, dữ liệu vị trí (tài liệu `22`); rủi ro giả vị trí GPS chờ người dùng chấp nhận (tài liệu `22` mục 8) |
| Đã tự rà soát mã, dọn dẹp | Đạt: truy vấn tham số hóa, khóa đồng thời khi gửi đơn, phiếu, chốt kỳ; không thêm thư viện mới; `qrcode-generator` 2.0.4 dùng lại bản mini app Nền tảng đang dùng cho mã MFA |
| Đã cập nhật tài liệu `27` và tài liệu liên quan | Đạt: tài liệu 06, 07, 08, 10, 11, 12, 14, 15, 16, 17, 21, 22, 27, `index.md` |

## 19. Chỗ chỉnh cho khớp mã (lát L0 đến L3)

| Vị trí | Đặc tả 0.1 | Mã đã làm |
|---|---|---|
| Mục 9, database migration 0073 | `hr.work_schedules` + `hr.work_schedule_days` | `hr.work_schedules` có 7 cột ca (`monday_shift_id` … `sunday_shift_id`), không có bảng ngày |
| Mục 9 | `hr.timesheet_periods` ở 0075 | Tạo ở 0073 để mọi ghi dữ liệu kiểm kỳ đã chốt từ lát L0 |
| Mục 8, MAN_HINH_120 | Đường dẫn chưa ghi | `/hr/work-schedules`; màn hình mã QR `/hr/work-schedules/qr/[id]`; trưởng phòng không có quyền nhân sự mở 120, 121, 124 qua nút trên 122 |
| QUYTAC_NGHIEPVU_304 | Lỗi nhập tệp theo dòng | Số dòng là số dòng của tệp (tính cả dòng tiêu đề) |
| QUYTAC_NGHIEPVU_304 | Liên kết mã QR tới trang chấm công | `/hr/my-attendance?l=<địa điểm>&t=<mã>&c=<công ty>`; trang tự chọn công ty của mã |
| Mục 10 | Tọa độ GPS: người có `hr.attendance.manage` và chính người lao động xem | API không trả tọa độ, IP cho ai; chỉ trả cách xác thực, địa điểm, khoảng cách tới địa điểm |
| QUYTAC_NGHIEPVU_308 | Điều kiện 50% công chuẩn | Ngày nghỉ bảo hiểm xã hội tính như ngày có lương (thời gian coi là làm việc theo Nghị định 145 Điều 65); nghỉ không lương không tính |
| QUYTAC_NGHIEPVU_309 | Nửa ngày | Hai đơn nửa ngày (sáng, chiều) cùng ngày được phép; loại bảo hiểm xã hội người lao động không tự lập (chỉ nhân sự ghi nhận kèm tệp) |
| QUYTAC_NGHIEPVU_311 | Công chuẩn, giờ chuẩn | Công chuẩn gồm ngày lễ có ca theo lịch; giờ chuẩn không gồm ngày lễ |
| QUYTAC_NGHIEPVU_311 | Trạng thái đang mở → đang xác nhận → đã chốt | Nhân sự chốt được cả khi chưa mở xác nhận (sau khi tháng kết thúc, không còn giải trình) |
| QUYTAC_NGHIEPVU_311 | Mở lại hoàn phần trừ phép | Giao dịch trừ tháng và thanh toán phép do lần chốt sinh ra bị xóa khi mở lại (ghi nhật ký `timesheet.reopen`), chốt lại thì tính lại |
| QUYTAC_NGHIEPVU_310 | Hủy phiếu tăng ca | Hủy sau giờ bắt đầu chỉ nhân sự; dùng lại câu lỗi của đơn nghỉ (`leaveNotCancellable`) |
| Mục 6 | Menu Tăng ca, Bảng công | Hiện với `hr.attendance.view`; thao tác bảng công cần `hr.timesheet.manage` |

