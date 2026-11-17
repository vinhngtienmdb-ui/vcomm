# CONG_VIEC_70: Phí tin nhắn OTP chưa chốt tính vào dư nợ xét hạn mức của cửa hàng liên kết (MODULE_12)

- Mô tả: Phí tin nhắn OTP SMS của cửa hàng liên kết (THAY_DOI_31, CONG_VIEC_67) đã gửi nhưng chưa vào bảng đối soát tuần được cộng vào dư nợ khi xét hạn mức nợ (QUYTAC_NGHIEPVU_398), kèm thuế giá trị gia tăng. Dư nợ mới dùng chung cho xét tích điểm (tại quầy, qua Open API), báo cáo cổng cửa hàng, báo cáo công ty, cảnh báo dư nợ từ 80 % hạn mức.
- Phiên bản: 0.1
- Ngày cập nhật: 2026-11-17
- Trạng thái: Đã lập trình, kiểm thử; chờ người dùng nghiệm thu.
- Mức: Vừa (sửa quy tắc nghiệp vụ đã duyệt trong một module; không đổi cấu trúc dữ liệu, API, giao diện, quyền).
- Nhánh: `chuc-nang/CONG_VIEC_70-phi-tin-nhan-du-no`.
- Nguồn: yêu cầu của người dùng ngày 2026-11-17; CONG_VIEC_67 mục 20 ghi nhận "Phí tin nhắn chưa chốt chưa cộng vào dư nợ xét hạn mức"; quyết định của người dùng (mục 17).
- Phiếu thay đổi: THAY_DOI_36 (người dùng chốt 2026-11-17; sổ `24` ghi qua phiên điều phối).
- Phụ thuộc: CONG_VIEC_55 (hạn mức, dư nợ, đối soát), CONG_VIEC_67 (phí tin nhắn OTP, `affiliate.sms_charges`); đều có trong `main` (bản 0.10.0).

## 1. Mục tiêu

Cửa hàng liên kết gửi nhiều tin OTP SMS trong tuần không vượt được hạn mức nợ mà vẫn được tích điểm: phần phí tin nhắn cửa hàng sẽ phải trả được tính vào dư nợ ngay khi tin gửi đi, không đợi đến lúc lập bảng đối soát tuần.

## 2. Phạm vi

Trong phạm vi:
- Dư nợ của cửa hàng cộng phí tin nhắn chưa vào bảng đối soát kèm thuế: F + làm tròn (F × thuế suất), thuế suất như bảng đối soát (10 %).
- Mọi nơi dùng dư nợ nhận số mới: xét tích điểm tại quầy và qua Open API, báo cáo cổng cửa hàng (MAN_HINH_176), báo cáo công ty (MAN_HINH_180 thẻ Báo cáo), cảnh báo và thông báo dư nợ từ 80 % hạn mức.

Ngoài phạm vi (người dùng chọn 2026-11-17):
- Phí dịch vụ D và thuế E của giao dịch chưa chốt vẫn chỉ vào dư nợ khi lập bảng đối soát (giữ nguyên).
- Gửi OTP SMS không xét hạn mức, quá hạn thanh toán.
- Không đổi giao diện; không thêm dòng "trong đó phí tin nhắn".
- Database migration 0157 không dùng, trả phiên điều phối.

## 3. Yêu cầu nghiệp vụ

Dùng YCAU_NGHIEPVU_122 (hạn mức nợ, chặn tích), YCAU_NGHIEPVU_169 (cửa hàng liên kết qua Open API dùng chung hạn mức). Không thêm yêu cầu mới.

## 4. Chức năng

Sửa CHUC_NANG_194 (tích, dùng điểm tại cửa hàng liên kết, chặn tích theo hạn mức) và CHUC_NANG_196 (báo cáo, cảnh báo dư nợ). Không thêm chức năng.

## 5. Quy tắc nghiệp vụ

Bổ sung (không cấp mã mới):

- QUYTAC_NGHIEPVU_398: Dư nợ = phải thu còn mở của bảng đối soát (bảng chưa xác nhận: số còn lại; đã xác nhận: công nợ phải thu còn mở) + (tiền điểm tích − tiền công ty phải trả) của giao dịch chưa chốt + phí tin nhắn OTP chưa vào bảng đối soát kèm thuế (F + làm tròn (F × thuế suất)); không âm. Tin gửi trước khi triển khai mà chưa vào bảng cũng tính. Khi lập bảng tuần, phí tin của tuần chuyển vào số còn lại của bảng, không tính hai lần.
- QUYTAC_NGHIEPVU_405: Dư nợ, hạn mức còn lại trên báo cáo cổng cửa hàng, báo cáo công ty và cảnh báo dư nợ từ 80 % hạn mức dùng dư nợ theo QUYTAC_NGHIEPVU_398 (gồm phí tin chưa chốt).
- QUYTAC_NGHIEPVU_495 (giữ nguyên): gửi OTP SMS chỉ xét Smart OTP, giới hạn tin mỗi ngày theo khóa và 5 mã mỗi giờ mỗi số; không xét hạn mức, quá hạn.

Ví dụ: hạn mức 10.000 đồng; giao dịch chưa chốt tích 2.000 đồng; 20 tin × 1.000 đồng chưa chốt: dư nợ = 2.000 + 20.000 + 2.000 = 24.000. Giao dịch mới dùng 10 điểm (10.000 đồng) trên hóa đơn 100.000 đồng: 24.000 − 10.000 + 1.800 > 10.000 nên không tích, vẫn trừ điểm.

Sai số: bảng đối soát làm tròn thuế trên tổng D + F, dư nợ tạm tính làm tròn thuế trên F, nên có thể lệch 1 đồng giữa trước và sau khi lập bảng (người dùng chấp nhận).

## 6. Vai trò và quyền

Không đổi.

## 7. Luồng nghiệp vụ

Luồng 51 (CONG_VIEC_55), luồng 63 (CONG_VIEC_67) giữ nguyên; bước xét hạn mức dùng dư nợ mới.

## 8. Màn hình

Không đổi giao diện. MAN_HINH_176 (báo cáo cổng cửa hàng), MAN_HINH_180 (thẻ Báo cáo, Cảnh báo của công ty) hiện số dư nợ mới.

## 9. Dữ liệu

Không đổi bảng. Đọc `affiliate.sms_charges` (`unit_price`, `settlement_id` trống), dùng chỉ mục có sẵn `sms_charges_unsettled_idx`.

## 10. API

Không đổi API. API_213 (báo cáo, cảnh báo) trả `exposure` theo dư nợ mới.

## 11. Dùng lại mã đã có

- `merchantExposure` (`apps/api/src/affiliate/transactions.service.ts`): hàm dư nợ dùng chung cho xét tích, `exposureOf`, cảnh báo; chỉ sửa hàm này.
- `feeTaxRate` (`apps/api/src/affiliate/settlements.service.ts`): thuế suất dùng khi lập bảng đối soát.

## 12. Phân tích giải pháp có sẵn – CONG_VIEC_70 – 2026-11-17

Sửa một truy vấn trong mã có sẵn; không có thư viện hay giải pháp ngoài phù hợp. Không thêm thư viện.

## 13. Tiêu chí nghiệm thu

| Mã | Tiêu chí | Mức | Lát |
|---|---|---|---|
| TIEUCHI_NGHIEMTHU_535 | Dư nợ cộng phí tin OTP chưa vào bảng đối soát kèm thuế; vượt hạn mức thì không tích, vẫn dùng điểm; phí mỗi tin 0 đồng giữ nguyên dư nợ; lập bảng tuần không tính trùng; báo cáo cổng cửa hàng, báo cáo công ty, cảnh báo 80 % dùng cùng dư nợ; vẫn gửi OTP khi vượt hạn mức | Bắt buộc | L1 |

## 14. Kịch bản kiểm thử

| Mã | Tiêu chí | Kịch bản | Loại |
|---|---|---|---|
| KICHBAN_KIEMTHU_731 | 535 | Tin phí 0 đồng: dư nợ 0, giao dịch tích bình thường; 20 tin × 1.000 đồng: dư nợ 24.000; giao dịch dùng 10 điểm vượt hạn mức: không tích, `skip_reason` `credit_limit`, vẫn trừ 10 điểm | Tích hợp |
| KICHBAN_KIEMTHU_732 | 535 | Lùi tin về tuần trước, lập bảng tuần: bảng có 25 tin, F 20.000, thuế 2.000, số còn lại 22.000; dư nợ không đổi; dư nợ đang vượt hạn mức vẫn gửi OTP SMS (`204`), tin mới cộng 1.100 | Tích hợp |
| KICHBAN_KIEMTHU_733 | 535 | Báo cáo cổng cửa hàng, báo cáo công ty trả dư nợ 14.000, hạn mức còn lại 0, 140,0 %; cảnh báo `credit_usage` cùng số; thông báo chủ cửa hàng một lần | Tích hợp |

Kiểm thử tự động: `apps/api/test/c70-sms-exposure.test.ts`. Hồi quy: `c55-*.test.ts`, `c67-*.test.ts`, toàn bộ kiểm thử API.

## 15. Ràng buộc kỹ thuật

- Truy vấn lọc theo cửa hàng (`merchant_id`), chạy trong cùng giao dịch cơ sở dữ liệu của nơi gọi.
- Không đổi cấu trúc dữ liệu, ràng buộc.

## 16. Điều kiện đặc biệt, điểm chưa xác minh

- Sau triển khai, cửa hàng đang có tin chưa chốt thấy dư nợ tăng ngay và có thể bị chặn tích sớm hơn; nên báo cửa hàng có phí mỗi tin lớn hơn 0 trước khi triển khai.

## 17. Quyết định của người dùng (2026-11-17, qua phiên điều phối)

| Câu hỏi | Quyết định |
|---|---|
| Số cộng vào dư nợ | Phí tin kèm thuế: F + làm tròn (F × 10 %) |
| Phí dịch vụ D, thuế E của giao dịch chưa chốt | Giữ nguyên, chỉ tính khi lập bảng |
| Gửi OTP khi vượt hạn mức, quá hạn | Vẫn gửi |
| Hiển thị | Chỉ đổi số dư nợ tổng, không đổi giao diện |
| Tin gửi trước khi triển khai, chưa vào bảng | Tính |
| Mã | THAY_DOI_36, TIEUCHI_NGHIEMTHU_535, KICHBAN_KIEMTHU_731 đến 733; không cấp QUYTAC mới; database migration 0157 không dùng |

## 18. Thành phần không được thay đổi

- Công thức bảng đối soát tuần, hạch toán (QUYTAC_NGHIEPVU_403, 404, THAY_DOI_31).
- Ghi phí tin khi gửi, giới hạn tin, Smart OTP (QUYTAC_NGHIEPVU_495).
- Cách tính tích, dùng điểm, voucher (QUYTAC_NGHIEPVU_398 phần điểm, 399, 402).

## 19. Các lát và điểm xem trước

| Lát | Nội dung | Điểm xem trước |
|---|---|---|
| L1 | Sửa `merchantExposure`; kiểm thử TIEUCHI_NGHIEMTHU_535; tài liệu `07`, `11`, `21`, `22`, `27` | Không có giao diện mới; trình kết quả kiểm thử (người dùng chọn, qua phiên điều phối) |

## 20. Kết quả đối chiếu định nghĩa hoàn thành

| Mục | Kết quả |
|---|---|
| Đúng yêu cầu, nghiệp vụ, phân quyền, dữ liệu | Đạt theo mục 5; không đổi quyền, dữ liệu |
| Giao diện | Không đổi |
| Tiêu chí nghiệm thu | TIEUCHI_NGHIEMTHU_535 đạt bằng `apps/api/test/c70-sms-exposure.test.ts` (3 kiểm thử); chạy trên mã cũ cả 3 không đạt |
| Kiểm thử toàn bộ máy chủ | Xem tài liệu `25` (phiên điều phối ghi) |
| Kiểm tra kiểu | `pnpm --filter api typecheck` đạt |
| Rà soát bảo mật | Không thêm điểm tiếp nhận, dữ liệu, thư viện; truy vấn tham số hóa, lọc theo cửa hàng |
| Tài liệu | `07`, `11`, `21`, `22`, `27`; sổ chung `02`, `03`, `24`, `25` gửi phiên điều phối ghi |
| Thư viện mới | Không |
| Mã trả lại | Database migration 0157 |
