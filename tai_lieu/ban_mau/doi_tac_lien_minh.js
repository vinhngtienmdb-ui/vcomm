// Bản mẫu CONG_VIEC_65 (MODULE_11 Điểm thưởng phần 3): dựng MAN_HINH_258 đến 265 từ dữ liệu giả. Không phải mã sản phẩm.
(function () {
  const TEP = {
    258: ["DOI_TAC_LIEN_MINH", "Đối tác liên minh (web)"],
    259: ["CHI_TIET_DOI_TAC_LIEN_MINH", "Chi tiết đối tác liên minh (web)"],
    260: ["GIAO_DICH_DOI_DIEM_DOI_TAC", "Giao dịch đổi điểm đối tác (web)"],
    261: ["DIEM_DOI_TAC_TANG", "Điểm đối tác tặng (web)"],
    262: ["DOI_SOAT_DOI_TAC_LIEN_MINH", "Đối soát đối tác liên minh (web)"],
    263: ["CHI_TIET_DOI_SOAT_DOI_TAC", "Chi tiết bảng đối soát đối tác (web)"],
    264: ["DOI_TAC_LIEN_MINH_KHACH", "Đối tác liên minh (ứng dụng)"],
    265: ["DOI_DIEM_DOI_TAC", "Đổi điểm với đối tác (ứng dụng)"],
  };
  const duongDan = (ma) => `MAN_HINH_${ma}_${TEP[ma][0]}.html`;
  const ma = Number(document.body.dataset.manHinh);
  const TRANG_THAI = [
    ["du-lieu", "Có dữ liệu"],
    ["rong", "Rỗng"],
    ["dang-tai", "Đang tải"],
    ["loi", "Lỗi"],
    ["khong-quyen", "Không có quyền"],
  ];
  const doc = (khoa, macDinh) => {
    try {
      return localStorage.getItem(khoa) || macDinh;
    } catch (e) {
      return macDinh;
    }
  };
  const ghi = (khoa, giaTri) => {
    try {
      localStorage.setItem(khoa, giaTri);
    } catch (e) {
      /* bỏ qua */
    }
  };
  let trangThai = doc("ban-mau-doi-tac-lien-minh-trang-thai", "du-lieu");

  // ---------- Thành phần dùng chung ----------
  const nut = (chu, loai, thongBao, them) => `<button type="button" class="nut ${loai || "chinh"} ${them || ""}" data-thong-bao="${thongBao || ""}">${chu}</button>`;
  const nhan = (chu, loai) => `<span class="nhan-trang-thai ${loai}">${chu}</span>`;
  const hop = (chu, loai) => `<div class="hop-thong-bao ${loai}" role="${loai === "loi" ? "alert" : "status"}">${chu}</div>`;
  const tai = (n) => Array.from({ length: n }, () => `<div class="khung-tai" aria-hidden="true"></div>`).join("") + `<span class="an-nhan">Đang tải…</span>`;
  const loiTai = `${hop("Không tải được dữ liệu. Kiểm tra kết nối mạng rồi thử lại.", "loi")}${nut("Thử lại", "phu", "", "rong")}`;
  const truong = (nhanO, giaTri, loi) => {
    const id = "o-" + Math.random().toString(36).slice(2, 8);
    return `<div class="truong-dt"><label for="${id}">${nhanO}</label><input id="${id}" class="o-nhap" value="${giaTri || ""}">${loi ? `<span class="loi">${loi}</span>` : ""}</div>`;
  };
  const chon = (nhanO, cacLuaChon) => {
    const id = "c-" + Math.random().toString(36).slice(2, 8);
    return `<div class="truong-dt"><label for="${id}">${nhanO}</label><select id="${id}" class="o-nhap">${cacLuaChon.map((l) => `<option>${l}</option>`).join("")}</select></div>`;
  };
  const dienThoai = (chuThich, tieuDe, than, quayLai) => `<section class="dien-thoai" aria-label="${chuThich}">
    <div class="chu-thich-khung">${chuThich}</div>
    <div class="dau">${quayLai ? `<a href="${quayLai}" aria-label="Quay lại">‹</a>` : ""}<span>${tieuDe}</span></div>
    <div class="cuon">${than}</div></section>`;
  const theoTrangThai = (duLieu, rongThan) => {
    if (trangThai === "dang-tai") return tai(3);
    if (trangThai === "loi") return loiTai;
    if (trangThai === "khong-quyen") return hop("Tài khoản của bạn không dùng được chức năng này.", "canh-bao");
    if (trangThai === "rong" && rongThan) return rongThan;
    return duLieu;
  };

  // ---------- Web ----------
  const MENU_WEB = [
    ["— Điểm thưởng —", ""],
    ["Chương trình điểm", ""],
    ["Ví điểm", ""],
    ["Điều chỉnh điểm", ""],
    ["Nghĩa vụ điểm", ""],
    ["Đối tác liên minh", 258],
    ["Giao dịch đổi điểm đối tác", 260],
    ["Điểm đối tác tặng", 261],
    ["Đối soát đối tác liên minh", 262],
  ];
  const chonMenu = { 259: 258, 263: 262 }[ma] || ma;
  const web = (than) => `<div class="khung-web"><header class="thanh-tren"><span class="logo">VComm</span><span>Khách hàng và Đối tác</span><span class="gian"></span>
    <button type="button">VComm Thương mại ▾</button><button type="button">Trần Minh Khoa ▾</button></header>
    <div class="than"><nav class="menu" aria-label="Khách hàng và Đối tác">${MENU_WEB.map(([chu, dich]) =>
      chu.startsWith("—") ? `<div class="ten-app">${chu.replaceAll("—", "").trim()}</div>` : `<a href="${dich !== "" ? duongDan(dich) : "#"}" class="${dich === chonMenu ? "chon" : ""}">${chu}</a>`,
    ).join("")}</nav><main class="noi-dung">${than}</main></div></div>`;
  const bang = (cot, dong, soCot) => `<div class="cuon-ngang"><table class="bang-web"><thead><tr>${cot.map((c) => `<th scope="col">${c}</th>`).join("")}</tr></thead>
    <tbody>${dong.map((d) => `<tr>${d.map((o, i) => `<td class="${(soCot || []).includes(i) ? "so" : ""}">${o}</td>`).join("")}</tr>`).join("")}</tbody></table></div>`;
  const loc = (cacO) => `<div class="luoi-truong">${cacO.join("")}</div>`;
  const webTheoTrangThai = (duLieu, rongThan) => {
    if (trangThai === "dang-tai") return tai(4);
    if (trangThai === "loi") return loiTai;
    if (trangThai === "khong-quyen") return hop("Bạn không có quyền xem màn hình này. Liên hệ quản trị công ty để được cấp quyền.", "canh-bao");
    if (trangThai === "rong" && rongThan) return rongThan;
    return duLieu;
  };
  const lienKet = (chu, dich) => `<a href="${duongDan(dich)}">${chu}</a>`;

  // ---------- Màn hình ----------
  const MAN_HINH = {
    258: () =>
      web(`<div class="tieu-de"><h1>Đối tác liên minh</h1>${nut("Thêm đối tác", "chinh")}</div>
      ${loc([chon("Trạng thái", ["Tất cả", "Nháp", "Đang hoạt động", "Tạm ngưng", "Đã chấm dứt"]), truong("Tìm mã, tên đối tác", "")])}
      ${webTheoTrangThai(
        bang(
          ["Mã", "Đối tác", "Chương trình điểm", "Chiều", "Thanh toán", "Số dư trả trước hoặc dư nợ / hạn mức", "Trạng thái"],
          [
            [lienKet("LM-0001", 259), "Hãng bay Sao Việt", "Sao Việt Miles (dặm)", "Đổi ra, đổi vào", "Trả sau", "182.400.000 / 500.000.000 ₫", nhan("Đang hoạt động", "thanh-cong")],
            [lienKet("LM-0002", 259), "Ngân hàng Phương Nam", "PN Rewards (điểm PN)", "Đổi ra, đổi vào, tặng", "Trả trước", "Còn 37.500.000 ₫", nhan("Đang hoạt động", "thanh-cong")],
            [lienKet("LM-0003", 259), "Ví Thanh Toán An Bình", "An Bình Xu (xu)", "Tặng", "Trả trước", "Còn 2.100.000 ₫ · dưới 20 %", nhan("Tạm ngưng", "canh-bao")],
            [lienKet("LM-0004", 259), "Hãng bay Cánh Én", "Cánh Én Club (dặm)", "Đổi ra", "Trả sau", "0 / 200.000.000 ₫", nhan("Nháp", "trung-tinh")],
          ],
          [5],
        ),
        `${hop("Chưa có đối tác liên minh. Bấm Thêm đối tác để lập hợp đồng đầu tiên.", "thong-tin")}`,
      )}`),

    259: () =>
      web(`<div class="tieu-de"><h1>LM-0002 · Ngân hàng Phương Nam</h1>${nhan("Đang hoạt động", "thanh-cong")}<span class="gian"></span>${nut("Tạm ngưng", "phu", "Đã tạm ngưng hợp đồng")}${nut("Chấm dứt", "nguy-hiem", "Đã chấm dứt hợp đồng")}</div>
      ${webTheoTrangThai(
        `<div class="the-web"><h2>Hợp đồng</h2><div class="luoi-truong">
          ${truong("Đối tác (crm)", "Ngân hàng TMCP Phương Nam")}${truong("Tên chương trình điểm", "PN Rewards")}
          ${truong("Tên đơn vị điểm (tiếng Việt)", "điểm PN")}${truong("Tên đơn vị điểm (tiếng Anh)", "PN points")}
          ${truong("Số hợp đồng", "HĐLM-2026/014")}${truong("Hiệu lực từ", "15/11/2026")}${truong("Hết hạn (để trống: không thời hạn)", "14/11/2028")}
          ${chon("Cách thanh toán", ["Trả trước (ký quỹ)", "Trả sau (hạn mức nợ)"])}${truong("Hạn mức nợ (trả sau, đồng)", "")}${truong("Hạn thanh toán bảng đối soát (ngày)", "15")}
          ${truong("Thuế suất phần chênh lệch (%)", "10")}${chon("Loại kết nối", ["Bộ giả lập (máy phát triển, thử nghiệm)"])}${truong("Mẫu số thành viên", "^[0-9]{10}$")}
          ${chon("Chiều được phép", ["Đổi ra, đổi vào, tặng điểm"])}</div>
          ${hop("Trả trước: số dư 37.500.000 ₫ = đã nộp 120.000.000 ₫ − đã cấn trừ 64.000.000 ₫ − phát sinh chưa chốt 18.500.000 ₫. Nộp thêm bằng phiếu thu ở mini app Tài chính.", "thong-tin")}
          ${hop("Cách thanh toán chỉ đổi được khi không còn giao dịch chưa chốt và không còn công nợ mở.", "canh-bao")}
          <div class="nhom-nut">${nut("Lưu hợp đồng", "chinh", "Đã lưu hợp đồng")}</div></div>
        <div class="the-web"><h2>Tỷ lệ quy đổi theo giai đoạn</h2>
          ${bang(
            ["Chiều", "Từ ngày", "Đến ngày", "Tỷ lệ", "Đơn giá", "Trạng thái", ""],
            [
              ["Đổi ra", "15/11/2026", "—", "10 điểm VComm = 1 điểm PN", "8 ₫ / điểm PN (công ty trả)", nhan("Đang hiệu lực", "thanh-cong"), nut("Sửa ngày kết thúc", "phu")],
              ["Đổi vào", "15/11/2026", "—", "12 điểm VComm = 1 điểm PN", "11 ₫ / điểm PN (đối tác trả)", nhan("Đang hiệu lực", "thanh-cong"), nut("Sửa ngày kết thúc", "phu")],
              ["Tặng", "15/11/2026", "31/12/2026", "—", "1,05 ₫ / điểm VComm", nhan("Đang hiệu lực", "thanh-cong"), nut("Sửa ngày kết thúc", "phu")],
              ["Tặng", "01/01/2027", "—", "—", "1,10 ₫ / điểm VComm", nhan("Sắp tới", "thong-tin"), nut("Sửa", "phu")],
            ],
          )}
          ${hop("Giao dịch theo bội số: đổi ra 30 điểm PN = 300 điểm VComm. Giai đoạn đã bắt đầu chỉ sửa được ngày kết thúc.", "thong-tin")}
          <div class="nhom-nut">${nut("Thêm giai đoạn", "phu")}</div></div>
        <div class="the-web"><h2>Giới hạn (điểm VComm; để trống: không giới hạn)</h2>
          ${bang(
            ["Chiều", "Tối thiểu mỗi giao dịch", "Tối đa mỗi giao dịch", "Mỗi khách mỗi ngày", "Mỗi khách mỗi tháng", "Đối tác mỗi tháng"],
            [
              ["Đổi ra", "1.000", "500.000", "500.000", "2.000.000", "200.000.000"],
              ["Đổi vào", "1.200", "600.000", "600.000", "3.000.000", "300.000.000"],
              ["Tặng", "—", "100.000 (mỗi lần)", "—", "500.000", "50.000.000"],
            ],
            [1, 2, 3, 4, 5],
          )}
          <div class="chu-nho">Điểm đổi vào, điểm tặng không tính vào trần tích tháng của chương trình và chi tiêu xét hạng.</div>
          <div class="nhom-nut">${nut("Lưu giới hạn", "chinh", "Đã lưu giới hạn")}</div></div>
        <div class="the-web"><h2>Khóa API tặng điểm (phạm vi loyalty.partner)</h2>
          ${bang(
            ["Tên", "Đầu khóa", "Giới hạn mỗi phút", "IP", "Hạn", "Lần gọi gần nhất", "Trạng thái", ""],
            [
              [
                "Máy chủ quà tặng PN",
                "vck_PN7f2a…",
                "60",
                "203.0.113.10",
                "—",
                "12/11/2026 09:42",
                nhan("Đang hoạt động", "thanh-cong"),
                `${nut("Cấp lại", "phu", "Đã cấp lại khóa")}${nut("Thu hồi", "nguy-hiem", "Đã thu hồi khóa")}`,
              ],
            ],
          )}
          ${hop("Khóa mới: vck_PN7f2a91c3…e8 — chỉ hiện một lần, sao chép và gửi đối tác qua kênh an toàn.", "canh-bao")}
          <div class="nhom-nut">${nut("Cấp khóa", "phu")}<a href="#">Nhật ký gọi của khóa</a></div></div>
        <div class="the-web"><h2>Bộ giả lập đối tác</h2>
          ${hop("Chỉ chạy khi máy chủ bật LOYALTY_PARTNER_SIMULATOR=on. Mã OTP của bộ giả lập ghi vào log máy chủ.", "canh-bao")}
          <div class="luoi-truong">${chon("Chế độ trả lời", ["Bình thường", "Từ chối mọi lệnh", "Không trả lời (hết thời gian)", "Sai lệch đối soát"])}</div>
          ${bang(
            ["Số thành viên", "Tên", "Số điện thoại", "Số dư điểm PN"],
            [
              ["9704 1234 56", "Nguyễn Thị Thảo", "0912 *** 678", "12.400"],
              ["9704 9988 77", "Lê Văn Bình", "0987 *** 321", "350"],
            ],
            [3],
          )}
          <div class="nhom-nut">${nut("Thêm thành viên giả", "phu")}${nut("Lưu chế độ", "chinh", "Đã lưu chế độ bộ giả lập")}</div></div>`,
      )}`),

    260: () =>
      web(`<div class="tieu-de"><h1>Giao dịch đổi điểm đối tác</h1></div>
      ${loc([chon("Đối tác", ["Tất cả", "LM-0001 Hãng bay Sao Việt", "LM-0002 Ngân hàng Phương Nam"]), chon("Chiều", ["Tất cả", "Đổi ra", "Đổi vào"]), chon("Trạng thái", ["Tất cả", "Chờ đối tác", "Cần xử lý", "Hoàn tất", "Thất bại", "Đã hoàn điểm", "Chờ OTP", "Hết hạn"]), truong("Từ ngày – đến ngày", "01/11/2026 – 12/11/2026")])}
      ${webTheoTrangThai(
        `${bang(
          ["Số", "Thời điểm", "Đối tác", "Chiều", "Khách", "Điểm VComm", "Điểm đối tác", "Tiền", "Trạng thái"],
          [
            ["DL-2026-000318", "12/11/2026 09:12", "Sao Việt", "Đổi ra", "Ng*** T***", "−5.000", "+500 dặm", "4.500.000 ₫", nhan("Cần xử lý", "nguy-hiem")],
            ["DL-2026-000321", "12/11/2026 10:05", "Phương Nam", "Đổi ra", "L* V** B***", "−3.000", "+300 điểm PN", "2.400 ₫", nhan("Chờ đối tác · lần hỏi 3", "canh-bao")],
            ["DL-2026-000320", "12/11/2026 10:01", "Phương Nam", "Đổi vào", "Ng*** T***", "+12.000", "−1.000 điểm PN", "11.000 ₫", nhan("Hoàn tất", "thanh-cong")],
            ["DL-2026-000317", "11/11/2026 16:40", "Sao Việt", "Đổi ra", "Tr** M***", "−1.000", "+100 dặm", "—", nhan("Đã hoàn điểm", "trung-tinh")],
          ],
          [5, 6, 7],
        )}
        <div class="the-web"><h2>DL-2026-000318 · Đổi ra · Cần xử lý</h2>
          ${bang(
            ["Mục", "Giá trị"],
            [
              ["Mã tham chiếu VComm", "VCX-7Q4M2K9P"],
              ["Liên kết", "Sao Việt Miles · 0012****789"],
              ["Đã trừ", "5.000 điểm VComm (lô hạn 03/2027: 5.000)"],
              ["Lần hỏi lại", "288 lần · lỗi cuối: hết thời gian chờ (10 giây)"],
              ["Quá 24 giờ lúc", "12/11/2026 09:12 → chuyển Cần xử lý 13/11/2026 09:12"],
            ],
          )}
          <div class="luoi-truong">${truong("Mã giao dịch đối tác (khi chốt Hoàn tất)", "")}${truong("Lý do hoàn điểm (1 đến 500 ký tự)", "")}</div>
          <div class="nhom-nut">${nut("Hỏi lại đối tác", "phu", "Đối tác chưa có kết quả")}${nut("Chốt hoàn tất", "chinh", "Đã chốt hoàn tất, đã hạch toán")}${nut("Hoàn điểm", "nguy-hiem", "Đã hoàn 5.000 điểm cho khách")}</div></div>`,
        hop("Không có giao dịch phù hợp bộ lọc.", "thong-tin"),
      )}`),

    261: () =>
      web(`<div class="tieu-de"><h1>Điểm đối tác tặng</h1></div>
      ${loc([chon("Đối tác", ["Tất cả", "LM-0002 Ngân hàng Phương Nam", "LM-0003 Ví An Bình"]), chon("Trạng thái", ["Tất cả", "Hoàn tất", "Đã hủy"]), truong("Từ ngày – đến ngày", "01/11/2026 – 12/11/2026")])}
      ${webTheoTrangThai(
        bang(
          ["Số", "Thời điểm", "Đối tác", "Mã giao dịch đối tác", "Khách", "Điểm", "Tiền (gồm thuế)", "Nội dung", "Trạng thái"],
          [
            ["TL-2026-001204", "12/11/2026 08:30", "Phương Nam", "PN-GIFT-88213", "Ng*** T***", "50.000", "52.750 ₫", "Quà mở thẻ tín dụng", nhan("Hoàn tất", "thanh-cong")],
            ["TL-2026-001203", "11/11/2026 20:15", "Phương Nam", "PN-GIFT-88190", "Ph** A**", "20.000", "21.100 ₫", "Quà sinh nhật", nhan("Đã hủy · đối tác hủy trong 24 giờ", "trung-tinh")],
            ["TL-2026-001198", "10/11/2026 14:02", "Ví An Bình", "AB-77120", "H*** N**", "10.000", "10.000 ₫", "—", nhan("Hoàn tất", "thanh-cong")],
          ],
          [5, 6],
        ),
        hop("Chưa có điểm đối tác tặng trong khoảng thời gian này.", "thong-tin"),
      )}`),

    262: () =>
      web(`<div class="tieu-de"><h1>Đối soát đối tác liên minh</h1></div>
      ${loc([chon("Tháng", ["10/2026", "09/2026"]), chon("Trạng thái", ["Tất cả", "Chưa đối chiếu được", "Không khớp", "Khớp", "Đã xác nhận", "Đã thanh toán"])])}
      ${webTheoTrangThai(
        bang(
          ["Số", "Tháng", "Đối tác", "Phải thu (A + B)", "Phải trả (C)", "Bù trừ", "Còn lại", "Hạn", "Trạng thái"],
          [
            [lienKet("DM-2026-0021", 263), "10/2026", "Ngân hàng Phương Nam", "64.000.000", "9.600.000", "9.600.000", "54.400.000 (đối tác trả)", "—", nhan("Không khớp · 2 dòng", "nguy-hiem")],
            [lienKet("DM-2026-0020", 263), "10/2026", "Hãng bay Sao Việt", "13.200.000", "92.000.000", "13.200.000", "78.800.000 (công ty trả)", "—", nhan("Khớp", "thong-tin")],
            [lienKet("DM-2026-0019", 263), "10/2026", "Ví An Bình", "4.000.000", "0", "0", "4.000.000 (đối tác trả)", "—", nhan("Chưa đối chiếu được", "canh-bao")],
            [lienKet("DM-2026-0014", 263), "09/2026", "Ngân hàng Phương Nam", "58.000.000", "7.000.000", "7.000.000", "51.000.000 (đối tác trả)", "16/10/2026", nhan("Đã thanh toán", "thanh-cong")],
          ],
          [3, 4, 5, 6],
        ),
        hop("Chưa có bảng đối soát. Bảng được lập lúc 3 giờ ngày 1 hằng tháng.", "thong-tin"),
      )}`),

    263: () =>
      web(`<div class="tieu-de"><h1>DM-2026-0021 · Ngân hàng Phương Nam · 10/2026</h1>${nhan("Không khớp", "nguy-hiem")}<span class="gian"></span>${nut("Lập lại", "phu", "Đã lập lại bảng, đang đối chiếu")}</div>
      ${webTheoTrangThai(
        `<div class="the-web"><h2>Số liệu</h2>${bang(
          ["Khoản", "Số giao dịch", "Điểm VComm", "Điểm đối tác", "Tiền"],
          [
            ["Tặng điểm (A, gồm thuế)", "1.180", "52.000.000", "—", "54.860.000"],
            ["Đổi vào (B, gồm thuế)", "64", "960.000", "80.000 điểm PN", "9.140.000"],
            ["Đổi ra (C)", "410", "−12.000.000", "1.200.000 điểm PN", "9.600.000"],
            ["Bù trừ (Nợ 331 / Có 131)", "", "", "", "9.600.000"],
            ["<b>Còn lại: đối tác phải trả</b>", "", "", "", "<b>54.400.000</b>"],
          ],
          [1, 2, 3, 4],
        )}</div>
        <div class="the-web"><h2>Dòng lệch với số liệu đối tác</h2>${bang(
          ["Mã tham chiếu", "Loại", "VComm", "Đối tác", "Lệch"],
          [
            ["VCX-5H2N8Q1R", "Đổi ra", "300 điểm PN · hoàn tất", "Không có", "Thiếu ở đối tác"],
            ["PN-GIFT-80011", "Tặng", "10.000 điểm · hoàn tất", "12.000 điểm", "Khác số điểm"],
          ],
        )}
        ${hop("Bảng chưa khớp, chưa xác nhận được. Xử lý từng dòng (liên hệ đối tác, chốt giao dịch cần xử lý) rồi bấm Lập lại.", "loi")}</div>
        <div class="the-web"><h2>Xác nhận (khi Khớp)</h2><div class="luoi-truong">${truong("Số biên bản đối chiếu hoặc ghi chú (1 đến 500 ký tự)", "BB-DS-PN-10/2026")}${truong("Tệp biên bản (PDF, ảnh, tối đa 10 MB)", "bien-ban-pn-10-2026.pdf")}</div>
          <div class="nhom-nut">${nut("Xác nhận bảng", "chinh", "Bảng chưa khớp, chưa xác nhận được.")}</div>
          <div class="chu-nho">Khi xác nhận: bút toán bù trừ, ghi công nợ phải thu 54.400.000 ₫ hạn 15 ngày; trả trước thì khớp ngay với tiền đối tác đã nộp.</div></div>
        <div class="the-web"><h2>Chi tiết giao dịch</h2>${bang(
          ["Ngày", "Số", "Loại", "Mã tham chiếu", "Khách", "Điểm", "Đơn vị đối tác", "Tiền"],
          [
            ["31/10/2026", "TL-2026-001150", "Tặng", "PN-GIFT-80410", "Ng*** T***", "+50.000", "—", "52.750"],
            ["31/10/2026", "DL-2026-000290", "Đổi ra", "VCX-9K1M3L7Z", "L* V** B***", "−3.000", "300", "2.400"],
            ["30/10/2026", "DL-2026-000288", "Đổi vào", "VCX-2B6T4P0W", "Ng*** T***", "+12.000", "1.000", "11.000"],
          ],
          [5, 6, 7],
        )}</div>
        <div class="the-web"><h2>Công nợ và thanh toán</h2>${hop("Chưa có công nợ (bảng chưa xác nhận).", "thong-tin")}</div>`,
      )}`),

    264: () => `<div class="day-dien-thoai">
      ${dienThoai(
        "MAN_HINH_264 · Danh sách",
        "Đối tác liên minh",
        theoTrangThai(
          `<div class="the-diem"><div class="chu-nho">Điểm VComm</div><div class="so-lon">48.250 điểm</div></div>
          <div class="the-dt"><div class="dong"><div class="gian chu-dam">Hãng bay Sao Việt</div>${nhan("Đã liên kết", "thanh-cong")}</div><div class="chu-nho">Sao Việt Miles · 0012****789 · Nguyễn T*** T***</div>
            <div class="nhom-nut"><a class="nut chinh" href="${duongDan(265)}">Đổi điểm</a>${nut("Hủy liên kết", "phu", "Đã hủy liên kết")}</div></div>
          <div class="the-dt"><div class="dong"><div class="gian chu-dam">Ngân hàng Phương Nam</div>${nhan("Chưa liên kết", "trung-tinh")}</div><div class="chu-nho">PN Rewards · đổi ra 10 điểm = 1 điểm PN · đổi vào 1 điểm PN = 12 điểm</div>
            ${nut("Liên kết", "chinh")}</div>`,
          hop("Chưa có đối tác liên minh nào.", "thong-tin"),
        ),
        "#",
      )}
      ${dienThoai(
        "MAN_HINH_264 · Liên kết bằng OTP",
        "Liên kết Phương Nam",
        `<div class="the-dt">${truong("Số thành viên PN Rewards", "9704123456")}${nut("Gửi mã xác minh", "chinh", "Phương Nam đã gửi mã tới số điện thoại đăng ký với ngân hàng")}</div>
        <div class="the-dt">${truong("Mã OTP do Phương Nam gửi", "48219", "Mã OTP không đúng hoặc đã hết hạn.")}${nut("Xác nhận liên kết", "chinh", "Đã liên kết PN Rewards")}
          <div class="chu-nho">Mã hiệu lực 5 phút. Tối đa 5 lần gửi mã mỗi giờ.</div></div>
        ${hop("Số thành viên đã liên kết với tài khoản VComm khác.", "loi")}`,
        "#",
      )}</div>`,

    265: () => `<div class="day-dien-thoai">
      ${dienThoai(
        "MAN_HINH_265 · Đổi ra",
        "Đổi điểm · Sao Việt",
        theoTrangThai(
          `<nav class="cac-the-web"><a href="#" class="chon">Đổi ra dặm</a><a href="#">Đổi vào VComm</a></nav>
          <div class="the-dt"><div class="chu-nho">10 điểm VComm = 1 dặm · bội số 1 dặm</div>${truong("Số dặm muốn nhận", "500")}
            <div class="dong"><div class="gian">Điểm VComm bị trừ</div><div class="so-am">−5.000 điểm</div></div>
            <div class="dong"><div class="gian">Còn được đổi hôm nay</div><div>495.000 điểm</div></div>
            <div class="dong"><div class="gian">Còn được đổi tháng này</div><div>1.995.000 điểm</div></div></div>
          <div class="the-dt">${truong("Mã Smart OTP trên ứng dụng", "")}<div class="chu-nho">Bạn đã kích hoạt Smart OTP nên cần nhập mã để đổi ra.</div></div>
          ${hop("Vượt giới hạn đổi điểm (giao dịch, ngày, tháng hoặc của đối tác).", "loi")}
          ${nut("Đổi 5.000 điểm lấy 500 dặm", "chinh", "Đang chờ Sao Việt xác nhận")}`,
          hop("Bạn chưa liên kết thành viên đối tác này.", "thong-tin"),
        ),
        duongDan(264),
      )}
      ${dienThoai(
        "MAN_HINH_265 · Đổi vào bằng OTP",
        "Đổi điểm · Phương Nam",
        `<nav class="cac-the-web"><a href="#">Đổi ra điểm PN</a><a href="#" class="chon">Đổi vào VComm</a></nav>
        <div class="the-dt"><div class="chu-nho">1 điểm PN = 12 điểm VComm · hạn dùng 12 tháng</div>${truong("Số điểm PN muốn đổi", "1.000")}
          <div class="dong"><div class="gian">Bạn nhận</div><div class="so-duong">+12.000 điểm VComm</div></div>
          ${nut("Yêu cầu mã OTP từ Phương Nam", "phu", "Phương Nam đã gửi mã OTP")}</div>
        <div class="the-dt">${truong("Mã OTP do Phương Nam gửi (5 phút)", "")}${nut("Xác nhận đổi", "chinh", "Đã cộng 12.000 điểm VComm")}</div>`,
        duongDan(264),
      )}
      ${dienThoai(
        "MAN_HINH_265 · Kết quả và lịch sử",
        "Lịch sử đổi điểm",
        `<div class="the-dt"><div class="dong"><div class="gian chu-dam">Đổi ra 500 dặm</div>${nhan("Chờ đối tác", "canh-bao")}</div>
          <div class="chu-nho">−5.000 điểm · DL-2026-000318 · Sao Việt chưa trả kết quả. Chúng tôi sẽ thông báo khi có kết quả; nếu không thành công, điểm được hoàn đầy đủ.</div></div>
        <div class="the-dt"><div class="dong"><div class="gian chu-dam">Đổi vào 1.000 điểm PN</div>${nhan("Hoàn tất", "thanh-cong")}</div><div class="chu-nho">+12.000 điểm · 12/11/2026 10:01 · hạn 12/11/2027</div></div>
        <div class="the-dt"><div class="dong"><div class="gian chu-dam">Phương Nam tặng</div>${nhan("Đã nhận", "thanh-cong")}</div><div class="chu-nho">+50.000 điểm · Quà mở thẻ tín dụng · 12/11/2026 08:30</div></div>
        <div class="the-dt"><div class="dong"><div class="gian chu-dam">Đổi ra 100 dặm</div>${nhan("Đã hoàn điểm", "trung-tinh")}</div><div class="chu-nho">Sao Việt từ chối · đã hoàn 1.000 điểm · 11/11/2026 16:40</div></div>`,
        duongDan(264),
      )}</div>`,
  };

  // ---------- Dựng trang ----------
  const goc = document.getElementById("ung-dung");
  const dung = () => {
    goc.innerHTML = `<div class="trang-ban-mau"><header><h1>MAN_HINH_${ma} ${TEP[ma][1]}</h1><p>CONG_VIEC_65 · dữ liệu giả · <a href="index.html">Danh sách bản mẫu</a></p></header>
      <div class="bang-chon" role="group" aria-label="Trạng thái hiển thị"><span class="nhan-bang">Trạng thái:</span>${TRANG_THAI.map(
        ([k, chu]) => `<button type="button" data-trang-thai="${k}" aria-pressed="${k === trangThai}">${chu}</button>`,
      ).join("")}
        <span class="gian"></span>${Object.keys(TEP)
          .map((m) => `<a href="${duongDan(Number(m))}">${m}</a>`)
          .join(" · ")}</div>
      ${MAN_HINH[ma]()}</div><div class="thong-bao-noi-dt" role="status" aria-live="polite"></div>`;
  };
  document.addEventListener("click", (e) => {
    const chonTrangThai = e.target.closest("[data-trang-thai]");
    if (chonTrangThai) {
      trangThai = chonTrangThai.dataset.trangThai;
      ghi("ban-mau-doi-tac-lien-minh-trang-thai", trangThai);
      dung();
      return;
    }
    const hanhDong = e.target.closest("[data-thong-bao]");
    if (hanhDong && hanhDong.dataset.thongBao) {
      hanhDong.classList.add("dang-xu-ly");
      hanhDong.disabled = true;
      setTimeout(() => {
        hanhDong.classList.remove("dang-xu-ly");
        hanhDong.disabled = false;
        const thongBao = document.querySelector(".thong-bao-noi-dt");
        thongBao.textContent = hanhDong.dataset.thongBao;
        thongBao.classList.add("hien");
        setTimeout(() => thongBao.classList.remove("hien"), 2500);
      }, 600);
    }
  });
  dung();
})();
