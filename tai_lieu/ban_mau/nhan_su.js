// Bản mẫu MODULE_08 Nhân sự (CONG_VIEC_46): MAN_HINH_114 đến MAN_HINH_119 từ dữ liệu giả. Không phải mã sản phẩm.
(function () {
  const TEP = {
    "114": "DANH_SACH_HO_SO_NHAN_SU", "115": "BIEU_MAU_HO_SO", "116": "CHI_TIET_HO_SO",
    "117": "HOP_DONG_LAO_DONG", "118": "CHI_TIET_HOP_DONG", "119": "HO_SO_CUA_TOI"
  };
  const duongDan = ma => `MAN_HINH_${ma}_${TEP[ma]}.html`;
  const VAI_TRO = { "quan-ly": "Quản lý nhân sự", "nhan-vien-ns": "Nhân viên nhân sự", "chi-xem": "Chỉ xem hồ sơ", "nhan-vien": "Nhân viên (có hồ sơ liên kết)" };
  // Bảng vai trò – màn hình (CONG_VIEC_46 mục 8).
  const DUOC_XEM = {
    "114": ["quan-ly", "nhan-vien-ns", "chi-xem"], "115": ["quan-ly", "nhan-vien-ns"], "116": ["quan-ly", "nhan-vien-ns", "chi-xem"],
    "117": ["quan-ly", "nhan-vien-ns", "chi-xem"], "118": ["quan-ly", "nhan-vien-ns"], "119": ["quan-ly", "nhan-vien-ns", "chi-xem", "nhan-vien"]
  };
  const MENU = [["114", "Hồ sơ nhân sự"], ["117", "Hợp đồng"], ["119", "Hồ sơ của tôi"]];
  const doc = (khoa, macDinh) => { try { return localStorage.getItem(khoa) || macDinh; } catch (e) { return macDinh; } };
  const ghi = (khoa, giaTri) => { try { localStorage.setItem(khoa, giaTri); } catch (e) { /* bỏ qua */ } };
  const ma = document.body.dataset.manHinh;
  let vaiTro = doc("ban-mau-ns-vai-tro", "quan-ly");
  let trangThai = doc("ban-mau-ns-trang-thai", "du-lieu");
  const coQuyen = { xemSo: () => vaiTro === "quan-ly", sua: () => ["quan-ly", "nhan-vien-ns"].includes(vaiTro), luong: () => ["quan-ly", "nhan-vien-ns"].includes(vaiTro) };

  const thanhTren = () => `<header class="thanh-tren"><a class="logo" href="#">VComm</a><a href="#">Trang chủ</a><span class="gian"></span>
    <button type="button" aria-label="Chọn công ty">VComm Bán lẻ Miền Nam ▾</button><a href="#">Hộp duyệt <span class="huy-hieu">2</span></a>
    <button type="button">Thông báo <span class="huy-hieu">3</span></button><a href="#">Nguyễn Thị Hồng Nhung ▾</a></header>`;
  const menu = () => `<nav class="menu" aria-label="Nhân sự"><div class="ten-app">Nhân sự</div>${MENU.filter(([m]) => DUOC_XEM[m].includes(vaiTro)).map(([m, t]) =>
    `<a href="${duongDan(m)}" class="${m === ma || (ma === "115" || ma === "116") && m === "114" || ma === "118" && m === "117" ? "chon" : ""}">${t}</a>`).join("")}</nav>`;
  const trang = noiDung => `${thanhTren()}<div class="than">${menu()}<main class="noi-dung">${noiDung}</main></div>`;
  const bang = (cot, dong, tong) => `<div class="khung-bang"><table><thead><tr>${cot.map(c => `<th scope="col">${c}</th>`).join("")}</tr></thead>
    <tbody>${dong.map(d => `<tr>${d.map((o, i) => `<td data-nhan="${cot[i] || ""}"><span>${o}</span></td>`).join("")}</tr>`).join("")}</tbody></table>
    ${tong ? `<div class="phan-trang"><span>${tong}</span><span>‹ 1 2 ›</span></div>` : ""}</div>`;
  const nut = (chu, loai, hanhDong, thongBao) => `<button type="button" class="nut ${loai}" data-hanh-dong="${hanhDong || "xu-ly"}" data-thong-bao="${thongBao || ""}">${chu}</button>`;
  const nutDen = (chu, loai, den) => `<a class="nut ${loai}" href="${duongDan(den)}">${chu}</a>`;
  const tieuDe = (chu, cacNut) => `<div class="tieu-de"><h1>${chu}</h1>${cacNut || ""}</div>`;
  const nhan = (chu, loai) => `<span class="nhan ${loai}">${chu}</span>`;
  const luaChon = (id, nhanChu, cacGiaTri, loi) => `<div class="truong"><label for="${id}">${nhanChu}</label><select id="${id}" class="o-nhap${loi ? " loi" : ""}">${cacGiaTri.map(g => `<option>${g}</option>`).join("")}</select>${loi ? `<span class="loi-o">${loi}</span>` : ""}</div>`;
  const truong = (id, nhanChu, kieu, giaTri, loi, goiY) => `<div class="truong"><label for="${id}">${nhanChu}</label>
    <input id="${id}" class="o-nhap${loi ? " loi" : ""}" type="${kieu || "text"}" value="${giaTri || ""}" ${loi ? `aria-describedby="${id}-loi"` : ""}>
    ${loi ? `<span id="${id}-loi" class="loi-o">${loi}</span>` : ""}${goiY ? `<span class="chu-thich">${goiY}</span>` : ""}</div>`;
  const so = (che, day) => coQuyen.xemSo() ? `<span data-so="${day}">${che}</span> <button type="button" class="nut phu" data-hanh-dong="hien-so" style="padding:0 8px">Hiện</button>` : che;
  const luong = giaTri => coQuyen.luong() ? giaTri : `<span class="chu-thich">Không có quyền xem</span>`;
  const lich = (chu, den) => `<a class="nut phu" href="#" data-hanh-dong="lich-su" data-den="${den || ""}">${chu || "Lịch sử"}</a>`;

  const NHAN_VIEN = [
    ["NV000123", "Trần Minh Khoa", "Phòng Mua hàng", "Chuyên viên mua hàng", "VCR-HCM", "01/03/2025", `HDLD-2025-0012 · đến 28/02/2027`, nhan("Đang làm", "thanh-cong")],
    ["NV000124", "Lê Thị Bích Ngọc", "Phòng Kế toán", "Kế toán viên", "VCR-HCM", "15/09/2025", `HDLD-2025-0031 · đến 30/11/2026 ${nhan("Còn 19 ngày", "canh-bao")}`, nhan("Đang làm", "thanh-cong")],
    ["NV000131", "Phạm Gia Huy", "Kho Bình Dương", "Nhân viên kho", "VCR-BD", "03/11/2026", `HDLD-2026-0044 · thử việc đến 02/12/2026`, `${nhan("Đang làm", "thanh-cong")} ${nhan("Chưa thành niên", "thong-tin")}`],
    ["NV000098", "Đỗ Quốc Bảo Nguyễn Hoàng Anh", "Phòng Kinh doanh", "Trưởng nhóm kinh doanh", "VCR-HN", "10/05/2023", `HDLD-2025-0003 · đã hết hạn 01/11/2026 ${nhan("Còn 20 ngày", "loi")}`, `${nhan("Đang làm", "thanh-cong")} ${nhan("Thiếu đồng ý", "canh-bao")}`]
  ];

  const VE = {
    "114": () => trang(`${tieuDe("Hồ sơ nhân sự", coQuyen.sua() ? nutDen("Thêm hồ sơ", "chinh", "115") : "")}
      <div class="bo-loc"><label class="an-nhan" for="tim">Tìm</label><input id="tim" class="o-nhap" placeholder="Tìm theo mã, họ tên, điện thoại…">
      <label for="l1" class="an-nhan">Phòng ban</label><select id="l1" class="o-nhap"><option>Phòng ban: tất cả</option></select>
      <label for="l2" class="an-nhan">Chi nhánh</label><select id="l2" class="o-nhap"><option>Chi nhánh: tất cả</option></select>
      <label for="l3" class="an-nhan">Trạng thái</label><select id="l3" class="o-nhap"><option>Đang làm</option>${vaiTro === "quan-ly" || vaiTro === "nhan-vien-ns" ? "<option>Đã nghỉ</option><option>Tất cả</option>" : ""}</select></div>
      ${bang(["Mã", "Họ tên", "Phòng ban", "Chức danh", "Chi nhánh", "Ngày vào làm", "Hợp đồng hiện hành", "Trạng thái"],
        NHAN_VIEN.map(d => [d[0], `<a href="${duongDan("116")}">${d[1]}</a>`, ...d.slice(2)]), "4 hồ sơ đang làm")}`),

    "115": () => trang(`${tieuDe("Thêm hồ sơ nhân sự")}
      <div class="khoi-canh-bao thong-tin">Số căn cước, hộ chiếu, tài khoản ngân hàng, mã số thuế, số sổ bảo hiểm xã hội được mã hóa khi lưu và hiện dạng che.</div>
      <div class="the"><h2>Thông tin cá nhân</h2><div class="hai-cot">
        ${truong("ma-nv", "Mã nhân viên", "text", "", "", "Để trống để hệ thống tự cấp (NV000132). Nhập tay khi chuyển hồ sơ cũ.")}${truong("ho-ten", "Họ và tên", "text", "Phạm Gia Huy")}
        ${luaChon("gioi-tinh", "Giới tính", ["Nam", "Nữ"])}${truong("ngay-sinh", "Ngày sinh", "date", "2009-05-20", "", "16 tuổi tại ngày vào làm: lao động chưa thành niên, cần văn bản đồng ý của người đại diện theo pháp luật trước khi ký hợp đồng.")}
        ${luaChon("quoc-tich", "Quốc tịch", ["Việt Nam", "Khác"])}${luaChon("hon-nhan", "Tình trạng hôn nhân (không bắt buộc)", ["Chưa chọn", "Độc thân", "Đã kết hôn", "Khác"])}</div></div>
      <div class="the"><h2>Giấy tờ tùy thân</h2><div class="hai-cot">${truong("cccd", "Số căn cước", "text", "07920900123", "Số căn cước gồm đúng 12 chữ số.")}${truong("noi-cu-tru", "Nơi cư trú", "text", "Thuận An, Bình Dương")}</div></div>
      <div class="the"><h2>Liên hệ</h2><div class="hai-cot">${truong("dt", "Điện thoại", "tel", "0901234567")}${truong("email", "Email cá nhân", "email")}${truong("dia-chi", "Địa chỉ liên hệ", "text")}${truong("khan-cap", "Người liên hệ khẩn cấp (họ tên, quan hệ, điện thoại)", "text")}</div></div>
      <div class="the"><h2>Trình độ</h2><div class="hai-cot">${luaChon("trinh-do", "Trình độ chuyên môn", ["Chưa qua đào tạo", "Sơ cấp", "Trung cấp", "Cao đẳng", "Đại học", "Thạc sĩ", "Tiến sĩ"])}${truong("chuyen-nganh", "Chuyên ngành", "text")}</div></div>
      <div class="the"><h2>Công việc</h2><div class="hai-cot">${luaChon("phong-ban", "Phòng ban", ["Kho Bình Dương", "Phòng Mua hàng", "Phòng Kế toán"])}${luaChon("chi-nhanh", "Chi nhánh làm việc", ["VCR-BD", "VCR-HCM", "VCR-HN"])}
        ${truong("chuc-danh", "Chức danh", "text", "Nhân viên kho")}${truong("ngay-vao", "Ngày vào làm", "date", "2026-11-03")}</div>
        <span class="chu-thich">Lưu hồ sơ tạo quyết định "Vào làm" trong quá trình công tác.</span></div>
      <div class="the"><h2>Ngân hàng, thuế, bảo hiểm xã hội</h2><div class="hai-cot">${truong("ngan-hang", "Ngân hàng", "text")}${truong("stk", "Số tài khoản", "text")}${truong("chu-tk", "Chủ tài khoản", "text")}${truong("mst", "Mã số thuế cá nhân", "text")}${truong("bhxh", "Số sổ bảo hiểm xã hội", "text")}</div></div>
      <div class="the"><h2>Tài khoản liên kết (không bắt buộc)</h2>${luaChon("tai-khoan", "Tài khoản VComm", ["Chưa liên kết", "Phạm Gia Huy · huy.pham@vcomm.vn"])}<span class="chu-thich">Chỉ hiện thành viên đang hoạt động của công ty chưa có hồ sơ. Quyết định công tác đến ngày hiệu lực sẽ tự cập nhật phòng ban, chi nhánh, chức danh của tài khoản.</span></div>
      <div class="nhom-nut"><a class="nut phu" href="${duongDan("114")}">Hủy</a>${nut("Lưu hồ sơ", "chinh", "xu-ly", "Đã lưu hồ sơ NV000132.")}</div>`),

    "116": () => trang(`${tieuDe(`NV000124 · Lê Thị Bích Ngọc ${nhan("Đang làm", "thanh-cong")}`, coQuyen.sua() ? `${nutDen("Sửa", "phu", "115")}${nut("Nghỉ việc", "nguy-hiem", "nghi-viec")}${lich()}` : lich())}
      <div class="the"><dl class="thong-tin-dong"><dt>Vị trí hiện tại</dt><dd>Kế toán viên · Phòng Kế toán · VCR-HCM</dd><dt>Ngày vào làm</dt><dd>15/09/2025</dd><dt>Tài khoản</dt><dd>ngoc.le@vcomm.vn</dd><dt>Hợp đồng hiện hành</dt><dd><a href="${duongDan("118")}">HDLD-2025-0031</a> · xác định thời hạn đến 30/11/2026 ${nhan("Còn 19 ngày", "canh-bao")}</dd></dl></div>
      <div class="cac-the" role="tablist">${["Thông tin", "Giấy tờ", "Người phụ thuộc", "Quá trình công tác", "Hợp đồng"].map((t, i) => `<button type="button" role="tab" data-the="${i}" class="${i === 0 ? "chon" : ""}">${t}</button>`).join("")}</div>
      <div data-noi-dung-the="0" class="the"><dl class="thong-tin-dong"><dt>Giới tính</dt><dd>Nữ</dd><dt>Ngày sinh</dt><dd>12/04/1998</dd><dt>Quốc tịch</dt><dd>Việt Nam</dd>
        <dt>Số căn cước</dt><dd>${so("********3456", "079198003456")}</dd><dt>Nơi cư trú</dt><dd>Quận 7, Thành phố Hồ Chí Minh</dd><dt>Điện thoại</dt><dd>0912 345 678</dd>
        <dt>Trình độ</dt><dd>Đại học · Kế toán</dd><dt>Tài khoản ngân hàng</dt><dd>Vietcombank · ${so("******7890", "0071001237890")}</dd><dt>Mã số thuế cá nhân</dt><dd>${so("******5678", "8312345678")}</dd><dt>Số sổ bảo hiểm xã hội</dt><dd>${so("******1122", "7912341122")}</dd></dl></div>
      <div data-noi-dung-the="1" class="the" hidden><div class="tieu-de"><h2>Giấy tờ</h2>${coQuyen.sua() ? nut("Tải tệp lên", "phu", "tai-len") : ""}</div>
        <div class="khoi-canh-bao thong-tin">Đã ghi nhận đồng ý xử lý dữ liệu nhạy cảm ngày 15/09/2025 (tệp: dong-y-du-lieu.pdf).</div>
        ${bang(["Loại", "Tên tệp", "Kích thước", "Tải lên", ""], [["Ảnh căn cước", "can-cuoc.jpg", "1,2 MB", "15/09/2025 · Hồng Nhung", coQuyen.xemSo() ? nut("Tải xuống", "phu", "xu-ly", "Đã tải tệp. Lượt tải được ghi nhật ký.") : `<span class="chu-thich">Cần quyền xem giấy tờ</span>`],
          ["Văn bằng, chứng chỉ", "bang-dai-hoc.pdf", "2,4 MB", "15/09/2025 · Hồng Nhung", coQuyen.xemSo() ? nut("Tải xuống", "phu", "xu-ly", "Đã tải tệp. Lượt tải được ghi nhật ký.") : ""],
          ["Văn bản đồng ý xử lý dữ liệu", "dong-y-du-lieu.pdf", "0,3 MB", "15/09/2025 · Hồng Nhung", coQuyen.xemSo() ? nut("Tải xuống", "phu", "xu-ly", "Đã tải tệp. Lượt tải được ghi nhật ký.") : ""]])}</div>
      <div data-noi-dung-the="2" class="the" hidden><div class="tieu-de"><h2>Người phụ thuộc</h2>${coQuyen.sua() ? nut("Thêm người phụ thuộc", "phu", "phu-thuoc") : ""}</div>
        ${bang(["Họ tên", "Quan hệ", "Ngày sinh", "Số định danh", "Giảm trừ từ", "Đến"], [["Nguyễn Minh An", "Con", "02/06/2022", so("********0011", "079222000011"), "09/2025", "—"]])}</div>
      <div data-noi-dung-the="3" class="the" hidden><div class="tieu-de"><h2>Quá trình công tác</h2>${coQuyen.sua() ? nut("Thêm quyết định", "phu", "quyet-dinh") : ""}</div>
        <ol class="dong-thoi-gian">
        <li class="cho"><span class="cham">3</span><div><strong>01/12/2026 · Điều chuyển</strong> ${nhan("Chưa hiệu lực", "canh-bao")}<div>Phòng Kế toán → Phòng Tài chính · QĐ-15/2026</div>${coQuyen.sua() ? `<div class="nhom-nut">${nut("Sửa", "phu", "quyet-dinh")}${nut("Xóa", "nguy-hiem", "xac-nhan")}</div>` : ""}</div></li>
        <li class="xong"><span class="cham">2</span><div><strong>01/03/2026 · Theo hợp đồng</strong><div>Chức danh: Kế toán viên (phụ lục HDLD-2025-0031/PL01)</div><div class="chu-thich">Đã cập nhật tài khoản 01/03/2026 00:05</div></div></li>
        <li class="xong"><span class="cham">1</span><div><strong>15/09/2025 · Vào làm</strong><div>Phòng Kế toán · VCR-HCM · Kế toán viên tập sự</div></div></li></ol></div>
      <div data-noi-dung-the="4" class="the" hidden><div class="tieu-de"><h2>Hợp đồng</h2>${coQuyen.sua() ? nutDen("Lập hợp đồng", "chinh", "118") : ""}</div>
        ${bang(["Số", "Loại", "Hiệu lực", "Kết thúc", "Mức lương", "Trạng thái"], [
          [`<a href="${duongDan("118")}">HDLD-2025-0031</a>`, "Xác định thời hạn", "15/11/2025", "30/11/2026", luong("15.000.000&nbsp;đ"), nhan("Đang hiệu lực", "thanh-cong")],
          ["↳ HDLD-2025-0031/PL01", "Phụ lục", "01/03/2026", "—", luong("16.500.000&nbsp;đ"), nhan("Đã ký", "thanh-cong")],
          [`<a href="${duongDan("118")}">HDLD-2025-0027</a>`, "Thử việc", "15/09/2025", "13/11/2025", luong("12.750.000&nbsp;đ"), nhan("Đã hết hạn", "trung-tinh")]])}</div>`),

    "117": () => trang(`${tieuDe("Hợp đồng lao động", coQuyen.sua() ? nutDen("Lập hợp đồng", "chinh", "118") : "")}
      <div class="cac-the" role="tablist"><button type="button" class="chon">Tất cả</button><button type="button">Sắp hết hạn <span class="huy-hieu">3</span></button></div>
      <div class="bo-loc"><label class="an-nhan" for="tim">Tìm</label><input id="tim" class="o-nhap" placeholder="Số hợp đồng, nhân viên…">
      <select class="o-nhap" aria-label="Loại"><option>Loại: tất cả</option><option>Thử việc</option><option>Xác định thời hạn</option><option>Không xác định thời hạn</option></select>
      <select class="o-nhap" aria-label="Trạng thái"><option>Trạng thái: tất cả</option><option>Nháp</option><option>Chờ duyệt</option><option>Đã duyệt, chờ ký</option><option>Đã ký</option><option>Bị từ chối</option><option>Đã chấm dứt</option><option>Đã hủy</option></select></div>
      ${bang(["Số", "Nhân viên", "Loại", "Hiệu lực", "Kết thúc", ...(coQuyen.luong() ? ["Mức lương"] : []), "Trạng thái"], [
        [`<a href="${duongDan("118")}">HDLD-2025-0003</a>`, "Đỗ Quốc Bảo Nguyễn Hoàng Anh", "Xác định thời hạn", "02/11/2024", "01/11/2026", ...(coQuyen.luong() ? ["22.000.000&nbsp;đ"] : []), `${nhan("Đã hết hạn 10 ngày", "loi")} <span class="chu-thich">còn 20 ngày trước khi thành không xác định thời hạn</span>`],
        [`<a href="${duongDan("118")}">HDLD-2025-0031</a>`, "Lê Thị Bích Ngọc", "Xác định thời hạn", "15/11/2025", "30/11/2026", ...(coQuyen.luong() ? ["16.500.000&nbsp;đ"] : []), nhan("Còn 19 ngày", "canh-bao")],
        [`<a href="${duongDan("118")}">HDLD-2026-0044</a>`, "Phạm Gia Huy", "Thử việc", "03/11/2026", "02/12/2026", ...(coQuyen.luong() ? ["6.375.000&nbsp;đ"] : []), nhan("Còn 21 ngày", "canh-bao")],
        [`<a href="${duongDan("118")}">HDLD-2026-0047</a>`, "Trần Minh Khoa", "Không xác định thời hạn", "01/03/2027", "—", ...(coQuyen.luong() ? ["18.000.000&nbsp;đ"] : []), nhan("Chờ duyệt", "thong-tin")],
        [`<a href="${duongDan("118")}">HDLD-2024-0090</a>`, "Võ Thanh Tâm", "Xác định thời hạn", "01/06/2024", "31/05/2026", ...(coQuyen.luong() ? ["14.000.000&nbsp;đ"] : []), `${nhan("Đã chấm dứt", "trung-tinh")} ${nhan("Đã quá 30 ngày", "loi")}`]], "5 hợp đồng")}`),

    "118": () => trang(`${tieuDe(`HDLD-2025-0031 · Lê Thị Bích Ngọc ${nhan("Đã ký", "thanh-cong")} ${nhan("Còn 19 ngày", "canh-bao")}`,
        `${nut("Lập phụ lục", "phu", "phu-luc")}${nut("Chấm dứt", "nguy-hiem", "cham-dut")}${lich()}`)}
      <div class="khoi-canh-bao canh-bao">Hợp đồng hết hạn 30/11/2026. Đây là hợp đồng xác định thời hạn thứ 2 liên tiếp: hợp đồng tiếp theo phải là không xác định thời hạn (Bộ luật Lao động Điều 20 khoản 2).</div>
      <div class="hai-cot"><div class="the"><h2>Giá trị hiện hành (sau phụ lục)</h2><dl class="thong-tin-dong"><dt>Loại</dt><dd>Xác định thời hạn</dd><dt>Hiệu lực</dt><dd>15/11/2025 đến 30/11/2026</dd>
        <dt>Chức danh</dt><dd>Kế toán viên</dd><dt>Phòng ban</dt><dd>Phòng Kế toán</dd><dt>Nơi làm việc</dt><dd>VCR-HCM</dd><dt>Mức lương</dt><dd>16.500.000&nbsp;đ</dd><dt>Phụ cấp</dt><dd>Ăn trưa 730.000&nbsp;đ · Điện thoại 300.000&nbsp;đ</dd><dt>Hình thức trả lương</dt><dd>Chuyển khoản</dd></dl></div>
        <div class="the"><h2>Ký kết</h2><dl class="thong-tin-dong"><dt>Ngày ký</dt><dd>14/11/2025</dd><dt>Người ký phía công ty</dt><dd>Nguyễn Văn An · Giám đốc</dd><dt>Bản đã ký</dt><dd>${coQuyen.xemSo() ? `<a href="#">HDLD-2025-0031-da-ky.pdf</a>` : "Cần quyền xem giấy tờ"}</dd></dl>
        <h3 style="margin-top:12px">Tiến trình duyệt</h3><ol class="dong-thoi-gian"><li class="xong"><span class="cham">1</span><div><strong>Trưởng phòng Nhân sự</strong><div>Đồng ý 13/11/2025</div></div></li><li class="xong"><span class="cham">2</span><div><strong>Giám đốc</strong><div>Đồng ý 13/11/2025</div></div></li></ol></div></div>
      <div class="the"><h2>Phụ lục</h2>${bang(["Số", "Hiệu lực", "Nội dung", "Trạng thái"], [["HDLD-2025-0031/PL01", "01/03/2026", "Mức lương 15.000.000 → 16.500.000&nbsp;đ; chức danh Kế toán viên tập sự → Kế toán viên", nhan("Đã ký", "thanh-cong")]])}</div>
      <div class="the"><h2>Biểu mẫu lập hợp đồng (ví dụ hợp đồng mới cho cùng nhân viên)</h2><div class="hai-cot">
        ${luaChon("loai-hd", "Loại hợp đồng", ["Xác định thời hạn", "Không xác định thời hạn", "Thử việc"], "Đã có 2 hợp đồng xác định thời hạn liên tiếp. Chọn không xác định thời hạn hoặc đánh dấu ngoại lệ theo luật.")}
        <div class="truong"><label><input type="checkbox"> Ngoại lệ theo luật</label><span class="chu-thich">Bắt buộc nhập lý do; lý do hiện trên yêu cầu duyệt.</span></div>
        ${truong("hieu-luc", "Ngày hiệu lực", "date", "2026-12-01")}${truong("ket-thuc", "Ngày kết thúc", "date", "2029-12-15", "Hợp đồng xác định thời hạn không quá 36 tháng (đến 30/11/2029).")}
        ${luaChon("muc-tv", "Mức công việc (khi thử việc)", ["Cao đẳng trở lên – tối đa 60 ngày", "Người quản lý doanh nghiệp – tối đa 180 ngày", "Trung cấp, công nhân kỹ thuật, nhân viên nghiệp vụ – tối đa 30 ngày", "Công việc khác – tối đa 6 ngày làm việc"])}
        ${truong("luong-ct", "Mức lương chính thức (đồng)", "text", "16.500.000")}${truong("luong-tv", "Mức lương thử việc (đồng)", "text", "13.000.000", "Lương thử việc ít nhất 85% lương chính thức (14.025.000 đ).")}
        ${truong("chuc-danh-hd", "Chức danh", "text", "Kế toán viên")}${luaChon("pb-hd", "Phòng ban", ["Phòng Kế toán"])}${luaChon("cn-hd", "Nơi làm việc", ["VCR-HCM"])}${luaChon("tra-luong", "Hình thức trả lương", ["Chuyển khoản", "Tiền mặt"])}
        ${truong("nguoi-ky", "Người ký phía công ty", "text", "Nguyễn Văn An · Giám đốc")}</div>
        <h3 style="margin-top:12px">Phụ cấp</h3>${bang(["Tên", "Loại phụ cấp (CONG_VIEC_48)", "Số tiền mỗi tháng"], [
          [`<input class="o-nhap" aria-label="Tên phụ cấp" value="Ăn trưa">`, `<select class="o-nhap" aria-label="Loại phụ cấp"><option selected>Ăn trưa · miễn thuế đến 730.000 đ</option><option>Điện thoại · chịu thuế</option><option>Trách nhiệm · chịu thuế</option></select>`, `<input class="o-nhap" aria-label="Số tiền" value="730.000">`],
          [`<input class="o-nhap" aria-label="Tên phụ cấp" value="Điện thoại">`, `<select class="o-nhap loi" aria-label="Loại phụ cấp"><option>Chọn loại</option><option>Điện thoại · chịu thuế</option></select><span class="loi-o">Chọn loại phụ cấp.</span>`, `<input class="o-nhap" aria-label="Số tiền" value="300.000">`]])}
        <span class="chu-thich">Loại phụ cấp cho biết phụ cấp chịu thuế, tính theo ngày công khi tính lương. Danh mục ở Thiết lập lương.</span>
        <div class="nhom-nut">${nut("Lưu nháp", "phu", "xu-ly", "Đã lưu nháp.")}${nut("Gửi duyệt", "chinh", "xu-ly", "Đã gửi duyệt HDLD-2026-0048.")}</div>
        <div class="khoi-canh-bao thong-tin">Sau khi duyệt: bấm "Xác nhận đã ký", nhập ngày ký và tải bản đã ký (bắt buộc).</div>${nut("Xác nhận đã ký", "chinh", "da-ky")}</div>`),

    "119": () => trang(`${tieuDe("Hồ sơ của tôi", `<a class="nut phu" href="#" data-hanh-dong="xu-ly" data-thong-bao="Mở trang lập đề xuất của Nền tảng với mẫu 'Yêu cầu chỉnh sửa hồ sơ'.">Yêu cầu chỉnh sửa</a>`)}
      <div class="khoi-canh-bao thong-tin">Đây là dữ liệu cá nhân của bạn do công ty lưu. Bạn chỉ xem; muốn sửa, bấm "Yêu cầu chỉnh sửa".</div>
      <div class="the"><dl class="thong-tin-dong"><dt>Mã nhân viên</dt><dd>NV000124</dd><dt>Họ tên</dt><dd>Lê Thị Bích Ngọc</dd><dt>Vị trí</dt><dd>Kế toán viên · Phòng Kế toán · VCR-HCM</dd>
        <dt>Số căn cước</dt><dd><span data-so="079198003456">********3456</span> <button type="button" class="nut phu" data-hanh-dong="hien-so" style="padding:0 8px">Hiện</button></dd><dt>Tài khoản ngân hàng</dt><dd>Vietcombank · <span data-so="0071001237890">******7890</span> <button type="button" class="nut phu" data-hanh-dong="hien-so" style="padding:0 8px">Hiện</button></dd></dl></div>
      <div class="the"><h2>Quá trình công tác</h2><ol class="dong-thoi-gian"><li class="xong"><span class="cham">2</span><div><strong>01/03/2026 · Theo hợp đồng</strong><div>Kế toán viên</div></div></li><li class="xong"><span class="cham">1</span><div><strong>15/09/2025 · Vào làm</strong><div>Phòng Kế toán · Kế toán viên tập sự</div></div></li></ol></div>
      <div class="the"><h2>Hợp đồng của tôi</h2>${bang(["Số", "Loại", "Hiệu lực", "Kết thúc", "Mức lương", "Bản đã ký"], [
        ["HDLD-2025-0031", "Xác định thời hạn", "15/11/2025", "30/11/2026", "15.000.000&nbsp;đ", `<a href="#">Tải xuống</a>`], ["↳ /PL01", "Phụ lục", "01/03/2026", "—", "16.500.000&nbsp;đ", `<a href="#">Tải xuống</a>`]])}</div>`)
  };

  const TRANG_THAI = {
    "rong": () => `<div class="trang-thai-trong"><h2>Chưa có dữ liệu</h2><p style="margin:0">${ma === "119" ? "Tài khoản của bạn chưa được liên kết với hồ sơ nhân sự nào ở công ty này." : "Chưa có hồ sơ. Bấm \"Thêm hồ sơ\" để bắt đầu."}</p></div>`,
    "dang-tai": () => `<div class="the" aria-busy="true"><p style="margin:0">Đang tải…</p></div>`,
    "loi": () => `<div class="khoi-canh-bao loi">Không tải được dữ liệu. <button type="button" class="nut phu">Thử lại</button></div>`,
    "khong-quyen": () => `<div class="trang-thai-trong"><h2>Bạn không có quyền xem trang này</h2><p style="margin:0">Liên hệ quản trị công ty nếu bạn cần quyền này.</p></div>`
  };

  function veTrang() {
    const khongQuyen = !DUOC_XEM[ma].includes(vaiTro);
    const tt = khongQuyen ? "khong-quyen" : trangThai;
    const ten = { "114": "Hồ sơ nhân sự", "115": "Thêm hồ sơ nhân sự", "116": "Chi tiết hồ sơ", "117": "Hợp đồng lao động", "118": "Chi tiết hợp đồng", "119": "Hồ sơ của tôi" }[ma];
    const html = tt === "du-lieu" ? VE[ma]() : trang(`${tieuDe(ten)}${TRANG_THAI[tt]()}`);
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
  const ngan = (tieuDeChu, noiDung, chuNut, thongBaoChu) => {
    const che = moLop(`<aside class="ngan-keo" role="dialog" aria-modal="true"><h2>${tieuDeChu}</h2>${noiDung}
      <div class="nhom-nut"><button type="button" class="nut phu" data-dong>Hủy</button><button type="button" class="nut chinh" data-luu>${chuNut}</button></div></aside>`);
    che.querySelector("[data-luu]").addEventListener("click", () => { che.remove(); thongBao(thongBaoChu); });
  };
  const LY_DO = ["Hết hạn hợp đồng", "Hoàn thành công việc", "Hai bên thỏa thuận", "Người lao động đơn phương chấm dứt", "Người sử dụng lao động đơn phương chấm dứt", "Cho thôi việc", "Kỷ luật sa thải", "Thử việc không đạt", "Người lao động chết hoặc mất tích", "Khác"];

  document.addEventListener("click", e => {
    const the = e.target.closest("[data-the]");
    if (the) {
      document.querySelectorAll("[data-the]").forEach(b => b.classList.toggle("chon", b === the));
      document.querySelectorAll("[data-noi-dung-the]").forEach(k => { k.hidden = k.dataset.noiDungThe !== the.dataset.the; });
      return;
    }
    const n = e.target.closest("[data-hanh-dong]"); if (!n || n.disabled) return;
    const hd = n.dataset.hanhDong;
    if (hd === "lich-su") { e.preventDefault(); return thongBao("Mở nhật ký thao tác của đối tượng này."); }
    if (hd === "hien-so") { const o = n.previousElementSibling; if (o && o.dataset.so) { o.textContent = o.dataset.so; n.remove(); thongBao("Đã hiện. Lượt xem được ghi nhật ký."); } return; }
    if (hd === "xu-ly") { e.preventDefault(); n.classList.add("dang-xu-ly"); n.disabled = true; setTimeout(() => { n.classList.remove("dang-xu-ly"); n.disabled = false; thongBao(n.dataset.thongBao || "Đã lưu."); }, 700); return; }
    if (hd === "xac-nhan") {
      const che = moLop(`<div class="hop-thoai" role="dialog" aria-modal="true"><h2>Xóa quyết định</h2><p style="margin:0">Xóa quyết định điều chuyển ngày 01/12/2026 (chưa hiệu lực)?</p>
        <div class="nhom-nut" style="justify-content:flex-end"><button type="button" class="nut phu" data-dong>Hủy</button><button type="button" class="nut nguy-hiem" data-luu>Xóa</button></div></div>`, true);
      che.querySelector("[data-luu]").addEventListener("click", () => { che.remove(); thongBao("Đã xóa quyết định."); });
      return;
    }
    if (hd === "tai-len") return ngan("Tải tệp giấy tờ", `<div class="truong"><label for="loai-tep">Loại giấy tờ</label><select id="loai-tep" class="o-nhap"><option>Ảnh căn cước hoặc hộ chiếu</option><option>Văn bằng, chứng chỉ</option><option>Giấy khám sức khỏe</option><option>Sơ yếu lý lịch</option><option>Văn bản đồng ý xử lý dữ liệu</option><option>Văn bản đồng ý của người đại diện theo pháp luật</option><option>Khác</option></select></div>
      <div class="truong"><label for="tep">Tệp PDF, JPG, PNG (tối đa 10 MB)</label><input id="tep" type="file" class="o-nhap" accept=".pdf,.jpg,.jpeg,.png"></div>
      <div class="truong"><label for="ngay-dy">Ngày đồng ý (khi là văn bản đồng ý xử lý dữ liệu)</label><input id="ngay-dy" type="date" class="o-nhap"></div>
      <div class="khoi-canh-bao canh-bao">Ảnh căn cước, giấy khám sức khỏe là dữ liệu cá nhân nhạy cảm. Chỉ lưu bản sao; không giữ bản chính của người lao động.</div>`, "Tải lên", "Đã tải tệp lên.");
    if (hd === "phu-thuoc") return ngan("Thêm người phụ thuộc", `${truong("pt-ten", "Họ tên", "text")}<div class="truong"><label for="pt-qh">Quan hệ</label><select id="pt-qh" class="o-nhap"><option>Con</option><option>Vợ hoặc chồng</option><option>Cha mẹ</option><option>Khác</option></select></div>
      ${truong("pt-ns", "Ngày sinh", "date")}${truong("pt-so", "Số định danh", "text")}${truong("pt-tu", "Giảm trừ từ tháng", "month")}${truong("pt-den", "Đến tháng (không bắt buộc)", "month")}`, "Lưu", "Đã thêm người phụ thuộc.");
    if (hd === "quyet-dinh") return ngan("Quyết định công tác", `<div class="truong"><label for="qd-loai">Loại</label><select id="qd-loai" class="o-nhap"><option>Điều chuyển</option><option>Bổ nhiệm, đổi chức danh</option></select></div>
      ${truong("qd-ngay", "Ngày hiệu lực", "date", "2026-12-01")}${truong("qd-so", "Số quyết định", "text", "QĐ-15/2026")}
      <div class="truong"><label for="qd-pb">Phòng ban mới</label><select id="qd-pb" class="o-nhap"><option>Không đổi</option><option>Phòng Tài chính</option></select></div>
      <div class="truong"><label for="qd-cn">Chi nhánh làm việc mới</label><select id="qd-cn" class="o-nhap"><option>Không đổi</option><option>VCR-HN</option></select></div>${truong("qd-cd", "Chức danh mới (để trống nếu không đổi)", "text")}
      <div class="khoi-canh-bao thong-tin">Đến ngày hiệu lực, phòng ban, chi nhánh, chức danh của tài khoản ngoc.le@vcomm.vn tự cập nhật. Vai trò không đổi.</div>`, "Lưu", "Đã lưu quyết định.");
    if (hd === "nghi-viec") return ngan("Nghỉ việc", `${truong("nv-ngay", "Ngày nghỉ việc", "date", "2026-11-30")}<div class="truong"><label for="nv-ly-do">Lý do</label><select id="nv-ly-do" class="o-nhap">${LY_DO.map(l => `<option>${l}</option>`).join("")}</select></div>
      <div class="truong"><label for="nv-ghi-chu">Ghi chú</label><textarea id="nv-ghi-chu" class="o-nhap" rows="2"></textarea></div>
      <div class="khoi-canh-bao canh-bao">Hợp đồng HDLD-2025-0031 sẽ chấm dứt ngày 30/11/2026 cùng lý do; hợp đồng chưa ký bị hủy. Hồ sơ chuyển "Đã nghỉ" khi đến ngày, chỉ Quản lý, Nhân viên nhân sự xem được. Quản trị công ty nhận thông báo để vô hiệu hóa tài khoản.</div>`, "Xác nhận nghỉ việc", "Đã ghi nghỉ việc.");
    if (hd === "cham-dut") return ngan("Chấm dứt hợp đồng", `${truong("cd-ngay", "Ngày chấm dứt", "date", "2026-11-30")}<div class="truong"><label for="cd-ly-do">Lý do</label><select id="cd-ly-do" class="o-nhap">${LY_DO.map(l => `<option>${l}</option>`).join("")}</select></div>
      <div class="truong"><label for="cd-gc">Ghi chú</label><textarea id="cd-gc" class="o-nhap" rows="2"></textarea></div>`, "Chấm dứt", "Đã chấm dứt hợp đồng.");
    if (hd === "phu-luc") return ngan("Lập phụ lục HDLD-2025-0031/PL02", `${truong("pl-ngay", "Ngày hiệu lực", "date", "2026-11-15")}${truong("pl-luong", "Mức lương mới (để trống nếu không đổi)", "text", "17.500.000")}${truong("pl-cd", "Chức danh mới", "text")}
      <div class="truong"><label for="pl-mo-ta">Điều khoản sửa đổi (bắt buộc)</label><textarea id="pl-mo-ta" class="o-nhap" rows="3">Sửa Điều 3 khoản 1: mức lương 17.500.000 đồng/tháng.</textarea></div>
      <div class="khoi-canh-bao thong-tin">Phụ lục không được sửa thời hạn hợp đồng (Bộ luật Lao động Điều 22 khoản 2). Phụ lục qua luồng duyệt như hợp đồng.</div>`, "Lưu nháp", "Đã lưu phụ lục nháp.");
    if (hd === "da-ky") return ngan("Xác nhận đã ký", `${truong("ky-ngay", "Ngày ký", "date", "2026-11-28")}<div class="truong"><label for="ky-tep">Bản đã ký (PDF, JPG, PNG, tối đa 10 MB)</label><input id="ky-tep" type="file" class="o-nhap" accept=".pdf,.jpg,.jpeg,.png"></div>`, "Xác nhận", "Hợp đồng đã ký, có hiệu lực từ 01/12/2026.");
  });
  document.addEventListener("keydown", e => { if (e.key === "Escape") document.querySelectorAll(".man-che").forEach(c => c.remove()); });

  const kieu = document.createElement("style");
  kieu.textContent = "[data-noi-dung-the][hidden] { display: none; }";
  document.head.appendChild(kieu);
  const dk = document.createElement("div");
  dk.className = "dieu-khien";
  dk.innerHTML = `<strong>Bản mẫu</strong><a href="index.html">Mục lục</a>
    <label for="dk-vai-tro">Vai trò</label><select id="dk-vai-tro">${Object.entries(VAI_TRO).map(([k, v]) => `<option value="${k}"${k === vaiTro ? " selected" : ""}>${v}</option>`).join("")}</select>
    <label for="dk-trang-thai">Trạng thái</label><select id="dk-trang-thai">${[["du-lieu", "Có dữ liệu"], ["rong", "Rỗng"], ["dang-tai", "Đang tải"], ["loi", "Lỗi"]].map(([k, v]) => `<option value="${k}"${k === trangThai ? " selected" : ""}>${v}</option>`).join("")}</select>`;
  document.body.appendChild(dk);
  dk.querySelector("#dk-vai-tro").addEventListener("change", e => { vaiTro = e.target.value; ghi("ban-mau-ns-vai-tro", vaiTro); veTrang(); });
  dk.querySelector("#dk-trang-thai").addEventListener("change", e => { trangThai = e.target.value; ghi("ban-mau-ns-trang-thai", trangThai); veTrang(); });
  veTrang();
})();
