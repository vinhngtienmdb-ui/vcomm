# CONG_VIEC_60: Điểm thưởng phần 2 (MODULE_11): liên minh điểm trong tập đoàn, chống gian lận nâng cao

- Mô tả: Kiểu chia chi phí điểm giữa các công ty trong tập đoàn; đối soát công nợ nội bộ phát sinh từ điểm hằng tháng, hai bên xác nhận, bù trừ, thanh toán phần còn lại; nhận biết thiết bị bằng mã cài đặt ứng dụng; bốn quy tắc chống gian lận có ngưỡng và mức xử lý cấu hình được; vụ việc gian lận; báo cáo liên minh và gian lận. Web quản trị (`apps/web-crm`, `apps/web-finance`) và ứng dụng VComm (`apps/mobile-vcomm`).
- Phiên bản: 0.1
- Ngày cập nhật: 2026-11-12
- Trạng thái: Đang thực hiện (người dùng duyệt đặc tả, bản mẫu và đề xuất mục 18 ngày 2026-11-12).
- Nguồn: tài liệu `01` (MODULE_11: đối soát liên minh, chống gian lận), `05` mục 2.3; CONG_VIEC_51 (sổ cái điểm, nợ nội bộ 1368/3368, QUYTAC_NGHIEPVU_354, 355); CONG_VIEC_53 lát L6 (bán, trả hàng tại quầy gọi service điểm); quyết định của người dùng ngày 2026-11-12 (mục 17).
- Mức: Lớn (sửa hạch toán điểm đang dùng, thêm bảng, quyền, loại phiếu thu chi, sửa ràng buộc dùng chung, nhiều module: điểm thưởng, tài chính, bán lẻ, ứng dụng).
- Phụ thuộc: CONG_VIEC_53 lát L6 (pull request #125, bản 0.6.0) cho nguồn bán tại quầy và quy tắc theo nhân viên.

## 1. Mục tiêu

Tập đoàn dùng chung một loại điểm ở mọi công ty con mà vẫn phân bổ được chi phí điểm theo cách tập đoàn chọn, công nợ nội bộ do điểm được đối soát, xác nhận, bù trừ hằng tháng; giảm gian lận điểm bằng quy tắc theo thiết bị, hành vi, nhân viên, có chặn khi cần và có hồ sơ xử lý.

## 2. Phạm vi

Trong phạm vi:
- Kiểu chia chi phí điểm (một kiểu cho cả tập đoàn, theo giai đoạn chương trình): nơi tích chịu, nơi dùng chịu, công ty vận hành sàn chịu; hạch toán theo kiểu.
- Bảng đối soát nội bộ hằng tháng giữa công ty vận hành sàn và từng công ty con có phát sinh; đối chiếu sổ hai bên; hai bên xác nhận hoặc khiếu nại; bù trừ 1368/3368; phiếu thu, phiếu chi nội bộ cho phần còn lại.
- Mã cài đặt ứng dụng VComm; liên kết thiết bị với tài khoản.
- Bốn quy tắc chống gian lận nâng cao: số tài khoản trên một thiết bị, đổi điểm dồn dập, tích rồi trả hàng lặp lại, giao dịch bất thường theo nhân viên; ngưỡng, mức xử lý (cảnh báo, chặn giao dịch, chặn và khóa ví).
- Vụ việc gian lận: ghi, xem xét, kết luận.
- Báo cáo liên minh (chi phí, công nợ theo công ty) và báo cáo gian lận.

Ngoài phạm vi:
- Đối tác liên minh ngoài tập đoàn (đổi điểm hai chiều qua API đối tác, đối tác mua điểm tặng khách): người dùng tách thành công việc riêng ngày 2026-11-12, đã đề nghị phiên cha ghi sổ.
- Cửa hàng liên kết ngoài tập đoàn (CONG_VIEC_55, đối soát tuần riêng).
- Mỗi công ty con phát hành loại điểm riêng, tỷ giá điểm giữa công ty (người dùng chọn giữ một điểm chung).
- Kiểu chia chi phí theo từng công ty hoặc từng cặp công ty.
- Dấu vân tay thiết bị bằng thư viện ngoài; thông báo đẩy.

## 3. Phân biệt với phần đã có (không trùng)

| Đối tượng | Bản chất | Nguồn |
|---|---|---|
| Nợ nội bộ từng giao dịch điểm | Bút toán 1368/3368 khi tích, dùng, hoàn, trừ lại tại quầy công ty con | CONG_VIEC_51 QUYTAC_NGHIEPVU_355 (giữ cho kiểu nơi tích chịu) |
| Cảnh báo bất thường cơ bản | Ba loại cảnh báo trong 90 ngày, chỉ cảnh báo, tính khi xem | CONG_VIEC_51 QUYTAC_NGHIEPVU_354 (giữ nguyên) |
| Khóa ví điểm | Quản trị khóa, mở tay | CONG_VIEC_51 QUYTAC_NGHIEPVU_352 (dùng lại khi tự khóa) |
| Đối soát cửa hàng liên kết | Đối tác ngoài, đối soát tuần | CONG_VIEC_55 (không chạm) |
| Đối soát thu hộ | Đơn vị vận chuyển thu hộ | CONG_VIEC_19 (mẫu tham khảo giao diện, không dùng chung bảng) |
| Liên minh nội bộ, chống gian lận nâng cao (mới) | Chia chi phí, đối soát tháng, quy tắc có chặn, vụ việc | Công việc này |

## 4. Yêu cầu nghiệp vụ và chức năng

- YCAU_NGHIEPVU_156: Chi phí điểm khi khách tích ở công ty này, dùng ở công ty khác trong tập đoàn được phân bổ theo kiểu tập đoàn chọn.
- YCAU_NGHIEPVU_157: Công nợ nội bộ phát sinh từ điểm được đối soát hằng tháng, hai bên xác nhận, bù trừ và thanh toán phần còn lại.
- YCAU_NGHIEPVU_158: Hệ thống nhận biết thiết bị dùng ứng dụng VComm để phát hiện nhiều tài khoản trên một thiết bị.
- YCAU_NGHIEPVU_159: Quy tắc chống gian lận nâng cao có ngưỡng và mức xử lý cấu hình được; chặn giao dịch hoặc khóa ví khi cài đặt yêu cầu.
- YCAU_NGHIEPVU_160: Mỗi lần quy tắc bắt được ghi thành vụ việc; người quản trị xem xét, kết luận.
- YCAU_NGHIEPVU_161: Quản trị xem báo cáo chi phí, công nợ điểm theo công ty và báo cáo gian lận.

- CHUC_NANG_214: Kiểu chia chi phí, hạch toán theo kiểu; đối soát nội bộ tháng, xác nhận, khiếu nại, bù trừ, phiếu thu chi nội bộ.
- CHUC_NANG_215: Mã cài đặt ứng dụng, quy tắc chống gian lận nâng cao, vụ việc gian lận.
- CHUC_NANG_216: Báo cáo liên minh điểm và báo cáo gian lận.

## 5. Quy tắc nghiệp vụ

- QUYTAC_NGHIEPVU_468 Kiểu chia chi phí: trường mới của giai đoạn chương trình (QUYTAC_NGHIEPVU_345), một trong: nơi tích chịu (`earning_company`, mặc định, giữ hạch toán hiện tại), nơi dùng chịu (`redeeming_company`), công ty vận hành sàn chịu (`operator`). Giai đoạn đã bắt đầu không đổi được kiểu. Mỗi lô điểm lưu kiểu của giai đoạn lúc cộng; bút toán tích, dùng, hoàn, trừ lại, hết hạn của lô theo kiểu của lô. Cùng công ty (đơn VComm, quầy của công ty vận hành sàn) thì ba kiểu cho cùng kết quả.
- QUYTAC_NGHIEPVU_469 Hạch toán theo kiểu (A: công ty nơi tích; B: công ty nơi dùng; O: công ty vận hành sàn; giá trị lô = điểm × giá trị một điểm lúc tích; tiền điểm = tiền khách được trừ):
  - Nơi tích chịu: như QUYTAC_NGHIEPVU_355.
  - Nơi dùng chịu: tích: O Nợ 641 / Có 3388 (chi phí tạm ở O), A không ghi. Dùng ở B: O Nợ 3388 / Có 641 theo giá trị lô (gỡ chi phí tạm); B Nợ 641 / Có 131 tiền điểm (B chịu, không có nợ nội bộ). Hết hạn: O Nợ 3388 / Có 641.
  - Công ty vận hành sàn chịu: tích: O Nợ 641 / Có 3388, A không ghi. Dùng ở B: O Nợ 3388 giá trị lô, Nợ hoặc Có 641 chênh lệch / Có 3368 tiền điểm (đối tác nội bộ B); B Nợ 1368 / Có 131.
  - Hoàn điểm, trừ lại ghi ngược bút toán gốc theo kiểu của lô. Phần điểm thiếu quy tiền (QUYTAC_NGHIEPVU_349) theo kiểu của lô của chứng từ bán.
- QUYTAC_NGHIEPVU_470 Bảng đối soát nội bộ (số `DN…`, loại chứng từ `loyalty.settlement`): việc nền 2 giờ ngày 1 hằng tháng (giờ Việt Nam) lập bảng tháng trước cho mỗi công ty con có bút toán vai trò `loyalty_intercompany_receivable` hoặc `loyalty_intercompany_payable` trong tháng, hoặc còn số chưa tất toán. Số liệu theo sổ của O với đối tác nội bộ của công ty con (C): số dư đầu kỳ phải thu (1368), phải trả (3368); phát sinh trong tháng theo loại (tích, dùng, hoàn điểm, trừ lại, phần thiếu quy tiền); số dư cuối kỳ; số bù trừ = nhỏ hơn giữa số dư cuối phải thu và phải trả; số còn lại = phải thu − phải trả (dương: C phải trả O; âm: O phải trả C). Chi tiết theo từng bút toán điểm (ngày, chứng từ nguồn, khách che tên, số điểm, tiền). Đối chiếu sổ C (3368, 1368 với đối tác nội bộ là O, vai trò điểm): lệch thì bảng ở trạng thái Không khớp kèm danh sách bút toán lệch, không xác nhận được. Lập lại được bằng tay (người có `loyalty.settlement.manage` tại O) khi chưa xác nhận đủ.
- QUYTAC_NGHIEPVU_471 Xác nhận: người có `loyalty.settlement.manage` tại O xác nhận phía O; người có quyền này tại C xác nhận phía C; thứ tự tùy ý. Một bên khiếu nại (lý do 1 đến 1.000 ký tự) thì bảng sang Khiếu nại, phía đã xác nhận bị bỏ; O xử lý (phiếu điều chỉnh điểm, bút toán thủ công có sẵn) rồi lập lại bảng. Trạng thái: chờ xác nhận, O đã xác nhận, C đã xác nhận, khiếu nại, không khớp, đã bù trừ, đã thanh toán một phần, đã tất toán. Bảng chờ quá 5 ngày: thông báo trong ứng dụng cho người có quyền của bên chưa xác nhận, một lần.
- QUYTAC_NGHIEPVU_472 Bù trừ: khi đủ hai bên xác nhận, trong cùng giao dịch ghi bút toán bù trừ ở mỗi công ty theo số bù trừ (bút toán tự sinh, nguồn `loyalty_settlement`): O Nợ 3368 / Có 1368 (đối tác nội bộ C); C Nợ 3368 / Có 1368 (đối tác nội bộ O). Ngày ghi sổ: ngày cuối tháng đối soát; kỳ đó đã khóa sổ thì ngày xác nhận. Số bù trừ bằng 0 thì không ghi.
- QUYTAC_NGHIEPVU_473 Thanh toán phần còn lại: loại phiếu thu, phiếu chi mới gắn bảng đối soát đã bù trừ: thu nợ nội bộ điểm (`loyalty_intercompany_receipt`: Nợ 111/112 / Có 1368) ở bên được trả, chi trả nợ nội bộ điểm (`loyalty_intercompany_payment`: Nợ 3368 / Có 111/112) ở bên phải trả; đối tượng là đối tác nội bộ của bên kia; tổng các phiếu đã ghi sổ không vượt số còn lại; theo luồng duyệt phiếu thu chi hiện có. Hai bên ghi đủ thì bảng Đã tất toán; một phần thì Đã thanh toán một phần.
- QUYTAC_NGHIEPVU_474 Mã cài đặt ứng dụng: ứng dụng VComm sinh 128 bit ngẫu nhiên lần mở đầu, lưu `expo-secure-store` (có sẵn), gửi tiêu đề `X-Device-Id` trên mọi yêu cầu của người mua. Máy chủ chỉ lưu băm HMAC-SHA256 (khóa dẫn xuất từ `MFA_SECRET_KEY`), không lưu mã gốc. Ghi liên kết thiết bị – tài khoản (lần đầu, lần cuối, số lần) khi đăng nhập, xem trước và đặt đơn. Yêu cầu không có tiêu đề hoặc sai định dạng: không ghi, không áp quy tắc thiết bị. Quản trị chỉ thấy 8 ký tự đầu của băm. Dữ liệu thiết bị giữ 12 tháng kể từ lần cuối, việc nền xóa sau đó.
- QUYTAC_NGHIEPVU_475 Quy tắc chống gian lận: bốn quy tắc (QUYTAC_NGHIEPVU_476), mỗi quy tắc: bật hoặc tắt, các ngưỡng, mức xử lý: cảnh báo (`alert`), chặn giao dịch (`block`), chặn và khóa ví (`block_and_lock`). Mặc định: bật, mức cảnh báo. Người có `loyalty.fraud.manage` sửa; lưu lịch sử sửa. Chặn khi dùng điểm: từ chối với thông báo "Giao dịch điểm tạm bị chặn để kiểm tra. Vui lòng liên hệ chăm sóc khách hàng."; chặn khi tích: không tích, lý do `fraud_rule`, không tích lại sau. Khóa ví: như QUYTAC_NGHIEPVU_352, lý do "Tự khóa theo quy tắc <tên quy tắc>", người làm là hệ thống. Quy tắc chỉ đánh giá khi phát sinh giao dịch, không quét lại quá khứ.
- QUYTAC_NGHIEPVU_476 Bốn quy tắc:
  1. Nhiều tài khoản trên một thiết bị: khi xem trước, đặt đơn có dùng điểm và khi tích điểm đơn VComm; số tài khoản khác nhau liên kết cùng mã cài đặt có tích hoặc dùng điểm trong N ngày (mặc định 30) lớn hơn ngưỡng (mặc định 3). Đối tượng: mọi tài khoản của thiết bị.
  2. Đổi điểm dồn dập: khi dùng điểm (đơn VComm, bán tại quầy); trong 24 giờ một tài khoản dùng điểm quá N lần (mặc định 5) hoặc quá X điểm (mặc định trống: không xét); hoặc dùng ≥ Y % số dư (mặc định 80 %) trong Z giờ (mặc định 24) kể từ lần đầu thiết bị đó liên kết với tài khoản.
  3. Tích rồi trả hàng lặp lại: khi trừ lại điểm do trả hàng, hủy chứng từ bán tại quầy; trong 90 ngày, điểm bị trừ lại ÷ điểm đã tích ≥ ngưỡng (mặc định 50 %) và điểm đã tích ≥ mức tối thiểu (mặc định 10.000 điểm). Mức chỉ cảnh báo hoặc khóa ví (giao dịch trả hàng không chặn).
  4. Bất thường theo nhân viên (bán tại quầy): khi tích điểm cho chứng từ bán; một thu ngân lập quá N chứng từ có tích điểm cho cùng một khách trong một ngày (mặc định 3), hoặc tích điểm cho tài khoản có số điện thoại trùng số điện thoại của người lập chứng từ. Chặn: chứng từ bán vẫn hoàn tất, không tích điểm.
- QUYTAC_NGHIEPVU_477 Vụ việc gian lận (số `GL…`): mỗi lần quy tắc bắt ghi một vụ việc; cùng quy tắc, cùng đối tượng (tài khoản hoặc thiết bị hoặc thu ngân), cùng ngày giờ Việt Nam thì gộp vào vụ việc đang mở, tăng số lần bắt, thêm chứng từ liên quan. Nội dung: quy tắc, mức đã áp, số liệu lúc bắt, tài khoản, thiết bị, thu ngân, công ty, chứng từ liên quan, hành động đã thực hiện. Trạng thái: mới, đang xem xét (người xem xét), vi phạm, không vi phạm (kết luận kèm ghi chú 1 đến 1.000 ký tự). Kết luận không đổi ví; mở khóa ví làm ở màn hình ví điểm. Vụ việc mới: thông báo trong ứng dụng cho người có `loyalty.fraud.manage`, gộp tối đa một thông báo mỗi giờ.
- QUYTAC_NGHIEPVU_478 Báo cáo: liên minh theo tháng, theo công ty: điểm tích, giá trị lô, chi phí điểm công ty ghi nhận (theo kiểu), điểm dùng, tiền điểm, phải thu, phải trả nội bộ, đã bù trừ, đã thanh toán, còn lại. Gian lận theo tháng: số vụ việc theo quy tắc, mức, kết luận; số giao dịch bị chặn, số điểm không tích, số ví tự khóa; mười tài khoản, thiết bị, thu ngân có nhiều vụ việc nhất. Xuất tệp Excel bằng thư viện xuất đang dùng.
- QUYTAC_NGHIEPVU_479 Quyền mới: `loyalty.settlement.view` (xem bảng đối soát, báo cáo liên minh của công ty mình; tại O xem mọi bảng), `loyalty.settlement.manage` (xác nhận, khiếu nại; tại O lập lại bảng), mini app `finance`, dùng ở mọi công ty; `loyalty.fraud.manage` (sửa quy tắc, xử lý vụ việc), mini app `crm`, chỉ tại O. Xem quy tắc, vụ việc, báo cáo gian lận dùng `loyalty.view`; sửa kiểu chia chi phí dùng `loyalty.manage`; phiếu thu chi nội bộ dùng `finance.payment.manage`. Quản trị tập đoàn, quản trị công ty có sẵn các quyền mới.

Thông báo lỗi mới (vi): "Giao dịch điểm tạm bị chặn để kiểm tra. Vui lòng liên hệ chăm sóc khách hàng."; "Số liệu hai công ty chưa khớp, chưa xác nhận được."; "Bảng đối soát đã xác nhận hoặc đã bù trừ, không lập lại được."; "Số tiền vượt số còn lại của bảng đối soát."; "Giai đoạn đã bắt đầu, không đổi được kiểu chia chi phí."

## 6. Vai trò và quyền

Như QUYTAC_NGHIEPVU_479. Kế toán công ty con chỉ thấy bảng đối soát của công ty mình, chi tiết khách hiện tên đã che. Người mua không thấy mã thiết bị, quy tắc, vụ việc.

## 7. Luồng nghiệp vụ

Luồng 57 (liên minh điểm trong tập đoàn, chống gian lận):
1. Quản trị chọn kiểu chia chi phí cho giai đoạn; cài quy tắc chống gian lận.
2. Khách tích, dùng điểm ở các công ty; mỗi lần dùng, tích, trả hàng: đánh giá quy tắc → cảnh báo, chặn hoặc khóa → vụ việc.
3. Hạch toán theo kiểu của lô; phát sinh 1368/3368 khi khác công ty.
4. Ngày 1 hằng tháng: lập bảng đối soát tháng trước cho từng công ty con → đối chiếu sổ (lệch: Không khớp) → O, C xác nhận (hoặc khiếu nại → O xử lý → lập lại) → bù trừ → phiếu thu, phiếu chi nội bộ → tất toán.
5. Quản trị xem xét vụ việc, kết luận; mở khóa ví nếu không vi phạm.
6. Báo cáo liên minh, gian lận theo tháng.

## 8. Màn hình

Web (`apps/web-finance`, nhóm menu "Công nợ"):
- MAN_HINH_218 Đối soát điểm nội bộ: danh sách bảng (tháng, công ty con, phải thu, phải trả, bù trừ, còn lại, trạng thái; lọc tháng, trạng thái).
- MAN_HINH_219 Chi tiết bảng đối soát điểm: số liệu, đối chiếu sổ hai bên, chi tiết bút toán điểm, xác nhận, khiếu nại, lịch sử, phiếu thu chi nội bộ, lập phiếu.

Web (`apps/web-crm`, nhóm menu "Điểm thưởng"):
- MAN_HINH_220 Quy tắc chống gian lận: bốn quy tắc, ngưỡng, mức xử lý, lịch sử sửa.
- MAN_HINH_221 Vụ việc gian lận: danh sách (lọc quy tắc, trạng thái, mức), chi tiết, nhận xem xét, kết luận.
- MAN_HINH_222 Báo cáo liên minh và gian lận: hai thẻ, theo tháng; xuất Excel.
- MAN_HINH_223 Thiết bị của ví điểm (thẻ mới trong chi tiết ví MAN_HINH_147): thiết bị (băm rút gọn, lần đầu, lần cuối, số lần), tài khoản khác cùng thiết bị, vụ việc của ví.
- Sửa MAN_HINH_146: cột, trường "Kiểu chia chi phí".

Ứng dụng: không có màn hình mới; gửi mã cài đặt; hiện thông báo khi bị chặn.

## 9. Dữ liệu và API

Database migration 0125 (`0125_loyalty_alliance.sql`):
- `loyalty.program_phases.cost_bearer` (`earning_company` mặc định, `redeeming_company`, `operator`); `loyalty.lots.cost_bearer` (giai đoạn cũ: `earning_company`).
- `loyalty.settlements`: `id`, `document_no`, `operator_company_id`, `company_id`, `period` (tháng đầu kỳ), số dư đầu, phát sinh theo loại, số dư cuối phải thu, phải trả, `offset_amount`, `remaining_amount`, `status`, `operator_confirmed_by`, `operator_confirmed_at`, `company_confirmed_by`, `company_confirmed_at`, `mismatch` (jsonb), `version`; duy nhất (`company_id`, `period`).
- `loyalty.settlement_events` (lịch sử: lập, lập lại, xác nhận, khiếu nại, bù trừ, thanh toán; người, lý do, thời điểm).
- `finance.payments.loyalty_settlement_id`; loại phiếu `loyalty_intercompany_receipt`, `loyalty_intercompany_payment` (định nghĩa lại `payments_kind_check` gồm mọi giá trị trên `main`).
- Nguồn bút toán `loyalty_settlement` (định nghĩa lại `journals_source_type_check` gồm mọi giá trị trên `main`).
- Quyền `loyalty.settlement.view`, `loyalty.settlement.manage`, `loyalty.fraud.manage`; loại chứng từ `loyalty.settlement` (đánh số, không duyệt).

Database migration 0126 (`0126_loyalty_fraud.sql`):
- `loyalty.devices` (`hash` khóa chính, `first_seen_at`, `last_seen_at`); `loyalty.device_links` (`device_hash`, `user_id`, `first_seen_at`, `last_seen_at`, `seen_count`; khóa chính hai cột).
- `loyalty.fraud_rules` (`code` khóa chính: `shared_device`, `redeem_burst`, `earn_return`, `staff_anomaly`; `enabled`, `params` jsonb, `action`, người, thời điểm sửa, `version`); nạp mặc định. `loyalty.fraud_rule_history`.
- `loyalty.fraud_cases` (số `GL…`, `rule_code`, `action`, `subject_kind` (`user`, `device`, `staff`), `subject_id`, `user_id`, `device_hash`, `staff_user_id`, `company_id`, `metrics` jsonb, `hit_count`, `case_day`, `status`, `reviewer_id`, `conclusion_note`, thời điểm); `loyalty.fraud_case_documents` (`case_id`, `source_type`, `source_id`, `effect`).
- `loyalty.document_points.skip_reason` thêm `fraud_rule` (định nghĩa lại ràng buộc).

Database migration 0127: dự phòng cho sửa ràng buộc dùng chung khi hợp nhất cùng CONG_VIEC_55 (nguồn chứng từ `loyalty`, `journals`, `debt_items`).

API (tiền tố `/api/v1`):
- API_249 bảng đối soát: `GET /loyalty/settlements?period=&status=` (theo công ty đang chọn; O thấy mọi bảng), `GET /loyalty/settlements/{id}` (kèm chi tiết, đối chiếu, lịch sử, phiếu), `POST /loyalty/settlements/{id}/rebuild` (O).
- API_250 xác nhận, khiếu nại: `POST /loyalty/settlements/{id}/confirm`, `POST /loyalty/settlements/{id}/dispute` (lý do); có `version`.
- API_251 quy tắc: `GET /loyalty/fraud-rules`, `PUT /loyalty/fraud-rules/{code}` (có `version`), `GET /loyalty/fraud-rules/history`.
- API_252 vụ việc: `GET /loyalty/fraud-cases`, `GET /loyalty/fraud-cases/{id}`, `POST /loyalty/fraud-cases/{id}/review`, `POST /loyalty/fraud-cases/{id}/conclude` (vi phạm hoặc không, ghi chú).
- API_253 báo cáo: `GET /loyalty/reports/alliance?year=`, `GET /loyalty/reports/fraud?year=`; tham số `format=xlsx` xuất tệp.
- API_254 thiết bị: `GET /loyalty/accounts/{userId}/devices`; tiêu đề `X-Device-Id` trên API người mua (không phải endpoint riêng).
- Sửa API_176: giai đoạn có `costBearer`. Sửa API phiếu thu chi (CONG_VIEC_13): hai loại mới, trường `loyaltySettlementId`.

Service: `LoyaltyFraudService.evaluate(executor, { trigger, userId, deviceHash, staffUserId, companyId, sourceType, sourceId, points })` → `{ action, caseId }`, gọi trong giao dịch của `redeemWithin`, `earnWithin`, `returnWithin`, `cancelWithin` (CONG_VIEC_51), không đổi chữ ký cũ (tham số thêm tùy chọn). `postings.service.ts` hạch toán theo `cost_bearer` của lô.

Việc nền: lập bảng đối soát 2 giờ ngày 1; nhắc bảng chờ quá 5 ngày; xóa thiết bị quá 12 tháng (cùng lượt chạy 0 giờ 10 phút).

## 10. Điều kiện đặc biệt

- Ý kiến luật sư về điểm thưởng (CONG_VIEC_51) vẫn chặn phát hành thật.
- Mã cài đặt là dữ liệu kỹ thuật gắn tài khoản; ghi vào tài liệu `22` (dữ liệu cá nhân, thời hạn lưu 12 tháng); chính sách quyền riêng tư của ứng dụng phải nêu mục đích chống gian lận.
- Đổi kiểu chia chi phí giữa các giai đoạn: lô cũ giữ kiểu cũ, nên một tháng có thể có bút toán theo nhiều kiểu.

## 11. Tiêu chí nghiệm thu

| Mã | Tiêu chí | Mức | Kịch bản |
|---|---|---|---|
| TIEUCHI_NGHIEMTHU_434 | Kiểu chia chi phí theo giai đoạn; giai đoạn đã bắt đầu không đổi được; lô lưu kiểu | Bắt buộc | KICHBAN_KIEMTHU_611 |
| TIEUCHI_NGHIEMTHU_435 | Hạch toán đúng ba kiểu cho tích, dùng, hoàn, trừ lại, hết hạn, thiếu quy tiền; cùng công ty cho kết quả như cũ | Bắt buộc | KICHBAN_KIEMTHU_612, KICHBAN_KIEMTHU_613 |
| TIEUCHI_NGHIEMTHU_436 | Bảng đối soát tháng: số liệu khớp sổ cái; lệch sổ thì Không khớp, không xác nhận được | Bắt buộc | KICHBAN_KIEMTHU_614 |
| TIEUCHI_NGHIEMTHU_437 | Hai bên xác nhận mới bù trừ; khiếu nại bỏ xác nhận; bút toán bù trừ hai công ty đúng số, đúng ngày; phân quyền theo công ty | Bắt buộc | KICHBAN_KIEMTHU_615 |
| TIEUCHI_NGHIEMTHU_438 | Phiếu thu chi nội bộ không vượt số còn lại; trạng thái thanh toán một phần, tất toán | Bắt buộc | KICHBAN_KIEMTHU_616 |
| TIEUCHI_NGHIEMTHU_439 | Mã cài đặt: chỉ lưu băm; không có tiêu đề thì không áp quy tắc thiết bị; xóa sau 12 tháng | Bắt buộc | KICHBAN_KIEMTHU_617 |
| TIEUCHI_NGHIEMTHU_440 | Bốn quy tắc bắt đúng ngưỡng (đúng, sai, biên); ba mức xử lý đúng (cảnh báo, chặn, chặn và khóa) | Bắt buộc | KICHBAN_KIEMTHU_618, KICHBAN_KIEMTHU_619 |
| TIEUCHI_NGHIEMTHU_441 | Vụ việc gộp theo quy tắc, đối tượng, ngày; xem xét, kết luận; phân quyền | Bắt buộc | KICHBAN_KIEMTHU_620 |
| TIEUCHI_NGHIEMTHU_442 | Báo cáo liên minh khớp sổ cái và bảng đối soát; báo cáo gian lận khớp vụ việc; xuất Excel | Bắt buộc | KICHBAN_KIEMTHU_621 |
| TIEUCHI_NGHIEMTHU_443 | Web, ứng dụng chạy được (máy tính, khổ điện thoại); công ty con chỉ thấy bảng của mình | Bắt buộc | KICHBAN_KIEMTHU_622 |

## 12. Kịch bản kiểm thử

- KICHBAN_KIEMTHU_611 đến 621: tự động, `apps/api/test/c60-*.test.ts`.
- KICHBAN_KIEMTHU_622: thủ công trên trình duyệt và ứng dụng, kèm kiểm thử quyền tự động.

## 13. Ràng buộc kỹ thuật

Không thêm thư viện. Dùng lại: `LoyaltyLedgerService`, `postings.service.ts`, khóa ví (`accounts.service.ts`), `LedgerService`, `internalPartnerOf`, phiếu thu chi và luồng duyệt (CONG_VIEC_13), dãy số chứng từ, thông báo trong ứng dụng, việc nền, khóa dẫn xuất HMAC (CONG_VIEC_47), xuất Excel đang dùng ở báo cáo quản trị (CONG_VIEC_50), `expo-secure-store`.

## 14. Thành phần không được thay đổi

Cảnh báo bất thường cơ bản (QUYTAC_NGHIEPVU_354), hạch toán kiểu nơi tích chịu (QUYTAC_NGHIEPVU_355), luồng đặt đơn, bán tại quầy, cửa hàng liên kết (CONG_VIEC_55). Chỉ thêm: đánh giá quy tắc trong service điểm, kiểu chia chi phí, đối soát, thiết bị.

## 15. Các lát và điểm xem trước

- L0: database migration 0125 phần kiểu chia chi phí; hạch toán ba kiểu (sửa API_176, MAN_HINH_146). Xem trước: đổi kiểu cho giai đoạn sắp tới, xem bút toán thử ba kiểu.
- L1: phần còn lại của 0125; bảng đối soát, đối chiếu, xác nhận, khiếu nại, bù trừ (API_249, 250; MAN_HINH_218, 219). Xem trước: lập bảng tháng thử, hai bên xác nhận.
- L2: phiếu thu chi nội bộ, tất toán. Xem trước: lập phiếu, bảng tất toán.
- L3: database migration 0126; mã cài đặt ứng dụng, quy tắc, vụ việc (API_251, 252, 254; MAN_HINH_220, 221, 223). Xem trước: đặt đơn dùng điểm từ nhiều tài khoản trên một thiết bị, xem vụ việc, chặn.
- L4: báo cáo liên minh và gian lận (API_253; MAN_HINH_222). Xem trước: báo cáo tháng, xuất Excel.

## 16. Điểm chưa xác định

- Ý kiến luật sư (CONG_VIEC_51) chặn phát hành thật.
- Quy tắc 4 và nguồn bán tại quầy cần CONG_VIEC_53 lát L6 trên `main`.

## 17. Quyết định của người dùng (2026-11-12)

1. Giữ một loại điểm chung toàn tập đoàn do công ty vận hành sàn phát hành; không có tỷ giá điểm giữa công ty.
2. Chi phí khi tích ở A, dùng ở B: cài đặt một trong ba kiểu cho cả tập đoàn (nơi tích chịu, nơi dùng chịu, công ty vận hành sàn chịu).
3. Đối soát nội bộ hằng tháng, hai bên xác nhận, bù trừ 1368/3368, phần còn lại thanh toán bằng phiếu thu, phiếu chi.
4. Đối tác liên minh ngoài tập đoàn (đổi điểm hai chiều qua API đối tác; đối tác mua điểm tặng khách, trả trước hoặc trả sau theo hợp đồng): tách thành công việc riêng.
5. Nhận biết thiết bị bằng mã cài đặt ứng dụng, không thêm thư viện.
6. Chống gian lận nâng cao bốn quy tắc: số tài khoản trên thiết bị, đổi điểm dồn dập, tích rồi trả hàng lặp lại, bất thường theo nhân viên; mức xử lý cấu hình được từng quy tắc (cảnh báo, chặn giao dịch, chặn và khóa ví).

## 18. Đề xuất của AI chờ người dùng duyệt cùng đặc tả

1. Kiểu chia chi phí gắn theo giai đoạn chương trình, lô giữ kiểu lúc tích (để đổi kiểu không làm sai bút toán lô cũ).
2. Kiểu nơi dùng chịu ghi chi phí tạm ở công ty vận hành sàn khi tích, gỡ khi dùng (giữ nguyên tắc ghi nghĩa vụ khi phát sinh).
3. Hai loại phiếu thu, phiếu chi mới cho nợ nội bộ điểm (hiện phiếu thu chi chỉ trừ công nợ 131, 331).
4. Ba quyền mới (`loyalty.settlement.view`, `loyalty.settlement.manage`, `loyalty.fraud.manage`); màn hình đối soát ở mini app Tài chính.
5. Mặc định mọi quy tắc ở mức cảnh báo; ngưỡng mặc định như QUYTAC_NGHIEPVU_476.
6. Dữ liệu thiết bị giữ 12 tháng.
