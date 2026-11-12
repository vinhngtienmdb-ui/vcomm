// Bản mẫu CONG_VIEC_58 (MODULE_14 kế hoạch mua theo ngân sách): dựng MAN_HINH_204 đến 209 từ dữ liệu giả. Không phải mã sản phẩm.
(function () {
  const TEP = { "204": "KE_HOACH_NGAN_SACH", "205": "CHI_TIET_KE_HOACH_NGAN_SACH", "206": "SO_CON_DUOC_MUA", "207": "PHIEU_DIEU_CHINH_NGAN_SACH", "208": "CHI_TIET_PHIEU_DIEU_CHINH", "209": "CANH_BAO_NGAN_SACH_DON_MUA" };
  const duongDan = ma => `MAN_HINH_${ma}_${TEP[ma]}.html`;
  const VAI_TRO = { "truong-phong": "Trưởng phòng mua hàng (lập, điều chỉnh ngân sách)", "nhan-vien": "Nhân viên mua hàng (chỉ xem ngân sách)", "khong-quyen": "Thủ kho (không có quyền ngân sách)" };
  const MENU = [["", "Đề nghị mua"], ["209", "Đơn mua"], ["", "Bảng giá mua"], ["204", "Kế hoạch ngân sách"], ["206", "Số còn được mua"], ["207", "Điều chỉnh ngân sách"]];
  const doc = (khoa, macDinh) => { try { return localStorage.getItem(khoa) || macDinh; } catch (e) { return macDinh; } };
  const ghi = (khoa, giaTri) => { try { localStorage.setItem(khoa, giaTri); } catch (e) { /* bỏ qua */ } };
  const ma = document.body.dataset.manHinh;
  let vaiTro = doc("ban-mau-nsm-vai-tro", "truong-phong");
  let trangThai = doc("ban-mau-nsm-trang-thai", "du-lieu");
  let trangThaiKeHoach = doc("ban-mau-nsm-ke-hoach", "da-duyet");
  let kyXem = "thang";
  const quanLy = () => vaiTro === "truong-phong";
  const so = n => (n === null || n === undefined ? "—" : new Intl.NumberFormat("vi-VN", { maximumFractionDigits: 0 }).format(n));
  const phai = 'style="text-align:right;white-space:nowrap"';

  const thanhTren = () => `<header class="thanh-tren"><a class="logo" href="index.html">VComm</a><a href="index.html">Trang chủ</a><span class="gian"></span>
    <button type="button" aria-label="Chọn công ty">VComm Bán lẻ Miền Nam ▾</button><a href="#">Hộp duyệt <span class="huy-hieu">2</span></a><button type="button">Thông báo</button><a href="#">Lê Văn Phúc ▾</a></header>`;
  const menu = () => `<nav class="menu" aria-label="Mua hàng"><div class="ten-app">Mua hàng</div>${MENU.map(([m, t], i) =>
    `${i === 3 ? `<div class="ten-app" style="margin-top:var(--khoang-3)">Ngân sách mua</div>` : ""}<a href="${m ? duongDan(m) : "#"}" class="${m === ma || (ma === "205" && m === "204") || (ma === "208" && m === "207") ? "chon" : ""}">${t}</a>`).join("")}</nav>`;
  const tieuDe = (chu, nut) => `<div class="tieu-de"><h1>${chu}</h1>${nut || ""}</div>`;
  const bang = (cot, dong, chan) => `<div class="khung-bang"><table><thead><tr>${cot.map((c, i) => `<th scope="col" ${i && c !== "Trạng thái" ? phai : ""}>${c}</th>`).join("")}</tr></thead>
    <tbody>${dong.map(d => `<tr>${d.map((o, i) => `<td data-nhan="${cot[i]}" ${i && cot[i] !== "Trạng thái" ? phai : ""}><span>${o}</span></td>`).join("")}</tr>`).join("")}</tbody>
    ${chan ? `<tfoot><tr>${chan.map((o, i) => `<td data-nhan="${cot[i]}" ${i ? phai : ""}><strong>${o}</strong></td>`).join("")}</tr></tfoot>` : ""}</table></div>`;
  const NHAN_TT = { "nhap": ["trung-tinh", "Nháp"], "cho-duyet": ["canh-bao", "Chờ duyệt"], "da-duyet": ["thanh-cong", "Đã duyệt"], "tu-choi": ["loi", "Bị từ chối"], "da-rut": ["trung-tinh", "Đã rút"], "da-huy": ["trung-tinh", "Đã hủy"] };
  const nhan = tt => `<span class="nhan ${NHAN_TT[tt][0]}">${NHAN_TT[tt][1]}</span>`;
  const conLai = n => (n < 0 ? `<span style="color:var(--mau-loi);font-weight:700">${so(n)}</span>` : so(n));

  // Dữ liệu giả: ô = ngành hàng cấp 1 × kho, ba tháng quý 4/2026.
  const THANG = ["10/2026", "11/2026", "12/2026"];
  const O = [
    ["TP · Thực phẩm khô", "Kho Bình Dương", [800000000, 900000000, 1200000000], [0, 100000000, 0], [790500000, 1021300000, 120000000]],
    ["TP · Thực phẩm khô", "Kho Thủ Đức", [400000000, 450000000, 600000000], [0, -100000000, 0], [388000000, 310200000, 0]],
    ["HC · Hóa mỹ phẩm", "Kho Bình Dương", [300000000, 300000000, 450000000], [0, 0, 0], [295000000, 241000000, 45000000]],
    ["DU · Đồ uống", "Kho Thủ Đức", [250000000, 280000000, 500000000], [0, 0, 0], [249800000, 0, 0]]
  ];

  const KE_HOACH = [["NSM-VCR-2026-0004", "01/2027 – 03/2027", 5200000000, 0, "nhap"], ["NSM-VCR-2026-0003", "10/2026 – 12/2026", 6430000000, 3460800000, "da-duyet"], ["NSM-VCR-2026-0002", "07/2026 – 09/2026", 5900000000, 5812400000, "da-duyet"], ["NSM-VCR-2026-0001", "07/2026 – 09/2026", 6100000000, 0, "da-huy"]];
  const ve204 = () => `${tieuDe("Kế hoạch ngân sách mua", quanLy() ? `<a class="nut chinh" href="${duongDan("205")}">Lập kế hoạch</a>` : "")}
    <div class="the"><div class="bo-loc"><label for="loc-nam" class="an-nhan">Năm</label><select id="loc-nam" class="o-nhap"><option>Năm 2026</option><option>Năm 2027</option></select>
      <label for="loc-tt" class="an-nhan">Trạng thái</label><select id="loc-tt" class="o-nhap"><option>Trạng thái: tất cả</option>${Object.values(NHAN_TT).map(v => `<option>${v[1]}</option>`).join("")}</select></div></div><!--het-loc-->
    ${bang(["Số kế hoạch", "Kỳ", "Tổng ngân sách", "Đã dùng", "Còn được mua", "Trạng thái"], KE_HOACH.map(k => [`<a href="${duongDan("205")}">${k[0]}</a>`, k[1], so(k[2]), k[4] === "da-duyet" ? so(k[3]) : "—", k[4] === "da-duyet" ? conLai(k[2] - k[3]) : "—", nhan(k[4])]))}
    <span class="chu-thich">Đơn vị: VND (đồng tiền hạch toán của công ty). Đã dùng = giá trị chưa thuế của đơn mua đã duyệt; đơn đóng sớm chỉ tính phần đã nhận.</span>`;

  const ve205 = () => {
    const sua = quanLy() && ["nhap", "tu-choi", "da-rut"].includes(trangThaiKeHoach);
    const daDuyet = trangThaiKeHoach === "da-duyet";
    const nut = !quanLy() ? "" : sua ? `<button type="button" class="nut phu" data-hanh-dong="luu">Lưu nháp</button><button type="button" class="nut chinh" data-hanh-dong="gui">Gửi duyệt</button><button type="button" class="nut nguy-hiem" data-hanh-dong="huy">Hủy kế hoạch</button>`
      : trangThaiKeHoach === "cho-duyet" ? `<button type="button" class="nut phu" data-hanh-dong="rut">Rút lại</button>` : daDuyet ? `<a class="nut phu" href="${duongDan("208")}">Lập phiếu điều chỉnh</a>` : "";
    const oNhap = (v, i) => sua ? `<label class="an-nhan" for="o-${i}">Số tiền</label><input id="o-${i}" class="o-nhap${trangThai === "loi-nhap" && i === 1 ? " loi" : ""}" style="text-align:right;min-width:130px" value="${trangThai === "loi-nhap" && i === 1 ? "-50.000.000" : so(v)}" inputmode="decimal">` : so(v);
    let stt = 0;
    const cot = ["Ngành hàng", "Kho", ...THANG, "Cộng"];
    const dong = O.map(o => [o[0], o[1], ...o[2].map((v, t) => daDuyet ? `${so(v + o[3][t])}<br><span class="chu-thich">Đã dùng ${so(o[4][t])} · Còn ${conLai(v + o[3][t] - o[4][t])}</span>` : oNhap(v, stt++)), so(o[2].reduce((a, b) => a + b, 0) + o[3].reduce((a, b) => a + b, 0))]);
    const tongThang = THANG.map((_, t) => O.reduce((s, o) => s + o[2][t] + o[3][t], 0));
    const loi = trangThai === "loi-nhap" ? `<div class="khoi-canh-bao loi" role="alert">Kế hoạch có lỗi: số tiền không được âm (Thực phẩm khô · Kho Bình Dương · 11/2026). Kỳ 01/2027 – 03/2027 trùng tháng với kế hoạch NSM-VCR-2026-0005 đang chờ duyệt.</div>` : "";
    const chinhSach = trangThai === "thieu-chinh-sach" ? `<div class="khoi-canh-bao loi" role="alert">Chưa có chính sách duyệt kế hoạch ngân sách mua. Nhờ quản trị công ty cấu hình ở Nền tảng › Chính sách duyệt.</div>` : "";
    return `${tieuDe(`Kế hoạch ${daDuyet ? "NSM-VCR-2026-0003" : "NSM-VCR-2026-0004"} ${nhan(trangThaiKeHoach)}`, `<div class="nhom-nut">${nut}</div>`)}${loi}${chinhSach}
      <div class="the"><div class="bo-loc">
        <div class="truong"><label for="tu-thang">Từ tháng</label><input id="tu-thang" type="month" class="o-nhap" value="${daDuyet ? "2026-10" : "2027-01"}" ${sua ? "" : "disabled"}></div>
        <div class="truong"><label for="den-thang">Đến tháng</label><input id="den-thang" type="month" class="o-nhap" value="${daDuyet ? "2026-12" : "2027-03"}" ${sua ? "" : "disabled"}></div>
        <div class="truong" style="flex:1"><label for="ghi-chu">Ghi chú</label><input id="ghi-chu" class="o-nhap" value="Ngân sách mua quý theo kế hoạch kinh doanh" ${sua ? "" : "disabled"}></div></div>
        <span class="chu-thich">Kỳ tối đa 12 tháng. Mỗi ô là ngành hàng cấp 1 × kho × tháng. Chỉ kế hoạch đã duyệt mới có hiệu lực; đã duyệt thì thay đổi bằng phiếu điều chỉnh.</span></div><!--het-loc-->
      ${sua ? `<div class="nhom-nut"><button type="button" class="nut phu" data-hanh-dong="them-dong">Thêm dòng ngành hàng × kho</button></div>` : ""}
      ${bang(cot, dong, ["Cộng", "", ...tongThang.map(so), so(tongThang.reduce((a, b) => a + b, 0))])}
      ${daDuyet ? `<h2>Phiếu điều chỉnh</h2>${bang(["Số phiếu", "Lý do", "Tăng", "Giảm", "Trạng thái"], [[`<a href="${duongDan("208")}">DCNS-VCR-2026-0002</a>`, "Chuyển ngân sách Thực phẩm khô từ Kho Thủ Đức sang Kho Bình Dương tháng 11", so(100000000), so(100000000), nhan("da-duyet")]])}` : ""}`;
  };

  const ve206 = () => {
    const cot = ["Ngành hàng", "Kho", "Kỳ", "Ngân sách", "Điều chỉnh", "Đã dùng", "Còn được mua", "Tỷ lệ đã dùng"];
    const dong = [];
    O.forEach(o => {
      const ky = kyXem === "thang" ? THANG.map((t, i) => [t, [i]]) : [[kyXem === "quy" ? "Quý 4/2026" : "Năm 2026 (kế hoạch quý 4)", [0, 1, 2]]];
      ky.forEach(([ten, chiSo]) => {
        const ns = chiSo.reduce((s, i) => s + o[2][i], 0), dc = chiSo.reduce((s, i) => s + o[3][i], 0), dd = chiSo.reduce((s, i) => s + o[4][i], 0);
        dong.push([o[0], o[1], `<a href="#" data-hanh-dong="xem-don">${ten}</a>`, so(ns), so(dc), so(dd), conLai(ns + dc - dd), so(Math.round((dd / (ns + dc)) * 100)) + "%"]);
      });
    });
    return `${tieuDe("Số còn được mua")}
      <div class="the"><div class="bo-loc"><label for="nam" class="an-nhan">Năm</label><select id="nam" class="o-nhap"><option>Năm 2026</option></select>
        <label for="nganh" class="an-nhan">Ngành hàng</label><select id="nganh" class="o-nhap"><option>Ngành hàng: tất cả</option><option>Thực phẩm khô</option><option>Hóa mỹ phẩm</option><option>Đồ uống</option></select>
        <label for="kho" class="an-nhan">Kho</label><select id="kho" class="o-nhap"><option>Kho: tất cả</option><option>Kho Bình Dương</option><option>Kho Thủ Đức</option></select></div>
        <span class="chu-thich">Còn được mua = ngân sách + điều chỉnh đã duyệt − đã dùng. Số âm: đơn được duyệt qua luồng vượt ngân sách.</span></div><!--het-loc-->
      <div class="cac-the" role="tablist" aria-label="Kỳ">${[["thang", "Tháng"], ["quy", "Quý"], ["nam", "Năm"]].map(([k, t]) => `<button type="button" role="tab" data-ky="${k}" class="${k === kyXem ? "chon" : ""}" aria-selected="${k === kyXem}">${t}</button>`).join("")}</div>
      ${bang(cot, dong)}`;
  };

  const ve207 = () => `${tieuDe("Điều chỉnh ngân sách", quanLy() ? `<a class="nut chinh" href="${duongDan("208")}">Lập phiếu điều chỉnh</a>` : "")}
    <div class="the"><div class="bo-loc"><label for="kh" class="an-nhan">Kế hoạch</label><select id="kh" class="o-nhap"><option>Kế hoạch: tất cả</option><option>NSM-VCR-2026-0003 (10/2026 – 12/2026)</option></select>
      <label for="tt" class="an-nhan">Trạng thái</label><select id="tt" class="o-nhap"><option>Trạng thái: tất cả</option></select></div></div><!--het-loc-->
    ${bang(["Số phiếu", "Kế hoạch", "Lý do", "Tổng tăng", "Tổng giảm", "Trạng thái"], [
      [`<a href="${duongDan("208")}">DCNS-VCR-2026-0003</a>`, "NSM-VCR-2026-0003", "Tăng ngân sách Đồ uống tháng 12 cho mùa Tết", so(150000000), so(0), nhan("cho-duyet")],
      [`<a href="${duongDan("208")}">DCNS-VCR-2026-0002</a>`, "NSM-VCR-2026-0003", "Chuyển Thực phẩm khô từ Kho Thủ Đức sang Kho Bình Dương tháng 11", so(100000000), so(100000000), nhan("da-duyet")]])}`;

  const ve208 = () => {
    const sua = quanLy() && trangThaiKeHoach !== "da-duyet";
    const dong = [["TP · Thực phẩm khô", "Kho Thủ Đức", "11/2026", "Giảm", 100000000, 450000000, 310200000], ["TP · Thực phẩm khô", "Kho Bình Dương", "11/2026", "Tăng", 100000000, 900000000, 1021300000]];
    const loi = trangThai === "loi-nhap" ? `<div class="khoi-canh-bao loi" role="alert">Dòng 1: ngân sách sau điều chỉnh (300.000.000) nhỏ hơn số đã dùng (310.200.000). Giảm tối đa 139.800.000.</div>` : "";
    return `${tieuDe(`Phiếu điều chỉnh DCNS-VCR-2026-0002 ${nhan(sua ? "nhap" : "da-duyet")}`, sua ? `<div class="nhom-nut"><button type="button" class="nut phu" data-hanh-dong="luu">Lưu nháp</button><button type="button" class="nut chinh" data-hanh-dong="gui">Gửi duyệt</button></div>` : "")}${loi}
      <div class="the"><div class="bo-loc"><div class="truong"><label for="ke-hoach">Kế hoạch</label><select id="ke-hoach" class="o-nhap" ${sua ? "" : "disabled"}><option>NSM-VCR-2026-0003 (10/2026 – 12/2026)</option></select></div>
        <div class="truong" style="flex:1"><label for="ly-do">Lý do (bắt buộc)</label><input id="ly-do" class="o-nhap" value="Chuyển Thực phẩm khô từ Kho Thủ Đức sang Kho Bình Dương tháng 11" ${sua ? "" : "disabled"}></div></div>
        <span class="chu-thich">Chuyển ngân sách = một dòng giảm, một dòng tăng. Không giảm dưới số đã dùng. Duyệt xong mới áp vào ngân sách.</span></div><!--het-loc-->
      ${sua ? `<div class="nhom-nut"><button type="button" class="nut phu" data-hanh-dong="them-dong">Thêm dòng</button></div>` : ""}
      ${bang(["Ngành hàng", "Kho", "Tháng", "Tăng/giảm", "Số tiền", "Ngân sách hiện tại", "Đã dùng", "Sau điều chỉnh"], dong.map(d => [d[0], d[1], d[2], d[3], so(d[4]), so(d[5]), so(d[6]), conLai(d[3] === "Tăng" ? d[5] + d[4] : d[5] - d[4])]))}`;
  };

  const ve209 = () => {
    const cot = ["Ngành hàng", "Kho", "Tháng", "Ngân sách", "Đã dùng (không gồm đơn này)", "Đơn này", "Còn lại sau đơn", ""];
    const dong = [["TP · Thực phẩm khô", "Kho Bình Dương", "11/2026", 1000000000, 1021300000, 85000000], ["DU · Đồ uống", "Kho Bình Dương", "11/2026", null, 0, 12000000], ["HC · Hóa mỹ phẩm", "Kho Bình Dương", "11/2026", 300000000, 241000000, 30000000]];
    const vuot = trangThai !== "trong-ngan-sach";
    const hang = vuot ? dong : [dong[2]];
    const ket = d => d[3] === null ? `<span class="nhan canh-bao">Chưa có ngân sách</span>` : d[3] - d[4] - d[5] < 0 ? `<span class="nhan loi">Vượt ngân sách</span>` : `<span class="nhan thanh-cong">Trong ngân sách</span>`;
    return `${tieuDe(`Đơn mua DM-VCR-2026-000412 ${nhan("nhap")}`, `<div class="nhom-nut"><button type="button" class="nut phu" data-hanh-dong="luu">Lưu</button><button type="button" class="nut chinh" data-hanh-dong="gui-don">Gửi duyệt</button></div>`)}
      <div class="the"><dl class="thong-tin-dong"><dt>Nhà cung cấp</dt><dd>Công ty TNHH Thực phẩm Bảo Ngọc</dd><dt>Kho nhận</dt><dd>Kho Bình Dương</dd><dt>Ngày đơn</dt><dd>12/11/2026</dd><dt>Tổng chưa thuế</dt><dd>${so(hang.reduce((s, d) => s + d[5], 0))} VND</dd></dl></div><!--het-loc-->
      <span class="chu-thich">(Bảng dòng hàng của đơn mua giữ nguyên như hiện nay.)</span>
      <section class="the" aria-labelledby="ns-tieu-de"><h2 id="ns-tieu-de">Ngân sách mua</h2>
        ${vuot ? `<div class="khoi-canh-bao canh-bao" role="status">Đơn vượt hoặc chưa có ngân sách ở 2 ô. Khi gửi duyệt, đơn sẽ đi luồng duyệt "Đơn mua vượt ngân sách".</div>` : `<div class="khoi-canh-bao thong-tin" role="status">Đơn nằm trong ngân sách.</div>`}
        ${trangThai === "thieu-chinh-sach" ? `<div class="khoi-canh-bao loi" role="alert">Không gửi duyệt được: chưa có chính sách duyệt "Đơn mua vượt ngân sách". Nhờ quản trị công ty cấu hình.</div>` : ""}
        ${bang(cot, hang.map(d => [d[0], d[1], d[2], so(d[3]), so(d[4]), so(d[5]), d[3] === null ? "—" : conLai(d[3] - d[4] - d[5]), ket(d)]))}
        <span class="chu-thich">Giá trị chưa thuế, quy đổi VND theo tỷ giá hạch toán ngày đơn. Chỉ cảnh báo, không chặn lưu.</span></section>`;
  };

  const VE = { "204": ve204, "205": ve205, "206": ve206, "207": ve207, "208": ve208, "209": ve209 };
  const TEN = { "204": "Kế hoạch ngân sách mua", "205": "Kế hoạch ngân sách mua", "206": "Số còn được mua", "207": "Điều chỉnh ngân sách", "208": "Phiếu điều chỉnh", "209": "Đơn mua" };
  const TRANG_THAI = {
    "rong": () => `<div class="trang-thai-trong"><div class="hinh"></div><h2>Chưa có kế hoạch ngân sách mua</h2><p style="margin:0">Khi chưa có kế hoạch đã duyệt cho tháng của đơn, đơn mua không kiểm tra ngân sách.</p>${quanLy() ? `<a class="nut chinh" href="${duongDan("205")}">Lập kế hoạch</a>` : ""}</div>`,
    "dang-tai": () => `<div class="the" aria-busy="true"><div class="xuong" style="width:40%"></div><div class="xuong"></div><div class="xuong"></div><div class="xuong" style="width:70%"></div></div>`,
    "loi": () => `<div class="khoi-canh-bao loi" role="alert">Không tải được dữ liệu ngân sách. Kiểm tra kết nối rồi bấm Thử lại. <button type="button" class="nut phu" data-hanh-dong="tai-lai">Thử lại</button></div>`,
    "khong-quyen": () => `<div class="trang-thai-trong"><h2>Bạn không có quyền xem ngân sách mua</h2><p style="margin:0">Liên hệ quản trị công ty nếu bạn cần quyền này.</p></div>`
  };
  function veTrang() {
    const khongQuyen = vaiTro === "khong-quyen" && ma !== "209";
    const tt = khongQuyen ? "khong-quyen" : trangThai;
    let noiDung;
    if (!TRANG_THAI[tt] || ma === "209") noiDung = VE[ma]();
    else if (tt === "khong-quyen") noiDung = tieuDe(TEN[ma]) + TRANG_THAI[tt]();
    else { const day = VE[ma](); noiDung = day.slice(0, day.indexOf("<!--het-loc-->")) + TRANG_THAI[tt](); }
    document.getElementById("ung-dung").innerHTML = `${thanhTren()}<div class="than">${menu()}<main class="noi-dung">${noiDung}</main></div><div class="vung-thong-bao" id="vung-thong-bao" aria-live="polite"></div>`;
  }
  function thongBao(chu, loai) {
    const o = document.createElement("div");
    o.className = `thong-bao-noi ${loai || "thanh-cong"}`; o.textContent = chu; document.getElementById("vung-thong-bao").appendChild(o);
    setTimeout(() => o.remove(), 5000);
  }
  const KET_QUA = { "luu": "Đã lưu nháp.", "gui": "Đã gửi duyệt.", "rut": "Đã rút lại.", "huy": "Đã hủy kế hoạch.", "them-dong": "Đã thêm dòng.", "tai-lai": "Đã tải lại.", "xem-don": "Mở danh sách 6 đơn mua đã tính vào ô này.", "gui-don": "Đã gửi duyệt theo luồng \"Đơn mua vượt ngân sách\"." };
  document.addEventListener("click", e => {
    const k = e.target.closest("[data-ky]"); if (k) { kyXem = k.dataset.ky; veTrang(); return; }
    const n = e.target.closest("[data-hanh-dong]"); if (!n || n.disabled) return;
    e.preventDefault();
    n.classList.add("dang-xu-ly"); n.disabled = true;
    setTimeout(() => {
      n.classList.remove("dang-xu-ly"); n.disabled = false;
      const loi = trangThai === "thieu-chinh-sach" && ["gui", "gui-don"].includes(n.dataset.hanhDong);
      thongBao(loi ? "Không gửi duyệt được: chưa có chính sách duyệt." : KET_QUA[n.dataset.hanhDong], loi ? "loi" : "thanh-cong");
    }, 600);
  });
  const dk = document.createElement("div");
  dk.className = "dieu-khien";
  const chon = (id, ds, giaTri) => `<select id="${id}">${ds.map(([k, v]) => `<option value="${k}"${k === giaTri ? " selected" : ""}>${v}</option>`).join("")}</select>`;
  dk.innerHTML = `<strong>Bản mẫu</strong><a href="index.html">Mục lục</a>
    <label for="dk-vai-tro">Vai trò</label>${chon("dk-vai-tro", Object.entries(VAI_TRO), vaiTro)}
    <label for="dk-trang-thai">Trạng thái</label>${chon("dk-trang-thai", [["du-lieu", "Có dữ liệu"], ["trong-ngan-sach", "Đơn trong ngân sách (209)"], ["rong", "Rỗng"], ["dang-tai", "Đang tải"], ["loi", "Lỗi"], ["loi-nhap", "Lỗi nhập"], ["thieu-chinh-sach", "Thiếu chính sách duyệt"]], trangThai)}
    <label for="dk-ke-hoach">Kế hoạch (205, 208)</label>${chon("dk-ke-hoach", Object.entries(NHAN_TT).map(([k, v]) => [k, v[1]]), trangThaiKeHoach)}`;
  document.body.appendChild(dk);
  dk.querySelector("#dk-vai-tro").addEventListener("change", e => { vaiTro = e.target.value; ghi("ban-mau-nsm-vai-tro", vaiTro); veTrang(); });
  dk.querySelector("#dk-trang-thai").addEventListener("change", e => { trangThai = e.target.value; ghi("ban-mau-nsm-trang-thai", trangThai); veTrang(); });
  dk.querySelector("#dk-ke-hoach").addEventListener("change", e => { trangThaiKeHoach = e.target.value; ghi("ban-mau-nsm-ke-hoach", trangThaiKeHoach); veTrang(); });
  veTrang();
})();
