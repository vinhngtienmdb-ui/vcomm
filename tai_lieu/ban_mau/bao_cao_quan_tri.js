// Bản mẫu CONG_VIEC_50 (MODULE_15 Báo cáo quản trị): dựng MAN_HINH_140 đến 144 từ dữ liệu giả. Không phải mã sản phẩm.
(function () {
  const TEP = { "140": "TONG_QUAN_BAO_CAO", "141": "BAO_CAO_BAN_HANG", "142": "BAO_CAO_TON_KHO", "143": "BAO_CAO_CONG_NO", "144": "BAO_CAO_HOA_HONG" };
  const duongDan = ma => `MAN_HINH_${ma}_${TEP[ma]}.html`;
  const VAI_TRO = { "tap-doan": "Quản trị tập đoàn (phạm vi tập đoàn)", "cong-ty": "Quản trị công ty VCR (phạm vi công ty)", "kho": "Quản lý kho VCR", "ke-toan": "Kế toán VCR" };
  // Quyền theo nhóm báo cáo (CONG_VIEC_50 mục 5).
  const QUYEN = {
    "tap-doan": ["ban-hang", "ton-kho", "cong-no", "hoa-hong"], "cong-ty": ["ban-hang", "ton-kho", "cong-no", "hoa-hong"],
    "kho": ["ton-kho"], "ke-toan": ["cong-no", "hoa-hong"]
  };
  const NHOM_CUA = { "141": "ban-hang", "142": "ton-kho", "143": "cong-no", "144": "hoa-hong" };
  const MENU = [["140", "Tổng quan"], ["141", "Bán hàng"], ["142", "Tồn kho và luân chuyển"], ["143", "Công nợ theo tuổi nợ"], ["144", "Hoa hồng và ví"]];
  const CONG_TY = [["VCG", "Tập đoàn VCG (công ty gốc)", "VND"], ["VCR", "VComm Bán lẻ Miền Nam", "VND"], ["VCT", "VComm Thương mại và Phân phối Hàng tiêu dùng Toàn quốc", "VND"], ["VCS", "VComm Singapore Pte. Ltd.", "USD"]];

  const doc = (khoa, macDinh) => { try { return localStorage.getItem(khoa) || macDinh; } catch (e) { return macDinh; } };
  const ghi = (khoa, giaTri) => { try { localStorage.setItem(khoa, giaTri); } catch (e) { /* bỏ qua */ } };
  const ma = document.body.dataset.manHinh;
  let vaiTro = doc("ban-mau-bcqt-vai-tro", "tap-doan");
  let trangThai = doc("ban-mau-bcqt-trang-thai", "du-lieu");
  let nhomTheo = { "141": "cong-ty", "142": "kho", "143": "cong-ty", "144": "phan-huong" }[ma];
  const coQuyen = nhom => QUYEN[vaiTro].includes(nhom);
  const congTyDuocXem = () => (vaiTro === "tap-doan" ? CONG_TY : CONG_TY.filter(c => c[0] === "VCR"));

  const so = n => (n === null ? "—" : new Intl.NumberFormat("vi-VN", { maximumFractionDigits: 2 }).format(n));
  const thanhTren = () => `<header class="thanh-tren">
    <a class="logo" href="index.html">VComm</a><a href="index.html">Trang chủ</a><span class="gian"></span>
    <button type="button" aria-label="Chọn công ty">${vaiTro === "tap-doan" ? "Tập đoàn VCG" : "VComm Bán lẻ Miền Nam"} ▾</button>
    <a href="#">Hộp duyệt <span class="huy-hieu">3</span></a><button type="button">Thông báo</button><a href="#">Nguyễn Thị Hồng Nhung ▾</a></header>`;
  const menu = () => `<nav class="menu" aria-label="Báo cáo quản trị"><div class="ten-app">Báo cáo quản trị</div>${
    MENU.filter(([m]) => m === "140" || coQuyen(NHOM_CUA[m])).map(([m, t]) => `<a href="${duongDan(m)}" class="${m === ma ? "chon" : ""}">${t}</a>`).join("")}</nav>`;
  const tieuDe = (chu, cacNut) => `<div class="tieu-de"><h1>${chu}</h1>${cacNut || ""}</div>`;
  // Nút xuất Excel đặt trên bảng (người dùng chọn khi xem trước lát L1, 2026-11-11).
  const hangXuat = () => `<div class="nhom-nut" style="justify-content:flex-end">${nutXuat()}</div>`;
  const nutXuat = () => `<button type="button" class="nut phu" data-hanh-dong="xuat">Xuất Excel</button>`;
  const phai = 'style="text-align:right;white-space:nowrap"';
  const cotDau = 'style="min-width:240px"';
  const bang = (cot, dong, chan, ghiChu) => `<div class="khung-bang"><table><thead><tr>${cot.map((c, i) => `<th scope="col" ${i ? phai : ""}>${c}</th>`).join("")}</tr></thead>
    <tbody>${dong.map(d => `<tr>${d.map((o, i) => `<td data-nhan="${cot[i]}" ${i ? phai : cotDau}><span>${o}</span></td>`).join("")}</tr>`).join("")}</tbody>
    ${chan ? `<tfoot>${chan.map(d => `<tr>${d.map((o, i) => `<td data-nhan="${cot[i]}" ${i ? phai : ""}><strong>${o}</strong></td>`).join("")}</tr>`).join("")}</tfoot>` : ""}</table>
    ${ghiChu ? `<div class="phan-trang"><span>${ghiChu}</span></div>` : ""}</div>`;
  const chonCongTy = () => `<label for="loc-cong-ty" class="an-nhan">Công ty</label><select id="loc-cong-ty" class="o-nhap">${
    congTyDuocXem().length > 1 ? `<option>Tất cả công ty được xem (${congTyDuocXem().length})</option>` : ""}${congTyDuocXem().map(c => `<option>${c[0]} · ${c[1]}</option>`).join("")}</select>`;
  const khoangNgay = () => `<label for="tu-ngay" class="an-nhan">Từ ngày</label><input id="tu-ngay" type="date" class="o-nhap${trangThai === "loi-nhap" ? " loi" : ""}" value="${trangThai === "loi-nhap" ? "2025-10-01" : "2026-11-01"}" aria-describedby="loi-ngay">
    <label for="den-ngay" class="an-nhan">Đến ngày</label><input id="den-ngay" type="date" class="o-nhap" value="2026-11-11">`;
  const loiNgay = () => (trangThai === "loi-nhap" ? `<span id="loi-ngay" class="loi-o">Khoảng ngày tối đa 366 ngày. Hãy thu hẹp khoảng ngày.</span>` : "");
  const chonNhom = cacNhom => `<div class="cac-the" role="tablist" aria-label="Nhóm theo">${cacNhom.map(([k, t]) => `<button type="button" role="tab" data-nhom="${k}" class="${k === nhomTheo ? "chon" : ""}" aria-selected="${k === nhomTheo}">${t}</button>`).join("")}</div>`;
  const ghiChuTien = () => (vaiTro === "tap-doan" ? `<div class="khoi-canh-bao thong-tin">Đơn vị tiền: VND. VComm Singapore Pte. Ltd. hạch toán bằng USD: hiện dòng riêng, không cộng vào tổng (khác đồng tiền).</div>` : "");
  const theChiTieu = (ten, giaTri, phu, den) => `<a class="the" href="${duongDan(den)}" style="text-decoration:none;color:inherit"><span class="chu-thich">${ten}</span><strong style="font-size:20px;line-height:28px">${giaTri}</strong><span class="chu-thich">${phu}</span></a>`;
  const luoiThe = cacThe => `<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:var(--khoang-3)">${cacThe.join("")}</div>`;

  // Dữ liệu giả.
  const BAN_HANG = {
    "cong-ty": [["VCR · VComm Bán lẻ Miền Nam", 4210, 1985400000, 1402100000, 0], ["VCT · VComm Thương mại và Phân phối Hàng tiêu dùng Toàn quốc", 1630, 1240000000, 1012500000, 312000000]],
    "kenh": [["Bán buôn", 1630, 1240000000, 1012500000, 312000000], ["Bán lẻ cửa hàng", 2875, 1210300000, 860400000, 0], ["VComm (ứng dụng người mua)", 1335, 775100000, 541700000, 0]],
    "san-pham": [["SP-00125 · Nước giặt hữu cơ Bảo Ngọc hương sả chanh can 3,8 lít (thùng 4 can)", 820, 410000000, 296000000, 82000000], ["SP-00418 · Gạo ST25 túi 5 kg", 1450, 362500000, 290000000, 0], ["SP-00977 · Dầu ăn hướng dương 1 lít", 900, 81000000, 64800000, 0], ["SP-01020 · Combo quà Tết (hàng tặng)", 40, 0, 6400000, 0]],
    "ngay": [["01/11/2026", 520, 301200000, 220100000, 0], ["02/11/2026", 610, 355800000, 251400000, 41000000], ["04/11/2026", 702, 420500000, 300900000, 62000000]],
    "thang": [["09/2026", 15200, 8204000000, 5992000000, 1150000000], ["10/2026", 16950, 9120500000, 6604000000, 1312000000], ["11/2026 (đến 11/11)", 5860, 3225400000, 2414600000, 312000000]]
  };
  const veBanHang = () => {
    const tenNhom = { "cong-ty": "Công ty", "kenh": "Kênh", "san-pham": "Sản phẩm", "ngay": "Ngày", "thang": "Tháng" }[nhomTheo];
    let dong = BAN_HANG[nhomTheo];
    if (vaiTro !== "tap-doan" && nhomTheo === "cong-ty") dong = dong.filter(d => d[0].startsWith("VCR"));
    const cot = [tenNhom, "Số lượng", "Doanh số chưa thuế", "Giá vốn", "Lãi gộp", "Tỷ lệ lãi gộp", "Trong đó bán nội bộ"];
    const hang = d => [d[0], so(d[1]), so(d[2]), so(d[3]), so(d[2] - d[3]), d[2] ? so(((d[2] - d[3]) / d[2]) * 100) + "%" : "—", so(d[4])];
    const cong = dong.reduce((t, d) => [t[0] + d[1], t[1] + d[2], t[2] + d[3], t[3] + d[4]], [0, 0, 0, 0]);
    const chan = [["Cộng các công ty", so(cong[0]), so(cong[1]), so(cong[2]), so(cong[1] - cong[2]), so(((cong[1] - cong[2]) / (cong[1] || 1)) * 100) + "%", so(cong[3])]];
    if (vaiTro === "tap-doan") chan.push(["Tổng loại trừ nội bộ", "", so(cong[1] - cong[3]), "", "", "", ""]);
    const ngoaiTe = vaiTro === "tap-doan" && nhomTheo === "cong-ty" ? [["VCS · VComm Singapore Pte. Ltd. (USD, không cộng vào tổng)", so(310), so(48250.5), so(31020), so(17230.5), "35,71%", so(0)]] : [];
    return `${tieuDe("Báo cáo bán hàng")}
      <div class="the"><div class="bo-loc">${chonCongTy()}${khoangNgay()}
        <label for="kenh" class="an-nhan">Kênh</label><select id="kenh" class="o-nhap"><option>Kênh: tất cả</option><option>Bán buôn</option><option>Bán lẻ cửa hàng</option><option>VComm (ứng dụng người mua)</option></select>
        <label style="display:flex;gap:6px;align-items:center"><input type="checkbox"> Chỉ đơn VComm</label>
        <button type="button" class="nut chinh" data-hanh-dong="xem">Xem</button></div>${loiNgay()}
        <span class="chu-thich">Doanh số theo hàng đã giao: phiếu xuất giao hàng đã ghi sổ trừ hàng trả lại, theo ngày phiếu; chưa thuế giá trị gia tăng; không gồm phí giao hàng và đơn của người mua thử.</span></div><!--het-loc-->
      ${chonNhom([["cong-ty", "Công ty"], ["kenh", "Kênh"], ["san-pham", "Sản phẩm"], ["ngay", "Ngày"], ["thang", "Tháng"]])}
      ${hangXuat()}${ghiChuTien()}${bang(cot, dong.map(hang).concat(ngoaiTe), chan, nhomTheo === "san-pham" ? "Hiện 500 trên 1.284 sản phẩm, xếp theo doanh số giảm dần. Dòng tổng tính trên toàn bộ. Xuất Excel để có đủ dòng." : "")}`;
  };

  const TON_KHO = {
    "cong-ty": [["VCR · VComm Bán lẻ Miền Nam", 12400, 2205000000, 5300, 980000000, 4210, 1402100000, 13490, 1782900000, 1402100000]],
    "kho": [["KHO-HCM-01 · Kho tổng Thủ Đức (VCR)", 9800, 1720000000, 4100, 760000000, 3300, 1100000000, 10600, 1380000000, 1100000000], ["KHO-BD-01 · Kho chi nhánh Bình Dương (VCR)", 2600, 485000000, 1200, 220000000, 910, 302100000, 2890, 402900000, 302100000], ["KHO-HN-02 · Kho Long Biên (VCT, hàng ký gửi của VCR)", 0, 0, 0, 0, 0, 0, 0, 0, 0]],
    "san-pham": [["SP-00418 · Gạo ST25 túi 5 kg (KHO-HCM-01)", 3200, 640000000, 1500, 300000000, 1450, 290000000, 3250, 650000000, 290000000], ["SP-00125 · Nước giặt hữu cơ Bảo Ngọc hương sả chanh can 3,8 lít (thùng 4 can) (KHO-HCM-01)", 1100, 397000000, 600, 216000000, 820, 296000000, 880, 317000000, 296000000]]
  };
  const veTonKho = () => {
    const tenNhom = { "cong-ty": "Công ty", "kho": "Kho", "san-pham": "Sản phẩm" }[nhomTheo];
    const cot = [tenNhom, "Tồn đầu kỳ (SL)", "Tồn đầu kỳ (giá trị)", "Nhập (SL)", "Nhập (giá trị)", "Xuất (SL)", "Xuất (giá trị)", "Tồn cuối kỳ (SL)", "Tồn cuối kỳ (giá trị)", "Giá vốn hàng bán", "Vòng quay", "Số ngày tồn"];
    const hang = d => {
      const binhQuan = (d[2] + d[8]) / 2; const vong = binhQuan && d[9] ? d[9] / binhQuan : null;
      return [d[0], so(d[1]), so(d[2]), so(d[3]), so(d[4]), so(d[5]), so(d[6]), so(d[7]), so(d[8]), so(d[9]), vong === null ? "—" : so(vong), vong === null ? "—" : so(11 / vong)];
    };
    return `${tieuDe("Tồn kho và luân chuyển")}
      <div class="the"><div class="bo-loc">${chonCongTy()}<label for="kho" class="an-nhan">Kho</label><select id="kho" class="o-nhap"><option>Kho: tất cả</option><option>KHO-HCM-01 · Kho tổng Thủ Đức</option></select>${khoangNgay()}
        <button type="button" class="nut chinh" data-hanh-dong="xem">Xem</button></div>${loiNgay()}
        <span class="chu-thich">Theo thẻ kho, ngày giờ Việt Nam. Vòng quay = giá vốn hàng bán ÷ giá trị tồn bình quân ((đầu kỳ + cuối kỳ) ÷ 2); số ngày tồn = số ngày của kỳ (11) ÷ vòng quay. Chuyển kho trong cùng công ty triệt tiêu khi nhóm theo công ty.</span></div><!--het-loc-->
      ${chonNhom([["cong-ty", "Công ty"], ["kho", "Kho"], ["san-pham", "Sản phẩm"]])}
      ${hangXuat()}${bang(cot, TON_KHO[nhomTheo].map(hang), [["Tổng", "", so(2205000000), "", so(980000000), "", so(1402100000), "", so(1782900000), so(1402100000), so(0.71), so(15.49)]])}`;
  };

  const CONG_NO = {
    "cong-ty": [["VCR · VComm Bán lẻ Miền Nam", 820500000, 410000000, 210000000, 95000000, 60500000, 45000000, 12000000, 0], ["VCT · VComm Thương mại và Phân phối Hàng tiêu dùng Toàn quốc", 1340000000, 900000000, 300000000, 100000000, 40000000, 0, 0, 312000000]],
    "doi-tac": [["KH-00012 · Công ty Cổ phần Siêu thị Hạnh Phúc Xanh chi nhánh Đồng Nai (VCR)", 320000000, 120000000, 100000000, 60000000, 40000000, 0, 0, 0], ["KH-NB-VCR · VComm Bán lẻ Miền Nam (nội bộ, phải thu của VCT)", 312000000, 312000000, 0, 0, 0, 0, 0, 312000000], ["KH-00087 · Cửa hàng tạp hóa Cô Ba (VCR)", 0, 0, 0, 0, 0, 0, 12000000, 0]]
  };
  let phia = "phai-thu";
  const veCongNo = () => {
    let dong = CONG_NO[nhomTheo];
    if (vaiTro !== "tap-doan") dong = dong.filter(d => d[0].includes("VCR") && !d[0].includes("nội bộ"));
    const cot = [nhomTheo === "cong-ty" ? "Công ty" : "Đối tác", "Số dư", "Chưa đến hạn", "Quá hạn 1–30 ngày", "31–60 ngày", "61–90 ngày", "Trên 90 ngày", "Trả trước", "Trong đó nội bộ"];
    return `${tieuDe("Công nợ theo tuổi nợ")}
      ${luoiThe([theChiTieu("Phải thu", so(2160500000) + " ₫", "Trong đó quá hạn: " + so(340500000) + " ₫", "143"), theChiTieu("Phải trả", so(1874000000) + " ₫", "Trong đó quá hạn: " + so(122000000) + " ₫", "143")])}
      <div class="the"><div class="bo-loc">${chonCongTy()}
        <div class="cac-the" role="tablist" aria-label="Loại công nợ"><button type="button" class="${phia === "phai-thu" ? "chon" : ""}" data-phia="phai-thu">Phải thu</button><button type="button" class="${phia === "phai-tra" ? "chon" : ""}" data-phia="phai-tra">Phải trả</button></div>
        <button type="button" class="nut chinh" data-hanh-dong="xem">Xem</button></div>
        <span class="chu-thich">Tính tại hôm nay 11/11/2026, cùng cách tính tuổi nợ của sổ công nợ (theo hạn thanh toán, trên số còn lại).</span></div><!--het-loc-->
      ${chonNhom([["cong-ty", "Theo công ty"], ["doi-tac", "Theo đối tác"]])}${hangXuat()}${ghiChuTien()}
      ${bang(cot, dong.map(d => [d[0], ...d.slice(1).map(so)]), vaiTro === "tap-doan" ? [["Cộng các công ty", so(2160500000), so(1310000000), so(510000000), so(195000000), so(100500000), so(45000000), so(12000000), so(312000000)], ["Tổng loại trừ nội bộ", so(1848500000), "", "", "", "", "", "", ""]] : null)}`;
  };

  const HOA_HONG = {
    "phan-huong": [["Giới thiệu", 128, 18450000], ["Nhân viên", 96, 22100000], ["Trưởng nhóm", 40, 6200000], ["Giám đốc vùng", 22, 3150000], ["Giám đốc", 12, 1900000]],
    "nguoi-huong": [["Trần Thị Ngọc Bích (giới thiệu)", 34, 6120000], ["Lê Hoàng Phương Nam (nhân viên)", 28, 5480000], ["Nguyễn Văn An (giám đốc vùng)", 22, 3150000]]
  };
  const veHoaHong = () => {
    const cot = [nhomTheo === "phan-huong" ? "Loại phần hưởng" : "Người hưởng", "Số dòng hoa hồng", "Hoa hồng đã ghi có"];
    return `${tieuDe("Hoa hồng và ví")}
      <div class="the"><div class="bo-loc">${khoangNgay()}<button type="button" class="nut chinh" data-hanh-dong="xem">Xem</button></div>${loiNgay()}
        <span class="chu-thich">Công ty vận hành VComm: VComm Bán lẻ Miền Nam. Đã ghi có, đã chi theo kỳ; đang chờ và số dư ví tại hôm nay.</span></div><!--het-loc-->
      ${luoiThe([theChiTieu("Hoa hồng đã ghi có trong kỳ", so(51800000) + " ₫", "298 dòng", "144"), theChiTieu("Hoa hồng đang chờ", so(14250000) + " ₫", "Đơn chưa hoàn tất", "144"),
        theChiTieu("Rút tiền đã chi trong kỳ", so(38000000) + " ₫", "Thuế " + so(1200000) + " ₫ · Phí " + so(55000) + " ₫ · Thực nhận " + so(36745000) + " ₫", "144"), theChiTieu("Tổng số dư ví", so(27630000) + " ₫", "Rút đang chờ duyệt: 2 yêu cầu, " + so(4500000) + " ₫", "144")])}
      ${chonNhom([["phan-huong", "Theo loại phần hưởng"], ["nguoi-huong", "Theo người hưởng"]])}${hangXuat()}
      ${bang(cot, HOA_HONG[nhomTheo].map(d => [d[0], so(d[1]), so(d[2])]), [["Tổng", so(298), so(51800000)]])}
      <h2>Rút tiền đã chi trong kỳ</h2>
      ${bang(["Người hưởng", "Ngày chi", "Số tiền", "Thuế thu nhập cá nhân", "Phí", "Thực nhận"], [["Trần Thị Ngọc Bích", "05/11/2026", so(12000000), so(1200000), so(22000), so(10778000)], ["Lê Hoàng Phương Nam", "08/11/2026", so(26000000), so(0), so(33000), so(25967000)]], [["Tổng", "", so(38000000), so(1200000), so(55000), so(36745000)]])}`;
  };

  const veTongQuan = () => {
    const the = [];
    if (coQuyen("ban-hang")) the.push(theChiTieu("Doanh số chưa thuế", so(3225400000) + " ₫", "Lãi gộp " + so(810800000) + " ₫ (25,14%)", "141"));
    if (coQuyen("ton-kho")) the.push(theChiTieu("Giá trị tồn cuối kỳ", so(1782900000) + " ₫", "Vòng quay 0,71 · 15,49 ngày tồn", "142"));
    if (coQuyen("cong-no")) the.push(theChiTieu("Phải thu", so(2160500000) + " ₫", "Quá hạn " + so(340500000) + " ₫", "143"), theChiTieu("Phải trả", so(1874000000) + " ₫", "Quá hạn " + so(122000000) + " ₫", "143"));
    if (coQuyen("hoa-hong")) the.push(theChiTieu("Hoa hồng đã ghi có", so(51800000) + " ₫", "Số dư ví " + so(27630000) + " ₫", "144"));
    const bangCongTy = coQuyen("ban-hang") ? `<h2>Doanh số theo công ty</h2>${bang(["Công ty", "Doanh số chưa thuế", "Lãi gộp", "Trong đó bán nội bộ"],
      BAN_HANG["cong-ty"].filter(d => vaiTro === "tap-doan" || d[0].startsWith("VCR")).map(d => [d[0], so(d[2]), so(d[2] - d[3]), so(d[4])]))}` : "";
    return `${tieuDe("Tổng quan báo cáo quản trị")}
      <div class="the"><div class="bo-loc">${chonCongTy()}${khoangNgay()}<button type="button" class="nut chinh" data-hanh-dong="xem">Xem</button></div>${loiNgay()}</div><!--het-loc-->
      ${ghiChuTien()}${luoiThe(the)}${bangCongTy}`;
  };

  const VE = { "140": veTongQuan, "141": veBanHang, "142": veTonKho, "143": veCongNo, "144": veHoaHong };
  const TRANG_THAI = {
    "rong": () => `<div class="trang-thai-trong"><div class="hinh"></div><h2>Không có số liệu trong khoảng đã chọn</h2><p style="margin:0">Chưa có phiếu đã ghi sổ trong khoảng ngày này. Hãy chọn khoảng ngày hoặc công ty khác.</p></div>`,
    "dang-tai": () => `<div class="the" aria-busy="true"><div class="xuong" style="width:40%"></div><div class="xuong"></div><div class="xuong"></div><div class="xuong" style="width:70%"></div></div>`,
    "loi": () => `<div class="khoi-canh-bao loi" role="alert">Không tải được báo cáo. Kiểm tra kết nối rồi bấm Thử lại; lỗi lặp lại thì báo quản trị hệ thống. <button type="button" class="nut phu" data-hanh-dong="xem">Thử lại</button></div>`,
    "khong-quyen": () => `<div class="trang-thai-trong"><h2>Bạn không có quyền xem báo cáo này</h2><p style="margin:0">Liên hệ quản trị công ty nếu bạn cần quyền này.</p><a class="nut chinh" href="${duongDan("140")}">Về tổng quan</a></div>`
  };

  function veTrang() {
    const khongQuyen = NHOM_CUA[ma] && !coQuyen(NHOM_CUA[ma]);
    const tt = khongQuyen ? "khong-quyen" : trangThai;
    let noiDung;
    if (["du-lieu", "loi-nhap", "qua-dong"].includes(tt)) noiDung = VE[ma]();
    else if (tt === "khong-quyen") noiDung = `${tieuDe(MENU.find(m => m[0] === ma)[1])}${TRANG_THAI[tt]()}`;
    else {
      // Giữ thanh lọc để người dùng đổi khoảng ngày khi rỗng hoặc lỗi.
      const day = VE[ma]();
      noiDung = day.slice(0, day.indexOf("<!--het-loc-->")) + TRANG_THAI[tt]();
    }
    document.getElementById("ung-dung").innerHTML = `${thanhTren()}<div class="than">${menu()}<main class="noi-dung">${noiDung}</main></div><div class="vung-thong-bao" id="vung-thong-bao" aria-live="polite"></div>`;
  }
  function thongBao(chu, loai) {
    const o = document.createElement("div");
    o.className = `thong-bao-noi ${loai || "thanh-cong"}`; o.textContent = chu; document.getElementById("vung-thong-bao").appendChild(o);
    setTimeout(() => o.remove(), 5000);
  }
  document.addEventListener("click", e => {
    const tab = e.target.closest("[data-nhom]"); if (tab) { nhomTheo = tab.dataset.nhom; veTrang(); return; }
    const p = e.target.closest("[data-phia]"); if (p) { phia = p.dataset.phia; veTrang(); return; }
    const n = e.target.closest("[data-hanh-dong]"); if (!n || n.disabled) return;
    n.classList.add("dang-xu-ly"); n.disabled = true;
    setTimeout(() => {
      n.classList.remove("dang-xu-ly"); n.disabled = false;
      if (n.dataset.hanhDong === "xuat") thongBao(trangThai === "qua-dong" ? "Quá 20.000 dòng. Hãy thu hẹp bộ lọc rồi xuất lại." : "Đã tải tệp bao-cao-ban-hang-2026-11-01-2026-11-11.xlsx.", trangThai === "qua-dong" ? "loi" : "thanh-cong");
    }, 700);
  });

  const dk = document.createElement("div");
  dk.className = "dieu-khien";
  dk.innerHTML = `<strong>Bản mẫu</strong><a href="index.html">Mục lục</a>
    <label for="dk-vai-tro">Vai trò</label><select id="dk-vai-tro">${Object.entries(VAI_TRO).map(([k, v]) => `<option value="${k}"${k === vaiTro ? " selected" : ""}>${v}</option>`).join("")}</select>
    <label for="dk-trang-thai">Trạng thái</label><select id="dk-trang-thai">${[["du-lieu", "Có dữ liệu"], ["rong", "Rỗng"], ["dang-tai", "Đang tải"], ["loi", "Lỗi"], ["loi-nhap", "Sai khoảng ngày"], ["qua-dong", "Xuất quá 20.000 dòng"]].map(([k, v]) => `<option value="${k}"${k === trangThai ? " selected" : ""}>${v}</option>`).join("")}</select>`;
  document.body.appendChild(dk);
  dk.querySelector("#dk-vai-tro").addEventListener("change", e => { vaiTro = e.target.value; ghi("ban-mau-bcqt-vai-tro", vaiTro); veTrang(); });
  dk.querySelector("#dk-trang-thai").addEventListener("change", e => { trangThai = e.target.value; ghi("ban-mau-bcqt-trang-thai", trangThai); veTrang(); });
  veTrang();
})();
