// Bản mẫu MODULE_08 Nhân sự phần 4 (CONG_VIEC_54): MAN_HINH_168 đến MAN_HINH_173 từ dữ liệu giả. Không phải mã sản phẩm.
(function () {
  const TEP = {
    "168": "NHU_CAU_TUYEN_DUNG", "169": "TIN_TUYEN_DUNG", "170": "UNG_VIEN",
    "171": "TRANG_TUYEN_DUNG_CONG_KHAI", "172": "QUAN_LY_DANH_GIA", "173": "PHIEU_DANH_GIA"
  };
  const duongDan = ma => `MAN_HINH_${ma}_${TEP[ma]}.html`;
  const VAI_TRO = { "quan-ly": "Quản lý nhân sự", "truong-phong": "Trưởng phòng (lập nhu cầu, chấm đánh giá)", "phong-van": "Người phỏng vấn được giao", "nhan-vien": "Nhân viên", "khach": "Khách (không đăng nhập)" };
  // Bảng vai trò – màn hình (CONG_VIEC_54 mục 8).
  const DUOC_XEM = {
    "168": ["quan-ly", "truong-phong"], "169": ["quan-ly"], "170": ["quan-ly", "phong-van"],
    "171": ["quan-ly", "truong-phong", "phong-van", "nhan-vien", "khach"], "172": ["quan-ly"], "173": ["quan-ly", "truong-phong", "nhan-vien", "phong-van"]
  };
  const MENU = [["168", "Tuyển dụng"], ["170", "Ứng viên"], ["172", "Đánh giá hiệu suất"], ["173", "Đánh giá của tôi"]];
  const doc = (khoa, macDinh) => { try { return localStorage.getItem(khoa) || macDinh; } catch (e) { return macDinh; } };
  const ghi = (khoa, giaTri) => { try { localStorage.setItem(khoa, giaTri); } catch (e) { /* bỏ qua */ } };
  const ma = document.body.dataset.manHinh;
  let vaiTro = doc("ban-mau-td-vai-tro", ma === "171" ? "khach" : "quan-ly");
  let trangThai = doc("ban-mau-td-trang-thai", "du-lieu");
  let buoc = "danh-sach"; // MAN_HINH_171: danh-sach, chi-tiet, nop, da-nop
  const laQuanLy = () => vaiTro === "quan-ly";

  const thanhTren = () => `<header class="thanh-tren"><a class="logo" href="#">VComm</a><a href="#">Trang chủ</a><span class="gian"></span>
    <button type="button" aria-label="Chọn công ty">VComm Bán lẻ Miền Nam ▾</button><a href="#">Hộp duyệt <span class="huy-hieu">2</span></a>
    <button type="button">Thông báo <span class="huy-hieu">3</span></button><a href="#">Nguyễn Thị Hồng Nhung ▾</a></header>`;
  const menuHien = m => m === "173" ? vaiTro !== "khach" : DUOC_XEM[m].includes(vaiTro);
  const menu = () => `<nav class="menu" aria-label="Nhân sự"><div class="ten-app">Nhân sự</div><a href="#">Hồ sơ nhân sự</a><a href="#">Hợp đồng</a>${MENU.filter(([m]) => menuHien(m)).map(([m, t]) =>
    `<a href="${duongDan(m)}" class="${m === ma || ma === "169" && m === "168" ? "chon" : ""}">${t}</a>`).join("")}<a href="#">Hồ sơ của tôi</a></nav>`;
  const trang = noiDung => `${thanhTren()}<div class="than">${menu()}<main class="noi-dung">${noiDung}</main></div>`;
  const bang = (cot, dong, tong) => `<div class="khung-bang"><table><thead><tr>${cot.map(c => `<th scope="col">${c}</th>`).join("")}</tr></thead>
    <tbody>${dong.map(d => `<tr>${d.map((o, i) => `<td data-nhan="${cot[i] || ""}"><span>${o}</span></td>`).join("")}</tr>`).join("")}</tbody></table>
    ${tong ? `<div class="phan-trang"><span>${tong}</span><span>‹ 1 ›</span></div>` : ""}</div>`;
  const nut = (chu, loai, hanhDong, thongBao) => `<button type="button" class="nut ${loai}" data-hanh-dong="${hanhDong || "xu-ly"}" data-thong-bao="${thongBao || ""}">${chu}</button>`;
  const nutDen = (chu, loai, den) => `<a class="nut ${loai}" href="${duongDan(den)}">${chu}</a>`;
  const tieuDe = (chu, cacNut) => `<div class="tieu-de"><h1>${chu}</h1>${cacNut ? `<div class="nhom-nut">${cacNut}</div>` : ""}</div>`;
  const nhan = (chu, loai) => `<span class="nhan ${loai}">${chu}</span>`;
  const luaChon = (id, nhanChu, cacGiaTri, loi) => `<div class="truong"><label for="${id}">${nhanChu}</label><select id="${id}" class="o-nhap${loi ? " loi" : ""}">${cacGiaTri.map(g => `<option>${g}</option>`).join("")}</select>${loi ? `<span class="loi-o">${loi}</span>` : ""}</div>`;
  const truong = (id, nhanChu, kieu, giaTri, loi, goiY) => `<div class="truong"><label for="${id}">${nhanChu}</label>
    <input id="${id}" class="o-nhap${loi ? " loi" : ""}" type="${kieu || "text"}" value="${giaTri || ""}" ${loi ? `aria-describedby="${id}-loi"` : ""}>
    ${loi ? `<span id="${id}-loi" class="loi-o">${loi}</span>` : ""}${goiY ? `<span class="chu-thich">${goiY}</span>` : ""}</div>`;
  const vanBan = (id, nhanChu, giaTri, goiY) => `<div class="truong"><label for="${id}">${nhanChu}</label><textarea id="${id}" class="o-nhap" rows="3">${giaTri || ""}</textarea>${goiY ? `<span class="chu-thich">${goiY}</span>` : ""}</div>`;
  const cacThe = (ten) => `<div class="cac-the" role="tablist">${ten.map((t, i) => `<button type="button" role="tab" data-the="${i}" class="${i === 0 ? "chon" : ""}">${t}</button>`).join("")}</div>`;
  const GIAI_DOAN = { moi: nhan("Mới", "thong-tin"), sang: nhan("Sàng lọc", "thong-tin"), pv: nhan("Phỏng vấn", "canh-bao"), dn: nhan("Đề nghị", "canh-bao"), nhan: nhan("Nhận việc", "thanh-cong"), loai: nhan("Bị loại", "trung-tinh"), rut: nhan("Ứng viên rút", "trung-tinh") };
  const trung = nhan("Có thể trùng", "canh-bao");
  const kho = nhan("Kho ứng viên đến 12/11/2027", "thong-tin");

  const VE = {
    "168": () => trang(`${tieuDe("Nhu cầu tuyển dụng", nut("Lập nhu cầu", "chinh", "nhu-cau"))}
      ${laQuanLy() ? cacThe(["Nhu cầu", "Tin tuyển dụng"]) : ""}
      <div data-noi-dung-the="0">
      <div class="bo-loc"><label class="an-nhan" for="tim">Tìm</label><input id="tim" class="o-nhap" placeholder="Số, chức danh…">
        <select class="o-nhap" aria-label="Trạng thái"><option>Trạng thái: tất cả</option><option>Nháp</option><option>Chờ duyệt</option><option>Đã duyệt</option><option>Hoàn thành</option><option>Đã đóng</option><option>Bị từ chối</option><option>Đã hủy</option></select>
        <select class="o-nhap" aria-label="Phòng ban"><option>Phòng ban: tất cả</option></select></div>
      ${bang(["Số", "Chức danh", "Phòng ban", "Số lượng", "Đã tuyển", "Lương", "Ngày cần", "Trạng thái"], [
        [`<a href="#" data-hanh-dong="chi-tiet-nc">TD-VCR-2026-000014</a>`, "Nhân viên kho", "Kho Bình Dương", "3", "1", "8 – 10 triệu", "01/12/2026", nhan("Đã duyệt", "thanh-cong")],
        [`<a href="#" data-hanh-dong="chi-tiet-nc">TD-VCR-2026-000015</a>`, "Kế toán tổng hợp", "Phòng Kế toán", "1", "0", "18 – 22 triệu", "15/12/2026", nhan("Chờ duyệt", "thong-tin")],
        ["—", "Chuyên viên mua hàng", "Phòng Mua hàng", "1", "0", "15 – 18 triệu", "05/01/2027", nhan("Nháp", "trung-tinh")],
        [`<a href="#" data-hanh-dong="chi-tiet-nc">TD-VCR-2026-000009</a>`, "Nhân viên kinh doanh", "Phòng Kinh doanh", "2", "2", "10 – 14 triệu", "01/10/2026", nhan("Hoàn thành", "thanh-cong")]],
        vaiTro === "truong-phong" ? "Nhu cầu do bạn lập" : "4 nhu cầu")}
      <div class="the" id="chi-tiet-nc"><div class="tieu-de"><h2>TD-VCR-2026-000014 · Nhân viên kho ${nhan("Đã duyệt", "thanh-cong")}</h2>
        ${laQuanLy() ? `<div class="nhom-nut">${nutDen("Lập tin tuyển dụng", "chinh", "169")}${nut("Đóng nhu cầu", "nguy-hiem", "dong-nc")}</div>` : ""}</div>
        <div class="hai-cot"><dl class="thong-tin-dong"><dt>Phòng ban</dt><dd>Kho Bình Dương · VCR-BD</dd><dt>Số lượng</dt><dd>3 (đã tuyển 1)</dd><dt>Loại hợp đồng dự kiến</dt><dd>Thử việc rồi chính thức</dd>
          <dt>Khoảng lương</dt><dd>8.000.000 – 10.000.000&nbsp;đ</dd><dt>Ngày cần người</dt><dd>01/12/2026</dd><dt>Lý do</dt><dd>Mở rộng · Kho mới khu B</dd><dt>Người lập</dt><dd>Phạm Văn Đức · 02/11/2026</dd></dl>
        <div><h3>Tiến trình duyệt</h3><ol class="dong-thoi-gian"><li class="xong"><span class="cham">1</span><div><strong>Trưởng phòng Nhân sự</strong><div>Đồng ý 03/11/2026</div></div></li><li class="xong"><span class="cham">2</span><div><strong>Giám đốc</strong><div>Đồng ý 04/11/2026 · giá trị duyệt 30.000.000&nbsp;đ</div></div></li></ol></div></div>
        <h3>Tin tuyển dụng</h3>${bang(["Tin", "Hạn nộp", "Công khai", "Hồ sơ", "Trạng thái"], [[`<a href="${duongDan("169")}">Nhân viên kho – Bình Dương</a>`, "30/11/2026", "Có", "12", nhan("Đang đăng", "thanh-cong")]])}</div>
      </div>
      <div data-noi-dung-the="1" hidden>${bang(["Tiêu đề", "Nhu cầu", "Hạn nộp", "Công khai", "Mới · Sàng lọc · Phỏng vấn · Đề nghị", "Trạng thái"], [
        [`<a href="${duongDan("169")}">Nhân viên kho – Bình Dương</a>`, "TD-VCR-2026-000014", "30/11/2026", "Có", "5 · 3 · 2 · 1", nhan("Đang đăng", "thanh-cong")],
        [`<a href="${duongDan("169")}">Nhân viên kinh doanh khu vực</a>`, "TD-VCR-2026-000009", "30/09/2026", "Có", "0 · 0 · 0 · 0", nhan("Đã đóng", "trung-tinh")]], "2 tin")}</div>`),

    "169": () => trang(`${tieuDe(`Nhân viên kho – Bình Dương ${nhan("Đang đăng", "thanh-cong")} ${nhan("Công khai", "thong-tin")}`,
        `${nut("Sửa tin", "phu", "sua-tin")}<a class="nut phu" href="${duongDan("171")}">Xem trang công khai</a>${nut("Đóng tin", "nguy-hiem", "xu-ly", "Đã đóng tin. 5 hồ sơ ở giai đoạn Mới, Sàng lọc kết thúc lý do \"tin đã đóng\".")}`)}
      <div class="the"><dl class="thong-tin-dong"><dt>Nhu cầu</dt><dd><a href="${duongDan("168")}">TD-VCR-2026-000014</a> · cần 3, đã tuyển 1</dd><dt>Hạn nộp</dt><dd>30/11/2026 ${nhan("Còn 19 ngày", "canh-bao")}</dd><dt>Nơi làm việc</dt><dd>Thuận An, Bình Dương · Toàn thời gian</dd><dt>Lương hiển thị</dt><dd>8 – 10 triệu</dd><dt>Email liên hệ</dt><dd>tuyendung@vcr.vcomm.vn</dd></dl></div>
      <div class="bo-loc" role="group" aria-label="Lọc giai đoạn">${[["Tất cả", 12], ["Mới", 5], ["Sàng lọc", 3], ["Phỏng vấn", 2], ["Đề nghị", 1], ["Nhận việc", 1], ["Đã kết thúc", 0]].map(([t, s], i) => `<button type="button" class="nut ${i === 0 ? "chinh" : "phu"}">${t} <span class="huy-hieu">${s}</span></button>`).join("")}</div>
      <div class="tieu-de"><h2>Hồ sơ ứng tuyển</h2><div class="nhom-nut">${nut("Thêm ứng viên", "chinh", "them-uv")}${nut("Thêm từ kho ứng viên", "phu", "tu-kho")}</div></div>
      ${bang(["Họ tên", "Nguồn", "Nộp lúc", "Kinh nghiệm", "Giai đoạn", ""], [
        [`<a href="${duongDan("170")}">Nguyễn Văn Toàn</a>`, "Trang tuyển dụng", "10/11/2026 21:14", "2 năm", GIAI_DOAN.moi, trung],
        [`<a href="${duongDan("170")}">Trần Thị Mai</a>`, "Giới thiệu nội bộ", "08/11/2026 09:02", "4 năm", GIAI_DOAN.pv, "Phỏng vấn 13/11 09:00"],
        [`<a href="${duongDan("170")}">Lê Hoàng Phúc</a>`, "Trang tuyển dụng", "05/11/2026 14:30", "1 năm", GIAI_DOAN.dn, nhan("Chờ duyệt đề nghị", "thong-tin")],
        [`<a href="${duongDan("170")}">Võ Minh Tú</a>`, "Trang việc làm", "03/11/2026 08:45", "3 năm", GIAI_DOAN.nhan, "Đã lập NV-VCR-000141"]], "12 hồ sơ")}`),

    "170": () => vaiTro === "phong-van" ? trang(`${tieuDe("Ứng viên được giao phỏng vấn")}
      <div class="khoi-canh-bao thong-tin">Bạn chỉ thấy ứng viên có vòng phỏng vấn bạn được giao.</div>
      ${bang(["Ứng viên", "Tin", "Vòng", "Thời điểm", "Phiếu của bạn"], [["Trần Thị Mai", "Nhân viên kho – Bình Dương", "Phỏng vấn chuyên môn", "13/11/2026 09:00 · 60 phút · trực tiếp", nut("Ghi đánh giá", "chinh", "danh-gia-pv")]])}
      <div class="the"><h2>Trần Thị Mai</h2><dl class="thong-tin-dong"><dt>Kinh nghiệm</dt><dd>4 năm · Kho lạnh Thuận An</dd><dt>Trình độ</dt><dd>Trung cấp</dd><dt>Sơ yếu lý lịch</dt><dd><a href="#" data-hanh-dong="xu-ly" data-thong-bao="Đã tải tệp. Lượt tải được ghi nhật ký.">tran-thi-mai-cv.pdf</a></dd></dl>
        <span class="chu-thich">Phiếu của người phỏng vấn khác hiện sau khi bạn nộp phiếu của mình.</span></div>`)
      : trang(`${tieuDe("Ứng viên", `${nut("Cài đặt lưu giữ", "phu", "cai-dat")}${nut("Thêm ứng viên", "chinh", "them-uv")}`)}
      ${cacThe(["Tất cả", "Kho ứng viên", "Sắp đến hạn xóa"])}
      <div data-noi-dung-the="0"><div class="bo-loc"><label class="an-nhan" for="tim">Tìm</label><input id="tim" class="o-nhap" placeholder="Họ tên, email, điện thoại…"></div>
      ${bang(["Họ tên", "Email", "Điện thoại", "Tin gần nhất", "Giai đoạn", "Ngày xóa dự kiến"], [
        [`<a href="#chi-tiet">Trần Thị Mai</a>`, "mai.tran@example.com", "0903 111 222", "Nhân viên kho – Bình Dương", GIAI_DOAN.pv, "—"],
        ["Nguyễn Văn Toàn " + trung, "toan.nv@example.com", "0912 333 444", "Nhân viên kho – Bình Dương", GIAI_DOAN.moi, "—"],
        ["Phan Thu Hà " + kho, "ha.phan@example.com", "0987 555 666", "Kế toán viên (đã đóng)", GIAI_DOAN.loai, "12/11/2027"],
        ["Đặng Quốc Việt", "viet.dang@example.com", "0938 777 888", "Nhân viên kinh doanh khu vực", GIAI_DOAN.loai, `14/11/2026 ${nhan("Còn 3 ngày", "loi")}`]], "4 ứng viên")}</div>
      <div data-noi-dung-the="1" hidden>${bang(["Họ tên", "Đồng ý kho từ", "Giữ đến", ""], [["Phan Thu Hà", "12/11/2026", "12/11/2027", nut("Thêm vào tin", "phu", "tu-kho")]])}</div>
      <div data-noi-dung-the="2" hidden>${bang(["Họ tên", "Lý do", "Ngày xóa"], [["Đặng Quốc Việt", "Không đạt phỏng vấn (kết thúc 15/10/2026)", "14/11/2026"]])}<span class="chu-thich">Hệ thống tự xóa lúc 1 giờ sáng ngày xóa: xóa tệp, họ tên, liên hệ, nhận xét; giữ số liệu không định danh để thống kê.</span></div>

      <div class="the" id="chi-tiet"><div class="tieu-de"><h2>Trần Thị Mai ${GIAI_DOAN.pv}</h2><div class="nhom-nut">${nut("Chuyển giai đoạn", "phu", "giai-doan")}${nut("Lập vòng phỏng vấn", "phu", "vong-pv")}${nut("Lập đề nghị", "chinh", "de-nghi")}${nut("Loại", "nguy-hiem", "loai")}${nut("Yêu cầu xóa", "nguy-hiem", "yeu-cau-xoa")}</div></div>
        ${cacThe(["Thông tin", "Phỏng vấn", "Đề nghị nhận việc", "Email đã gửi", "Đồng ý và lưu giữ"]).replace(/data-the="/g, 'data-the="c')}
        <div data-noi-dung-the="c0"><dl class="thong-tin-dong"><dt>Email</dt><dd>mai.tran@example.com</dd><dt>Điện thoại</dt><dd>0903 111 222</dd><dt>Nơi ở</dt><dd>Bình Dương</dd><dt>Trình độ</dt><dd>Trung cấp</dd><dt>Kinh nghiệm</dt><dd>4 năm</dd><dt>Lương mong muốn</dt><dd>9.500.000&nbsp;đ</dd>
          <dt>Nguồn</dt><dd>Giới thiệu nội bộ · anh Phạm Văn Đức</dd><dt>Sơ yếu lý lịch</dt><dd><a href="#" data-hanh-dong="xu-ly" data-thong-bao="Đã tải tệp. Lượt tải được ghi nhật ký.">tran-thi-mai-cv.pdf</a></dd><dt>Thư giới thiệu</dt><dd>Tôi có 4 năm làm kho lạnh, quen xe nâng…</dd></dl>
          <h3>Hồ sơ ứng tuyển</h3>${bang(["Tin", "Nộp", "Giai đoạn"], [["Nhân viên kho – Bình Dương", "08/11/2026", GIAI_DOAN.pv]])}</div>
        <div data-noi-dung-the="c1" hidden>${bang(["Vòng", "Thời điểm", "Hình thức", "Người phỏng vấn", "Đánh giá", "Trạng thái"], [
          ["Phỏng vấn chuyên môn", "13/11/2026 09:00 · 60 phút", "Trực tiếp · Kho VCR-BD", "Phạm Văn Đức, Lê Thu", "4/5 Đạt · 3/5 Cân nhắc", nhan("Đã lên lịch", "thong-tin")]])}</div>
        <div data-noi-dung-the="c2" hidden><div class="khoi-canh-bao canh-bao">Mức lương 10.500.000&nbsp;đ ngoài khoảng lương của nhu cầu (8 – 10 triệu). Bắt buộc nhập lý do; lý do hiện trên yêu cầu duyệt.</div>
          <div class="hai-cot">${truong("dn-cd", "Chức danh", "text", "Nhân viên kho")}${luaChon("dn-pb", "Phòng ban", ["Kho Bình Dương"])}${luaChon("dn-cn", "Chi nhánh", ["VCR-BD"])}${luaChon("dn-hd", "Loại hợp đồng dự kiến", ["Thử việc rồi chính thức", "Xác định thời hạn", "Không xác định thời hạn"])}
          ${truong("dn-luong", "Mức lương (đồng)", "text", "10.500.000")}${truong("dn-ly-do", "Lý do ngoài khoảng lương", "text", "Có chứng chỉ vận hành xe nâng, 4 năm kinh nghiệm")}${truong("dn-bd", "Ngày bắt đầu dự kiến", "date", "2026-12-01")}${truong("dn-han", "Hạn trả lời", "date", "2026-11-20")}</div>
          <div class="nhom-nut">${nut("Lưu nháp", "phu", "xu-ly", "Đã lưu nháp.")}${nut("Gửi duyệt", "chinh", "xu-ly", "Đã gửi duyệt DNNV-VCR-2026-000006.")}</div>
          <h3>Sau khi duyệt</h3><div class="nhom-nut">${nut("Gửi thư đề nghị", "phu", "email-dn")}${nut("Ghi trả lời ứng viên", "phu", "tra-loi")}${nut("Lập hồ sơ nhân sự", "chinh", "lap-ho-so")}</div>
          <span class="chu-thich">"Lập hồ sơ nhân sự" mở biểu mẫu hồ sơ (MAN_HINH_115) điền sẵn họ tên, liên hệ, trình độ, phòng ban, chi nhánh, chức danh, ngày vào làm; sơ yếu lý lịch được chép sang giấy tờ.</span></div>
        <div data-noi-dung-the="c3" hidden>${bang(["Thời điểm", "Loại", "Tiêu đề", "Người gửi"], [["11/11/2026 10:20", "Mời phỏng vấn", "VComm Bán lẻ Miền Nam mời phỏng vấn vị trí Nhân viên kho", "Hồng Nhung"]])}</div>
        <div data-noi-dung-the="c4" hidden><dl class="thong-tin-dong"><dt>Đồng ý tuyển dụng</dt><dd>08/11/2026 · nhập tay · tệp <a href="#">dong-y-email.png</a></dd><dt>Kho ứng viên</dt><dd>Chưa đồng ý</dd><dt>Ngày xóa dự kiến</dt><dd>Chưa có (còn hồ sơ đang xử lý). Không trúng tuyển: 30 ngày sau khi kết thúc.</dd></dl>
          <div class="nhom-nut">${nut("Ghi đồng ý kho ứng viên", "phu", "dong-y-kho")}</div></div>
      </div>`),

    "171": () => {
      const khung = noiDung => `<header class="thanh-tren"><a class="logo" href="#">VComm</a><strong>Tuyển dụng</strong><span class="gian"></span>
        <label class="an-nhan" for="ngon-ngu">Ngôn ngữ</label><select id="ngon-ngu" class="o-nhap" style="width:auto"><option>Tiếng Việt</option><option>English</option></select></header>
        <main class="noi-dung" style="max-width:960px;margin:0 auto">${noiDung}</main>`;
      if (buoc === "chi-tiet") return khung(`<p><a href="#" data-buoc="danh-sach">‹ Tất cả tin tuyển dụng</a></p>
        ${tieuDe("Nhân viên kho – Bình Dương", `<button type="button" class="nut chinh" data-buoc="nop">Nộp hồ sơ</button>`)}
        <div class="the"><dl class="thong-tin-dong"><dt>Công ty</dt><dd>VComm Bán lẻ Miền Nam</dd><dt>Nơi làm việc</dt><dd>Thuận An, Bình Dương</dd><dt>Hình thức</dt><dd>Toàn thời gian</dd><dt>Mức lương</dt><dd>8 – 10 triệu đồng</dd><dt>Hạn nộp</dt><dd>30/11/2026</dd><dt>Liên hệ</dt><dd>tuyendung@vcr.vcomm.vn</dd></dl></div>
        <div class="the"><h2>Mô tả công việc</h2><p>Nhận, xuất hàng theo phiếu; kiểm kê định kỳ; vận hành xe nâng tay.</p><h2>Yêu cầu</h2><p>Tốt nghiệp trung cấp trở lên; ưu tiên có kinh nghiệm kho lạnh.</p><h2>Quyền lợi</h2><p>Bảo hiểm đầy đủ; thưởng tháng 13; ca xoay.</p></div>`);
      if (buoc === "nop") return khung(`<p><a href="#" data-buoc="chi-tiet">‹ Nhân viên kho – Bình Dương</a></p>${tieuDe("Nộp hồ sơ: Nhân viên kho – Bình Dương")}
        <div class="the"><div class="hai-cot">${truong("ho-ten", "Họ và tên", "text", "Nguyễn Văn Toàn")}${truong("email", "Email", "email", "toan.nv@", "Email không đúng định dạng.")}${truong("dien-thoai", "Điện thoại", "tel", "0912333444")}
          ${luaChon("tinh", "Tỉnh, thành nơi ở (không bắt buộc)", ["Chưa chọn", "Bình Dương", "Thành phố Hồ Chí Minh"])}${luaChon("trinh-do", "Trình độ (không bắt buộc)", ["Chưa chọn", "Trung cấp", "Cao đẳng", "Đại học"])}${truong("kinh-nghiem", "Số năm kinh nghiệm (không bắt buộc)", "number", "2")}${truong("luong", "Mức lương mong muốn (không bắt buộc)", "text")}</div>
          ${vanBan("thu", "Thư giới thiệu (không bắt buộc, tối đa 2000 ký tự)")}
          <div class="truong"><label for="cv">Sơ yếu lý lịch (PDF hoặc DOCX, tối đa 10 MB)</label><input id="cv" type="file" class="o-nhap" accept=".pdf,.docx"></div>
          <div class="khoi-canh-bao thong-tin">VComm Bán lẻ Miền Nam xử lý họ tên, liên hệ, trình độ, kinh nghiệm, sơ yếu lý lịch của bạn chỉ để tuyển dụng cho tin này. Nếu không trúng tuyển, dữ liệu bị xóa 30 ngày sau khi kết thúc. Muốn xem, sửa, xóa dữ liệu, gửi email tới tuyendung@vcr.vcomm.vn kèm mã hồ sơ.</div>
          <div class="truong"><label><input type="checkbox"> Tôi đồng ý cho VComm Bán lẻ Miền Nam xử lý dữ liệu cá nhân trên để tuyển dụng cho tin này (bắt buộc).</label><span class="loi-o">Bạn cần đồng ý để nộp hồ sơ.</span></div>
          <div class="truong"><label><input type="checkbox"> Tôi đồng ý lưu hồ sơ trong kho ứng viên của công ty 12 tháng để được xét các tin khác (không bắt buộc).</label></div>
          <div class="nhom-nut"><button type="button" class="nut chinh" data-buoc="da-nop">Nộp hồ sơ</button></div></div>`);
      if (buoc === "da-nop") return khung(`<div class="the" style="text-align:center"><h1>Đã nhận hồ sơ</h1><p>Mã hồ sơ của bạn: <strong>UV-7K3P-Q9XD</strong></p>
        <p>Công ty sẽ liên hệ qua email hoặc điện thoại nếu hồ sơ phù hợp. Muốn yêu cầu xóa dữ liệu, gửi email tới tuyendung@vcr.vcomm.vn kèm mã hồ sơ.</p><p><a href="#" data-buoc="danh-sach">Xem tin tuyển dụng khác</a></p></div>`);
      return khung(`${tieuDe("Cơ hội nghề nghiệp tại tập đoàn VComm")}
        <div class="bo-loc"><label class="an-nhan" for="tim">Tìm</label><input id="tim" class="o-nhap" placeholder="Tìm vị trí…">
          <select class="o-nhap" aria-label="Công ty"><option>Công ty: tất cả</option><option>VComm Bán lẻ Miền Nam</option><option>VComm Logistics</option></select>
          <select class="o-nhap" aria-label="Nơi làm việc"><option>Nơi làm việc: tất cả</option><option>Bình Dương</option><option>Hà Nội</option></select>
          <select class="o-nhap" aria-label="Hình thức"><option>Hình thức: tất cả</option><option>Toàn thời gian</option><option>Bán thời gian</option></select></div>
        ${[["Nhân viên kho – Bình Dương", "VComm Bán lẻ Miền Nam", "Thuận An, Bình Dương", "8 – 10 triệu", "30/11/2026"], ["Kế toán tổng hợp", "VComm Bán lẻ Miền Nam", "Quận 7, Thành phố Hồ Chí Minh", "Thỏa thuận", "15/12/2026"], ["Tài xế giao hàng", "VComm Logistics", "Long Biên, Hà Nội", "12 – 15 triệu", "05/12/2026"]].map(t =>
          `<div class="the"><div class="tieu-de"><h2><a href="#" data-buoc="chi-tiet">${t[0]}</a></h2><button type="button" class="nut phu" data-buoc="chi-tiet">Xem</button></div><div>${t[1]} · ${t[2]} · ${t[3]} · Hạn nộp ${t[4]}</div></div>`).join("")}
        <div class="phan-trang"><span>3 tin</span><span>‹ 1 ›</span></div>`);
    },

    "172": () => trang(`${tieuDe("Đánh giá hiệu suất", nut("Lập kỳ đánh giá", "chinh", "ky"))}${cacThe(["Kỳ đánh giá", "Mẫu đánh giá"])}
      <div data-noi-dung-the="0">${bang(["Kỳ", "Thời gian", "Mẫu", "Mục tiêu · Năng lực", "Tiến độ", "Trạng thái"], [
        [`<a href="#chi-tiet-ky">Năm 2026</a>`, "01/01 – 31/12/2026", "Năng lực khối văn phòng", "60% · 40%", "18/42 người chấm đã nộp", nhan("Đang mở", "thong-tin")],
        ["6 tháng đầu 2026", "01/01 – 30/06/2026", "Năng lực khối văn phòng", "60% · 40%", "40/40", nhan("Đã công bố", "thanh-cong")]], "2 kỳ")}
      <div class="the" id="chi-tiet-ky"><div class="tieu-de"><h2>Năm 2026 ${nhan("Đang mở", "thong-tin")}</h2><div class="nhom-nut">${nut("Thêm phiếu", "phu", "xu-ly", "Đã thêm phiếu.")}${nut("Chốt kỳ", "phu", "chot")}${nut("Công bố", "chinh", "xu-ly", "Đã công bố. 42 nhân viên nhận thông báo.")}</div></div>
        <dl class="thong-tin-dong"><dt>Hạn đặt mục tiêu</dt><dd>31/01/2026</dd><dt>Hạn tự đánh giá</dt><dd>10/12/2026</dd><dt>Hạn người quản lý chấm</dt><dd>20/12/2026</dd><dt>Xếp loại</dt><dd>A ≥ 4,50 · B ≥ 3,50 · C ≥ 2,50 · D dưới 2,50</dd></dl>
        <div class="khoi-canh-bao canh-bao">2 phiếu chưa có người chấm (phòng ban chưa có trưởng phòng, hoặc trưởng phòng là chính nhân viên). Gán người chấm trước hạn.</div>
        ${bang(["Nhân viên", "Phòng ban", "Người chấm", "Mục tiêu", "Tự đánh giá", "Người chấm", "Điểm", "Xếp loại"], [
          [`<a href="${duongDan("173")}">Lê Thị Bích Ngọc</a>`, "Phòng Kế toán", "Nguyễn Văn Bình", nhan("Đã xác nhận", "thanh-cong"), nhan("Đã nộp", "thanh-cong"), nhan("Đã nộp", "thanh-cong"), "4,12", "B"],
          [`<a href="${duongDan("173")}">Trần Minh Khoa</a>`, "Phòng Mua hàng", "Phúc Lê", nhan("Đã xác nhận", "thanh-cong"), nhan("Đã nộp", "thanh-cong"), nhan("Đang chấm", "canh-bao"), "—", "—"],
          [`<a href="${duongDan("173")}">Nguyễn Văn Bình</a>`, "Phòng Kế toán", `<select class="o-nhap" aria-label="Gán người chấm"><option>Chưa gán</option><option>Nguyễn Thị Hồng Nhung</option></select>`, nhan("Chưa lập", "loi"), "—", "—", "—", "—"]], "42 phiếu")}
        <p class="chu-thich">Phân bố xếp loại (phiếu đã nộp): A 3 · B 11 · C 4 · D 0</p></div></div>
      <div data-noi-dung-the="1" hidden><div class="tieu-de"><h2>Mẫu đánh giá</h2>${nut("Lập mẫu", "chinh", "mau")}</div>
        ${bang(["Tên mẫu", "Số tiêu chí", "Đã dùng", ""], [["Năng lực khối văn phòng", "4", "2 kỳ", nut("Sao chép", "phu", "xu-ly", "Đã sao chép thành mẫu mới.")], ["Năng lực khối kho vận", "5", "Chưa", nut("Sửa", "phu", "mau")]])}</div>`),

    "173": () => {
      const nguoiCham = vaiTro === "truong-phong" || vaiTro === "quan-ly";
      return trang(`${tieuDe(`Phiếu đánh giá · Năm 2026 · Lê Thị Bích Ngọc ${nhan(nguoiCham ? "Người chấm đang chấm" : "Chờ công bố", "thong-tin")}`)}
        ${vaiTro === "nhan-vien" ? `<div class="the"><h2>Đánh giá của tôi</h2>${bang(["Kỳ", "Người chấm", "Trạng thái", "Kết quả"], [["Năm 2026", "Nguyễn Văn Bình", nhan("Đã nộp tự đánh giá", "thong-tin"), "Chưa công bố"], ["6 tháng đầu 2026", "Nguyễn Văn Bình", nhan("Đã công bố", "thanh-cong"), "3,86 · B"]])}</div>` :
          `<div class="the"><h2>Phiếu tôi chấm</h2>${bang(["Nhân viên", "Kỳ", "Hạn", "Trạng thái"], [["Lê Thị Bích Ngọc", "Năm 2026", "20/12/2026", nhan("Đang chấm", "canh-bao")], ["Hồ Thanh Vân", "Năm 2026", "20/12/2026", nhan("Chưa chấm", "trung-tinh")]])}</div>`}
        <div class="the"><h2>Mục tiêu (60%)</h2>${bang(["Mục tiêu", "Chỉ tiêu", "Trọng số", "Tự đánh giá", "Người chấm"], [
          ["Đóng sổ tháng đúng hạn", "Ngày 5 hằng tháng, 12/12 tháng", "50%", "5", nguoiCham ? `<select class="o-nhap" aria-label="Điểm"><option>4</option><option>5</option></select>` : "—"],
          ["Giảm sai sót đối chiếu công nợ", "Dưới 2 sai sót mỗi quý", "30%", "4", nguoiCham ? `<select class="o-nhap" aria-label="Điểm"><option>4</option></select>` : "—"],
          ["Hoàn thành khóa kế toán quản trị", "Có chứng chỉ trước 30/09", "20%", "4", nguoiCham ? `<select class="o-nhap" aria-label="Điểm"><option>3</option></select>` : "—"]])}<span class="chu-thich">Tổng trọng số 100%. Mục tiêu đã được người chấm xác nhận 20/01/2026.</span></div>
        <div class="the"><h2>Năng lực (40%) · mẫu "Năng lực khối văn phòng"</h2>${bang(["Tiêu chí", "Trọng số", "Tự đánh giá", "Người chấm"], [
          ["Chuyên môn", "40%", "4", nguoiCham ? `<select class="o-nhap" aria-label="Điểm"><option>4</option></select>` : "—"], ["Tinh thần trách nhiệm", "30%", "5", nguoiCham ? `<select class="o-nhap" aria-label="Điểm"><option>5</option></select>` : "—"],
          ["Phối hợp", "20%", "4", nguoiCham ? `<select class="o-nhap" aria-label="Điểm"><option>4</option></select>` : "—"], ["Chủ động cải tiến", "10%", "3", nguoiCham ? `<select class="o-nhap" aria-label="Điểm"><option>3</option></select>` : "—"]])}</div>
        ${nguoiCham ? `<div class="the"><h2>Kết quả tạm tính</h2><dl class="thong-tin-dong"><dt>Điểm mục tiêu</dt><dd>3,80</dd><dt>Điểm năng lực</dt><dd>4,20</dd><dt>Điểm tổng</dt><dd>3,96 · Xếp loại B</dd></dl>
          ${vanBan("nhan-xet", "Nhận xét chung", "Hoàn thành tốt việc đóng sổ; cần chủ động hơn trong cải tiến quy trình.")}
          <div class="nhom-nut">${nut("Lưu", "phu", "xu-ly", "Đã lưu.")}${nut("Nộp", "chinh", "xu-ly", "Đã nộp phiếu.")}${vaiTro === "quan-ly" ? nut("Hiệu chỉnh điểm", "phu", "hieu-chinh") : ""}</div></div>`
          : `<div class="khoi-canh-bao thong-tin">Kết quả hiện khi nhân sự công bố kỳ. Sau khi công bố, bạn xác nhận đã xem và có thể ghi ý kiến.</div>
          <div class="the"><h2>Kết quả 6 tháng đầu 2026 (đã công bố)</h2><dl class="thong-tin-dong"><dt>Điểm tổng</dt><dd>3,86 · Xếp loại B</dd><dt>Nhận xét người chấm</dt><dd>Hoàn thành tốt mục tiêu đóng sổ.</dd></dl>
          ${vanBan("y-kien", "Ý kiến của tôi (không bắt buộc)")}${nut("Xác nhận đã xem", "chinh", "xu-ly", "Đã xác nhận đã xem kết quả.")}</div>`}`);
    }
  };

  const TRANG_THAI = {
    "rong": () => `<div class="trang-thai-trong"><h2>Chưa có dữ liệu</h2><p style="margin:0">${ma === "171" ? "Hiện chưa có tin tuyển dụng." : ma === "173" ? "Bạn chưa có phiếu đánh giá nào." : "Chưa có dữ liệu. Bấm nút lập ở trên để bắt đầu."}</p></div>`,
    "dang-tai": () => `<div class="the" aria-busy="true"><p style="margin:0">Đang tải…</p></div>`,
    "loi": () => `<div class="khoi-canh-bao loi">Không tải được dữ liệu. <button type="button" class="nut phu">Thử lại</button></div>`,
    "khong-quyen": () => `<div class="trang-thai-trong"><h2>Bạn không có quyền xem trang này</h2><p style="margin:0">Liên hệ quản trị công ty nếu bạn cần quyền này.</p></div>`
  };

  function veTrang() {
    const khongQuyen = !DUOC_XEM[ma].includes(vaiTro);
    const tt = khongQuyen ? "khong-quyen" : trangThai;
    const ten = { "168": "Nhu cầu tuyển dụng", "169": "Tin tuyển dụng", "170": "Ứng viên", "171": "Tuyển dụng", "172": "Đánh giá hiệu suất", "173": "Phiếu đánh giá" }[ma];
    const html = tt === "du-lieu" ? VE[ma]() : ma === "171" ? `<main class="noi-dung">${tieuDe(ten)}${TRANG_THAI[tt]()}</main>` : trang(`${tieuDe(ten)}${TRANG_THAI[tt]()}`);
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
  const LY_DO_LOAI = ["Không đạt yêu cầu", "Không đạt phỏng vấn", "Từ chối đề nghị", "Không liên lạc được", "Khác"];
  const BIEU_MAU = {
    "nhu-cau": () => ngan("Lập nhu cầu tuyển dụng", `${luaChon("nc-pb", "Phòng ban", ["Kho Bình Dương", "Phòng Kế toán"])}${luaChon("nc-cn", "Chi nhánh làm việc", ["VCR-BD", "VCR-HCM"])}${truong("nc-cd", "Chức danh", "text", "Nhân viên kho")}
      ${truong("nc-sl", "Số lượng", "number", "3")}${luaChon("nc-hd", "Loại hợp đồng dự kiến", ["Thử việc rồi chính thức", "Xác định thời hạn", "Không xác định thời hạn"])}${truong("nc-min", "Lương tối thiểu (đồng)", "text", "8.000.000")}${truong("nc-max", "Lương tối đa (đồng)", "text", "7.000.000", "Lương tối đa phải từ lương tối thiểu trở lên.")}
      ${truong("nc-ngay", "Ngày cần người", "date", "2026-12-01")}${luaChon("nc-ly-do", "Lý do", ["Mở rộng", "Thay thế", "Vị trí mới"])}${vanBan("nc-mo-ta", "Mô tả")}
      <div class="khoi-canh-bao thong-tin">Gửi duyệt theo luồng duyệt của công ty; giá trị duyệt = lương tối đa × số lượng.</div>`, "Lưu nháp", "Đã lưu nhu cầu nháp."),
    "dong-nc": () => ngan("Đóng nhu cầu", `${vanBan("dong-ly-do", "Lý do (bắt buộc)")}<div class="khoi-canh-bao canh-bao">Mọi tin của nhu cầu sẽ đóng; hồ sơ ở giai đoạn Mới, Sàng lọc kết thúc lý do "tin đã đóng".</div>`, "Đóng", "Đã đóng nhu cầu."),
    "sua-tin": () => ngan("Sửa tin tuyển dụng", `${truong("t-td", "Tiêu đề", "text", "Nhân viên kho – Bình Dương")}${truong("t-noi", "Nơi làm việc hiển thị", "text", "Thuận An, Bình Dương")}${luaChon("t-hinh-thuc", "Hình thức", ["Toàn thời gian", "Bán thời gian"])}
      ${vanBan("t-mo-ta", "Mô tả công việc", "Nhận, xuất hàng theo phiếu…")}${vanBan("t-yc", "Yêu cầu")}${vanBan("t-ql", "Quyền lợi")}${luaChon("t-luong", "Hiển thị lương", ["Theo khoảng của nhu cầu (8 – 10 triệu)", "Khoảng nhập riêng", "Thỏa thuận"])}
      ${truong("t-han", "Hạn nộp", "date", "2026-11-30")}${truong("t-email", "Email liên hệ tuyển dụng", "email", "tuyendung@vcr.vcomm.vn")}<div class="truong"><label><input type="checkbox" checked> Đăng trên trang tuyển dụng công khai</label></div>`, "Lưu", "Đã lưu tin."),
    "them-uv": () => ngan("Thêm ứng viên", `${luaChon("uv-tin", "Tin tuyển dụng", ["Nhân viên kho – Bình Dương"])}${truong("uv-ten", "Họ và tên", "text")}${truong("uv-email", "Email", "email")}${truong("uv-dt", "Điện thoại", "tel")}
      ${luaChon("uv-nguon", "Nguồn", ["Giới thiệu nội bộ", "Trang việc làm", "Email", "Khác"])}${truong("uv-ghi", "Ghi chú nguồn", "text")}<div class="truong"><label for="uv-cv">Sơ yếu lý lịch (PDF, DOCX)</label><input id="uv-cv" type="file" class="o-nhap"></div>
      <div class="truong"><label for="uv-dy">Bằng chứng đồng ý tuyển dụng (bắt buộc; PDF, JPG, PNG)</label><input id="uv-dy" type="file" class="o-nhap"></div>${truong("uv-ngay", "Ngày đồng ý", "date", "2026-11-08")}
      <div class="khoi-canh-bao thong-tin">Nghị định 356/2025/NĐ-CP Điều 6: công ty phải lưu bằng chứng ứng viên đã đồng ý (văn bản, ảnh chụp email hoặc tin nhắn đồng ý).</div>`, "Lưu", "Đã thêm ứng viên."),
    "tu-kho": () => ngan("Thêm từ kho ứng viên", `${luaChon("k-uv", "Ứng viên trong kho", ["Phan Thu Hà · kho đến 12/11/2027"])}${luaChon("k-tin", "Vào tin", ["Kế toán tổng hợp"])}`, "Thêm", "Đã thêm hồ sơ ứng tuyển."),
    "cai-dat": () => ngan("Cài đặt lưu giữ dữ liệu ứng viên", `${truong("cd-ngay", "Số ngày giữ sau khi không tuyển (0 đến 90)", "number", "30")}${truong("cd-thang", "Số tháng giữ trong kho ứng viên (1 đến 24)", "number", "12")}
      <div class="khoi-canh-bao canh-bao">Luật 91/2025/QH15 Điều 25 khoản 1 điểm c: phải xóa thông tin người dự tuyển khi không tuyển dụng, trừ khi có thỏa thuận. Thời hạn mới áp dụng khi tính lại ngày xóa.</div>`, "Lưu", "Đã lưu cài đặt."),
    "giai-doan": () => ngan("Chuyển giai đoạn", `${luaChon("gd", "Giai đoạn", ["Mới", "Sàng lọc", "Phỏng vấn"])}<span class="chu-thich">"Đề nghị", "Nhận việc" chuyển tự động theo đề nghị nhận việc.</span>`, "Chuyển", "Đã chuyển giai đoạn."),
    "vong-pv": () => ngan("Lập vòng phỏng vấn", `${truong("pv-ten", "Tên vòng", "text", "Phỏng vấn chuyên môn")}${truong("pv-luc", "Thời điểm", "datetime-local", "2026-11-13T09:00")}${truong("pv-phut", "Thời lượng (phút)", "number", "60")}
      ${luaChon("pv-hinh-thuc", "Hình thức", ["Trực tiếp", "Trực tuyến"])}${truong("pv-dia-diem", "Địa điểm hoặc liên kết", "text", "Kho VCR-BD, cổng số 2")}${luaChon("pv-nguoi", "Người phỏng vấn (1 đến 5)", ["Phạm Văn Đức", "Lê Thu"])}
      <div class="truong"><label><input type="checkbox" checked> Gửi email mời phỏng vấn cho ứng viên</label></div>${vanBan("pv-loi-nhan", "Lời nhắn thêm (không bắt buộc)", "Vui lòng mang theo bản sao bằng cấp.")}`, "Lưu và gửi", "Đã lập vòng phỏng vấn, đã gửi email mời."),
    "danh-gia-pv": () => ngan("Phiếu đánh giá phỏng vấn", `${luaChon("dg-diem", "Điểm (1 đến 5)", ["4", "1", "2", "3", "5"])}${luaChon("dg-de-xuat", "Đề xuất", ["Đạt", "Cân nhắc", "Không đạt"])}${vanBan("dg-nhan-xet", "Nhận xét")}`, "Nộp", "Đã nộp phiếu đánh giá."),
    "de-nghi": () => thongBao("Mở thẻ Đề nghị nhận việc."),
    "loai": () => ngan("Loại ứng viên", `${luaChon("loai-ly-do", "Lý do", LY_DO_LOAI)}<div class="truong"><label><input type="checkbox" checked> Gửi email báo kết quả</label></div>${vanBan("loai-loi-nhan", "Lời nhắn thêm")}
      <div class="khoi-canh-bao thong-tin">Không còn hồ sơ đang xử lý: dữ liệu tự xóa sau 30 ngày (14/12/2026), trừ khi ứng viên đồng ý vào kho ứng viên.</div>`, "Loại", "Đã loại, đã gửi email kết quả."),
    "yeu-cau-xoa": () => ngan("Ghi yêu cầu xóa của ứng viên", `${truong("x-ngay", "Ngày nhận yêu cầu", "date", "2026-11-11")}${luaChon("x-kenh", "Kênh", ["Email", "Điện thoại", "Trực tiếp", "Khác"])}<div class="truong"><label for="x-tep">Tệp bằng chứng (không bắt buộc)</label><input id="x-tep" type="file" class="o-nhap"></div>
      <div class="khoi-canh-bao loi">Xóa ngay, không khôi phục: hồ sơ đang xử lý kết thúc "ứng viên rút", đề nghị chưa kết thúc bị hủy, xóa tệp và dữ liệu định danh.</div>`, "Xóa dữ liệu", "Đã xóa dữ liệu ứng viên."),
    "dong-y-kho": () => ngan("Ghi đồng ý kho ứng viên", `<div class="truong"><label for="k-tep">Bằng chứng đồng ý (bắt buộc)</label><input id="k-tep" type="file" class="o-nhap"></div>${truong("k-ngay", "Ngày đồng ý", "date", "2026-11-11")}`, "Lưu", "Đã ghi đồng ý. Ngày xóa dự kiến 11/11/2027."),
    "email-dn": () => ngan("Gửi thư đề nghị nhận việc", `<div class="khoi-canh-bao thong-tin">Tới: mai.tran@example.com · Tiếng Việt</div><div class="the"><strong>VComm Bán lẻ Miền Nam gửi đề nghị nhận việc: Nhân viên kho</strong><p>Chức danh Nhân viên kho, Kho Bình Dương; mức lương 10.500.000 đồng/tháng; ngày bắt đầu 01/12/2026. Vui lòng trả lời trước 20/11/2026.</p></div>${vanBan("e-loi-nhan", "Lời nhắn thêm")}`, "Gửi", "Đã gửi thư đề nghị."),
    "tra-loi": () => ngan("Ghi trả lời của ứng viên", `${luaChon("tl", "Trả lời", ["Chấp nhận", "Từ chối"])}${truong("tl-ngay", "Ngày trả lời", "date", "2026-11-15")}`, "Lưu", "Ứng viên chấp nhận. Hồ sơ chuyển giai đoạn Nhận việc."),
    "lap-ho-so": () => thongBao("Mở biểu mẫu hồ sơ nhân sự (MAN_HINH_115) đã điền sẵn."),
    "ky": () => ngan("Lập kỳ đánh giá", `${truong("ky-ten", "Tên kỳ", "text", "Năm 2026")}${truong("ky-tu", "Từ ngày", "date", "2026-01-01")}${truong("ky-den", "Đến ngày", "date", "2026-12-31")}${luaChon("ky-mau", "Mẫu đánh giá", ["Năng lực khối văn phòng"])}
      ${truong("ky-muc-tieu", "Tỷ trọng mục tiêu (%)", "number", "60")}${truong("ky-nang-luc", "Tỷ trọng năng lực (%)", "number", "30", "Tỷ trọng mục tiêu và năng lực phải cộng bằng 100.")}
      ${truong("ky-a", "Ngưỡng A", "text", "4,50")}${truong("ky-b", "Ngưỡng B", "text", "3,50")}${truong("ky-c", "Ngưỡng C", "text", "2,50")}${truong("ky-h1", "Hạn đặt mục tiêu", "date")}${truong("ky-h2", "Hạn tự đánh giá", "date")}${truong("ky-h3", "Hạn người quản lý chấm", "date")}
      ${luaChon("ky-doi-tuong", "Đối tượng", ["Mọi phòng ban", "Chọn phòng ban"])}`, "Lưu nháp", "Đã lưu kỳ nháp."),
    "mau": () => ngan("Mẫu đánh giá", `${truong("m-ten", "Tên mẫu", "text", "Năng lực khối kho vận")}${bang(["Tiêu chí", "Trọng số (%)"], [["An toàn lao động", "30"], ["Chính xác số liệu", "30"], ["Chuyên cần", "20"], ["Phối hợp", "10"]])}<span class="loi-o">Tổng trọng số đang là 90%, phải bằng 100%.</span>${nut("Thêm tiêu chí", "phu", "xu-ly", "Đã thêm dòng.")}`, "Lưu", "Đã lưu mẫu."),
    "chot": () => ngan("Chốt kỳ", `<div class="khoi-canh-bao loi">Còn 24 phiếu chưa nộp. Chỉ chốt được khi mọi phiếu đã nộp hoặc đã loại khỏi kỳ (có lý do).</div>`, "Đã hiểu", "Chưa chốt được kỳ."),
    "hieu-chinh": () => ngan("Hiệu chỉnh điểm", `${truong("hc-diem", "Điểm tổng sau hiệu chỉnh (1,00 đến 5,00)", "text", "4,10")}${vanBan("hc-ly-do", "Lý do (bắt buộc)", "Cân bằng giữa các phòng ban theo họp hiệu chỉnh 18/12.")}<span class="chu-thich">Xếp loại theo điểm hiệu chỉnh: B. Hiệu chỉnh được ghi nhật ký.</span>`, "Lưu", "Đã hiệu chỉnh.")
  };

  document.addEventListener("click", e => {
    const b = e.target.closest("[data-buoc]");
    if (b) { e.preventDefault(); buoc = b.dataset.buoc; veTrang(); window.scrollTo(0, 0); return; }
    const the = e.target.closest("[data-the]");
    if (the) {
      const nhom = the.dataset.the.startsWith("c") ? "c" : "";
      document.querySelectorAll("[data-the]").forEach(x => { if (x.dataset.the.startsWith("c") === (nhom === "c")) x.classList.toggle("chon", x === the); });
      document.querySelectorAll("[data-noi-dung-the]").forEach(k => { if (k.dataset.noiDungThe.startsWith("c") === (nhom === "c")) k.hidden = k.dataset.noiDungThe !== the.dataset.the; });
      return;
    }
    const n = e.target.closest("[data-hanh-dong]"); if (!n || n.disabled) return;
    const hd = n.dataset.hanhDong;
    if (hd === "chi-tiet-nc") { e.preventDefault(); document.getElementById("chi-tiet-nc")?.scrollIntoView(); return; }
    if (hd === "xu-ly") { e.preventDefault(); n.classList.add("dang-xu-ly"); n.disabled = true; setTimeout(() => { n.classList.remove("dang-xu-ly"); n.disabled = false; thongBao(n.dataset.thongBao || "Đã lưu."); }, 700); return; }
    if (BIEU_MAU[hd]) { e.preventDefault(); BIEU_MAU[hd](); }
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
  dk.querySelector("#dk-vai-tro").addEventListener("change", e => { vaiTro = e.target.value; ghi("ban-mau-td-vai-tro", vaiTro); veTrang(); });
  dk.querySelector("#dk-trang-thai").addEventListener("change", e => { trangThai = e.target.value; ghi("ban-mau-td-trang-thai", trangThai); veTrang(); });
  veTrang();
})();
