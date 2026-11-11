# CONG_VIEC_46: Hồ sơ nhân sự, hợp đồng lao động (MODULE_08, phần 1)

- Mô tả: Mini app Nhân sự `apps/web-hr`: hồ sơ nhân sự theo công ty (thông tin cá nhân, giấy tờ, người phụ thuộc, quá trình công tác) gắn với tài khoản người dùng và cơ cấu công ty, chi nhánh, phòng ban đã có; hợp đồng lao động, phụ lục qua luồng duyệt; nhắc hết hạn hợp đồng; nhân viên tự xem hồ sơ của mình.
- Phiên bản: 0.1
- Ngày cập nhật: 2026-11-11
- Trạng thái: Người dùng duyệt đặc tả và bản mẫu ngày 2026-11-11. Đang thực hiện lát L0.
- Mức: Lớn (module mới, mini app mới, dữ liệu cá nhân nhạy cảm, đổi dữ liệu thành viên công ty ở `core`).
- Nguồn: tài liệu `01` mục 4 (MODULE_08), tài liệu `05` mục 2.1 (Nhân sự: hồ sơ nhân viên, hợp đồng); quyết định của người dùng ngày 2026-11-11 (mục 17).

## 1. Mục tiêu

Phòng nhân sự mỗi công ty con quản lý hồ sơ người lao động và hợp đồng lao động trên một hệ thống, đúng Bộ luật Lao động và Luật Bảo vệ dữ liệu cá nhân; không bỏ sót hợp đồng hết hạn; cơ cấu phòng ban, chức danh trong hệ thống khớp với quyết định nhân sự.

## 2. Phạm vi

Trong phạm vi: CHUC_NANG_162 đến CHUC_NANG_164; mini app Nhân sự `apps/web-hr`, đường dẫn `/hr` (đã có trong `core.apps`, quyền `hr.access` đã có).

Ngoài phạm vi (công việc sau):
- Chấm công, nghỉ phép; tính lương, bảo hiểm xã hội, thuế thu nhập cá nhân; tuyển dụng; đánh giá hiệu suất (tài liệu `05`).
- Thời hạn lưu giữ hồ sơ sau nghỉ việc, xóa, khử nhận dạng dữ liệu (chờ người dùng chốt với luật sư, mục 17).
- Ký số hợp đồng; in hợp đồng theo mẫu (PDF); nhập hồ sơ từ Excel; báo cáo tình hình thay đổi lao động gửi cơ quan nhà nước (Nghị định 145/2020/NĐ-CP Điều 4).
- Cổng tự phục vụ: nhân viên tự sửa hồ sơ (phần 1 chỉ cho xem, yêu cầu sửa qua đề xuất đã có).
- Tự khóa, vô hiệu hóa tài khoản khi nghỉ việc (hệ thống chỉ nhắc, quản trị làm ở MAN_HINH_13).
- Thông tin chi tiết tình trạng sức khỏe (chỉ lưu tệp giấy khám sức khỏe).

## 3. Căn cứ pháp lý đã tra (2026-11-11)

| Văn bản | Điều | Nội dung dùng trong đặc tả |
|---|---|---|
| Bộ luật Lao động 45/2019/QH14 (hết hiệu lực một phần; các điều dưới đây còn áp dụng, cần đối chiếu bản hợp nhất mới nhất trước khi phát hành) | Điều 12 | Người sử dụng lao động lập, cập nhật sổ quản lý lao động bằng bản giấy hoặc bản điện tử |
| | Điều 14 | Hợp đồng bằng văn bản hoặc thông điệp dữ liệu điện tử |
| | Điều 17 khoản 1 | Không được giữ bản chính giấy tờ tùy thân, văn bằng, chứng chỉ của người lao động |
| | Điều 18 khoản 4 | Người từ đủ 15 đến chưa đủ 18 tuổi giao kết khi có đồng ý bằng văn bản của người đại diện theo pháp luật |
| | Điều 20 | Hai loại: không xác định thời hạn; xác định thời hạn không quá 36 tháng. Hết hạn vẫn làm việc: trong 30 ngày phải ký hợp đồng mới, quá 30 ngày thì thành không xác định thời hạn; xác định thời hạn chỉ được ký thêm 01 lần (trừ khoản 1 Điều 149, khoản 2 Điều 151, khoản 4 Điều 177) |
| | Điều 21 | Nội dung chủ yếu của hợp đồng |
| | Điều 22 | Phụ lục không được sửa đổi thời hạn của hợp đồng; phụ lục sửa đổi phải ghi rõ điều khoản và thời điểm có hiệu lực |
| | Điều 24, 25, 26, 27 | Thử việc: chỉ một lần cho một công việc; không quá 180 ngày (người quản lý doanh nghiệp), 60 ngày (cao đẳng trở lên), 30 ngày (trung cấp, công nhân kỹ thuật, nhân viên nghiệp vụ), 6 ngày làm việc (công việc khác); lương thử việc ít nhất 85%; hết thử việc phải thông báo kết quả; không thử việc với hợp đồng dưới 01 tháng |
| | Điều 34 | Các trường hợp chấm dứt hợp đồng |
| | Điều 143, 145 | Người chưa đủ 15 tuổi chỉ làm công việc nhẹ theo danh mục, có thủ tục riêng |
| | Điều 151 | Người lao động nước ngoài: hợp đồng không vượt thời hạn giấy phép lao động, được ký nhiều lần hợp đồng xác định thời hạn |
| Nghị định 145/2020/NĐ-CP | Điều 3 | Nội dung sổ quản lý lao động: họ tên, giới tính, ngày sinh, quốc tịch, nơi cư trú, số căn cước hoặc hộ chiếu, trình độ chuyên môn, vị trí việc làm, loại hợp đồng, thời điểm bắt đầu làm việc, tham gia bảo hiểm xã hội, tiền lương, nâng lương, … thời điểm chấm dứt hợp đồng và lý do |
| Luật Bảo vệ dữ liệu cá nhân 91/2025/QH15 (hiệu lực 2026-01-01) | Điều 3 | Thu thập đúng phạm vi, mục đích; lưu trong thời gian phù hợp mục đích |
| | Điều 4 khoản 1 | Chủ thể dữ liệu được biết, xem, yêu cầu chỉnh sửa dữ liệu của mình |
| | Điều 19 khoản 1 điểm d | Xử lý để thực hiện thỏa thuận (hợp đồng lao động) không cần đồng ý |
| | Điều 25 khoản 2 | Dữ liệu người lao động lưu theo thời hạn pháp luật hoặc thỏa thuận; phải xóa, hủy khi chấm dứt hợp đồng, trừ thỏa thuận hoặc luật khác quy định |
| Nghị định 356/2025/NĐ-CP | Điều 3 | Dữ liệu cơ bản: họ tên, ngày sinh, giới tính, nơi cư trú, quốc tịch, hình ảnh, số điện thoại, số định danh, hộ chiếu, tình trạng hôn nhân, quan hệ gia đình |
| | Điều 4 | Dữ liệu nhạy cảm gồm tình trạng sức khỏe; hình ảnh thẻ căn cước; thông tin tài chính tại tổ chức tín dụng. Khoản 2: phải phân quyền giới hạn truy cập, quy trình xử lý, biện pháp bảo mật |
| | Điều 5 khoản 3 | Yêu cầu xem, chỉnh sửa: phản hồi trong 02 ngày làm việc, thực hiện trong 10 ngày |
| | Điều 6 | Đồng ý phải kiểm chứng được, bên kiểm soát lưu bằng chứng; xin đồng ý xử lý dữ liệu nhạy cảm phải báo là dữ liệu nhạy cảm |

## 4. Yêu cầu nghiệp vụ và chức năng

| Mã | Yêu cầu | Người cần |
|---|---|---|
| YCAU_NGHIEPVU_59 | Mỗi công ty con có hồ sơ nhân sự của người lao động mình (thông tin cá nhân, liên hệ, trình độ, vị trí, ngày vào làm), đủ nội dung sổ quản lý lao động điện tử | Nhân sự, Quản lý |
| YCAU_NGHIEPVU_60 | Hồ sơ gắn với tài khoản đăng nhập (không bắt buộc) và cơ cấu công ty, chi nhánh, phòng ban đã có | Nhân sự, Quản trị công ty |
| YCAU_NGHIEPVU_61 | Lưu giấy tờ (số, bản sao điện tử), người phụ thuộc; bảo vệ dữ liệu cá nhân nhạy cảm theo luật | Nhân sự, người lao động |
| YCAU_NGHIEPVU_62 | Ghi quá trình công tác (vào làm, điều chuyển, đổi chức danh, nghỉ việc); phòng ban, chức danh trong hệ thống tự khớp với quyết định | Nhân sự, Quản trị công ty |
| YCAU_NGHIEPVU_63 | Lập hợp đồng lao động, hợp đồng thử việc đúng luật, qua luồng duyệt, ghi nhận đã ký, chấm dứt | Nhân sự, Ban giám đốc |
| YCAU_NGHIEPVU_64 | Lập phụ lục sửa đổi hợp đồng (lương, chức danh, nơi làm việc) có ngày hiệu lực | Nhân sự |
| YCAU_NGHIEPVU_65 | Không bỏ sót hợp đồng hết hạn; nhân viên xem được hồ sơ, hợp đồng của mình | Nhân sự, Trưởng phòng, người lao động |

| Mã | Chức năng | Yêu cầu |
|---|---|---|
| CHUC_NANG_162 | Hồ sơ nhân sự: danh sách, lập, sửa; liên kết tài khoản; giấy tờ và tệp; ghi nhận đồng ý xử lý dữ liệu nhạy cảm; người phụ thuộc; quá trình công tác (tự cập nhật thành viên công ty khi đến ngày hiệu lực); nghỉ việc; trang "Hồ sơ của tôi" | YCAU_NGHIEPVU_59, 60, 61, 62, 65 |
| CHUC_NANG_163 | Hợp đồng lao động, hợp đồng thử việc, phụ lục: lập, sửa, gửi duyệt, rút, xác nhận đã ký (tải bản đã ký), chấm dứt, hủy; giá trị hiện hành sau phụ lục | YCAU_NGHIEPVU_63, 64 |
| CHUC_NANG_164 | Nhắc hết hạn hợp đồng: danh sách sắp hết hạn, đã hết hạn chưa xử lý; thông báo theo mốc | YCAU_NGHIEPVU_65 |

## 5. Quy tắc nghiệp vụ

| Mã | Quy tắc | Yêu cầu |
|---|---|---|
| QUYTAC_NGHIEPVU_292 | Hồ sơ nhân sự thuộc một công ty (pháp nhân ký hợp đồng). Mã nhân viên tự cấp theo dãy số chứng từ của công ty (loại `hr.employee`, mặc định `NV` + 6 chữ số, không theo kỳ); khi lập có thể nhập tay mã cũ, duy nhất trong công ty không phân biệt hoa thường, tối đa 20 ký tự. Bắt buộc: họ tên, giới tính, ngày sinh, quốc tịch (mặc định Việt Nam), số căn cước (công dân Việt Nam, đúng 12 chữ số) hoặc số hộ chiếu (người nước ngoài), nơi cư trú, ngày vào làm. Không bắt buộc: điện thoại, email cá nhân, địa chỉ liên hệ, tình trạng hôn nhân, trình độ chuyên môn (danh mục: chưa qua đào tạo, sơ cấp, trung cấp, cao đẳng, đại học, thạc sĩ, tiến sĩ), chuyên ngành, mã số thuế cá nhân, số sổ bảo hiểm xã hội, tài khoản ngân hàng (ngân hàng, số tài khoản, chủ tài khoản), giấy phép lao động (số, ngày hết hạn) với người nước ngoài, người liên hệ khẩn cấp. Số căn cước, số hộ chiếu không trùng giữa các hồ sơ đang làm của cùng công ty. Trạng thái: đang làm, đã nghỉ | YCAU_NGHIEPVU_59 |
| QUYTAC_NGHIEPVU_293 | Liên kết tài khoản không bắt buộc. Tài khoản được liên kết phải là thành viên đang hoạt động của công ty; một tài khoản tối đa một hồ sơ trong mỗi công ty (kể cả hồ sơ đã nghỉ). Bỏ liên kết được khi hồ sơ đang làm. Phòng ban, chi nhánh làm việc, chức danh hiện tại của hồ sơ lấy từ quá trình công tác (QUYTAC_NGHIEPVU_296), phải thuộc công ty của hồ sơ, đang dùng | YCAU_NGHIEPVU_60 |
| QUYTAC_NGHIEPVU_294 | Tuổi tính theo ngày sinh đến ngày vào làm hoặc ngày hiệu lực hợp đồng: chưa đủ 15 tuổi thì không lập được hồ sơ (phần 1 không hỗ trợ thủ tục riêng của Điều 145). Từ đủ 15 đến chưa đủ 18 tuổi: hồ sơ hiện nhãn "Lao động chưa thành niên"; hợp đồng chỉ xác nhận đã ký được khi hồ sơ có tệp "Văn bản đồng ý của người đại diện theo pháp luật". Người nước ngoài có ngày hết hạn giấy phép lao động thì ngày kết thúc hợp đồng không sau ngày đó | YCAU_NGHIEPVU_59, 63 |
| QUYTAC_NGHIEPVU_295 | Bảo vệ dữ liệu cá nhân: số căn cước, số hộ chiếu, số tài khoản ngân hàng, mã số thuế cá nhân, số sổ bảo hiểm xã hội, số giấy phép lao động, số định danh người phụ thuộc mã hóa khi lưu (AES-256-GCM, `secret-box`), lưu thêm 4 ký tự cuối để hiện dạng che; API trả dạng che (`********1234`) trừ người có quyền nhạy cảm `hr.identity.view` khi bấm "Hiện" (mỗi lần hiện ghi nhật ký thao tác, không ghi giá trị). Tệp giấy tờ (loại: ảnh căn cước hoặc hộ chiếu, văn bằng chứng chỉ, giấy khám sức khỏe, sơ yếu lý lịch, văn bản đồng ý xử lý dữ liệu, văn bản đồng ý của người đại diện, khác) chỉ người có `hr.identity.view` tải được, mỗi lần tải ghi nhật ký; tệp PDF, JPG, PNG, tối đa 10 MB; hệ thống chỉ lưu bản sao điện tử (Bộ luật Lao động Điều 17). Hồ sơ ghi nhận đồng ý xử lý dữ liệu nhạy cảm (ngày đồng ý, tệp văn bản đồng ý); hồ sơ có tệp loại ảnh căn cước, giấy khám sức khỏe mà chưa ghi nhận đồng ý thì hiện cảnh báo. Không lưu chi tiết tình trạng sức khỏe. Nhật ký thao tác sửa hồ sơ chỉ ghi tên trường đổi và dạng che của trường mã hóa | YCAU_NGHIEPVU_61 |
| QUYTAC_NGHIEPVU_296 | Quá trình công tác là danh sách quyết định của hồ sơ, mỗi quyết định có: loại (vào làm, điều chuyển, bổ nhiệm hoặc đổi chức danh, theo hợp đồng hoặc phụ lục, nghỉ việc), ngày hiệu lực, số quyết định (không bắt buộc, tối đa 50 ký tự), phòng ban, chi nhánh làm việc, chức danh mới (ít nhất một mục đổi, trừ nghỉ việc), ghi chú. Lập hồ sơ tự tạo quyết định "Vào làm" ngày vào làm. Không hai quyết định cùng ngày hiệu lực. Vị trí hiện tại = quyết định có ngày hiệu lực gần nhất không sau hôm nay (giờ Việt Nam), mục không đổi giữ giá trị trước. Sửa, xóa được quyết định chưa đến ngày hiệu lực; đã hiệu lực thì không sửa, không xóa (sai thì ghi quyết định mới). Khi quyết định đến ngày hiệu lực (ghi ngay nếu ngày hiệu lực không sau hôm nay; còn lại việc nền lúc 0 giờ 5 phút giờ Việt Nam) và hồ sơ có tài khoản liên kết: cập nhật phòng ban, chi nhánh mặc định, chức danh của thành viên công ty qua dịch vụ của Nền tảng; vai trò không đổi | YCAU_NGHIEPVU_62 |
| QUYTAC_NGHIEPVU_297 | Hợp đồng thuộc hồ sơ đang làm, cùng công ty. Loại: thử việc, xác định thời hạn, không xác định thời hạn. Số tự cấp khi gửi lần đầu (loại `hr.contract`, mặc định `HDLD` + năm + 4 chữ số). Trường: ngày ký dự kiến, ngày hiệu lực, ngày kết thúc (bắt buộc với thử việc, xác định thời hạn; không có với không xác định thời hạn), chức danh, phòng ban, chi nhánh làm việc, mức lương theo hợp đồng (VND, `numeric`, lớn hơn 0), các khoản phụ cấp (tên, số tiền mỗi tháng), hình thức trả lương (chuyển khoản, tiền mặt), người ký phía công ty (họ tên, chức danh), nội dung khác. Xác định thời hạn: ngày kết thúc từ ngày hiệu lực đến không quá 36 tháng sau ngày hiệu lực trừ 1 ngày, và thời hạn từ 1 tháng trở lên (dưới 1 tháng không làm ở phần 1). Thử việc: chọn mức công việc (người quản lý doanh nghiệp 180 ngày, cao đẳng trở lên 60 ngày, trung cấp hoặc công nhân kỹ thuật hoặc nhân viên nghiệp vụ 30 ngày, khác 6 ngày làm việc tính từ thứ hai đến thứ bảy) và số ngày từ ngày hiệu lực đến ngày kết thúc không vượt mức; mức lương thử việc nhập kèm mức lương chính thức, thử việc không nhỏ hơn 85% chính thức; một hồ sơ chỉ một hợp đồng thử việc cho một chức danh. Khoảng hiệu lực không chồng lên hợp đồng khác chưa hủy của hồ sơ (hợp đồng đã chấm dứt tính đến ngày chấm dứt) | YCAU_NGHIEPVU_63 |
| QUYTAC_NGHIEPVU_298 | Giới hạn ký xác định thời hạn (Điều 20 khoản 2 điểm c): khi gửi hợp đồng xác định thời hạn, đếm các hợp đồng xác định thời hạn đã ký, chưa hủy của hồ sơ nối tiếp nhau (hợp đồng sau có ngày hiệu lực không quá 30 ngày sau ngày kết thúc hoặc ngày chấm dứt của hợp đồng trước); đã có 2 thì chặn, trừ khi hồ sơ là người nước ngoài hoặc người lập chọn "Ngoại lệ theo luật" và nhập lý do (ghi nhật ký, hiện trên hợp đồng và yêu cầu duyệt) | YCAU_NGHIEPVU_63 |
| QUYTAC_NGHIEPVU_299 | Trạng thái hợp đồng, phụ lục: nháp → chờ duyệt → đã duyệt (chờ ký) → đã ký; bị từ chối, đã rút về sửa được rồi gửi lại; nháp, bị từ chối, đã rút, đã duyệt hủy được (nhập lý do); đã ký thì chấm dứt được (hợp đồng). Đi luồng duyệt chung (loại chứng từ `hr.contract` cho hợp đồng, `hr.contract_appendix` cho phụ lục, giá trị duyệt là mức lương sau khi áp dụng; công ty chưa có chính sách duyệt thì gửi xong là đã duyệt). Rút khi chờ duyệt và cấp đầu chưa quyết định. Xác nhận đã ký: nhập ngày ký thật (không sau hôm nay), tải tệp bản đã ký (bắt buộc); kiểm lại QUYTAC_NGHIEPVU_294, 297 (chồng thời gian). Hợp đồng đã ký không sửa; thay đổi bằng phụ lục hoặc hợp đồng mới. Tình trạng hiệu lực tính theo ngày: chưa đến ngày hiệu lực, đang hiệu lực, đã hết hạn (sau ngày kết thúc), đã chấm dứt. Chấm dứt: ngày chấm dứt (từ ngày hiệu lực, không sau ngày kết thúc), lý do theo Điều 34 (hết hạn, hoàn thành công việc, hai bên thỏa thuận, người lao động đơn phương, người sử dụng lao động đơn phương, cho thôi việc, kỷ luật sa thải, thử việc không đạt, người lao động chết hoặc mất tích, khác), ghi chú. Hợp đồng ký và có chức danh, phòng ban hoặc chi nhánh khác vị trí tại ngày hiệu lực thì tự tạo quyết định "Theo hợp đồng" ngày hiệu lực (thay thế nếu đã có quyết định chưa hiệu lực cùng ngày do hợp đồng tạo) | YCAU_NGHIEPVU_63 |
| QUYTAC_NGHIEPVU_300 | Phụ lục thuộc hợp đồng đã ký, chưa chấm dứt, chưa hết hạn. Số = số hợp đồng + `/PL` + thứ tự 2 chữ số, cấp khi gửi lần đầu. Ngày hiệu lực từ ngày hiệu lực hợp đồng đến ngày kết thúc (nếu có), không trùng ngày hiệu lực của phụ lục khác chưa hủy. Nội dung: các mục đổi (chức danh, phòng ban, chi nhánh làm việc, mức lương, phụ cấp thay toàn bộ danh sách, hình thức trả lương) và mô tả điều khoản sửa đổi (bắt buộc); ít nhất một mục đổi hoặc mô tả. Không có trường thời hạn (Điều 22 khoản 2). Giá trị hiện hành của hợp đồng tại một ngày = hợp đồng gốc áp lần lượt các phụ lục đã ký có ngày hiệu lực không sau ngày đó. Phụ lục ký có đổi vị trí thì tự tạo quyết định quá trình công tác như QUYTAC_NGHIEPVU_299 | YCAU_NGHIEPVU_64 |
| QUYTAC_NGHIEPVU_301 | Nhắc hết hạn: hợp đồng thử việc, xác định thời hạn đã ký, chưa chấm dứt, của hồ sơ đang làm, chưa có hợp đồng tiếp theo đã ký bắt đầu trong vòng 30 ngày sau ngày kết thúc. Việc nền lúc 7 giờ giờ Việt Nam mỗi ngày gửi thông báo chuông ở các mốc: còn 30 ngày, còn 7 ngày trước ngày kết thúc; sau ngày kết thúc ngày thứ 1, 8, 15, 22, 29 (xác định thời hạn: "còn N ngày trước khi theo luật thành hợp đồng không xác định thời hạn"; thử việc: "đã hết thử việc, cần thông báo kết quả"). Mỗi mốc gửi một lần cho mỗi hợp đồng. Người nhận: người có `hr.contract.manage` bao trùm công ty, trưởng phòng (người quản lý) của phòng ban hiện hành trên hợp đồng. Quá 30 ngày sau ngày kết thúc mà chưa xử lý: danh sách hiện nhãn "Đã quá 30 ngày" để nhân sự lập hợp đồng không xác định thời hạn; hệ thống không tự tạo hợp đồng. Nghỉ việc: chọn ngày nghỉ, lý do (danh mục như chấm dứt hợp đồng); hợp đồng còn hiệu lực tại ngày nghỉ được chấm dứt cùng ngày, cùng lý do; hợp đồng chưa ký của hồ sơ bị hủy; hồ sơ chuyển "Đã nghỉ" khi đến ngày nghỉ; tạo quyết định "Nghỉ việc"; nhắc quản trị vô hiệu hóa tài khoản liên kết. Hồ sơ đã nghỉ chỉ người có `hr.employee.manage` xem; không sửa (trừ thêm tệp giấy tờ) | YCAU_NGHIEPVU_62, 65 |

## 6. Vai trò và quyền

| Quyền | Ý nghĩa | Nhạy cảm |
|---|---|---|
| `hr.access` | Vào mini app Nhân sự (đã có) | Có |
| `hr.employee.view` | Xem hồ sơ đang làm (số giấy tờ dạng che), người phụ thuộc, quá trình công tác, danh sách hợp đồng không có mức lương | Có |
| `hr.employee.manage` | Lập, sửa hồ sơ, liên kết tài khoản, giấy tờ (tải lên), người phụ thuộc, quá trình công tác, nghỉ việc; xem hồ sơ đã nghỉ | Có |
| `hr.identity.view` | Hiện số giấy tờ, tài khoản ngân hàng đầy đủ; tải tệp giấy tờ, bản hợp đồng đã ký | Có |
| `hr.contract.manage` | Lập, sửa, gửi, rút, xác nhận ký, chấm dứt, hủy hợp đồng, phụ lục; xem mức lương; nhận nhắc hết hạn | Có |

- Quyền gán ở phạm vi tập đoàn hoặc công ty (gán ở chi nhánh không dùng được), như module Tài chính – Kế toán.
- Vai trò mới, phạm vi công ty: `hr_manager` (Quản lý nhân sự): mọi quyền trên, `platform.proposal.create`; `hr_staff` (Nhân viên nhân sự): `hr.access`, `hr.employee.view`, `hr.employee.manage`, `hr.contract.manage`. Quản trị công ty, Quản trị tập đoàn có mọi quyền mới.
- Mọi người có tài khoản liên kết với hồ sơ của công ty đang chọn vào được trang "Hồ sơ của tôi" mà không cần `hr.access` (trang chủ mini app hiện ô Nhân sự cho người có hồ sơ liên kết).
- Trưởng phòng nhận thông báo nhắc hết hạn nhưng không xem được hợp đồng nếu không có quyền.
- Loại chứng từ mới: `hr.contract` (Hợp đồng lao động, cần duyệt), `hr.contract_appendix` (Phụ lục hợp đồng lao động, cần duyệt), `hr.employee` (Mã nhân viên, chỉ dùng dãy số).

## 7. Luồng nghiệp vụ

- Luồng 1 – Tiếp nhận: Nhân sự lập hồ sơ (mã tự cấp), chọn phòng ban, chi nhánh, chức danh, ngày vào làm, liên kết tài khoản nếu có → tải giấy tờ, ghi nhận đồng ý → lập hợp đồng thử việc hoặc hợp đồng chính thức → gửi duyệt → duyệt xong ký giấy → xác nhận đã ký, tải bản đã ký.
- Luồng 2 – Điều chuyển: Nhân sự ghi quyết định điều chuyển ngày hiệu lực → đến ngày hiệu lực, phòng ban, chức danh của tài khoản tự đổi (luồng duyệt, phạm vi dùng theo phòng ban mới). Hoặc lập phụ lục đổi chức danh, lương → duyệt, ký → quyết định "Theo hợp đồng" tự tạo.
- Luồng 3 – Hết hạn: Hệ thống nhắc 30, 7 ngày trước → nhân sự lập hợp đồng mới (hệ thống chặn lần ký xác định thời hạn thứ ba) hoặc chấm dứt hợp đồng hoặc ghi nghỉ việc → hết nhắc.
- Luồng 4 – Nghỉ việc: Nhân sự ghi nghỉ việc (ngày, lý do) → hợp đồng chấm dứt, hồ sơ "Đã nghỉ" khi đến ngày → thông báo cho quản trị vô hiệu hóa tài khoản.
- Luồng 5 – Tự xem: Nhân viên mở "Hồ sơ của tôi" → xem thông tin, quá trình công tác, hợp đồng, phụ lục (có mức lương của chính mình) → muốn sửa thì bấm "Yêu cầu chỉnh sửa" mở trang lập đề xuất của Nền tảng.

## 8. Màn hình (giai đoạn 06.1)

| Mã | Màn hình | Nội dung | Vai trò |
|---|---|---|---|
| MAN_HINH_114 | Danh sách hồ sơ nhân sự | Bảng (mã, họ tên, phòng ban, chức danh, chi nhánh, ngày vào làm, hợp đồng hiện hành và ngày kết thúc, trạng thái, nhãn chưa thành niên, thiếu đồng ý); tìm theo mã, tên, điện thoại; lọc phòng ban, chi nhánh, trạng thái (đã nghỉ chỉ khi có `hr.employee.manage`); nút "Thêm hồ sơ" | `hr.employee.view` |
| MAN_HINH_115 | Biểu mẫu hồ sơ | Nhóm Thông tin cá nhân, Giấy tờ tùy thân, Liên hệ, Trình độ, Công việc (phòng ban, chi nhánh, chức danh, ngày vào làm; chỉ khi lập), Ngân hàng, thuế, bảo hiểm xã hội, Người lao động nước ngoài, Liên hệ khẩn cấp, Tài khoản liên kết; kiểm tra ngay khi rời ô | `hr.employee.manage` |
| MAN_HINH_116 | Chi tiết hồ sơ | Đầu trang: mã, họ tên, trạng thái, vị trí hiện tại, nhãn; thẻ Thông tin (số che, nút "Hiện"), Giấy tờ (danh sách tệp, tải lên, tải xuống, ghi nhận đồng ý), Người phụ thuộc, Quá trình công tác (dòng thời gian, thêm, sửa, xóa quyết định chưa hiệu lực), Hợp đồng (danh sách hợp đồng, phụ lục, nút "Lập hợp đồng"); nút Sửa, Nghỉ việc, Lịch sử | `hr.employee.view` |
| MAN_HINH_117 | Hợp đồng lao động | Hai thẻ: Tất cả (lọc loại, trạng thái, tình trạng hiệu lực), Sắp hết hạn (hết hạn trong 30 ngày, đã hết hạn chưa xử lý, nhãn "Đã quá 30 ngày"); cột: số, nhân viên, loại, hiệu lực, kết thúc, mức lương (khi có quyền), trạng thái | `hr.contract.manage`; `hr.employee.view` không có cột lương |
| MAN_HINH_118 | Chi tiết, biểu mẫu hợp đồng, phụ lục | Biểu mẫu theo loại (thử việc hiện mức công việc, lương chính thức, kiểm 85%); cảnh báo lần ký xác định thời hạn, ngoại lệ theo luật; chi tiết: giá trị gốc, giá trị hiện hành, danh sách phụ lục, tiến trình duyệt, xác nhận đã ký (ngày, tệp), chấm dứt, hủy, rút, lịch sử | `hr.contract.manage` |
| MAN_HINH_119 | Hồ sơ của tôi | Thông tin của mình (số giấy tờ hiện đầy đủ sau khi bấm "Hiện", ghi nhật ký), quá trình công tác, hợp đồng và phụ lục của mình (có mức lương, tải bản đã ký của mình); nút "Yêu cầu chỉnh sửa" | Người có hồ sơ liên kết |

Điều hướng: trang chủ mini app → Nhân sự → menu: Hồ sơ nhân sự (114 → 116 → 115, 118), Hợp đồng (117 → 118), Hồ sơ của tôi (119). Không có quyền nào ngoài liên kết hồ sơ thì menu chỉ có "Hồ sơ của tôi". Thông báo nhắc hết hạn mở 118.

## 9. Dữ liệu và API (phác thảo, chi tiết ở giai đoạn 07)

- Schema `hr` (chỉ module Nhân sự ghi); khóa ngoại trỏ `core`.
- Database migration `0070_hr_employees.sql`: `hr.employees` (cột mã hóa `bytea` + `*_last4`), `hr.employee_documents` (khóa lưu trữ tệp, loại, tên tệp, kích thước), `hr.employee_consents`, `hr.dependents`, `hr.work_events` (cột `applied_at` đánh dấu đã cập nhật thành viên công ty); quyền, vai trò, loại chứng từ, dãy số.
- Database migration `0071_hr_contracts.sql`: `hr.contracts`, `hr.contract_allowances`, `hr.contract_appendices`, `hr.contract_appendix_allowances`.
- Database migration `0072_hr_contract_reminders.sql`: `hr.contract_reminders` (hợp đồng, mốc, ngày gửi; duy nhất theo hợp đồng và mốc).
- API_144 `/hr/employees` (tùy chọn, danh sách, chi tiết, lập, sửa, hiện số giấy tờ, liên kết, bỏ liên kết tài khoản, nghỉ việc); API_145 `/hr/employees/{id}/documents`, `/consents` (danh sách, tải lên, tải xuống); API_146 `/hr/employees/{id}/dependents`, `/work-events`; API_147 `/hr/contracts` (danh sách, sắp hết hạn, chi tiết, lập, sửa, gửi, rút, xác nhận ký, chấm dứt, hủy, tải bản đã ký); API_148 `/hr/contracts/{id}/appendices` (lập, sửa, gửi, rút, xác nhận ký, hủy); API_149 `/hr/me` (hồ sơ của tôi, hiện số giấy tờ của mình, tải bản đã ký của mình).
- Dịch vụ Nền tảng dùng lại: dãy số chứng từ, luồng duyệt (`submitWithin`, `withdraw`, nghe `core.approval.completed`), lưu tệp (`createFileStorage`), thông báo (`notify`), nhật ký thao tác, mã hóa (`secret-box`). Thêm hàm cập nhật thành viên công ty dùng trong giao dịch (tách từ `UsersService`, không kiểm quyền người gọi).
- Việc nền mới (BullMQ): `hr-work-events` (0 giờ 5 phút), `hr-contract-reminders` (7 giờ), múi giờ `Asia/Ho_Chi_Minh`.

## 10. Điều kiện đặc biệt

- Cập nhật thành viên công ty và đánh dấu quyết định đã áp dụng trong cùng giao dịch; việc nền chạy lại không áp dụng hai lần.
- Gửi, xác nhận ký hợp đồng khóa hồ sơ (`FOR UPDATE`) để kiểm chồng thời gian và giới hạn ký không bị hai yêu cầu đồng thời vượt qua.
- Khóa mã hóa dùng chung `MFA_SECRET_KEY` như bí mật đã có; đổi khóa là việc vận hành sau (tài liệu `22` mục 5).

## 11. Tiêu chí nghiệm thu

| Mã | Tiêu chí | Mức |
|---|---|---|
| TIEUCHI_NGHIEMTHU_287 | Lập, sửa hồ sơ: mã tự cấp hoặc nhập tay không trùng; trường bắt buộc, định dạng căn cước, trùng căn cước bị chặn; dưới 15 tuổi bị chặn; liên kết tài khoản đúng QUYTAC_NGHIEPVU_293 | Bắt buộc |
| TIEUCHI_NGHIEMTHU_288 | Dữ liệu nhạy cảm: lưu mã hóa (cơ sở dữ liệu không có giá trị rõ); API trả dạng che khi không có `hr.identity.view`; hiện, tải tệp ghi nhật ký; công ty khác nhận `404`; người không có quyền nhận `403` | Bắt buộc |
| TIEUCHI_NGHIEMTHU_289 | Quá trình công tác: vị trí hiện tại đúng; quyết định đến ngày hiệu lực cập nhật phòng ban, chi nhánh, chức danh của thành viên công ty đúng một lần; không sửa quyết định đã hiệu lực | Bắt buộc |
| TIEUCHI_NGHIEMTHU_290 | Hợp đồng: kiểm loại, thời hạn 36 tháng, thử việc (số ngày theo mức, 85% lương), chồng thời gian, giới hạn ký xác định thời hạn và ngoại lệ, giấy phép lao động, đồng ý của người đại diện; qua luồng duyệt; xác nhận ký cần tệp; đã ký không sửa | Bắt buộc |
| TIEUCHI_NGHIEMTHU_291 | Phụ lục: chỉ cho hợp đồng đã ký còn hiệu lực; không có thời hạn; giá trị hiện hành đúng theo ngày; ký phụ lục đổi vị trí tạo quyết định quá trình công tác | Bắt buộc |
| TIEUCHI_NGHIEMTHU_292 | Nhắc hết hạn: đúng mốc, mỗi mốc một lần, đúng người nhận; hợp đồng đã có hợp đồng tiếp theo hoặc đã chấm dứt không nhắc; danh sách sắp hết hạn, nhãn quá 30 ngày đúng | Bắt buộc |
| TIEUCHI_NGHIEMTHU_293 | Nghỉ việc chấm dứt hợp đồng, hủy hợp đồng chưa ký, hồ sơ "Đã nghỉ" chỉ người có `hr.employee.manage` thấy; nhân viên xem đúng hồ sơ, hợp đồng của mình, không xem được của người khác | Bắt buộc |
| TIEUCHI_NGHIEMTHU_294 | MAN_HINH_114 đến MAN_HINH_119 đạt danh sách rà soát giao diện trên máy tính và điện thoại | Bắt buộc |

## 12. Kịch bản kiểm thử

KICHBAN_KIEMTHU_434 đến KICHBAN_KIEMTHU_441 tự động (`apps/api/test/c46-*.test.ts`): 434 hồ sơ và liên kết; 435 mã hóa, che, quyền, cách ly công ty; 436 quá trình công tác và cập nhật thành viên công ty; 437 hợp đồng (kiểm luật, duyệt, ký); 438 giới hạn ký xác định thời hạn, ngoại lệ; 439 phụ lục, giá trị hiện hành; 440 nhắc hết hạn; 441 nghỉ việc, hồ sơ của tôi. KICHBAN_KIEMTHU_442 (trình duyệt máy tính), KICHBAN_KIEMTHU_443 (điện thoại) thủ công; ghi trong tài liệu `21` khi trình nghiệm thu (gửi phiên cha nếu cần ghi sổ).

## 13. Ràng buộc kỹ thuật

- Không thêm thư viện. Mini app mới theo mẫu `apps/web-finance` (Next.js, cổng 3007, mini app Nền tảng chuyển tiếp `/hr` theo biến `HR_ORIGIN`).
- Module `apps/api/src/hr`; chỉ ghi schema `hr`; cập nhật `core.user_company_memberships` qua hàm của module người dùng.
- Chuỗi giao diện trong `packages/i18n`; lược đồ zod trong `packages/contracts`; giá trị giao diện từ tài liệu `15` (không cần giá trị mới; nếu cần sẽ đề xuất trước).

## 14. Thành phần không được thay đổi

Luồng duyệt chung, dãy số chứng từ, đăng nhập, phân quyền hiện có; dữ liệu và API của MAN_HINH_12, MAN_HINH_13 (chỉ thêm hàm cập nhật thành viên dùng chung, hành vi API cũ giữ nguyên).

## 15. Các lát và điểm xem trước

- L0: database migration 0070, quyền, vai trò; hồ sơ, giấy tờ, đồng ý, người phụ thuộc, quá trình công tác, việc nền áp dụng quyết định; mini app, MAN_HINH_114 đến MAN_HINH_116. Điểm xem trước: lập hồ sơ, điều chuyển, thấy phòng ban tài khoản đổi.
- L1: database migration 0071; hợp đồng, phụ lục, luồng duyệt, ký, chấm dứt, nghỉ việc; MAN_HINH_117, MAN_HINH_118. Điểm xem trước: lập, duyệt, ký hợp đồng; chặn lần ký thứ ba; phụ lục tăng lương.
- L2: database migration 0072; nhắc hết hạn, danh sách sắp hết hạn; MAN_HINH_119. Điểm xem trước: thông báo nhắc, hồ sơ của tôi.

## 16. Quyết định AI tự đưa ra (trong phạm vi quyết định của người dùng)

- Hồ sơ thuộc công ty ký hợp đồng; một người làm hai công ty con có hai hồ sơ (pháp nhân khác nhau, không chia sẻ dữ liệu cá nhân giữa công ty).
- Không hỗ trợ người chưa đủ 15 tuổi và hợp đồng dưới 1 tháng ở phần 1 (thủ tục riêng, ít gặp).
- Nghỉ việc không tự khóa tài khoản, chỉ thông báo quản trị (khóa là quyền nhạy cảm của Nền tảng).
- Hợp đồng ký đổi vị trí tự tạo quyết định quá trình công tác để phòng ban của tài khoản khớp hợp đồng.
- Quá 30 ngày sau hết hạn không tự tạo hợp đồng không xác định thời hạn; chỉ gắn nhãn để nhân sự lập (cần chữ ký, nội dung).
- Mã hóa cột dùng khóa sẵn có `MFA_SECRET_KEY` như bí mật tích hợp.
- Nhân viên tự xem thấy số giấy tờ đầy đủ của chính mình sau khi bấm "Hiện" (quyền xem của chủ thể dữ liệu), có ghi nhật ký.

## 17. Quyết định của người dùng (2026-11-11)

- Hồ sơ không bắt buộc gắn tài khoản; một tài khoản tối đa một hồ sơ mỗi công ty.
- Hợp đồng, phụ lục đi luồng duyệt chung; chưa có chính sách thì gửi xong là duyệt.
- Nhắc trước 30, 7 ngày; sau hạn nhắc hằng tuần đến khi xử lý; người nhận là người quản lý hợp đồng của công ty và trưởng phòng.
- Nghỉ việc: giữ hồ sơ, khóa truy cập; thời hạn lưu, xóa, khử nhận dạng làm sau khi chốt với luật sư (ghi rủi ro vào tài liệu `22`).
- Quyết định quá trình công tác đến ngày hiệu lực tự cập nhật phòng ban, chi nhánh, chức danh của tài khoản.
- Nhân viên chỉ xem hồ sơ của mình, yêu cầu sửa qua đề xuất.
- Cho tải tệp giấy tờ với quyền nhạy cảm riêng; mã hóa số giấy tờ, hiện dạng che; không lưu chi tiết sức khỏe; ghi nhận đồng ý xử lý dữ liệu nhạy cảm.
- Mã nhân viên tự cấp theo dãy số công ty, cho nhập tay mã cũ.
- Không đọc được nguồn V-com-ERP trong phiên này (chưa được cấp quyền thêm kho); tự viết theo mã sẵn có của dự án (tài liệu `13` mục 4, phương án 3).

## 18. Kết quả đối chiếu định nghĩa hoàn thành

Chưa đối chiếu.

## 19. Chỗ chỉnh cho khớp mã (lát L0)

| Vị trí | Đặc tả 0.1 | Mã đã làm |
|---|---|---|
| QUYTAC_NGHIEPVU_292 | Mã nhân viên `NV` + 6 chữ số | Theo định dạng chung của dãy số chứng từ: `NV-<mã công ty>-000001` (không đặt lại theo kỳ); tiền tố đổi được ở Dãy số chứng từ |
| QUYTAC_NGHIEPVU_295, mục 9 | Bảng `hr.employee_consents` | Không tạo bảng riêng: đồng ý xử lý dữ liệu là tệp loại "Văn bản đồng ý xử lý dữ liệu" có ngày đồng ý trong `hr.employee_documents`; ngày đồng ý của hồ sơ là ngày mới nhất |
| QUYTAC_NGHIEPVU_295 | Kiểm trùng số căn cước | Số mã hóa có véc-tơ khởi tạo ngẫu nhiên nên kiểm trùng bằng mã băm có khóa (HMAC-SHA256, cột `identity_hash`) |
| QUYTAC_NGHIEPVU_296 | Cập nhật khi quyết định đến ngày hiệu lực | Thêm: liên kết tài khoản mới thì cập nhật ngay theo vị trí hiện hành; quyết định ghi lùi ngày áp dụng ngay; ngày hiệu lực phải sau ngày vào làm |
| Mục 6 | Trang "Hồ sơ của tôi" không cần `hr.access` | Menu dùng quyền `platform.access` (mọi nhân viên có); API `/hr/me` chỉ cần là thành viên công ty đang chọn |
| MAN_HINH_116 | Thẻ Hợp đồng | Làm ở lát L1 cùng MAN_HINH_117, 118 |
