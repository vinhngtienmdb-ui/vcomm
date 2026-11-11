// Bản mẫu MODULE_13 Văn phòng số (CONG_VIEC_52): MAN_HINH_153 đến MAN_HINH_160 từ dữ liệu giả. Không phải mã sản phẩm.
(function () {
  const TEP = {
    "153": "DANH_SACH_CONG_VIEC", "154": "CHI_TIET_CONG_VIEC", "155": "MAU_QUY_TRINH", "156": "PHIEN_QUY_TRINH",
    "157": "CONG_VAN_DEN", "158": "CONG_VAN_DI", "159": "BANG_TIN", "160": "CAI_DAT_VAN_THU"
  };
  const duongDan = ma => `MAN_HINH_${ma}_${TEP[ma]}.html`;
  const VAI_TRO = {
    "nhan-vien": "Nhân viên", "lanh-dao": "Lãnh đạo (giao xử lý, xem mọi việc, thiết kế quy trình)", "van-thu": "Văn thư",
    "quan-tri": "Quản trị công ty", "cong-ty-khac": "Nhân viên công ty khác được giao việc"
  };
  // Bảng vai trò – màn hình (CONG_VIEC_52 mục 8).
  const DUOC_XEM = {
    "153": ["nhan-vien", "lanh-dao", "van-thu", "quan-tri", "cong-ty-khac"], "154": ["nhan-vien", "lanh-dao", "van-thu", "quan-tri", "cong-ty-khac"],
    "155": ["lanh-dao", "quan-tri"], "156": ["nhan-vien", "lanh-dao", "van-thu", "quan-tri"],
    "157": ["lanh-dao", "van-thu", "quan-tri", "nhan-vien"], "158": ["nhan-vien", "lanh-dao", "van-thu", "quan-tri"],
    "159": ["nhan-vien", "lanh-dao", "van-thu", "quan-tri", "cong-ty-khac"], "160": ["van-thu", "quan-tri"]
  };
  const MENU = [["153", "Công việc"], ["156", "Quy trình"], ["155", "Mẫu quy trình"], ["157", "Công văn đến"], ["158", "Công văn đi"], ["159", "Bảng tin"], ["160", "Cài đặt văn thư"]];
  const doc = (khoa, macDinh) => { try { return localStorage.getItem(khoa) || macDinh; } catch (e) { return macDinh; } };
  const ghi = (khoa, giaTri) => { try { localStorage.setItem(khoa, giaTri); } catch (e) { /* bỏ qua */ } };
  const ma = document.body.dataset.manHinh;
  let vaiTro = doc("ban-mau-vp-vai-tro", "nhan-vien");
  let trangThai = doc("ban-mau-vp-trang-thai", "du-lieu");
  const co = {
    xemTatCa: () => ["lanh-dao", "quan-tri"].includes(vaiTro), vanThu: () => ["van-thu", "quan-tri"].includes(vaiTro),
    lanhDao: () => ["lanh-dao", "quan-tri"].includes(vaiTro), dangTin: () => ["van-thu", "quan-tri"].includes(vaiTro)
  };
  const congTy = () => vaiTro === "cong-ty-khac" ? "VComm Logistics" : "VComm Bán lẻ Miền Nam";

  const thanhTren = () => `<header class="thanh-tren"><a class="logo" href="#">VComm</a><a href="#">Trang chủ</a><span class="gian"></span>
    <button type="button" aria-label="Chọn công ty">${congTy()} ▾</button><a href="#">Hộp duyệt <span class="huy-hieu">1</span></a>
    <button type="button">Thông báo <span class="huy-hieu">4</span></button><a href="#">${vaiTro === "cong-ty-khac" ? "Võ Thành Đạt" : "Nguyễn Thị Hồng Nhung"} ▾</a></header>`;
  const chonMenu = m => m === ma || (ma === "154" && m === "153");
  const menu = () => `<nav class="menu" aria-label="Văn phòng số"><div class="ten-app">Văn phòng số</div>${MENU.filter(([m]) => DUOC_XEM[m].includes(vaiTro)).map(([m, t]) =>
    `<a href="${duongDan(m)}" class="${chonMenu(m) ? "chon" : ""}">${t}</a>`).join("")}</nav>`;
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
  const vungChu = (id, nhanChu, giaTri, dong) => `<div class="truong"><label for="${id}">${nhanChu}</label><textarea id="${id}" class="o-nhap" rows="${dong || 3}">${giaTri || ""}</textarea></div>`;
  const cacThe = (ten, chon) => `<div class="cac-the" role="tablist">${ten.map((t, i) => `<button type="button" role="tab" data-the="${i}" class="${i === (chon || 0) ? "chon" : ""}">${t}</button>`).join("")}</div>`;
  const noiDungThe = (i, html, an) => `<div data-noi-dung-the="${i}" ${an ? "hidden" : ""}>${html}</div>`;
  const boLoc = cacO => `<div class="bo-loc">${cacO}</div>`;
  const oTim = goiY => `<label class="an-nhan" for="tim">Tìm</label><input id="tim" class="o-nhap" placeholder="${goiY}">`;
  const chonLoc = (nhanChu, cacGiaTri) => `<select class="o-nhap" aria-label="${nhanChu}">${cacGiaTri.map(g => `<option>${g}</option>`).join("")}</select>`;

  const TRANG_THAI_VIEC = { moi: nhan("Mới", "thong-tin"), lam: nhan("Đang làm", "thong-tin"), cho: nhan("Chờ xác nhận", "canh-bao"), xong: nhan("Hoàn thành", "thanh-cong"), huy: nhan("Đã hủy", "trung-tinh") };
  const QUA_HAN = nhan("Quá hạn", "loi");
  const UU_TIEN = { thap: "Thấp", tb: "Bình thường", cao: nhan("Cao", "canh-bao"), khan: nhan("Khẩn", "loi") };
  const tienDo = p => `<span aria-label="Tiến độ ${p}%">${p}%</span>`;
  const linkViec = t => `<a href="${duongDan("154")}">${t}</a>`;

  const VIEC_CUA_TOI = [
    [linkViec("Chuẩn bị hồ sơ đấu thầu gói vận chuyển Quý 1"), "", "Nguyễn Thị Hồng Nhung", "13/11/2026 17:00", UU_TIEN.cao, tienDo(60), TRANG_THAI_VIEC.lam],
    [linkViec("Trả lời công văn 125/TCT-KK về hóa đơn"), "", "Nguyễn Thị Hồng Nhung", "10/11/2026 17:00", UU_TIEN.khan, tienDo(30), `${TRANG_THAI_VIEC.lam} ${QUA_HAN}`],
    [linkViec("QT2026-00012 · Trưởng phòng xem xét"), "", "Chưa nhận (vai trò Trưởng phòng Hành chính)", "14/11/2026 09:30", UU_TIEN.tb, tienDo(0), TRANG_THAI_VIEC.moi],
    [linkViec("Đối soát kho Bình Dương tháng 10"), nhan("VComm Logistics", "trung-tinh"), "Võ Thành Đạt", "20/11/2026 17:00", UU_TIEN.tb, tienDo(100), TRANG_THAI_VIEC.cho]
  ];

  const VE = {
    "153": () => trang(`${tieuDe("Công việc", nut("Giao việc", "chinh", "giao-viec"))}
      ${cacThe(["Việc của tôi", "Tôi giao", "Theo dõi", ...(co.xemTatCa() ? ["Của công ty"] : [])])}
      ${boLoc(`${oTim("Tìm theo tiêu đề…")}${chonLoc("Trạng thái", ["Chưa xong", "Mới", "Đang làm", "Chờ xác nhận", "Hoàn thành", "Đã hủy", "Tất cả"])}
        ${chonLoc("Hạn", ["Hạn: tất cả", "Quá hạn", "Hôm nay", "Tuần này"])}${chonLoc("Ưu tiên", ["Ưu tiên: tất cả", "Khẩn", "Cao", "Bình thường", "Thấp"])}`)}
      ${vaiTro === "cong-ty-khac"
        ? `<div class="khoi-canh-bao thong-tin">Việc được giao từ công ty khác trong tập đoàn hiện ở đây dù bạn đang chọn công ty nào.</div>${bang(["Tiêu đề", "Công ty giao", "Chủ trì", "Hạn", "Ưu tiên", "Tiến độ", "Trạng thái"],
          [[linkViec("Đối soát kho Bình Dương tháng 10"), "VComm Bán lẻ Miền Nam", "Võ Thành Đạt", "20/11/2026 17:00", UU_TIEN.tb, tienDo(80), TRANG_THAI_VIEC.lam]], "1 việc")}`
        : bang(["Tiêu đề", "Công ty", "Chủ trì", "Hạn", "Ưu tiên", "Tiến độ", "Trạng thái"], VIEC_CUA_TOI, "4 việc chưa xong")}`),

    "154": () => {
      const chuTri = vaiTro !== "lanh-dao";
      const cacNut = vaiTro === "cong-ty-khac" ? `${nut("Báo xong", "chinh", "bao-xong")}` :
        chuTri ? `${nut("Báo xong", "chinh", "bao-xong")}${nut("Cập nhật tiến độ", "phu", "tien-do")}` : `${nut("Sửa", "phu", "giao-viec")}${nut("Hủy việc", "nguy-hiem", "huy-viec")}`;
      return trang(`${tieuDe(`Đối soát kho Bình Dương tháng 10 ${TRANG_THAI_VIEC.lam}`, cacNut)}
      <div class="the"><dl class="thong-tin-dong"><dt>Công ty</dt><dd>VComm Bán lẻ Miền Nam</dd><dt>Người giao</dt><dd>Nguyễn Thị Hồng Nhung · Phòng Kho vận</dd>
        <dt>Chủ trì</dt><dd>Võ Thành Đạt · VComm Logistics ${nhan("Công ty khác", "trung-tinh")}</dd><dt>Phối hợp</dt><dd>Phạm Gia Huy</dd><dt>Theo dõi</dt><dd>Trần Văn Lâm (Giám đốc)</dd>
        <dt>Bắt đầu</dt><dd>01/11/2026</dd><dt>Hạn</dt><dd>20/11/2026 17:00</dd><dt>Ưu tiên</dt><dd>Bình thường</dd><dt>Tiến độ</dt><dd>80%</dd><dt>Liên kết</dt><dd>Công văn đến số 245 (<a href="${duongDan("157")}">125/TCT-KK</a>)</dd></dl></div>
      ${cacThe(["Trao đổi", "Việc con", "Tệp", "Lịch sử"])}
      ${noiDungThe(0, `<div class="the"><ol class="dong-thoi-gian">
        <li class="xong"><span class="cham">N</span><div><strong>Nguyễn Thị Hồng Nhung · 02/11/2026 08:15</strong><div>Anh Đạt đối chiếu giúp số liệu tồn cuối kỳ với biên bản kiểm kê ngày 31/10.</div></div></li>
        <li class="xong"><span class="cham">Đ</span><div><strong>Võ Thành Đạt · 05/11/2026 16:40</strong> <span class="chu-thich">đã sửa</span><div>Đã đối chiếu xong 3 kho, còn kho lạnh. Lệch 2 thùng sữa, đính kèm bảng.</div></div></li>
        <li><span class="cham">P</span><div><span class="chu-thich">Bình luận đã xóa</span></div></li></ol>
        ${vungChu("binh-luan", "Viết bình luận", "", 2)}<div class="nhom-nut">${nut("Gửi", "chinh", "xu-ly", "Đã gửi bình luận. Người tham gia nhận thông báo.")}</div></div>`)}
      ${noiDungThe(1, `<div class="the"><div class="tieu-de"><h2>Việc con</h2>${vaiTro !== "cong-ty-khac" ? nut("Thêm việc con", "phu", "giao-viec") : ""}</div>
        ${bang(["Tiêu đề", "Chủ trì", "Hạn", "Trạng thái"], [[linkViec("Kiểm kho lạnh"), "Phạm Gia Huy", "18/11/2026", TRANG_THAI_VIEC.lam], [linkViec("Lập biên bản chênh lệch"), "Võ Thành Đạt", "19/11/2026", TRANG_THAI_VIEC.moi]])}
        <span class="chu-thich">Việc cha chỉ báo xong được khi mọi việc con đã hoàn thành hoặc hủy.</span></div>`, true)}
      ${noiDungThe(2, `<div class="the"><div class="tieu-de"><h2>Tệp</h2>${nut("Tải tệp lên", "phu", "tai-len")}</div>
        ${bang(["Tên tệp", "Kích thước", "Tải lên", ""], [["bang-doi-soat-T10.xlsx", "86 KB", "Võ Thành Đạt · 05/11/2026", nut("Tải xuống", "phu", "xu-ly", "Đã tải tệp.")], ["bien-ban-kiem-ke-31-10.pdf", "1,4 MB", "Nguyễn Thị Hồng Nhung · 02/11/2026", nut("Tải xuống", "phu", "xu-ly", "Đã tải tệp.")]])}</div>`, true)}
      ${noiDungThe(3, `<div class="the"><ol class="dong-thoi-gian"><li class="xong"><span class="cham">3</span><div><strong>05/11/2026 16:41 · Võ Thành Đạt</strong><div>Tiến độ 30% → 80%; tải lên bang-doi-soat-T10.xlsx</div></div></li>
        <li class="xong"><span class="cham">2</span><div><strong>02/11/2026 09:00 · Võ Thành Đạt</strong><div>Trạng thái Mới → Đang làm</div></div></li><li class="xong"><span class="cham">1</span><div><strong>01/11/2026 17:20 · Nguyễn Thị Hồng Nhung</strong><div>Lập việc</div></div></li></ol></div>`, true)}`);
    },

    "155": () => trang(`${tieuDe("Mẫu quy trình: Mua văn phòng phẩm · phiên bản 2 (nháp)", `${nut("Kiểm tra", "phu", "xu-ly", "Mẫu hợp lệ.")}${nut("Kích hoạt", "chinh", "xu-ly", "Đã kích hoạt phiên bản 2. Phiên đang chạy giữ phiên bản 1.")}`)}
      ${cacThe(["Thiết kế", "Danh sách mẫu"])}
      ${noiDungThe(0, `<div class="khoi-canh-bao loi">Chưa kích hoạt được: bước "Kế toán thanh toán" không có đường tới Kết thúc. Kết quả "Không đồng ý" của bước "Giám đốc duyệt" chưa có quy tắc phủ (thêm dòng "Trường hợp còn lại").</div>
      <div class="the"><h2>Thông tin</h2><div class="hai-cot">${truong("ten-mau", "Tên mẫu", "text", "Mua văn phòng phẩm")}${luaChon("ai-khoi-tao", "Ai được khởi tạo", ["Mọi người trong công ty", "Theo phòng ban được chọn"])}</div>
        ${vungChu("mo-ta-mau", "Mô tả", "Đề nghị mua văn phòng phẩm, mực in, giấy.", 2)}</div>
      <div class="the"><div class="tieu-de"><h2>Biểu mẫu khởi tạo</h2>${nut("Thêm trường", "phu", "them-truong")}</div>
        ${bang(["Khóa", "Nhãn", "Kiểu", "Bắt buộc"], [["noi_dung", "Nội dung cần mua", "Văn bản", "Có"], ["so_tien", "Số tiền dự kiến (đồng)", "Số", "Có"], ["nguoi_nhan", "Người nhận hàng", "Người dùng", "Không"]])}</div>
      <div class="the"><div class="tieu-de"><h2>Bước</h2>${nut("Thêm bước", "phu", "them-buoc")}</div>
        <ol class="dong-thoi-gian">
          <li class="xong"><span class="cham">1</span><div><strong>Trưởng phòng xem xét</strong> ${nhan("Bước đầu", "thong-tin")}<div>Người thực hiện: trưởng phòng của người khởi tạo · 2 ngày · Kết quả: Đồng ý, Không đồng ý</div>
            <div class="chu-thich">1. Đồng ý và Số tiền dự kiến &gt; 5.000.000 → Giám đốc duyệt<br>2. Đồng ý → Hành chính mua<br>3. Trường hợp còn lại → Kết thúc</div>${nut("Sửa bước", "phu", "them-buoc")}</div></li>
          <li class="xong"><span class="cham">2</span><div><strong>Giám đốc duyệt</strong><div>Người thực hiện: vai trò Giám đốc · 2 ngày · Kết quả: Đồng ý, Không đồng ý</div>
            <div class="chu-thich">1. Đồng ý → Hành chính mua và Kế toán thanh toán (song song)<br>${nhan("Thiếu dòng Trường hợp còn lại", "loi")}</div>${nut("Sửa bước", "phu", "them-buoc")}</div></li>
          <li class="xong"><span class="cham">3</span><div><strong>Hành chính mua</strong><div>Người thực hiện: vai trò Nhân viên hành chính (người đầu tiên bấm Nhận việc) · 3 ngày · Kết quả: Hoàn thành</div><div class="chu-thich">1. Trường hợp còn lại → Nhận hàng (gộp)</div></div></li>
          <li class="xong"><span class="cham">4</span><div><strong>Kế toán thanh toán</strong><div>Người thực hiện: người cụ thể Lê Thị Bích Ngọc · 3 ngày · Kết quả: Hoàn thành</div><div class="chu-thich">${nhan("Không có quy tắc chuyển", "loi")}</div></div></li>
          <li class="xong"><span class="cham">5</span><div><strong>Nhận hàng</strong> ${nhan("Gộp", "trung-tinh")}<div>Người thực hiện: trường "Người nhận hàng" · 1 ngày · Kết quả: Đã nhận</div><div class="chu-thich">1. Trường hợp còn lại → Kết thúc</div></div></li>
        </ol></div>
      <div class="the"><h2>Sơ đồ luồng (tự vẽ, chỉ xem)</h2>${soDo([])}</div>`)}
      ${noiDungThe(1, `${bang(["Tên mẫu", "Phiên bản đang dùng", "Phiên đang chạy", "Trạng thái", ""], [
        ["Mua văn phòng phẩm", "1 (có bản nháp 2)", "3", nhan("Đang dùng", "thanh-cong"), nut("Ngừng dùng", "phu", "xu-ly", "Đã ngừng dùng. Phiên đang chạy vẫn chạy tiếp.")],
        ["Đề nghị công tác", "—", "0", nhan("Nháp", "trung-tinh"), ""], ["Tiếp nhận nhân viên mới", "3", "1", nhan("Đang dùng", "thanh-cong"), ""]], "3 mẫu")}`, true)}`),

    "156": () => trang(`${tieuDe(`QT2026-00012 · Mua văn phòng phẩm ${nhan("Đang chạy", "thong-tin")}`, `${nut("Khởi tạo quy trình", "chinh", "khoi-tao")}${co.lanhDao() ? nut("Hủy phiên", "nguy-hiem", "huy-viec") : ""}`)}
      ${cacThe(["Chi tiết phiên", "Danh sách"])}
      ${noiDungThe(0, `<div class="hai-cot"><div class="the"><h2>Biểu mẫu khởi tạo</h2><dl class="thong-tin-dong"><dt>Người khởi tạo</dt><dd>Phạm Gia Huy · 11/11/2026 09:30</dd>
        <dt>Nội dung cần mua</dt><dd>Giấy A4 20 ram, mực máy in HP 4 hộp</dd><dt>Số tiền dự kiến</dt><dd>7.200.000&nbsp;đ</dd><dt>Người nhận hàng</dt><dd>Phạm Gia Huy</dd><dt>Mẫu</dt><dd>Mua văn phòng phẩm · phiên bản 1</dd></dl></div>
        <div class="the"><h2>Các bước</h2>${bang(["Bước", "Việc", "Người thực hiện", "Kết quả"], [
          ["Trưởng phòng xem xét", linkViec("Xong 11/11 14:00"), "Trần Văn Lâm", nhan("Đồng ý", "thanh-cong")],
          ["Giám đốc duyệt", linkViec("Đang làm, hạn 13/11"), "Nguyễn Văn An", "—"]])}</div></div>
      <div class="the"><h2>Sơ đồ</h2>${soDo(["tp"], ["gd"])}<span class="chu-thich">Xanh: đã xong · Viền đậm: đang mở · Xám: chưa đến.</span></div>
      <div class="khoi-canh-bao canh-bao">Ví dụ phiên bị chặn: bước "Hành chính mua" không xác định được người thực hiện (vai trò Nhân viên hành chính không ai giữ). ${co.lanhDao() ? nut("Chỉ định người thực hiện", "phu", "chi-dinh") : "Đã báo người khởi tạo và người quản lý quy trình."}</div>`)}
      ${noiDungThe(1, `${boLoc(`${oTim("Số phiên, tiêu đề…")}${chonLoc("Phạm vi", ["Tôi khởi tạo", "Tôi tham gia", ...(co.xemTatCa() ? ["Cả công ty"] : [])])}${chonLoc("Trạng thái", ["Trạng thái: tất cả", "Đang chạy", "Bị chặn", "Hoàn thành", "Đã hủy"])}`)}
        ${bang(["Số", "Mẫu", "Tiêu đề", "Bước đang mở", "Bắt đầu", "Trạng thái"], [
          ["QT2026-00012", "Mua văn phòng phẩm", "Giấy, mực tháng 11", "Giám đốc duyệt", "11/11/2026", nhan("Đang chạy", "thong-tin")],
          ["QT2026-00011", "Tiếp nhận nhân viên mới", "Phạm Gia Huy", "—", "03/11/2026", nhan("Bị chặn", "loi")],
          ["QT2026-00009", "Mua văn phòng phẩm", "Bút, sổ quý 4", "—", "20/10/2026", nhan("Hoàn thành", "thanh-cong")]], "3 phiên")}`, true)}`),

    "157": () => trang(`${tieuDe("Công văn đến", `${co.vanThu() ? `${nut("Vào sổ", "chinh", "vao-so")}${nut("Xuất sổ", "phu", "xu-ly", "Đã xuất sổ công văn đến năm 2026 ra Excel.")}` : ""}`)}
      ${cacThe(["Sổ", "Chi tiết", ...(co.vanThu() ? ["Chờ vào sổ (liên công ty) 1"] : [])])}
      ${noiDungThe(0, `${boLoc(`${chonLoc("Sổ", ["Sổ công văn đến", "Sổ Hội đồng quản trị"])}${chonLoc("Năm", ["2026", "2025"])}${oTim("Số đến, nơi gửi, trích yếu…")}${chonLoc("Trạng thái", ["Trạng thái: tất cả", "Chờ trình", "Chờ ý kiến", "Đang xử lý", "Đã xử lý", "Đã lưu", "Đã hủy vào sổ"])}${chonLoc("Độ khẩn", ["Độ khẩn: tất cả", "Hỏa tốc", "Thượng khẩn", "Khẩn"])}`)}
        ${bang(["Số đến", "Ngày đến", "Nơi gửi", "Số ký hiệu", "Ngày văn bản", "Trích yếu", "Độ khẩn", "Xử lý", "Hạn", "Trạng thái"], [
          ["245", "09/11/2026", "Cục Thuế TP. Hồ Chí Minh", "125/TCT-KK", "06/11/2026", `<a href="#" data-the-den="1">V/v rà soát hóa đơn điện tử quý 3</a>`, nhan("Khẩn", "canh-bao"), "Lê Thị Bích Ngọc", "15/11/2026", nhan("Đang xử lý", "thong-tin")],
          ["244", "09/11/2026", "VComm Logistics", "38/VCL-KV", "08/11/2026", "V/v lịch kiểm kê cuối năm", "Thường", "—", "—", nhan("Chờ ý kiến", "canh-bao")],
          ["243", "08/11/2026", "Ngân hàng Vietcombank", "1021/VCB-CN", "05/11/2026", "Thông báo đổi biểu phí", "Thường", "—", "—", nhan("Đã lưu", "trung-tinh")],
          ["242", "07/11/2026", "Sở Công Thương", "88/SCT-QLTM", "04/11/2026", "V/v báo cáo khuyến mại", nhan("Hỏa tốc", "loi"), "Trần Minh Khoa", "08/11/2026", nhan("Đã xử lý", "thanh-cong")],
          ["241", "06/11/2026", "Công ty Minh Phát", "—", "05/11/2026", "Nhập nhầm", "Thường", "—", "—", `${nhan("Đã hủy vào sổ", "trung-tinh")} <span class="chu-thich">trùng số 240</span>`]], "245 công văn năm 2026")}`)}
      ${noiDungThe(1, `<div class="tieu-de"><h2>Số đến 245 · 125/TCT-KK ${nhan("Khẩn", "canh-bao")} ${nhan("Chờ ý kiến", "canh-bao")}</h2><div class="nhom-nut">
        ${co.lanhDao() ? `${nut("Cho ý kiến và giao xử lý", "chinh", "giao-xu-ly")}${nut("Chuyển lãnh đạo khác", "phu", "trinh")}${nut("Lưu, không cần xử lý", "phu", "xu-ly", "Đã lưu công văn.")}` : ""}
        ${co.vanThu() ? `${nut("Trình", "phu", "trinh")}${nut("Hủy vào sổ", "nguy-hiem", "huy-viec")}` : ""}</div></div>
        <div class="hai-cot"><div class="the"><dl class="thong-tin-dong"><dt>Sổ</dt><dd>Sổ công văn đến 2026</dd><dt>Ngày đến</dt><dd>09/11/2026</dd><dt>Nơi gửi</dt><dd>Cục Thuế TP. Hồ Chí Minh</dd>
          <dt>Số ký hiệu</dt><dd>125/TCT-KK</dd><dt>Ngày văn bản</dt><dd>06/11/2026</dd><dt>Loại</dt><dd>Công văn</dd><dt>Trích yếu</dt><dd>V/v rà soát hóa đơn điện tử quý 3</dd><dt>Hạn xử lý</dt><dd>15/11/2026</dd><dt>Phương thức nhận</dt><dd>Giấy</dd>
          <dt>Tệp</dt><dd><a href="#">cv-125-tct-kk.pdf</a> (2 trang)</dd></dl></div>
          <div class="the"><h2>Trình và ý kiến</h2><ol class="dong-thoi-gian"><li class="xong"><span class="cham">1</span><div><strong>09/11 08:40 · Văn thư Mai Anh</strong><div>Vào sổ, trình Giám đốc Nguyễn Văn An</div></div></li>
            <li class="cho"><span class="cham">2</span><div><strong>Chờ ý kiến · Nguyễn Văn An</strong></div></li></ol></div></div>`, true)}
      ${noiDungThe(2, `${bang(["Công ty gửi", "Số ký hiệu", "Ngày văn bản", "Trích yếu", ""], [["VComm Logistics", "40/VCL-KV", "11/11/2026", "V/v phối hợp giao hàng Tết", nut("Vào sổ", "chinh", "vao-so")]], "1 công văn chờ vào sổ")}`, true)}`),

    "158": () => trang(`${tieuDe("Công văn đi", `${nut("Soạn công văn", "chinh", "soan-tab")}${co.vanThu() ? nut("Xuất sổ", "phu", "xu-ly", "Đã xuất sổ công văn đi năm 2026 ra Excel.") : ""}`)}
      ${cacThe(["Sổ", "Soạn thảo", "Chi tiết"])}
      ${noiDungThe(0, `${boLoc(`${chonLoc("Sổ", ["Sổ công văn đi"])}${chonLoc("Năm", ["2026"])}${oTim("Số, ký hiệu, trích yếu…")}${chonLoc("Trạng thái", ["Trạng thái: tất cả", "Nháp", "Chờ duyệt", "Chờ cấp số", "Đã cấp số", "Đã phát hành", "Bị từ chối", "Đã hủy"])}`)}
        ${bang(["Số, ký hiệu", "Ngày", "Loại", "Trích yếu", "Người ký", "Nơi nhận", "Trạng thái"], [
          ["—", "—", "Công văn", `<a href="#" data-the-den="2">V/v giải trình hóa đơn điện tử quý 3</a>`, "Nguyễn Văn An", "Cục Thuế TP. Hồ Chí Minh", nhan("Chờ cấp số", "canh-bao")],
          ["87/QĐ-VCR", "10/11/2026", "Quyết định", "Về việc thành lập tổ kiểm kê cuối năm", "Nguyễn Văn An", "Các phòng ban; VComm Logistics", nhan("Đã phát hành", "thanh-cong")],
          ["86/VCR-KD", "09/11/2026", "Công văn", "V/v thông báo giá bán Tết", "Trần Văn Lâm", "Các cửa hàng liên kết", nhan("Đã cấp số", "thong-tin")],
          ["—", "—", "Tờ trình", "Về việc mua xe nâng", "Nguyễn Văn An", "Hội đồng quản trị", nhan("Chờ duyệt", "thong-tin")]], "87 văn bản năm 2026")}`)}
      ${noiDungThe(1, `<div><div>
        <div class="the"><h2>Thông tin</h2><div class="hai-cot">${luaChon("so-di", "Sổ", ["Sổ công văn đi"])}${luaChon("loai-vb", "Loại văn bản", ["Công văn", "Quyết định (QĐ)", "Thông báo (TB)", "Tờ trình (TTr)", "Báo cáo (BC)", "Kế hoạch (KH)"])}
          ${luaChon("pb-soan", "Phòng ban soạn thảo", ["Phòng Kế toán (KT)", "Phòng Kinh doanh (KD)"])}${luaChon("do-khan", "Độ khẩn", ["Thường", "Khẩn", "Thượng khẩn", "Hỏa tốc"])}</div>
          ${truong("trich-yeu", "Trích yếu", "text", "Giải trình hóa đơn điện tử quý 3", "", "Công văn hiện \"V/v …\" dưới số ký hiệu.")}${luaChon("tra-loi", "Trả lời công văn đến (không bắt buộc)", ["Số đến 245 · 125/TCT-KK", "Không"])}</div>
        <div class="the"><h2>Nội dung</h2>${luaChon("cach-soan", "Cách soạn", ["Soạn theo thể thức", "Tải tệp dự thảo (Word, PDF)"])}
          ${vungChu("noi-dung", "Nội dung (mỗi đoạn một dòng; dùng nút để đậm, nghiêng, danh sách)", "Kính gửi: Cục Thuế Thành phố Hồ Chí Minh.\nCăn cứ Công văn số 125/TCT-KK ngày 06/11/2026 của Cục Thuế về việc rà soát hóa đơn điện tử quý 3 năm 2026, Công ty Cổ phần VComm Bán lẻ Miền Nam giải trình như sau: …", 6)}</div>
        <div class="the"><h2>Ký và nơi nhận</h2><div class="hai-cot">${luaChon("nguoi-ky", "Người ký", ["Nguyễn Văn An", "Trần Văn Lâm"])}${luaChon("quyen-han", "Quyền hạn", ["Không", "TM.", "KT.", "TL.", "TUQ.", "Q."])}
          ${truong("chuc-vu", "Chức vụ người ký", "text", "GIÁM ĐỐC")}${truong("so-ban", "Số bản", "number", "3")}${truong("ky-hieu-soan", "Ký hiệu người soạn thảo", "text", "BN")}</div>
          ${vungChu("noi-nhan-ngoai", "Nơi nhận ngoài (mỗi dòng một nơi)", "Như trên;\nBan Giám đốc;", 2)}${luaChon("noi-nhan-noi-bo", "Nơi nhận nội bộ", ["Phòng Kế toán; VComm Logistics", "Chọn người, phòng ban, công ty trong tập đoàn…"])}
          <span class="chu-thich">Dòng "Lưu: VT, KT." tự thêm. Công ty khác trong tập đoàn nhận công văn đến chờ vào sổ khi phát hành.</span></div>
        <div class="nhom-nut">${nut("Lưu nháp", "phu", "xu-ly", "Đã lưu nháp.")}${nut("Tải Word", "phu", "xu-ly", "Đã tải tệp Word dự thảo.")}${nut("Trình ký", "chinh", "xu-ly", "Đã trình ký. Người duyệt nhận thông báo.")}</div></div>
        <div class="the"><h2>Xem trước PDF</h2>${trangA4()}<span class="chu-thich">Ứng dụng thật hiện chính tệp PDF do máy chủ tạo; khung này chỉ mô phỏng.</span></div></div>`, true)}
      ${noiDungThe(2, `<div class="tieu-de"><h2>V/v giải trình hóa đơn điện tử quý 3 ${nhan("Chờ cấp số", "canh-bao")}</h2><div class="nhom-nut">
        ${co.vanThu() ? `${nut("Cấp số", "chinh", "cap-so")}${nut("Phát hành", "phu", "phat-hanh")}` : ""}${nut("Tải PDF", "phu", "xu-ly", "Đã tải PDF.")}${nut("Tải Word", "phu", "xu-ly", "Đã tải Word.")}${nut("Hủy", "nguy-hiem", "huy-viec")}</div></div>
        <div class="hai-cot"><div class="the"><dl class="thong-tin-dong"><dt>Loại</dt><dd>Công văn</dd><dt>Phòng ban soạn thảo</dt><dd>Phòng Kế toán</dd><dt>Người soạn</dt><dd>Lê Thị Bích Ngọc</dd><dt>Người ký</dt><dd>Nguyễn Văn An · Giám đốc</dd>
          <dt>Nơi nhận</dt><dd>Cục Thuế TP. Hồ Chí Minh; Phòng Kế toán; VComm Logistics</dd><dt>Trả lời</dt><dd>Công văn đến số 245</dd><dt>Dự kiến số</dt><dd>88/VCR-KT (cấp khi văn thư bấm Cấp số)</dd></dl></div>
          <div class="the"><h2>Tiến trình duyệt</h2><ol class="dong-thoi-gian"><li class="xong"><span class="cham">1</span><div><strong>Trưởng phòng Kế toán</strong><div>Đồng ý 10/11/2026</div></div></li><li class="xong"><span class="cham">2</span><div><strong>Giám đốc Nguyễn Văn An (người ký)</strong><div>Đồng ý 11/11/2026</div></div></li></ol></div></div>`, true)}`),

    "159": () => trang(`${tieuDe("Bảng tin", co.dangTin() ? nut("Đăng tin", "chinh", "dang-tin") : "")}
      ${cacThe(["Tin", "Chi tiết", ...(co.dangTin() ? ["Đã đọc"] : [])])}
      ${noiDungThe(0, `${boLoc(`${oTim("Tìm tin…")}${chonLoc("Lọc", ["Tất cả", "Chưa đọc", "Cần xác nhận", ...(co.dangTin() ? ["Tôi đăng", "Hẹn giờ", "Đã thu hồi"] : [])])}`)}
        <div class="the"><strong>📌 <a href="#" data-the-den="1">Lịch nghỉ Tết Nguyên đán 2027</a></strong> ${nhan("Cần xác nhận đã đọc", "canh-bao")} ${nhan("Toàn tập đoàn", "trung-tinh")}<div class="chu-thich">Quản trị tập đoàn · 10/11/2026 08:00 · 2 tệp · 12 bình luận</div></div>
        <div class="the"><strong>📌 Quy định mới về công tác phí</strong> ${nhan("Đã đọc", "thanh-cong")}<div class="chu-thich">Phòng Hành chính · 05/11/2026 · Toàn công ty</div></div>
        <div class="the"><strong>Chúc mừng sinh nhật tháng 11</strong><div class="chu-thich">Phòng Hành chính · 01/11/2026 · Toàn công ty · 30 bình luận</div></div>
        ${co.dangTin() ? `<div class="the"><strong>Họp giao ban phòng Kinh doanh</strong> ${nhan("Hẹn giờ 12/11/2026 08:00", "thong-tin")}<div class="chu-thich">Phòng Kinh doanh · Chi nhánh VCR-HN</div></div>` : ""}`)}
      ${noiDungThe(1, `<div class="the"><div class="tieu-de"><h2>Lịch nghỉ Tết Nguyên đán 2027</h2><div class="nhom-nut">${co.dangTin() ? `${nut("Sửa", "phu", "dang-tin")}${nut("Thu hồi", "nguy-hiem", "huy-viec")}` : ""}</div></div>
        <div class="chu-thich">Quản trị tập đoàn · 10/11/2026 08:00 · đã sửa · Hết hiển thị 20/02/2027</div>
        <p>Toàn thể nhân viên tập đoàn nghỉ Tết từ <strong>thứ bảy 06/02/2027</strong> đến hết <strong>chủ nhật 14/02/2027</strong>. Các kho trực theo lịch đính kèm.</p>
        <ul><li>Lịch trực kho: xem tệp đính kèm.</li><li>Đơn hàng trên VComm vẫn nhận, giao sau Tết.</li></ul>
        <div>Tệp: <a href="#">lich-truc-kho-tet.xlsx</a> · <a href="#">thong-bao-nghi-tet.pdf</a></div>
        <div class="nhom-nut">${nut("Xác nhận đã đọc", "chinh", "xu-ly", "Đã xác nhận đã đọc.")}</div></div>
        <div class="the"><h2>Bình luận</h2><ol class="dong-thoi-gian"><li class="xong"><span class="cham">L</span><div><strong>Trần Minh Khoa · 10/11 09:12</strong><div>Kho Bình Dương trực ngày mùng 4 ạ?</div></div></li></ol>
        ${vungChu("bl-tin", "Viết bình luận", "", 2)}<div class="nhom-nut">${nut("Gửi", "chinh", "xu-ly", "Đã gửi bình luận.")}</div></div>`, true)}
      ${noiDungThe(2, `<div class="the"><h2>Đã đọc 412/530 · Đã xác nhận 398</h2>${boLoc(`${chonLoc("Lọc", ["Chưa xác nhận", "Đã xác nhận", "Tất cả"])}${chonLoc("Công ty", ["Tất cả công ty", "VComm Bán lẻ Miền Nam", "VComm Logistics"])}`)}
        ${bang(["Người nhận", "Công ty", "Phòng ban", "Đọc lúc", "Xác nhận"], [["Phạm Gia Huy", "VComm Bán lẻ Miền Nam", "Kho Bình Dương", "—", "—"], ["Võ Thành Đạt", "VComm Logistics", "Kho vận", "10/11 10:05", "—"]], "132 người chưa xác nhận")}</div>`, true)}`),

    "160": () => trang(`${tieuDe("Cài đặt văn thư")}
      ${cacThe(["Sổ công văn", "Loại văn bản", "Thông tin thể thức"])}
      ${noiDungThe(0, `<div class="tieu-de"><h2>Sổ công văn</h2>${nut("Thêm sổ", "phu", "them-so")}</div>${bang(["Tên sổ", "Chiều", "Số tiếp theo năm 2026", "Trạng thái", ""], [
        ["Sổ công văn đến", "Đến", "246", nhan("Đang dùng", "thanh-cong"), nut("Đổi tên", "phu", "them-so")], ["Sổ công văn đi", "Đi", "88", nhan("Đang dùng", "thanh-cong"), nut("Đổi tên", "phu", "them-so")],
        ["Sổ Hội đồng quản trị", "Đi", "05", nhan("Đang dùng", "thanh-cong"), nut("Ngừng dùng", "phu", "xu-ly", "Đã ngừng dùng sổ.")]])}
        <span class="chu-thich">Số đếm lại từ 01 ngày 01 tháng 01 mỗi năm (Nghị định 30/2020/NĐ-CP Điều 15). Không sửa được số tiếp theo.</span>`)}
      ${noiDungThe(1, `<div class="tieu-de"><h2>Loại văn bản</h2>${nut("Thêm loại", "phu", "them-loai")}</div>${bang(["Tên loại", "Viết tắt", "Ví dụ ký hiệu", "Dùng"], [
        ["Công văn", "—", "88/VCR-KT", "Bật"], ["Quyết định", "QĐ", "87/QĐ-VCR", "Bật"], ["Thông báo", "TB", "12/TB-VCR", "Bật"], ["Tờ trình", "TTr", "05/TTr-VCR", "Bật"], ["Nghị quyết", "NQ", "—", "Tắt"]], "29 loại theo Nghị định 30 và 0 loại riêng")}`, true)}
      ${noiDungThe(2, `<div class="the"><div class="hai-cot">${truong("co-quan-chu-quan", "Tên cơ quan chủ quản (không bắt buộc)", "text", "TẬP ĐOÀN VCOMM")}${truong("ten-cong-ty", "Tên công ty trên văn bản", "text", "CÔNG TY CỔ PHẦN VCOMM BÁN LẺ MIỀN NAM")}
        ${truong("viet-tat", "Viết tắt công ty trong ký hiệu", "text", "VCR")}${truong("dia-danh", "Địa danh", "text", "Thành phố Hồ Chí Minh")}
        ${luaChon("co-chu", "Phương án cỡ chữ", ["Cỡ 13 (quốc hiệu 12)", "Cỡ 14 (quốc hiệu 13)"])}<div></div>
        ${truong("le-tren", "Lề trên (mm, 20–25)", "number", "20")}${truong("le-duoi", "Lề dưới (mm, 20–25)", "number", "20")}${truong("le-trai", "Lề trái (mm, 30–35)", "number", "30")}${truong("le-phai", "Lề phải (mm, 15–20)", "number", "25", "Lề phải từ 15 đến 20 mm.")}</div>
        <div class="nhom-nut">${nut("Lưu", "chinh", "xu-ly", "Đã lưu thông tin thể thức.")}</div></div>`, true)}`)
  };

  // Sơ đồ luồng tự vẽ: ô bước xếp theo tầng, mũi tên giữa các ô; tô màu theo trạng thái.
  function soDo(daXong, dangMo) {
    const O = [["bd", "Bắt đầu", 230, 10], ["tp", "Trưởng phòng xem xét", 180, 70], ["gd", "Giám đốc duyệt", 40, 150], ["hc", "Hành chính mua", 320, 150],
      ["kt", "Kế toán thanh toán", 40, 230], ["nh", "Nhận hàng (gộp)", 320, 230], ["kt2", "Kết thúc", 230, 310]];
    const viTri = Object.fromEntries(O.map(o => [o[0], o]));
    const MUI = [["bd", "tp", ""], ["tp", "gd", "Đồng ý, > 5 triệu"], ["tp", "hc", "Đồng ý"], ["tp", "kt2", "Còn lại"], ["gd", "hc", "Đồng ý"], ["gd", "kt", ""], ["hc", "nh", ""], ["kt", "nh", ""], ["nh", "kt2", ""]];
    const tam = id => { const o = viTri[id]; const rong = id === "bd" || id === "kt2" ? 100 : 160; return [o[2] + rong / 2, o[3] + 18]; };
    const rongO = id => id === "bd" || id === "kt2" ? 100 : 160;
    const muiTen = MUI.map(([a, b, chu]) => { let [x1, y1] = tam(a); let [x2, y2] = tam(b);
      if (y1 === y2) { const phai = x2 > x1 ? 1 : -1; x1 += phai * rongO(a) / 2; x2 -= phai * rongO(b) / 2; } else { y1 += 18; y2 -= 18; }
      return `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="var(--mau-chu-phu)" stroke-width="1.5" marker-end="url(#mui)"/>${chu ? `<text x="${(x1 + x2) / 2 + 4}" y="${(y1 + y2) / 2}" font-size="11" fill="var(--mau-chu-phu)">${chu}</text>` : ""}`; }).join("");
    const o = O.map(([id, ten, x, y]) => { const rong = id === "bd" || id === "kt2" ? 100 : 160; const xong = (daXong || []).includes(id); const mo = (dangMo || []).includes(id);
      return `<rect x="${x}" y="${y}" width="${rong}" height="36" rx="${id === "bd" || id === "kt2" ? 18 : 6}" fill="${xong ? "var(--mau-thanh-cong-nen)" : "var(--mau-be-mat)"}" stroke="${mo ? "var(--mau-chinh)" : "var(--mau-vien)"}" stroke-width="${mo ? 3 : 1}"/>
        <text x="${x + rong / 2}" y="${y + 22}" text-anchor="middle" font-size="12" fill="var(--mau-chu)">${ten}</text>`; }).join("");
    return `<div class="khung-bang"><svg viewBox="0 0 520 360" width="520" height="360" role="img" aria-label="Sơ đồ luồng quy trình Mua văn phòng phẩm">
      <defs><marker id="mui" markerWidth="8" markerHeight="8" refX="7" refY="4" orient="auto"><path d="M0,0 L8,4 L0,8 z" fill="var(--mau-chu-phu)"/></marker></defs>${muiTen}${o}</svg></div>`;
  }

  // Mô phỏng trang A4 theo thể thức Nghị định 30 (Phụ lục I); chỉ để duyệt bố cục.
  function trangA4() {
    return `<div class="khung-bang"><div style="background:#fff;color:#000;font-family:'Times New Roman',serif;width:595px;min-height:600px;padding:57px 57px 57px 85px;box-sizing:border-box;font-size:13px;line-height:1.35">
      <div style="display:flex;justify-content:space-between;gap:12px"><div style="text-align:center;width:45%">TẬP ĐOÀN VCOMM<br><strong>CÔNG TY CỔ PHẦN VCOMM<br>BÁN LẺ MIỀN NAM</strong><hr style="width:40%;border:0;border-top:1px solid #000;margin:2px auto">
        Số:&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;/VCR-KT<br><span style="font-size:12px">V/v giải trình hóa đơn điện tử quý 3</span><br><strong>KHẨN</strong></div>
        <div style="text-align:center;width:55%"><strong style="font-size:12px">CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM</strong><br><strong>Độc lập - Tự do - Hạnh phúc</strong><hr style="width:55%;border:0;border-top:1px solid #000;margin:2px auto">
        <em>Thành phố Hồ Chí Minh, ngày&nbsp;&nbsp;&nbsp;&nbsp;tháng&nbsp;&nbsp;&nbsp;&nbsp;năm 2026</em></div></div>
      <div style="text-align:center;font-weight:bold;margin:8px 0">DỰ THẢO</div>
      <p style="text-align:center;margin:12px 0">Kính gửi: Cục Thuế Thành phố Hồ Chí Minh.</p>
      <p style="text-indent:1cm;text-align:justify;margin:0 0 6px">Căn cứ Công văn số 125/TCT-KK ngày 06/11/2026 của Cục Thuế về việc rà soát hóa đơn điện tử quý 3 năm 2026, Công ty Cổ phần VComm Bán lẻ Miền Nam giải trình như sau: …</p>
      <div style="display:flex;justify-content:space-between;margin-top:20px"><div style="font-size:11px"><strong><em style="font-size:12px">Nơi nhận:</em></strong><br>- Như trên;<br>- Ban Giám đốc;<br>- Lưu: VT, KT.</div>
        <div style="text-align:center"><strong>GIÁM ĐỐC</strong><br><br><br><br><strong>Nguyễn Văn An</strong></div></div>
      <div style="font-size:11px;margin-top:16px">BN.03</div></div></div>`;
  }

  const TRANG_THAI = {
    "rong": () => `<div class="trang-thai-trong"><h2>Chưa có dữ liệu</h2><p style="margin:0">${{ "153": "Chưa có việc nào. Bấm \"Giao việc\" để bắt đầu.", "155": "Chưa có mẫu quy trình.", "156": "Chưa có phiên quy trình.", "157": "Sổ chưa có công văn đến năm nay.", "158": "Chưa có công văn đi năm nay.", "159": "Chưa có tin nào." }[ma] || "Chưa có dữ liệu."}</p></div>`,
    "dang-tai": () => `<div class="the" aria-busy="true"><p style="margin:0">Đang tải…</p></div>`,
    "loi": () => `<div class="khoi-canh-bao loi">Không tải được dữ liệu. <button type="button" class="nut phu">Thử lại</button></div>`,
    "khong-quyen": () => `<div class="trang-thai-trong"><h2>Bạn không có quyền xem trang này</h2><p style="margin:0">Liên hệ quản trị công ty nếu bạn cần quyền này.</p></div>`
  };

  function veTrang() {
    const khongQuyen = !DUOC_XEM[ma].includes(vaiTro);
    const tt = khongQuyen ? "khong-quyen" : trangThai;
    const ten = { "153": "Công việc", "154": "Chi tiết công việc", "155": "Mẫu quy trình", "156": "Phiên quy trình", "157": "Công văn đến", "158": "Công văn đi", "159": "Bảng tin", "160": "Cài đặt văn thư" }[ma];
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
  const chonThe = so => {
    document.querySelectorAll("[data-the]").forEach(b => b.classList.toggle("chon", b.dataset.the === String(so)));
    document.querySelectorAll("[data-noi-dung-the]").forEach(k => { k.hidden = k.dataset.noiDungThe !== String(so); });
  };
  const NGUOI = "Chọn người trong tập đoàn (gõ tên): Võ Thành Đạt · VComm Logistics · Kho vận";

  document.addEventListener("click", e => {
    const the = e.target.closest("[data-the]");
    if (the) return chonThe(the.dataset.the);
    const den = e.target.closest("[data-the-den]");
    if (den) { e.preventDefault(); return chonThe(den.dataset.theDen); }
    const n = e.target.closest("[data-hanh-dong]"); if (!n || n.disabled) return;
    const hd = n.dataset.hanhDong;
    if (hd === "xu-ly") { e.preventDefault(); n.classList.add("dang-xu-ly"); n.disabled = true; setTimeout(() => { n.classList.remove("dang-xu-ly"); n.disabled = false; thongBao(n.dataset.thongBao || "Đã lưu."); }, 700); return; }
    if (hd === "soan-tab") return chonThe(1);
    if (hd === "giao-viec") return ngan("Giao việc", `${truong("gv-tieu-de", "Tiêu đề", "text", "Đối soát kho Bình Dương tháng 10")}${vungChu("gv-mo-ta", "Mô tả", "", 3)}
      ${luaChon("gv-chu-tri", "Người chủ trì", [NGUOI, "Phạm Gia Huy · VComm Bán lẻ Miền Nam · Kho Bình Dương"])}${truong("gv-phoi-hop", "Người phối hợp", "text", "Phạm Gia Huy")}${truong("gv-theo-doi", "Người theo dõi", "text", "Trần Văn Lâm")}
      <div class="hai-cot">${truong("gv-bat-dau", "Ngày bắt đầu", "date", "2026-11-11")}${truong("gv-han", "Hạn hoàn thành", "datetime-local", "2026-11-20T17:00")}</div>${luaChon("gv-uu-tien", "Ưu tiên", ["Bình thường", "Thấp", "Cao", "Khẩn"])}
      <div class="khoi-canh-bao thong-tin">Người ở công ty khác chỉ thấy việc này, không thấy dữ liệu khác của công ty bạn.</div>`, "Giao việc", "Đã giao việc. Người chủ trì nhận thông báo.");
    if (hd === "bao-xong") return ngan("Báo xong", `${vungChu("bx-ghi-chu", "Ghi chú kết quả", "Đã đối soát xong, chênh lệch 2 thùng sữa đã lập biên bản.", 3)}<div class="khoi-canh-bao thong-tin">Việc chuyển "Chờ xác nhận"; người giao xác nhận hoặc trả lại. Việc của bước quy trình phải chọn kết quả (Đồng ý, Không đồng ý…).</div>`, "Báo xong", "Đã báo xong. Người giao nhận thông báo.");
    if (hd === "tien-do") return ngan("Cập nhật tiến độ", `${truong("td", "Tiến độ (%)", "number", "80")}`, "Lưu", "Đã cập nhật tiến độ.");
    if (hd === "huy-viec") return ngan("Xác nhận", `${vungChu("ly-do", "Lý do (bắt buộc)", "", 3)}`, "Xác nhận", "Đã ghi nhận.");
    if (hd === "tai-len") return ngan("Tải tệp lên", `<div class="truong"><label for="tep">Tệp (tối đa 20 MB: PDF, Word, Excel, PowerPoint, ảnh, TXT, ZIP)</label><input id="tep" type="file" class="o-nhap"></div>`, "Tải lên", "Đã tải tệp lên.");
    if (hd === "them-truong") return ngan("Trường biểu mẫu", `${truong("tr-khoa", "Khóa", "text", "so_tien")}${truong("tr-nhan", "Nhãn", "text", "Số tiền dự kiến (đồng)")}${luaChon("tr-kieu", "Kiểu", ["Số", "Văn bản", "Ngày", "Chọn một", "Có hoặc không", "Người dùng"])}${luaChon("tr-bat-buoc", "Bắt buộc", ["Có", "Không"])}`, "Lưu", "Đã lưu trường.");
    if (hd === "them-buoc") return ngan("Bước", `${truong("b-ten", "Tên bước", "text", "Trưởng phòng xem xét")}${vungChu("b-huong-dan", "Hướng dẫn", "Kiểm tra nhu cầu và số tiền.", 2)}
      ${luaChon("b-nguoi", "Người thực hiện", ["Trưởng phòng của người khởi tạo", "Người cụ thể", "Vai trò trong công ty", "Người khởi tạo", "Trường người dùng của biểu mẫu"])}${truong("b-ngay", "Số ngày được làm", "number", "2")}
      ${truong("b-ket-qua", "Kết quả (cách nhau dấu phẩy, tối đa 5)", "text", "Đồng ý, Không đồng ý")}${luaChon("b-loai", "Loại bước", ["Công việc", "Gộp (chờ các nhánh)"])}
      <h3>Quy tắc chuyển (xét từ trên xuống, dòng đầu thỏa thì dùng)</h3>
      <div class="hai-cot">${luaChon("q1-kq", "1. Kết quả", ["Đồng ý"])}${luaChon("q1-dk", "và điều kiện", ["Số tiền dự kiến > 5.000.000", "Không"])}</div>${luaChon("q1-dich", "→ đến", ["Giám đốc duyệt", "Hành chính mua", "Nhiều bước song song…", "Kết thúc"])}
      <div class="hai-cot">${luaChon("q2-kq", "2. Kết quả", ["Đồng ý"])}${luaChon("q2-dk", "và điều kiện", ["Không"])}</div>${luaChon("q2-dich", "→ đến", ["Hành chính mua"])}
      ${luaChon("q3-dich", "Trường hợp còn lại → đến", ["Kết thúc", "Trưởng phòng xem xét"])}${nut("Thêm quy tắc", "phu", "xu-ly", "Đã thêm dòng.")}`, "Lưu bước", "Đã lưu bước.");
    if (hd === "khoi-tao") return ngan("Khởi tạo quy trình", `${luaChon("kt-mau", "Mẫu", ["Mua văn phòng phẩm", "Tiếp nhận nhân viên mới"])}${truong("kt-tieu-de", "Tiêu đề", "text", "Giấy, mực tháng 11")}
      ${truong("kt-noi-dung", "Nội dung cần mua", "text", "Giấy A4 20 ram, mực máy in HP 4 hộp")}${truong("kt-so-tien", "Số tiền dự kiến (đồng)", "number", "7200000")}${luaChon("kt-nguoi-nhan", "Người nhận hàng", ["Phạm Gia Huy"])}`, "Khởi tạo", "Đã khởi tạo QT2026-00013. Bước đầu đã giao cho trưởng phòng.");
    if (hd === "chi-dinh") return ngan("Chỉ định người thực hiện", `${luaChon("cd-nguoi", "Người thực hiện bước Hành chính mua", ["Mai Anh · Phòng Hành chính", "Trần Minh Khoa"])}`, "Chỉ định", "Đã chỉ định. Phiên chạy tiếp.");
    if (hd === "vao-so") return ngan("Vào sổ công văn đến", `${luaChon("vs-so", "Sổ", ["Sổ công văn đến"])}<div class="hai-cot">${truong("vs-ngay-den", "Ngày đến", "date", "2026-11-11")}${luaChon("vs-phuong-thuc", "Phương thức nhận", ["Giấy", "Thư điện tử", "Liên công ty", "Khác"])}</div>
      ${truong("vs-noi-gui", "Nơi gửi", "text", "Cục Thuế TP. Hồ Chí Minh")}<div class="hai-cot">${truong("vs-so-ky-hieu", "Số ký hiệu", "text", "125/TCT-KK")}${truong("vs-ngay-vb", "Ngày văn bản", "date", "2026-11-06")}</div>
      <div class="khoi-canh-bao canh-bao">Đã có công văn đến số 245 cùng nơi gửi, số ký hiệu, ngày văn bản. Kiểm tra trước khi vào sổ.</div>
      ${luaChon("vs-loai", "Loại văn bản", ["Công văn", "Thông báo", "Quyết định"])}${truong("vs-trich-yeu", "Trích yếu", "text", "V/v rà soát hóa đơn điện tử quý 3")}
      <div class="hai-cot">${luaChon("vs-do-khan", "Độ khẩn", ["Thường", "Khẩn", "Thượng khẩn", "Hỏa tốc"])}${truong("vs-han", "Hạn xử lý (không bắt buộc)", "date")}</div>
      <div class="truong"><label for="vs-tep">Bản quét (PDF hoặc ảnh, tối đa 20 MB, nhiều tệp)</label><input id="vs-tep" type="file" class="o-nhap" multiple accept=".pdf,.jpg,.jpeg,.png"></div>
      ${luaChon("vs-trinh", "Trình ngay cho lãnh đạo (không bắt buộc)", ["Không", "Nguyễn Văn An · Giám đốc"])}`, "Vào sổ", "Đã vào sổ, số đến 246.");
    if (hd === "trinh") return ngan("Trình lãnh đạo", `${luaChon("tr-ld", "Lãnh đạo", ["Nguyễn Văn An · Giám đốc", "Trần Văn Lâm · Phó giám đốc"])}${vungChu("tr-ghi-chu", "Ghi chú", "", 2)}`, "Trình", "Đã trình. Lãnh đạo nhận thông báo.");
    if (hd === "giao-xu-ly") return ngan("Cho ý kiến và giao xử lý", `${vungChu("y-kien", "Ý kiến chỉ đạo", "Giao phòng Kế toán chủ trì giải trình, gửi trước ngày 15/11.", 3)}
      ${luaChon("gx-chu-tri", "Người chủ trì", ["Lê Thị Bích Ngọc · Phòng Kế toán"])}${truong("gx-phoi-hop", "Người phối hợp", "text", "Trần Minh Khoa")}${truong("gx-han", "Hạn xử lý", "datetime-local", "2026-11-15T17:00")}
      <div class="khoi-canh-bao thong-tin">Hệ thống tạo công việc gắn công văn; hoàn thành việc thì công văn "Đã xử lý".</div>`, "Giao xử lý", "Đã giao xử lý. Công việc đã tạo.");
    if (hd === "cap-so") return ngan("Cấp số", `<p style="margin:0">Cấp số tiếp theo của Sổ công văn đi năm 2026: <strong>88/VCR-KT</strong>, ngày 11/11/2026.</p><div class="khoi-canh-bao canh-bao">Sau khi cấp số, văn bản không sửa, không hủy được.</div>`, "Cấp số", "Đã cấp số 88/VCR-KT. Tải PDF để in, ký, đóng dấu.");
    if (hd === "phat-hanh") return ngan("Phát hành", `<div class="truong"><label for="ph-tep">Bản đã ký, đóng dấu (bản quét, bắt buộc)</label><input id="ph-tep" type="file" class="o-nhap" accept=".pdf,.jpg,.jpeg,.png"></div>
      <div class="khoi-canh-bao thong-tin">Phòng Kế toán nhận thông báo; VComm Logistics nhận công văn đến chờ vào sổ.</div>`, "Phát hành", "Đã phát hành 88/VCR-KT.");
    if (hd === "dang-tin") return ngan("Đăng tin", `${truong("t-tieu-de", "Tiêu đề", "text", "Lịch nghỉ Tết Nguyên đán 2027")}${vungChu("t-noi-dung", "Nội dung (đoạn, đậm, nghiêng, danh sách, đường dẫn)", "Toàn thể nhân viên nghỉ Tết từ thứ bảy 06/02/2027…", 5)}
      ${luaChon("t-doi-tuong", "Đối tượng", ["Toàn công ty", "Chi nhánh, phòng ban được chọn", ...(vaiTro === "quan-tri" ? ["Toàn tập đoàn"] : [])])}
      <div class="hai-cot">${luaChon("t-luc", "Thời điểm đăng", ["Ngay", "Hẹn giờ"])}${truong("t-hen", "Hẹn lúc", "datetime-local", "2026-11-12T08:00")}${truong("t-het-han", "Hết hiển thị (không bắt buộc)", "date", "2027-02-20")}${luaChon("t-ghim", "Ghim", ["Không", "Có (còn 3 chỗ)"])}</div>
      <div class="hai-cot">${luaChon("t-xac-nhan", "Cần xác nhận đã đọc", ["Có", "Không"])}${luaChon("t-binh-luan", "Cho bình luận", ["Có", "Không"])}</div>
      <div class="truong"><label for="t-tep">Tệp đính kèm</label><input id="t-tep" type="file" class="o-nhap" multiple></div>`, "Đăng", "Đã hẹn đăng 12/11/2026 08:00.");
    if (hd === "them-so") return ngan("Sổ công văn", `${truong("s-ten", "Tên sổ", "text", "Sổ Hội đồng quản trị")}${luaChon("s-chieu", "Chiều", ["Đi", "Đến"])}`, "Lưu", "Đã lưu sổ.");
    if (hd === "them-loai") return ngan("Loại văn bản riêng", `${truong("l-ten", "Tên loại", "text", "Phiếu yêu cầu")}${truong("l-viet-tat", "Viết tắt", "text", "PYC")}`, "Lưu", "Đã thêm loại văn bản.");
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
  dk.querySelector("#dk-vai-tro").addEventListener("change", e => { vaiTro = e.target.value; ghi("ban-mau-vp-vai-tro", vaiTro); veTrang(); });
  dk.querySelector("#dk-trang-thai").addEventListener("change", e => { trangThai = e.target.value; ghi("ban-mau-vp-trang-thai", trangThai); veTrang(); });
  veTrang();
})();
