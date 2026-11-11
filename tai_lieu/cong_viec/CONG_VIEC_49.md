# CONG_VIEC_49: Cộng đồng phần 1 (MODULE_10)

- Mô tả: Cộng tác viên (gồm nhãn KOL, KOC) chia sẻ đường dẫn sản phẩm nhận hoa hồng; thưởng giới thiệu bạn bè một lần; mua chung bậc giá theo tổng số lượng, trả trước, hoàn tiền dư vào ví mua sắm; bảng tin cộng đồng mở (bài đăng, đánh giá đã mua hàng, bình luận, thích) có hậu kiểm. Trên ứng dụng VComm (`apps/mobile-vcomm`) và web quản trị (`apps/web-crm`).
- Phiên bản: 0.1
- Ngày cập nhật: 2026-11-11
- Trạng thái: Người dùng nghiệm thu ngày 2026-11-11 (chấp nhận các quyết định AI tự đưa ra ở mục 16 và việc sửa kỳ vọng kiểm thử c26). Đã nghiệm thu, chờ phát hành (pull request #97; kiểm thử 493/493 sau khi hợp nhất main).
- Nguồn: tài liệu `04`, `05` (mục 2.2, 2.4); THAY_DOI_14, 16, 17; quyết định của người dùng ngày 2026-11-11 (mục 17); CONG_VIEC_23 (tài khoản người mua, giới thiệu), CONG_VIEC_24 (đặt hàng), CONG_VIEC_25 (thanh toán, hoàn tiền), CONG_VIEC_26 (hoa hồng theo đơn, ví hoa hồng), CONG_VIEC_27 (đội kinh doanh).
- Mức: Lớn (module mới, dữ liệu mới, sửa cách đặt hàng, thanh toán, hoa hồng).

## 1. Mục tiêu

Dùng sức lan truyền của cộng đồng người mua để tăng đơn VComm: người có ảnh hưởng chia sẻ sản phẩm và mở nhóm mua chung, người mua mời bạn bè, người mua chia sẻ trải nghiệm trên bảng tin.

## 2. Phân biệt với phần đã có (không trùng)

| Đối tượng | Gắn với khách | Hoa hồng | Nguồn |
|---|---|---|---|
| Người giới thiệu | Vĩnh viễn (khách đăng ký bằng mã của người đó) | Phần "giới thiệu" trên mọi đơn của khách | CONG_VIEC_23, 26 (giữ nguyên) |
| Nhân viên kinh doanh | Qua người giới thiệu là nhân viên | Phần đội kinh doanh nhiều cấp theo chức danh | CONG_VIEC_27, 26 (giữ nguyên) |
| Cộng tác viên (mới) | Không gắn khách; theo lượt bấm đường dẫn sản phẩm trong 7 ngày hoặc theo nhóm mua chung do mình mở | Phần thứ sáu "cộng tác viên" trên dòng đơn của sản phẩm đó, độc lập với hai phần trên | Công việc này |
| Thưởng giới thiệu bạn bè (mới) | Dùng quan hệ giới thiệu đã có | Một khoản cố định, một lần cho mỗi người được giới thiệu, khi đơn đầu tiên đạt điều kiện hoàn tất | Công việc này |

Một người có thể vừa là người giới thiệu, vừa là nhân viên kinh doanh, vừa là cộng tác viên; mỗi vai trò nhận phần của mình theo quy tắc riêng.

## 3. Phạm vi

Trong phạm vi:
- Cộng tác viên: đăng ký trên ứng dụng, duyệt trên web, nhãn KOL, KOC, tạm ngừng; mã cộng tác viên; đường dẫn sản phẩm; ghi nhận lượt bấm; hoa hồng cộng tác viên (mức thứ sáu trong thiết lập hoa hồng sản phẩm); thống kê của tôi.
- Thưởng giới thiệu bạn bè: cài đặt, cộng ví hoa hồng, hạch toán; màn hình Mời bạn bè.
- Mua chung: cài đặt bậc giá theo biến thể; mở nhóm (cộng tác viên, KOL, KOC trên ứng dụng; nhân viên VComm trên web); tham gia bằng đơn trả trước; chốt nhóm, sửa giá theo bậc đạt được, hoàn tiền dư; hủy nhóm khi không đạt mốc tối thiểu.
- Ví mua sắm: nhận tiền hoàn của mua chung, dùng trả đơn VComm sau; không nạp, không rút, không chuyển.
- Bảng tin: bài đăng có ảnh, gắn sản phẩm; bài đánh giá gắn dòng đơn đã giao (nhãn "Đã mua hàng", điểm sao hiện ở trang sản phẩm); bài của VComm, ghim; bình luận một cấp; thích; báo cáo vi phạm; kiểm duyệt (ẩn, hiện lại, khóa quyền đăng); từ cấm; công tắc tắt đăng bài, bình luận.

Ngoài phạm vi: hoa hồng theo ngành hàng, chương trình riêng cho KOL, KOC (CONG_VIEC sau, MODULE_10 phần 2); thông báo đẩy về điện thoại; nhắn tin giữa người dùng; theo dõi người dùng; video; nạp, rút, chuyển ví mua sắm; nhà bán bên ngoài.

## 4. Yêu cầu nghiệp vụ và chức năng

- YCAU_NGHIEPVU_78: Người mua được đăng ký làm cộng tác viên; VComm duyệt, gắn nhãn KOL, KOC.
- YCAU_NGHIEPVU_79: Cộng tác viên chia sẻ đường dẫn sản phẩm và nhận hoa hồng trên đơn phát sinh từ đường dẫn, không ảnh hưởng hoa hồng giới thiệu, đội kinh doanh.
- YCAU_NGHIEPVU_80: Người giới thiệu nhận thưởng một lần khi bạn được mời có đơn đầu tiên đạt điều kiện.
- YCAU_NGHIEPVU_81: Mua chung: nhóm do cộng tác viên, KOL, KOC hoặc VComm mở; giá theo bậc tổng số lượng; trả trước toàn bộ; chốt giá theo bậc đạt được, hoàn tiền dư; không đạt mốc tối thiểu thì hủy nhóm.
- YCAU_NGHIEPVU_82: Tiền hoàn của mua chung vào ví mua sắm của người mua, dùng trả đơn sau.
- YCAU_NGHIEPVU_83: Bảng tin cộng đồng mở: người mua đăng bài, bình luận, thích; đánh giá đã mua hàng.
- YCAU_NGHIEPVU_84: VComm hậu kiểm nội dung: báo cáo vi phạm, ẩn, khóa quyền đăng, từ cấm, tắt toàn hệ thống.
- YCAU_NGHIEPVU_85: Không dùng.

- CHUC_NANG_171: Cộng tác viên và thưởng giới thiệu bạn bè.
- CHUC_NANG_172: Mua chung.
- CHUC_NANG_173: Ví mua sắm.
- CHUC_NANG_174: Bảng tin cộng đồng và kiểm duyệt.

## 5. Quy tắc nghiệp vụ

- QUYTAC_NGHIEPVU_324 Cộng tác viên: người mua đang hoạt động gửi đăng ký (đồng ý điều khoản cộng tác viên, kênh chia sẻ chính 0 đến 200 ký tự); mỗi người một hồ sơ. Trạng thái: Chờ duyệt → Đã duyệt hoặc Từ chối (lý do 1 đến 500 ký tự; người mua gửi lại được) ; Đã duyệt → Tạm ngừng (lý do) → Đã duyệt. Người có `marketplace.buyer.manage` tại công ty vận hành sàn duyệt, từ chối, tạm ngừng, khôi phục, gắn nhãn (không nhãn, KOL, KOC; chỉ cộng tác viên đã duyệt). Duyệt lần đầu cấp mã cộng tác viên 8 ký tự (chữ in hoa, chữ số, bỏ 0, O, 1, I), không đổi. Mọi thao tác theo phiên bản, ghi lịch sử, báo người mua bằng thông báo trong ứng dụng.
- QUYTAC_NGHIEPVU_325 Đường dẫn và lượt bấm: đường dẫn `<địa chỉ ứng dụng>/p/<mã sản phẩm>?ctv=<mã cộng tác viên>`. Người mua đã đăng nhập mở đường dẫn thì ghi lượt bấm (người mua, cộng tác viên, sản phẩm, thời điểm bấm gần nhất; một dòng cho mỗi bộ ba, bấm lại cập nhật thời điểm); chưa đăng nhập thì ứng dụng giữ mã và ghi khi đăng nhập, đăng ký xong trong cùng lần mở. Không ghi khi: mã không tồn tại, cộng tác viên không ở trạng thái Đã duyệt, người mở là chính cộng tác viên, sản phẩm không đăng bán. Mỗi người mua tối đa 200 lượt ghi mỗi ngày.
- QUYTAC_NGHIEPVU_326 Hoa hồng cộng tác viên: thiết lập hoa hồng sản phẩm (QUYTAC_NGHIEPVU_200) thêm mức "cộng tác viên" (mặc định 0); điều kiện tổng mức áp dụng cho cả sáu mức. Lúc đặt đơn, mỗi dòng không phải quà tặng: đơn thuộc nhóm mua chung do cộng tác viên mở thì người hưởng là người mở nhóm; ngược lại là cộng tác viên có lượt bấm gần nhất với sản phẩm đó trong 168 giờ trước lúc đặt. Người hưởng phải đang Đã duyệt và khác người mua. Phần này chụp vào đơn và tính, cộng ví hoa hồng như các phần khác (QUYTAC_NGHIEPVU_202), độc lập với phần giới thiệu, đội kinh doanh. Tạm ngừng không làm mất phần đã chụp vào đơn.
- QUYTAC_NGHIEPVU_327 Thưởng giới thiệu bạn bè: cài đặt của công ty vận hành sàn (bật, tắt; mức thưởng 1 đến 10.000.000 đồng; giá trị hoàn tất tối thiểu ≥ 0) do người có `marketplace.order.manage` sửa, theo phiên bản. Đơn đặt chụp người giới thiệu của người mua lúc đặt. Khi đơn chuyển Hoàn tất: chương trình đang bật, đơn có người giới thiệu, giá trị hoàn tất ≥ mức tối thiểu, người mua chưa từng làm phát sinh thưởng thì cộng mức thưởng hiện tại vào ví hoa hồng của người giới thiệu đã chụp (giao dịch "thưởng giới thiệu", gắn đơn). Mỗi người được giới thiệu phát sinh tối đa một lần thưởng. Hạch toán như hoa hồng (Nợ chi phí hoa hồng / Có phải trả hoa hồng), số bút toán `<số đơn>-TG`.
- QUYTAC_NGHIEPVU_328 Cài đặt mua chung: theo biến thể đang bán (QUYTAC_NGHIEPVU_155), người có `marketplace.order.manage` cài: bật, tắt; 1 đến 5 bậc, mỗi bậc "từ tổng số lượng N" (nguyên, bậc 1 ≥ 2, tăng dần) và đơn giá gồm thuế (> 0, giảm dần; bậc 1 không cao hơn giá bán hiện tại); thời hạn nhóm tối đa 1 đến 168 giờ; số lượng tối đa mỗi người mỗi nhóm 1 đến 999. Theo phiên bản. Nhóm chụp cài đặt lúc mở nên sửa cài đặt không đổi nhóm đang mở.
- QUYTAC_NGHIEPVU_329 Mở nhóm: cộng tác viên Đã duyệt (gồm KOL, KOC) trên ứng dụng, tối đa 5 nhóm đang mở mỗi người; người có `marketplace.order.manage` trên web. Chọn biến thể đang bật mua chung và thời hạn (1 giờ đến thời hạn tối đa). Nhóm: Đang mở → Thành công hoặc Thất bại; người có `marketplace.order.manage` hủy nhóm đang mở (lý do) thì xử lý như Thất bại. Mỗi nhóm có đường dẫn chia sẻ.
- QUYTAC_NGHIEPVU_330 Tham gia nhóm: nhóm Đang mở, chưa hết hạn, chưa mở đặt hàng thì như QUYTAC_NGHIEPVU_158. Đơn một dòng (biến thể của nhóm), số lượng cộng các đơn chưa hủy của người đó trong nhóm không vượt số tối đa mỗi người; đơn giá bậc 1, không khuyến mãi; phí giao hàng như đơn thường tại lúc đặt. Trả trước toàn bộ: phương thức trực tuyến đang bật, ví mua sắm, hoặc ví mua sắm cộng phương thức trực tuyến; không thanh toán khi nhận hàng. Đơn Chờ thanh toán (giữ hàng, hạn 15 phút, QUYTAC_NGHIEPVU_165), thu đủ thì sang Chờ chốt nhóm. Số lượng của nhóm = tổng số lượng các đơn Chờ chốt nhóm. Người mua hủy được đơn Chờ chốt nhóm khi nhóm còn mở (lý do): nhả hàng, hoàn toàn bộ tiền đã thu vào ví mua sắm.
- QUYTAC_NGHIEPVU_331 Chốt nhóm: việc nền mỗi phút xét nhóm hết hạn. Đơn còn Chờ thanh toán thì hủy (bên hủy hệ thống, lý do "Nhóm mua chung đã kết thúc"). Số lượng nhóm < N bậc 1: nhóm Thất bại, hủy mọi đơn (lý do "Nhóm mua chung không đủ số lượng"), nhả hàng, hoàn toàn bộ tiền đã thu vào ví mua sắm. Ngược lại nhóm Thành công, giá chốt = đơn giá bậc có N lớn nhất không vượt số lượng nhóm; mỗi đơn: sửa đơn giá dòng đơn bán thành giá chốt, tính lại tiền hàng (phí giao hàng giữ nguyên), cộng phần đã thu dư vào ví mua sắm (giao dịch "chênh lệch mua chung"), đơn sang Chờ giao. Mọi người tham gia nhận thông báo kết quả. Một nhóm lỗi không chặn nhóm khác. Hoàn tiền vào ví mua sắm không lập việc chờ hoàn ngân hàng.
- QUYTAC_NGHIEPVU_332 Ví mua sắm: mỗi người mua một ví, tách ví hoa hồng; số dư ≥ 0, chỉ đổi qua giao dịch ví (hoàn mua chung, chênh lệch mua chung, trả đơn, hoàn lại khi hủy đơn) có khóa dòng ví; không sửa, xóa giao dịch; không nạp, rút, chuyển; không hết hạn. Khi đặt mọi đơn VComm người mua chọn dùng ví: trừ tối đa tổng thanh toán của đơn, phần còn lại theo phương thức đã chọn (đơn thường: thanh toán khi nhận hàng hoặc trực tuyến; ví đủ trả toàn bộ thì không cần phương thức khác). Phần trả bằng ví ghi đã thu ngay trong sổ thanh toán đơn. Đơn bị hủy: phần trả bằng ví hoàn về ví; phần trực tuyến của đơn thường theo QUYTAC_NGHIEPVU_168. Hạch toán: số dư ví là tiền người mua trả trước trên phải thu khách hàng (131, không đối tác) nên trả bằng ví, hoàn vào ví không sinh bút toán mới; tiền trực tuyến vẫn hạch toán khi cổng báo thành công.
- QUYTAC_NGHIEPVU_333 Bài đăng: người mua đang hoạt động, không bị khóa đăng, công tắc đăng bài đang bật; nội dung 1 đến 2.000 ký tự, 0 đến 5 ảnh (JPEG, PNG, kiểm theo nội dung tệp, tối đa 5 MB), gắn 0 đến 3 sản phẩm đang bán. Bài đánh giá: gắn một dòng đơn của chính mình (không phải quà tặng) ở đơn Đã giao hoặc Hoàn tất, 1 đến 5 sao; mỗi dòng đơn một đánh giá; nhãn "Đã mua hàng"; trang sản phẩm hiện điểm trung bình, số đánh giá đang hiện. Bài của VComm do người có `marketplace.community.manage` đăng trên web, nhãn "VComm", ghim tối đa 3 bài. Bảng tin: bài ghim trước, còn lại mới nhất trước; lọc theo sản phẩm. Tác giả xóa bài của mình (ẩn vĩnh viễn), không sửa.
- QUYTAC_NGHIEPVU_334 Bình luận, thích, giới hạn: bình luận một cấp 1 đến 1.000 ký tự, không ảnh, khi công tắc bình luận bật và không bị khóa; tác giả xóa được. Thích bài: bật, tắt, mỗi người một lần mỗi bài. Mỗi người tối đa 10 bài, 100 bình luận mỗi ngày (giờ Việt Nam). Từ cấm: danh sách tối đa 500 cụm từ (không phân biệt hoa thường, dấu); bài, bình luận chứa từ cấm bị từ chối với thông báo chung.
- QUYTAC_NGHIEPVU_335 Báo cáo và kiểm duyệt: người dùng báo cáo bài, bình luận của người khác (lý do: quảng cáo rác, lừa đảo, xúc phạm, nội dung cấm, khác; mô tả 0 đến 500 ký tự), mỗi người một lần mỗi nội dung. Nội dung có từ 5 báo cáo chờ xử lý tự ẩn tạm. Người có `marketplace.community.manage`: ẩn (lý do), hiện lại, bỏ qua báo cáo; khóa đăng bài và bình luận của tài khoản 1 đến 365 ngày hoặc vĩnh viễn (lý do), mở khóa; sửa từ cấm; bật, tắt đăng bài, bình luận của người mua (tắt thì nội dung cũ vẫn hiện). Tác giả nhận thông báo khi nội dung bị ẩn, tài khoản bị khóa. Mọi thao tác ghi nhật ký.
- QUYTAC_NGHIEPVU_390 Khóa ví mua sắm toàn hệ thống (THAY_DOI_22): công tắc trong cài đặt của công ty vận hành sàn, người có `marketplace.order.manage` bật, tắt, theo phiên bản, ghi nhật ký. Đang khóa: không ai dùng được số dư ví mua sắm để trả đơn; mua hàng, mua chung vẫn chạy bình thường; tiền hoàn, tiền dư mua chung vẫn cộng vào ví (số dư giữ nguyên, dùng lại được khi mở khóa). Ứng dụng hiện "Ví mua sắm đang tạm khóa".
- QUYTAC_NGHIEPVU_391 Chặn ví theo từng tài khoản (THAY_DOI_22): hai công tắc độc lập cho mỗi người mua, chặn ví nào thì chỉ ảnh hưởng ví đó. Chặn ví mua sắm: không dùng số dư ví mua sắm để trả đơn (vẫn nhận tiền hoàn). Chặn ví hoa hồng: không tạo được yêu cầu rút tiền mới; yêu cầu chờ duyệt bị tự từ chối với lý do là lý do chặn, tiền trả lại ví hoa hồng, báo người dùng; yêu cầu đã duyệt chưa chi không ghi được đã chi cho đến khi gỡ chặn (kế toán vẫn thấy, có cảnh báo). Người có `marketplace.payment.manage` tại công ty vận hành sàn chặn hoặc gỡ chặn, bắt buộc lý do 1 đến 500 ký tự, theo phiên bản, ghi lịch sử và nhật ký thao tác, báo người dùng bằng thông báo trong ứng dụng. Phần chặn ví hoa hồng là thay đổi chức năng đã phát hành của CONG_VIEC_26 (QUYTAC_NGHIEPVU_204, 206).

## 6. Vai trò và quyền

- Quyền mới `marketplace.community.manage` (nhạy cảm): kiểm duyệt bảng tin, đăng bài VComm, từ cấm, công tắc.
- Dùng lại `marketplace.buyer.manage` (duyệt cộng tác viên, gắn nhãn), `marketplace.buyer.view` (xem), `marketplace.order.manage` (thưởng giới thiệu, mua chung), `marketplace.order.view` (xem nhóm).
- Quản trị tập đoàn, quản trị công ty có sẵn quyền mới. Chỉ dùng tại công ty vận hành sàn.
- Người mua dùng API người mua, chỉ thấy hồ sơ cộng tác viên, ví, đơn của chính mình; bảng tin công khai cho người mua đã đăng nhập.

## 7. Luồng nghiệp vụ

- Luồng cộng tác viên: đăng ký → duyệt (mã) → chia sẻ đường dẫn → người mua bấm (ghi lượt) → đặt trong 7 ngày (chụp phần cộng tác viên) → đơn hoàn tất (cộng ví hoa hồng) → rút tiền như CONG_VIEC_26.
- Luồng thưởng giới thiệu: người được giới thiệu đặt đơn (chụp người giới thiệu) → đơn hoàn tất đạt mức → cộng thưởng một lần.
- Luồng mua chung: VComm cài bậc giá → cộng tác viên mở nhóm, chia sẻ → người mua đặt đơn trả trước (Chờ thanh toán → Chờ chốt nhóm) → hết hạn: đạt mốc thì sửa giá, hoàn dư vào ví mua sắm, đơn Chờ giao, giao như đơn thường; không đạt thì hủy, hoàn toàn bộ vào ví mua sắm.
- Luồng bảng tin: đăng bài, bình luận → người khác báo cáo → đủ 5 báo cáo thì ẩn tạm → VComm ẩn hoặc hiện lại, khóa tài khoản vi phạm.

## 8. Màn hình

Ứng dụng VComm:
- MAN_HINH_132 Cộng tác viên: đăng ký (điều khoản), trạng thái, mã, nhãn; thống kê (lượt bấm, số đơn, hoa hồng cộng tác viên đang chờ, đã cộng); nút chia sẻ đường dẫn ở trang sản phẩm (sửa MAN_HINH_91).
- MAN_HINH_133 Mời bạn bè: đường dẫn, mã giới thiệu, mức thưởng hiện tại, danh sách người đã mời (tên, số che, ngày đăng ký, trạng thái thưởng).
- MAN_HINH_134 Mua chung: danh sách nhóm đang mở (ảnh, tên, bậc giá, số lượng hiện tại, còn lại bao lâu), chi tiết nhóm (thanh tiến độ theo bậc, tham gia, chia sẻ), mở nhóm (cộng tác viên), nhóm của tôi; đặt đơn mua chung dùng lại MAN_HINH_93 với chọn ví mua sắm.
- MAN_HINH_135 Ví mua sắm: số dư, lịch sử; chọn dùng ví ở MAN_HINH_93.
- MAN_HINH_136 Bảng tin (thẻ mới): danh sách bài, đăng bài (ảnh, gắn sản phẩm), viết đánh giá từ chi tiết đơn, chi tiết bài với bình luận, thích, báo cáo; điểm đánh giá ở MAN_HINH_91.

Web-crm:
- MAN_HINH_137 Cộng tác viên: danh sách (lọc trạng thái, nhãn, tìm số điện thoại), chi tiết (duyệt, từ chối, tạm ngừng, khôi phục, gắn nhãn, lịch sử, thống kê); thẻ Thưởng giới thiệu (cài đặt); sửa MAN_HINH thiết lập hoa hồng sản phẩm thêm mức cộng tác viên.
- MAN_HINH_138 Mua chung: cài đặt theo biến thể (bậc giá), danh sách nhóm (lọc trạng thái), chi tiết nhóm (đơn tham gia, số lượng, giá chốt), mở nhóm, hủy nhóm.
- Sửa MAN_HINH_80 (chi tiết người mua): chặn, gỡ chặn ví mua sắm, ví hoa hồng kèm lý do, lịch sử (THAY_DOI_22). Cài đặt khóa ví mua sắm ở MAN_HINH_138 (thẻ Cài đặt).
- MAN_HINH_139 Kiểm duyệt cộng đồng: hàng chờ báo cáo, nội dung đã ẩn, tài khoản bị khóa, bài VComm (đăng, ghim), từ cấm, công tắc.

## 9. Dữ liệu và API

### 9.1 Database migration

0079 cộng tác viên, thưởng giới thiệu:
- `marketplace.collaborators` (người dùng khóa chính, công ty vận hành sàn, mã duy nhất có thể trống đến khi duyệt, trạng thái `pending`, `approved`, `rejected`, `suspended`, nhãn `kol`, `koc` hoặc trống, kênh chia sẻ, phiên bản điều khoản, lý do, thời điểm gửi, người và thời điểm xét, phiên bản).
- `marketplace.collaborator_history` (hành động `submit`, `approve`, `reject`, `suspend`, `restore`, `label`; lý do; người; thời điểm).
- `marketplace.collaborator_clicks` (người mua, cộng tác viên, sản phẩm, lần bấm gần nhất; khóa chính ba cột; chỉ mục theo người mua, sản phẩm, thời điểm).
- `marketplace.product_commissions.collaborator` numeric ≥ 0 mặc định 0; ràng buộc tổng phần trăm sáu mức ≤ 100.
- `marketplace.order_commissions.share` thêm `collaborator`.
- `marketplace.orders.referrer_user_id` (chụp lúc đặt; đơn cũ để trống), `marketplace.orders.collaborator_user_id` không cần (đã ở dòng hoa hồng).
- `marketplace.referral_bonus_settings` (công ty, bật, mức thưởng, giá trị tối thiểu, người sửa, phiên bản).
- `marketplace.referral_bonuses` (người được giới thiệu khóa chính, người hưởng, đơn, số tiền, thời điểm) bảo đảm một lần.
- `marketplace.wallet_transactions.kind` thêm `referral_bonus` (gắn đơn; chỉ mục duy nhất người, đơn, loại).

0080 ví mua sắm:
- `marketplace.shopping_wallets` (người dùng, số dư ≥ 0, thời điểm).
- `marketplace.shopping_wallet_settings` (công ty, khóa ví, người sửa, phiên bản) (THAY_DOI_22).
- `marketplace.wallet_blocks` (người dùng, loại ví `shopping` hoặc `commission`, đang chặn, lý do, người, thời điểm, phiên bản; khóa chính người dùng và loại ví) và `marketplace.wallet_block_history` (THAY_DOI_22).
- `marketplace.shopping_wallet_transactions` (loại `group_buy_refund`, `group_buy_difference`, `order_payment`, `order_refund`, `return_refund`; số tiền khác 0; số dư sau; đơn; ghi chú; thời điểm).
- `marketplace.orders.wallet_amount` (trả bằng ví lúc đặt, ≥ 0), `wallet_refunded_amount` (đã hoàn về ví, ≤ `wallet_amount` cộng phần hoàn tiền mặt vào ví của đơn mua chung). `paid_amount` giữ nghĩa cũ: tiền thu qua cổng hoặc COD. Tiền trực tuyến phải trả = tiền hàng + phí giao hàng − `wallet_amount`; tiền thu hộ = phần còn lại khi chọn COD.

0081 mua chung:
- `marketplace.group_buy_settings` (biến thể khóa chính, công ty, bật, thời hạn tối đa giờ, tối đa mỗi người, người sửa, phiên bản) và `group_buy_setting_tiers` (biến thể, thứ tự, từ số lượng, đơn giá gồm thuế).
- `marketplace.group_buys` (biến thể, người mở, loại người mở `collaborator` hoặc `staff`, trạng thái `open`, `succeeded`, `failed`, `cancelled`, bắt đầu, kết thúc, bậc chụp dạng jsonb, tối đa mỗi người, số lượng chốt, giá chốt, lý do hủy, thời điểm chốt, phiên bản).
- `marketplace.orders.group_buy_id`; trạng thái đơn thêm `awaiting_group`; chỉ mục nhóm, trạng thái.

0082 bảng tin:
- `marketplace.posts` (tác giả, loại `member`, `review`, `official`, nội dung, sao, dòng đơn được đánh giá (duy nhất), trạng thái `visible`, `auto_hidden`, `hidden`, `deleted`, ghim, lý do ẩn, số thích, số bình luận, thời điểm).
- `marketplace.post_images`, `marketplace.post_products` (tối đa 3), `marketplace.post_comments` (trạng thái như bài), `marketplace.post_likes` (khóa chính bài, người).
- `marketplace.content_reports` (bài hoặc bình luận, người báo, lý do, mô tả, trạng thái `pending`, `resolved`, `dismissed`; duy nhất người, nội dung).
- `marketplace.community_bans` (người, đến lúc hoặc vĩnh viễn, lý do, người khóa, gỡ lúc).
- `marketplace.community_settings` (công ty, cho đăng bài, cho bình luận, từ cấm mảng văn bản, phiên bản).
- Quyền `marketplace.community.manage`.

### 9.2 API (đường dẫn sau `/api/v1`)

- API_162 cộng tác viên, mời bạn bè (người mua): `GET`, `POST /buyer/collaborator` (xem, gửi đăng ký); `POST /buyer/collaborator/clicks` (mã cộng tác viên, sản phẩm); `GET /buyer/collaborator/orders`; `GET /buyer/invitations` (thưởng hiện tại, người đã mời và trạng thái thưởng).
- API_163 quản trị cộng tác viên, thưởng giới thiệu: `GET /marketplace/collaborators`, `GET /marketplace/collaborators/{userId}`; `POST .../approve`, `/reject`, `/suspend`, `/restore`, `PUT .../label`; `GET`, `PUT /marketplace/referral-bonus-settings`. Thiết lập hoa hồng sản phẩm (API của CONG_VIEC_26) thêm trường `collaborator`.
- API_164 mua chung (người mua): `GET /buyer/group-buys` (đang mở; lọc sản phẩm; nhóm của tôi), `GET /buyer/group-buys/{id}`, `POST /buyer/group-buys` (cộng tác viên mở), `GET /buyer/group-buy-options` (biến thể bật mua chung). Đặt đơn dùng `POST /buyer/orders` và xem trước thêm `groupBuyId`, `useShoppingWallet`.
- API_165 mua chung (quản trị): `GET`, `PUT /marketplace/group-buy-settings/{variantId}`, `GET /marketplace/group-buy-settings`; `GET`, `POST /marketplace/group-buys`, `GET /marketplace/group-buys/{id}`, `POST /marketplace/group-buys/{id}/cancel`.
- API_166 ví mua sắm: `GET /buyer/shopping-wallet` (số dư, lịch sử phân trang, trạng thái khóa, chặn); quản trị `GET`, `PUT /marketplace/shopping-wallet-settings` (công tắc khóa); `GET /marketplace/buyers/{id}/wallet-blocks`, `PUT /marketplace/buyers/{id}/wallet-blocks/{shopping|commission}` (chặn, gỡ chặn, lý do). Rút tiền hoa hồng (API_136) từ chối tạo yêu cầu, ghi đã chi khi ví hoa hồng bị chặn.
- API_167 bảng tin (người mua): `GET /buyer/posts` (lọc sản phẩm), `GET /buyer/posts/{id}`, `POST /buyer/posts`, `DELETE /buyer/posts/{id}`; `GET`, `POST /buyer/posts/{id}/comments`, `DELETE /buyer/comments/{id}`; `PUT`, `DELETE /buyer/posts/{id}/like`; `POST /buyer/reports`; `GET /buyer/community` (công tắc, tình trạng khóa của tôi); `GET /buyer/shop/products/{id}` thêm điểm đánh giá.
- API_168 kiểm duyệt (quản trị): `GET /marketplace/community/reports`, `POST /marketplace/community/posts/{id}/hide`, `/show`, `POST /marketplace/community/comments/{id}/hide`, `/show`, `POST /marketplace/community/reports/dismiss`; `GET`, `POST /marketplace/community/bans`, `POST /marketplace/community/bans/{id}/lift`; `GET`, `PUT /marketplace/community/settings`; `POST /marketplace/community/posts` (bài VComm), `PUT /marketplace/community/posts/{id}/pin`.
- API_169 ảnh bài đăng: `POST /buyer/posts/images` (tải lên trước khi đăng, kiểm nội dung tệp), `GET /buyer/posts/images/{id}`.
- Việc nền mỗi phút: chốt nhóm mua chung hết hạn (mỗi lần tối đa 100 nhóm).

### 9.3 Quyết định thiết kế kèm theo

- Phần trả bằng ví ghi ở `wallet_amount`, không qua bảng thanh toán cổng; các luồng hoàn tiền ngân hàng hiện có chỉ xét tiền mặt (`paid_amount`), phần ví hoàn về ví.
- Đơn mua chung: mọi tiền hoàn khi hủy (do người mua, nhóm thất bại, nhóm bị hủy, hết hạn thanh toán sau khi đã trả một phần ví) vào ví mua sắm. Hoàn hàng trả sau khi giao: phần tiền mặt theo QUYTAC_NGHIEPVU_168, phần vượt tiền mặt hoàn về ví.
- Đơn giá mua chung: dòng đơn bán lập với giá bảng giá thay bằng đơn giá bậc (gồm thuế), không khuyến mãi; chốt nhóm sửa đơn giá, tiền dòng, tổng đơn bán trước khi xuất kho nên doanh thu, hóa đơn theo giá chốt.
- Tiền về từ cổng sau khi đơn mua chung đã hủy: theo luồng cũ (việc chờ hoàn ngân hàng).

## 10. Điều kiện đặc biệt và rủi ro

- Ví mua sắm giữ tiền của người mua: có thể bị coi là ví điện tử cần giấy phép trung gian thanh toán. Người dùng chọn ví mua sắm ngày 2026-11-11 khi đã được cảnh báo. Không phát hành lên môi trường thật trước khi có ý kiến luật sư (bổ sung vào mục CHƯA XÁC ĐỊNH của tài liệu `04`).
- Bảng tin mở cho người dùng đăng bài, bình luận có thể thuộc diện mạng xã hội phải có giấy phép. Có công tắc tắt đăng bài, bình luận của người mua; không phát hành phần mở trước khi có ý kiến luật sư.
- Cộng tác viên một tầng, không hoa hồng theo cây (tài liệu `05` mục 3).
- Chưa đối chiếu điều khoản văn bản pháp luật trong phiên này.

## 11. Tiêu chí nghiệm thu

| Mã | Nội dung | Mức |
|---|---|---|
| TIEUCHI_NGHIEMTHU_311 | Đăng ký, duyệt, từ chối, tạm ngừng, khôi phục, gắn nhãn cộng tác viên đúng trạng thái, quyền, phiên bản; cấp mã khi duyệt lần đầu | Bắt buộc |
| TIEUCHI_NGHIEMTHU_312 | Lượt bấm đường dẫn ghi đúng điều kiện; đơn trong 168 giờ chụp phần cộng tác viên của lượt gần nhất; tự mua, quá hạn, chưa duyệt không có phần; phần giới thiệu, đội kinh doanh không đổi | Bắt buộc |
| TIEUCHI_NGHIEMTHU_313 | Thưởng giới thiệu cộng một lần đúng mức, đúng người, có bút toán; không thưởng khi tắt, dưới mức, đã thưởng | Bắt buộc |
| TIEUCHI_NGHIEMTHU_314 | Cài đặt mua chung kiểm đúng bậc giá; mở nhóm đúng người, giới hạn 5 nhóm; nhóm chụp cài đặt | Bắt buộc |
| TIEUCHI_NGHIEMTHU_315 | Tham gia nhóm: trả trước, giá bậc 1, giới hạn mỗi người, không COD; hủy khi nhóm mở hoàn vào ví | Bắt buộc |
| TIEUCHI_NGHIEMTHU_316 | Chốt nhóm: thành công sửa giá theo bậc, hoàn dư vào ví, đơn Chờ giao, hoa hồng tính trên giá chốt; thất bại hủy, hoàn toàn bộ; đơn chưa thanh toán bị hủy | Bắt buộc |
| TIEUCHI_NGHIEMTHU_317 | Ví mua sắm: số dư không âm, trả đơn một phần hoặc toàn bộ, hoàn về ví khi hủy, không có cách rút; đồng thời không trừ quá số dư | Bắt buộc |
| TIEUCHI_NGHIEMTHU_318 | Bảng tin: đăng bài, ảnh, gắn sản phẩm, đánh giá chỉ cho dòng đơn đã giao của mình, bình luận, thích, giới hạn ngày, từ cấm, công tắc | Bắt buộc |
| TIEUCHI_NGHIEMTHU_319 | Báo cáo, tự ẩn ở 5 báo cáo, ẩn, hiện lại, khóa, mở khóa; người bị khóa không đăng được; thông báo tác giả | Bắt buộc |
| TIEUCHI_NGHIEMTHU_367 | Khóa ví mua sắm toàn hệ thống chặn dùng số dư, không chặn mua hàng, mua chung, tiền hoàn vẫn vào ví; chặn từng ví theo tài khoản độc lập; chặn ví hoa hồng tự từ chối yêu cầu chờ duyệt, chặn tạo yêu cầu mới và ghi đã chi; lý do, lịch sử, quyền | Bắt buộc |
| TIEUCHI_NGHIEMTHU_320 | Giao diện ứng dụng và web đạt danh sách rà soát giao diện, chuỗi trong tệp dịch vi, en | Bắt buộc |

## 12. Kịch bản kiểm thử

KICHBAN_KIEMTHU_464 đến 475 và KICHBAN_KIEMTHU_532 (khóa, chặn ví; THAY_DOI_22) (đúng, sai, biên, từng vai trò), lập ở cổng kiểm thử: 464 cộng tác viên trạng thái; 465 lượt bấm và phần cộng tác viên; 466 thưởng giới thiệu; 467 cài đặt mua chung; 468 mở nhóm; 469 tham gia nhóm; 470 chốt nhóm thành công; 471 chốt nhóm thất bại, hết hạn thanh toán; 472 ví mua sắm và đồng thời; 473 bài đăng, đánh giá; 474 bình luận, thích, giới hạn, từ cấm; 475 báo cáo, kiểm duyệt, phân quyền công ty.

## 13. Ràng buộc kỹ thuật

- Dùng lại: đặt hàng, giữ hàng, cổng thanh toán, hủy đơn (CONG_VIEC_24, 25); chụp và cộng hoa hồng, ví hoa hồng, bút toán (CONG_VIEC_26); kiểm ảnh theo nội dung tệp (trả hàng); thông báo trong ứng dụng; việc nền.
- Tiền `numeric`, làm tròn đến đồng; mọi thao tác ví khóa dòng ví.
- Mọi truy vấn lọc theo công ty vận hành sàn; người mua chỉ thấy dữ liệu của mình (trừ bảng tin công khai).

## 14. Thành phần không được thay đổi

Cách tính hoa hồng giới thiệu, đội kinh doanh; luồng rút tiền, thuế, phí; luồng hoàn tiền ngân hàng của đơn thường; trạng thái, hành vi của đơn không mua chung.

## 15. Các lát và điểm xem trước

| Lát | Nội dung | Điểm xem trước |
|---|---|---|
| L1 | Migration 0079; cộng tác viên, lượt bấm, phần cộng tác viên, thưởng giới thiệu; MAN_HINH_132, 133, 137 | Đăng ký, duyệt, đặt đơn qua đường dẫn, thấy phần cộng tác viên; thưởng sau hoàn tất |
| L2 | Migration 0080, 0081; ví mua sắm (gồm khóa toàn hệ thống, chặn từng ví theo tài khoản, THAY_DOI_22), mua chung; MAN_HINH_134, 135, 138, sửa MAN_HINH_80 | Mở nhóm, tham gia, chốt thành công và thất bại, ví, khóa và chặn ví |
| L3 | Migration 0082; bảng tin, kiểm duyệt; MAN_HINH_136, 139 | Đăng bài, đánh giá, báo cáo, ẩn, khóa |

Mỗi lát: kiểm thử tự động API, ảnh chụp ứng dụng (bản web của Expo) và web-crm.

## 16. Kết quả đối chiếu định nghĩa hoàn thành

Đối chiếu ngày 2026-11-11 trước khi trình nghiệm thu:

- Phân tích, đặc tả, bản mẫu giao diện, thiết kế dữ liệu và API: người dùng duyệt từng cổng (mục 17).
- Ba lát L1, L2, L3 xong; người dùng duyệt xem trước từng lát (ảnh chụp ứng dụng bản web và web-crm).
- Kiểm thử tự động: KICHBAN_KIEMTHU_464 đến 475, 532 trong `apps/api/test/c49-collaborators.test.ts`, `c49-group-buys-wallets.test.ts`, `c49-community.test.ts` đạt; toàn bộ `pnpm --filter api test` 55 tệp, 346 kiểm thử đạt. TIEUCHI_NGHIEMTHU_320 (giao diện) kiểm bằng xem trước thủ công.
- Kiểm tra kiểu api, web-crm, mobile-vcomm đạt; lint mobile-vcomm đạt; tệp dịch khớp khóa.
- Rà soát mã trước khi trình: sửa lỗi "Hiện lại, bỏ qua báo cáo" với nội dung đang hiện (commit `cdecf24`).
- Bảo mật: không thêm phụ thuộc; quét bí mật lịch sử nhánh không có phát hiện (khóa ký VNPAY giả của kiểm thử ghi vào `.github/gitleaksignore` theo tiền lệ CONG_VIEC_25).
- Tài liệu 06, 07, 08, 09 (Luồng 44), 10, 11, 14, 16, 17, 21, 22, 27 đã cập nhật trên nhánh; sổ 02, 03, 25 gửi phiên cha ghi.

Điểm mã khác đặc tả mục 9 (tài liệu 17 ghi theo mã):
- API_168 dùng `GET /marketplace/community/moderation?view=reported|hidden`; bỏ qua báo cáo qua `POST .../{posts|comments}/{id}/show`; bài VComm ở `/marketplace/community/official-posts` (thêm `GET`) và `/official-posts/{id}/pin`; thêm `GET /marketplace/community/images/{id}`.
- API_167 không có `GET /buyer/posts/{id}/comments` (bình luận nằm trong chi tiết bài); thêm `GET /buyer/reviewable-lines`.
- Khóa ví mua sắm trên web ở thẻ riêng "Ví mua sắm" của MAN_HINH_138; khóa tài khoản cộng đồng trên web chọn 7 ngày, 30 ngày, vĩnh viễn (API nhận 1 đến 365 ngày).
- Quyết định AI tự đưa ra, ghi ở tài liệu 07 (chờ xác nhận khi nghiệm thu): tối đa 30 ảnh chưa đăng trong 24 giờ; bài đã xóa vẫn tính giới hạn 10 bài mỗi ngày; mở khóa cũng báo người dùng; nhân viên mở nhóm trên web không giới hạn số nhóm; người mở nhóm không còn Đã duyệt thì đơn không có phần cộng tác viên; gắn nhãn được cả khi cộng tác viên đang Tạm ngừng.

## 17. Quyết định của người dùng

- 2026-11-11: cộng tác viên theo đường dẫn sản phẩm, 7 ngày từ lần bấm cuối, mức hoa hồng thứ sáu, độc lập với giới thiệu và đội kinh doanh, không gắn khách, tự mua không có hoa hồng.
- 2026-11-11: thưởng giới thiệu bạn bè một lần vào ví hoa hồng khi đơn đầu tiên của người được giới thiệu hoàn tất và đạt giá trị tối thiểu; cài đặt bật tắt, mức thưởng, giá trị tối thiểu; màn hình Mời bạn bè.
- 2026-11-11: mua chung do quản trị, nhân viên VComm, KOL, KOC hoặc cộng tác viên mở; bậc giá theo tổng số lượng cấu hình được; bắt buộc trả trước 100%; kết phiên hoàn tiền dư vào ví; dưới mốc tối thiểu thì hủy nhóm.
- 2026-11-11: tiền dư, tiền hoàn mua chung vào ví mua sắm riêng (đã được cảnh báo rủi ro ví điện tử).
- 2026-11-11: cộng tác viên đăng ký trên ứng dụng, VComm duyệt trên web, gắn nhãn KOL, KOC; chỉ cộng tác viên đã duyệt nhận hoa hồng cộng tác viên.
- 2026-11-11: VComm cài bậc giá theo biến thể, người mở nhóm chỉ chọn sản phẩm và thời hạn, trả trước theo giá bậc đầu, chốt theo bậc đạt; người mở nhóm là cộng tác viên nhận hoa hồng cộng tác viên.
- 2026-11-11: bảng tin mạng xã hội mở (bài đăng tự do kèm sản phẩm, bình luận, thích, đánh giá đã mua); hiện ngay, hậu kiểm, báo vi phạm, khóa có thời hạn, từ cấm, công tắc tắt toàn hệ thống (đã được cảnh báo rủi ro giấy phép mạng xã hội).

- 2026-11-11 (qua phiên cha, THAY_DOI_22): thêm công tắc khóa ví mua sắm toàn hệ thống: khóa thì không thanh toán bằng ví, mua hàng và mua chung vẫn bình thường; chặn ví theo từng tài khoản, chặn ví nào chỉ không dùng được số dư ví đó, hai ví không liên thông; chặn ví hoa hồng thì yêu cầu rút chờ duyệt tự bị từ chối. Bảng tin giữ mở, hậu kiểm; hỏi luật sư sau; rủi ro giấy phép mạng xã hội và ví điện tử chặn triển khai môi trường thật.

## 18. Giới hạn đã biết

- Hai rủi ro pháp lý ở mục 10 chặn triển khai lên môi trường thật cho đến khi có ý kiến pháp lý (người dùng xác nhận 2026-11-11).
- Mã cho THAY_DOI_22 do phiên cha cấp ngoài dải: QUYTAC_NGHIEPVU_390, 391, TIEUCHI_NGHIEMTHU_367, KICHBAN_KIEMTHU_532; luồng nghiệp vụ tài liệu `09` dành riêng: Luồng 44.
- Mỗi dòng hàng chỉ đánh giá một lần kể cả khi người mua đã xóa bài đánh giá (không đánh giá lại được); bài và bình luận không sửa được, chỉ xóa.
- Ảnh bài đăng cần đăng nhập mới xem được; bản web của ứng dụng tải ảnh bằng header đăng nhập rồi hiện từ bộ nhớ trình duyệt.
- Chồng lấn CONG_VIEC_51 (điểm thưởng): đơn dùng được cả điểm và ví mua sắm, điểm trừ trước rồi đến ví; đơn mua chung không dùng điểm nhưng vẫn tích. Khấu trừ trả trước gom ở một hàm (`orderDeductions`) để ghép khi hợp nhất.
