// Bản mẫu MODULE_01: dựng 18 màn hình từ dữ liệu giả. Không phải mã sản phẩm.
(function () {
  const TEP = {
    "01": "DANG_NHAP", "02": "XAC_THUC_HAI_LOP", "03": "KICH_HOAT_TAI_KHOAN", "04": "QUEN_MAT_KHAU", "05": "TRANG_CHU",
    "06": "HO_SO_CA_NHAN", "07": "HOP_DUYET", "08": "CHI_TIET_YEU_CAU_DUYET", "09": "CONG_TY", "10": "CHI_NHANH",
    "11": "PHONG_BAN", "12": "DANH_SACH_NHAN_VIEN", "13": "CHI_TIET_NHAN_VIEN", "14": "VAI_TRO", "15": "CHINH_SACH_DUYET",
    "16": "DAY_SO_CHUNG_TU", "17": "TY_GIA", "18": "NHAT_KY_THAO_TAC"
  };
  const duongDan = ma => `MAN_HINH_${ma}_${TEP[ma]}.html`;
  const VAI_TRO = { "tap-doan": "Quản trị tập đoàn", "cong-ty": "Quản trị công ty", "ty-gia": "Quản lý tỷ giá", "nhan-vien": "Nhân viên" };
  // Bảng vai trò – màn hình (tài liệu 14 mục 2).
  const DUOC_XEM = {
    "09": ["tap-doan"], "10": ["tap-doan", "cong-ty"], "11": ["tap-doan", "cong-ty"], "12": ["tap-doan", "cong-ty"],
    "13": ["tap-doan", "cong-ty"], "14": ["tap-doan", "cong-ty"], "15": ["tap-doan", "cong-ty"], "16": ["tap-doan", "cong-ty"],
    "17": ["tap-doan", "cong-ty", "ty-gia", "nhan-vien"], "18": ["tap-doan", "cong-ty"]
  };
  const MENU = [["09", "Công ty"], ["10", "Chi nhánh"], ["11", "Phòng ban"], ["12", "Nhân viên"], ["14", "Vai trò"],
    ["15", "Chính sách duyệt"], ["16", "Dãy số chứng từ"], ["17", "Tỷ giá"], ["18", "Nhật ký thao tác"]];

  const doc = (khoa, macDinh) => { try { return localStorage.getItem(khoa) || macDinh; } catch (e) { return macDinh; } };
  const ghi = (khoa, giaTri) => { try { localStorage.setItem(khoa, giaTri); } catch (e) { /* bỏ qua */ } };
  const ma = document.body.dataset.manHinh;
  let vaiTro = doc("ban-mau-vai-tro", "tap-doan");
  let trangThai = doc("ban-mau-trang-thai", "du-lieu");

  const thanhTren = () => `<header class="thanh-tren">
    <a class="logo" href="${duongDan("05")}">VComm</a><a href="${duongDan("05")}">Trang chủ</a><span class="gian"></span>
    <button type="button" aria-label="Chọn công ty">VComm Bán lẻ Miền Nam ▾</button>
    <a href="${duongDan("07")}">Hộp duyệt <span class="huy-hieu">3</span></a>
    <button type="button">Thông báo</button><a href="${duongDan("06")}">Nguyễn Thị Hồng Nhung ▾</a></header>`;
  const menu = () => `<nav class="menu" aria-label="Quản trị hệ thống"><div class="ten-app">Quản trị hệ thống</div>${
    MENU.filter(([m]) => DUOC_XEM[m].includes(vaiTro)).map(([m, t]) =>
      `<a href="${duongDan(m)}" class="${m === ma || (ma === "13" && m === "12") ? "chon" : ""}">${t}</a>`).join("")}</nav>`;
  const bang = (cot, dong, tong) => `<div class="khung-bang"><table><thead><tr>${cot.map(c => `<th scope="col">${c}</th>`).join("")}</tr></thead>
    <tbody>${dong.map(d => `<tr>${d.map((o, i) => `<td data-nhan="${cot[i] || ""}"><span>${o}</span></td>`).join("")}</tr>`).join("")}</tbody></table>
    ${tong ? `<div class="phan-trang"><span>${tong}</span><span>‹ 1 2 3 ›</span></div>` : ""}</div>`;
  const nut = (chu, loai, hanhDong, thongBao) => `<button type="button" class="nut ${loai}" data-hanh-dong="${hanhDong || "xu-ly"}" data-thong-bao="${thongBao || ""}">${chu}</button>`;
  const loc = cacO => `<div class="bo-loc"><label class="an-nhan" for="tim">Tìm kiếm</label><input id="tim" class="o-nhap" placeholder="Tìm kiếm…">${
    cacO.map((o, i) => `<label for="loc-${i}" class="an-nhan">${o}</label><select id="loc-${i}" class="o-nhap"><option>${o}: tất cả</option></select>`).join("")}</div>`;
  const tieuDe = (chu, cacNut) => `<div class="tieu-de"><h1>${chu}</h1>${cacNut || ""}</div>`;
  const nutLichSu = () => `<a class="nut phu" href="${duongDan("18")}">Lịch sử</a>`;
  const nhan = (chu, loai) => `<span class="nhan ${loai}">${chu}</span>`;
  const trangQuanTri = noiDung => `${thanhTren()}<div class="than">${menu()}<main class="noi-dung">${noiDung}</main></div>`;
  const trangChung = noiDung => `${thanhTren()}<main class="noi-dung" style="max-width:1200px;margin:0 auto">${noiDung}</main>`;
  const trangNgoai = noiDung => `<main class="trang-ngoai"><div class="the-ngoai">${noiDung}</div></main>`;
  const truong = (id, nhanChu, kieu, giaTri, loi, goiY) => `<div class="truong"><label for="${id}">${nhanChu}</label>
    <input id="${id}" class="o-nhap${loi ? " loi" : ""}" type="${kieu || "text"}" value="${giaTri || ""}" ${loi ? `aria-describedby="${id}-loi"` : ""}>
    ${loi ? `<span id="${id}-loi" class="loi-o">${loi}</span>` : ""}${goiY ? `<span class="chu-thich">${goiY}</span>` : ""}</div>`;

  const VE = {
    "01": () => trangNgoai(`<div class="logo-lon">VComm</div><div style="display:flex;justify-content:space-between;align-items:center"><h2>Đăng nhập</h2>
      <label for="ngon-ngu" class="an-nhan">Ngôn ngữ</label><select id="ngon-ngu" class="o-nhap" style="width:auto"><option>Tiếng Việt</option><option>English</option></select></div>
      <div class="cac-the" role="tablist"><button type="button" class="chon">Mật khẩu</button><button type="button">Số điện thoại</button></div>
      ${truong("ten", "Tên đăng nhập hoặc email", "text", "nhung.nguyen@vcomm.vn")}${truong("mat-khau", "Mật khẩu", "password", "", "Thông tin đăng nhập không đúng.")}
      <button type="button" class="nut chinh" data-hanh-dong="den" data-den="05" style="justify-content:center">Đăng nhập</button>
      <a href="${duongDan("04")}">Quên mật khẩu?</a><div class="phan-cach">hoặc</div>
      <button type="button" class="nut phu" data-hanh-dong="den" data-den="02" style="justify-content:center">Đăng nhập bằng Google</button>
      <button type="button" class="nut phu" data-hanh-dong="den" data-den="05" style="justify-content:center">Đăng nhập bằng Microsoft</button>
      <button type="button" class="nut phu" data-hanh-dong="den" data-den="05" style="justify-content:center">Đăng nhập bằng Zalo</button>`),
    "02": () => trangNgoai(`<div class="logo-lon">VComm</div><h2>Xác thực hai lớp</h2><p style="margin:0">Nhập mã 6 chữ số từ ứng dụng xác thực.</p>
      ${truong("ma-otp", "Mã xác thực", "text", "", "", "Mã đổi sau mỗi 30 giây.")}
      <button type="button" class="nut chinh" data-hanh-dong="den" data-den="05" style="justify-content:center">Xác nhận</button><a href="#">Dùng mã dự phòng</a>
      <div class="khoi-canh-bao thong-tin">Lần đầu bật xác thực hai lớp: quét mã QR bằng ứng dụng xác thực, sau đó lưu 10 mã dự phòng.</div>`),
    "03": () => trangNgoai(`<div class="logo-lon">VComm</div><h2>Chào Trần Văn Bảo Long Nguyễn Hoàng</h2>
      <p style="margin:0">Bạn được mời vào <strong>Công ty Cổ phần VComm Bán lẻ Miền Nam</strong>.</p>
      ${truong("mk1", "Mật khẩu", "password", "", "", "Tối thiểu 10 ký tự.")}${truong("mk2", "Nhập lại mật khẩu", "password")}
      <button type="button" class="nut chinh" data-hanh-dong="den" data-den="01" style="justify-content:center">Kích hoạt</button>
      <div class="phan-cach">hoặc</div><button type="button" class="nut phu" style="justify-content:center">Dùng Google</button><button type="button" class="nut phu" style="justify-content:center">Dùng Microsoft</button>`),
    "04": () => trangNgoai(`<div class="logo-lon">VComm</div><h2>Quên mật khẩu</h2>${truong("lien-he", "Email hoặc số điện thoại", "text")}
      ${nut("Gửi đường dẫn", "chinh", "xu-ly", "Nếu tài khoản tồn tại, bạn sẽ nhận được đường dẫn đặt lại mật khẩu.")}
      <a href="${duongDan("01")}">Quay lại đăng nhập</a>`),
    "05": () => trangChung(`${tieuDe("Xin chào, Nguyễn Thị Hồng Nhung")}<div class="luoi-app">${[
      ["QT", "Quản trị hệ thống", "", "09"], ["SP", "Sản phẩm và Nhà bán", "12"], ["KH", "Kho", "4"], ["MH", "Mua hàng", ""], ["BH", "Bán hàng", "27"],
      ["KT", "Tài chính – Kế toán", "3"], ["ĐT", "Khách hàng và Đối tác", ""], ["NS", "Nhân sự", "1"]].map(([v, t, s, den]) =>
      `<a class="o-app" href="${den ? duongDan(vaiTro === "nhan-vien" ? "17" : den) : "#"}"><span class="bieu-tuong">${v}</span><strong>${t}</strong>${s ? `<span class="huy-hieu">${s} việc chờ</span>` : `<span class="chu-thich">Không có việc chờ</span>`}</a>`).join("")}</div>
      <div class="the"><h2>Chờ tôi duyệt</h2>${bang(["Số chứng từ", "Loại", "Giá trị", "Gửi lúc"], [
      [`<a href="${duongDan("08")}">DM-VCR-2026-000231</a>`, "Đơn mua", "80.000.000&nbsp;đ", `09:12 ${nhan("Quá hạn", "loi")}`],
      [`<a href="${duongDan("08")}">PC-VCR-2026-000088</a>`, "Phiếu chi", "12.500.000&nbsp;đ", "Hôm qua"]])}</div>`),
    "06": () => trangChung(`${tieuDe("Hồ sơ cá nhân")}<div class="cac-the"><button type="button">Thông tin</button><button type="button" class="chon">Đăng nhập</button><button type="button">Xác thực hai lớp</button><button type="button">Phiên đăng nhập</button></div>
      <div class="hai-cot"><div class="the">${truong("ho-ten", "Họ tên", "text", "Nguyễn Thị Hồng Nhung")}<div class="truong"><label for="nn">Ngôn ngữ</label><select id="nn" class="o-nhap"><option>Tiếng Việt</option><option>English</option></select></div>${nut("Lưu", "chinh", "xu-ly", "Đã lưu hồ sơ.")}</div>
      <div class="the"><h3>Cách đăng nhập</h3>${bang(["Cách", "Trạng thái", ""], [
      ["Mật khẩu", nhan("Đã đặt", "thanh-cong"), nut("Đổi mật khẩu", "phu", "ngan-keo")],
      ["Google", nhan("Đã liên kết", "thanh-cong"), nut("Hủy liên kết", "phu", "xac-nhan")],
      ["Microsoft", nhan("Chưa liên kết", "trung-tinh"), nut("Liên kết", "phu", "xu-ly", "Đã liên kết Microsoft.")],
      ["Zalo", nhan("Chưa liên kết", "trung-tinh"), nut("Liên kết Zalo", "phu", "xu-ly", "Đã liên kết Zalo.")]])}
      <div class="khoi-canh-bao thong-tin">Xác thực hai lớp đang bắt buộc với vai trò của bạn nên không tắt được.</div></div></div>`),
    "07": () => trangChung(`${tieuDe("Hộp duyệt (3)")}${loc(["Công ty", "Mini app", "Loại chứng từ"])}
      <div class="khoi-canh-bao canh-bao">1 chứng từ đã quá hạn duyệt và sẽ chuyển cho người duyệt thay thế sau 4 giờ nữa.</div>
      ${bang(["Số chứng từ", "Loại", "Công ty", "Người lập", "Giá trị", "Cấp", "Gửi lúc", ""], [
      [`<a href="${duongDan("08")}">DM-VCR-2026-000231</a>`, "Đơn mua", "VComm Bán lẻ Miền Nam", "Lê Văn Phúc", "80.000.000&nbsp;đ", "2/2", `09:12 ${nhan("Quá hạn", "loi")}`, `<div class="nhom-nut">${nut("Đồng ý", "chinh", "xu-ly", "Đã duyệt DM-VCR-2026-000231.")}${nut("Từ chối", "phu", "tu-choi")}</div>`],
      [`<a href="${duongDan("08")}">DM-VCT-2026-000017</a>`, "Đơn mua", "VComm Thương mại và Dịch vụ Xuất nhập khẩu Miền Bắc", "Phạm Thị Thu Hà", "2.000&nbsp;USD<br><span class='chu-thich'>≈ 52.600.000&nbsp;đ</span>", "2/2", "Hôm qua", `<div class="nhom-nut">${nut("Đồng ý", "chinh", "xu-ly", "Đã duyệt DM-VCT-2026-000017.")}${nut("Từ chối", "phu", "tu-choi")}</div>`]], "2 chứng từ")}`),
    "08": () => trangChung(`${tieuDe(`DM-VCR-2026-000231 · Đơn mua ${nhan("Chờ duyệt cấp 2", "canh-bao")}`, `<a class="nut phu" href="#">Mở chứng từ ↗</a>`)}
      <div class="the"><dl class="thong-tin-dong"><dt>Giá trị</dt><dd>80.000.000&nbsp;đ</dd><dt>Người lập</dt><dd>Lê Văn Phúc · Phòng Mua hàng</dd><dt>Công ty</dt><dd>VComm Bán lẻ Miền Nam</dd></dl></div>
      <div class="the"><h2>Các cấp duyệt</h2><ol class="dong-thoi-gian">
      <li class="xong"><span class="cham">✓</span><div><strong>Cấp 1 · từ 0&nbsp;đ · Trưởng phòng Mua hàng</strong><div>Đồng ý lúc 08:30 – “Đúng kế hoạch nhập hàng quý IV”</div><div class="chu-thich">Thay thế: Phó phòng Mua hàng</div></div></li>
      <li class="cho"><span class="cham">2</span><div><strong>Cấp 2 · từ 50.000.000&nbsp;đ · Giám đốc công ty</strong><div>Đang chờ · thời hạn 4 giờ ${nhan("Quá hạn", "loi")}</div><div class="chu-thich">Thay thế: Phó giám đốc</div></div></li></ol></div>
      <div class="nhom-nut">${nut("Đồng ý", "chinh", "xu-ly", "Đã duyệt DM-VCR-2026-000231.")}${nut("Từ chối", "phu", "tu-choi")}<button type="button" class="nut phu" disabled title="Không rút lại được vì cấp 1 đã đồng ý">Rút lại</button></div>`),
    "09": () => trangQuanTri(`${tieuDe("Công ty", nutLichSu() + nut("Thêm công ty", "chinh", "ngan-keo"))}<div class="hai-cot">
      <div class="the"><ul class="cay"><li><button type="button">▾ Tập đoàn VComm (VCG)</button><ul><li><button type="button" class="chon">▸ VComm Bán lẻ Miền Nam (VCR)</button></li><li><button type="button">▸ VComm Thương mại và Dịch vụ Xuất nhập khẩu Miền Bắc (VCT)</button></li></ul></li></ul></div>
      <div class="the"><div class="tieu-de"><h2>Công ty Cổ phần VComm Bán lẻ Miền Nam</h2>${nhan("Đang hoạt động", "thanh-cong")}</div>
      <dl class="thong-tin-dong"><dt>Mã</dt><dd>VCR</dd><dt>Mã số thuế</dt><dd>0312345678</dd><dt>Tiền tệ hạch toán</dt><dd>VND</dd><dt>Chế độ kế toán</dt><dd>Thông tư 200</dd><dt>Năm tài chính</dt><dd>Bắt đầu tháng 1</dd><dt>Chi nhánh</dt><dd>4</dd></dl>
      <div class="nhom-nut">${nut("Sửa", "phu", "ngan-keo")}${nut("Ngừng hoạt động", "nguy-hiem", "xac-nhan")}</div></div></div>`),
    "10": () => trangQuanTri(`${tieuDe("Chi nhánh", nutLichSu() + nut("Thêm chi nhánh", "chinh", "ngan-keo"))}${loc(["Loại", "Tỉnh thành", "Trạng thái"])}${bang(["Mã", "Tên", "Loại", "Tỉnh thành", "Trạng thái"], [
      ["VCR-HCM", "Trụ sở Thành phố Hồ Chí Minh", "Trụ sở", "Hồ Chí Minh", nhan("Đang hoạt động", "thanh-cong")],
      ["VCR-BD", "Kho tổng Bình Dương – Khu công nghiệp Việt Nam Singapore II mở rộng", "Kho", "Bình Dương", nhan("Đang hoạt động", "thanh-cong")],
      ["VCR-CT", "Cửa hàng Cần Thơ", "Cửa hàng", "Cần Thơ", nhan("Ngừng hoạt động", "trung-tinh")]], "3 chi nhánh")}`),
    "11": () => trangQuanTri(`${tieuDe("Phòng ban", nutLichSu() + nut("Thêm phòng ban", "chinh", "ngan-keo"))}<div class="hai-cot">
      <div class="the"><ul class="cay"><li><button type="button">▾ Ban Giám đốc</button><ul><li><button type="button">▾ Khối Vận hành</button><ul><li><button type="button" class="chon">Phòng Mua hàng</button></li><li><button type="button">Phòng Kho vận</button></li></ul></li></ul></li></ul></div>
      <div class="the"><h2>Phòng Mua hàng</h2><dl class="thong-tin-dong"><dt>Mã</dt><dd>MH</dd><dt>Phòng ban cha</dt><dd>Khối Vận hành</dd><dt>Trưởng phòng</dt><dd>Lê Văn Phúc</dd><dt>Nhân viên</dt><dd>12</dd></dl>
      <div class="nhom-nut">${nut("Sửa", "phu", "ngan-keo")}${nut("Ngừng hoạt động", "nguy-hiem", "xac-nhan")}</div></div></div>`),
    "12": () => trangQuanTri(`${tieuDe("Nhân viên", nutLichSu() + nut("Nhập từ Excel", "phu", "nhap-excel") + nut("Mời nhân viên", "chinh", "ngan-keo"))}${loc(["Chi nhánh", "Phòng ban", "Vai trò", "Trạng thái"])}
      ${bang(["Họ tên", "Email / Số điện thoại", "Chi nhánh", "Vai trò", "Trạng thái", "Đăng nhập cuối"], [
      [`<a href="${duongDan("13")}">Lê Văn Phúc</a>`, "phuc.le@vcomm.vn", "VCR-HCM", "Trưởng phòng mua hàng", nhan("Đang hoạt động", "thanh-cong"), "Hôm nay 08:30"],
      [`<a href="${duongDan("13")}">Trần Văn Bảo Long Nguyễn Hoàng</a>`, "+84 912 345 678", "VCR-BD", "Thủ kho", `${nhan("Đã mời", "thong-tin")} ${nut("Gửi lại", "chu", "xu-ly", "Đã gửi lại đường dẫn kích hoạt.")}`, "—"],
      [`<a href="${duongDan("13")}">Phạm Thị Thu Hà</a>`, "ha.pham@vcomm.vn", "VCR-HCM", "Kế toán viên", nhan("Bị khóa", "loi"), "02/11/2026"]], "3 nhân viên")}`),
    "13": () => trangQuanTri(`${tieuDe(`Lê Văn Phúc ${nhan("Đang hoạt động", "thanh-cong")}`, nut("Khóa", "phu", "xac-nhan") + nut("Đặt lại xác thực hai lớp", "phu", "xac-nhan") + nut("Vô hiệu hóa", "nguy-hiem", "vo-hieu-hoa"))}
      <div class="cac-the"><button type="button">Công ty</button><button type="button" class="chon">Vai trò</button><button type="button">Phiên đăng nhập</button></div>
      <div class="nhom-nut">${nut("Gán vai trò", "chinh", "gan-vai-tro")}</div>
      ${bang(["Vai trò", "Phạm vi", "Từ ngày", "Đến ngày", ""], [
      ["Trưởng phòng mua hàng", "Công ty VCR", "01/11/2026", "—", nut("Gỡ", "phu", "xac-nhan")],
      [`Kế toán viên ${nhan("Nhạy cảm", "canh-bao")}`, "Chi nhánh VCR-BD", "09/11/2026", "30/11/2026", nut("Gỡ", "phu", "xac-nhan")]])}`),
    "14": () => trangQuanTri(`${tieuDe("Vai trò", nutLichSu() + nut("Thêm vai trò", "chinh", "ngan-keo"))}<div class="hai-cot">
      <div class="the"><ul class="cay"><li><button type="button">Quản trị tập đoàn ${nhan("Hệ thống", "trung-tinh")}</button></li><li><button type="button">Quản trị công ty ${nhan("Hệ thống", "trung-tinh")}</button></li>
      <li><button type="button" class="chon">Trưởng phòng mua hàng ${nhan("Riêng công ty", "thong-tin")}</button></li><li><button type="button">Thủ kho ${nhan("Dùng chung", "thong-tin")}</button></li></ul></div>
      <div class="the"><h2>Trưởng phòng mua hàng</h2><div class="chu-thich">4 người đang có vai trò này. Ô mờ là quyền bạn không có, nên không cấp được.</div>
      ${bang(["Mua hàng", "Xem", "Thêm", "Sửa", "Duyệt"], [["Đề nghị mua", "☑", "☑", "☑", "☑"], ["Đơn mua", "☑", "☑", "☑", "☐"], ["Nhà cung cấp", "☑", "☐", "<span style='opacity:.4'>☐</span>", "—"]])}
      <div class="nhom-nut">${nut("Lưu", "chinh", "xu-ly", "Đã lưu vai trò.")}</div></div></div>`),
    "15": () => trangQuanTri(`${tieuDe("Chính sách duyệt · Đơn mua", nutLichSu() + nut("Tạo chính sách mới", "chinh", "ngan-keo"))}
      <div class="chu-thich">Tiền tệ so ngưỡng: VND · Hiệu lực từ 01/11/2026 · Chứng từ phải qua mọi cấp có ngưỡng nhỏ hơn hoặc bằng giá trị.</div>
      ${bang(["Cấp", "Ngưỡng", "Người duyệt", "Người thay thế", "Thời hạn"], [
      ["1", "0&nbsp;đ", "Trưởng phòng của người lập", "Phó phòng Mua hàng", "4 giờ"], ["2", "50.000.000&nbsp;đ", "Vai trò: Giám đốc công ty", "Phó giám đốc", "8 giờ"],
      ["3", "500.000.000&nbsp;đ", "Nhân viên: Võ Minh Tuấn (Tổng giám đốc)", "Nguyễn Văn An", "24 giờ"]])}`),
    "16": () => trangQuanTri(`${tieuDe("Dãy số chứng từ", nutLichSu())}${bang(["Loại chứng từ", "Tiền tố", "Đặt lại", "Số chữ số", "Số kế tiếp", ""], [
      ["Phiếu nhập kho", "PN", "Theo năm", "6", "PN-VCR-2026-000124", nut("Sửa", "phu", "ngan-keo")],
      ["Đơn mua", "DM", "Theo năm", "6", "DM-VCR-2026-000232", nut("Sửa", "phu", "ngan-keo")]])}`),
    "17": () => trangQuanTri(`${tieuDe("Tỷ giá", nutLichSu() + (["tap-doan", "ty-gia"].includes(vaiTro) ? nut("Nhập tỷ giá", "chinh", "ngan-keo") : ""))}
      <div class="bo-loc"><label for="ngay">Ngày</label><input id="ngay" class="o-nhap" type="date" value="2026-11-09" style="width:auto"></div>
      <div class="khoi-canh-bao canh-bao">Hôm nay chưa có tỷ giá hạch toán CNY → VND. Chứng từ bằng CNY chưa gửi duyệt được.</div>
      ${bang(["Cặp tiền tệ", "Loại", "Nguồn", "Tỷ giá"], [["USD → VND", "Hạch toán", "Vietcombank", "26.300"], ["EUR → VND", "Hạch toán", "Nhập tay", "28.540"]])}`),
    "18": () => trangQuanTri(`${tieuDe("Nhật ký thao tác")}${loc(["Người làm", "Mini app", "Đối tượng", "Hành động"])}${bang(["Thời điểm", "Người làm", "Công ty", "Hành động", "Đối tượng"], [
      ["09/11/2026 09:14", "Nguyễn Thị Hồng Nhung", "VCR", "Gán vai trò", "Lê Văn Phúc – Kế toán viên (VCR-BD)"],
      ["09/11/2026 08:30", "Lê Văn Phúc", "VCR", "Duyệt cấp 1", "DM-VCR-2026-000231"],
      ["09/11/2026 08:02", "—", "—", nhan("Đăng nhập thất bại", "loi"), "phuc.le@vcomm.vn"]], "3 dòng")}`)
  };

  const TRANG_THAI = {
    "rong": () => `<div class="trang-thai-trong"><div class="hinh"></div><h2>Chưa có dữ liệu</h2><p style="margin:0">Mục này chưa có bản ghi nào. Bấm nút bên dưới để thêm bản ghi đầu tiên.</p><button type="button" class="nut chinh">Thêm mới</button></div>`,
    "dang-tai": () => `<div class="the" aria-busy="true">${"<div class='xuong'></div>".repeat(7)}</div>`,
    "loi": () => `<div class="trang-thai-trong"><h2>Không tải được dữ liệu</h2><p style="margin:0">Kiểm tra kết nối mạng rồi bấm Thử lại. Nếu vẫn lỗi, báo quản trị kèm thời điểm xảy ra.</p><button type="button" class="nut phu">Thử lại</button></div>`,
    "khong-quyen": () => `<div class="trang-thai-trong"><h2>Bạn không có quyền xem trang này</h2><p style="margin:0">Liên hệ quản trị công ty nếu bạn cần quyền này.</p><a class="nut chinh" href="${duongDan("05")}">Về trang chủ</a></div>`
  };

  function veTrang() {
    let html;
    const soMa = Number(ma);
    const khongQuyen = DUOC_XEM[ma] && !DUOC_XEM[ma].includes(vaiTro);
    const tt = khongQuyen ? "khong-quyen" : trangThai;
    if (soMa >= 5 && tt !== "du-lieu") {
      const ten = { "05": "Trang chủ", "06": "Hồ sơ cá nhân", "07": "Hộp duyệt", "08": "Chi tiết yêu cầu duyệt" }[ma] || (MENU.find(m => m[0] === ma) || ["", "Chi tiết nhân viên"])[1];
      const than = `${tieuDe(ten)}${TRANG_THAI[tt]()}`;
      html = soMa >= 9 ? trangQuanTri(than) : trangChung(than);
    } else {
      html = VE[ma]();
    }
    document.getElementById("ung-dung").innerHTML = html + `<div class="vung-thong-bao" id="vung-thong-bao" aria-live="polite"></div>`;
  }

  function thongBao(chu, loai) {
    const vung = document.getElementById("vung-thong-bao");
    const o = document.createElement("div");
    o.className = `thong-bao-noi ${loai || "thanh-cong"}`; o.textContent = chu; vung.appendChild(o);
    setTimeout(() => o.remove(), 5000);
  }
  function moLop(html, giua) {
    const che = document.createElement("div");
    che.className = `man-che${giua ? " giua" : ""}`; che.innerHTML = html;
    che.addEventListener("click", e => { if (e.target === che || e.target.dataset.dong !== undefined) che.remove(); });
    document.body.appendChild(che);
    const dauTien = che.querySelector("input, select, textarea, button"); if (dauTien) dauTien.focus();
    return che;
  }
  const hopThoai = (tieuDeChu, noiDung, chuNut, loaiNut, thongBaoChu) => {
    const che = moLop(`<div class="hop-thoai" role="dialog" aria-modal="true"><h2>${tieuDeChu}</h2>${noiDung}
      <div class="nhom-nut" style="justify-content:flex-end"><button type="button" class="nut phu" data-dong>Hủy</button><button type="button" class="nut ${loaiNut}" data-xac-nhan>${chuNut}</button></div></div>`, true);
    che.querySelector("[data-xac-nhan]").addEventListener("click", () => { che.remove(); thongBao(thongBaoChu); });
  };

  document.addEventListener("click", e => {
    const n = e.target.closest("[data-hanh-dong]"); if (!n || n.disabled) return;
    const hd = n.dataset.hanhDong;
    if (hd === "den") { n.classList.add("dang-xu-ly"); n.disabled = true; setTimeout(() => { location.href = duongDan(n.dataset.den); }, 500); return; }
    if (hd === "xu-ly") { n.classList.add("dang-xu-ly"); n.disabled = true; setTimeout(() => { n.classList.remove("dang-xu-ly"); n.disabled = false; thongBao(n.dataset.thongBao || "Đã lưu."); }, 700); return; }
    if (hd === "tu-choi") return hopThoai("Từ chối chứng từ", `<div class="truong"><label for="ly-do">Lý do từ chối (bắt buộc)</label><textarea id="ly-do" class="o-nhap" rows="3"></textarea></div>`, "Từ chối", "nguy-hiem", "Đã từ chối chứng từ.");
    if (hd === "xac-nhan") return hopThoai("Xác nhận thao tác", `<p style="margin:0">Bạn chắc chắn muốn <strong>${n.textContent.trim().toLowerCase()}</strong>? Thao tác được ghi vào nhật ký.</p>`, n.textContent.trim(), "nguy-hiem", "Đã thực hiện.");
    if (hd === "vo-hieu-hoa") return hopThoai("Vô hiệu hóa Lê Văn Phúc", `<p style="margin:0">Chọn người nhận bàn giao trước khi vô hiệu hóa.</p>
      <div class="truong"><label for="nhan-1">3 chứng từ đang chờ duyệt</label><select id="nhan-1" class="o-nhap"><option>Chọn nhân viên…</option><option>Nguyễn Văn An</option></select></div>
      <div class="truong"><label for="nhan-2">Trưởng phòng Mua hàng</label><select id="nhan-2" class="o-nhap"><option>Chọn nhân viên…</option><option>Nguyễn Văn An</option></select></div>`, "Vô hiệu hóa", "nguy-hiem", "Đã vô hiệu hóa và bàn giao.");
    if (hd === "nhap-excel") return hopThoai("Nhập nhân viên từ Excel", `<a href="#">Tải tệp mẫu</a><div class="truong"><label for="tep">Tệp .xlsx (tối đa 1.000 dòng, 5 MB)</label><input id="tep" type="file" class="o-nhap" accept=".xlsx"></div>
      <div class="khoi-canh-bao canh-bao">Kết quả mẫu: 8 dòng đã mời, 2 dòng lỗi (email trùng). <a href="#">Tải danh sách dòng lỗi</a></div>`, "Nhập", "chinh", "Đã mời 8 nhân viên.");
    if (hd === "gan-vai-tro") {
      const phamVi = vaiTro === "tap-doan" ? "<option>Tập đoàn</option><option>Công ty VCR</option><option>Chi nhánh VCR-BD</option>" : "<option>Công ty VCR</option><option>Chi nhánh VCR-BD</option>";
      const che = moLop(`<aside class="ngan-keo" role="dialog" aria-modal="true"><h2>Gán vai trò</h2>
        <div class="truong"><label for="vt">Vai trò</label><select id="vt" class="o-nhap"><option>Kế toán viên (nhạy cảm)</option><option>Thủ kho</option></select></div>
        <div class="truong"><label for="pv">Phạm vi</label><select id="pv" class="o-nhap">${phamVi}</select></div>
        ${truong("tu", "Từ ngày", "date", "2026-11-09")}${truong("den-ngay", "Đến ngày", "date", "2026-11-01", "Ngày kết thúc phải sau ngày bắt đầu.")}
        <div class="khoi-canh-bao thong-tin">Vai trò có quyền nhạy cảm: nhân viên sẽ bắt buộc xác thực hai lớp từ lần đăng nhập sau.</div>
        <div class="nhom-nut"><button type="button" class="nut phu" data-dong>Hủy</button><button type="button" class="nut chinh" data-luu>Gán</button></div></aside>`);
      che.querySelector("[data-luu]").addEventListener("click", () => { che.remove(); thongBao("Đã gán vai trò."); });
      return;
    }
    if (hd === "ngan-keo") {
      const che = moLop(`<aside class="ngan-keo" role="dialog" aria-modal="true"><h2>${n.textContent.trim()}</h2>
        ${truong("ma-moi", "Mã", "text")}${truong("ten-moi", "Tên", "text", "", "Vui lòng nhập tên.")}
        <div class="nhom-nut"><button type="button" class="nut phu" data-dong>Hủy</button><button type="button" class="nut chinh" data-luu>Lưu</button></div></aside>`);
      che.querySelector("[data-luu]").addEventListener("click", () => { che.remove(); thongBao("Đã lưu."); });
    }
  });
  document.addEventListener("keydown", e => { if (e.key === "Escape") document.querySelectorAll(".man-che").forEach(c => c.remove()); });

  const dk = document.createElement("div");
  dk.className = "dieu-khien";
  dk.innerHTML = `<strong>Bản mẫu</strong><a href="index.html">Mục lục</a>
    <label for="dk-vai-tro">Vai trò</label><select id="dk-vai-tro">${Object.entries(VAI_TRO).map(([k, v]) => `<option value="${k}"${k === vaiTro ? " selected" : ""}>${v}</option>`).join("")}</select>
    <label for="dk-trang-thai">Trạng thái</label><select id="dk-trang-thai">${[["du-lieu", "Có dữ liệu"], ["rong", "Rỗng"], ["dang-tai", "Đang tải"], ["loi", "Lỗi"], ["khong-quyen", "Không có quyền"]].map(([k, v]) => `<option value="${k}"${k === trangThai ? " selected" : ""}>${v}</option>`).join("")}</select>`;
  document.body.appendChild(dk);
  dk.querySelector("#dk-vai-tro").addEventListener("change", e => { vaiTro = e.target.value; ghi("ban-mau-vai-tro", vaiTro); veTrang(); });
  dk.querySelector("#dk-trang-thai").addEventListener("change", e => { trangThai = e.target.value; ghi("ban-mau-trang-thai", trangThai); veTrang(); });
  veTrang();
})();
