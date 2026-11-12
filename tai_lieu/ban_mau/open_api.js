// Bản mẫu CONG_VIEC_61 (MODULE_16 Open API cho đối tác): dựng MAN_HINH_224 đến 226 và phần sửa màn hình đơn bán từ dữ liệu giả. Không phải mã sản phẩm.
(function () {
  const TEP = {
    224: ["KHOA_API", "Khóa API đối tác (web)"],
    225: ["CHI_TIET_KHOA_API", "Chi tiết khóa API (web)"],
    226: ["NHAT_KY_GOI_API", "Nhật ký gọi API (web)"],
    0: ["SUA_DON_BAN_OPEN_API", "Sửa màn hình đơn bán: đơn tạo qua Open API"],
  };
  const duongDan = (ma) => (ma === 0 ? `${TEP[0][0]}.html` : `MAN_HINH_${ma}_${TEP[ma][0]}.html`);
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
  let trangThai = doc("ban-mau-open-api-trang-thai", "du-lieu");

  // ---------- Thành phần dùng chung ----------
  const nut = (chu, loai, thongBao, them) => `<button type="button" class="nut ${loai || "chinh"} ${them || ""}" data-thong-bao="${thongBao || ""}">${chu}</button>`;
  const nhan = (chu, loai) => `<span class="nhan-trang-thai ${loai}">${chu}</span>`;
  const hop = (chu, loai) => `<div class="hop-thong-bao ${loai}" role="${loai === "loi" ? "alert" : "status"}">${chu}</div>`;
  const tai = (n) => Array.from({ length: n }, () => `<div class="khung-tai" aria-hidden="true"></div>`).join("") + `<span class="an-nhan">Đang tải…</span>`;
  const loiTai = `${hop("Không tải được dữ liệu. Kiểm tra kết nối mạng rồi thử lại.", "loi")}${nut("Thử lại", "phu", "", "rong")}`;
  const truong = (nhanO, giaTri, loi, kieu) => {
    const id = "o-" + Math.random().toString(36).slice(2, 8);
    const o = kieu === "nhieu-dong" ? `<textarea id="${id}" rows="3">${giaTri || ""}</textarea>` : `<input id="${id}" class="o-nhap" value="${giaTri || ""}">`;
    return `<div class="truong-dt"><label for="${id}">${nhanO}</label>${o}${loi ? `<span class="loi">${loi}</span>` : ""}</div>`;
  };
  const chon = (nhanO, cacLuaChon) => {
    const id = "c-" + Math.random().toString(36).slice(2, 8);
    return `<div class="truong-dt"><label for="${id}">${nhanO}</label><select id="${id}" class="o-nhap">${cacLuaChon.map((l) => `<option>${l}</option>`).join("")}</select></div>`;
  };
  const hopChon = (nhanO, cacLuaChon) =>
    `<fieldset class="truong-dt"><legend>${nhanO}</legend>${cacLuaChon
      .map(([chu, daChon, ghiChu]) => `<label style="display:block"><input type="checkbox" ${daChon ? "checked" : ""}> ${chu}${ghiChu ? ` <span class="chu-nho">${ghiChu}</span>` : ""}</label>`)
      .join("")}</fieldset>`;

  // ---------- Web ----------
  const MENU_WEB = [
    ["Công ty", ""],
    ["Chi nhánh", ""],
    ["Người dùng", ""],
    ["Vai trò", ""],
    ["Nhật ký thao tác", ""],
    ["Cài đặt tích hợp", ""],
    ["— Open API —", ""],
    ["Khóa API đối tác", 224],
    ["Nhật ký gọi API", 226],
  ];
  const web = (than, menu, tenApp) => `<div class="khung-web"><header class="thanh-tren"><span class="logo">VComm</span><span>${tenApp || "Nền tảng"}</span><span class="gian"></span>
    <button type="button">VComm Thương mại ▾</button><button type="button">Trần Minh Khoa ▾</button></header>
    <div class="than"><nav class="menu" aria-label="${tenApp || "Nền tảng"}"><div class="ten-app">${tenApp || "Nền tảng"}</div>${(menu || MENU_WEB)
      .map(([chu, dich]) =>
        chu.startsWith("—")
          ? `<div class="ten-app">${chu.replaceAll("—", "").trim()}</div>`
          : `<a href="${dich !== "" ? duongDan(dich) : "#"}" class="${dich === ma || (ma === 225 && dich === 224) ? "chon" : ""}">${chu}</a>`,
      )
      .join("")}</nav><main class="noi-dung">${than}</main></div></div>`;
  const bang = (cot, dong, soCot) => `<div class="cuon-ngang"><table class="bang-web"><thead><tr>${cot.map((c) => `<th scope="col">${c}</th>`).join("")}</tr></thead>
    <tbody>${dong.map((d) => `<tr>${d.map((o, i) => `<td class="${(soCot || []).includes(i) ? "so" : ""}">${o}</td>`).join("")}</tr>`).join("")}</tbody></table></div>`;
  const theWeb = (cacThe, chonThe) => `<nav class="cac-the-web">${cacThe.map((t) => `<a href="#" class="${t === chonThe ? "chon" : ""}">${t}</a>`).join("")}</nav>`;
  const webTheoTrangThai = (duLieu, rongThan) => {
    if (trangThai === "dang-tai") return tai(4);
    if (trangThai === "loi") return loiTai;
    if (trangThai === "khong-quyen") return hop("Bạn không có quyền xem màn hình này. Liên hệ quản trị công ty để được cấp quyền.", "canh-bao");
    if (trangThai === "rong" && rongThan) return rongThan;
    return duLieu;
  };
  const PHAM_VI = [
    ["Sản phẩm, giá, tồn kho (chỉ đọc)", true],
    ["Đơn bán: tạo, xem, hủy đơn nháp", true],
    ["Khách hàng do đối tác tạo (lát L3)", false, "— có dữ liệu cá nhân"],
    ["Điểm thưởng: tra, tích, đổi (lát L4)", false, "— cần mã OTP của hội viên"],
  ];
  const bieuMauKhoa = (laSua) => `<div class="luoi-truong">
      ${chon("Loại khóa", ["Đối tác bên ngoài", "Phần mềm nội bộ của công ty (không gắn đối tác)"])}
      ${truong("Đối tác (trong danh mục đối tác của công ty)", "DL-0012 · Công ty TNHH Phân phối Minh Long")}
      ${truong("Tên khóa (1 đến 100 ký tự)", "Minh Long · máy chủ chính")}
      ${chon("Kênh bán (bảng giá theo kênh)", ["Đại lý", "Bán lẻ", "Website"])}
      ${truong("Hạn dùng (để trống: không hết hạn)", "31/12/2027")}
      ${truong("Giới hạn mỗi phút (1 đến 600)", "60")}</div>
      ${hopChon("Phạm vi quyền", PHAM_VI)}
      ${hopChon("Kho được xem tồn, xuất đơn", [
        ["KHO-HN · Kho Hà Nội", true],
        ["KHO-BD · Kho Bình Dương", true],
        ["KHO-DN · Kho Đà Nẵng", false],
      ])}
      ${truong("Địa chỉ IP được phép, mỗi dòng một địa chỉ hoặc dải CIDR (để trống: mọi IP)", "203.113.10.24\n203.113.10.0/28", laSua ? "" : "", "nhieu-dong")}
      ${hop("Nhóm khách hàng của đối tác quyết định giá (đang là: Đại lý cấp 1). Đổi nhóm ở hồ sơ đối tác.", "thong-tin")}`;

  // ---------- Màn hình ----------
  const MAN_HINH = {
    224: () =>
      web(`<div class="tieu-de"><h1>Khóa API đối tác</h1>${nut("Cấp khóa mới", "chinh")}</div>
      <div class="luoi-truong">${truong("Tìm tên khóa, đối tác, 8 ký tự đầu", "")}${chon("Trạng thái", ["Mọi trạng thái", "Đang dùng", "Hết hạn", "Đã thu hồi"])}${chon("Loại", ["Mọi loại", "Đối tác bên ngoài", "Phần mềm nội bộ"])}</div>
      ${webTheoTrangThai(
        `${bang(
          ["Tên khóa", "Đối tác", "Đầu khóa", "Phạm vi", "Giới hạn/phút", "Hạn dùng", "Lần gọi gần nhất", "Trạng thái"],
          [
            [
              `<a href="${duongDan(225)}">Minh Long · máy chủ chính</a>`,
              "DL-0012 · Phân phối Minh Long",
              "<code>vck_7Hq2xP9a…</code>",
              "Sản phẩm · Đơn bán",
              "60",
              "31/12/2027",
              "12/11/2026 10:41",
              nhan("Đang dùng", "thanh-cong"),
            ],
            [
              `<a href="${duongDan(225)}">Shop Xanh · website</a>`,
              "KH-0451 · Hộ kinh doanh Shop Xanh",
              "<code>vck_Lm03Ty8e…</code>",
              "Sản phẩm · Đơn bán · Khách hàng",
              "120",
              "—",
              "12/11/2026 10:39",
              nhan("Đang dùng", "thanh-cong"),
            ],
            [
              `<a href="${duongDan(225)}">Phần mềm kế toán</a>`,
              "<span class='chu-nho'>Nội bộ</span>",
              "<code>vck_Qa91Bc2n…</code>",
              "Sản phẩm",
              "30",
              "—",
              "11/11/2026 23:00",
              nhan("Đang dùng", "thanh-cong"),
            ],
            [
              `<a href="${duongDan(225)}">Minh Long · thử nghiệm</a>`,
              "DL-0012 · Phân phối Minh Long",
              "<code>vck_Zz40Kp1w…</code>",
              "Sản phẩm · Đơn bán",
              "60",
              "01/11/2026",
              "28/10/2026 15:02",
              nhan("Hết hạn", "canh-bao"),
            ],
            [
              `<a href="${duongDan(225)}">Đại lý Hồng Phát</a>`,
              "DL-0007 · Đại lý Hồng Phát",
              "<code>vck_Rt55Gh7u…</code>",
              "Sản phẩm · Đơn bán",
              "60",
              "—",
              "02/10/2026 08:12",
              nhan("Đã thu hồi", "trung-tinh"),
            ],
          ],
          [4],
        )}
      <div class="the-web"><h2>Cấp khóa mới</h2>${bieuMauKhoa(false)}
        <div class="nhom-nut">${nut("Cấp khóa", "chinh", "Đã cấp khóa. Sao chép khóa ngay, khóa chỉ hiện một lần.")}${nut("Hủy", "phu")}</div></div>
      <div class="the-web"><h2>Khóa vừa cấp · Minh Long · máy chủ chính</h2>
        ${hop("Khóa chỉ hiện <b>một lần</b>. Sao chép và gửi cho đối tác qua kênh an toàn. Đóng hộp này thì không xem lại được; quên khóa thì cấp lại.", "canh-bao")}
        <div class="truong-dt"><label for="khoa-moi">Khóa API</label><input id="khoa-moi" class="o-nhap" readonly value="vck_7Hq2xP9aD4mW1sKe8uZr0bTnY6cVf3Lg"></div>
        <div class="chu-nho">Đối tác gửi khóa trong header <code>Authorization: Bearer &lt;khóa&gt;</code> tới <code>https://api.vcomm.vn/api/v1/open/…</code></div>
        <div class="nhom-nut">${nut("Sao chép khóa", "chinh", "Đã sao chép")}${nut("Tôi đã lưu khóa, đóng", "phu")}</div></div>`,
        `<div class="the-web"><p style="margin:0">Công ty chưa cấp khóa API nào. Cấp khóa để đối tác, phần mềm khác kết nối với VComm.</p>${nut("Cấp khóa mới", "chinh")}</div>`,
      )}`),

    225: () =>
      web(`<div class="tieu-de"><h1>Minh Long · máy chủ chính</h1>${nhan("Đang dùng", "thanh-cong")}</div>
      <div class="chu-nho"><a href="${duongDan(224)}">‹ Khóa API đối tác</a> · Đầu khóa <code>vck_7Hq2xP9a…</code> · cấp bởi Trần Minh Khoa 01/11/2026 09:10 · phiên bản 3</div>
      ${webTheoTrangThai(
        `<div class="luoi-truong">
          <div class="the-web"><div class="chu-nho">Gọi 24 giờ qua</div><div class="so-lon">4.812</div><div class="chu-nho">trong đó lỗi 37 · bị giới hạn 5</div></div>
          <div class="the-web"><div class="chu-nho">Cao nhất một phút (24 giờ)</div><div class="so-lon">58 / 60</div></div>
          <div class="the-web"><div class="chu-nho">Lần gọi gần nhất</div><div class="chu-dam">12/11/2026 10:41:07</div><div class="chu-nho">từ 203.113.10.24</div></div></div>
        ${theWeb(["Cấu hình", "Nhật ký gọi", "Lịch sử thay đổi"], "Cấu hình")}
        <div class="the-web"><h2>Cấu hình</h2>${bieuMauKhoa(true)}
          ${hop("Giới hạn mỗi phút phải từ 1 đến 600.", "loi")}
          <div class="nhom-nut">${nut("Lưu", "chinh", "Đã lưu cấu hình khóa")}</div></div>
        <div class="the-web"><h2>Cấp lại khóa</h2>
          ${hop("Cấp lại tạo chuỗi khóa mới, khóa cũ ngừng dùng được ngay. Cấu hình, nhật ký giữ nguyên. Dùng khi khóa bị lộ hoặc đối tác làm mất.", "thong-tin")}
          <div class="nhom-nut">${nut("Cấp lại khóa", "phu", "Đã cấp lại khóa. Khóa cũ không còn dùng được.")}</div></div>
        <div class="the-web"><h2>Thu hồi khóa</h2>${truong("Lý do (1 đến 500 ký tự)", "", "", "nhieu-dong")}
          ${hop("Thu hồi là vĩnh viễn: mọi lần gọi bằng khóa này trả lỗi 401. Đơn đã tạo qua khóa vẫn giữ nguyên.", "canh-bao")}
          <div class="nhom-nut">${nut("Thu hồi khóa", "nguy-hiem", "Đã thu hồi khóa")}</div></div>
        <div class="the-web"><h2>Lịch sử thay đổi</h2>${bang(
          ["Thời điểm", "Người", "Thao tác", "Nội dung"],
          [
            ["10/11/2026 14:20", "Trần Minh Khoa", "Sửa cấu hình", "Giới hạn mỗi phút 30 → 60; thêm kho KHO-BD"],
            ["05/11/2026 08:02", "Trần Minh Khoa", "Cấp lại khóa", "Đầu khóa vck_P0sl… → vck_7Hq2…"],
            ["01/11/2026 09:10", "Trần Minh Khoa", "Cấp khóa", "Phạm vi Sản phẩm, Đơn bán; kênh Đại lý"],
          ],
        )}</div>`,
      )}`),

    226: () =>
      web(`<div class="tieu-de"><h1>Nhật ký gọi API</h1></div>
      <div class="luoi-truong">${chon("Khóa", ["Mọi khóa", "Minh Long · máy chủ chính", "Shop Xanh · website", "Phần mềm kế toán"])}${chon("Kết quả", ["Mọi kết quả", "Thành công (2xx)", "Lỗi của đối tác (4xx)", "Bị giới hạn (429)", "Lỗi máy chủ (5xx)"])}
        ${truong("Từ", "12/11/2026 00:00")}${truong("Đến", "12/11/2026 23:59")}${truong("Đường dẫn chứa", "")}</div>
      ${hop("Nhật ký giữ 90 ngày, không ghi nội dung yêu cầu và kết quả. Lần gọi không có khóa hoặc khóa sai không gắn được công ty nên không hiện ở đây.", "thong-tin")}
      ${webTheoTrangThai(
        `${bang(
          ["Thời điểm", "Khóa", "Phương thức", "Đường dẫn", "Kết quả", "Mã lỗi", "Thời gian xử lý", "IP", "Mã yêu cầu"],
          [
            ["12/11/2026 10:41:07", "Minh Long · máy chủ chính", "GET", "/api/v1/open/stock?warehouse=KHO-HN", nhan("200", "thanh-cong"), "—", "84 ms", "203.113.10.24", "<code>9f2c…e1</code>"],
            ["12/11/2026 10:40:55", "Minh Long · máy chủ chính", "POST", "/api/v1/open/sales-orders", nhan("201", "thanh-cong"), "—", "212 ms", "203.113.10.24", "<code>77ab…04</code>"],
            ["12/11/2026 10:40:12", "Minh Long · máy chủ chính", "POST", "/api/v1/open/sales-orders", nhan("422", "canh-bao"), "VALIDATION_FAILED", "35 ms", "203.113.10.24", "<code>51de…9a</code>"],
            ["12/11/2026 10:39:59", "Shop Xanh · website", "GET", "/api/v1/open/products?page=3", nhan("429", "canh-bao"), "RATE_LIMITED", "2 ms", "113.161.4.7", "<code>0c33…7d</code>"],
            ["12/11/2026 10:39:01", "Phần mềm kế toán", "GET", "/api/v1/open/customers", nhan("403", "loi"), "SCOPE_NOT_GRANTED", "3 ms", "10.0.4.12", "<code>a2b9…11</code>"],
          ],
          [6],
        )}
        <div class="nhom-nut"><span class="chu-nho">1–5 trên 4.812 dòng</span><span class="gian"></span>${nut("Trang trước", "phu")}${nut("Trang sau", "phu")}</div>`,
        `<div class="the-web"><p style="margin:0">Không có lần gọi nào khớp điều kiện lọc.</p></div>`,
      )}`),

    0: () =>
      web(
        `<div class="tieu-de"><h1>Đơn bán</h1>${nut("Thêm đơn", "chinh")}</div>
      <div class="luoi-truong">${truong("Tìm số đơn, khách hàng, mã đơn đối tác", "")}${chon("Nguồn", ["Mọi nguồn", "Nhập trên web", "Open API"])}${chon("Trạng thái", ["Mọi trạng thái", "Nháp", "Chờ duyệt", "Đã xác nhận"])}</div>
      ${webTheoTrangThai(
        `${bang(
          ["Số đơn", "Ngày", "Khách hàng", "Nguồn", "Tổng tiền (₫)", "Trạng thái"],
          [
            ["<a href='#'>DB-2026-001502</a>", "12/11/2026", "Phân phối Minh Long", nhan("Open API", "thong-tin") + " <span class='chu-nho'>ML-88213</span>", "48.600.000", nhan("Nháp", "trung-tinh")],
            ["<a href='#'>DB-2026-001501</a>", "12/11/2026", "Siêu thị Hòa Bình", "Nhập trên web", "12.300.000", nhan("Chờ duyệt", "canh-bao")],
          ],
          [4],
        )}
      <div class="the-web"><div class="tieu-de"><h2>DB-2026-001502</h2>${nhan("Nháp", "trung-tinh")}</div>
        ${hop("Đơn tạo qua Open API bằng khóa <b>Minh Long · máy chủ chính</b> lúc 12/11/2026 10:40. Mã đơn của đối tác: <b>ML-88213</b>. Kiểm tra rồi bấm Gửi duyệt như đơn thường. Đối tác hủy được đơn khi đơn còn Nháp.", "thong-tin")}
        ${bang(
          ["Mục", "Giá trị"],
          [
            ["Khách hàng", "DL-0012 · Công ty TNHH Phân phối Minh Long (nhóm Đại lý cấp 1)"],
            ["Kênh bán", "Đại lý"],
            ["Kho xuất", "KHO-HN · Kho Hà Nội"],
            ["Địa chỉ giao", "Số 12 Trần Phú, Hà Đông, Hà Nội"],
            ["Ghi chú của đối tác", "Giao trước 17 giờ"],
          ],
        )}
        <div class="nhom-nut">${nut("Gửi duyệt", "chinh", "Đã gửi duyệt")}${nut("Sửa", "phu")}${nut("Hủy đơn", "nguy-hiem", "Đã hủy đơn")}</div></div>`,
      )}`,
        [
          ["Đơn bán", 0],
          ["Khuyến mãi", ""],
          ["Giao dịch nội bộ", ""],
        ],
        "Bán hàng",
      ),
  };

  // ---------- Dựng trang ----------
  const goc = document.getElementById("ung-dung");
  const dung = () => {
    goc.innerHTML = `<div class="trang-ban-mau"><header><h1>${ma === 0 ? "" : `MAN_HINH_${ma} `}${TEP[ma][1]}</h1><p>CONG_VIEC_61 · dữ liệu giả · <a href="index.html">Danh sách bản mẫu</a></p></header>
      <div class="bang-chon" role="group" aria-label="Trạng thái hiển thị"><span class="nhan-bang">Trạng thái:</span>${TRANG_THAI.map(
        ([k, chu]) => `<button type="button" data-trang-thai="${k}" aria-pressed="${k === trangThai}">${chu}</button>`,
      ).join("")}
        <span class="gian"></span>${Object.keys(TEP)
          .map((m) => `<a href="${duongDan(Number(m))}">${m === "0" ? "Sửa" : m}</a>`)
          .join(" · ")}</div>
      ${MAN_HINH[ma]()}</div><div class="thong-bao-noi-dt" role="status" aria-live="polite"></div>`;
  };
  document.addEventListener("click", (e) => {
    const chonTrangThai = e.target.closest("[data-trang-thai]");
    if (chonTrangThai) {
      trangThai = chonTrangThai.dataset.trangThai;
      ghi("ban-mau-open-api-trang-thai", trangThai);
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
