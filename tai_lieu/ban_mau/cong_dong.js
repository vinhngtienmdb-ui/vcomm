// Bản mẫu CONG_VIEC_49 (MODULE_10 Cộng đồng): dựng MAN_HINH_132 đến 139 từ dữ liệu giả. Không phải mã sản phẩm.
(function () {
  const TEP = {
    132: ["CONG_TAC_VIEN", "Cộng tác viên"], 133: ["MOI_BAN_BE", "Mời bạn bè"], 134: ["MUA_CHUNG", "Mua chung"], 135: ["VI_MUA_SAM", "Ví mua sắm"],
    136: ["BANG_TIN", "Bảng tin"], 137: ["QUAN_TRI_CONG_TAC_VIEN", "Cộng tác viên và thưởng giới thiệu (web)"],
    138: ["QUAN_TRI_MUA_CHUNG", "Mua chung (web)"], 139: ["KIEM_DUYET_CONG_DONG", "Kiểm duyệt cộng đồng (web)"]
  };
  const duongDan = ma => `MAN_HINH_${ma}_${TEP[ma][0]}.html`;
  const ma = Number(document.body.dataset.manHinh);
  const TRANG_THAI = [["du-lieu", "Có dữ liệu"], ["rong", "Rỗng"], ["dang-tai", "Đang tải"], ["loi", "Lỗi"], ["khong-quyen", "Không có quyền"]];
  const doc = (khoa, macDinh) => { try { return localStorage.getItem(khoa) || macDinh; } catch (e) { return macDinh; } };
  const ghi = (khoa, giaTri) => { try { localStorage.setItem(khoa, giaTri); } catch (e) { /* bỏ qua */ } };
  let trangThai = doc("ban-mau-cong-dong-trang-thai", "du-lieu");

  // ---------- Thành phần dùng chung ----------
  const nut = (chu, loai, thongBao, them) => `<button type="button" class="nut ${loai || "chinh"} ${them || ""}" data-thong-bao="${thongBao || ""}">${chu}</button>`;
  const nhan = (chu, loai) => `<span class="nhan-trang-thai ${loai}">${chu}</span>`;
  const hop = (chu, loai) => `<div class="hop-thong-bao ${loai}" role="${loai === "loi" ? "alert" : "status"}">${chu}</div>`;
  const tai = n => Array.from({ length: n }, () => `<div class="khung-tai" aria-hidden="true"></div>`).join("") + `<span class="an-nhan">Đang tải…</span>`;
  const loiTai = `${hop("Không tải được dữ liệu. Kiểm tra kết nối mạng rồi thử lại.", "loi")}${nut("Thử lại", "phu", "", "rong")}`;
  const truong = (nhanO, giaTri, loi, kieu) => {
    const id = "o-" + Math.random().toString(36).slice(2, 8);
    const o = kieu === "nhieu-dong" ? `<textarea id="${id}" rows="4">${giaTri || ""}</textarea>` : `<input id="${id}" class="o-nhap" value="${giaTri || ""}">`;
    return `<div class="truong-dt"><label for="${id}">${nhanO}</label>${o}${loi ? `<span class="loi">${loi}</span>` : ""}</div>`;
  };
  const theTab = chon => `<nav class="thanh-the" aria-label="Thanh điều hướng">${[["Trang chủ", ""], ["Cửa hàng", ""], ["Bảng tin", 136], ["Đơn hàng", ""], ["Tài khoản", 132]]
    .map(([chu, dich]) => `<a href="${dich ? duongDan(dich) : "#"}" class="${chu === chon ? "chon" : ""}">${chu}</a>`).join("")}</nav>`;
  const dienThoai = (chuThich, tieuDe, than, tab, quayLai) => `<section class="dien-thoai" aria-label="${chuThich}">
    <div class="chu-thich-khung">${chuThich}</div>
    <div class="dau">${quayLai ? `<a href="${quayLai}" aria-label="Quay lại">‹</a>` : ""}<span>${tieuDe}</span></div>
    <div class="cuon">${than}</div>${tab ? theTab(tab) : ""}</section>`;
  // Một khung theo trạng thái đang chọn; khung chỉ có dữ liệu thì truyền rongThan = null.
  const theoTrangThai = (duLieu, rongThan, khongQuyen) => {
    if (trangThai === "dang-tai") return tai(3);
    if (trangThai === "loi") return loiTai;
    if (trangThai === "khong-quyen") return khongQuyen || hop("Tài khoản của bạn không dùng được chức năng này.", "canh-bao");
    if (trangThai === "rong" && rongThan) return rongThan;
    return duLieu;
  };
  const sanPhamNho = (ten, gia) => `<div class="the-san-pham-nho"><div class="anh-gia">Ảnh</div><div class="gian"><div class="chu-dam">${ten}</div><div class="chu-nho">${gia}</div></div></div>`;

  // ---------- Web ----------
  const MENU_WEB = [["Người mua", ""], ["Đơn VComm", ""], ["Đăng bán", ""], ["Cộng tác viên", 137], ["Mua chung", 138], ["Kiểm duyệt cộng đồng", 139], ["Cài đặt bán hàng", ""]];
  const web = (than) => `<div class="khung-web"><header class="thanh-tren"><span class="logo">VComm</span><span>Khách hàng và Đối tác</span><span class="gian"></span>
    <button type="button">VComm Thương mại ▾</button><button type="button">Trần Minh Khoa ▾</button></header>
    <div class="than"><nav class="menu" aria-label="Khách hàng và Đối tác"><div class="ten-app">Sàn VComm</div>${MENU_WEB.map(([chu, dich]) =>
      `<a href="${dich ? duongDan(dich) : "#"}" class="${dich === ma ? "chon" : ""}">${chu}</a>`).join("")}</nav><main class="noi-dung">${than}</main></div></div>`;
  const bang = (cot, dong, soCot) => `<div class="cuon-ngang"><table class="bang-web"><thead><tr>${cot.map(c => `<th scope="col">${c}</th>`).join("")}</tr></thead>
    <tbody>${dong.map(d => `<tr>${d.map((o, i) => `<td class="${(soCot || []).includes(i) ? "so" : ""}">${o}</td>`).join("")}</tr>`).join("")}</tbody></table></div>`;
  const theWeb = (cacThe, chon) => `<nav class="cac-the-web">${cacThe.map(t => `<a href="#" class="${t === chon ? "chon" : ""}">${t}</a>`).join("")}</nav>`;
  const webTheoTrangThai = (duLieu, rongThan) => {
    if (trangThai === "dang-tai") return tai(4);
    if (trangThai === "loi") return loiTai;
    if (trangThai === "khong-quyen") return hop("Bạn không có quyền xem màn hình này. Liên hệ quản trị công ty để được cấp quyền.", "canh-bao");
    if (trangThai === "rong" && rongThan) return rongThan;
    return duLieu;
  };

  // ---------- Màn hình ----------
  const MAN_HINH = {
    132: () => `<div class="day-dien-thoai">
      ${dienThoai("Chưa đăng ký", "Cộng tác viên", `
        <div class="the-dt"><h3>Chia sẻ sản phẩm, nhận hoa hồng</h3>
          <p class="chu-nho" style="margin:0">Khi người mua đặt hàng trong 7 ngày kể từ lần bấm đường dẫn bạn chia sẻ, bạn nhận hoa hồng cộng tác viên trên sản phẩm đó. Hoa hồng cộng vào ví hoa hồng khi đơn hoàn tất.</p></div>
        <div class="the-dt">${truong("Kênh chia sẻ chính (không bắt buộc)", "Nhóm Zalo Mẹ và bé Thủ Đức, trang Facebook Góc nhà Hà Ly")}
          <label class="dong chu-nho"><input type="checkbox" checked> <span>Tôi đã đọc và đồng ý <a href="#">Điều khoản cộng tác viên VComm</a></span></label>
          ${nut("Gửi đăng ký", "chinh", "Đã gửi đăng ký. VComm sẽ xét duyệt và báo cho bạn.", "rong")}</div>`, "Tài khoản", "#")}
      ${dienThoai("Chờ duyệt, bị từ chối", "Cộng tác viên", `
        <div class="the-dt"><div class="dong"><h3 class="gian">Hồ sơ cộng tác viên</h3>${nhan("Chờ duyệt", "canh-bao")}</div><p class="chu-nho" style="margin:0">Gửi lúc 09:14 11/11/2026. VComm sẽ báo kết quả trong mục thông báo.</p></div>
        <div class="the-dt"><div class="dong"><h3 class="gian">Hồ sơ cộng tác viên</h3>${nhan("Từ chối", "loi")}</div>
          ${hop("Lý do: Kênh chia sẻ chưa rõ, vui lòng ghi đường dẫn trang hoặc tên nhóm cụ thể.", "loi")}
          ${nut("Gửi lại đăng ký", "phu", "", "rong")}</div>
        <div class="the-dt"><div class="dong"><h3 class="gian">Hồ sơ cộng tác viên</h3>${nhan("Tạm ngừng", "trung-tinh")}</div>
          ${hop("Tài khoản cộng tác viên đang tạm ngừng: không ghi nhận lượt bấm mới, không mở được nhóm mua chung. Đơn đã ghi nhận vẫn được tính. Lý do: Chia sẻ thông tin sai về sản phẩm.", "canh-bao")}</div>`, "Tài khoản", "#")}
      ${dienThoai("Đã duyệt", "Cộng tác viên", theoTrangThai(`
        <div class="the-dt"><div class="dong"><div class="gian"><div class="chu-nho">Mã cộng tác viên</div><div class="so-lon">K7MZ4QHP</div></div>${nhan("KOC", "thong-tin")} ${nhan("Đã duyệt", "thanh-cong")}</div>
          <p class="chu-nho" style="margin:0">Mở trang sản phẩm, bấm "Chia sẻ nhận hoa hồng" để lấy đường dẫn có mã của bạn.</p></div>
        <div class="the-dt"><h3>30 ngày gần nhất</h3>
          <div class="dong"><span class="gian">Lượt bấm đường dẫn</span><b>1.284</b></div>
          <div class="dong"><span class="gian">Đơn ghi nhận</span><b>57</b></div>
          <div class="dong"><span class="gian">Hoa hồng cộng tác viên đang chờ</span><b>1.245.000 ₫</b></div>
          <div class="dong"><span class="gian">Đã cộng ví hoa hồng</span><b>3.870.500 ₫</b></div>
          <a class="nut chu" href="#">Xem ví hoa hồng ›</a></div>
        <div class="the-dt"><h3>Nhóm mua chung của tôi</h3><div class="dong"><span class="gian">Đang mở</span><b>2/5</b></div><a class="nut phu rong" href="${duongDan(134)}">Mở nhóm mua chung</a></div>
        <div class="the-dt"><h3>Đơn ghi nhận gần đây</h3>
          ${[["DB-2026-001284", "Nồi chiên không dầu Lock&Lock 5,2 lít", "Đang chờ · 85.000 ₫"], ["DB-2026-001190", "Sữa rửa mặt dịu nhẹ cho da nhạy cảm 150 ml (combo 2 chai)", "Đã cộng · 24.300 ₫"]]
            .map(([so, ten, tien]) => `<div><div class="chu-dam">${ten}</div><div class="chu-nho">${so} · ${tien}</div></div>`).join("")}</div>`,
        `<div class="the-dt"><div class="dong"><div class="gian"><div class="chu-nho">Mã cộng tác viên</div><div class="so-lon">K7MZ4QHP</div></div>${nhan("Đã duyệt", "thanh-cong")}</div></div>
         <div class="the-dt"><p style="margin:0">Chưa có lượt bấm nào. Chia sẻ đường dẫn sản phẩm đầu tiên để bắt đầu.</p><a class="nut chinh rong" href="#">Đến cửa hàng</a></div>`), "Tài khoản", "#")}
      ${dienThoai("Trang sản phẩm (sửa MAN_HINH_91)", "Sản phẩm", `
        <div class="anh-gia lon">Ảnh sản phẩm</div>
        <div><h3>Nồi chiên không dầu Lock&Lock 5,2 lít EJF357BLK</h3><div class="so-lon">1.690.000 ₫</div>
          <div class="dong chu-nho"><span class="sao">★★★★☆</span> 4,6 · 38 đánh giá đã mua · <a href="${duongDan(136)}">Xem</a></div></div>
        <a class="nut phu rong" href="${duongDan(134)}">Mua chung từ 1.390.000 ₫ · 2 nhóm đang mở</a>
        ${nut("Chia sẻ nhận hoa hồng", "phu", "Đã sao chép đường dẫn https://vcomm.vn/p/9f2c…?ctv=K7MZ4QHP", "rong")}
        <p class="chu-nho" style="margin:0">Hoa hồng cộng tác viên: 5% tiền hàng chưa thuế.</p>
        ${nut("Thêm vào giỏ", "chinh", "Đã thêm vào giỏ", "rong")}`, "", "#")}
    </div>`,

    133: () => `<div class="day-dien-thoai">
      ${dienThoai("Mời bạn bè", "Mời bạn bè", theoTrangThai(`
        <div class="the-dt"><h3>Mời bạn, nhận 50.000 ₫</h3><p class="chu-nho" style="margin:0">Bạn nhận 50.000 ₫ vào ví hoa hồng khi đơn đầu tiên của bạn được mời hoàn tất và có giá trị từ 200.000 ₫. Mỗi người được mời tính một lần. Bạn vẫn nhận hoa hồng giới thiệu trên các đơn của họ.</p>
          <div class="truong-dt"><label for="duong-dan">Đường dẫn giới thiệu</label><input id="duong-dan" class="o-nhap" readonly value="https://vcomm.vn/r/0912345678"></div>
          <div class="dong">${nut("Chia sẻ", "chinh", "Đã mở hộp chia sẻ")}${nut("Sao chép", "phu", "Đã sao chép đường dẫn")}</div></div>
        <div class="the-dt"><div class="dong"><h3 class="gian">Bạn đã mời</h3><span class="chu-nho">12 người</span></div>
          ${[["Nguyễn Thị Phương Thảo", "0912***678", "02/11/2026", nhan("Đã thưởng 50.000 ₫", "thanh-cong")],
             ["Lê Hoàng Bảo Ngọc Khánh Linh Nguyễn Trần", "0987***210", "05/11/2026", nhan("Đơn đầu đang giao", "thong-tin")],
             ["Phạm Văn Đức", "0903***455", "10/11/2026", nhan("Chưa có đơn", "trung-tinh")],
             ["Trịnh Gia Hân", "0938***001", "28/10/2026", nhan("Đơn hoàn tất dưới 200.000 ₫", "trung-tinh")]]
            .map(([ten, so, ngay, tt]) => `<div class="dong" style="align-items:flex-start"><div class="gian"><div class="chu-dam" style="overflow-wrap:anywhere">${ten}</div><div class="chu-nho">${so} · đăng ký ${ngay}</div></div>${tt}</div>`).join("")}</div>`,
        `<div class="the-dt"><h3>Mời bạn, nhận 50.000 ₫</h3><div class="dong">${nut("Chia sẻ", "chinh")}${nut("Sao chép", "phu")}</div></div>
         <div class="the-dt"><p style="margin:0">Bạn chưa mời ai. Gửi đường dẫn giới thiệu cho bạn bè để họ đăng ký.</p></div>`,
        hop("Chương trình thưởng giới thiệu đang tạm dừng. Bạn vẫn nhận hoa hồng giới thiệu trên đơn của người bạn đã mời.", "thong-tin")), "Tài khoản", "#")}
      ${dienThoai("Tài khoản (sửa MAN_HINH_76)", "Tài khoản", `
        <div class="the-dt"><div class="chu-dam">Hà Ly</div><div class="chu-nho">0912 345 678</div></div>
        <div class="the-dt">${[["Mời bạn bè", 133], ["Cộng tác viên", 132], ["Ví mua sắm · 245.000 ₫", 135], ["Ví hoa hồng", ""], ["Tài khoản nhận hoàn tiền", ""]]
          .map(([chu, dich]) => `<a class="dong" style="text-decoration:none;color:inherit;padding:6px 0" href="${dich ? duongDan(dich) : "#"}"><span class="gian">${chu}</span><span>›</span></a>`).join("")}</div>
        ${nut("Đăng xuất", "phu", "", "rong")}`, "Tài khoản")}
    </div>`,

    134: () => {
      const bac = (dat) => `<div class="bac-gia">${[["2+", "1.590.000"], ["10+", "1.490.000"], ["30+", "1.390.000"]].map(([n, g], i) =>
        `<div class="${i < dat ? "dat" : ""}"><b>${g} ₫</b>từ ${n} sp</div>`).join("")}</div>`;
      const nhom = (ten, nguoiMo, nhanNguoiMo, so, conLai, dat, phan) => `<a class="the-dt" style="text-decoration:none;color:inherit" href="#chi-tiet">
        <div class="dong"><div class="anh-gia">Ảnh</div><div class="gian"><div class="chu-dam">${ten}</div><div class="chu-nho">Nhóm của ${nguoiMo} ${nhanNguoiMo} · còn ${conLai}</div></div></div>
        ${bac(dat)}<div class="tien-do" role="progressbar" aria-valuenow="${so}" aria-valuemin="0" aria-valuemax="30" aria-label="Số lượng nhóm"><span style="width:${phan}%"></span><i style="left:6.6%"></i><i style="left:33%"></i></div>
        <div class="chu-nho">Đã có ${so} sản phẩm · ${so < 2 ? `thêm ${2 - so} để đạt mốc tối thiểu` : `thêm ${so >= 10 ? 30 - so : 10 - so} để xuống bậc tiếp theo`}</div></a>`;
      return `<div class="day-dien-thoai">
      ${dienThoai("Danh sách nhóm đang mở", "Mua chung", theoTrangThai(`
        ${hop("Trả trước theo giá bậc đầu. Hết hạn nhóm, giá chốt theo bậc đạt được; tiền dư hoàn vào ví mua sắm. Nhóm dưới mốc tối thiểu bị hủy, hoàn toàn bộ vào ví mua sắm.", "thong-tin")}
        ${nhom("Nồi chiên không dầu Lock&Lock 5,2 lít", "Hà Ly", nhan("KOC", "thong-tin"), 14, "5 giờ 12 phút", 2, 47)}
        ${nhom("Bộ 3 hộp thủy tinh chịu nhiệt nắp gài kín hơi dùng được lò vi sóng và tủ đông", "VComm", nhan("VComm", "thanh-cong"), 1, "2 ngày", 0, 3)}`,
        `<div class="the-dt"><p style="margin:0">Hiện chưa có nhóm mua chung nào đang mở.</p></div>`), "Trang chủ")}
      ${dienThoai("Chi tiết nhóm", "Nhóm mua chung", `<span id="chi-tiet"></span>
        <div class="anh-gia lon">Ảnh sản phẩm</div>
        <h3>Nồi chiên không dầu Lock&Lock 5,2 lít · Màu đen</h3>
        <div class="dong"><span class="gian chu-nho">Nhóm của Hà Ly ${nhan("KOC", "thong-tin")}</span>${nhan("Đang mở", "thanh-cong")}</div>
        ${bac(2)}<div class="tien-do"><span style="width:47%"></span><i style="left:6.6%"></i><i style="left:33%"></i></div>
        <div class="dong"><span class="gian">Giá hiện tại nếu chốt ngay</span><b>1.490.000 ₫</b></div>
        <div class="dong"><span class="gian">Bạn trả trước</span><b>1.590.000 ₫ / sản phẩm</b></div>
        <div class="dong"><span class="gian">Kết thúc</span><b>18:30 11/11/2026</b></div>
        <div class="dong"><span class="gian">Tối đa mỗi người</span><b>3 sản phẩm</b></div>
        ${nut("Tham gia nhóm", "chinh", "", "rong")}${nut("Chia sẻ nhóm", "phu", "Đã sao chép đường dẫn nhóm", "rong")}`, "", "#")}
      ${dienThoai("Đặt đơn mua chung (sửa MAN_HINH_93)", "Đặt hàng", `
        ${sanPhamNho("Nồi chiên không dầu Lock&Lock 5,2 lít · Màu đen", "1.590.000 ₫ × 1 (giá bậc đầu)")}
        <div class="the-dt"><div class="dong"><span class="gian">Tiền hàng</span>1.590.000 ₫</div><div class="dong"><span class="gian">Phí giao hàng</span>30.000 ₫</div>
          <div class="dong"><span class="gian">Trả bằng ví mua sắm</span>− 245.000 ₫</div><div class="dong chu-dam"><span class="gian">Còn phải trả trực tuyến</span>1.375.000 ₫</div></div>
        <div class="the-dt"><label class="dong"><input type="checkbox" checked> <span class="gian">Dùng ví mua sắm (số dư 245.000 ₫)</span></label></div>
        <div class="the-dt"><div class="chu-dam">Phương thức thanh toán</div>
          <label class="dong"><input type="radio" name="pt" checked> QR VNPAY</label><label class="dong"><input type="radio" name="pt"> Thẻ ATM nội địa</label>
          <label class="dong chu-nho"><input type="radio" name="pt" disabled> Thanh toán khi nhận hàng (không dùng cho mua chung)</label></div>
        ${hop("Đơn vượt số lượng tối đa mỗi người: bạn đã có 3 sản phẩm trong nhóm này.", "loi")}
        ${nut("Đặt và thanh toán", "chinh", "", "rong")}`, "", "#")}
      ${dienThoai("Mở nhóm (cộng tác viên)", "Mở nhóm mua chung", `
        ${truong("Sản phẩm mua chung", "Nồi chiên không dầu Lock&Lock 5,2 lít · Màu đen")}
        <div class="the-dt">${bac(0)}<div class="chu-nho">Bậc giá do VComm cài đặt. Tối thiểu 2 sản phẩm để thành nhóm.</div></div>
        ${truong("Thời hạn nhóm (giờ, 1 đến 72)", "24")}
        ${hop("Bạn đang có 5 nhóm mở, tối đa 5. Chờ nhóm kết thúc để mở thêm.", "loi")}
        ${nut("Mở nhóm", "chinh", "Đã mở nhóm. Chia sẻ đường dẫn để mời người mua.", "rong")}`, "", "#")}
      ${dienThoai("Kết quả nhóm (chi tiết đơn)", "Đơn DB-2026-001301", `
        <div class="the-dt">${nhan("Nhóm thành công", "thanh-cong")}<div>Giá chốt 1.390.000 ₫ (bậc từ 30 sản phẩm). Đã hoàn 200.000 ₫ vào ví mua sắm.</div>${nhan("Chờ giao", "thong-tin")}</div>
        <div class="the-dt">${nhan("Nhóm không đủ số lượng", "loi")}<div>Nhóm kết thúc với 1 sản phẩm, dưới mốc tối thiểu 2. Đơn đã hủy, hoàn 1.620.000 ₫ vào ví mua sắm.</div><a href="${duongDan(135)}">Xem ví mua sắm ›</a></div>
        <div class="the-dt">${nhan("Chờ chốt nhóm", "canh-bao")}<div>Đã thanh toán. Nhóm kết thúc 18:30 11/11/2026.</div>${nut("Hủy đơn", "nguy-hiem", "Đã hủy đơn, hoàn 1.620.000 ₫ vào ví mua sắm.", "rong")}</div>`, "Đơn hàng", "#")}
    </div>`;
    },

    135: () => `<div class="day-dien-thoai">
      ${dienThoai("Ví mua sắm", "Ví mua sắm", theoTrangThai(`
        <div class="the-dt"><div class="chu-nho">Số dư</div><div class="so-lon">245.000 ₫</div>
          <p class="chu-nho" style="margin:0">Tiền hoàn từ mua chung. Dùng để trả đơn VComm khi đặt hàng; không rút, không chuyển được.</p></div>
        <div class="the-dt"><h3>Lịch sử</h3>
          ${[["Trả đơn DB-2026-001322", "− 200.000 ₫", "11/11/2026 10:05"], ["Chênh lệch mua chung · DB-2026-001301", "+ 200.000 ₫", "10/11/2026 18:31"],
             ["Hoàn nhóm không đủ số lượng · DB-2026-001255", "+ 1.620.000 ₫", "08/11/2026 21:00"], ["Hoàn hủy đơn · DB-2026-001322", "+ 200.000 ₫", "11/11/2026 10:20"]]
            .map(([chu, tien, luc]) => `<div class="dong" style="align-items:flex-start"><div class="gian"><div>${chu}</div><div class="chu-nho">${luc}</div></div><b>${tien}</b></div>`).join("")}</div>`,
        `<div class="the-dt"><div class="chu-nho">Số dư</div><div class="so-lon">0 ₫</div></div><div class="the-dt"><p style="margin:0">Chưa có giao dịch. Tiền hoàn từ mua chung sẽ hiện ở đây.</p></div>`), "Tài khoản", duongDan(133))}
      ${dienThoai("Đặt đơn thường dùng ví (sửa MAN_HINH_93)", "Đặt hàng", `
        ${sanPhamNho("Sữa rửa mặt dịu nhẹ 150 ml × 2", "398.000 ₫")}
        <div class="the-dt"><label class="dong"><input type="checkbox" checked> <span class="gian">Dùng ví mua sắm (số dư 245.000 ₫)</span></label></div>
        <div class="the-dt"><div class="dong"><span class="gian">Tổng thanh toán</span>428.000 ₫</div><div class="dong"><span class="gian">Trả bằng ví mua sắm</span>− 245.000 ₫</div>
          <div class="dong chu-dam"><span class="gian">Thanh toán khi nhận hàng</span>183.000 ₫</div></div>
        ${hop("Số dư ví vừa thay đổi. Kiểm tra lại số tiền trước khi đặt.", "loi")}
        ${nut("Đặt hàng", "chinh", "", "rong")}`, "", "#")}
    </div>`,

    136: () => {
      const bai = (ten, viet, thoiGian, nhanBai, noiDung, anh, sanPham, thich, binhLuan, daThich) => `<article class="the-dt bai-dang">
        <div class="tac-gia"><div class="anh-dai-dien">${viet}</div><div class="gian"><div class="chu-dam">${ten} ${nhanBai}</div><div class="chu-nho">${thoiGian}</div></div><button type="button" class="nut chu" aria-label="Thêm thao tác">⋯</button></div>
        <div class="noi-dung-bai">${noiDung}</div>${anh ? `<div class="luoi-anh">${"<div class='anh-gia'>Ảnh</div>".repeat(anh)}</div>` : ""}${sanPham || ""}
        <div class="hanh-dong-bai"><button type="button" aria-pressed="${daThich}">Thích · ${thich}</button><a href="#chi-tiet-bai" style="color:inherit">Bình luận · ${binhLuan}</a><button type="button" data-thong-bao="Đã gửi báo cáo. Cảm ơn bạn.">Báo cáo</button></div></article>`;
      return `<div class="day-dien-thoai">
      ${dienThoai("Bảng tin", "Bảng tin", theoTrangThai(`
        <div class="dong"><a class="nut chinh" href="#dang-bai">Đăng bài</a><span class="gian"></span><select class="o-nhap" aria-label="Lọc theo sản phẩm" style="max-width:170px"><option>Mọi sản phẩm</option></select></div>
        ${bai("VComm", "VC", "Đã ghim · 10/11/2026", nhan("VComm", "thanh-cong"), "Săn deal 11.11: mua chung nồi chiên giá chỉ từ 1.390.000 ₫. Mời bạn bè nhận 50.000 ₫ vào ví hoa hồng.", 1, "", 128, 12, false)}
        ${bai("Nguyễn Thị Phương Thảo", "PT", "2 giờ trước", nhan("Đã mua hàng", "thanh-cong"), "<span class='sao'>★★★★★</span>\nNồi chiên dùng 2 tuần rất ổn, chiên gà giòn, dễ vệ sinh. Giao hàng nhanh, đóng gói kỹ.", 3, sanPhamNho("Nồi chiên không dầu Lock&Lock 5,2 lít", "1.690.000 ₫"), 34, 5, true)}
        ${bai("Lê Hoàng Bảo Ngọc Khánh Linh Nguyễn Trần", "KL", "Hôm qua", "", "Có ai dùng bộ hộp thủy tinh này để trữ đồ ăn dặm cho bé chưa ạ? Mình đang phân vân giữa loại nắp gài và nắp vặn, mong mọi người cho ý kiến với ạaaaaaaaaaaaaaaaaaaaaaaaaaaaaa.", 0, sanPhamNho("Bộ 3 hộp thủy tinh chịu nhiệt", "289.000 ₫"), 3, 18, false)}`,
        `<a class="nut chinh" href="#dang-bai">Đăng bài</a><div class="the-dt"><p style="margin:0">Chưa có bài đăng nào. Hãy là người đầu tiên chia sẻ.</p></div>`,
        hop("Bạn bị khóa đăng bài và bình luận đến 18/11/2026. Lý do: quảng cáo rác. Bạn vẫn xem được bảng tin.", "canh-bao")), "Bảng tin")}
      ${dienThoai("Đăng bài, viết đánh giá", "Đăng bài", `<span id="dang-bai"></span>
        ${truong("Nội dung (1 đến 2.000 ký tự)", "", "Bài có từ không được phép. Sửa nội dung rồi đăng lại.", "nhieu-dong")}
        <div class="the-dt"><div class="dong"><span class="gian chu-dam">Ảnh (tối đa 5)</span>${nut("Thêm ảnh", "phu")}</div><div class="luoi-anh"><div class="anh-gia">Ảnh</div><div class="anh-gia">Ảnh</div></div></div>
        <div class="the-dt"><div class="dong"><span class="gian chu-dam">Gắn sản phẩm (tối đa 3)</span>${nut("Chọn", "phu")}</div>${sanPhamNho("Nồi chiên không dầu Lock&Lock 5,2 lít", "1.690.000 ₫")}</div>
        <div class="the-dt"><div class="chu-dam">Đánh giá đơn DB-2026-001190 · Sữa rửa mặt 150 ml</div><div class="sao" style="font-size:24px" role="radiogroup" aria-label="Số sao">★★★★☆</div>
          <div class="chu-nho">Chỉ đánh giá được dòng hàng đã giao của bạn; mỗi dòng một lần.</div></div>
        ${hop("Đăng bài và bình luận đang tạm tắt. Vui lòng quay lại sau.", "thong-tin")}
        ${nut("Đăng", "chinh", "Đã đăng bài", "rong")}`, "", duongDan(136))}
      ${dienThoai("Chi tiết bài, bình luận, báo cáo", "Bài đăng", `<span id="chi-tiet-bai"></span>
        ${bai("Lê Hoàng Bảo Ngọc Khánh Linh Nguyễn Trần", "KL", "Hôm qua", "", "Có ai dùng bộ hộp thủy tinh này để trữ đồ ăn dặm cho bé chưa ạ?", 0, "", 3, 18, false)}
        <div class="the-dt">${[["Trịnh Gia Hân", "Mình dùng loại nắp gài, kín lắm bạn, để tủ đông 2 tháng không bị nứt."], ["Phạm Văn Đức", "Nội dung đã bị ẩn do vi phạm quy định cộng đồng."]]
          .map(([ten, nd], i) => `<div class="binh-luan"><div class="chu-dam">${ten}</div><div class="${i ? "chu-nho" : ""}">${nd}</div><div class="chu-nho">1 giờ trước · <button type="button" class="nut chu" data-thong-bao="Đã gửi báo cáo">Báo cáo</button></div></div>`).join("")}
          ${truong("Viết bình luận", "")}${nut("Gửi", "chinh")}</div>
        <div class="the-dt"><h3>Báo cáo vi phạm</h3>${["Quảng cáo rác", "Lừa đảo", "Xúc phạm", "Nội dung cấm", "Khác"].map((l, i) => `<label class="dong"><input type="radio" name="ly-do" ${i ? "" : "checked"}> ${l}</label>`).join("")}
          ${truong("Mô tả (không bắt buộc)", "", "", "nhieu-dong")}${nut("Gửi báo cáo", "nguy-hiem", "Đã gửi báo cáo. Cảm ơn bạn.", "rong")}</div>`, "", duongDan(136))}
    </div>`;
    },

    137: () => web(`<div class="tieu-de"><h1>Cộng tác viên</h1></div>${theWeb(["Hồ sơ cộng tác viên", "Thưởng giới thiệu", "Hoa hồng sản phẩm"], "Hồ sơ cộng tác viên")}
      ${webTheoTrangThai(`<div class="bo-loc"><label class="an-nhan" for="tim">Tìm số điện thoại, tên, mã</label><input id="tim" class="o-nhap" placeholder="Tìm số điện thoại, tên, mã…">
        <select class="o-nhap" aria-label="Trạng thái"><option>Trạng thái: Chờ duyệt</option><option>Đã duyệt</option><option>Từ chối</option><option>Tạm ngừng</option></select>
        <select class="o-nhap" aria-label="Nhãn"><option>Nhãn: tất cả</option><option>KOL</option><option>KOC</option></select></div>
      ${bang(["Người mua", "Số điện thoại", "Mã", "Nhãn", "Trạng thái", "Đơn 30 ngày", "Hoa hồng đã cộng", "Gửi lúc"], [
        ["Hà Ly", "0912 345 678", "K7MZ4QHP", "KOC", nhan("Đã duyệt", "thanh-cong"), "57", "3.870.500 ₫", "01/11/2026"],
        ["Lê Hoàng Bảo Ngọc Khánh Linh Nguyễn Trần", "0987 654 210", "—", "—", nhan("Chờ duyệt", "canh-bao"), "0", "0 ₫", "11/11/2026"],
        ["Đỗ Quang Huy", "0903 111 222", "R4TW9XNA", "KOL", nhan("Tạm ngừng", "trung-tinh"), "3", "120.000 ₫", "20/10/2026"]], [5, 6])}
      <div class="the-web"><div class="tieu-de"><h2>Lê Hoàng Bảo Ngọc Khánh Linh Nguyễn Trần</h2>${nhan("Chờ duyệt", "canh-bao")}</div>
        <div class="luoi-truong"><div><div class="chu-nho">Kênh chia sẻ chính</div>Nhóm Zalo Mẹ và bé Thủ Đức (2.300 thành viên)</div><div><div class="chu-nho">Đồng ý điều khoản</div>Phiên bản 1 · 11/11/2026 09:14</div></div>
        ${truong("Lý do (bắt buộc khi từ chối, tạm ngừng)", "")}
        <div class="nhom-nut">${nut("Duyệt", "chinh", "Đã duyệt, cấp mã P8DK3MWT")}${nut("Từ chối", "nguy-hiem", "Đã từ chối")}</div>
        <div><div class="chu-nho">Nhãn (sau khi duyệt)</div><select class="o-nhap" disabled aria-label="Nhãn"><option>Không nhãn</option><option>KOL</option><option>KOC</option></select></div>
        <div><h3>Lịch sử</h3><div class="chu-nho">11/11/2026 09:14 · Người mua gửi đăng ký</div></div></div>`,
        `<div class="the-web"><p style="margin:0">Chưa có hồ sơ cộng tác viên nào.</p></div>`)}
      <div class="the-web"><h2>Thưởng giới thiệu bạn bè</h2>
        <label class="dong"><input type="checkbox" checked> Đang bật chương trình</label>
        <div class="luoi-truong">${truong("Mức thưởng (đồng, 1 đến 10.000.000)", "50.000")}${truong("Giá trị hoàn tất tối thiểu của đơn (đồng)", "200.000")}</div>
        <p class="chu-nho" style="margin:0">Thưởng một lần cho người giới thiệu khi đơn đầu tiên của người được giới thiệu hoàn tất và đạt mức tối thiểu. Mức thưởng lấy theo cài đặt lúc đơn hoàn tất.</p>
        <div class="nhom-nut">${nut("Lưu", "chinh", "Đã lưu cài đặt thưởng giới thiệu")}</div></div>
      <div class="the-web"><h2>Hoa hồng sản phẩm (sửa màn hình thiết lập hoa hồng của CONG_VIEC_26)</h2>
        ${bang(["Mức", "Giới thiệu", "Cộng tác viên", "Nhân viên", "Trưởng phòng", "Giám đốc Vùng", "Giám đốc Kinh doanh", "Tổng"], [["Phần trăm", "3%", "<b>5%</b>", "4%", "2%", "1%", "1%", "16% (≤ 100%)"]], [1, 2, 3, 4, 5, 6, 7])}</div>`),

    138: () => web(`<div class="tieu-de"><h1>Mua chung</h1>${nut("Mở nhóm", "chinh", "Đã mở nhóm")}</div>${theWeb(["Nhóm", "Cài đặt sản phẩm"], "Nhóm")}
      ${webTheoTrangThai(`<div class="bo-loc"><select class="o-nhap" aria-label="Trạng thái nhóm"><option>Trạng thái: Đang mở</option><option>Thành công</option><option>Thất bại</option><option>Đã hủy</option></select></div>
      ${bang(["Sản phẩm", "Người mở", "Số lượng", "Bậc đạt", "Kết thúc", "Trạng thái"], [
        ["Nồi chiên không dầu Lock&Lock 5,2 lít · Màu đen", "Hà Ly (KOC)", "14", "1.490.000 ₫ (từ 10)", "18:30 11/11/2026", nhan("Đang mở", "thanh-cong")],
        ["Bộ 3 hộp thủy tinh chịu nhiệt nắp gài kín hơi dùng được lò vi sóng và tủ đông", "Trần Minh Khoa (VComm)", "1", "Chưa đạt mốc 2", "09:00 13/11/2026", nhan("Đang mở", "thanh-cong")],
        ["Máy xay sinh tố cầm tay", "Đỗ Quang Huy (KOL)", "1", "—", "21:00 08/11/2026", nhan("Thất bại", "loi")]], [2])}
      <div class="the-web"><div class="tieu-de"><h2>Nhóm nồi chiên của Hà Ly</h2>${nhan("Đang mở", "thanh-cong")}</div>
        ${bang(["Đơn", "Người mua", "Số lượng", "Đã thu", "Trạng thái đơn"], [["DB-2026-001301", "Nguyễn Thị Phương Thảo", "3", "4.800.000 ₫", "Chờ chốt nhóm"], ["DB-2026-001310", "Trịnh Gia Hân", "1", "—", "Chờ thanh toán"]], [2, 3])}
        ${truong("Lý do hủy nhóm", "")}<div class="nhom-nut">${nut("Hủy nhóm", "nguy-hiem", "Đã hủy nhóm, hoàn tiền vào ví mua sắm của người tham gia")}</div></div>`,
        `<div class="the-web"><p style="margin:0">Không có nhóm nào ở trạng thái này.</p></div>`)}
      <div class="the-web"><h2>Cài đặt mua chung · Nồi chiên không dầu Lock&Lock 5,2 lít · Màu đen</h2>
        <div class="dong chu-nho">Giá bán hiện tại: 1.690.000 ₫ (gồm thuế)</div>
        <label class="dong"><input type="checkbox" checked> Bật mua chung cho biến thể này</label>
        ${bang(["Bậc", "Từ tổng số lượng", "Đơn giá gồm thuế", ""], [["1 (mốc tối thiểu)", "<input class='o-nhap' value='2' aria-label='Số lượng bậc 1' style='width:90px'>", "<input class='o-nhap' value='1.590.000' aria-label='Giá bậc 1' style='width:130px'>", ""],
          ["2", "<input class='o-nhap' value='10' aria-label='Số lượng bậc 2' style='width:90px'>", "<input class='o-nhap' value='1.490.000' aria-label='Giá bậc 2' style='width:130px'>", nut("Xóa", "chu")],
          ["3", "<input class='o-nhap' value='30' aria-label='Số lượng bậc 3' style='width:90px'>", "<input class='o-nhap' value='1.500.000' aria-label='Giá bậc 3' style='width:130px'><div class='chu-nho' style='color:var(--mau-loi)'>Giá phải thấp hơn bậc trước.</div>", nut("Xóa", "chu")]])}
        <div>${nut("Thêm bậc", "phu")}</div>
        <div class="luoi-truong">${truong("Thời hạn nhóm tối đa (giờ, 1 đến 168)", "72")}${truong("Tối đa mỗi người mỗi nhóm (1 đến 999)", "3")}</div>
        <div class="nhom-nut">${nut("Lưu", "chinh", "Đã lưu. Nhóm đang mở giữ cài đặt cũ.")}</div></div>`),

    139: () => web(`<div class="tieu-de"><h1>Kiểm duyệt cộng đồng</h1></div>${theWeb(["Báo cáo chờ xử lý", "Nội dung đã ẩn", "Tài khoản bị khóa", "Bài VComm", "Cài đặt"], "Báo cáo chờ xử lý")}
      ${webTheoTrangThai(`${bang(["Nội dung", "Tác giả", "Báo cáo", "Lý do nhiều nhất", "Trạng thái"], [
        ["Bài: \"Inbox mình bán nồi chiên giá rẻ hơn VComm 30%, ship toàn quốc…\"", "Phạm Văn Đức", "7", "Quảng cáo rác", nhan("Tự ẩn tạm", "canh-bao")],
        ["Bình luận: \"Shop lừa đảo, đừng mua\"", "Đỗ Quang Huy", "2", "Xúc phạm", nhan("Đang hiện", "trung-tinh")]], [2])}
      <div class="the-web"><h2>Bài của Phạm Văn Đức · 7 báo cáo</h2><div class="the-web" style="background:var(--mau-nen)">Inbox mình bán nồi chiên giá rẻ hơn VComm 30%, ship toàn quốc, zalo 09xx…</div>
        ${truong("Lý do ẩn (gửi cho tác giả)", "Quảng cáo bán hàng ngoài sàn")}
        <div class="nhom-nut">${nut("Ẩn nội dung", "nguy-hiem", "Đã ẩn, đã báo tác giả")}${nut("Hiện lại, bỏ qua báo cáo", "phu", "Đã hiện lại")}</div>
        <h3>Khóa tài khoản</h3><div class="luoi-truong"><div class="truong-dt"><label for="thoi-han">Thời hạn</label><select id="thoi-han" class="o-nhap"><option>7 ngày</option><option>30 ngày</option><option>Vĩnh viễn</option></select></div>${truong("Lý do khóa", "Quảng cáo rác lặp lại")}</div>
        <div class="nhom-nut">${nut("Khóa đăng bài và bình luận", "nguy-hiem", "Đã khóa đến 18/11/2026")}</div></div>`,
        `<div class="the-web"><p style="margin:0">Không có báo cáo nào chờ xử lý.</p></div>`)}
      <div class="the-web"><h2>Cài đặt</h2>
        <label class="dong"><input type="checkbox" checked> Người mua được đăng bài</label><label class="dong"><input type="checkbox" checked> Người mua được bình luận</label>
        ${hop("Tắt thì nội dung cũ vẫn hiện; chỉ VComm đăng được bài.", "thong-tin")}
        ${truong("Từ cấm (mỗi dòng một cụm từ, tối đa 500)", "lừa đảo\nzalo 09\ninbox giá rẻ", "", "nhieu-dong")}
        <div class="nhom-nut">${nut("Lưu", "chinh", "Đã lưu cài đặt cộng đồng")}</div></div>
      <div class="the-web"><h2>Bài VComm</h2>${truong("Nội dung", "Săn deal 11.11: mua chung nồi chiên giá chỉ từ 1.390.000 ₫.", "", "nhieu-dong")}
        <label class="dong"><input type="checkbox" checked> Ghim (tối đa 3 bài ghim)</label><div class="nhom-nut">${nut("Đăng", "chinh", "Đã đăng bài VComm")}</div></div>`)
  };

  // ---------- Dựng trang ----------
  const goc = document.getElementById("ung-dung");
  const dung = () => {
    goc.innerHTML = `<div class="trang-cong-dong"><header><h1>MAN_HINH_${ma} ${TEP[ma][1]}</h1><p>CONG_VIEC_49 · dữ liệu giả · <a href="index.html">Danh sách bản mẫu</a></p></header>
      <div class="bang-chon" role="group" aria-label="Trạng thái hiển thị"><span class="nhan-bang">Trạng thái:</span>${TRANG_THAI.map(([k, chu]) =>
        `<button type="button" data-trang-thai="${k}" aria-pressed="${k === trangThai}">${chu}</button>`).join("")}
        <span class="gian"></span>${Object.keys(TEP).map(m => `<a href="${duongDan(m)}">${m}</a>`).join(" · ")}</div>
      ${MAN_HINH[ma]()}</div><div class="thong-bao-noi-cd" role="status" aria-live="polite"></div>`;
  };
  document.addEventListener("click", e => {
    const chon = e.target.closest("[data-trang-thai]");
    if (chon) { trangThai = chon.dataset.trangThai; ghi("ban-mau-cong-dong-trang-thai", trangThai); dung(); return; }
    const nutThich = e.target.closest(".hanh-dong-bai button[aria-pressed]");
    if (nutThich) { nutThich.setAttribute("aria-pressed", nutThich.getAttribute("aria-pressed") === "true" ? "false" : "true"); return; }
    const hanhDong = e.target.closest("[data-thong-bao]");
    if (hanhDong && hanhDong.dataset.thongBao) {
      // Nút có trạng thái đang xử lý, không gửi lặp (danh sách rà soát mục 10).
      hanhDong.classList.add("dang-xu-ly"); hanhDong.disabled = true;
      setTimeout(() => {
        hanhDong.classList.remove("dang-xu-ly"); hanhDong.disabled = false;
        const hop = document.querySelector(".thong-bao-noi-cd"); hop.textContent = hanhDong.dataset.thongBao; hop.classList.add("hien");
        setTimeout(() => hop.classList.remove("hien"), 2500);
      }, 600);
    }
  });
  dung();
})();
