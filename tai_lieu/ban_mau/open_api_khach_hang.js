// Bản mẫu CONG_VIEC_66 (MODULE_16 Open API khách hàng do đối tác tạo, người nhận giao thẳng): sửa màn hình đối tác, đơn bán, phiếu kho từ dữ liệu giả. Không phải mã sản phẩm.
(function () {
  const TEP = {
    1: ["SUA_KHACH_HANG_OPEN_API", "Sửa màn hình đối tác: khách hàng do đối tác tạo"],
    2: ["SUA_DON_BAN_NGUOI_NHAN", "Sửa màn hình đơn bán, phiếu kho: người nhận giao thẳng"],
  };
  const duongDan = (ma) => `${TEP[ma][0]}.html`;
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
  const web = (than, menu, tenApp, chonMenu) => `<div class="khung-web"><header class="thanh-tren"><span class="logo">VComm</span><span>${tenApp}</span><span class="gian"></span>
    <button type="button">VComm Thương mại ▾</button><button type="button">Trần Minh Khoa ▾</button></header>
    <div class="than"><nav class="menu" aria-label="${tenApp}"><div class="ten-app">${tenApp}</div>${menu
      .map((chu) => `<a href="#" class="${chu === chonMenu ? "chon" : ""}">${chu}</a>`)
      .join("")}</nav><main class="noi-dung">${than}</main></div></div>`;
  const bang = (cot, dong, soCot) => `<div class="cuon-ngang"><table class="bang-web"><thead><tr>${cot.map((c) => `<th scope="col">${c}</th>`).join("")}</tr></thead>
    <tbody>${dong.map((d) => `<tr>${d.map((o, i) => `<td class="${(soCot || []).includes(i) ? "so" : ""}">${o}</td>`).join("")}</tr>`).join("")}</tbody></table></div>`;
  const webTheoTrangThai = (duLieu, rongThan) => {
    if (trangThai === "dang-tai") return tai(4);
    if (trangThai === "loi") return loiTai;
    if (trangThai === "khong-quyen") return hop("Bạn không có quyền xem màn hình này. Liên hệ quản trị công ty để được cấp quyền.", "canh-bao");
    if (trangThai === "rong" && rongThan) return rongThan;
    return duLieu;
  };
  const dong = (nhanO, giaTri) =>
    `<div class="hang-ngang" style="display:flex;gap:16px;padding:6px 0;border-bottom:1px solid var(--vien, #e5e7eb)"><span class="chu-nho" style="min-width:180px">${nhanO}</span><span>${giaTri}</span></div>`;
  const MENU_KHACH = ["Đối tác", "Người mua", "Đơn VComm", "Đội kinh doanh"];
  const nhanOpenApi = nhan("Do đối tác tạo", "thong-tin");

  // ---------- Màn hình ----------
  const MAN_HINH = {
    1: () =>
      web(
        `<div class="tieu-de"><h1>Đối tác</h1>${nut("Thêm đối tác", "chinh")}</div>
      <div class="luoi-truong">${truong("Tìm tên, mã, mã số thuế, điện thoại", "")}${chon("Vai trò", ["Mọi vai trò", "Khách hàng", "Nhà cung cấp", "Nội bộ"])}${chon("Nguồn", ["Mọi nguồn", "Nhập trên web", "Open API"])}${chon("Trạng thái", ["Đang giao dịch", "Ngừng giao dịch"])}</div>
      ${webTheoTrangThai(
        `${bang(
          ["Mã", "Tên", "Loại", "Mã số thuế / điện thoại", "Vai trò", "Trạng thái"],
          [
            ["DT000231", `<a href="#">Nguyễn Thị Lan</a> ${nhanOpenApi}`, "Cá nhân", "+84912345678", "Khách hàng", nhan("Đang giao dịch", "thanh-cong")],
            ["DT000230", `<a href="#">Công ty TNHH Nội thất An Phú</a> ${nhanOpenApi}`, "Tổ chức", "0312345678", "Khách hàng", nhan("Đang giao dịch", "thanh-cong")],
            ["DT000012", `<a href="#">Công ty TNHH Phân phối Minh Long</a>`, "Tổ chức", "0109876543", "Khách hàng", nhan("Đang giao dịch", "thanh-cong")],
          ],
        )}
      <div class="the-web"><div class="tieu-de"><h2>DT000231 · Nguyễn Thị Lan ${nhanOpenApi}</h2>${nut("Sửa", "phu")}</div>
        ${hop("Khách do đối tác <b>Công ty TNHH Phân phối Minh Long</b> tạo qua Open API bằng khóa <b>Minh Long · website</b> lúc 12/11/2026 10:32. Đối tác xác nhận đã có đồng ý xử lý dữ liệu cá nhân của khách lúc 12/11/2026 10:32. Đối tác sửa được tên, địa chỉ, điện thoại, email.", "thong-tin")}
        ${dong("Loại", "Cá nhân")}${dong("Số căn cước", "Chưa có")}${dong("Địa chỉ", "Số 5 Lê Lợi, Hải Châu, Đà Nẵng")}${dong("Điện thoại", "+84912345678")}${dong("Email", "lan.nguyen@example.com")}
        <h3>Hồ sơ tại VComm Thương mại</h3>
        ${dong("Vai trò", "Khách hàng")}${dong("Nhóm khách hàng", "Đại lý cấp 1 (theo đối tác)")}${dong("Hạn thanh toán", "0 ngày")}${dong("Hạn mức công nợ", "Không giới hạn")}</div>
      <div class="the-web"><h2>Ngăn kéo sửa đối tác (khách cá nhân do đối tác tạo)</h2>
        <div class="luoi-truong">${truong("Tên", "Nguyễn Thị Lan")}${truong("Số căn cước (không bắt buộc với khách do đối tác tạo)", "")}${truong("Địa chỉ", "Số 5 Lê Lợi, Hải Châu, Đà Nẵng")}${truong("Điện thoại", "+84912345678")}</div>
        <div class="nhom-nut">${nut("Lưu", "chinh", "Đã lưu")}${nut("Hủy", "phu")}</div></div>`,
        `<div class="the-web"><p style="margin:0">Không có đối tác nào khớp điều kiện lọc.</p></div>`,
      )}`,
        MENU_KHACH,
        "Khách hàng",
        "Đối tác",
      ),

    2: () =>
      `${web(
        `<div class="tieu-de"><h1>DB-2026-001510</h1>${nhan("Nháp", "trung-tinh")}</div>
      ${webTheoTrangThai(
        `${hop("Đơn tạo qua Open API bằng khóa <b>Minh Long · website</b>. Mã đơn của đối tác: <b>WEB-55120</b>.", "thong-tin")}
      <div class="the-web"><h2>Thông tin chung</h2>
        ${dong("Khách hàng", `DT000231 · Nguyễn Thị Lan ${nhanOpenApi}`)}${dong("Kênh bán", "Đại lý")}${dong("Kho xuất", "KHO-HN · Kho Hà Nội")}${dong("Ghi chú", "Giao giờ hành chính")}</div>
      <div class="the-web"><h2>Người nhận</h2>
        ${dong("Tên người nhận", "Trần Văn Bình")}${dong("Điện thoại", "+84987654321")}${dong("Địa chỉ giao", "Số 20 Nguyễn Huệ, Quận 1, Thành phố Hồ Chí Minh")}
        <p class="chu-nho" style="margin:8px 0 0">Đối tác tự thu tiền người mua; đơn không có phí giao, không thu hộ.</p></div>
      <div class="nhom-nut">${nut("Gửi duyệt", "chinh", "Đã gửi duyệt")}${nut("Sửa", "phu")}${nut("Hủy đơn", "nguy-hiem", "Đã hủy đơn")}</div>`,
      )}`,
        ["Đơn bán", "Khuyến mãi", "Giao dịch nội bộ"],
        "Bán hàng",
        "Đơn bán",
      )}
      <div style="height:24px"></div>
      ${web(
        `<div class="tieu-de"><h1>PX-2026-000845 · Phiếu xuất giao hàng</h1>${nhan("Đã ghi sổ", "thanh-cong")}</div>
      ${webTheoTrangThai(
        `<div class="the-web"><h2>Thông tin chung</h2>${dong("Khách hàng", "Nguyễn Thị Lan")}${dong("Chứng từ gốc", "<a href='#'>DB-2026-001510</a>")}${dong("Kho", "KHO-HN · Kho Hà Nội")}</div>
      <div class="the-web"><h2>Người nhận</h2>${dong("Tên người nhận", "Trần Văn Bình")}${dong("Điện thoại", "+84987654321")}${dong("Địa chỉ giao", "Số 20 Nguyễn Huệ, Quận 1, Thành phố Hồ Chí Minh")}</div>`,
      )}`,
        ["Tồn kho", "Phiếu kho", "Xuất bán", "Kiểm kê"],
        "Kho",
        "Phiếu kho",
      )}`,
  };

  // ---------- Dựng trang ----------
  const goc = document.getElementById("ung-dung");
  const dung = () => {
    goc.innerHTML = `<div class="trang-ban-mau"><header><h1>${TEP[ma][1]}</h1><p>CONG_VIEC_66 · dữ liệu giả · <a href="index.html">Danh sách bản mẫu</a></p></header>
      <div class="bang-chon" role="group" aria-label="Trạng thái hiển thị"><span class="nhan-bang">Trạng thái:</span>${TRANG_THAI.map(
        ([k, chu]) => `<button type="button" data-trang-thai="${k}" aria-pressed="${k === trangThai}">${chu}</button>`,
      ).join("")}
        <span class="gian"></span>${Object.keys(TEP)
          .map((m) => `<a href="${duongDan(Number(m))}">${TEP[m][0] === "SUA_KHACH_HANG_OPEN_API" ? "Đối tác" : "Đơn bán, phiếu kho"}</a>`)
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
