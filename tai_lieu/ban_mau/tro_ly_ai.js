// Bản mẫu CONG_VIEC_63 (MODULE_16 trợ lý AI): dựng MAN_HINH_242 đến 245 từ dữ liệu giả. Không phải mã sản phẩm.
(function () {
  const TEP = {
    242: ["TRO_LY_AI", "Ngăn trợ lý AI (mọi mini app web)"],
    243: ["SOAN_NOI_DUNG_AI", "Soạn nội dung sản phẩm bằng AI (Sản phẩm)"],
    244: ["CAI_DAT_TRO_LY_AI", "Cài đặt trợ lý AI (Nền tảng)"],
    245: ["THONG_KE_TRO_LY_AI", "Thống kê sử dụng trợ lý AI (Nền tảng)"],
  };
  const duongDan = (ma) => `MAN_HINH_${ma}_${TEP[ma][0]}.html`;
  const ma = Number(document.body.dataset.manHinh);
  const CHUNG = [
    ["du-lieu", "Có dữ liệu"],
    ["rong", "Rỗng"],
    ["dang-tai", "Đang tải"],
    ["loi", "Lỗi"],
    ["khong-quyen", "Không có quyền"],
  ];
  const RIENG = {
    242: [
      ["chua-xac-nhan", "Lần đầu: thông báo dữ liệu cá nhân"],
      ["dang-tra-loi", "Đang trả lời"],
      ["het-han-muc", "Hết hạn mức tháng"],
      ["het-luot", "Hết lượt hôm nay"],
      ["tat", "Công ty chưa bật"],
    ],
    243: [
      ["dang-tra-loi", "Đang soạn"],
      ["het-han-muc", "Hết hạn mức tháng"],
    ],
    244: [["chua-cau-hinh", "Máy chủ chưa cấu hình khóa"]],
    245: [],
  };
  const TRANG_THAI = CHUNG.concat(RIENG[ma]);
  const khoaLuu = "ban-mau-tro-ly-ai-trang-thai-" + ma;
  const doc = (k, md) => {
    try {
      return localStorage.getItem(k) || md;
    } catch (e) {
      return md;
    }
  };
  const ghi = (k, v) => {
    try {
      localStorage.setItem(k, v);
    } catch (e) {
      /* bỏ qua */
    }
  };
  let trangThai = doc(khoaLuu, "du-lieu");
  if (!TRANG_THAI.some(([k]) => k === trangThai)) trangThai = "du-lieu";

  // ---------- Thành phần dùng chung ----------
  const nut = (chu, loai, thongBao, them) => `<button type="button" class="nut ${loai || "chinh"} ${them || ""}" data-thong-bao="${thongBao || ""}">${chu}</button>`;
  const nhan = (chu, loai) => `<span class="nhan-trang-thai ${loai}">${chu}</span>`;
  const hop = (chu, loai) => `<div class="hop-thong-bao ${loai}" role="${loai === "loi" ? "alert" : "status"}">${chu}</div>`;
  const tai = (n) => Array.from({ length: n }, () => `<div class="khung-tai" aria-hidden="true"></div>`).join("") + `<span class="an-nhan">Đang tải…</span>`;
  const loiTai = `${hop("Không tải được dữ liệu. Kiểm tra kết nối mạng rồi thử lại.", "loi")}${nut("Thử lại", "phu")}`;
  const khongQuyen = hop("Bạn không có quyền xem màn hình này. Liên hệ quản trị công ty để được cấp quyền.", "canh-bao");
  const truong = (nhanO, giaTri, ghiChu, kieu) => {
    const id = "o-" + Math.random().toString(36).slice(2, 8);
    const o = kieu === "nhieu-dong" ? `<textarea id="${id}" class="o-nhap" rows="3">${giaTri || ""}</textarea>` : `<input id="${id}" class="o-nhap" value="${giaTri || ""}">`;
    return `<div class="truong-dt"><label for="${id}">${nhanO}</label>${o}${ghiChu ? `<span class="chu-nho">${ghiChu}</span>` : ""}</div>`;
  };
  const chon = (nhanO, cacLuaChon) => {
    const id = "c-" + Math.random().toString(36).slice(2, 8);
    return `<div class="truong-dt"><label for="${id}">${nhanO}</label><select id="${id}" class="o-nhap">${cacLuaChon.map((l) => `<option>${l}</option>`).join("")}</select></div>`;
  };
  const cong = (chu, bat, ghiChu) =>
    `<label style="display:flex;gap:8px;align-items:flex-start"><input type="checkbox" ${bat ? "checked" : ""}><span><b>${chu}</b>${ghiChu ? `<br><span class="chu-nho">${ghiChu}</span>` : ""}</span></label>`;
  const bang = (cot, dong, soCot) => `<div class="cuon-ngang"><table class="bang-web"><thead><tr>${cot.map((c) => `<th scope="col">${c}</th>`).join("")}</tr></thead>
    <tbody>${dong.map((d) => `<tr>${d.map((o, i) => `<td class="${(soCot || []).includes(i) ? "so" : ""}">${o}</td>`).join("")}</tr>`).join("")}</tbody></table></div>`;
  const che = (chu) => `<span class="nhan-che" title="Đã che trước khi gửi trợ lý">${chu}</span>`;

  const MENU_NEN_TANG = [
    ["Công ty", ""],
    ["Người dùng", ""],
    ["Vai trò", ""],
    ["Nhật ký thao tác", ""],
    ["Cài đặt tích hợp", ""],
    ["— Open API —", ""],
    ["Khóa API đối tác", ""],
    ["— Trợ lý AI —", ""],
    ["Cài đặt trợ lý AI", 244],
    ["Thống kê sử dụng", 245],
  ];
  const web = (than, menu, tenApp, coNgan) => `<div class="khung-web"><header class="thanh-tren"><span class="logo">VComm</span><span>${tenApp}</span><span class="gian"></span>
    <button type="button" class="nut-tro-ly" aria-pressed="${coNgan ? "true" : "false"}">✦ Trợ lý AI</button>
    <button type="button">VComm Thương mại ▾</button><button type="button">Trần Minh Khoa ▾</button></header>
    ${coNgan ? than : `<div class="than"><nav class="menu" aria-label="${tenApp}"><div class="ten-app">${tenApp}</div>${menu
      .map(([chu, dich]) =>
        chu.startsWith("—")
          ? `<div class="ten-app">${chu.replaceAll("—", "").trim()}</div>`
          : `<a href="${dich !== "" ? duongDan(dich) : "#"}" class="${dich === ma ? "chon" : ""}">${chu}</a>`,
      )
      .join("")}</nav><main class="noi-dung">${than}</main></div>`}</div>`;
  const theoTrangThai = (duLieu, rongThan) => {
    if (trangThai === "dang-tai") return tai(4);
    if (trangThai === "loi") return loiTai;
    if (trangThai === "khong-quyen") return khongQuyen;
    if (trangThai === "rong" && rongThan) return rongThan;
    return duLieu;
  };

  // ---------- MAN_HINH_242: ngăn trợ lý ----------
  const traLoiDoanhSo = (dangChay) => `<div class="tin tro-ly" aria-live="polite">
      ${dangChay
        ? `<div class="dang-goi">⟳ Đang xem Báo cáo bán hàng (01/11/2026 – 16/11/2026, VComm Thương mại)…</div><div>Doanh số 16 ngày đầu tháng 11 là</div>`
        : `<div>Doanh số 16 ngày đầu tháng 11/2026 của <b>VComm Thương mại</b> là <b>4.812.600.000 ₫</b> (chưa thuế), tăng <b>12,4%</b> so với cùng kỳ tháng 10.</div>
      <ul style="margin:6px 0;padding-left:18px">
        <li>Kênh Đại lý: 2.950.000.000 ₫ (61%)</li>
        <li>Kênh Bán lẻ: 1.210.400.000 ₫ (25%)</li>
        <li>Kênh Website: 652.200.000 ₫ (14%)</li>
      </ul>
      <div>Khách mua nhiều nhất: Công ty TNHH Phân phối Minh Long (812.000.000 ₫).</div>
      <div class="nguon"><b>Dữ liệu từ:</b> <a href="#">Báo cáo bán hàng</a> · 01/11–16/11/2026 · nhóm theo kênh; <a href="#">Báo cáo bán hàng</a> · 01/10–16/10/2026 · tổng. <br>Trợ lý có thể nhầm — kiểm tra ở màn hình nguồn.</div>
      <div class="danh-gia"><span>Câu trả lời này:</span><button type="button" aria-pressed="true" data-thong-bao="Đã ghi đánh giá">✓ Đúng</button><button type="button" aria-pressed="false" data-thong-bao="Chọn lý do: sai số liệu, không đúng ý, thiếu dữ liệu, khác">✗ Sai</button></div>`}
    </div>`;
  const hoiThoai = (dangChay) => `
      <div class="tin cua-toi">Doanh số tháng này tới hôm nay bao nhiêu, so với tháng trước?</div>
      ${traLoiDoanhSo(false)}
      <div class="tin cua-toi">Đơn nào của khách Nguyễn Thị Lan có số ${che("[ĐIỆN THOẠI]")} còn nợ?</div>
      ${dangChay
        ? `<div class="tin tro-ly"><div class="dang-goi">⟳ Đang xem Báo cáo công nợ phải thu…</div></div>`
        : `<div class="tin tro-ly"><div>Khách <b>Nguyễn Thị Lan</b> (${che("[ĐIỆN THOẠI]")}) còn nợ <b>2 đơn</b>, tổng <b>18.450.000 ₫</b>:</div>
        <ul style="margin:6px 0;padding-left:18px"><li><a href="#">DB-2026-001388</a> · hạn 10/11/2026 · quá hạn 7 ngày · 12.300.000 ₫</li><li><a href="#">DB-2026-001455</a> · hạn 25/11/2026 · 6.150.000 ₫</li></ul>
        <div class="nguon"><b>Dữ liệu từ:</b> <a href="#">Báo cáo công nợ phải thu</a> · đến 17/11/2026 · khách hàng "Nguyễn Thị Lan".</div>
        <div class="danh-gia"><span>Câu trả lời này:</span><button type="button" aria-pressed="false" data-thong-bao="Đã ghi đánh giá">✓ Đúng</button><button type="button" aria-pressed="false" data-thong-bao="Chọn lý do">✗ Sai</button></div></div>`}`;
  const oHoi = (khoa) => `<div class="o-hoi">
      ${khoa ? hop(khoa, "canh-bao") : ""}
      <div class="goi-y" aria-label="Câu hỏi gợi ý"><button type="button" ${khoa ? "disabled" : ""}>Tồn kho sắp hết ở Kho Hà Nội?</button><button type="button" ${khoa ? "disabled" : ""}>Top 5 sản phẩm bán chạy tuần này</button><button type="button" ${khoa ? "disabled" : ""}>Công nợ quá hạn trên 30 ngày</button></div>
      <label class="an-nhan" for="cau-hoi">Câu hỏi</label><textarea id="cau-hoi" rows="2" placeholder="Hỏi về doanh số, tồn kho, công nợ, hoa hồng, đơn bán, sản phẩm…" ${khoa ? "disabled" : ""}></textarea>
      <div style="display:flex;align-items:center;gap:8px"><span class="chu-nho">Còn ${trangThai === "het-luot" ? "0" : "22"}/30 lượt hôm nay · không gửi được dữ liệu ngoài quyền của bạn</span><span class="gian"></span>${nut("Gửi", "chinh", "Đã gửi", khoa ? "" : "")}</div>
    </div>`;
  const nganTroLy = () => {
    let giua;
    let khoa = "";
    if (trangThai === "dang-tai") giua = `<div class="dong-tin">${tai(3)}</div>`;
    else if (trangThai === "loi") giua = `<div class="dong-tin">${hop("Trợ lý tạm thời không phản hồi. Thử lại sau ít phút.", "loi")}${nut("Thử lại", "phu")}</div>`;
    else if (trangThai === "khong-quyen") return null;
    else if (trangThai === "tat") giua = `<div class="dong-tin">${hop("Công ty chưa bật trợ lý AI hoặc chưa đặt hạn mức chi phí. Liên hệ quản trị công ty.", "thong-tin")}</div>`;
    else if (trangThai === "rong")
      giua = `<div class="dong-tin"><div class="the-web"><b>Xin chào, tôi là trợ lý AI của VComm.</b><div class="chu-nho">Tôi đọc số liệu bạn được quyền xem: báo cáo bán hàng, tồn kho, công nợ, hoa hồng, đơn bán, sản phẩm. Tôi không sửa dữ liệu. Hội thoại lưu 90 ngày, chỉ bạn xem được.</div></div></div>`;
    else if (trangThai === "chua-xac-nhan")
      giua = `<div class="dong-tin"><div class="the-web" role="dialog" aria-labelledby="tb-tieu-de"><h3 id="tb-tieu-de" style="margin:0">Thông báo xử lý dữ liệu cá nhân (phiên bản 1)</h3>
        <ul style="margin:0;padding-left:18px;font-size:14px;line-height:1.5">
          <li>Câu hỏi của bạn và số liệu trợ lý đọc được gửi tới nhà cung cấp mô hình <b>Anthropic</b> (máy chủ ở <b>Hoa Kỳ</b>) để tạo câu trả lời.</li>
          <li>Trước khi gửi, hệ thống che số điện thoại, email, số định danh, số tài khoản. Tên, địa chỉ khách hàng không được che.</li>
          <li>Nhà cung cấp không dùng dữ liệu này để huấn luyện mô hình (theo điều khoản thương mại).</li>
          <li>Hội thoại lưu 90 ngày trên VComm, chỉ bạn xem được; bạn xóa được bất kỳ lúc nào. Quản trị chỉ xem số lượt, chi phí.</li>
        </ul>
        <div class="nhom-nut">${nut("Tôi đã đọc và đồng ý", "chinh", "Đã ghi xác nhận")}${nut("Để sau", "phu")}</div></div></div>`;
    else {
      if (trangThai === "het-han-muc") khoa = "Công ty đã dùng hết hạn mức trợ lý AI tháng 11. Trợ lý mở lại ngày 01/12/2026 hoặc khi quản trị tăng hạn mức.";
      if (trangThai === "het-luot") khoa = "Bạn đã dùng hết 30 lượt hôm nay. Trợ lý mở lại lúc 0 giờ ngày mai.";
      giua = `<div class="dong-tin">${hoiThoai(trangThai === "dang-tra-loi")}</div>`;
    }
    const coDsHoiThoai = !["rong", "chua-xac-nhan", "tat"].includes(trangThai);
    return `<aside class="ngan-tro-ly" aria-label="Trợ lý AI">
      <div class="dau-ngan"><h2>✦ Trợ lý AI</h2><span class="gian"></span>${nut("+ Hội thoại mới", "phu")}${nut("Xóa hội thoại", "phu", "Đã xóa hội thoại")}<button type="button" class="nut phu" aria-label="Đóng">✕</button></div>
      <nav class="ds-hoi-thoai" aria-label="Hội thoại của tôi">${coDsHoiThoai ? `<a href="#" class="chon">Doanh số tháng này…</a><a href="#">Tồn Kho Hà Nội sắp hết</a><a href="#">Hoa hồng tháng 10</a><a href="#">Xem tất cả (12)</a>` : `<span class="chu-nho">Chưa có hội thoại</span>`}</nav>
      ${giua}
      ${["chua-xac-nhan", "tat", "dang-tai", "loi"].includes(trangThai) ? "<div></div>" : oHoi(khoa)}
    </aside>`;
  };
  const man242 = () => {
    if (trangThai === "khong-quyen")
      return web(
        `<div class="tieu-de"><h1>Báo cáo bán hàng</h1></div>${hop("Trạng thái không quyền: người không có <code>ai.chat.use</code> không thấy nút ✦ Trợ lý AI trên thanh trên (bản mẫu vẫn vẽ nút để so sánh).", "thong-tin")}`,
        [["Tổng quan", ""], ["Bán hàng", ""], ["Tồn kho", ""]],
        "Phân tích dữ liệu",
      );
    return web(
      `<div class="khung-co-ngan"><div class="noi-dung-sau"><h1 style="margin:0">Báo cáo bán hàng</h1>${tai(5).replace('<span class="an-nhan">Đang tải…</span>', "")}<span class="chu-nho">(Màn hình mini app đang mở phía sau ngăn)</span></div>${nganTroLy()}</div>`,
      null,
      "Phân tích dữ liệu",
      true,
    );
  };

  // ---------- MAN_HINH_243: soạn nội dung sản phẩm ----------
  const man243 = () => {
    const bieuMau = `<div class="the-web" style="opacity:.6"><h2 style="margin:0">Sửa sản phẩm SP-00412</h2>
      <div class="luoi-truong">${truong("Tên sản phẩm", "Nồi chiên không dầu Lumi 6 lít")}${truong("Thương hiệu", "Lumi")}${truong("Xuất xứ", "Việt Nam")}${chon("Danh mục", ["Gia dụng › Nhà bếp"])}</div>
      ${truong("Mô tả sản phẩm", "Nồi chiên 6L, 1500W.", "", "nhieu-dong")}</div>`;
    let ketQua;
    if (trangThai === "dang-tai" || trangThai === "dang-tra-loi") ketQua = `<div class="dang-goi">⟳ Trợ lý đang soạn nội dung…</div>${tai(3)}`;
    else if (trangThai === "loi") ketQua = `${hop("Trợ lý tạm thời không phản hồi. Nội dung trên biểu mẫu không thay đổi.", "loi")}${nut("Thử lại", "phu")}`;
    else if (trangThai === "het-han-muc") ketQua = hop("Công ty đã dùng hết hạn mức trợ lý AI tháng 11. Mở lại ngày 01/12/2026 hoặc khi quản trị tăng hạn mức.", "canh-bao");
    else if (trangThai === "rong") ketQua = `<div class="chu-nho">Chọn giọng văn, độ dài rồi bấm Soạn. Trợ lý chỉ dùng thông tin đang có trên biểu mẫu; thông số thiếu sẽ ghi <span class="can-bo-sung">[cần bổ sung]</span>.</div>`;
    else
      ketQua = `<div class="ba-cot-noi-dung">
        <div class="phan-ket-qua"><h3>Mô tả sản phẩm <span class="gian"></span>${nut("Dùng", "phu", "Đã điền vào ô Mô tả sản phẩm. Bấm Lưu trên biểu mẫu để lưu.")}</h3>
          <p style="margin:0">Nồi chiên không dầu Lumi dung tích 6 lít, công suất 1500W, phù hợp gia đình 4–6 người. Công nghệ đối lưu khí nóng giúp món ăn chín đều, giòn bên ngoài, giảm đến <span class="can-bo-sung">[cần bổ sung: tỷ lệ giảm dầu]</span> lượng dầu so với chiên truyền thống. Lòng nồi phủ chống dính <span class="can-bo-sung">[cần bổ sung: loại lớp phủ]</span>, dễ vệ sinh.</p></div>
        <div class="phan-ket-qua"><h3>Mô tả đăng bán <span class="chu-nho">612/5.000 ký tự</span><span class="gian"></span>${nut("Dùng", "phu", "Đã điền vào ô Mô tả đăng bán")}</h3>
          <p style="margin:0">Bữa ăn giòn ngon, ít dầu mỡ cho cả nhà với nồi chiên không dầu Lumi 6 lít. Dung tích lớn đủ cho một con gà nguyên con…</p></div>
        <div class="phan-ket-qua"><h3>Điểm nổi bật <span class="gian"></span>${nut("Dùng", "phu", "Đã điền vào danh sách điểm nổi bật")}</h3>
          <ul style="margin:0;padding-left:18px"><li>Dung tích 6 lít cho gia đình 4–6 người</li><li>Công suất 1500W, nấu nhanh</li><li>Chiên ít dầu, món giòn đều</li><li>Lòng nồi chống dính, dễ vệ sinh</li></ul></div>
        ${hop("Có 2 thông số trợ lý ghi <b>[cần bổ sung]</b>. Sửa trước khi lưu. Nội dung do AI soạn được ghi chú trong nhật ký thao tác khi bạn lưu.", "canh-bao")}
        <div class="nhom-nut">${nut("Dùng tất cả", "chinh", "Đã điền cả ba phần vào biểu mẫu")}${nut("Viết lại", "phu", "Đang soạn lại…")}</div></div>`;
    const ngan = `<aside class="ngan-tro-ly" aria-label="Soạn nội dung bằng AI" style="grid-template-rows:auto auto minmax(0,1fr)">
      <div class="dau-ngan"><h2>✦ Soạn nội dung bằng AI</h2><span class="gian"></span><button type="button" class="nut phu" aria-label="Đóng">✕</button></div>
      <div style="padding:12px 16px;border-bottom:1px solid var(--mau-vien);display:grid;gap:8px">
        <div class="luoi-truong">${chon("Giọng văn", ["Chuyên nghiệp", "Thân thiện", "Ngắn gọn"])}${chon("Độ dài", ["Vừa (khoảng 200 từ)", "Ngắn (khoảng 80 từ)", "Dài (khoảng 400 từ)"])}</div>
        ${truong("Từ khóa muốn nhắc (cách nhau dấu phẩy, tối đa 10)", "ít dầu, gia đình, chống dính")}
        <div style="display:flex;align-items:center;gap:8px"><span class="chu-nho">Còn 22/30 lượt hôm nay</span><span class="gian"></span>${nut("Soạn", "chinh", "Đang soạn…")}</div></div>
      <div class="dong-tin">${ketQua}</div></aside>`;
    if (trangThai === "khong-quyen")
      return web(`<div class="noi-dung">${bieuMau}${hop("Trạng thái không quyền: người thiếu <code>ai.product_content.use</code> hoặc quyền sửa sản phẩm không thấy nút “Soạn bằng AI” cạnh ô Mô tả.", "thong-tin")}</div>`, null, "Sản phẩm", true);
    return web(`<div class="khung-co-ngan"><div class="noi-dung-sau" style="opacity:1">${bieuMau}</div>${ngan}</div>`, null, "Sản phẩm", true);
  };

  // ---------- MAN_HINH_244: cài đặt ----------
  const man244 = () =>
    web(
      `<div class="tieu-de"><h1>Cài đặt trợ lý AI</h1></div>
      ${theoTrangThai(
        `${trangThai === "chua-cau-hinh" ? hop("Máy chủ chưa cấu hình nhà cung cấp mô hình (khóa API). Trợ lý chưa dùng được dù đã bật. Liên hệ quản trị hệ thống.", "canh-bao") : ""}
        <div class="the-web"><h2 style="margin:0">Tính năng</h2>
          ${cong("Hỏi đáp số liệu", true, "Nhân viên có quyền <code>ai.chat.use</code> hỏi về báo cáo, đơn bán, sản phẩm, tồn kho trong phạm vi quyền của mình.")}
          ${cong("Soạn nội dung sản phẩm", false, "Nhân viên có <code>ai.product_content.use</code> và quyền sửa sản phẩm nhờ AI soạn nháp mô tả.")}</div>
        <div class="the-web"><h2 style="margin:0">Hạn mức</h2>
          <div class="luoi-truong">${truong("Hạn mức chi phí mỗi tháng (USD, 0 = tắt)", "200,00", "≈ 5.270.000 ₫ theo tỷ giá bán Vietcombank 17/11/2026 (tham khảo)")}${truong("Số lượt mỗi người mỗi ngày (1 đến 500)", "30")}</div>
          ${hop("Tháng 11 đã dùng <b>142,37 USD</b> / 200,00 USD (71%). Hết hạn mức thì trợ lý khóa đến ngày 1 tháng sau và người có quyền cài đặt nhận thông báo.", "thong-tin")}</div>
        <div class="the-web"><h2 style="margin:0">Nhà cung cấp, dữ liệu cá nhân</h2>
          ${bang(["Mục", "Giá trị"], [
            ["Nhà cung cấp", "Anthropic (API trực tiếp)" + (trangThai === "chua-cau-hinh" ? " · " + nhan("Chưa cấu hình", "canh-bao") : " · " + nhan("Đã cấu hình", "thanh-cong"))],
            ["Mô hình", "<code>claude-sonnet-5-5</code> (đổi bằng cấu hình máy chủ)"],
            ["Đơn giá", "2 USD / 10 USD mỗi triệu token vào / ra"],
            ["Dữ liệu được che", "Điện thoại, email, số định danh, số tài khoản"],
            ["Lưu hội thoại", "90 ngày, chỉ người hỏi xem được"],
            ["Thông báo xử lý dữ liệu cá nhân", "Phiên bản 1 · 18/24 người dùng đã xác nhận · <a href='#'>Xem nội dung</a>"],
          ])}</div>
        <div class="nhom-nut">${nut("Lưu", "chinh", "Đã lưu cài đặt trợ lý AI")}${nut("Hủy", "phu")}</div>`,
        `${hop("Công ty chưa bật trợ lý AI. Mặc định hai tính năng tắt, hạn mức 0 USD.", "thong-tin")}
         <div class="the-web">${cong("Hỏi đáp số liệu", false)}${cong("Soạn nội dung sản phẩm", false)}<div class="luoi-truong">${truong("Hạn mức chi phí mỗi tháng (USD, 0 = tắt)", "0,00")}${truong("Số lượt mỗi người mỗi ngày", "30")}</div>${nut("Lưu", "chinh", "Đã lưu")}</div>`,
      )}`,
      MENU_NEN_TANG,
      "Nền tảng",
    );

  // ---------- MAN_HINH_245: thống kê ----------
  const cot = [3, 5, 8, 6, 9, 2, 1, 7, 10, 12, 9, 11, 3, 2, 8, 13, 6].map((h) => `<span style="height:${h * 8}px" title="${h * 1.2} USD"></span>`).join("");
  const man245 = () =>
    web(
      `<div class="tieu-de"><h1>Thống kê sử dụng trợ lý AI</h1>${nut("Xuất Excel", "phu", "Đã tải tệp")}</div>
      <div class="luoi-truong">${chon("Tháng", ["11/2026", "10/2026", "09/2026"])}${chon("Tính năng", ["Mọi tính năng", "Hỏi đáp số liệu", "Soạn nội dung sản phẩm"])}</div>
      ${hop("Màn hình chỉ có số lượt, token, chi phí, đánh giá. Không ai ngoài người hỏi xem được nội dung hội thoại.", "thong-tin")}
      ${theoTrangThai(
        `<div class="luoi-truong">
          <div class="the-web"><div class="chu-nho">Chi phí tháng / hạn mức</div><div class="so-lon">142,37 / 200 USD</div><div class="tien-do"><span style="width:71%"></span></div><div class="chu-nho">≈ 3.750.000 ₫ (tham khảo)</div></div>
          <div class="the-web"><div class="chu-nho">Số lượt</div><div class="so-lon">2.846</div><div class="chu-nho">Hỏi đáp 2.611 · Soạn nội dung 235 · lỗi 14 · từ chối 2</div></div>
          <div class="the-web"><div class="chu-nho">Người dùng</div><div class="so-lon">18</div><div class="chu-nho">trên 24 người có quyền</div></div>
          <div class="the-web"><div class="chu-nho">Đánh giá</div><div class="so-lon">86% Đúng</div><div class="chu-nho">412 Đúng · 67 Sai (sai số liệu 21, không đúng ý 30, thiếu dữ liệu 12, khác 4)</div></div></div>
        <div class="the-web"><h2 style="margin:0">Chi phí theo ngày (USD)</h2><div class="cot-bieu-do" role="img" aria-label="Chi phí theo ngày từ 01/11 đến 17/11/2026">${cot}</div><div class="chu-nho">01/11 → 17/11/2026</div></div>
        <div class="the-web"><h2 style="margin:0">Theo người dùng</h2>${bang(
          ["Người dùng", "Lượt", "Token vào", "Token ra", "Chi phí (USD)", "Đúng / Sai"],
          [
            ["Lê Thu Hà · Kế toán", "412", "3.912.000", "318.000", "22,01", "71 / 9"],
            ["Phạm Quốc Bảo · Bán hàng", "388", "3.540.000", "296.500", "20,09", "52 / 11"],
            ["Đỗ Mai Anh · Sản phẩm", "235", "702.000", "188.000", "6,57", "— (soạn nội dung)"],
            ["Trần Minh Khoa · Quản trị", "96", "880.000", "71.000", "4,94", "15 / 2"],
          ],
          [1, 2, 3, 4],
        )}</div>`,
        `<div class="the-web"><p style="margin:0">Tháng 11/2026 chưa có lượt dùng trợ lý AI.</p></div>`,
      )}`,
      MENU_NEN_TANG,
      "Nền tảng",
    );

  const MAN_HINH = { 242: man242, 243: man243, 244: man244, 245: man245 };

  // ---------- Dựng trang ----------
  const goc = document.getElementById("ung-dung");
  const dung = () => {
    goc.innerHTML = `<div class="trang-ban-mau"><header><h1>MAN_HINH_${ma} ${TEP[ma][1]}</h1><p>CONG_VIEC_63 · dữ liệu giả · <a href="index.html">Danh sách bản mẫu</a></p></header>
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
      ghi(khoaLuu, trangThai);
      dung();
      return;
    }
    const hanhDong = e.target.closest("[data-thong-bao]");
    if (hanhDong && hanhDong.dataset.thongBao) {
      const thongBao = document.querySelector(".thong-bao-noi-dt");
      thongBao.textContent = hanhDong.dataset.thongBao;
      thongBao.classList.add("hien");
      setTimeout(() => thongBao.classList.remove("hien"), 2500);
    }
  });
  dung();
})();
