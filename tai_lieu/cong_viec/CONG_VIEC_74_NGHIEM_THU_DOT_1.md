# CONG_VIEC_74 – Trình nghiệm thu đợt 1 và hướng dẫn thử trên Sunmi T2

- Công việc: CONG_VIEC_74 iPOS – phần mềm bán hàng cho cửa hàng liên kết (MODULE_17). Đặc tả: `CONG_VIEC_74.md`; điều chỉnh khi lập trình: mục 19a của đặc tả.
- Phạm vi đợt 1: lát L0 đến L7, người dùng đã duyệt từng lát ngày 2026-11-17 (qua phiên điều phối). Nhánh `chuc-nang/CONG_VIEC_74-ipos`.
- Ngày trình: 2026-11-17.

## 1. Kết quả theo tiêu chí nghiệm thu

| Tiêu chí | Kết quả | Bằng chứng |
|---|---|---|
| TIEUCHI_NGHIEMTHU_560 | Đạt (tự động) | `c74-subscriptions`, `c74-devices` (KICHBAN_KIEMTHU_769: cô lập giữa hai cửa hàng) |
| TIEUCHI_NGHIEMTHU_561 đến 565 | Đạt (tự động) | `c74-subscriptions`, `c74-devices` (KICHBAN_KIEMTHU_768 đến 774) |
| TIEUCHI_NGHIEMTHU_566 đến 568 | Đạt (tự động) | `c74-devices` (KICHBAN_KIEMTHU_775 đến 777); đăng nhập lần đầu bằng Smart OTP theo yêu cầu người dùng khi duyệt L1 |
| TIEUCHI_NGHIEMTHU_569 đến 571 | Đạt (tự động) | `c74-catalog` (KICHBAN_KIEMTHU_778 đến 781) |
| TIEUCHI_NGHIEMTHU_572 đến 575 | Đạt (tự động) | `c74-sales`, `c74-payments` (KICHBAN_KIEMTHU_782 đến 785); nội dung VietQR là "<mã điểm bán> <8 ký tự mã yêu cầu>" (người dùng chọn) |
| TIEUCHI_NGHIEMTHU_576 | Đạt phần máy chủ (gửi lại cùng khóa yêu cầu không ghi trùng, tự động); **ngắt mạng thật thử trên máy** | `c74-sales`; mục 3 dưới đây |
| TIEUCHI_NGHIEMTHU_577 | Mẫu in 58 mm, 80 mm kiểm bằng bản xem trước chữ; **in thật thử trên Sunmi T2** | Ảnh xem trước lát L3; mục 3 |
| TIEUCHI_NGHIEMTHU_578 | Đạt (tự động: móc hoàn tất ghi hóa đơn có dòng ứng dụng VComm, điểm; đơn chờ, mã QR, hủy) và đã thử luồng thật trên máy phát triển với VNPAY giả lập; **cổng thanh toán thật thử khi nghiệm thu** | `c74-payments`, `c74-app-refund` (luồng khách quét mã, trả qua VNPAY giả lập, ghi hóa đơn); ảnh "luồng thật" |
| TIEUCHI_NGHIEMTHU_579 | Đạt (tự động) | `c74-payments` |
| TIEUCHI_NGHIEMTHU_580 | Đạt (tự động); chủ đóng hộ ca trên cổng | `c74-sales`, `c74-payments`, `c74-returns` (KICHBAN_KIEMTHU_792, 793) |
| TIEUCHI_NGHIEMTHU_581 | Đạt (tự động) | `c74-returns` (KICHBAN_KIEMTHU_794) |
| TIEUCHI_NGHIEMTHU_582 | Đạt (tự động): hủy hóa đơn có điểm, voucher hoàn điểm, tuần đã đối soát bị chặn; hủy hóa đơn có thanh toán qua ứng dụng VComm hủy `LK…` có thu hộ, CONG_VIEC_73 lập việc hoàn tiền khách (nối sau khi CONG_VIEC_73 xong lát L7) | `c74-returns` (KICHBAN_KIEMTHU_795), `c74-app-refund` |
| TIEUCHI_NGHIEMTHU_583 | Đạt (tự động: số liệu khớp hóa đơn, phiếu trả, ca; xuất Excel) | `c74-returns`; ảnh lát L5 |
| TIEUCHI_NGHIEMTHU_584 | Đạt (tự động) | `c74-payments` (KICHBAN_KIEMTHU_797, 798); ảnh lát L6 |
| TIEUCHI_NGHIEMTHU_585 | Đạt (tự động). Hóa đơn điện tử phí lập khi công ty vận hành sàn đã bật hóa đơn điện tử | `c74-fees` (KICHBAN_KIEMTHU_799) |
| TIEUCHI_NGHIEMTHU_586 | Đạt theo quy tắc đã sửa (người dùng chốt: N luôn trừ đủ, số âm mang sang bảng sau, bỏ quy tắc 7 ngày) | `c74-fees` (KICHBAN_KIEMTHU_800) |
| TIEUCHI_NGHIEMTHU_587 | Đạt phần đối soát tuần (tự động). **Đối soát ngân hàng tự động theo nội dung PI… chưa làm** (người dùng chốt để sau; kế toán lập phiếu thu) | `c74-fees` (KICHBAN_KIEMTHU_801) |
| TIEUCHI_NGHIEMTHU_588 | Đạt (tự động quét nhật ký thao tác, thông báo, sự kiện outbox, bảng thiết bị) | `c74-devices` (KICHBAN_KIEMTHU_802) |
| TIEUCHI_NGHIEMTHU_589 | Ảnh chụp từng lát (máy tính, điện thoại, máy tính bảng ngang); **giao diện trên Sunmi T2 kiểm khi nghiệm thu** | Ảnh đã gửi người dùng qua các lát |

Kiểm thử tự động: toàn bộ kiểm thử API chạy một tiến trình (kết quả ghi trong báo cáo gửi phiên điều phối và tài liệu `25` do phiên điều phối ghi). Kiểm tra kiểu, lint toàn dự án đạt.

## 2. Chuẩn bị máy Sunmi T2

Thư viện in có mã gốc Android (dịch vụ in Sunmi, máy in mạng, Bluetooth) nên **không chạy được trên Expo Go**; cần bản dựng phát triển.

1. Máy dựng: Node 22, pnpm, JDK 17, Android SDK (API 34), cáp USB hoặc cùng mạng với máy Sunmi.
2. Máy Sunmi T2: Cài đặt → Giới thiệu → bấm 7 lần "Số hiệu bản dựng" để bật tùy chọn nhà phát triển → bật "Gỡ lỗi USB". Cắm cáp, chấp nhận khóa gỡ lỗi; `adb devices` thấy máy.
3. Địa chỉ API: máy Sunmi phải gọi được API. Đặt `EXPO_PUBLIC_API_URL` (ví dụ `http://<địa chỉ máy chủ trong mạng nội bộ>:4000/api/v1` hoặc địa chỉ HTTPS môi trường thử) trước khi dựng.
4. Dựng và cài (tại gốc dự án):
   ```
   cd apps/mobile-ipos
   EXPO_PUBLIC_API_URL=<địa chỉ API> npx expo prebuild --platform android
   EXPO_PUBLIC_API_URL=<địa chỉ API> npx expo run:android --variant release
   ```
   Lần đầu tải Gradle mất thời gian. Nếu thư viện Bluetooth (`react-native-bluetooth-classic` bản rc) làm hỏng bản dựng: tạm bỏ thư viện này, dựng lại và báo phiên phát triển (phương án dự phòng đã duyệt: `react-native-ble-plx` hoặc hoãn Bluetooth).
5. Dữ liệu thử (trên ERP và cổng cửa hàng):
   - ERP: Gói iPOS (MAN_HINH_303) → tạo gói; chi tiết cửa hàng liên kết → khối iPOS → chọn cách thu, cấp thuê bao cho điểm bán.
   - Cổng cửa hàng: Cài đặt bán hàng (MAN_HINH_302) → mã điểm bán, tài khoản VietQR, khổ giấy 80 mm; Hàng hóa (MAN_HINH_294) → thêm hoặc nhập Excel; Tồn kho → phiếu nhập; Thu ngân → duyệt thu ngân; Quầy và thiết bị (MAN_HINH_296) → tạo quầy, lấy mã ghép 8 ký tự.
   - Máy Sunmi: mở iPOS → nhập mã ghép → đăng nhập lần đầu (Smart OTP hoặc mã SMS) → đặt PIN.

## 3. Danh sách việc thử trên máy thật

Ghi kết quả mỗi dòng (Đạt / Không đạt, ảnh, ghi chú) rồi gửi phiên điều phối để ghi tài liệu `25`.

| Số | Việc thử | Mã | Kết quả mong đợi |
|---|---|---|---|
| 1 | Ghép thiết bị bằng mã 8 ký tự; dùng lại mã cũ; thu hồi thiết bị trên cổng | KICHBAN_KIEMTHU_776 | Ghép được một lần; mã cũ bị từ chối; máy bị thu hồi phải ghép lại |
| 2 | Đăng nhập lần đầu bằng Smart OTP (hoặc mã SMS), đặt PIN; đăng nhập lại bằng PIN; sai PIN 5 lần | KICHBAN_KIEMTHU_777 | Khóa 15 phút sau lần sai thứ 5 |
| 3 | Mở ca, bán tiền mặt có giảm dòng, giảm hóa đơn; in hóa đơn trên máy in gắn sẵn | KICHBAN_KIEMTHU_787 | Hóa đơn 80 mm, tiếng Việt có dấu đúng, đủ dòng hàng, thuế, tiền thừa, lời chào |
| 4 | Hóa đơn dài (trên 30 dòng, tên hàng dài) | KICHBAN_KIEMTHU_787 | Xuống dòng đúng, không cắt chữ |
| 5 | In lại hóa đơn từ "Hóa đơn trong ca" | KICHBAN_KIEMTHU_787 | Có dòng "In lại lần n" |
| 6 | Rút giấy hoặc mở nắp máy in rồi thanh toán | KICHBAN_KIEMTHU_787 | Hóa đơn vẫn ghi; máy báo lỗi máy in; in lại được sau khi lắp giấy |
| 7 | Ngăn kéo tiền nối máy (nếu có): thanh toán tiền mặt, mở ngăn kéo trong ca | TIEUCHI_NGHIEMTHU_577 | Ngăn kéo mở khi có tiền mặt; nhật ký mở ngăn kéo trên máy chủ |
| 8 | Ngắt mạng (tắt Wi-Fi) trước khi bấm thanh toán | KICHBAN_KIEMTHU_786 | Chặn thanh toán, giữ giỏ, báo mất mạng |
| 9 | Ngắt mạng ngay sau khi bấm thanh toán, bật lại | KICHBAN_KIEMTHU_786 | Máy tra theo khóa yêu cầu, không ghi trùng hóa đơn |
| 10 | VietQR: hiện mã, quét bằng ứng dụng ngân hàng thật vào tài khoản của cửa hàng | TIEUCHI_NGHIEMTHU_574 | Ngân hàng nhận đúng số tiền, nội dung "<mã điểm bán> <8 ký tự>"; thu ngân xác nhận đã nhận tiền mới ghi |
| 11 | Khách VComm luồng 1: thu ngân quét mã thanh toán động 18 số trên ứng dụng VComm của khách | KICHBAN_KIEMTHU_789 | Khách xác nhận, trả qua cổng (sandbox); máy bán tự hiện hóa đơn, in |
| 12 | Khách VComm luồng 2: khách quét mã QR trên màn hình máy bán | KICHBAN_KIEMTHU_789 | Như trên; máy ẩn mã QR khi khách đã nhận đơn |
| 13 | Đơn chờ hết hạn, thu ngân hủy đơn chờ | KICHBAN_KIEMTHU_790 | Đơn đóng, không ghi hóa đơn; đóng ca được |
| 14 | Cửa hàng tắt thu hộ: khách dùng điểm, phần còn lại tiền mặt | KICHBAN_KIEMTHU_791 | Hóa đơn có dòng Điểm và liên kết LK… |
| 15 | Trả hàng một phần: nhập số hóa đơn (hóa đơn in chưa có mã vạch số hóa đơn, có máy quét thì quét số trên hóa đơn nếu đọc được); in phiếu trả TR-… | KICHBAN_KIEMTHU_794 | Phiếu trả in đúng; tiền hoàn từ két; tồn cộng lại |
| 16 | Đóng ca: đếm tiền theo mệnh giá, có chênh lệch, in biên bản ca | KICHBAN_KIEMTHU_792 | Biên bản đúng tiền hệ thống, chênh lệch; máy khóa màn hình sau đóng ca |
| 17 | Máy in mạng LAN (nếu có): cài đặt thiết bị → chọn máy in mạng (cổng 9100) → in thử | TIEUCHI_NGHIEMTHU_577 | In được theo bảng mã windows1258 hoặc không dấu |
| 18 | Máy in Bluetooth (nếu có; thư viện chưa kiểm thử trên máy thật) | RUIRO CONG_VIEC_74 (tài liệu `22`) | Ghép đôi, in thử; ghi lại lỗi nếu có |
| 19 | Máy quét mã vạch rời dạng bàn phím (nếu có): quét vào ô tìm hàng | TIEUCHI_NGHIEMTHU_572 | Hàng vào giỏ đúng biến thể |
| 20 | Giao diện trên màn hình 15,6 inch ngang: cỡ chữ, vùng chạm, bàn phím ảo không che ô nhập | TIEUCHI_NGHIEMTHU_589 | Dùng được bằng tay, không tràn ngang |
| 21 | Thuê bao quá hạn (đặt ngày hết hạn qua trên ERP): cảnh báo trên máy; hết ân hạn: chặn mở ca, thanh toán, vẫn in lại được | TIEUCHI_NGHIEMTHU_563 | Đúng như mô tả |

## 4. Việc chưa làm trong đợt 1 (người dùng đã biết)

- Đối soát ngân hàng tự động theo nội dung PI… (QUYTAC_NGHIEPVU_602): việc riêng sau.
- Gửi tin nhắn trong ứng dụng VComm (nhắc gia hạn, kết quả duyệt thu ngân): làm ở đợt sau; đợt 1 dùng thông báo trên cổng cửa hàng.
- Máy in USB, chế độ in ảnh: khi có máy cụ thể.
- Cách phân phối ứng dụng iPOS lên máy cửa hàng (Google Play, tệp cài đặt, quản lý thiết bị của Sunmi): chưa xác định (đặc tả mục 20).
