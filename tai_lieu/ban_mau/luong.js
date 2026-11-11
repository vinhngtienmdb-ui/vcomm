// Bản mẫu MODULE_08 Nhân sự phần 3 (CONG_VIEC_48): MAN_HINH_126 đến MAN_HINH_131 từ dữ liệu giả. Không phải mã sản phẩm.
// Số liệu tính theo tham số tháng 11/2026 (CONG_VIEC_48 mục 3): ngày công chuẩn 25, giảm trừ 15,5 triệu, người phụ thuộc 6,2 triệu.
(function () {
  const TEP = {
    "114": "DANH_SACH_HO_SO_NHAN_SU", "116": "CHI_TIET_HO_SO", "117": "HOP_DONG_LAO_DONG", "119": "HO_SO_CUA_TOI",
    "126": "DANH_SACH_BANG_LUONG", "127": "CHI_TIET_BANG_LUONG", "128": "CHI_TIET_DONG_LUONG", "129": "HO_SO_LUONG_NHAN_VIEN",
    "130": "PHIEU_LUONG_CUA_TOI", "131": "THIET_LAP_LUONG"
  };
  const duongDan = ma => `MAN_HINH_${ma}_${TEP[ma]}.html`;
  const VAI_TRO = {
    "quan-ly": "Quản lý nhân sự (công ty)", "nhan-vien-ns": "Nhân viên nhân sự", "ke-toan-truong": "Kế toán trưởng (chỉ xem bảng lương)",
    "quan-tri-tap-doan": "Quản trị tập đoàn", "nhan-vien": "Nhân viên (có hồ sơ liên kết)"
  };
  // Bảng vai trò – màn hình (CONG_VIEC_48 mục 8).
  const DUOC_XEM = {
    "126": ["quan-ly", "nhan-vien-ns", "ke-toan-truong", "quan-tri-tap-doan"], "127": ["quan-ly", "nhan-vien-ns", "ke-toan-truong", "quan-tri-tap-doan"],
    "128": ["quan-ly", "nhan-vien-ns", "ke-toan-truong", "quan-tri-tap-doan"], "129": ["quan-ly", "nhan-vien-ns", "quan-tri-tap-doan"],
    "130": ["quan-ly", "nhan-vien-ns", "ke-toan-truong", "quan-tri-tap-doan", "nhan-vien"], "131": ["quan-ly", "quan-tri-tap-doan"]
  };
  const MENU = [["114", "Hồ sơ nhân sự", ["quan-ly", "nhan-vien-ns", "quan-tri-tap-doan"]], ["117", "Hợp đồng", ["quan-ly", "nhan-vien-ns", "quan-tri-tap-doan"]],
    ["126", "Bảng lương", DUOC_XEM["126"]], ["131", "Thiết lập lương", DUOC_XEM["131"]], ["130", "Hồ sơ của tôi", DUOC_XEM["130"]]];
  const doc = (khoa, macDinh) => { try { return localStorage.getItem(khoa) || macDinh; } catch (e) { return macDinh; } };
  const ghi = (khoa, giaTri) => { try { localStorage.setItem(khoa, giaTri); } catch (e) { /* bỏ qua */ } };
  const ma = document.body.dataset.manHinh;
  let vaiTro = doc("ban-mau-luong-vai-tro", "quan-ly");
  let trangThai = doc("ban-mau-luong-trang-thai", "du-lieu");
  let trangThaiBang = doc("ban-mau-luong-trang-thai-bang", "nhap");
  const coQuyen = {
    sua: () => ["quan-ly", "nhan-vien-ns", "quan-tri-tap-doan"].includes(vaiTro),
    thietLap: () => ["quan-ly", "quan-tri-tap-doan"].includes(vaiTro),
    thamSoPhapLuat: () => vaiTro === "quan-tri-tap-doan"
  };
  const duocSuaBang = () => coQuyen.sua() && ["nhap", "tu-choi"].includes(trangThaiBang);

  const thanhTren = () => `<header class="thanh-tren"><a class="logo" href="#">VComm</a><a href="#">Trang chủ</a><span class="gian"></span>
    <button type="button" aria-label="Chọn công ty">VComm Bán lẻ Miền Nam ▾</button><a href="#">Hộp duyệt <span class="huy-hieu">2</span></a>
    <button type="button">Thông báo <span class="huy-hieu">3</span></button><a href="#">Nguyễn Thị Hồng Nhung ▾</a></header>`;
  const chonMenu = m => m === ma || (["127", "128"].includes(ma) && m === "126") || (ma === "129" && m === "114");
  const menu = () => `<nav class="menu" aria-label="Nhân sự"><div class="ten-app">Nhân sự</div>${MENU.filter(([, , v]) => v.includes(vaiTro)).map(([m, t]) =>
    `<a href="${duongDan(m)}" class="${chonMenu(m) ? "chon" : ""}">${t}</a>`).join("")}</nav>`;
  const trang = noiDung => `${thanhTren()}<div class="than">${menu()}<main class="noi-dung">${noiDung}</main></div>`;
  const bang = (cot, dong, tong, cotPhai) => `<div class="khung-bang"><table><thead><tr>${cot.map((c, i) => `<th scope="col"${(cotPhai || []).includes(i) ? ' style="text-align:right"' : ""}>${c}</th>`).join("")}</tr></thead>
    <tbody>${dong.map(d => `<tr>${d.map((o, i) => `<td data-nhan="${cot[i] || ""}"${(cotPhai || []).includes(i) ? ' style="text-align:right"' : ""}><span>${o}</span></td>`).join("")}</tr>`).join("")}</tbody></table>
    ${tong ? `<div class="phan-trang"><span>${tong}</span><span>‹ 1 ›</span></div>` : ""}</div>`;
  const nut = (chu, loai, hanhDong, thongBao) => `<button type="button" class="nut ${loai}" data-hanh-dong="${hanhDong || "xu-ly"}" data-thong-bao="${thongBao || ""}">${chu}</button>`;
  const nutDen = (chu, loai, den) => `<a class="nut ${loai}" href="${duongDan(den)}">${chu}</a>`;
  const tieuDe = (chu, cacNut) => `<div class="tieu-de"><h1>${chu}</h1>${cacNut ? `<div class="nhom-nut" style="margin:0">${cacNut}</div>` : ""}</div>`;
  const nhan = (chu, loai) => `<span class="nhan ${loai}">${chu}</span>`;
  const truong = (id, nhanChu, kieu, giaTri, loi, goiY) => `<div class="truong"><label for="${id}">${nhanChu}</label>
    <input id="${id}" class="o-nhap${loi ? " loi" : ""}" type="${kieu || "text"}" value="${giaTri || ""}" ${loi ? `aria-describedby="${id}-loi"` : ""}>
    ${loi ? `<span id="${id}-loi" class="loi-o">${loi}</span>` : ""}${goiY ? `<span class="chu-thich">${goiY}</span>` : ""}</div>`;
  const luaChon = (id, nhanChu, cacGiaTri, goiY) => `<div class="truong"><label for="${id}">${nhanChu}</label><select id="${id}" class="o-nhap">${cacGiaTri.map(g => `<option>${g}</option>`).join("")}</select>${goiY ? `<span class="chu-thich">${goiY}</span>` : ""}</div>`;
  const tien = so => `${so.toLocaleString("vi-VN")}&nbsp;đ`;
  const lich = () => `<a class="nut phu" href="#" data-hanh-dong="lich-su">Lịch sử</a>`;

  const TRANG_THAI_BANG = {
    "nhap": nhan("Nháp", "trung-tinh"), "cho-duyet": nhan("Chờ duyệt", "thong-tin"), "tu-choi": nhan("Bị từ chối", "loi"),
    "da-duyet": nhan("Đã duyệt", "thanh-cong"), "da-tra": nhan("Đã trả", "thanh-cong")
  };
  // Dòng lương mẫu: [mã, họ tên, phòng ban, ngày công, lương thời gian, phụ cấp, làm thêm, cộng thêm, tổng thu nhập, bảo hiểm người lao động, thuế, khấu trừ, thực lĩnh, cảnh báo]
  const DONG = [
    ["NV000124", "Lê Thị Bích Ngọc", "Phòng Kế toán", "25/25", 16500000, 1030000, 990000, 0, 18520000, 1732500, 0, 2000000, 14787500, ""],
    ["NV000123", "Trần Minh Khoa", "Phòng Mua hàng", "25/25", 30000000, 0, 0, 0, 30000000, 3150000, 257500, 0, 26592500, ""],
    ["NV000131", "Phạm Gia Huy", "Kho Bình Dương", "24/25", 6120000, 0, 0, 0, 6120000, 0, 612000, 0, 5508000, `${nhan("Thử việc: khấu trừ 10%", "thong-tin")} ${nhan("Thiếu mã số thuế", "canh-bao")}`],
    ["NV000098", "Đỗ Quốc Bảo Nguyễn Hoàng Anh", "Phòng Kinh doanh", "10/25", 8800000, 0, 0, 0, 8800000, 0, 0, 0, 8800000, nhan("Nghỉ không lương 15 ngày: không đóng bảo hiểm", "canh-bao")]
  ];

  const nutBangLuong = () => {
    if (!coQuyen.sua()) return lich();
    const cac = {
      "nhap": `${nut("Tính lại", "phu", "xu-ly", "Đã tính lại theo hợp đồng, bảng công, tham số mới nhất. Khoản nhập tay được giữ.")}${nut("Hủy", "nguy-hiem", "huy-bang")}${nut("Gửi duyệt", "chinh", "gui-duyet")}`,
      "tu-choi": `${nut("Tính lại", "phu", "xu-ly", "Đã tính lại.")}${nut("Hủy", "nguy-hiem", "huy-bang")}${nut("Gửi lại", "chinh", "gui-duyet")}`,
      "cho-duyet": nut("Rút", "phu", "xu-ly", "Đã rút bảng lương về nháp."),
      "da-duyet": nut("Ghi đã trả lương", "chinh", "da-tra"),
      "da-tra": ""
    }[trangThaiBang];
    return `${nut("Xuất Excel", "phu", "xu-ly", "Đã tạo tệp BL-VCR-2026-000011.xlsx.")}${cac}${lich()}`;
  };

  const VE = {
    "126": () => trang(`${tieuDe("Bảng lương", coQuyen.sua() ? nut("Lập bảng lương", "chinh", "lap-bang") : "")}
      <div class="bo-loc"><label class="an-nhan" for="nam">Năm</label><select id="nam" class="o-nhap"><option>Năm 2026</option><option>Năm 2025</option></select>
      <label class="an-nhan" for="tt">Trạng thái</label><select id="tt" class="o-nhap"><option>Trạng thái: tất cả</option><option>Nháp</option><option>Chờ duyệt</option><option>Bị từ chối</option><option>Đã duyệt</option><option>Đã trả</option><option>Đã hủy</option></select></div>
      ${bang(["Tháng", "Số", "Nhân viên", "Tổng thu nhập", "Thực lĩnh", "Tổng chi phí", "Trạng thái"], [
        [`<a href="${duongDan("127")}">11/2026</a>`, "—", "4", tien(63440000), tien(55688000), tien(74367500), TRANG_THAI_BANG[trangThaiBang]],
        [`<a href="${duongDan("127")}">10/2026</a>`, "BL-VCR-2026-000010", "4", tien(61980000), tien(54412000), tien(72650400), TRANG_THAI_BANG["da-tra"]],
        [`<a href="${duongDan("127")}">09/2026</a>`, "BL-VCR-2026-000009", "3", tien(55100000), tien(48930500), tien(66104000), TRANG_THAI_BANG["da-tra"]]], "3 bảng lương", [3, 4, 5])}`),

    "127": () => {
      const sauDuyet = ["da-duyet", "da-tra"].includes(trangThaiBang);
      return trang(`${tieuDe(`Bảng lương tháng 11/2026 ${TRANG_THAI_BANG[trangThaiBang]}`, nutBangLuong())}
      ${trangThaiBang === "nhap" ? `<div class="khoi-canh-bao canh-bao">Bảng công tháng 11/2026 chưa chốt: chỉ xem trước, chưa gửi duyệt được. 3 dòng có cảnh báo.</div>` : ""}
      ${trangThaiBang === "tu-choi" ? `<div class="khoi-canh-bao loi">Giám đốc từ chối 25/11/2026: "Kiểm tra lại giờ làm thêm phòng Kế toán."</div>` : ""}
      <div class="hai-cot"><div class="the"><dl class="thong-tin-dong"><dt>Số</dt><dd>${trangThaiBang === "nhap" ? "Cấp khi gửi duyệt" : "BL-VCR-2026-000011"}</dd><dt>Công ty</dt><dd>VComm Bán lẻ Miền Nam</dd>
        <dt>Tham số áp dụng</dt><dd>Bộ hiệu lực 01/07/2026 (lương cơ sở 2.530.000 đ; vùng I 5.310.000 đ)</dd><dt>Ngày công chuẩn</dt><dd>25 (theo bảng công)</dd><dt>Tính lần cuối</dt><dd>11/11/2026 09:12 · Hồng Nhung</dd></dl></div>
        <div class="the"><dl class="thong-tin-dong"><dt>Tổng thu nhập</dt><dd>${tien(63440000)}</dd><dt>Bảo hiểm</dt><dd>${tien(4882500)}</dd><dt>Thuế</dt><dd>${tien(869500)}</dd>
        <dt>Khấu trừ</dt><dd>${tien(2000000)}</dd><dt>Thực lĩnh</dt><dd><strong>${tien(55688000)}</strong></dd><dt>Công ty đóng</dt><dd>${tien(10927500)}</dd><dt>Tổng chi phí</dt><dd><strong>${tien(74367500)}</strong></dd></dl></div></div>
      <div class="bo-loc"><label class="an-nhan" for="pb">Phòng ban</label><select id="pb" class="o-nhap"><option>Phòng ban: tất cả</option></select><label><input type="checkbox"> Chỉ dòng có cảnh báo</label></div>
      ${bang(["Mã", "Họ tên", "Phòng ban", "Ngày công", "Lương thời gian", "Phụ cấp", "Làm thêm", "Cộng thêm", "Tổng thu nhập", "Bảo hiểm", "Thuế", "Khấu trừ", "Thực lĩnh", "Cảnh báo"],
        DONG.map(d => [d[0], `<a href="${duongDan("128")}">${d[1]}</a>`, d[2], d[3], ...d.slice(4, 13).map(tien), d[13]]), "4 nhân viên", [4, 5, 6, 7, 8, 9, 10, 11, 12])}
      ${sauDuyet ? `<div class="the"><h2>Bút toán ${trangThaiBang === "da-tra" ? "" : `<span class="chu-thich">(ghi đã trả lương sẽ thêm bút toán BL-VCR-2026-000011-TT)</span>`}</h2>
        ${bang(["Số", "Ngày", "Tài khoản", "Nợ", "Có"], [
          ["BL-VCR-2026-000011", "30/11/2026", "6411 Chi phí nhân viên bán hàng", tien(14920000), ""], ["", "", "6421 Chi phí nhân viên quản lý", tien(59447500), ""],
          ["", "", "334 Phải trả người lao động", tien(7752000), tien(63440000)], ["", "", "3383 Bảo hiểm xã hội", "", tien(11857500)], ["", "", "3384 Bảo hiểm y tế", "", tien(2092500)],
          ["", "", "3386 Bảo hiểm thất nghiệp", "", tien(930000)], ["", "", "3382 Kinh phí công đoàn", "", tien(930000)], ["", "", "3335 Thuế thu nhập cá nhân", "", tien(869500)], ["", "", "3388 Phải trả, phải nộp khác", "", tien(2000000)],
          ...(trangThaiBang === "da-tra" ? [["BL-VCR-2026-000011-TT", "05/12/2026", "334 Phải trả người lao động", tien(55688000), ""], ["", "", "1121 Tiền gửi ngân hàng (Vietcombank)", "", tien(55688000)]] : [])], "", [3, 4])}
        <span class="chu-thich">Theo Thông tư 99/2025. Công ty theo Thông tư 133: chi phí 6421 (bán hàng), 6422 (quản lý), bảo hiểm thất nghiệp 3385.</span></div>` : ""}
      ${trangThaiBang !== "nhap" ? `<div class="the"><h2>Tiến trình duyệt</h2><ol class="dong-thoi-gian"><li class="xong"><span class="cham">1</span><div><strong>Kế toán trưởng</strong><div>Đồng ý 24/11/2026</div></div></li>
        <li class="${sauDuyet ? "xong" : "cho"}"><span class="cham">2</span><div><strong>Giám đốc</strong><div>${sauDuyet ? "Đồng ý 26/11/2026" : trangThaiBang === "tu-choi" ? "Từ chối 25/11/2026" : "Đang chờ"}</div></div></li></ol></div>` : ""}`);
    },

    "128": () => trang(`${tieuDe("NV000124 · Lê Thị Bích Ngọc · tháng 11/2026", `${nutDen("Về bảng lương", "phu", "127")}`)}
      <div class="hai-cot"><div class="the"><h2>Thu nhập</h2><dl class="thong-tin-dong">
        <dt>Mức lương tháng</dt><dd>${tien(16500000)} <span class="chu-thich">HDLD-2025-0031 sau PL01</span></dd><dt>Ngày công hưởng lương</dt><dd>25 / 25 chuẩn</dd>
        <dt>Lương thời gian</dt><dd>${tien(16500000)}</dd><dt>Ăn trưa</dt><dd>${tien(730000)} <span class="chu-thich">miễn thuế đến 730.000 đ</span></dd><dt>Điện thoại</dt><dd>${tien(300000)} <span class="chu-thich">chịu thuế</span></dd>
        <dt>Đơn giá giờ</dt><dd>16.500.000 / (25 × 8) = ${tien(82500)}</dd><dt>Làm thêm ngày thường</dt><dd>8 giờ × 82.500 × 150% = ${tien(990000)} <span class="chu-thich">miễn thuế ${tien(330000)}</span></dd>
        <dt>Tổng thu nhập</dt><dd><strong>${tien(18520000)}</strong></dd></dl></div>
      <div class="the"><h2>Bảo hiểm</h2><dl class="thong-tin-dong"><dt>Lương đóng bảo hiểm</dt><dd>${tien(16500000)} <span class="chu-thich">khai từ 03/2026</span></dd>
        <dt>Người lao động</dt><dd>Xã hội 8% ${tien(1320000)} · Y tế 1,5% ${tien(247500)} · Thất nghiệp 1% ${tien(165000)}</dd>
        <dt>Công ty đóng</dt><dd>Xã hội 17,5% ${tien(2887500)} · Y tế 3% ${tien(495000)} · Thất nghiệp 1% ${tien(165000)} · Kinh phí công đoàn 2% ${tien(330000)}</dd>
        <dt>Mức trần</dt><dd>Xã hội, y tế 50.600.000 đ; thất nghiệp 106.200.000 đ (vùng I)</dd></dl></div></div>
      <div class="hai-cot"><div class="the"><h2>Thuế thu nhập cá nhân (lũy tiến)</h2><dl class="thong-tin-dong"><dt>Thu nhập chịu thuế</dt><dd>18.520.000 − 730.000 − 330.000 = ${tien(17460000)}</dd>
        <dt>Bảo hiểm người lao động</dt><dd>${tien(1732500)}</dd><dt>Giảm trừ gia cảnh</dt><dd>15.500.000 + 1 người phụ thuộc × 6.200.000 = ${tien(21700000)}</dd><dt>Thu nhập tính thuế</dt><dd>${tien(0)}</dd><dt>Thuế</dt><dd>${tien(0)}</dd></dl></div>
      <div class="the"><div class="tieu-de"><h2>Khoản nhập tay</h2>${duocSuaBang() ? nut("Thêm khoản", "phu", "khoan") : ""}</div>
        ${bang(["Loại", "Nội dung", "Số tiền", ""], [["Khấu trừ · Tạm ứng", "Tạm ứng lương 15/11/2026", tien(2000000), duocSuaBang() ? `${nut("Sửa", "phu", "khoan")} ${nut("Xóa", "nguy-hiem", "xu-ly", "Đã xóa khoản. Bấm Tính lại để cập nhật.")}` : ""]], "", [2])}
        <dl class="thong-tin-dong"><dt>Thực lĩnh</dt><dd><strong>18.520.000 − 1.732.500 − 0 − 2.000.000 = ${tien(14787500)}</strong></dd></dl></div></div>`),

    "129": () => trang(`${tieuDe(`NV000131 · Phạm Gia Huy ${nhan("Đang làm", "thanh-cong")}`)}
      <div class="cac-the" role="tablist">${["Thông tin", "Giấy tờ", "Người phụ thuộc", "Quá trình công tác", "Hợp đồng", "Lương, thuế"].map((t, i) => `<button type="button" role="tab" class="${i === 5 ? "chon" : ""}" data-hanh-dong="xu-ly" data-thong-bao="Thẻ của MAN_HINH_116.">${t}</button>`).join("")}</div>
      <div class="khoi-canh-bao canh-bao">Chưa có mức lương đóng bảo hiểm. Hợp đồng thử việc HDLD-2026-0044 không đóng bảo hiểm; cần khai trước hợp đồng chính thức từ 03/12/2026.</div>
      <div class="the"><div class="tieu-de"><h2>Lương đóng bảo hiểm</h2>${nut("Khai mức mới", "phu", "khai-bh")}</div>
        ${bang(["Từ tháng", "Mức đóng", "Ghi chú", "Người khai"], [["12/2026", tien(7500000), "Theo hợp đồng chính thức dự kiến", "Hồng Nhung · 11/11/2026"]], "", [1])}
        <span class="chu-thich">Mức tại một tháng là dòng có tháng hiệu lực gần nhất. Thấp hơn lương tối thiểu vùng của chi nhánh làm việc (VCR-BD, vùng I: 5.310.000 đ) thì hiện cảnh báo.</span></div>
      <div class="hai-cot"><div class="the"><h2>Miễn đóng</h2><div class="truong"><label><input type="checkbox"> Không đóng bảo hiểm xã hội</label></div><div class="truong"><label><input type="checkbox"> Không đóng bảo hiểm y tế</label></div>
        <div class="truong"><label><input type="checkbox"> Không đóng bảo hiểm thất nghiệp</label></div>${truong("ly-do-mien", "Lý do (bắt buộc khi miễn)", "text", "", "", "Ví dụ: đã hưởng lương hưu, đang đóng ở đơn vị khác.")}</div>
      <div class="the"><h2>Thuế thu nhập cá nhân</h2>${luaChon("cach-thue", "Cách tính", ["Theo hợp đồng (thử việc, dưới 3 tháng: khấu trừ 10%; còn lại: lũy tiến)", "Luôn lũy tiến", "Luôn khấu trừ 10%"])}
        <div class="truong"><label>Cam kết 08/CK-TNCN</label><span>Chưa có</span>${nut("Ghi nhận cam kết", "phu", "cam-ket")}</div>
        <span class="chu-thich">Có cam kết của năm thì không khấu trừ 10%. Mã số thuế cá nhân: chưa có (cảnh báo trên bảng lương).</span></div></div>
      <div class="nhom-nut">${nut("Lưu", "chinh", "xu-ly", "Đã lưu hồ sơ lương.")}</div>
      <div class="the"><h2>Nhân viên thiếu mức đóng bảo hiểm</h2>${bang(["Mã", "Họ tên", "Hợp đồng hiện hành"], [["NV000131", "Phạm Gia Huy", "Thử việc đến 02/12/2026"], ["NV000140", "Ngô Thanh Hà", "Xác định thời hạn từ 15/11/2026"]], "2 nhân viên")}</div>`),

    "130": () => trang(`${tieuDe("Hồ sơ của tôi")}
      <div class="cac-the" role="tablist">${["Thông tin", "Hợp đồng", "Phiếu lương"].map((t, i) => `<button type="button" role="tab" class="${i === 2 ? "chon" : ""}" data-hanh-dong="xu-ly" data-thong-bao="Thẻ của MAN_HINH_119.">${t}</button>`).join("")}</div>
      <div class="hai-cot"><div class="the"><h2>Phiếu lương</h2>${bang(["Tháng", "Thực lĩnh", "Trạng thái"], [["<strong>11/2026</strong>", tien(14787500), nhan("Đã trả 05/12/2026", "thanh-cong")], ["<a href='#'>10/2026</a>", tien(15120000), nhan("Đã trả", "thanh-cong")]])}</div>
      <div class="the"><div class="tieu-de"><h2>Phiếu lương tháng 11/2026</h2>${nut("In", "phu", "in")}</div><dl class="thong-tin-dong">
        <dt>Họ tên</dt><dd>Lê Thị Bích Ngọc · NV000124</dd><dt>Ngày công</dt><dd>25 / 25</dd><dt>Lương thời gian</dt><dd>${tien(16500000)}</dd><dt>Phụ cấp</dt><dd>Ăn trưa ${tien(730000)} · Điện thoại ${tien(300000)}</dd>
        <dt>Làm thêm giờ</dt><dd>8 giờ ngày thường · ${tien(990000)}</dd><dt>Tổng thu nhập</dt><dd>${tien(18520000)}</dd><dt>Bảo hiểm</dt><dd>${tien(1732500)}</dd><dt>Thuế thu nhập cá nhân</dt><dd>${tien(0)}</dd>
        <dt>Khấu trừ</dt><dd>Tạm ứng ${tien(2000000)}</dd><dt>Thực lĩnh</dt><dd><strong>${tien(14787500)}</strong></dd></dl>
        <span class="chu-thich">Đã gửi tới email cá nhân ngoc.le.ca.nhan@example.com ngày 26/11/2026. Thắc mắc về lương liên hệ phòng Nhân sự.</span></div></div>`),

    "131": () => {
      const phapLuat = coQuyen.thamSoPhapLuat();
      return trang(`${tieuDe("Thiết lập lương")}
      <div class="cac-the" role="tablist">${["Tham số pháp luật", "Công ty", "Chi nhánh và phòng ban", "Loại phụ cấp"].map((t, i) => `<button type="button" role="tab" data-the="${i}" class="${i === 0 ? "chon" : ""}">${t}</button>`).join("")}</div>
      <div data-noi-dung-the="0" class="the"><div class="tieu-de"><h2>Tham số pháp luật (toàn tập đoàn)</h2>${phapLuat ? nut("Thêm bộ mới", "chinh", "bo-moi") : ""}</div>
        ${phapLuat ? "" : `<div class="khoi-canh-bao thong-tin">Chỉ quản trị có quyền thiết lập lương ở phạm vi tập đoàn được thêm bộ tham số.</div>`}
        ${bang(["Hiệu lực từ", "Lương cơ sở", "Lương tối thiểu vùng I / II / III / IV", "Giảm trừ bản thân / người phụ thuộc", "Biểu thuế", "Trạng thái"], [
          ["01/01/2027", tien(2530000), "5.700.000 / 5.080.000 / 4.450.000 / 4.040.000", "15.500.000 / 6.200.000", "5 bậc", nhan("Chưa đến ngày", "canh-bao")],
          ["01/07/2026", tien(2530000), "5.310.000 / 4.730.000 / 4.140.000 / 3.700.000", "15.500.000 / 6.200.000", "5 bậc", `${nhan("Đang áp dụng", "thanh-cong")} ${nhan("Đã dùng: không sửa", "trung-tinh")}`]], "", [1])}
        <h3 style="margin-top:12px">Chi tiết bộ 01/07/2026</h3><div><dl class="thong-tin-dong"><dt>Người lao động</dt><dd>Xã hội 8% · Y tế 1,5% · Thất nghiệp 1%</dd><dt>Công ty</dt><dd>Hưu trí, tử tuất 14% · Ốm đau, thai sản 3% · Y tế 3% · Thất nghiệp 1%</dd>
          <dt>Mức trần</dt><dd>20 × mức tham chiếu (bằng lương cơ sở) · 20 × lương cơ sở · 20 × lương tối thiểu vùng</dd><dt>Khấu trừ thu nhập vãng lai</dt><dd>10%</dd><dt>Không đóng bảo hiểm khi nghỉ không lương</dt><dd>từ 14 ngày làm việc</dd></dl><h3 style="margin-top:12px">Biểu thuế lũy tiến</h3>
          ${bang(["Bậc", "Thu nhập tính thuế/tháng đến", "Thuế suất"], [["1", "10.000.000", "5%"], ["2", "30.000.000", "10%"], ["3", "60.000.000", "20%"], ["4", "100.000.000", "30%"], ["5", "Trên 100.000.000", "35%"]])}</div></div>
      <div data-noi-dung-the="1" class="the" hidden><h2>Công ty VComm Bán lẻ Miền Nam</h2><div class="hai-cot">
        <div class="truong"><label><input type="checkbox" checked> Đóng kinh phí công đoàn 2%</label></div>${luaChon("tnld", "Tai nạn lao động, bệnh nghề nghiệp", ["0,5%", "0,3% (được cơ quan bảo hiểm chấp thuận)"])}
        ${truong("nguong", "Ngưỡng khấu trừ 10% (đồng)", "text", "2.000.000")}${truong("ngay-chuan", "Ngày công chuẩn dự phòng", "number", "26", "", "Dùng khi bảng công không có ngày công chuẩn.")}
        ${truong("hs-thuong", "Hệ số làm thêm ngày thường (%)", "number", "150")}${truong("hs-nghi", "Hệ số làm thêm ngày nghỉ hằng tuần (%)", "number", "200")}
        ${truong("hs-le", "Hệ số làm thêm ngày lễ, Tết (%)", "number", "300")}${truong("hs-dem", "Làm đêm thêm (%)", "number", "30")}${truong("hs-them-dem", "Làm thêm vào ban đêm thêm (% đơn giá ban ngày)", "number", "20")}</div>
        <div class="nhom-nut">${nut("Lưu", "chinh", "xu-ly", "Đã lưu thiết lập công ty.")}</div></div>
      <div data-noi-dung-the="2" class="the" hidden><div class="hai-cot"><div><h2>Vùng lương tối thiểu của chi nhánh</h2>
        ${bang(["Chi nhánh", "Vùng"], [["VCR-HCM", `<select class="o-nhap" aria-label="Vùng VCR-HCM"><option>Vùng I</option><option>Vùng II</option><option>Vùng III</option><option>Vùng IV</option></select>`], ["VCR-BD", `<select class="o-nhap" aria-label="Vùng VCR-BD"><option>Vùng I</option></select>`], ["VCR-HN", `<select class="o-nhap" aria-label="Vùng VCR-HN"><option>Chưa chọn</option><option>Vùng I</option></select> ${nhan("Bắt buộc trước khi tính lương", "canh-bao")}`]])}</div>
        <div><h2>Nhóm chi phí của phòng ban</h2>${bang(["Phòng ban", "Nhóm chi phí"], [["Phòng Kinh doanh", "Bán hàng"], ["Kho Bình Dương", "Bán hàng"], ["Phòng Kế toán", "Quản lý"], ["Phòng Mua hàng", "Quản lý"]].map(([p, n]) => [p, `<select class="o-nhap" aria-label="Nhóm chi phí ${p}"><option${n === "Bán hàng" ? " selected" : ""}>Bán hàng</option><option${n === "Quản lý" ? " selected" : ""}>Quản lý</option></select>`]))}
        <span class="chu-thich">Bán hàng: 6411 (Thông tư 99) hoặc 6421 (Thông tư 133). Quản lý: 6421 (Thông tư 99) hoặc 6422 (Thông tư 133). Phòng ban chưa chọn là Quản lý.</span></div></div>
        <div class="nhom-nut">${nut("Lưu", "chinh", "xu-ly", "Đã lưu.")}</div></div>
      <div data-noi-dung-the="3" class="the" hidden><div class="tieu-de"><h2>Loại phụ cấp</h2>${nut("Thêm loại", "chinh", "loai-pc")}</div>
        ${bang(["Tên", "Thuế", "Theo ngày công", "Tính vào đơn giá làm thêm", "Trạng thái", ""], [
          ["Ăn trưa", "Miễn đến 730.000 đ/tháng", "Có", "Không", nhan("Đang dùng", "thanh-cong"), nut("Sửa", "phu", "loai-pc")],
          ["Điện thoại", "Chịu thuế", "Không", "Không", nhan("Đang dùng", "thanh-cong"), nut("Sửa", "phu", "loai-pc")],
          ["Trách nhiệm", "Chịu thuế", "Có", "Có", nhan("Đang dùng", "thanh-cong"), nut("Sửa", "phu", "loai-pc")],
          ["Trang phục", "Miễn đến 416.000 đ/tháng", "Không", "Không", nhan("Ngừng", "trung-tinh"), nut("Sửa", "phu", "loai-pc")]])}</div>`);
    }
  };

  const TRANG_THAI = {
    "rong": () => `<div class="trang-thai-trong"><h2>Chưa có dữ liệu</h2><p style="margin:0">${ma === "130" ? "Chưa có phiếu lương nào được duyệt." : ma === "126" ? "Chưa có bảng lương. Bấm \"Lập bảng lương\" để bắt đầu." : "Chưa có dữ liệu."}</p></div>`,
    "dang-tai": () => `<div class="the" aria-busy="true"><p style="margin:0">Đang tải…</p></div>`,
    "loi": () => `<div class="khoi-canh-bao loi">Không tải được dữ liệu. <button type="button" class="nut phu">Thử lại</button></div>`,
    "khong-quyen": () => `<div class="trang-thai-trong"><h2>Bạn không có quyền xem trang này</h2><p style="margin:0">Liên hệ quản trị công ty nếu bạn cần quyền này.</p></div>`
  };
  const TEN = { "126": "Bảng lương", "127": "Bảng lương tháng 11/2026", "128": "Chi tiết dòng lương", "129": "Hồ sơ lương nhân viên", "130": "Hồ sơ của tôi", "131": "Thiết lập lương" };

  function veTrang() {
    const tt = !DUOC_XEM[ma].includes(vaiTro) ? "khong-quyen" : trangThai;
    const html = tt === "du-lieu" ? VE[ma]() : trang(`${tieuDe(TEN[ma])}${TRANG_THAI[tt]()}`);
    document.getElementById("ung-dung").innerHTML = html + `<div class="vung-thong-bao" id="vung-thong-bao" aria-live="polite"></div>`;
  }
  function thongBao(chu, loai) {
    const vung = document.getElementById("vung-thong-bao");
    const o = document.createElement("div"); o.className = `thong-bao-noi ${loai || "thanh-cong"}`; o.textContent = chu; vung.appendChild(o);
    setTimeout(() => o.remove(), 5000);
  }
  function moLop(html, giua) {
    const che = document.createElement("div"); che.className = `man-che${giua ? " giua" : ""}`; che.innerHTML = html;
    che.addEventListener("click", e => { if (e.target === che || e.target.dataset.dong !== undefined) che.remove(); });
    document.body.appendChild(che);
    const dauTien = che.querySelector("input, select, textarea, button"); if (dauTien) dauTien.focus();
    return che;
  }
  const ngan = (tieuDeChu, noiDung, chuNut, thongBaoChu, sauKhiLuu) => {
    const che = moLop(`<aside class="ngan-keo" role="dialog" aria-modal="true"><h2>${tieuDeChu}</h2>${noiDung}
      <div class="nhom-nut"><button type="button" class="nut phu" data-dong>Hủy</button><button type="button" class="nut chinh" data-luu>${chuNut}</button></div></aside>`);
    che.querySelector("[data-luu]").addEventListener("click", () => { che.remove(); if (sauKhiLuu) sauKhiLuu(); thongBao(thongBaoChu); });
  };
  const doiTrangThaiBang = moi => { trangThaiBang = moi; ghi("ban-mau-luong-trang-thai-bang", moi); veTrang(); };

  document.addEventListener("click", e => {
    const the = e.target.closest("[data-the]");
    if (the) {
      document.querySelectorAll("[data-the]").forEach(b => b.classList.toggle("chon", b === the));
      document.querySelectorAll("[data-noi-dung-the]").forEach(k => { k.hidden = k.dataset.noiDungThe !== the.dataset.the; });
      return;
    }
    const n = e.target.closest("[data-hanh-dong]"); if (!n || n.disabled) return;
    const hd = n.dataset.hanhDong;
    if (hd === "lich-su") { e.preventDefault(); return thongBao("Mở nhật ký thao tác của bảng lương (không ghi số tiền)."); }
    if (hd === "xu-ly") { e.preventDefault(); n.classList.add("dang-xu-ly"); n.disabled = true; setTimeout(() => { n.classList.remove("dang-xu-ly"); n.disabled = false; thongBao(n.dataset.thongBao || "Đã lưu."); }, 700); return; }
    if (hd === "in") return window.print();
    if (hd === "lap-bang") return ngan("Lập bảng lương", `${truong("thang", "Tháng", "month", "2026-11")}<div class="khoi-canh-bao thong-tin">Gồm nhân viên có hợp đồng đã ký hiệu lực trong tháng. Hệ thống tính ngay từ hợp đồng, bảng công, hồ sơ lương và tham số hiệu lực ngày cuối tháng.</div>`, "Lập và tính", "Đã lập bảng lương tháng 11/2026.", () => { location.href = duongDan("127"); });
    if (hd === "gui-duyet") {
      if (trangThaiBang === "nhap") return thongBao("Chưa gửi được: bảng công tháng 11/2026 chưa chốt.", "loi");
      return doiTrangThaiBang("cho-duyet");
    }
    if (hd === "huy-bang") return ngan("Hủy bảng lương", `<div class="truong"><label for="ly-do-huy">Lý do (bắt buộc)</label><textarea id="ly-do-huy" class="o-nhap" rows="2"></textarea></div>`, "Hủy bảng lương", "Đã hủy bảng lương.");
    if (hd === "da-tra") return ngan("Ghi đã trả lương", `${truong("ngay-tra", "Ngày trả", "date", "2026-12-05", "", "Không trước ngày duyệt 26/11/2026.")}${luaChon("quy", "Quỹ", ["Vietcombank · 0071000123456 (ngân hàng)", "Tiền mặt văn phòng HCM"])}
      <div class="khoi-canh-bao thong-tin">Ghi bút toán BL-VCR-2026-000011-TT: Nợ 334 / Có 1121 số tiền 55.688.000 đ.</div>`, "Ghi đã trả", "Đã ghi trả lương và bút toán.", () => doiTrangThaiBang("da-tra"));
    if (hd === "khoan") return ngan("Khoản nhập tay", `<div class="truong"><label for="k-loai">Loại</label><select id="k-loai" class="o-nhap"><optgroup label="Cộng thêm"><option>Thưởng</option><option>Truy lĩnh</option><option>Hoa hồng</option><option>Khác</option></optgroup><optgroup label="Khấu trừ"><option selected>Tạm ứng</option><option>Bồi thường</option><option>Đoàn phí</option><option>Khác</option></optgroup></select></div>
      ${truong("k-noi-dung", "Nội dung", "text", "Tạm ứng lương 15/11/2026")}${truong("k-tien", "Số tiền (đồng)", "text", "2.000.000")}<div class="truong"><label><input type="checkbox" checked disabled> Chịu thuế (chỉ với khoản cộng thêm)</label></div>`, "Lưu", "Đã lưu khoản. Bấm Tính lại để cập nhật.");
    if (hd === "khai-bh") return ngan("Khai lương đóng bảo hiểm", `${truong("bh-thang", "Từ tháng", "month", "2026-12")}${truong("bh-muc", "Mức đóng (đồng)", "text", "5.000.000", "Thấp hơn lương tối thiểu vùng I (5.310.000 đ) của chi nhánh VCR-BD.")}${truong("bh-gc", "Ghi chú", "text")}`, "Lưu", "Đã lưu mức đóng bảo hiểm.");
    if (hd === "cam-ket") return ngan("Ghi nhận cam kết 08/CK-TNCN", `${truong("ck-nam", "Năm áp dụng", "number", "2026")}<div class="truong"><label for="ck-tep">Tệp cam kết (PDF, JPG, PNG, tối đa 10 MB)</label><input id="ck-tep" type="file" class="o-nhap" accept=".pdf,.jpg,.jpeg,.png"></div>`, "Lưu", "Đã ghi nhận cam kết năm 2026.");
    if (hd === "loai-pc") return ngan("Loại phụ cấp", `${truong("pc-ten", "Tên", "text", "Ăn trưa")}<div class="truong"><label for="pc-thue">Thuế</label><select id="pc-thue" class="o-nhap"><option>Chịu thuế toàn bộ</option><option>Miễn thuế toàn bộ</option><option selected>Miễn đến mức mỗi tháng</option></select></div>
      ${truong("pc-muc", "Mức miễn mỗi tháng (đồng)", "text", "730.000")}<div class="truong"><label><input type="checkbox" checked> Tính theo ngày công</label></div><div class="truong"><label><input type="checkbox"> Tính vào đơn giá làm thêm giờ</label></div>
      <div class="truong"><label><input type="checkbox" checked> Đang dùng</label></div>`, "Lưu", "Đã lưu loại phụ cấp.");
    if (hd === "bo-moi") return ngan("Thêm bộ tham số pháp luật", `<div class="khoi-canh-bao thong-tin">Chép từ bộ 01/01/2027. Sửa các mức thay đổi.</div>${truong("ts-ngay", "Hiệu lực từ (ngày đầu tháng)", "date", "2027-07-01")}
      ${truong("ts-lcs", "Lương cơ sở (đồng)", "text", "2.530.000")}${truong("ts-tc", "Mức tham chiếu bảo hiểm xã hội (để trống: bằng lương cơ sở)", "text")}${truong("ts-v1", "Lương tối thiểu vùng I", "text", "5.700.000")}${truong("ts-v2", "Vùng II", "text", "5.080.000")}
      ${truong("ts-v3", "Vùng III", "text", "4.450.000")}${truong("ts-v4", "Vùng IV", "text", "4.040.000")}${truong("ts-gt", "Giảm trừ bản thân", "text", "15.500.000")}${truong("ts-pt", "Giảm trừ người phụ thuộc", "text", "6.200.000")}
      <span class="chu-thich">Tỷ lệ bảo hiểm, hệ số trần, biểu thuế sửa ở các nhóm bên dưới khi lưu.</span>`, "Lưu", "Đã thêm bộ tham số hiệu lực 01/07/2027.");
  });
  document.addEventListener("keydown", e => { if (e.key === "Escape") document.querySelectorAll(".man-che").forEach(c => c.remove()); });

  const kieu = document.createElement("style");
  kieu.textContent = "[data-noi-dung-the][hidden] { display: none; } @media print { .menu, .thanh-tren, .dieu-khien, .cac-the, .nut { display: none !important; } }";
  document.head.appendChild(kieu);
  const dk = document.createElement("div");
  dk.className = "dieu-khien";
  dk.innerHTML = `<strong>Bản mẫu</strong><a href="index.html">Mục lục</a>
    <label for="dk-vai-tro">Vai trò</label><select id="dk-vai-tro">${Object.entries(VAI_TRO).map(([k, v]) => `<option value="${k}"${k === vaiTro ? " selected" : ""}>${v}</option>`).join("")}</select>
    <label for="dk-trang-thai">Trạng thái</label><select id="dk-trang-thai">${[["du-lieu", "Có dữ liệu"], ["rong", "Rỗng"], ["dang-tai", "Đang tải"], ["loi", "Lỗi"]].map(([k, v]) => `<option value="${k}"${k === trangThai ? " selected" : ""}>${v}</option>`).join("")}</select>
    <label for="dk-bang">Bảng lương</label><select id="dk-bang">${[["nhap", "Nháp"], ["cho-duyet", "Chờ duyệt"], ["tu-choi", "Bị từ chối"], ["da-duyet", "Đã duyệt"], ["da-tra", "Đã trả"]].map(([k, v]) => `<option value="${k}"${k === trangThaiBang ? " selected" : ""}>${v}</option>`).join("")}</select>`;
  document.body.appendChild(dk);
  dk.querySelector("#dk-vai-tro").addEventListener("change", e => { vaiTro = e.target.value; ghi("ban-mau-luong-vai-tro", vaiTro); veTrang(); });
  dk.querySelector("#dk-trang-thai").addEventListener("change", e => { trangThai = e.target.value; ghi("ban-mau-luong-trang-thai", trangThai); veTrang(); });
  dk.querySelector("#dk-bang").addEventListener("change", e => doiTrangThaiBang(e.target.value));
  veTrang();
})();
