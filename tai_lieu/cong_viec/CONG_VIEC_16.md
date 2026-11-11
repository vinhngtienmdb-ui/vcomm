# CONG_VIEC_16: Hóa đơn điện tử (MODULE_06, phần 4)

- Mô tả: Lập hóa đơn điện tử tự động khi phiếu xuất giao hàng ghi sổ, gửi qua nhà cung cấp hóa đơn điện tử cài đặt theo từng công ty; hóa đơn điều chỉnh giảm khi trả hàng hoặc ghi hóa đơn trả hàng của người mua; hóa đơn thay thế khi sai thông tin người mua.
- Phiên bản: 0.2
- Ngày cập nhật: 2026-11-10
- Trạng thái: Bản nháp. Đã lập trình lát L0, L1, L2 và sửa lỗi rà soát; nội dung khớp mã ngày 2026-11-10.
- Nguồn: tài liệu `05` mục 2.1 (hóa đơn điện tử, tích hợp nhà cung cấp có API); quyết định của người dùng ngày 2026-11-10 trong tài liệu `02` (mỗi lần giao một hóa đơn; nhà cung cấp, loại hóa đơn, ký hiệu theo từng công ty; lập tự động khi ghi sổ; trả hàng kế toán chọn; lập cho mọi phiếu, kể cả đơn không có khách, THAY_DOI_11; bán nội bộ lập như bán thường; ký số từ xa); Nghị định 254/2026/NĐ-CP (Điều 6, 8, 9, 10, 12, 13, 14, Phụ lục); Thông tư 91/2026/TT-BTC (Điều 4 ký hiệu, Điều 10 xử lý sai sót, trả hàng).

## 1. Mục tiêu

Mỗi lần giao hàng có hóa đơn điện tử hợp lệ gửi cơ quan thuế đúng hạn mà không ai phải lập tay; số tiền trên hóa đơn khớp công nợ và sổ cái.

## 2. Phạm vi

Trong phạm vi: CHUC_NANG_76 đến CHUC_NANG_79.

Ngoài phạm vi:
- Hóa đơn cho phiếu xuất ghi sổ trước ngày bật hóa đơn điện tử của công ty (không lập lùi).
- Hóa đơn khởi tạo từ máy tính tiền tại quầy (chưa có bán tại quầy); phiếu xuất kho kiêm vận chuyển nội bộ; tem, vé.
- Thông báo hóa đơn sai sót Mẫu 04/SS-HĐĐT (sai tên, địa chỉ không sai mã số thuế, tiền, thuế suất): kế toán lập trên phần mềm nhà cung cấp; hóa đơn điều chỉnh gộp nhiều hóa đơn kèm bảng kê 01/BK-ĐCTT.
- Hóa đơn đầu vào (nhà cung cấp gửi), so khớp ba bên, kê khai thuế.
- Nhà cung cấp VNPT, Viettel và nhà cung cấp khác MISA meInvoice: thêm khi có tài liệu API, tài khoản thử.
- Hủy hóa đơn đã gửi cơ quan thuế (pháp luật không có thủ tục hủy; xử lý bằng điều chỉnh, thay thế).

## 3. Yêu cầu nghiệp vụ và chức năng

| Mã | Yêu cầu | Người cần |
|---|---|---|
| YCAU_NGHIEPVU_41 | Lập, gửi hóa đơn điện tử cho mỗi lần giao hàng theo cài đặt của từng công ty; xử lý hóa đơn khi trả hàng, khi sai thông tin người mua | Kế toán, Kế toán trưởng |

| Mã | Chức năng | Yêu cầu |
|---|---|---|
| CHUC_NANG_76 | Cài đặt hóa đơn điện tử của công ty: bật, ngày bắt đầu, nhà cung cấp (bộ giả lập, MISA meInvoice), môi trường thử hoặc chính thức, thông tin kết nối (khóa bí mật mã hóa), loại hóa đơn (có mã, không mã), ký hiệu mẫu số, ký hiệu hóa đơn theo năm; kiểm tra kết nối | YCAU_NGHIEPVU_41 |
| CHUC_NANG_77 | Lập hóa đơn tự động khi phiếu xuất giao hàng ghi sổ; gửi nền qua nhà cung cấp, tự gửi lại khi lỗi, tra trạng thái, nhận số hóa đơn, mã của cơ quan thuế; tải PDF, XML; cảnh báo hóa đơn chưa gửi được đến hạn | YCAU_NGHIEPVU_41 |
| CHUC_NANG_78 | Trả hàng: phiếu nhận hàng trả lại ghi sổ tạo việc chờ kế toán chọn lập hóa đơn điều chỉnh giảm (tham chiếu hóa đơn gốc) hoặc ghi số hóa đơn trả hàng của người mua | YCAU_NGHIEPVU_41 |
| CHUC_NANG_79 | Hóa đơn thay thế khi sai thông tin người mua (tên, địa chỉ, mã số thuế); danh sách, tra cứu hóa đơn theo trạng thái, ngày, người mua, phiếu xuất | YCAU_NGHIEPVU_41 |

## 4. Quy tắc nghiệp vụ

| Mã | Quy tắc | Yêu cầu |
|---|---|---|
| QUYTAC_NGHIEPVU_103 | Cài đặt theo công ty, do người có quyền cài đặt hóa đơn điện tử sửa. Nhà cung cấp: `simulator` (bộ giả lập, chỉ dùng khi môi trường không phải môi trường thật) hoặc `misa`. Thông tin kết nối MISA: mã ứng dụng, mã số thuế, tên đăng nhập, mật khẩu (mã hóa như khóa tích hợp, để trống khi sửa là giữ nguyên, chỉ hiện 4 ký tự cuối). Ký hiệu mẫu số 1 chữ số (1: hóa đơn giá trị gia tăng, 2: hóa đơn bán hàng, theo phương pháp tính thuế của công ty). Ký hiệu hóa đơn 6 ký tự: `C` (có mã) hoặc `K` (không mã) khớp loại hóa đơn đã chọn, 2 số cuối của năm khai, `T`, 2 chữ cái in hoa người bán tự đặt (bảng `einvoice_series`); mỗi năm một ký hiệu, năm chưa khai ký hiệu thì hóa đơn ngày thuộc năm đó dừng ở "Lỗi cài đặt", lưu cài đặt có ký hiệu của năm thì tự về "Chờ gửi". Thông tin kết nối MISA bắt buộc khi chọn MISA. Bật cần ngày bắt đầu và ký hiệu của năm chứa ngày bắt đầu; tắt thì phiếu ghi sổ sau đó không lập hóa đơn, hóa đơn đang chờ vẫn gửi. "Kiểm tra kết nối" (`POST /finance/einvoice-settings/test`) dùng cài đặt đã lưu. 4 ký tự cuối mật khẩu chỉ hiện cho người có quyền cài đặt | YCAU_NGHIEPVU_41 |
| QUYTAC_NGHIEPVU_104 | Phiếu xuất giao hàng ghi sổ (ngày phiếu không trước ngày bắt đầu, công ty đang bật) tạo một hóa đơn trong cùng giao dịch ghi sổ, trạng thái "Chờ gửi". Ngày hóa đơn là ngày phiếu. Người bán: tên pháp lý, mã số thuế, địa chỉ của công ty. Người mua: đối tác khách hàng (tên, mã số thuế, địa chỉ; công ty con trong tập đoàn như khách thường); đơn không có khách thì ghi tên người mua của đơn nếu có và cờ "người mua không cung cấp thông tin". Dòng hóa đơn theo dòng phiếu: tên hàng, đơn vị tính, số lượng theo đơn vị của dòng đơn, thuế suất của dòng đơn (`0`, `5`, `8`, `10` phần trăm; không chịu thuế; không kê khai, tính nộp thuế), tiền gồm thuế và chưa thuế tính theo lũy kế dòng đơn như công nợ (THAY_DOI_10), tiền thuế là phần chênh lệch, đơn giá chưa thuế bằng tiền chưa thuế chia số lượng, làm tròn theo đơn vị tiền tệ của công ty (quyết định người dùng 2026-11-10; thành tiền không tính lại theo đơn giá đã làm tròn); dòng hàng tặng (giá 0) ghi là hàng khuyến mại. Tổng tiền theo từng thuế suất, tổng thanh toán bằng tiền công nợ của phiếu; số tiền bằng chữ. Tiền tệ là tiền tệ của đơn bán (tiền tệ công ty khi lập đơn). Nội dung hóa đơn lưu cố định khi lập, không đổi khi danh mục đổi | YCAU_NGHIEPVU_41 |
| QUYTAC_NGHIEPVU_105 | Gửi nền: hóa đơn "Chờ gửi", "Chờ gửi lại", "Chờ cấp mã" đến giờ gửi được gửi qua nhà cung cấp ghi trên hóa đơn, mỗi hóa đơn có mã tham chiếu duy nhất tạo khi lập. Ghi lần gửi trước khi gọi nhà cung cấp, gọi ngoài giao dịch cơ sở dữ liệu. Lần đầu phát hành; mọi lần sau (sau lỗi tạm thời, hết thời gian chờ, lần bị gián đoạn, chờ cấp mã) tra trạng thái theo mã tham chiếu trước, không thấy mới phát hành; nhà cung cấp báo trùng mã tham chiếu thì tra trạng thái. Kết quả: có số hóa đơn và (với hóa đơn có mã) mã của cơ quan thuế thì "Đã phát hành", tải PDF, XML; có số chưa có mã thì "Chờ cấp mã"; cơ quan thuế từ chối thì "Bị từ chối" kèm lý do; lỗi kết nối, lỗi tạm thời, hết thời gian chờ thì "Chờ gửi lại", gửi lại sau 1, 5, 15, 60 phút rồi mỗi 60 phút; lỗi dữ liệu, lỗi xác thực thì "Lỗi". Chỉ kết quả của lần gửi mới nhất được ghi; hóa đơn "Đã phát hành" không đổi trạng thái. Gửi lại tay: "Lỗi", "Lỗi cài đặt", "Chờ gửi lại", "Bị từ chối"; không khi đang có lần gửi chưa xong dưới 10 phút; nhà cung cấp có thể đang giữ hóa đơn (có số, lần gần nhất lỗi tạm thời hoặc không rõ kết quả) thì giữ nội dung; "Bị từ chối" lập lại với mã tham chiếu mới; còn lại lấy lại cài đặt, thông tin công ty hiện tại. Số hóa đơn do nhà cung cấp cấp theo ký hiệu (tối đa 8 chữ số, bắt đầu từ 1 mỗi năm, liên tục). Hạn gửi là ngày làm việc tiếp theo ngày hóa đơn (bỏ thứ Bảy, Chủ nhật, chưa tính ngày lễ); hóa đơn chưa "Đã phát hành" sau hạn gửi là quá hạn, mỗi giờ báo một lần cho người có quyền quản lý hóa đơn của công ty, mỗi hóa đơn báo một lần | YCAU_NGHIEPVU_41 |
| QUYTAC_NGHIEPVU_106 | Trả hàng: phiếu nhận hàng trả lại ghi sổ mà phiếu xuất gốc có hóa đơn gốc (trạng thái bất kỳ) tạo việc chờ xử lý hóa đơn; xử lý được khi hóa đơn gốc hiện hành "Đã phát hành". Hóa đơn điều chỉnh lấy ngày hôm nay. Kế toán chọn: (a) lập hóa đơn điều chỉnh giảm tham chiếu hóa đơn gốc (mẫu số, ký hiệu, số, ngày), dòng là hàng trả với số lượng, tiền chưa thuế, thuế ghi âm theo lũy kế như công nợ, gửi như hóa đơn thường; (b) ghi hóa đơn trả hàng do người mua lập (số, ký hiệu, ngày; người mua là tổ chức có mã số thuế). Phiếu xuất gốc chưa có hóa đơn phát hành thì việc chờ đến khi hóa đơn gốc phát hành. Hóa đơn gốc đã có hóa đơn thay thế thì tham chiếu hóa đơn thay thế | YCAU_NGHIEPVU_41 |
| QUYTAC_NGHIEPVU_107 | Thay thế: hóa đơn "Đã phát hành" (hóa đơn gốc hoặc hóa đơn thay thế, không phải hóa đơn điều chỉnh) sai thông tin người mua được thay bằng hóa đơn mới ngày hôm nay, cùng dòng hàng, người mua đã sửa (tên, địa chỉ, mã số thuế), tham chiếu hóa đơn bị thay thế, cần lý do (1 đến 500 ký tự). Hóa đơn đã có hóa đơn điều chỉnh thì không thay thế (lần sau theo hình thức đã chọn lần đầu, Thông tư 91/2026 Điều 10 khoản 6); hóa đơn đã bị thay thế thì không thay thế lại, thay hóa đơn thay thế; đang có hóa đơn thay thế chưa "Lỗi", "Bị từ chối" thì không lập thêm. Hóa đơn bị thay thế giữ nguyên, ghi "Đã bị thay thế" khi hóa đơn thay thế "Đã phát hành". Hóa đơn điều chỉnh, thay thế không đổi công nợ, bút toán (công nợ, bút toán theo phiếu kho) | YCAU_NGHIEPVU_41 |

## 5. Vai trò và quyền

| Quyền | Ý nghĩa | Nhạy cảm |
|---|---|---|
| `finance.einvoice.view` | Xem hóa đơn điện tử, tải PDF, XML | Không |
| `finance.einvoice.manage` | Gửi lại, xử lý trả hàng, lập hóa đơn thay thế | Không |
| `finance.einvoice.setup` | Sửa cài đặt hóa đơn điện tử, kiểm tra kết nối | Có |

Quyền chỉ dùng được khi gán ở phạm vi tập đoàn hoặc công ty. Kế toán: xem, quản lý. Kế toán trưởng, Quản trị công ty, Quản trị tập đoàn: cả ba.

## 6. Luồng nghiệp vụ

- Luồng 27: Thủ kho ghi sổ phiếu xuất giao hàng → hệ thống lập hóa đơn "Chờ gửi" → tác vụ nền gửi nhà cung cấp → nhà cung cấp ký số, gửi cơ quan thuế → hệ thống nhận số, mã → "Đã phát hành"; lỗi thì gửi lại; quá hạn thì báo kế toán.
- Luồng 28: Phiếu nhận hàng trả lại ghi sổ → việc chờ xử lý hóa đơn → kế toán chọn điều chỉnh giảm (gửi như luồng 27) hoặc ghi hóa đơn trả hàng của người mua.

## 7. Màn hình

| Mã | Màn hình | Nội dung |
|---|---|---|
| MAN_HINH_54 | Hóa đơn điện tử | Thẻ "Hóa đơn": lọc trạng thái, khoảng ngày, người mua; chỉ hóa đơn quá hạn, tìm theo người mua, mã số thuế, số hóa đơn, số phiếu; bảng (ngày, ký hiệu, số, người mua, phiếu kho, tổng tiền, loại gốc/điều chỉnh/thay thế, trạng thái, quá hạn, đã bị thay thế). Chi tiết: người bán, người mua, dòng hàng, tổng theo thuế suất, mã của cơ quan thuế, phiếu xuất, hóa đơn liên quan, các lần gửi; nút "Gửi lại" (Lỗi, Lỗi cài đặt, Chờ gửi lại), "Tải PDF", "Tải XML", "Lập hóa đơn thay thế". Thẻ "Chờ xử lý trả hàng": phiếu nhận hàng trả lại, hóa đơn gốc, số tiền; nút "Lập hóa đơn điều chỉnh giảm", "Ghi hóa đơn trả hàng của người mua" |
| MAN_HINH_55 | Cài đặt hóa đơn điện tử | Bật, ngày bắt đầu, nhà cung cấp, môi trường, thông tin kết nối (khi chọn MISA), tình huống giả lập (khi chọn bộ giả lập), loại hóa đơn, ký hiệu mẫu số, ký hiệu theo năm; nút "Lưu", "Kiểm tra kết nối" (khi đã lưu cài đặt) |

## 8. Dữ liệu và API

- Database migration `0013_einvoices.sql` (lát L0) trong schema `finance`:
  - `einvoice_settings` (công ty, bật, ngày bắt đầu, nhà cung cấp, môi trường, thông tin kết nối thường và bí mật mã hóa, có mã hay không, ký hiệu mẫu số, tình huống giả lập, phiên bản).
  - `einvoice_series` (công ty, năm, ký hiệu).
  - `einvoices` (công ty, nguồn: phiếu kho; loại: gốc, điều chỉnh, thay thế; hóa đơn liên quan; mã tham chiếu duy nhất; ngày; ký hiệu mẫu số, ký hiệu, số; người bán, người mua cố định; tổng tiền; trạng thái; mã của cơ quan thuế; mã giao dịch nhà cung cấp; lỗi gần nhất; số lần gửi, giờ gửi lại; quá hạn đã báo; tệp PDF, XML).
  - `einvoice_lines`, `einvoice_attempts` (mỗi lần gọi nhà cung cấp: thời điểm, thao tác, kết quả, mã lỗi; không lưu mật khẩu, mã truy cập).
- Database migration `0014_einvoice_returns.sql` (lát L1): `einvoice_return_tasks` (phiếu nhận hàng trả lại, hóa đơn gốc, trạng thái, cách xử lý, hóa đơn điều chỉnh hoặc hóa đơn trả hàng của người mua) và chỉ mục `related_invoice_id` của `einvoices`. Chi tiết: tài liệu `16` mục 16.
- Lớp kết nối nhà cung cấp (`apps/api/src/einvoice/providers/`): giao diện chung (kiểm tra kết nối, phát hành, tra trạng thái theo mã tham chiếu, tải PDF, XML); bộ giả lập (cấp số liên tục theo ký hiệu, mã của cơ quan thuế giả, tạo PDF bằng `pdfmake` qua `apps/api/src/common/pdf.ts`, tình huống lỗi theo cài đặt để kiểm thử); MISA meInvoice (`/auth/token`, `/invoice`, `/invoice/status`, `/invoice/Download`, `/invoice/templates` khi kiểm tra kết nối; ký số từ xa đồng bộ `SignType` 2; mã truy cập giữ trong bộ nhớ theo công ty và thông tin kết nối).
- Tác vụ nền `einvoice-send` mỗi 30 giây, `einvoice-overdue` mỗi giờ, trên hàng đợi BullMQ riêng `hoa-don-dien-tu` (một tác vụ một lúc).
- API_91 `GET /finance/einvoices`, `GET /finance/einvoices/{id}`, `POST /finance/einvoices/{id}/resend`, `GET /finance/einvoices/{id}/file/{pdf|xml}`, `POST /finance/einvoices/{id}/replace`, `GET /finance/einvoice-returns`, `POST /finance/einvoice-returns/{id}/adjust`, `POST /finance/einvoice-returns/{id}/buyer-invoice`; API_92 `GET`, `PUT /finance/einvoice-settings`, `POST /finance/einvoice-settings/test`. Lỗi quy tắc nghiệp vụ trả `409 BUSINESS_RULE` (khóa thông báo ở tài liệu `17` mục 3k).

## 9. Điều kiện đặc biệt

- Ký số tự động cần chữ ký số từ xa (HSM) đăng ký với nhà cung cấp; công ty chưa có thì dùng bộ giả lập ở môi trường thử, không bật ở môi trường thật.
- Tài liệu API MISA meInvoice chính thức không truy cập được ngày 2026-11-10; lớp kết nối MISA dựng theo nguồn thứ cấp, kiểm thử bằng máy chủ giả; phải thử với tài khoản thử MISA trước khi phát hành.

## 10. Tiêu chí nghiệm thu

| Mã | Tiêu chí | Mức |
|---|---|---|
| TIEUCHI_NGHIEMTHU_121 | Cài đặt theo công ty: bật cần đủ thông tin, khóa bí mật mã hóa không hiện lại, ký hiệu đúng định dạng theo năm; chỉ người có quyền cài đặt sửa được | Bắt buộc |
| TIEUCHI_NGHIEMTHU_122 | Phiếu xuất giao hàng ghi sổ lập đúng một hóa đơn, nội dung đúng (người bán, người mua kể cả không có khách và công ty con, dòng, thuế suất, tổng theo thuế suất); tổng thanh toán bằng tiền công nợ của phiếu | Bắt buộc |
| TIEUCHI_NGHIEMTHU_123 | Gửi nền nhận số, mã; lỗi tạm thời tự gửi lại không lập trùng; không biết kết quả thì tra trước khi gửi lại; lỗi dữ liệu dừng chờ kế toán; quá hạn báo kế toán | Bắt buộc |
| TIEUCHI_NGHIEMTHU_124 | Trả hàng: điều chỉnh giảm đúng số âm, tham chiếu hóa đơn gốc; ghi được hóa đơn trả hàng của người mua; hóa đơn gốc chưa phát hành thì chờ | Bắt buộc |
| TIEUCHI_NGHIEMTHU_125 | Thay thế đúng điều kiện (không thay hóa đơn đã điều chỉnh, đã bị thay thế), tham chiếu hóa đơn bị thay thế | Bắt buộc |
| TIEUCHI_NGHIEMTHU_126 | Lớp kết nối MISA meInvoice gửi đúng định dạng, xử lý phản hồi, lỗi trên máy chủ giả; MAN_HINH_54, 55 đạt danh sách rà soát giao diện trên máy tính và điện thoại | Bắt buộc |

## 11. Kịch bản kiểm thử

KICHBAN_KIEMTHU_224 đến KICHBAN_KIEMTHU_233, ghi trong tài liệu `21`: 224 đến 231 kiểm thử tự động `apps/api/test/c16-einvoices.test.ts` (đạt, toàn bộ 241/241 ngày 2026-11-10); 232 (máy tính), 233 (điện thoại) thủ công, đạt ngày 2026-11-10 trừ bước lập hóa đơn thay thế (chưa chạy trên trình duyệt vì dữ liệu phát triển thiếu hàng tồn; đã kiểm bằng KICHBAN_KIEMTHU_230).

## 12. Ràng buộc kỹ thuật

Không thêm thư viện: gọi HTTP bằng `fetch` của Node.js, PDF bằng `pdfmake`, mã hóa bằng `common/secret-box`. Gọi nhà cung cấp ngoài giao dịch cơ sở dữ liệu; thời gian chờ 30 giây mỗi lần gọi, mỗi lần tải tệp, 20 giây mỗi yêu cầu HTTP tới MISA. Bộ giả lập không dùng được khi `NODE_ENV=production`.

## 13. Thành phần không được thay đổi

Ghi sổ phiếu kho, công nợ, bút toán (chỉ thêm hàm gọi sau khi ghi sổ).

## 14. Các lát và điểm xem trước

- L0: cài đặt, lập hóa đơn khi ghi sổ, gửi nền qua bộ giả lập, danh sách, chi tiết, tải PDF, gửi lại, quá hạn. Điểm xem trước: giao hàng trên dữ liệu phát triển thấy hóa đơn phát hành.
- L1: trả hàng (điều chỉnh giảm, hóa đơn của người mua), thay thế.
- L2: lớp kết nối MISA meInvoice (máy chủ giả).

## 15. Kết quả đối chiếu định nghĩa hoàn thành

Chưa đối chiếu.

## 16. Nguồn và điểm chưa xác minh

- Nghị định 254/2026/NĐ-CP (hiệu lực 01/7/2026, thay Nghị định 123/2020, 70/2025); Thông tư 91/2026/TT-BTC (thay Thông tư 32/2025). Kế toán trưởng đối chiếu nguyên văn trước khi phát hành.
- MISA meInvoice: đường dẫn, trường dữ liệu theo nguồn thứ cấp (mã nguồn công khai trích trang `doc.meinvoice.vn/itg`); chưa rõ thời hạn mã truy cập, hành vi gửi trùng mã tham chiếu, bảng mã lỗi.

Giới hạn đã biết (rà soát 2026-11-10):
- Trường `SendTaxStatus` của MISA chưa được dùng: cơ quan thuế từ chối qua MISA chưa nhận ra là "Bị từ chối" (hiện "Chờ cấp mã") đến khi xác nhận giá trị của trường.
- Tệp PDF, XML tải lỗi khi phát hành không được tự tải lại.
- Dòng hóa đơn lấy bằng phép nối trong với dòng đơn bán (`documentItems`): dòng phiếu không có dòng đơn nguồn sẽ bị bỏ.
- Hạn gửi chưa tính ngày nghỉ lễ.
- Tác vụ nền hóa đơn chạy một tác vụ một lúc: nhà cung cấp chậm làm chậm các hóa đơn khác trong lượt.
- Màn hình chưa có nút "Gửi lại" cho hóa đơn "Bị từ chối" (API cho phép).
