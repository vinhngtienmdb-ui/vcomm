// Bản mẫu MODULE_13 Văn phòng số phần 2 (CONG_VIEC_59): MAN_HINH_210 đến MAN_HINH_217 từ dữ liệu giả. Không phải mã sản phẩm.
(function () {
  const TEP = {
    210: "TRINH_KY",
    211: "LAP_PHIEN_KY",
    212: "CHI_TIET_PHIEN_KY",
    213: "TRANG_KY_DOI_TAC",
    214: "KIEM_TRA_CHU_KY",
    215: "KHO_HOP_DONG",
    216: "CHI_TIET_HOP_DONG",
    217: "CAI_DAT_KY_SO",
  };
  const duongDan = (ma) => `MAN_HINH_${ma}_${TEP[ma]}.html`;
  const VAI_TRO = {
    "nhan-vien": "Nhân viên",
    "lanh-dao": "Lãnh đạo (người ký)",
    "van-thu": "Văn thư (đóng chữ ký công ty)",
    "quan-ly-hd": "Quản lý hợp đồng",
    "quan-tri": "Quản trị công ty",
    "doi-tac": "Đối tác bên ngoài (không đăng nhập)",
  };
  // Bảng vai trò – màn hình (CONG_VIEC_59 mục 8).
  const NOI_BO = ["nhan-vien", "lanh-dao", "van-thu", "quan-ly-hd", "quan-tri"];
  const DUOC_XEM = {
    210: NOI_BO,
    211: NOI_BO,
    212: NOI_BO,
    213: ["doi-tac"],
    214: NOI_BO,
    215: ["nhan-vien", "lanh-dao", "quan-ly-hd", "quan-tri"],
    216: ["nhan-vien", "lanh-dao", "quan-ly-hd", "quan-tri"],
    217: ["quan-ly-hd", "quan-tri"],
  };
  const MENU = [
    ["210", "Trình ký"],
    ["214", "Kiểm tra chữ ký"],
    ["215", "Hợp đồng"],
    ["217", "Cài đặt ký số và hợp đồng"],
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
  const ma = document.body.dataset.manHinh;
  let vaiTro = doc("ban-mau-ks-vai-tro", ma === "213" ? "doi-tac" : "nhan-vien");
  if (ma === "213") vaiTro = "doi-tac";
  else if (vaiTro === "doi-tac") vaiTro = "nhan-vien";
  let trangThai = doc("ban-mau-ks-trang-thai", "du-lieu");
  const co = {
    caiDat: () => vaiTro === "quan-tri",
    loaiHopDong: () => ["quan-ly-hd", "quan-tri"].includes(vaiTro),
    xemTatCaHopDong: () => ["quan-ly-hd", "quan-tri"].includes(vaiTro),
    dongDauCongTy: () => ["van-thu", "quan-tri"].includes(vaiTro),
    nhanSu: () => vaiTro === "quan-tri",
  };
  const tenNguoi = { "nhan-vien": "Phạm Gia Huy", "lanh-dao": "Nguyễn Văn An", "van-thu": "Mai Anh", "quan-ly-hd": "Lê Thị Bích Ngọc", "quan-tri": "Nguyễn Thị Hồng Nhung" };

  const thanhTren = () => `<header class="thanh-tren"><a class="logo" href="#">VComm</a><a href="#">Trang chủ</a><span class="gian"></span>
    <button type="button" aria-label="Chọn công ty">VComm Bán lẻ Miền Nam ▾</button><a href="#">Hộp duyệt <span class="huy-hieu">1</span></a>
    <button type="button">Thông báo <span class="huy-hieu">3</span></button><a href="#">${tenNguoi[vaiTro]} ▾</a></header>`;
  const chonMenu = (m) => m === ma || (["211", "212"].includes(ma) && m === "210") || (ma === "216" && m === "215");
  const menu = () => `<nav class="menu" aria-label="Văn phòng số"><div class="ten-app">Văn phòng số</div>
    <a href="#">Công việc</a><a href="#">Công văn đi</a>${MENU.filter(([m]) => DUOC_XEM[m].includes(vaiTro))
      .map(([m, t]) => `<a href="${duongDan(m)}" class="${chonMenu(m) ? "chon" : ""}">${t}</a>`)
      .join("")}</nav>`;
  const trang = (noiDung) => `${thanhTren()}<div class="than">${menu()}<main class="noi-dung">${noiDung}</main></div>`;
  const bang = (cot, dong, tong) => `<div class="khung-bang"><table><thead><tr>${cot.map((c) => `<th scope="col">${c}</th>`).join("")}</tr></thead>
    <tbody>${dong.map((d) => `<tr>${d.map((o, i) => `<td data-nhan="${cot[i] || ""}"><span>${o}</span></td>`).join("")}</tr>`).join("")}</tbody></table>
    ${tong ? `<div class="phan-trang"><span>${tong}</span><span>‹ 1 ›</span></div>` : ""}</div>`;
  const nut = (chu, loai, hanhDong, thongBao) => `<button type="button" class="nut ${loai}" data-hanh-dong="${hanhDong || "xu-ly"}" data-thong-bao="${thongBao || ""}">${chu}</button>`;
  const nutDen = (chu, loai, den) => `<a class="nut ${loai}" href="${duongDan(den)}">${chu}</a>`;
  const tieuDe = (chu, cacNut) => `<div class="tieu-de"><h1>${chu}</h1>${cacNut ? `<div class="nhom-nut">${cacNut}</div>` : ""}</div>`;
  const nhan = (chu, loai) => `<span class="nhan ${loai}">${chu}</span>`;
  const luaChon = (id, nhanChu, cacGiaTri) =>
    `<div class="truong"><label for="${id}">${nhanChu}</label><select id="${id}" class="o-nhap">${cacGiaTri.map((g) => `<option>${g}</option>`).join("")}</select></div>`;
  const truong = (id, nhanChu, kieu, giaTri, loi, goiY) => `<div class="truong"><label for="${id}">${nhanChu}</label>
    <input id="${id}" class="o-nhap${loi ? " loi" : ""}" type="${kieu || "text"}" value="${giaTri || ""}" ${loi ? `aria-describedby="${id}-loi"` : ""}>
    ${loi ? `<span id="${id}-loi" class="loi-o">${loi}</span>` : ""}${goiY ? `<span class="chu-thich">${goiY}</span>` : ""}</div>`;
  const vungChu = (id, nhanChu, giaTri, dong) => `<div class="truong"><label for="${id}">${nhanChu}</label><textarea id="${id}" class="o-nhap" rows="${dong || 3}">${giaTri || ""}</textarea></div>`;
  const oTep = (id, nhanChu, nhieu) => `<div class="truong"><label for="${id}">${nhanChu}</label><input id="${id}" type="file" class="o-nhap" accept=".pdf"${nhieu ? " multiple" : ""}></div>`;
  const cacThe = (ten, chon) =>
    `<div class="cac-the" role="tablist">${ten.map((t, i) => `<button type="button" role="tab" data-the="${i}" class="${i === (chon || 0) ? "chon" : ""}">${t}</button>`).join("")}</div>`;
  const noiDungThe = (i, html, an) => `<div data-noi-dung-the="${i}" ${an ? "hidden" : ""}>${html}</div>`;
  const boLoc = (cacO) => `<div class="bo-loc">${cacO}</div>`;
  const oTim = (goiY) => `<label class="an-nhan" for="tim">Tìm</label><input id="tim" class="o-nhap" placeholder="${goiY}">`;
  const chonLoc = (nhanChu, cacGiaTri) => `<select class="o-nhap" aria-label="${nhanChu}">${cacGiaTri.map((g) => `<option>${g}</option>`).join("")}</select>`;

  const TT_PHIEN = {
    nhap: nhan("Nháp", "trung-tinh"),
    dang: nhan("Đang ký", "thong-tin"),
    xong: nhan("Đã ký xong", "thanh-cong"),
    tuChoi: nhan("Bị từ chối", "loi"),
    huy: nhan("Đã hủy", "trung-tinh"),
    hetHan: nhan("Hết hạn", "canh-bao"),
  };
  const TT_HD = {
    nhap: nhan("Nháp", "trung-tinh"),
    choDuyet: nhan("Chờ duyệt", "canh-bao"),
    choKy: nhan("Chờ ký", "thong-tin"),
    daKy: nhan("Đã ký", "thanh-cong"),
    thanhLy: nhan("Đã thanh lý", "trung-tinh"),
    chamDut: nhan("Đã chấm dứt", "trung-tinh"),
  };
  const HL = { dang: nhan("Đang hiệu lực", "thanh-cong"), sap: nhan("Sắp hết hạn", "canh-bao"), het: nhan("Hết hạn", "loi"), chua: nhan("Chưa hiệu lực", "thong-tin") };
  const linkPhien = (t) => `<a href="${duongDan("212")}">${t}</a>`;
  const linkHd = (t) => `<a href="${duongDan("216")}">${t}</a>`;

  const taiKhoanKySo = () =>
    vaiTro === "nhan-vien"
      ? `<div class="khoi-canh-bao canh-bao">Bạn chưa khai tài khoản ký số. Cần khai trước khi được chọn làm người ký. ${nut("Khai tài khoản ký số", "phu", "tai-khoan")}</div>`
      : `<div class="the"><div class="tieu-de"><h2>Tài khoản ký số của tôi</h2>${nut("Đổi chứng thư", "phu", "tai-khoan")}</div>
      <dl class="thong-tin-dong"><dt>Nhà cung cấp</dt><dd>Bộ giả lập ${nhan("Môi trường thử", "canh-bao")}</dd><dt>Chứng thư</dt><dd>CN=${tenNguoi[vaiTro]}, CCCD:079****1234 · số hiệu 5A3F…91C2</dd>
      <dt>Tổ chức cấp</dt><dd>VComm CA giả lập</dd><dt>Hiệu lực</dt><dd>01/01/2026 – 31/12/2027 ${nhan("Còn hiệu lực", "thanh-cong")}</dd></dl></div>`;

  // Hình chữ ký trên trang PDF giả lập (QUYTAC_NGHIEPVU_457).
  const oChuKy = (ten, luc, congTy) => `<div style="border:1.5px solid #c0392b;color:#c0392b;padding:4px 8px;font-size:11px;line-height:1.4;width:220px;background:#fff">
    <strong>Ký bởi: ${ten}</strong><br>${congTy ? `Ký thay mặt: ${congTy}<br>` : ""}Thời gian ký: ${luc}</div>`;
  const trangPdf = (
    noiDung,
    cacO,
  ) => `<div style="background:#525659;padding:16px;border-radius:8px;overflow:auto"><div style="background:#fff;color:#000;max-width:520px;margin:0 auto;padding:28px 32px;min-height:420px;font-family:'Times New Roman',serif;font-size:13px;position:relative">
    ${noiDung}<div style="display:flex;flex-direction:column;align-items:flex-end;gap:6px;margin-top:24px">${cacO}</div></div></div>`;
  const noiDungHopDong = `<div style="text-align:center"><strong>CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM</strong><br><strong>Độc lập - Tự do - Hạnh phúc</strong></div>
    <h3 style="text-align:center;margin:16px 0 4px">HỢP ĐỒNG MUA BÁN HÀNG HÓA</h3><p style="text-align:center;margin:0">Số: 125/2026/HĐMB-VCR-TH</p>
    <p>Bên A (Bên mua): Công ty Cổ phần VComm Bán lẻ Miền Nam …</p><p>Bên B (Bên bán): Công ty TNHH Sữa Tươi Thành Hưng …</p><p>Điều 1. Hàng hóa, số lượng, giá …</p><p style="color:#666">… trang 6/6</p>`;

  const PHIEN = [
    [linkPhien("KS2026-00041"), linkPhien("Hợp đồng mua sữa tươi 2027 – Thành Hưng"), "Hợp đồng", "Công ty TNHH Sữa Tươi Thành Hưng (đối tác)", "19/11/2026", TT_PHIEN.dang],
    [linkPhien("KS2026-00040"), linkPhien("Công văn 88/VCR-KT gửi Cục Thuế"), "Công văn đi", "Nguyễn Văn An", "14/11/2026", TT_PHIEN.dang],
    [linkPhien("KS2026-00038"), linkPhien("Quy chế chi tiêu nội bộ 2027"), "Tài liệu", "Chữ ký công ty (Văn thư)", "20/11/2026", TT_PHIEN.dang],
    [linkPhien("KS2026-00031"), linkPhien("Hợp đồng lao động – Trần Minh Khoa"), "Hợp đồng lao động", "—", "05/11/2026", TT_PHIEN.xong],
    [linkPhien("KS2026-00027"), linkPhien("Biên bản bàn giao kho Bình Dương"), "Tài liệu", "—", "01/11/2026", TT_PHIEN.tuChoi],
  ];

  const HOP_DONG = [
    [linkHd("HD2026-00125"), "125/2026/HĐMB-VCR-TH", linkHd("Mua sữa tươi 2027"), "Mua hàng", "Công ty TNHH Sữa Tươi Thành Hưng", "4.800.000.000 ₫", "31/12/2027", `${TT_HD.choKy}`],
    [linkHd("HD2026-00098"), "07/2026/HĐT", linkHd("Thuê mặt bằng cửa hàng Quận 7"), "Thuê", "Bà Lê Thị Thu", "45.000.000 ₫/tháng", "30/11/2026", `${TT_HD.daKy} ${HL.sap}`],
    [linkHd("HD2026-00076"), "21/2026/HĐDV", linkHd("Dịch vụ vệ sinh văn phòng"), "Dịch vụ", "Công ty TNHH Sạch Xanh", "180.000.000 ₫", "31/12/2026", `${TT_HD.daKy} ${HL.dang}`],
    [linkHd("HD2026-00051") + " " + nhan("Mật", "loi"), "—", linkHd("Bảo mật thông tin dự án sàn mới"), "Bảo mật thông tin", "Công ty Cổ phần Công nghệ Ánh Sao", "—", "—", `${TT_HD.daKy} ${HL.dang}`],
    [linkHd("HD2025-00310"), "310/2025/HĐMB", linkHd("Bán sỉ cho chuỗi Minh Phát"), "Bán hàng", "Công ty Cổ phần Minh Phát", "2.150.000.000 ₫", "31/10/2026", `${TT_HD.daKy} ${HL.het}`],
    [linkHd("HD2026-00130"), "", linkHd("Mua bao bì giấy Quý 1/2027"), "Mua hàng", "Công ty TNHH Bao Bì Việt", "620.000.000 ₫", "31/03/2027", TT_HD.choDuyet],
  ];
  const HDLD = [
    ["HĐLĐ 015/2026", "Trần Minh Khoa", "Hợp đồng lao động xác định thời hạn", "01/12/2026", nhan("Hợp đồng lao động", "trung-tinh"), `${TT_HD.daKy} ${HL.sap}`, `<a href="#">Mở ở Nhân sự</a>`],
  ];

  const VE = {
    210: () =>
      trang(`${tieuDe("Trình ký", nutDen("Trình ký tài liệu", "chinh", "211"))}${taiKhoanKySo()}
      ${cacThe(["Chờ tôi ký", "Tôi gửi", "Đã ký"])}
      ${noiDungThe(
        0,
        vaiTro === "nhan-vien"
          ? `<div class="trang-thai-trong"><h2>Không có tài liệu chờ bạn ký</h2></div>`
          : `${co.dongDauCongTy() ? `<div class="khoi-canh-bao thong-tin">Gồm cả bước chữ ký số công ty bạn được phép đóng.</div>` : ""}
        ${bang(
          ["Mã", "Tiêu đề", "Nguồn", "Người gửi", "Hạn ký", ""],
          vaiTro === "van-thu"
            ? [
                [
                  linkPhien("KS2026-00038"),
                  linkPhien("Quy chế chi tiêu nội bộ 2027"),
                  "Tài liệu",
                  "Lê Thị Bích Ngọc",
                  "20/11/2026",
                  `${nhan("Chữ ký công ty", "thong-tin")} ${nutDen("Mở để ký", "chinh", "212")}`,
                ],
              ]
            : [
                [linkPhien("KS2026-00040"), linkPhien("Công văn 88/VCR-KT gửi Cục Thuế"), "Công văn đi", "Mai Anh (văn thư)", "14/11/2026", nutDen("Mở để ký", "chinh", "212")],
                [linkPhien("KS2026-00044"), linkPhien("Phụ lục 02 hợp đồng thuê Quận 7"), "Hợp đồng", "Lê Thị Bích Ngọc", "18/11/2026 · còn 2 ngày", nutDen("Mở để ký", "chinh", "212")],
              ],
          "",
        )}`,
      )}
      ${noiDungThe(
        1,
        `${boLoc(`${oTim("Tìm theo mã, tiêu đề…")}${chonLoc("Trạng thái", ["Trạng thái: tất cả", "Nháp", "Đang ký", "Đã ký xong", "Bị từ chối", "Đã hủy", "Hết hạn"])}${chonLoc("Nguồn", ["Nguồn: tất cả", "Tài liệu", "Hợp đồng", "Công văn đi", "Hợp đồng lao động"])}`)}
        ${bang(["Mã", "Tiêu đề", "Nguồn", "Đang đến lượt", "Hạn ký", "Trạng thái"], PHIEN, "5 phiên ký")}`,
        true,
      )}
      ${noiDungThe(2, bang(["Mã", "Tiêu đề", "Nguồn", "Tôi ký lúc", "Trạng thái phiên"], [[linkPhien("KS2026-00031"), linkPhien("Hợp đồng lao động – Trần Minh Khoa"), "Hợp đồng lao động", "03/11/2026 09:12", TT_PHIEN.xong]]), true)}`),

    211: () =>
      trang(`${tieuDe("Trình ký tài liệu", `${nut("Lưu nháp", "phu", "xu-ly", "Đã lưu nháp KS2026-00045.")}${nut("Gửi", "chinh", "gui-phien")}`)}
      <div class="the"><h2>Tài liệu</h2>${oTep("pk-tep", "Tệp PDF (tối đa 20 MB, không đặt mật khẩu)")}
        <div class="khoi-canh-bao thong-tin">quy-che-chi-tieu-2027.pdf · 6 trang · 1,2 MB · đã có 0 chữ ký số</div>
        ${truong("pk-tieu-de", "Tiêu đề", "text", "Quy chế chi tiêu nội bộ 2027")}${vungChu("pk-ghi-chu", "Ghi chú cho người ký", "Kính trình anh chị ký ban hành quy chế.", 2)}
        ${truong("pk-han", "Hạn ký", "date", "2026-11-26", "", "Mặc định 14 ngày, tối đa 60 ngày.")}</div>
      <div class="the"><div class="tieu-de"><h2>Người ký</h2><div class="nhom-nut">${nut("Thêm người trong tập đoàn", "phu", "them-nguoi")}${nut("Thêm chữ ký công ty", "phu", "xu-ly", "Đã thêm chữ ký số công ty.")}${nut("Thêm đối tác", "phu", "them-doi-tac")}</div></div>
        ${bang(
          ["Thứ tự", "Người ký", "Loại", "Trang", "Góc", ""],
          [
            ["1", "Trần Văn Lâm · Phó giám đốc", "Người dùng", "Cuối", "Dưới trái", nut("Bỏ", "phu", "xu-ly", "Đã bỏ người ký.")],
            ["2", "Nguyễn Văn An · Giám đốc", "Người dùng", "Cuối", "Dưới phải", nut("Bỏ", "phu", "xu-ly", "Đã bỏ người ký.")],
            ["3", "VComm Bán lẻ Miền Nam", "Chữ ký công ty", "Cuối", "Dưới phải", nut("Bỏ", "phu", "xu-ly", "Đã bỏ người ký.")],
          ],
        )}
        <span class="chu-thich">Người cùng số thứ tự ký song song. Nhiều chữ ký cùng trang, cùng góc thì xếp lần lượt lên trên.</span>
        <div class="khoi-canh-bao loi">Trần Văn Lâm chưa khai tài khoản ký số: chưa gửi được. Nhắc người này khai ở trang Trình ký.</div></div>
      <div class="the"><h2>Xem trước vị trí chữ ký (trang 6)</h2>${trangPdf(
        `<p>… Quy chế có hiệu lực từ ngày 01/01/2027.</p>`,
        `<div style="display:flex;justify-content:space-between;width:100%"><div style="border:1.5px dashed #888;padding:6px;font-size:11px;width:200px">1 · Trần Văn Lâm</div>
         <div style="display:flex;flex-direction:column;gap:6px"><div style="border:1.5px dashed #888;padding:6px;font-size:11px;width:200px">3 · Chữ ký công ty</div><div style="border:1.5px dashed #888;padding:6px;font-size:11px;width:200px">2 · Nguyễn Văn An</div></div></div>`,
      )}</div>`),

    212: () => {
      const toiKy = ["lanh-dao", "van-thu"].includes(vaiTro);
      const cacNut = toiKy
        ? `${nut(vaiTro === "van-thu" ? "Đóng chữ ký công ty" : "Ký số", "chinh", "ky-so")}${nut("Từ chối", "nguy-hiem", "tu-choi")}`
        : `${nut("Nhắc người đang đến lượt", "phu", "xu-ly", "Đã nhắc. Lần nhắc tiếp theo được sau 24 giờ.")}${nut("Gửi lại thư cho đối tác", "phu", "xu-ly", "Đã gửi lại thư. Đường dẫn cũ không dùng được nữa.")}${nut("Hủy phiên", "nguy-hiem", "tu-choi")}`;
      return trang(`${tieuDe(`KS2026-00041 · Hợp đồng mua sữa tươi 2027 – Thành Hưng ${TT_PHIEN.dang}`, cacNut)}
      <div class="the"><dl class="thong-tin-dong"><dt>Nguồn</dt><dd>Hợp đồng ${linkHd("HD2026-00125")}</dd><dt>Người gửi</dt><dd>Lê Thị Bích Ngọc · 12/11/2026 10:05</dd><dt>Hạn ký</dt><dd>19/11/2026</dd>
        <dt>Ghi chú</dt><dd>Hợp đồng đã duyệt theo luồng duyệt HD2026-00125.</dd><dt>Tệp</dt><dd>hop-dong-mua-sua-2027.pdf · bản sau chữ ký 1 ${nut("Tải xuống", "phu", "xu-ly", "Đã tải tệp.")}</dd></dl></div>
      ${cacThe(["Tiến trình", "Tài liệu", "Lịch sử"])}
      ${noiDungThe(
        0,
        `<div class="the"><ol class="dong-thoi-gian">
        <li class="xong"><span class="cham">1</span><div><strong>VComm Bán lẻ Miền Nam · Chữ ký công ty</strong> ${nhan("Đã ký", "thanh-cong")}<div>Mai Anh đóng lúc 12/11/2026 14:20 · chứng thư CN=CÔNG TY CỔ PHẦN VCOMM BÁN LẺ MIỀN NAM, MST:0312345678</div></div></li>
        <li><span class="cham">2</span><div><strong>Công ty TNHH Sữa Tươi Thành Hưng · đối tác</strong> ${nhan("Đang chờ xác nhận trên ứng dụng", "canh-bao")}<div>Thư gửi kinhdoanh@suathanhhung.test lúc 12/11/2026 14:21 · MST 0309876543 · mã định danh tại nhà cung cấp 0309876543</div>
          <div class="chu-thich">Lần ký 1 lúc 12/11/2026 15:02: đối tác từ chối trên ứng dụng. Lần ký 2 lúc 15:10: đang chờ (còn 4 phút 20 giây).</div></div></li></ol></div>`,
      )}
      ${noiDungThe(1, `<div class="the">${trangPdf(noiDungHopDong, oChuKy("CÔNG TY CỔ PHẦN VCOMM BÁN LẺ MIỀN NAM", "12/11/2026 14:20", "VComm Bán lẻ Miền Nam"))}</div>`, true)}
      ${noiDungThe(
        2,
        `<div class="the"><ol class="dong-thoi-gian"><li class="xong"><span class="cham">4</span><div><strong>12/11/2026 15:10 · đối tác (IP 113.161.x.x)</strong><div>Gửi yêu cầu ký lần 2 đến nhà cung cấp</div></div></li>
        <li class="xong"><span class="cham">3</span><div><strong>12/11/2026 15:02 · đối tác</strong><div>Lần ký 1 thất bại: từ chối trên ứng dụng</div></div></li>
        <li class="xong"><span class="cham">2</span><div><strong>12/11/2026 14:20 · Mai Anh</strong><div>Đóng chữ ký công ty; kiểm tra lại tệp: 1 chữ ký, toàn vẹn</div></div></li>
        <li class="xong"><span class="cham">1</span><div><strong>12/11/2026 10:05 · Lê Thị Bích Ngọc</strong><div>Lập và gửi phiên ký từ hợp đồng HD2026-00125</div></div></li></ol></div>`,
        true,
      )}`);
    },

    213: () => `<div class="trang-ngoai"><div class="the-ngoai" style="width:min(640px,100%)"><div class="logo-lon">VComm</div>
      <h1 style="margin:0;font-size:20px">Công ty Cổ phần VComm Bán lẻ Miền Nam mời quý đối tác ký số</h1>
      <dl class="thong-tin-dong"><dt>Tài liệu</dt><dd>Hợp đồng mua sữa tươi 2027 – Thành Hưng</dd><dt>Bên ký</dt><dd>Công ty TNHH Sữa Tươi Thành Hưng · MST 0309876543</dd><dt>Hạn ký</dt><dd>19/11/2026</dd>
        <dt>Ghi chú</dt><dd>Kính gửi quý công ty hợp đồng đã ký số phía VComm.</dd></dl>
      ${trangPdf(noiDungHopDong, oChuKy("CÔNG TY CỔ PHẦN VCOMM BÁN LẺ MIỀN NAM", "12/11/2026 14:20", "VComm Bán lẻ Miền Nam"))}
      <div class="khoi-canh-bao thong-tin">Khi bấm Ký số, yêu cầu xác nhận được gửi đến ứng dụng ký số từ xa của tài khoản 0309876543. Mở ứng dụng trên điện thoại để xác nhận trong 5 phút.</div>
      <div class="nhom-nut">${nut("Tải PDF", "phu", "xu-ly", "Đã tải tệp.")}${nut("Từ chối", "nguy-hiem", "tu-choi")}${nut("Ký số", "chinh", "ky-so")}</div>
      <span class="chu-thich">Đường dẫn này chỉ dùng cho bên ký nêu trên. Đường dẫn hết dùng khi đã ký, từ chối hoặc quá hạn.</span></div></div>`,

    214: () =>
      trang(`${tieuDe("Kiểm tra chữ ký số PDF")}
      <div class="the">${oTep("kt-tep", "Tệp PDF (tối đa 20 MB; hệ thống không lưu tệp)")}<div class="nhom-nut">${nut("Kiểm tra", "chinh", "xu-ly", "Đã kiểm tra: 2 chữ ký.")}</div></div>
      <div class="the"><h2>hop-dong-mua-sua-2027-da-ky.pdf · 2 chữ ký</h2>
        ${bang(
          ["#", "Người ký", "Tổ chức cấp", "Thời gian ký", "Toàn vẹn", "Hiệu lực tại lúc ký", "Tin cậy", "Kết luận"],
          [
            [
              "1",
              "CÔNG TY CỔ PHẦN VCOMM BÁN LẺ MIỀN NAM (MST 0312345678)",
              "VComm CA giả lập",
              "12/11/2026 14:20",
              nhan("Có", "thanh-cong"),
              nhan("Còn hiệu lực", "thanh-cong"),
              nhan("Không đến gốc tin cậy", "canh-bao"),
              nhan("Chưa xác định tin cậy", "canh-bao"),
            ],
            [
              "2",
              "CÔNG TY TNHH SỮA TƯƠI THÀNH HƯNG (MST 0309876543)",
              "VComm CA giả lập",
              "12/11/2026 15:11",
              nhan("Có", "thanh-cong"),
              nhan("Còn hiệu lực", "thanh-cong"),
              nhan("Không đến gốc tin cậy", "canh-bao"),
              nhan("Chưa xác định tin cậy", "canh-bao"),
            ],
          ],
        )}
        <div class="khoi-canh-bao thong-tin">Chữ ký 2 bao trùm toàn bộ tệp. Chưa kiểm tra thu hồi chứng thư.</div>
        <h3>Ví dụ tệp bị sửa sau khi ký</h3>
        ${bang(["#", "Người ký", "Toàn vẹn", "Kết luận"], [["1", "NGUYỄN VĂN AN", nhan("Không: nội dung đã bị thay đổi sau khi ký", "loi"), nhan("Không hợp lệ", "loi")]])}
        <div class="khoi-canh-bao canh-bao">Sau chữ ký 1, tệp còn được bổ sung nội dung không có chữ ký.</div></div>`),

    215: () =>
      trang(`${tieuDe("Hợp đồng", `${nut("Nhập hợp đồng đã ký", "phu", "nhap-hd")}${nut("Lập hợp đồng", "chinh", "lap-hd")}`)}
      <div class="luoi-app" style="grid-template-columns:repeat(auto-fit,minmax(160px,1fr))">
        <div class="the"><span class="chu-thich">Đang hiệu lực</span><strong style="font-size:24px">42</strong></div>
        <div class="the"><span class="chu-thich">Sắp hết hạn (30 ngày)</span><strong style="font-size:24px">3</strong></div>
        <div class="the"><span class="chu-thich">Hết hạn chưa thanh lý</span><strong style="font-size:24px">5</strong></div>
        <div class="the"><span class="chu-thich">Chờ duyệt, chờ ký</span><strong style="font-size:24px">4</strong></div></div>
      ${boLoc(`${oTim("Tìm theo mã, số, tên, đối tác…")}${chonLoc("Loại", ["Loại: tất cả", "Mua hàng", "Bán hàng", "Dịch vụ", "Thuê", "Hợp tác", "Bảo mật thông tin", "Khác", ...(co.nhanSu() ? ["Hợp đồng lao động"] : [])])}
        ${chonLoc("Trạng thái", ["Trạng thái: tất cả", "Nháp", "Chờ duyệt", "Chờ ký", "Đã ký", "Đã thanh lý", "Đã chấm dứt"])}${chonLoc("Hiệu lực", ["Hiệu lực: tất cả", "Chưa hiệu lực", "Đang hiệu lực", "Sắp hết hạn", "Hết hạn"])}
        ${chonLoc("Người phụ trách", ["Người phụ trách: tất cả", "Của tôi"])}`)}
      ${co.xemTatCaHopDong() ? "" : `<div class="khoi-canh-bao thong-tin">Bạn thấy hợp đồng bạn lập, phụ trách, duyệt, ký hoặc được chia sẻ.</div>`}
      ${bang(["Mã", "Số hợp đồng", "Tên", "Loại", "Đối tác", "Giá trị", "Hết hạn", "Trạng thái"], co.xemTatCaHopDong() ? HOP_DONG : HOP_DONG.slice(0, 2), co.xemTatCaHopDong() ? "6 hợp đồng" : "2 hợp đồng")}
      ${co.nhanSu() ? `<h2>Hợp đồng lao động (chỉ đọc, theo quyền Nhân sự)</h2>${bang(["Số", "Nhân viên", "Loại", "Hết hạn", "Nguồn", "Trạng thái", ""], HDLD)}` : ""}`),

    216: () => {
      const quanLy = co.xemTatCaHopDong();
      return trang(`${tieuDe(
        `HD2026-00098 · Thuê mặt bằng cửa hàng Quận 7 ${TT_HD.daKy} ${HL.sap}`,
        `${nut("Lập phụ lục", "phu", "phu-luc")}${nut("Chia sẻ", "phu", "chia-se")}${quanLy || vaiTro === "nhan-vien" ? nut("Thanh lý", "phu", "thanh-ly") + nut("Chấm dứt", "nguy-hiem", "thanh-ly") : ""}`,
      )}
      <div class="khoi-canh-bao canh-bao">Hết hạn ngày 30/11/2026 (còn 18 ngày). Đã nhắc mốc 30 ngày lúc 31/10/2026 07:00.</div>
      <div class="the"><dl class="thong-tin-dong"><dt>Số hợp đồng</dt><dd>07/2026/HĐT</dd><dt>Loại</dt><dd>Thuê (công ty trả tiền)</dd><dt>Đối tác</dt><dd>Bà Lê Thị Thu · cá nhân</dd>
        <dt>Giá trị</dt><dd>45.000.000 ₫ mỗi tháng · tổng 540.000.000 ₫</dd><dt>Ngày ký</dt><dd>25/11/2025</dd><dt>Hiệu lực</dt><dd>01/12/2025 – 30/11/2026</dd>
        <dt>Người phụ trách</dt><dd>Phạm Gia Huy · Phòng Hành chính</dd><dt>Mật</dt><dd>Không</dd><dt>Nhắc trước</dt><dd>30 ngày, 7 ngày ${nut("Sửa", "phu", "nhac")}</dd></dl></div>
      ${cacThe(["Tệp", "Phụ lục", "Duyệt và ký", "Chia sẻ", "Lịch sử"])}
      ${noiDungThe(
        0,
        `<div class="the">${bang(
          ["Tệp", "Loại", "Chữ ký số", ""],
          [
            [
              "hop-dong-thue-q7-da-ky.pdf",
              "Bản đã ký",
              `${nhan("2 chữ ký · Chưa xác định tin cậy", "canh-bao")} <a href="${duongDan("214")}">Chi tiết</a>`,
              nut("Tải xuống", "phu", "xu-ly", "Đã tải tệp. Đã ghi nhật ký."),
            ],
            ["hop-dong-thue-q7.pdf", "Tệp nội dung", "Không có", nut("Tải xuống", "phu", "xu-ly", "Đã tải tệp.")],
            ["giay-chung-nhan-quyen-su-dung-dat.pdf", "Kèm theo", "Không có", nut("Tải xuống", "phu", "xu-ly", "Đã tải tệp.")],
          ],
        )}${nut("Tải tệp kèm theo", "phu", "xu-ly", "Đã tải tệp lên.")}</div>`,
      )}
      ${noiDungThe(
        1,
        `<div class="the">${bang(
          ["Số phụ lục", "Nội dung", "Hiệu lực", "Thay đổi", "Trạng thái"],
          [
            ["02", "Gia hạn thuê 12 tháng, giá 47.000.000 ₫/tháng", "01/12/2026", "Hết hạn → 30/11/2027; giá trị → 564.000.000 ₫", `${TT_HD.choKy} ${linkPhien("KS2026-00044")}`],
            ["01", "Đổi số tài khoản nhận tiền", "01/03/2026", "Không", TT_HD.daKy],
          ],
        )}
        <span class="chu-thich">Phụ lục 02 ký xong thì hợp đồng hết hạn 30/11/2027 và không nhắc mốc 7 ngày.</span></div>`,
        true,
      )}
      ${noiDungThe(
        2,
        `<div class="the"><ol class="dong-thoi-gian"><li class="xong"><span class="cham">1</span><div><strong>Duyệt</strong> ${nhan("Đã duyệt", "thanh-cong")}<div>Trưởng phòng Hành chính Trần Văn Lâm · 20/11/2025</div></div></li>
        <li class="xong"><span class="cham">2</span><div><strong>Phiên ký ${linkPhien("KS2025-00102")}</strong> ${TT_PHIEN.xong}<div>Chữ ký công ty 24/11/2025 · Bà Lê Thị Thu (đối tác) 25/11/2025</div></div></li></ol></div>`,
        true,
      )}
      ${noiDungThe(
        3,
        `<div class="the">${bang(
          ["Người", "Lý do được xem", ""],
          [
            ["Phạm Gia Huy", "Người phụ trách", ""],
            ["Trần Văn Lâm", "Người duyệt", ""],
            ["Mai Anh", "Người ký (chữ ký công ty)", ""],
            ["Lê Thị Bích Ngọc", "Được chia sẻ", nut("Bỏ chia sẻ", "phu", "xu-ly", "Đã bỏ chia sẻ.")],
          ],
        )}
        <span class="chu-thich">Hợp đồng không mật: người có quyền xem mọi hợp đồng của công ty cũng xem được.</span></div>`,
        true,
      )}
      ${noiDungThe(
        4,
        `<div class="the"><ol class="dong-thoi-gian"><li class="xong"><span class="cham">3</span><div><strong>12/11/2026 09:00 · Phạm Gia Huy</strong><div>Lập phụ lục 02</div></div></li>
        <li class="xong"><span class="cham">2</span><div><strong>25/11/2025 16:30 · hệ thống</strong><div>Phiên ký KS2025-00102 xong → Đã ký</div></div></li><li class="xong"><span class="cham">1</span><div><strong>18/11/2025 · Phạm Gia Huy</strong><div>Lập hợp đồng</div></div></li></ol></div>`,
        true,
      )}`);
    },

    217: () =>
      trang(`${tieuDe("Cài đặt ký số và hợp đồng")}
      ${cacThe([...(co.caiDat() ? ["Nhà cung cấp ký số", "Chữ ký số công ty", "Chứng thư gốc tin cậy"] : []), "Loại hợp đồng"])}
      ${
        co.caiDat()
          ? `${noiDungThe(
              0,
              `<div class="the">${luaChon("ncc", "Nhà cung cấp", ["Bộ giả lập (chỉ môi trường thử)"])}${luaChon("moi-truong", "Môi trường", ["Thử", "Chính thức"])}
          ${truong("ma-ket-noi", "Mã kết nối", "text", "", "", "Đã lưu. Không hiển thị lại; nhập để thay.")}${truong("khoa-ket-noi", "Khóa bí mật kết nối", "password", "", "", "Đã lưu. Không hiển thị lại; nhập để thay.")}
          <div class="khoi-canh-bao canh-bao">Bộ giả lập không có giá trị pháp lý và bị chặn ở môi trường chính thức.</div>
          <div class="nhom-nut">${nut("Kiểm tra kết nối", "phu", "xu-ly", "Kết nối được.")}${nut("Lưu", "chinh", "xu-ly", "Đã lưu cài đặt.")}</div></div>`,
            )}
        ${noiDungThe(
          1,
          `<div class="the">${truong("ma-dinh-danh-cty", "Mã định danh của công ty tại nhà cung cấp", "text", "0312345678")}${nut("Lấy danh sách chứng thư", "phu", "xu-ly", "Tìm thấy 1 chứng thư.")}
          ${bang(["Chủ thể", "Số hiệu", "Hiệu lực", "Mã số thuế", ""], [["CÔNG TY CỔ PHẦN VCOMM BÁN LẺ MIỀN NAM", "7C21…0AF3", "01/01/2026 – 31/12/2028", `0312345678 ${nhan("Trùng mã số thuế công ty", "thanh-cong")}`, nut("Chọn", "chinh", "xu-ly", "Đã lưu chữ ký số công ty.")]])}</div>`,
          true,
        )}
        ${noiDungThe(
          2,
          `<div class="the"><div class="tieu-de"><h2>Chứng thư gốc tin cậy (phạm vi tập đoàn)</h2>${nut("Thêm chứng thư gốc", "phu", "xu-ly", "Đã thêm chứng thư gốc.")}</div>
          ${bang(
            ["Chủ thể", "Hiệu lực", "Trạng thái", ""],
            [
              ["Chứng thư gốc do người dùng tải lên (ví dụ)", "—", nhan("Đang dùng", "thanh-cong"), nut("Ngừng", "phu", "xu-ly", "Đã ngừng.")],
              ["VComm CA giả lập", "2026 – 2036", nhan("Không thêm được ở môi trường chính thức", "trung-tinh"), ""],
            ],
          )}</div>`,
          true,
        )}`
          : ""
      }
      ${noiDungThe(
        co.caiDat() ? 3 : 0,
        `<div class="the"><div class="tieu-de"><h2>Loại hợp đồng</h2>${nut("Thêm loại", "phu", "them-loai")}</div>
        ${bang(
          ["Tên", "Chiều", "Trạng thái", ""],
          [
            ["Mua hàng", "Mua (công ty trả tiền)", nhan("Đang dùng", "thanh-cong"), nut("Sửa", "phu", "them-loai")],
            ["Bán hàng", "Bán (công ty thu tiền)", nhan("Đang dùng", "thanh-cong"), nut("Sửa", "phu", "them-loai")],
            ["Dịch vụ", "Mua", nhan("Đang dùng", "thanh-cong"), nut("Sửa", "phu", "them-loai")],
            ["Thuê", "Mua", nhan("Đang dùng", "thanh-cong"), nut("Sửa", "phu", "them-loai")],
            ["Hợp tác", "Không có giá trị", nhan("Đang dùng", "thanh-cong"), nut("Sửa", "phu", "them-loai")],
            ["Bảo mật thông tin", "Không có giá trị", nhan("Đang dùng", "thanh-cong"), nut("Sửa", "phu", "them-loai")],
            ["Khác", "Không có giá trị", nhan("Đang dùng", "thanh-cong"), nut("Sửa", "phu", "them-loai")],
          ],
        )}</div>`,
        co.caiDat(),
      )}`),
  };

  const TEN = {
    210: "Trình ký",
    211: "Trình ký tài liệu",
    212: "Chi tiết phiên ký",
    213: "Ký số",
    214: "Kiểm tra chữ ký số PDF",
    215: "Hợp đồng",
    216: "Chi tiết hợp đồng",
    217: "Cài đặt ký số và hợp đồng",
  };
  const TRANG_THAI = {
    rong: () =>
      ma === "213"
        ? `<div class="khoi-canh-bao loi">Đường dẫn không dùng được (đã ký, đã từ chối, đã hết hạn hoặc không đúng).</div>`
        : `<div class="trang-thai-trong"><h2>Chưa có dữ liệu</h2><p style="margin:0">${{ 210: 'Chưa có phiên ký nào. Bấm "Trình ký tài liệu" để bắt đầu.', 215: 'Chưa có hợp đồng. Bấm "Lập hợp đồng" hoặc "Nhập hợp đồng đã ký".' }[ma] || "Chưa có dữ liệu."}</p></div>`,
    "dang-tai": () => `<div class="the" aria-busy="true"><p style="margin:0">Đang tải…</p></div>`,
    loi: () => `<div class="khoi-canh-bao loi">Không tải được dữ liệu. <button type="button" class="nut phu">Thử lại</button></div>`,
    "khong-quyen": () => `<div class="trang-thai-trong"><h2>Bạn không có quyền xem trang này</h2><p style="margin:0">Liên hệ quản trị công ty nếu bạn cần quyền này.</p></div>`,
  };

  function veTrang() {
    const khongQuyen = !DUOC_XEM[ma].includes(vaiTro);
    const tt = khongQuyen ? "khong-quyen" : trangThai;
    let html;
    if (tt === "du-lieu") html = VE[ma]();
    else if (ma === "213") html = `<div class="trang-ngoai"><div class="the-ngoai"><div class="logo-lon">VComm</div>${TRANG_THAI[tt]()}</div></div>`;
    else html = trang(`${tieuDe(TEN[ma])}${TRANG_THAI[tt]()}`);
    document.getElementById("ung-dung").innerHTML = html + `<div class="vung-thong-bao" id="vung-thong-bao" aria-live="polite"></div>`;
  }
  function thongBao(chu, loai) {
    const vung = document.getElementById("vung-thong-bao");
    const o = document.createElement("div");
    o.className = `thong-bao-noi ${loai || "thanh-cong"}`;
    o.textContent = chu;
    vung.appendChild(o);
    setTimeout(() => o.remove(), 5000);
  }
  function moLop(html, giua) {
    const che = document.createElement("div");
    che.className = `man-che${giua ? " giua" : ""}`;
    che.innerHTML = html;
    che.addEventListener("click", (e) => {
      if (e.target === che || e.target.dataset.dong !== undefined) che.remove();
    });
    document.body.appendChild(che);
    const dauTien = che.querySelector("input, select, textarea, button");
    if (dauTien) dauTien.focus();
    return che;
  }
  const ngan = (tieuDeChu, noiDung, chuNut, thongBaoChu) => {
    const che = moLop(`<aside class="ngan-keo" role="dialog" aria-modal="true"><h2>${tieuDeChu}</h2>${noiDung}
      <div class="nhom-nut"><button type="button" class="nut phu" data-dong>Hủy</button><button type="button" class="nut chinh" data-luu>${chuNut}</button></div></aside>`);
    che.querySelector("[data-luu]").addEventListener("click", () => {
      che.remove();
      thongBao(thongBaoChu);
    });
  };
  // Hộp chờ xác nhận trên điện thoại (QUYTAC_NGHIEPVU_457): đếm ngược 5 phút, bản mẫu tự xác nhận sau 3 giây.
  const choXacNhan = () => {
    const che = moLop(
      `<div class="hop-thoai" role="dialog" aria-modal="true" aria-live="polite"><h2>Chờ xác nhận trên ứng dụng ký số</h2>
      <p style="margin:0">Mở ứng dụng ký số từ xa trên điện thoại và xác nhận yêu cầu ký.</p><p style="margin:0" class="chu-thich">Còn <span id="dem">4:59</span> · không đóng trang này.</p>
      <div class="nhom-nut"><button type="button" class="nut phu" data-dong>Đóng (lần ký vẫn tiếp tục)</button></div></div>`,
      true,
    );
    setTimeout(() => {
      che.remove();
      thongBao("Đã ký. Tệp đã kiểm tra lại: mọi chữ ký toàn vẹn.");
    }, 3000);
  };
  const chonThe = (so) => {
    document.querySelectorAll("[data-the]").forEach((b) => b.classList.toggle("chon", b.dataset.the === String(so)));
    document.querySelectorAll("[data-noi-dung-the]").forEach((k) => {
      k.hidden = k.dataset.noiDungThe !== String(so);
    });
  };

  const bieuMauHopDong = (nhap) => `${luaChon("hd-loai", "Loại", ["Mua hàng", "Bán hàng", "Dịch vụ", "Thuê", "Hợp tác", "Bảo mật thông tin", "Khác"])}
    ${truong("hd-ten", "Tên hợp đồng", "text", "Mua bao bì giấy Quý 1/2027")}${truong("hd-so", "Số hợp đồng (không bắt buộc)", "text", "")}
    ${luaChon("hd-doi-tac", "Đối tác (gõ tên, mã số thuế)", ["Công ty TNHH Bao Bì Việt · MST 0301112223", "Thêm đối tác khác…"])}
    <div class="hai-cot">${truong("hd-gia-tri", "Giá trị", "number", "620000000")}${luaChon("hd-tien", "Tiền tệ", ["VND", "USD"])}</div>
    <div class="hai-cot">${truong("hd-hieu-luc", "Ngày hiệu lực", "date", "2027-01-01")}${truong("hd-het-han", "Ngày hết hạn (trống là không thời hạn)", "date", "2027-03-31")}</div>
    ${nhap ? truong("hd-ngay-ky", "Ngày ký", "date", "2026-11-10") : ""}
    ${luaChon("hd-phu-trach", "Người phụ trách", ["Phạm Gia Huy · Phòng Mua hàng"])}${luaChon("hd-mat", "Mật", ["Không", "Có (chỉ người liên quan xem)"])}
    ${truong("hd-nhac", "Nhắc trước (ngày, tối đa 3 mốc)", "text", "30, 7")}${vungChu("hd-mo-ta", "Mô tả", "", 2)}
    ${oTep("hd-tep", nhap ? "Tệp đã ký (bắt buộc)" : "Tệp nội dung (PDF, bắt buộc trước khi trình)")}
    ${nhap ? `<div class="khoi-canh-bao thong-tin">Hợp đồng nhập vào ở trạng thái Đã ký, không qua duyệt. Tệp có chữ ký số được kiểm tra tự động.</div>` : ""}`;

  document.addEventListener("click", (e) => {
    const the = e.target.closest("[data-the]");
    if (the) return chonThe(the.dataset.the);
    const n = e.target.closest("[data-hanh-dong]");
    if (!n || n.disabled) return;
    const hd = n.dataset.hanhDong;
    if (hd === "xu-ly") {
      e.preventDefault();
      n.classList.add("dang-xu-ly");
      n.disabled = true;
      setTimeout(() => {
        n.classList.remove("dang-xu-ly");
        n.disabled = false;
        thongBao(n.dataset.thongBao || "Đã lưu.");
      }, 700);
      return;
    }
    if (hd === "ky-so") return choXacNhan();
    if (hd === "tu-choi") return ngan("Xác nhận", `${vungChu("ly-do", "Lý do (bắt buộc)", "", 3)}`, "Xác nhận", "Đã ghi nhận. Người lập nhận thông báo.");
    if (hd === "tai-khoan")
      return ngan(
        "Tài khoản ký số của tôi",
        `${luaChon("tk-ncc", "Nhà cung cấp của công ty", ["Bộ giả lập (môi trường thử)"])}${truong("tk-ma", "Mã định danh tại nhà cung cấp (thường là số định danh cá nhân)", "text", "079090001234")}
      ${nut("Lấy danh sách chứng thư", "phu", "xu-ly", "Tìm thấy 2 chứng thư.")}
      ${bang(
        ["Chứng thư", "Hiệu lực", ""],
        [
          ["CN=Nguyễn Văn An · 5A3F…91C2", "01/01/2026 – 31/12/2027", '<input type="radio" name="ct" checked aria-label="Chọn">'],
          ["CN=Nguyễn Văn An · 11B0…7E44", nhan("Hết hạn 31/12/2025", "loi"), '<input type="radio" name="ct" disabled aria-label="Chọn">'],
        ],
      )}`,
        "Lưu",
        "Đã lưu tài khoản ký số.",
      );
    if (hd === "them-nguoi")
      return ngan(
        "Thêm người ký",
        `${luaChon("nk-nguoi", "Người trong tập đoàn (gõ tên)", ["Trần Văn Lâm · Phó giám đốc · chưa khai tài khoản ký số", "Nguyễn Văn An · Giám đốc"])}
      <div class="hai-cot">${truong("nk-thu-tu", "Thứ tự", "number", "1")}${luaChon("nk-trang", "Trang", ["Cuối", "Đầu", "Trang số…"])}</div>${luaChon("nk-goc", "Góc", ["Dưới phải", "Dưới trái", "Trên phải", "Trên trái"])}`,
        "Thêm",
        "Đã thêm người ký.",
      );
    if (hd === "them-doi-tac")
      return ngan(
        "Thêm đối tác ký",
        `${luaChon("dt-chon", "Chọn từ danh sách đối tác (không bắt buộc)", ["Công ty TNHH Sữa Tươi Thành Hưng · MST 0309876543", "Nhập tay"])}
      ${luaChon("dt-kieu", "Đối tác là", ["Tổ chức", "Cá nhân"])}${truong("dt-ten", "Tên tổ chức hoặc họ tên", "text", "Công ty TNHH Sữa Tươi Thành Hưng")}${truong("dt-email", "Thư điện tử nhận đường dẫn", "email", "kinhdoanh@suathanhhung.test")}
      ${truong("dt-mst", "Mã số thuế (tổ chức) hoặc số định danh cá nhân", "text", "0309876543")}${truong("dt-ma", "Mã định danh tại nhà cung cấp ký số", "text", "0309876543")}
      <div class="khoi-canh-bao thong-tin">Đối tác chỉ ký được khi có tài khoản ký số từ xa ở nhà cung cấp công ty đang dùng. Chủ thể chứng thư phải trùng mã số thuế hoặc số định danh đã khai.</div>
      <div class="hai-cot">${truong("dt-thu-tu", "Thứ tự", "number", "2")}${luaChon("dt-goc", "Góc", ["Dưới trái", "Dưới phải"])}</div>`,
        "Thêm",
        "Đã thêm đối tác.",
      );
    if (hd === "gui-phien")
      return ngan("Gửi phiên ký", `<p style="margin:0">Gửi cho người ký thứ tự 1. Sau khi gửi không sửa được tệp, người ký.</p>`, "Gửi", "Đã gửi KS2026-00045. Người ký thứ tự 1 nhận thông báo.");
    if (hd === "lap-hd") return ngan("Lập hợp đồng", bieuMauHopDong(false), "Lưu nháp", "Đã lưu nháp HD2026-00131.");
    if (hd === "nhap-hd") return ngan("Nhập hợp đồng đã ký", bieuMauHopDong(true), "Nhập", "Đã nhập HD2026-00131. Tệp có 2 chữ ký số: Chưa xác định tin cậy.");
    if (hd === "phu-luc")
      return ngan(
        "Lập phụ lục",
        `${truong("pl-so", "Số phụ lục", "text", "02")}${vungChu("pl-noi-dung", "Nội dung tóm tắt", "Gia hạn thuê 12 tháng, giá 47.000.000 ₫/tháng", 2)}
      ${truong("pl-hieu-luc", "Ngày hiệu lực", "date", "2026-12-01")}<div class="hai-cot">${truong("pl-het-han", "Ngày hết hạn mới (không bắt buộc)", "date", "2027-11-30")}${truong("pl-gia-tri", "Giá trị mới (không bắt buộc)", "number", "564000000")}</div>
      ${oTep("pl-tep", "Tệp phụ lục (PDF)")}${luaChon("pl-cach", "Cách ký", ["Trình duyệt rồi ký số", "Nhập phụ lục đã ký"])}`,
        "Lưu nháp",
        "Đã lưu phụ lục 02.",
      );
    if (hd === "chia-se")
      return ngan(
        "Chia sẻ",
        `${luaChon("cs-nguoi", "Người dùng trong công ty (gõ tên)", ["Lê Thị Bích Ngọc · Phòng Kế toán"])}<span class="chu-thich">Người được chia sẻ chỉ được xem.</span>`,
        "Chia sẻ",
        "Đã chia sẻ. Người nhận nhận thông báo.",
      );
    if (hd === "thanh-ly")
      return ngan(
        "Thanh lý, chấm dứt",
        `${luaChon("tl-kieu", "Loại", ["Thanh lý", "Chấm dứt trước hạn"])}${truong("tl-ngay", "Ngày", "date", "2026-11-30")}${vungChu("tl-ly-do", "Lý do (bắt buộc)", "", 2)}${oTep("tl-tep", "Biên bản (bắt buộc)")}`,
        "Xác nhận",
        "Đã ghi nhận. Ngừng nhắc hạn.",
      );
    if (hd === "nhac") return ngan("Mốc nhắc trước", `${truong("nh-moc", "Số ngày (tối đa 3 mốc, mỗi mốc 1 đến 365)", "text", "60, 30, 7")}`, "Lưu", "Đã lưu mốc nhắc.");
    if (hd === "them-loai")
      return ngan(
        "Loại hợp đồng",
        `${truong("lh-ten", "Tên", "text", "Đại lý")}${luaChon("lh-chieu", "Chiều", ["Bán (công ty thu tiền)", "Mua (công ty trả tiền)", "Không có giá trị"])}${luaChon("lh-tt", "Trạng thái", ["Đang dùng", "Ngừng dùng"])}`,
        "Lưu",
        "Đã lưu loại hợp đồng.",
      );
  });
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") document.querySelectorAll(".man-che").forEach((c) => c.remove());
  });

  const kieu = document.createElement("style");
  kieu.textContent = "[data-noi-dung-the][hidden] { display: none; }";
  document.head.appendChild(kieu);
  const dk = document.createElement("div");
  dk.className = "dieu-khien";
  const cacVaiTro = Object.entries(VAI_TRO).filter(([k]) => (ma === "213") === (k === "doi-tac"));
  dk.innerHTML = `<strong>Bản mẫu</strong><a href="index.html">Mục lục</a>
    <label for="dk-vai-tro">Vai trò</label><select id="dk-vai-tro">${cacVaiTro.map(([k, v]) => `<option value="${k}"${k === vaiTro ? " selected" : ""}>${v}</option>`).join("")}</select>
    <label for="dk-trang-thai">Trạng thái</label><select id="dk-trang-thai">${[
      ["du-lieu", "Có dữ liệu"],
      ["rong", ma === "213" ? "Đường dẫn hết dùng" : "Rỗng"],
      ["dang-tai", "Đang tải"],
      ["loi", "Lỗi"],
    ]
      .map(([k, v]) => `<option value="${k}"${k === trangThai ? " selected" : ""}>${v}</option>`)
      .join("")}</select>`;
  document.body.appendChild(dk);
  dk.querySelector("#dk-vai-tro").addEventListener("change", (e) => {
    vaiTro = e.target.value;
    if (vaiTro !== "doi-tac") ghi("ban-mau-ks-vai-tro", vaiTro);
    veTrang();
  });
  dk.querySelector("#dk-trang-thai").addEventListener("change", (e) => {
    trangThai = e.target.value;
    ghi("ban-mau-ks-trang-thai", trangThai);
    veTrang();
  });
  veTrang();
})();
