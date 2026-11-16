// Bản mẫu CONG_VIEC_62 (MODULE_16 Dropship): dựng MAN_HINH_234 đến 241 và phần sửa màn hình có sẵn từ dữ liệu giả. Không phải mã sản phẩm.
(function () {
  const TEP = {
    234: "SAN_PHAM_DROPSHIP",
    235: "DON_DROPSHIP",
    236: "CHI_TIET_DON_DROPSHIP",
    237: "DOI_SOAT_NHA_CUNG_CAP",
    238: "GIAO_HANG_NGUOI_BAN",
    239: "PHIEU_GIAO_NGUOI_BAN",
    240: "DOI_SOAT_NGUOI_BAN",
    241: "CHI_TIET_DOI_SOAT_NGUOI_BAN",
  };
  const duongDan = (ma) => (ma === "sua" ? "SUA_DROPSHIP_MAN_HINH_CO_SAN.html" : `MAN_HINH_${ma}_${TEP[ma]}.html`);
  const ma = document.body.dataset.manHinh;
  const APP = ["234", "235", "236", "237"].includes(ma) ? "mua" : ["238", "239"].includes(ma) ? "kho" : ["240", "241"].includes(ma) ? "tai-chinh" : "sua";
  const VAI_TRO = {
    mua: { "nhan-vien": "Nhân viên mua hàng (đủ quyền dropship)", "ke-toan": "Kế toán (chỉ xem)", "khong-quyen": "Thủ kho (không có quyền)" },
    kho: { "thu-kho": "Thủ kho (vận đơn người bán)", "khong-quyen": "Kế toán (không có quyền)" },
    "tai-chinh": { "ke-toan": "Kế toán (xác nhận đối soát)", "khong-quyen": "Nhân viên mua hàng (không có quyền)" },
    sua: { "quan-tri": "Quản trị công ty" },
  }[APP];
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
  let vaiTro = doc(`ban-mau-ds-vai-tro-${APP}`, Object.keys(VAI_TRO)[0]);
  if (!VAI_TRO[vaiTro]) vaiTro = Object.keys(VAI_TRO)[0];
  let trangThai = doc("ban-mau-ds-trang-thai", "du-lieu");
  let trangThaiDon = doc("ban-mau-ds-don", "awaiting");
  let ngonNgu = doc("ban-mau-ds-ngon-ngu", "vi");
  const duocSua = () => ["nhan-vien", "thu-kho", "ke-toan"].includes(vaiTro) && !(APP === "mua" && vaiTro === "ke-toan");
  const so = (n) => (n === null || n === undefined ? "—" : new Intl.NumberFormat("vi-VN", { maximumFractionDigits: 0 }).format(n));
  const phai = 'style="text-align:right;white-space:nowrap"';
  const SO_COT_CHU = [
    "Trạng thái",
    "Trạng thái giao",
    "Nhà cung cấp",
    "Người nhận",
    "Sản phẩm",
    "Người bán",
    "Đơn bán",
    "Số đơn mua",
    "Tuần",
    "Loại",
    "Đơn vị vận chuyển",
    "Mã vận đơn",
    "Đơn",
    "Cập nhật lúc",
    "Chứng từ",
    "Khoản",
    "Nguồn",
    "Ghi chú",
    "Thời điểm",
    "",
  ];

  const thanhTren = () => `<header class="thanh-tren"><a class="logo" href="index.html">VComm</a><a href="index.html">Trang chủ</a><span class="gian"></span>
    <button type="button" aria-label="Chọn công ty">VComm Bán lẻ Miền Nam ▾</button><a href="#">Hộp duyệt <span class="huy-hieu">2</span></a><button type="button">Thông báo</button>
    <button type="button" data-ngon-ngu>${ngonNgu === "vi" ? "Tiếng Việt" : "English"}</button><a href="#">Lê Văn Phúc ▾</a></header>`;
  const MENU = {
    mua: ["Mua hàng", [["", "Đề nghị mua"], ["", "Đơn mua"], ["", "Bảng giá mua"], ["#Dropship"], ["234", "Sản phẩm dropship"], ["235", "Đơn dropship"], ["237", "Đối soát nhà cung cấp"]]],
    kho: ["Kho", [["", "Tồn kho"], ["", "Phiếu kho"], ["", "Kiểm kê"], ["#Dropship"], ["238", "Giao hàng đơn người bán"]]],
    "tai-chinh": [
      "Tài chính",
      [
        ["", "Thu chi"],
        ["", "Công nợ"],
        ["", "Đối soát thu hộ"],
        ["240", "Đối soát người bán"],
      ],
    ],
    sua: ["Màn hình có sẵn", [["sua", "Phần sửa"]]],
  };
  const menu = () => {
    const [ten, muc] = MENU[APP];
    return `<nav class="menu" aria-label="${ten}"><div class="ten-app">${ten}</div>${muc
      .map(([m, t]) =>
        m.startsWith("#")
          ? `<div class="ten-app" style="margin-top:var(--khoang-3)">${m.slice(1)}</div>`
          : `<a href="${m ? duongDan(m) : "#"}" class="${m === ma || (ma === "236" && m === "235") || (ma === "239" && m === "238") || (ma === "241" && m === "240") ? "chon" : ""}">${t}</a>`,
      )
      .join("")}</nav>`;
  };
  const tieuDe = (chu, nut) => `<div class="tieu-de"><h1>${chu}</h1>${nut || ""}</div>`;
  const canPhai = (c) => !SO_COT_CHU.includes(c);
  const bang = (cot, dong, chan) => `<div class="khung-bang"><table><thead><tr>${cot.map((c, i) => `<th scope="col" ${i && canPhai(c) ? phai : ""}>${c}</th>`).join("")}</tr></thead>
    <tbody>${dong.map((d) => `<tr>${d.map((o, i) => `<td data-nhan="${cot[i]}" ${i && canPhai(cot[i]) ? phai : ""}><span>${o}</span></td>`).join("")}</tr>`).join("")}</tbody>
    ${chan ? `<tfoot><tr>${chan.map((o, i) => `<td data-nhan="${cot[i]}" ${i && canPhai(cot[i]) ? phai : ""}><strong>${o}</strong></td>`).join("")}</tr></tfoot>` : ""}</table></div>`;
  const NHAN = {
    awaiting: ["canh-bao", "Chờ giao"],
    shipping: ["thong-tin", "Đang giao"],
    delivered: ["thanh-cong", "Đã giao"],
    failed: ["loi", "Giao thất bại"],
    cancelled: ["trung-tinh", "Đã hủy"],
    returned: ["loi", "Hoàn hàng"],
    draft: ["trung-tinh", "Nháp"],
    confirmed: ["thanh-cong", "Đã xác nhận"],
    active: ["thanh-cong", "Đang dùng"],
    inactive: ["trung-tinh", "Ngừng dùng"],
    awaiting_supplier: ["canh-bao", "Chờ nhà cung cấp nhận"],
    received: ["thanh-cong", "Đã nhận"],
  };
  const nhan = (tt) => `<span class="nhan ${NHAN[tt][0]}">${NHAN[tt][1]}</span>`;
  const nut = (chu, hanhDong, loai) => `<button type="button" class="nut ${loai || "phu"}" data-hanh-dong="${hanhDong}">${chu}</button>`;

  // Dữ liệu giả.
  const SAN_PHAM = [
    ["NCB-500", "Nước cốt bưởi Hòa Bình 500ml", "Công ty TNHH Nông sản Hòa Bình", "Chai", 38000, 240, 18, "12/11/2026 08:15 · khóa API HB-SYNC", "active"],
    ["MTX-1KG", "Mật ong tràm U Minh 1kg", "Hợp tác xã Ong Tràm U Minh", "Hũ", 215000, 35, 4, "11/11/2026 17:40 · Lê Văn Phúc", "active"],
    ["DLH-250", "Dầu lạc ép lạnh 250ml", "Công ty TNHH Nông sản Hòa Bình", "Chai", 62000, 0, 0, "10/11/2026 09:02 · khóa API HB-SYNC", "active"],
    ["KHO-GAC", "Khô gà lá chanh 200g", "Cơ sở Thực phẩm Bà Tư", "Gói", null, 120, 0, "08/11/2026 14:20 · Lê Văn Phúc", "active"],
    ["TRA-OLG", "Trà ô long Lâm Đồng 100g", "Công ty CP Trà Cầu Đất", "Hộp", 88000, 60, 0, "01/11/2026 10:00 · Lê Văn Phúc", "inactive"],
  ];
  const DON = [
    ["DM-VCR-2026-000521", "DB-VCR-2026-001844", "Công ty TNHH Nông sản Hòa Bình", "Nguyễn Thị Hạnh · Q. Bình Thạnh", 2, 76000, "awaiting", "12/11/2026"],
    ["DM-VCR-2026-000522", "DB-VCR-2026-001844", "Hợp tác xã Ong Tràm U Minh", "Nguyễn Thị Hạnh · Q. Bình Thạnh", 1, 215000, "shipping", "12/11/2026"],
    ["DM-VCR-2026-000517", "DB-VCR-2026-001830", "Công ty TNHH Nông sản Hòa Bình", "Trần Văn Long · TP. Thủ Đức", 6, 228000, "delivered", "10/11/2026"],
    ["DM-VCR-2026-000509", "DB-VCR-2026-001811", "Cơ sở Thực phẩm Bà Tư", "Phạm Quốc Bảo · Q. 7", 3, 0, "failed", "07/11/2026"],
  ];

  const ve234 = () => {
    const sua = duocSua();
    const loi =
      trangThai === "loi-nhap"
        ? `<div class="khoi-canh-bao loi" role="alert">Không lưu được: "Khô gà lá chanh 200g" chưa có giá mua hiệu lực của Cơ sở Thực phẩm Bà Tư (Bảng giá mua). Biến thể "Bánh pía sầu riêng" quản lý theo lô, không bán dropship được.</div>`
        : "";
    return `${tieuDe("Sản phẩm dropship", sua ? `<div class="nhom-nut">${nut("Nhập tồn từ tệp Excel", "nhap-tep")}${nut("Thêm sản phẩm", "them", "chinh")}</div>` : "")}${loi}
      <div class="the"><div class="bo-loc"><label for="tim" class="an-nhan">Tìm</label><input id="tim" class="o-nhap" placeholder="Mã, tên sản phẩm">
        <label for="ncc" class="an-nhan">Nhà cung cấp</label><select id="ncc" class="o-nhap"><option>Nhà cung cấp: tất cả</option><option>Công ty TNHH Nông sản Hòa Bình</option><option>Hợp tác xã Ong Tràm U Minh</option></select>
        <label for="tt" class="an-nhan">Trạng thái</label><select id="tt" class="o-nhap"><option>Đang dùng</option><option>Ngừng dùng</option><option>Tất cả</option></select>
        <label><input type="checkbox"> Chỉ hàng hết khả dụng</label></div>
        <span class="chu-thich">Kho xuất: KHO-DS · Kho Dropship. Khả dụng = tồn nhà cung cấp khai báo − giữ chỗ của đơn bán đang mở − đơn mua dropship chưa giao xong. Giá mua lấy từ Bảng giá mua.</span></div><!--het-loc-->
      ${bang(
        ["Mã biến thể", "Sản phẩm", "Nhà cung cấp", "Đơn vị", "Giá mua", "Tồn khai báo", "Giữ chỗ", "Khả dụng", "Cập nhật lúc", "Trạng thái", ""],
        SAN_PHAM.map((s) => [
          s[0],
          s[1],
          s[2],
          s[3],
          s[4] === null ? `<span class="nhan canh-bao">Chưa có giá</span>` : so(s[4]),
          so(s[5]),
          so(s[6]),
          s[5] - s[6] <= 0 ? `<span style="color:var(--mau-loi);font-weight:700">0</span>` : so(s[5] - s[6]),
          `<span class="chu-thich">${s[7]}</span>`,
          nhan(s[8]),
          sua && s[8] === "active" ? `${nut("Sửa tồn", "sua-ton")} ${nut("Sửa", "sua")}` : "",
        ]),
      )}
      <span class="chu-thich">Nhà cung cấp có khóa API phạm vi "Dropship – nhà cung cấp" tự cập nhật tồn; nhân viên sửa tay được, mọi lần đổi có lịch sử.</span>
      <div class="man-che" id="ngan-keo" style="display:none"><aside class="ngan-keo" role="dialog" aria-labelledby="nk-tieu-de"><h2 id="nk-tieu-de">Sửa tồn khai báo</h2>
        <dl class="thong-tin-dong"><dt>Sản phẩm</dt><dd>Nước cốt bưởi Hòa Bình 500ml</dd><dt>Nhà cung cấp</dt><dd>Công ty TNHH Nông sản Hòa Bình</dd><dt>Giữ chỗ</dt><dd>18 chai</dd></dl>
        <div class="truong"><label for="ton-moi">Tồn khai báo mới (chai)</label><input id="ton-moi" class="o-nhap" value="240" inputmode="numeric"></div>
        <h3>Lịch sử</h3>${bang(
          ["Thời điểm", "Cũ", "Mới", "Nguồn"],
          [
            ["12/11/2026 08:15", "300", "240", "khóa API HB-SYNC"],
            ["11/11/2026 08:10", "180", "300", "khóa API HB-SYNC"],
            ["05/11/2026 16:00", "0", "180", "Lê Văn Phúc"],
          ],
        )}
        <div class="nhom-nut">${nut("Hủy", "dong")}${nut("Lưu", "luu-ton", "chinh")}</div></aside></div>`;
  };

  const ve235 = () => `${tieuDe("Đơn dropship")}
    <div class="the"><div class="bo-loc"><label for="tim" class="an-nhan">Tìm</label><input id="tim" class="o-nhap" placeholder="Số đơn mua, số đơn bán, người nhận">
      <label for="ncc" class="an-nhan">Nhà cung cấp</label><select id="ncc" class="o-nhap"><option>Nhà cung cấp: tất cả</option></select>
      <label for="tt" class="an-nhan">Trạng thái giao</label><select id="tt" class="o-nhap"><option>Trạng thái giao: tất cả</option>${["awaiting", "shipping", "delivered", "failed", "cancelled"].map((k) => `<option>${NHAN[k][1]}</option>`).join("")}</select>
      <label><input type="checkbox"> Chờ giao quá 2 ngày</label><label><input type="checkbox"> Chưa có số hóa đơn nhà cung cấp</label></div>
      <span class="chu-thich">Đơn mua dropship tự lập khi đơn bán kho Dropship được xác nhận, mỗi nhà cung cấp một đơn, trạng thái Đã duyệt.</span></div><!--het-loc-->
    ${bang(
      ["Số đơn mua", "Đơn bán", "Nhà cung cấp", "Người nhận", "Số dòng", "Giá trị mua", "Trạng thái giao", "Ngày đơn"],
      DON.map((d) => [`<a href="${duongDan("236")}">${d[0]}</a>`, `<a href="${duongDan("sua")}">${d[1]}</a>`, d[2], d[3], so(d[4]), so(d[5]), nhan(d[6]), d[7]]),
    )}
    <div class="phan-trang"><span class="chu-thich">1–4 trên 4 đơn</span></div>`;

  const ve236 = () => {
    const tt = trangThaiDon;
    const sua = duocSua();
    const nutTrangThai = !sua
      ? ""
      : tt === "awaiting"
        ? `${nut("Hủy đơn", "huy-don", "nguy-hiem")}${nut("Giao thất bại", "that-bai")}${nut("Báo đang giao", "dang-giao")}${nut("Báo đã giao", "da-giao", "chinh")}`
        : tt === "shipping"
          ? `${nut("Hủy đơn", "huy-don", "nguy-hiem")}${nut("Giao thất bại", "that-bai")}${nut("Báo đã giao", "da-giao", "chinh")}`
          : tt === "delivered"
            ? `${nut("Trả hàng", "tra-hang")}${nut("Ghi số hóa đơn nhà cung cấp", "so-hoa-don", "chinh")}`
            : "";
    const lichSu = [["12/11/2026 09:20", "Chờ giao", "Hệ thống (đơn bán DB-VCR-2026-001844 xác nhận)", ""]];
    if (["shipping", "delivered"].includes(tt)) lichSu.push(["12/11/2026 14:05", "Đang giao", "khóa API HB-SYNC", "Viettel Post · VTP8812345601"]);
    if (tt === "delivered") lichSu.push(["13/11/2026 10:30", "Đã giao", "khóa API HB-SYNC", "Ngày giao 13/11/2026 · PNK-DS-2026-0081, PXK-DS-2026-0081"]);
    if (tt === "failed") lichSu.push(["13/11/2026 11:00", "Giao thất bại", "Lê Văn Phúc", "Người nhận không nghe máy ba lần"]);
    if (tt === "cancelled") lichSu.push(["12/11/2026 15:00", "Đã hủy", "Lê Văn Phúc", "Nhà cung cấp báo hết hàng"]);
    return `${tieuDe(`Đơn dropship DM-VCR-2026-000521 ${nhan(tt)}`, `<div class="nhom-nut">${nutTrangThai}</div>`)}
      ${tt === "failed" ? `<div class="khoi-canh-bao canh-bao" role="status">Đơn mua đã đóng, giữ chỗ đã nhả. Nhà cung cấp còn lại của đơn bán đang giao nên đơn bán sẽ Đóng phần còn lại khi xong.</div>` : ""}
      <div class="hai-cot"><section class="the"><h2>Thông tin</h2><dl class="thong-tin-dong"><dt>Đơn bán</dt><dd><a href="${duongDan("sua")}">DB-VCR-2026-001844</a> · Đã xác nhận</dd>
        <dt>Nhà cung cấp</dt><dd>Công ty TNHH Nông sản Hòa Bình</dd><dt>Kho nhận</dt><dd>KHO-DS · Kho Dropship</dd>
        <dt>Đơn vị vận chuyển</dt><dd>${["shipping", "delivered"].includes(tt) ? "Viettel Post · VTP8812345601" : "—"}</dd>
        <dt>Số hóa đơn nhà cung cấp</dt><dd>${tt === "delivered" ? "1C26THB · 0001532 · 13/11/2026" : "—"}</dd></dl></section>
      <section class="the"><h2>Người nhận</h2><dl class="thong-tin-dong"><dt>Tên</dt><dd>Nguyễn Thị Hạnh</dd><dt>Điện thoại</dt><dd>0901 234 567</dd><dt>Địa chỉ</dt><dd>45 Nguyễn Gia Trí, Phường 25, Quận Bình Thạnh, TP. Hồ Chí Minh</dd></dl></section></div>
      <h2>Dòng hàng</h2>${bang(["Sản phẩm", "Đơn vị", "Số lượng", "Đơn giá mua", "Thuế suất", "Thành tiền"], [["NCB-500 · Nước cốt bưởi Hòa Bình 500ml", "Chai", "2", so(38000), "8%", so(76000)]], ["Cộng", "", "", "", "", so(76000)])}
      ${tt === "delivered" ? `<h2>Trả hàng</h2>${bang(["Số yêu cầu", "Nơi nhận", "Số lượng", "Trạng thái", "Chứng từ"], [["TRDS-2026-0004", "Về nhà cung cấp", "1", nhan("awaiting_supplier"), "—"]])}` : ""}
      <h2>Lịch sử trạng thái giao</h2>${bang(["Thời điểm", "Trạng thái", "Nguồn", "Ghi chú"], lichSu)}
      <div class="man-che giua" id="hop-thoai" style="display:none"><div class="hop-thoai" role="dialog" aria-labelledby="ht-tieu-de"><h2 id="ht-tieu-de">Báo đã giao</h2>
        <div class="truong"><label for="ngay-giao">Ngày giao</label><input id="ngay-giao" type="date" class="o-nhap" value="2026-11-13"></div>
        <span class="chu-thich">Hệ thống ghi sổ phiếu nhập mua và phiếu xuất bán kho Dropship cùng ngày giao: ghi nhận phải trả nhà cung cấp, phải thu khách, hóa đơn điện tử, giá vốn bằng giá mua. Không hoàn tác được; hàng trả lại xử lý bằng Trả hàng.</span>
        <div class="nhom-nut">${nut("Hủy", "dong")}${nut("Xác nhận đã giao", "xac-nhan-giao", "chinh")}</div></div></div>
      <div class="man-che giua" id="hop-tra" style="display:none"><div class="hop-thoai" role="dialog" aria-labelledby="tra-tieu-de"><h2 id="tra-tieu-de">Trả hàng dropship</h2>
        <div class="truong"><label for="sl-tra">Số lượng trả (đã xuất 2, đã trả 0)</label><input id="sl-tra" class="o-nhap" value="1" inputmode="numeric"></div>
        <fieldset class="truong"><legend>Nơi nhận hàng trả</legend><label><input type="radio" name="noi" checked> Về nhà cung cấp (ghi sổ khi nhà cung cấp xác nhận đã nhận)</label>
          <label><input type="radio" name="noi"> Về kho công ty</label><select class="o-nhap" aria-label="Kho nhận"><option>KHO-BD · Kho Bình Dương</option></select></fieldset>
        <div class="truong"><label for="ly-do-tra">Lý do</label><input id="ly-do-tra" class="o-nhap" value="Chai bị móp khi giao"></div>
        <div class="nhom-nut">${nut("Hủy", "dong")}${nut("Tạo yêu cầu trả hàng", "tao-tra", "chinh")}</div></div></div>`;
  };

  const ve237 = () => `${tieuDe("Đối soát nhà cung cấp dropship", `<div class="nhom-nut">${nut("Xuất Excel", "xuat")}</div>`)}
    <div class="the"><div class="bo-loc"><div class="truong"><label for="tu">Từ ngày</label><input id="tu" type="date" class="o-nhap" value="2026-11-01"></div>
      <div class="truong"><label for="den">Đến ngày</label><input id="den" type="date" class="o-nhap" value="2026-11-30"></div>
      <div class="truong"><label for="ncc">Nhà cung cấp</label><select id="ncc" class="o-nhap"><option>Tất cả</option></select></div></div>
      <span class="chu-thich">Theo ngày chứng từ. Giá trị có thuế. Công nợ phải trả cuối kỳ lấy từ sổ công nợ (gồm cả giao dịch không phải dropship với nhà cung cấp).</span></div><!--het-loc-->
    ${bang(
      ["Nhà cung cấp", "Đơn đã giao", "Giá trị nhận", "Giá trị trả lại", "Đơn chưa có số hóa đơn", "Phải trả cuối kỳ"],
      [
        ["Công ty TNHH Nông sản Hòa Bình", "14", so(5961600), so(41040), `<a href="#" data-hanh-dong="xem-don">3</a>`, so(4120560)],
        ["Hợp tác xã Ong Tràm U Minh", "6", so(1393200), so(0), "0", so(1393200)],
        ["Cơ sở Thực phẩm Bà Tư", "2", so(259200), so(0), `<a href="#" data-hanh-dong="xem-don">1</a>`, so(259200)],
      ],
      ["Cộng", "22", so(7614000), so(41040), "4", so(5772960)],
    )}`;

  const NGUOI_BAN = [
    ["DB-VCR-2026-001851", "Shop Mẹ Bơ (MB-20931)", "Lê Thu Trang · Q. 3", 350000, "GHN · GHNX7781023", 32000, "shipping"],
    ["DB-VCR-2026-001850", "Shop Mẹ Bơ (MB-20930)", "Đỗ Minh Khoa · Q. Gò Vấp", 0, "—", null, "awaiting"],
    ["DB-VCR-2026-001845", "Nhà Nông Online (NNO-7781)", "Vũ Hải Yến · TP. Biên Hòa", 512000, "J&T · 8400991234", 41000, "delivered"],
    ["DB-VCR-2026-001839", "Shop Mẹ Bơ (MB-20911)", "Ngô Gia Huy · Q. 12", 215000, "GHN · GHNX7779001", 30000, "returned"],
  ];
  const ve238 = () => {
    const sua = duocSua();
    return `${tieuDe("Giao hàng đơn người bán")}
      <div class="the"><div class="bo-loc"><label for="tim" class="an-nhan">Tìm</label><input id="tim" class="o-nhap" placeholder="Số đơn, mã đơn người bán, mã vận đơn">
        <label for="nb" class="an-nhan">Người bán</label><select id="nb" class="o-nhap"><option>Người bán: tất cả</option><option>Shop Mẹ Bơ</option><option>Nhà Nông Online</option></select>
        <label for="tt" class="an-nhan">Trạng thái giao</label><select id="tt" class="o-nhap"><option>Trạng thái giao: tất cả</option>${["awaiting", "shipping", "delivered", "returned"].map((k) => `<option>${NHAN[k][1]}</option>`).join("")}</select></div>
        <span class="chu-thich">Đơn dropship của người bán: hàng xuất từ kho công ty, giao dưới tên người bán. Phí giao là phí thực tế của đơn vị vận chuyển, tính vào bảng đối soát tuần của người bán.</span></div><!--het-loc-->
      ${bang(
        ["Đơn", "Người bán", "Người nhận", "Thu hộ", "Mã vận đơn", "Phí giao", "Trạng thái giao", ""],
        NGUOI_BAN.map((d) => [
          d[0],
          d[1],
          d[2],
          so(d[3]),
          d[4],
          so(d[5]),
          nhan(d[6]),
          `<a class="nut phu" href="${duongDan("239")}">In phiếu giao</a>${sua && ["awaiting", "shipping"].includes(d[6]) ? ` ${nut("Cập nhật giao", "cap-nhat-giao")}` : ""}`,
        ]),
      )}
      <div class="man-che" id="ngan-keo" style="display:none"><aside class="ngan-keo" role="dialog" aria-labelledby="nk-tieu-de"><h2 id="nk-tieu-de">Cập nhật giao · DB-VCR-2026-001851</h2>
        <div class="truong"><label for="dvvc">Đơn vị vận chuyển</label><input id="dvvc" class="o-nhap" value="GHN"></div>
        <div class="truong"><label for="mvd">Mã vận đơn</label><input id="mvd" class="o-nhap" value="GHNX7781023"></div>
        <div class="truong"><label for="phi">Phí giao thực tế (đồng)</label><input id="phi" class="o-nhap" value="32.000" inputmode="numeric"></div>
        <div class="truong"><label for="ttg">Trạng thái giao</label><select id="ttg" class="o-nhap">${["awaiting", "shipping", "delivered", "returned"].map((k) => `<option${k === "shipping" ? " selected" : ""}>${NHAN[k][1]}</option>`).join("")}</select></div>
        <span class="chu-thich">Hoàn hàng: lập phiếu trả hàng bán vào kho để nhận lại hàng. Người bán thấy trạng thái này qua Open API.</span>
        <div class="nhom-nut">${nut("Hủy", "dong")}${nut("Lưu", "luu-giao", "chinh")}</div></aside></div>`;
  };

  const ve239 = () => `${tieuDe("Phiếu giao danh nghĩa người bán", `<div class="nhom-nut">${nut("Tải PDF", "tai-pdf", "chinh")}</div>`)}
    <div class="the" style="max-width:560px;border:1px dashed var(--mau-vien)">
      <h2 style="margin:0">PHIẾU GIAO HÀNG</h2><span class="chu-thich">Mã đơn: MB-20931 · Ngày 12/11/2026</span>
      <div class="hai-cot"><dl class="thong-tin-dong"><dt>Người gửi</dt><dd>Shop Mẹ Bơ</dd><dt>Điện thoại</dt><dd>0938 111 222</dd></dl>
        <dl class="thong-tin-dong"><dt>Người nhận</dt><dd>Lê Thu Trang</dd><dt>Điện thoại</dt><dd>0912 345 678</dd><dt>Địa chỉ</dt><dd>12 Trần Quốc Thảo, Phường Võ Thị Sáu, Quận 3, TP. Hồ Chí Minh</dd></dl></div>
      ${bang(
        ["Sản phẩm", "Số lượng"],
        [
          ["Nước cốt bưởi Hòa Bình 500ml", "4"],
          ["Mật ong tràm U Minh 1kg", "1"],
        ],
      )}
      <p style="font-size:1.25em;margin:0"><strong>Thu hộ: ${so(350000)} đồng</strong></p>
      <span class="chu-thich">Đơn vị vận chuyển: GHN · GHNX7781023. Phiếu không in tên công ty, giá bán, số đơn nội bộ.</span></div>`;

  const BANG_DS = [
    ["DSNB-VCR-2026-W45-003", "Shop Mẹ Bơ", "03/11 – 09/11/2026", 2860000, 215000, 3120000, 92000, 7360, -375640, "draft"],
    ["DSNB-VCR-2026-W45-004", "Nhà Nông Online", "03/11 – 09/11/2026", 1540000, 0, 512000, 41000, 3280, 1072280, "draft"],
    ["DSNB-VCR-2026-W44-003", "Shop Mẹ Bơ", "27/10 – 02/11/2026", 1980000, 0, 2400000, 60000, 4800, -355200, "confirmed"],
  ];
  const ve240 = () => `${tieuDe("Đối soát người bán")}
    <div class="the"><div class="bo-loc"><label for="tuan" class="an-nhan">Tuần</label><select id="tuan" class="o-nhap"><option>Tuần: tất cả</option><option>03/11 – 09/11/2026</option></select>
      <label for="nb" class="an-nhan">Người bán</label><select id="nb" class="o-nhap"><option>Người bán: tất cả</option></select>
      <label for="tt" class="an-nhan">Trạng thái</label><select id="tt" class="o-nhap"><option>Trạng thái: tất cả</option><option>Nháp</option><option>Đã xác nhận</option></select></div>
      <span class="chu-thich">Lập tự động lúc 2 giờ thứ Hai. Số còn lại = A tiền hàng − B trả hàng − C thu hộ + D phí giao + E thuế phí giao. Dương: người bán phải nộp; âm: công ty phải trả.</span></div><!--het-loc-->
    ${bang(
      ["Số bảng", "Người bán", "Tuần", "A tiền hàng", "B trả hàng", "C thu hộ", "D phí giao", "E thuế", "Số còn lại", "Trạng thái"],
      BANG_DS.map((b) => [
        `<a href="${duongDan("241")}">${b[0]}</a>`,
        b[1],
        b[2],
        so(b[3]),
        so(b[4]),
        so(b[5]),
        so(b[6]),
        so(b[7]),
        b[8] < 0 ? `<span style="color:var(--mau-loi);font-weight:700">${so(b[8])}</span>` : so(b[8]),
        nhan(b[9]),
      ]),
    )}`;

  const ve241 = () => {
    const sua = duocSua();
    const b = BANG_DS[0];
    return `${tieuDe(`Bảng đối soát ${b[0]} ${nhan("draft")}`, sua ? `<div class="nhom-nut">${nut("Xuất Excel", "xuat")}${nut("Xác nhận", "xac-nhan", "chinh")}</div>` : "")}
      <div class="the"><dl class="thong-tin-dong"><dt>Người bán</dt><dd>Shop Mẹ Bơ</dd><dt>Tuần</dt><dd>${b[2]}</dd><dt>Thuế suất phí giao</dt><dd>8%</dd></dl></div>
      ${bang(
        ["Khoản", "Số tiền"],
        [
          ["A · Tiền hàng có thuế (5 phiếu xuất)", so(b[3])],
          ["B · Trả hàng (1 phiếu)", so(b[4])],
          ["C · Thu hộ đã ghi sổ (6 dòng)", so(b[5])],
          ["D · Phí giao (4 đơn)", so(b[6])],
          ["E · Thuế giá trị gia tăng phí giao", so(b[7])],
        ],
        ["Số còn lại (công ty phải trả)", `<span style="color:var(--mau-loi)">${so(b[8])}</span>`],
      )}
      <span class="chu-thich">Xác nhận: hạch toán D, E (Nợ phải thu người bán, Có doanh thu dịch vụ, Có thuế giá trị gia tăng đầu ra). Số âm: lập phiếu chi hoàn tiền khách ${so(-b[8])} đồng. A, B, C đã ghi công nợ theo luồng hiện có, ở đây để đối chiếu. Bảng đã xác nhận không sửa.</span>
      <h2>Chi tiết</h2>${bang(
        ["Loại", "Chứng từ", "Đơn", "Số tiền"],
        [
          ["Phiếu xuất", "PXK-VCR-2026-004412", "MB-20901", so(615000)],
          ["Phiếu xuất", "PXK-VCR-2026-004430", "MB-20911", so(215000)],
          ["Trả hàng", "PNT-VCR-2026-000213", "MB-20911", so(215000)],
          ["Thu hộ", "Bảng thu hộ GHN-2026-1107", "MB-20901", so(615000)],
          ["Phí giao", "GHNX7779001", "MB-20911", so(30000)],
        ],
      )}`;
  };

  const veSua = () => `${tieuDe("Phần sửa màn hình có sẵn (CONG_VIEC_62)")}
    <section class="the"><h2>Kho › Biểu mẫu kho</h2><div class="bo-loc"><div class="truong"><label for="loai-kho">Loại kho</label><select id="loai-kho" class="o-nhap"><option>Thường</option><option selected>Dropship</option></select></div></div>
      <span class="chu-thich">Kho Dropship: không có hàng thật, không dùng vị trí, không lập phiếu tay; mỗi công ty một kho đang hoạt động. Không đổi loại sau khi đã có chứng từ. Danh sách kho thêm cột Loại.</span></section>
    <section class="the"><h2>Bán hàng › Chi tiết đơn bán · khối Dropship</h2>
      ${bang(
        ["Số đơn mua", "Nhà cung cấp", "Số dòng", "Trạng thái giao", "Mã vận đơn"],
        [
          [`<a href="${duongDan("236")}">DM-VCR-2026-000521</a>`, "Công ty TNHH Nông sản Hòa Bình", "1", nhan("awaiting"), "—"],
          [`<a href="${duongDan("236")}">DM-VCR-2026-000522</a>`, "Hợp tác xã Ong Tràm U Minh", "1", nhan("shipping"), "Viettel Post · VTP8812345601"],
        ],
      )}
      <span class="chu-thich">Hiện khi kho xuất của đơn là kho Dropship. Đơn bán Đã giao khi mọi nhà cung cấp đã giao.</span></section>
    <section class="the"><h2>Bán hàng › Chi tiết đơn bán · khối Người bán dropship</h2><dl class="thong-tin-dong"><dt>Người bán</dt><dd>Shop Mẹ Bơ · mã đơn MB-20931</dd><dt>Thu hộ</dt><dd>${so(350000)} đồng</dd>
      <dt>Giao hàng</dt><dd>GHN · GHNX7781023 · ${nhan("shipping")} · phí ${so(32000)}</dd></dl></section>
    <section class="the"><h2>Khách hàng › Chi tiết đối tác · hồ sơ khách hàng</h2><label><input type="checkbox" checked> Người bán dropship</label>
      <span class="chu-thich">Đơn Open API có người nhận của đối tác này: khách trên đơn là chính đối tác, hóa đơn và công nợ theo đối tác, giao dưới tên đối tác, được thu hộ.</span></section>
    <section class="the"><h2>Nền tảng › Khóa API (MAN_HINH_224, 225) · phạm vi</h2>
      ${["Sản phẩm, giá, tồn", "Đơn bán", "Khách hàng do đối tác tạo", "Điểm thưởng hội viên", "Dropship – nhà cung cấp (đơn mua dropship, báo giao, cập nhật tồn)"].map((p, i) => `<label style="display:block"><input type="checkbox"${i === 4 ? " checked" : ""}> ${p}</label>`).join("")}
      <span class="chu-thich">Phạm vi Dropship – nhà cung cấp chỉ chọn được với khóa loại Đối tác gắn đối tác có hồ sơ nhà cung cấp ở công ty.</span></section>`;

  const VE = { 234: ve234, 235: ve235, 236: ve236, 237: ve237, 238: ve238, 239: ve239, 240: ve240, 241: ve241, sua: veSua };
  const TEN = {
    234: "Sản phẩm dropship",
    235: "Đơn dropship",
    236: "Đơn dropship",
    237: "Đối soát nhà cung cấp dropship",
    238: "Giao hàng đơn người bán",
    239: "Phiếu giao",
    240: "Đối soát người bán",
    241: "Bảng đối soát",
    sua: "Phần sửa",
  };
  const TRANG_THAI = {
    rong: () =>
      `<div class="trang-thai-trong"><div class="hinh"></div><h2>${ma === "234" ? "Chưa có sản phẩm dropship" : "Chưa có dữ liệu"}</h2><p style="margin:0">${ma === "234" ? "Tạo kho loại Dropship ở mini app Kho rồi thêm sản phẩm dropship." : "Dữ liệu sẽ hiện khi có đơn hoặc bảng đối soát."}</p></div>`,
    "dang-tai": () =>
      `<div class="the" aria-busy="true"><div class="xuong" style="width:40%"></div><div class="xuong"></div><div class="xuong"></div><div class="xuong" style="width:70%"></div></div>`,
    loi: () => `<div class="khoi-canh-bao loi" role="alert">Không tải được dữ liệu. Kiểm tra kết nối rồi bấm Thử lại. ${nut("Thử lại", "tai-lai")}</div>`,
    "khong-quyen": () => `<div class="trang-thai-trong"><h2>Bạn không có quyền xem mục này</h2><p style="margin:0">Liên hệ quản trị công ty nếu bạn cần quyền này.</p></div>`,
  };
  function veTrang() {
    const tt = vaiTro === "khong-quyen" ? "khong-quyen" : trangThai;
    let noiDung;
    if (!TRANG_THAI[tt] || (["236", "239", "241", "sua"].includes(ma) && tt !== "khong-quyen")) noiDung = VE[ma]();
    else if (tt === "khong-quyen") noiDung = tieuDe(TEN[ma]) + TRANG_THAI[tt]();
    else {
      const day = VE[ma]();
      const cat = day.indexOf("<!--het-loc-->");
      noiDung = (cat >= 0 ? day.slice(0, cat) : tieuDe(TEN[ma])) + TRANG_THAI[tt]();
    }
    document.getElementById("ung-dung").innerHTML =
      `${thanhTren()}<div class="than">${menu()}<main class="noi-dung">${noiDung}</main></div><div class="vung-thong-bao" id="vung-thong-bao" aria-live="polite"></div>`;
  }
  function thongBao(chu, loai) {
    const o = document.createElement("div");
    o.className = `thong-bao-noi ${loai || "thanh-cong"}`;
    o.textContent = chu;
    document.getElementById("vung-thong-bao").appendChild(o);
    setTimeout(() => o.remove(), 5000);
  }
  const MO = { "sua-ton": "ngan-keo", "cap-nhat-giao": "ngan-keo", "da-giao": "hop-thoai", "tra-hang": "hop-tra" };
  const KET_QUA = {
    "luu-ton": "Đã lưu tồn khai báo.",
    them: "Mở biểu mẫu thêm sản phẩm dropship.",
    "nhap-tep": "Đã nhập 42 dòng, 1 dòng lỗi (mã biến thể không phải sản phẩm dropship).",
    sua: "Mở biểu mẫu sửa.",
    "dang-giao": "Đã báo đang giao.",
    "xac-nhan-giao": "Đã ghi sổ phiếu nhập mua PNK-DS-2026-0081 và phiếu xuất bán PXK-DS-2026-0081.",
    "that-bai": "Đã báo giao thất bại, giữ chỗ đã nhả.",
    "huy-don": "Đã hủy đơn mua dropship.",
    "so-hoa-don": "Đã lưu số hóa đơn nhà cung cấp.",
    "tao-tra": "Đã tạo yêu cầu trả hàng, chờ nhà cung cấp xác nhận đã nhận.",
    xuat: "Đã tải tệp Excel.",
    "xem-don": "Mở danh sách đơn chưa có số hóa đơn.",
    "luu-giao": "Đã lưu vận đơn.",
    "tai-pdf": "Đã tải phiếu giao PDF.",
    "xac-nhan": "Đã xác nhận, hạch toán phí giao và lập phiếu chi PC-VCR-2026-000318.",
    "tai-lai": "Đã tải lại.",
  };
  document.addEventListener("click", (e) => {
    if (e.target.closest("[data-ngon-ngu]")) {
      ngonNgu = ngonNgu === "vi" ? "en" : "vi";
      ghi("ban-mau-ds-ngon-ngu", ngonNgu);
      thongBao(ngonNgu === "en" ? "Bản mẫu chỉ có tiếng Việt; mã thật có tệp dịch tiếng Anh." : "Đã chuyển tiếng Việt.");
      veTrang();
      return;
    }
    const n = e.target.closest("[data-hanh-dong]");
    if (!n || n.disabled) return;
    e.preventDefault();
    const hanhDong = n.dataset.hanhDong;
    if (MO[hanhDong]) {
      document.getElementById(MO[hanhDong]).style.display = "";
      return;
    }
    if (hanhDong === "dong") {
      n.closest(".man-che").style.display = "none";
      return;
    }
    n.classList.add("dang-xu-ly");
    n.disabled = true;
    setTimeout(() => {
      n.classList.remove("dang-xu-ly");
      n.disabled = false;
      const che = n.closest(".man-che");
      if (che) che.style.display = "none";
      thongBao(KET_QUA[hanhDong] || "Đã thực hiện.");
    }, 600);
  });
  const dk = document.createElement("div");
  dk.className = "dieu-khien";
  const chon = (id, ds, giaTri) => `<select id="${id}">${ds.map(([k, v]) => `<option value="${k}"${k === giaTri ? " selected" : ""}>${v}</option>`).join("")}</select>`;
  dk.innerHTML = `<strong>Bản mẫu</strong><a href="index.html">Mục lục</a>
    <label for="dk-vai-tro">Vai trò</label>${chon("dk-vai-tro", Object.entries(VAI_TRO), vaiTro)}
    <label for="dk-trang-thai">Trạng thái</label>${chon(
      "dk-trang-thai",
      [
        ["du-lieu", "Có dữ liệu"],
        ["rong", "Rỗng"],
        ["dang-tai", "Đang tải"],
        ["loi", "Lỗi"],
        ["loi-nhap", "Lỗi nhập (234)"],
      ],
      trangThai,
    )}
    ${
      ma === "236"
        ? `<label for="dk-don">Trạng thái giao</label>${chon(
            "dk-don",
            ["awaiting", "shipping", "delivered", "failed", "cancelled"].map((k) => [k, NHAN[k][1]]),
            trangThaiDon,
          )}`
        : ""
    }`;
  document.body.appendChild(dk);
  dk.querySelector("#dk-vai-tro").addEventListener("change", (e) => {
    vaiTro = e.target.value;
    ghi(`ban-mau-ds-vai-tro-${APP}`, vaiTro);
    veTrang();
  });
  dk.querySelector("#dk-trang-thai").addEventListener("change", (e) => {
    trangThai = e.target.value;
    ghi("ban-mau-ds-trang-thai", trangThai);
    veTrang();
  });
  const dkDon = dk.querySelector("#dk-don");
  if (dkDon)
    dkDon.addEventListener("change", (e) => {
      trangThaiDon = e.target.value;
      ghi("ban-mau-ds-don", trangThaiDon);
      veTrang();
    });
  veTrang();
})();
