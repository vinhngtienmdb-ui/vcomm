// Bản mẫu MODULE_08 Nhân sự phần 2 (CONG_VIEC_47): MAN_HINH_120 đến MAN_HINH_125 từ dữ liệu giả. Không phải mã sản phẩm.
(function () {
  const TEP = {
    "120": "CA_LAM_LICH_LAM_VIEC", "121": "CHAM_CONG", "122": "CHAM_CONG_CUA_TOI",
    "123": "NGHI_PHEP", "124": "TANG_CA", "125": "BANG_CONG_THANG"
  };
  const duongDan = ma => `MAN_HINH_${ma}_${TEP[ma]}.html`;
  const VAI_TRO = { "quan-ly": "Quản lý nhân sự", "nhan-vien-ns": "Nhân viên nhân sự", "truong-phong": "Trưởng phòng (không có quyền nhân sự)", "chi-xem": "Chỉ xem chấm công", "nhan-vien": "Nhân viên (có hồ sơ liên kết)" };
  // Bảng vai trò – màn hình (CONG_VIEC_47 mục 6, 8).
  const DUOC_XEM = {
    "120": ["quan-ly", "nhan-vien-ns", "truong-phong"], "121": ["quan-ly", "nhan-vien-ns", "truong-phong", "chi-xem"], "122": Object.keys(VAI_TRO),
    "123": ["quan-ly", "nhan-vien-ns", "truong-phong", "chi-xem"], "124": ["quan-ly", "nhan-vien-ns", "truong-phong", "chi-xem"], "125": ["quan-ly", "nhan-vien-ns", "chi-xem"]
  };
  const MENU = [["121", "Chấm công"], ["120", "Ca và lịch"], ["123", "Nghỉ phép"], ["124", "Tăng ca"], ["125", "Bảng công"], ["122", "Chấm công của tôi"]];
  const doc = (khoa, macDinh) => { try { return localStorage.getItem(khoa) || macDinh; } catch (e) { return macDinh; } };
  const ghi = (khoa, giaTri) => { try { localStorage.setItem(khoa, giaTri); } catch (e) { /* bỏ qua */ } };
  const ma = document.body.dataset.manHinh;
  let vaiTro = doc("ban-mau-cc-vai-tro", "quan-ly");
  let trangThai = doc("ban-mau-cc-trang-thai", "du-lieu");
  const nhanSu = () => ["quan-ly", "nhan-vien-ns"].includes(vaiTro);
  const truongPhong = () => vaiTro === "truong-phong";

  const thanhTren = () => `<header class="thanh-tren"><a class="logo" href="#">VComm</a><a href="#">Trang chủ</a><span class="gian"></span>
    <button type="button" aria-label="Chọn công ty">VComm Bán lẻ Miền Nam ▾</button><a href="#">Hộp duyệt <span class="huy-hieu">4</span></a>
    <button type="button">Thông báo <span class="huy-hieu">2</span></button><a href="#">Nguyễn Thị Hồng Nhung ▾</a></header>`;
  const menu = () => `<nav class="menu" aria-label="Nhân sự"><div class="ten-app">Nhân sự</div><a href="MAN_HINH_114_DANH_SACH_HO_SO_NHAN_SU.html">Hồ sơ nhân sự</a>${MENU.filter(([m]) => DUOC_XEM[m].includes(vaiTro)).map(([m, t]) =>
    `<a href="${duongDan(m)}" class="${m === ma ? "chon" : ""}">${t}</a>`).join("")}</nav>`;
  const trang = noiDung => `${thanhTren()}<div class="than">${menu()}<main class="noi-dung">${noiDung}</main></div>`;
  const bang = (cot, dong, tong) => `<div class="khung-bang"><table><thead><tr>${cot.map(c => `<th scope="col">${c}</th>`).join("")}</tr></thead>
    <tbody>${dong.map(d => `<tr>${d.map((o, i) => `<td data-nhan="${cot[i] || ""}"><span>${o}</span></td>`).join("")}</tr>`).join("")}</tbody></table>
    ${tong ? `<div class="phan-trang"><span>${tong}</span><span>‹ 1 2 ›</span></div>` : ""}</div>`;
  const nut = (chu, loai, hanhDong, thongBao) => `<button type="button" class="nut ${loai}" data-hanh-dong="${hanhDong || "xu-ly"}" data-thong-bao="${thongBao || ""}">${chu}</button>`;
  const tieuDe = (chu, cacNut) => `<div class="tieu-de"><h1>${chu}</h1>${cacNut || ""}</div>`;
  const nhan = (chu, loai) => `<span class="nhan ${loai}">${chu}</span>`;
  const luaChon = (id, nhanChu, cacGiaTri, loi, goiY) => `<div class="truong"><label for="${id}">${nhanChu}</label><select id="${id}" class="o-nhap${loi ? " loi" : ""}">${cacGiaTri.map(g => `<option>${g}</option>`).join("")}</select>${loi ? `<span class="loi-o">${loi}</span>` : ""}${goiY ? `<span class="chu-thich">${goiY}</span>` : ""}</div>`;
  const truong = (id, nhanChu, kieu, giaTri, loi, goiY) => `<div class="truong"><label for="${id}">${nhanChu}</label>
    <input id="${id}" class="o-nhap${loi ? " loi" : ""}" type="${kieu || "text"}" value="${giaTri || ""}" ${loi ? `aria-describedby="${id}-loi"` : ""}>
    ${loi ? `<span id="${id}-loi" class="loi-o">${loi}</span>` : ""}${goiY ? `<span class="chu-thich">${goiY}</span>` : ""}</div>`;
  const vungChu = (id, nhanChu, giaTri) => `<div class="truong"><label for="${id}">${nhanChu}</label><textarea id="${id}" class="o-nhap" rows="2">${giaTri || ""}</textarea></div>`;
  const cacThe = (ten, chon) => `<div class="cac-the" role="tablist">${ten.map((t, i) => `<button type="button" role="tab" data-the="${i}" class="${i === (chon || 0) ? "chon" : ""}">${t}</button>`).join("")}</div>`;
  const noiDungThe = (i, html, chon) => `<div data-noi-dung-the="${i}" ${i === (chon || 0) ? "" : "hidden"}>${html}</div>`;

  const THU = ["T2", "T3", "T4", "T5", "T6", "T7", "CN"];
  const NV = [
    ["NV000123", "Trần Minh Khoa", "Phòng Mua hàng"], ["NV000124", "Lê Thị Bích Ngọc", "Phòng Kế toán"],
    ["NV000131", "Phạm Gia Huy", "Kho Bình Dương"], ["NV000098", "Đỗ Quốc Bảo Nguyễn Hoàng Anh", "Phòng Kinh doanh"], ["NV000140", "Võ Thị Thanh Hương", "Kho Bình Dương"]
  ];
  // Ký hiệu công một ngày: [chữ, loại nhãn, chú thích]
  const O_CONG = {
    "1": ["1", "thanh-cong", "Đủ công"], "0.94": ["0,94", "canh-bao", "Đi muộn 29 phút"], "0.5": ["½", "thong-tin", "Ca nửa ngày"], "P": ["P", "thong-tin", "Nghỉ phép năm"],
    "L": ["L", "trung-tinh", "Ngày lễ"], "-": ["–", "trung-tinh", "Nghỉ hằng tuần"], "V": ["V", "loi", "Vắng không phép"], "?": ["!", "loi", "Thiếu lượt chấm"], "TC": ["1+2", "thanh-cong", "Đủ công, tăng ca 2 giờ"], "O": ["Ô", "thong-tin", "Nghỉ ốm (bảo hiểm xã hội)"]
  };
  const DONG_CONG = [
    ["1", "1", "0.94", "1", "TC", "0.5", "-", "1", "1", "1", "P", "1", "0.5", "-"],
    ["1", "1", "1", "1", "1", "0.5", "-", "P", "P", "1", "1", "1", "0.5", "-"],
    ["1", "?", "1", "1", "1", "1", "-", "1", "1", "TC", "1", "V", "1", "-"],
    ["0.94", "1", "1", "O", "O", "0.5", "-", "1", "1", "1", "1", "1", "0.5", "-"],
    ["1", "1", "1", "1", "1", "1", "-", "1", "0.94", "1", "1", "1", "1", "-"]
  ];
  const oCong = (k, nv, ngay) => { const [chu, loai, chuThich] = O_CONG[k]; return `<button type="button" class="o-cong ${loai}" data-hanh-dong="chi-tiet-ngay" data-nv="${nv}" data-ngay="${ngay}" title="${chuThich}" aria-label="${NV[nv][1]}, ngày ${ngay}/11: ${chuThich}">${chu}</button>`; };
  const luoiCong = (soNguoi) => `<div class="khung-bang"><table class="luoi-cong"><thead><tr><th scope="col">Nhân viên</th>${DONG_CONG[0].map((_, i) => `<th scope="col">${i + 2}<br><span class="chu-thich">${THU[i % 7]}</span></th>`).join("")}<th scope="col">Công</th></tr></thead>
    <tbody>${NV.slice(0, soNguoi).map((n, r) => `<tr><th scope="row"><span class="ten-dong">${n[1]}</span><span class="chu-thich">${n[0]} · ${n[2]}</span></th>${DONG_CONG[r].map((k, i) => `<td>${oCong(k, r, i + 2)}</td>`).join("")}<td><strong>${["9,44", "8,00", "9,00", "8,44", "10,94"][r]}</strong></td></tr>`).join("")}</tbody></table>
    <div class="phan-trang"><span>Chú giải: ${Object.values(O_CONG).map(([c, l, t]) => `<span class="nhan ${l}">${c}</span> ${t}`).join(" · ")}</span></div></div>`;

  const VE = {
    "120": () => {
      const the = truongPhong() ? ["Xếp ca"] : ["Ca làm", "Lịch tuần", "Xếp ca", "Ngày lễ", "Cài đặt", "Địa điểm chấm công"];
      const xepCa = `<div class="bo-loc"><label for="tuan" class="an-nhan">Tuần</label><select id="tuan" class="o-nhap"><option>Tuần 16/11 – 22/11/2026</option></select>
          <label for="pb-xc" class="an-nhan">Phòng ban</label><select id="pb-xc" class="o-nhap"><option>Kho Bình Dương</option></select>
          ${nut("Chép tuần trước", "phu", "xu-ly", "Đã chép xếp ca tuần 09/11.")}${nut("Nhập Excel", "phu", "nhap-xep-ca")}${nut("Lưu xếp ca", "chinh", "xu-ly", "Đã lưu xếp ca tuần 16/11.")}</div>
        <div class="khoi-canh-bao canh-bao">Phạm Gia Huy (chưa thành niên): tổng 44 giờ trong tuần, vượt giới hạn 40 giờ (Bộ luật Lao động Điều 146). Võ Thị Thanh Hương: nghỉ giữa ca Đêm ngày 18/11 và ca Sáng ngày 19/11 chỉ 8 giờ, dưới 12 giờ (Điều 110).</div>
        <div class="khung-bang"><table class="luoi-cong"><thead><tr><th scope="col">Nhân viên</th>${THU.map((t, i) => `<th scope="col">${t}<br><span class="chu-thich">${16 + i}/11</span></th>`).join("")}<th scope="col">Giờ tuần</th></tr></thead><tbody>
        ${[["Phạm Gia Huy", ["Sáng", "Sáng", "Chiều", "Chiều", "Sáng", "Sáng", "Nghỉ"], `44 ${nhan("Vượt 40", "loi")}`], ["Võ Thị Thanh Hương", ["HC", "HC", "Đêm", "Sáng", "HC", "Nửa ngày", "Nghỉ"], "44"], ["Nguyễn Văn Tâm Đức", ["Đêm", "Đêm", "Nghỉ", "Đêm", "Đêm", "Đêm", "Nghỉ"], "40"]].map((d, r) =>
          `<tr><th scope="row">${d[0]}</th>${d[1].map((c, i) => `<td><select aria-label="${d[0]} ${THU[i]}" class="o-nhap o-ca"><option>${c}</option><option>HC</option><option>Sáng</option><option>Chiều</option><option>Đêm</option><option>Nửa ngày</option><option>Nghỉ</option></select></td>`).join("")}<td>${d[2]}</td></tr>`).join("")}
        </tbody></table></div><span class="chu-thich">Ô để trống lấy theo lịch tuần (lịch nhân viên → lịch phòng ban → lịch mặc định). Ngày thuộc kỳ bảng công đã chốt không sửa được.</span>`;
      const noiDung = truongPhong() ? [xepCa] : [
        `<div class="tieu-de"><h2>Ca làm</h2>${nut("Thêm ca", "chinh", "ca")}</div>${bang(["Mã", "Tên", "Giờ", "Nghỉ giữa ca", "Giờ chuẩn", "Giờ đêm", "Hệ số công", "Trạng thái", ""], [
          ["HC", "Hành chính", "08:00 – 17:00", "12:00, 60 phút (không tính)", "8", "0", "1", nhan("Đang dùng", "thanh-cong"), `<button type="button" class="nut chu" data-hanh-dong="ca">Sửa</button>`],
          ["SANG", "Ca sáng kho", "06:00 – 14:00", "10:00, 30 phút (tính vào giờ làm)", "8", "0", "1", nhan("Đang dùng", "thanh-cong"), `<button type="button" class="nut chu" data-hanh-dong="ca">Sửa</button>`],
          ["DEM", "Ca đêm kho", "22:00 – 06:00 (hôm sau)", "02:00, 45 phút (tính vào giờ làm)", "8", "8", "1", nhan("Đang dùng", "thanh-cong"), `<button type="button" class="nut chu" data-hanh-dong="ca">Sửa</button>`],
          ["T7", "Nửa ngày thứ bảy", "08:00 – 12:00", "Không", "4", "0", "0,5", nhan("Đang dùng", "thanh-cong"), `<button type="button" class="nut chu" data-hanh-dong="ca">Sửa</button>`]])}`,
        `<div class="tieu-de"><h2>Lịch tuần</h2>${nut("Thêm lịch tuần", "chinh", "lich-tuan")}</div>${bang(["Tên", ...THU, "Áp dụng"], [
          [`Văn phòng ${nhan("Mặc định", "thong-tin")}`, "HC", "HC", "HC", "HC", "HC", "T7", "Nghỉ", "Mọi người chưa gán lịch khác"],
          ["Kho ca xoay", "SANG", "SANG", "SANG", "SANG", "SANG", "SANG", "Nghỉ", `Kho Bình Dương từ 01/11/2026 · <button type="button" class="nut chu" data-hanh-dong="gan-lich">Gán</button>`]])}`,
        xepCa,
        `<div class="tieu-de"><h2>Ngày lễ năm 2026</h2><label for="nam-le" class="an-nhan">Năm</label><select id="nam-le" class="o-nhap" style="width:auto"><option>2026</option><option>2027</option></select>${nut("Thêm ngày nghỉ riêng của công ty", "phu", "ngay-le")}</div>
          <div class="khoi-canh-bao thong-tin">Lịch chung do Quản trị tập đoàn khai báo; bạn chỉ thêm ngày nghỉ có hưởng lương riêng của công ty. Ngày lễ trùng nghỉ hằng tuần: khai báo ngày nghỉ bù theo thông báo hằng năm.</div>
          ${bang(["Ngày", "Tên", "Phạm vi", "Áp dụng", ""], [
            ["01/01/2026", "Tết Dương lịch", "Chung tập đoàn", "Mọi người", ""], ["16/02 – 20/02/2026", "Tết Âm lịch (5 ngày)", "Chung tập đoàn", "Mọi người", ""], ["27/04/2026", "Giỗ Tổ Hùng Vương", "Chung tập đoàn", "Mọi người", ""],
            ["30/04/2026", "Ngày Chiến thắng", "Chung tập đoàn", "Mọi người", ""], ["01/05/2026", "Quốc tế lao động", "Chung tập đoàn", "Mọi người", ""], ["01/09 – 02/09/2026", "Quốc khánh", "Chung tập đoàn", "Mọi người", ""],
            ["20/03/2026", "Tết cổ truyền nước của người lao động", "Chung tập đoàn", "Người nước ngoài", ""], ["15/06/2026", "Ngày thành lập công ty", `${nhan("Riêng công ty", "thong-tin")}`, "Mọi người", `<button type="button" class="nut chu" data-hanh-dong="xoa">Xóa</button>`]])}`,
        `<div class="the"><h2>Cài đặt chấm công</h2><div class="hai-cot">
          ${luaChon("tg", "Thời giờ làm việc bình thường", ["Theo ngày (ca tối đa 8 giờ)", "Theo tuần (ca tối đa 10 giờ, 48 giờ/tuần)"])}
          ${truong("an-han", "Ngưỡng ân hạn đi muộn, về sớm (phút)", "number", "5", "", "Từ 0 đến 30. Vào muộn, ra sớm không quá ngưỡng coi như đúng giờ.")}
          ${luaChon("dd", "Nơi được chấm công trên ứng dụng", ["Chỉ địa điểm của chi nhánh làm việc", "Mọi địa điểm của công ty"])}
          ${luaChon("ton", "Phép năm tồn", ["Hết hạn sau số tháng của năm sau", "Không hết hạn"])}
          ${truong("ton-thang", "Số tháng được dùng phép tồn", "number", "3", "", "Từ 1 đến 36 (tối đa nghỉ gộp 3 năm, Bộ luật Lao động Điều 113 khoản 4). 3 nghĩa là hết 31/3 năm sau.")}
          ${luaChon("nghi-truoc", "Cho nghỉ trước số ngày chưa cộng dồn", ["Không", "Có (đến hết số ngày của năm)"])}
          ${luaChon("gioi-han", "Giới hạn tăng ca trong năm", ["200 giờ", "300 giờ – ngành, nghề tại Điều 107 khoản 3 hoặc Nghị định 145 Điều 61"], "", "Chọn 300 giờ thì phải thông báo Sở Lao động – Thương binh và Xã hội trong 15 ngày kể từ khi vượt 200 giờ.")}
          ${truong("so-don", "Số đơn giải trình tối đa mỗi tháng", "number", "0", "", "0 là không giới hạn.")}</div>
          <div class="nhom-nut">${nut("Lưu cài đặt", "chinh", "xu-ly", "Đã lưu cài đặt chấm công.")}</div></div>`,
        `<div class="tieu-de"><h2>Địa điểm chấm công</h2>${nut("Thêm địa điểm", "chinh", "dia-diem")}</div>${bang(["Tên", "Chi nhánh", "GPS", "Mạng công ty", "Mã QR động", ""], [
          ["Văn phòng Quận 7", "VCR-HCM", "10.7296, 106.7218 · 150 m", "203.162.10.0/28", nhan("Bật", "thanh-cong"), `<button type="button" class="nut chu" data-hanh-dong="dia-diem">Sửa</button> <button type="button" class="nut chu" data-hanh-dong="ma-qr">Mở màn hình mã QR</button>`],
          ["Kho Bình Dương", "VCR-BD", "10.9804, 106.6519 · 300 m", "Không", nhan("Bật", "thanh-cong"), `<button type="button" class="nut chu" data-hanh-dong="dia-diem">Sửa</button> <button type="button" class="nut chu" data-hanh-dong="ma-qr">Mở màn hình mã QR</button>`],
          ["Cửa hàng Hà Nội (chỉ wifi)", "VCR-HN", "Không", "113.190.40.0/24, 113.190.41.12/32", nhan("Tắt", "trung-tinh"), `<button type="button" class="nut chu" data-hanh-dong="dia-diem">Sửa</button>`]])}`
      ];
      return trang(`${tieuDe("Ca làm và lịch làm việc")}${cacThe(the, truongPhong() ? 0 : 2)}${noiDung.map((h, i) => noiDungThe(i, h, truongPhong() ? 0 : 2)).join("")}`);
    },

    "121": () => trang(`${tieuDe("Chấm công", nhanSu() ? `${nut("Nhập tệp máy chấm công", "chinh", "nhap-tep")}${nut("Ghi công thủ công", "phu", "thu-cong")}` : "")}
      ${cacThe(["Công theo ngày", "Đơn giải trình", "Lịch sử nhập tệp"])}
      ${noiDungThe(0, `<div class="bo-loc"><label for="thang" class="an-nhan">Tháng</label><select id="thang" class="o-nhap"><option>Tháng 11/2026 · 02/11 – 15/11</option></select>
        <label for="pb" class="an-nhan">Phòng ban</label><select id="pb" class="o-nhap">${truongPhong() ? "<option>Kho Bình Dương (phòng của tôi)</option>" : "<option>Phòng ban: tất cả</option>"}</select>
        <label for="cn" class="an-nhan">Chi nhánh</label><select id="cn" class="o-nhap"><option>Chi nhánh: tất cả</option></select>
        <label for="tt" class="an-nhan">Tình trạng</label><select id="tt" class="o-nhap"><option>Tình trạng: tất cả</option><option>Thiếu lượt chấm</option><option>Vắng không phép</option><option>Đi muộn, về sớm</option></select></div>
        <div class="khoi-canh-bao canh-bao">2 ngày thiếu lượt chấm, 1 ngày vắng không phép chưa xử lý. Bấm vào ô để xem chi tiết.</div>${luoiCong(truongPhong() ? 2 : 5)}`)}
      ${noiDungThe(1, bang(["Số", "Nhân viên", "Ngày", "Loại", "Giờ vào – ra", "Lý do", "Trạng thái"], [
        ["GT-VCR-2026-000041", "Phạm Gia Huy", "03/11/2026", "Quên chấm", "— → 17:05", "Quên chấm vào ca, có camera kho xác nhận", nhan("Chờ duyệt", "canh-bao")],
        ["GT-VCR-2026-000038", "Trần Minh Khoa", "29/10/2026", "Đi công tác", "08:00 → 17:00", "Làm việc tại nhà cung cấp Long An theo phân công", nhan("Đã duyệt", "thanh-cong")]], "2 đơn"))}
      ${noiDungThe(2, bang(["Thời điểm", "Tệp", "Người nhập", "Đạt", "Trùng bỏ qua", "Lỗi"], [
        ["09/11/2026 17:42", "may-cham-cong-kho-bd-tuan45.xlsx", "Nguyễn Thị Hồng Nhung", "412", "18", "0"], ["02/11/2026 08:10", "vp-q7-thang10.csv", "Nguyễn Thị Hồng Nhung", "1.208", "0", "3"]]))}`),

    "122": () => `${thanhTren()}<main class="noi-dung trang-dien-thoai">
      ${tieuDe("Chấm công của tôi")}
      <div class="the cham-nhanh"><div><strong>Hôm nay, thứ năm 12/11/2026</strong><div class="chu-thich">Ca HC · 08:00 – 17:00 · nghỉ 12:00, 60 phút</div></div>
        <div class="lua-chon-gon">${nhan("Vị trí: trong 42 m của Văn phòng Quận 7", "thanh-cong")} ${nhan("Mạng công ty", "thanh-cong")}</div>
        <button type="button" class="nut chinh nut-lon" data-hanh-dong="cham" data-thong-bao="Đã ghi Vào ca lúc 07:56 tại Văn phòng Quận 7 (GPS).">Vào ca</button>
        <span class="chu-thich">Lượt hôm nay: chưa có. Trình duyệt sẽ hỏi quyền vị trí; vị trí chỉ lưu tại lượt chấm. Có màn hình mã QR tại văn phòng? Quét bằng camera điện thoại.</span></div>
      <div class="the"><dl class="thong-tin-dong"><dt>Phép năm còn lại</dt><dd>6,50 ngày (2025: 1,50 hết hạn 31/03/2027 · 2026: 5,00)</dd><dt>Tăng ca tháng này</dt><dd>6 / 40 giờ · năm 2026: 86 / 200 giờ</dd></dl>
        <div class="nhom-nut">${nut("Lập đơn nghỉ", "phu", "don-nghi")}${nut("Đơn giải trình công", "phu", "giai-trinh")}${nut("Đăng ký tăng ca", "phu", "tang-ca")}</div></div>
      ${cacThe(["Lịch ca", "Công tháng", "Đơn của tôi"], 1)}
      ${noiDungThe(0, bang(["Ngày", "Ca", "Giờ"], [["T2 16/11", "HC", "08:00 – 17:00"], ["T3 17/11", "HC", "08:00 – 17:00"], ["T4 18/11", "HC", "08:00 – 17:00"], ["T5 19/11", "HC", "08:00 – 17:00"], ["T6 20/11", "HC", "08:00 – 17:00"], ["T7 21/11", "Nửa ngày thứ bảy", "08:00 – 12:00"], ["CN 22/11", "Nghỉ", "—"]]), 1)}
      ${noiDungThe(1, `<div class="khoi-canh-bao thong-tin">Bảng công tháng 10/2026 đang chờ bạn xác nhận đến hết ngày 03/11/2026. Không xác nhận thì hệ thống tự xác nhận khi hết hạn.</div>
        <div class="the"><dl class="thong-tin-dong"><dt>Công chuẩn</dt><dd>24,00</dd><dt>Công làm việc</dt><dd>21,44</dd><dt>Phép năm</dt><dd>2,00</dd><dt>Ngày lễ</dt><dd>0</dd><dt>Ngày công hưởng lương</dt><dd>23,44</dd><dt>Đi muộn</dt><dd>3 lần · 41 phút</dd><dt>Tăng ca</dt><dd>Ngày thường 6 giờ · nghỉ hằng tuần 4 giờ</dd></dl>
        <div class="nhom-nut">${nut("Xác nhận", "chinh", "xu-ly", "Đã xác nhận bảng công tháng 10/2026.")}${nut("Giải trình", "phu", "giai-trinh-bang-cong")}</div></div>
        ${bang(["Ngày", "Ca", "Vào – ra", "Công", "Ghi chú"], [["T2 05/10", "HC", "07:58 – 17:10", "1", ""], ["T3 06/10", "HC", "08:29 – 17:02", "0,94", nhan("Muộn 29 phút", "canh-bao")], ["T4 07/10", "HC", "—", "P", "Phép năm"], ["T5 08/10", "HC", "08:01 – 20:15", "1", "Tăng ca 18:00 – 20:00 (2 giờ)"], ["T6 09/10", "HC", "07:55 – —", nhan("Thiếu lượt", "loi"), `<button type="button" class="nut chu" data-hanh-dong="giai-trinh">Giải trình</button>`]])}`, 1)}
      ${noiDungThe(2, `<div class="khoi-canh-bao canh-bao">Trưởng phòng đề nghị bạn tăng ca 20/11/2026, 18:00 – 21:00, kiểm kê cuối tháng tại Kho Bình Dương. ${nut("Đồng ý", "chinh", "xu-ly", "Đã đồng ý, phiếu TC-VCR-2026-000077 được gửi duyệt.")} ${nut("Không đồng ý", "phu", "xu-ly", "Đã từ chối; phiếu bị hủy.")}</div>
        ${bang(["Số", "Loại", "Thời gian", "Trạng thái", ""], [["NP-VCR-2026-000112", "Đơn nghỉ · Phép năm", "24/11 (cả ngày) – 25/11 (sáng) · 1,5 ngày", nhan("Chờ duyệt", "canh-bao"), `<button type="button" class="nut chu" data-hanh-dong="xu-ly" data-thong-bao="Đã rút đơn.">Rút</button>`],
          ["GT-VCR-2026-000041", "Giải trình · Quên chấm", "03/11 · ra 17:05", nhan("Đã duyệt", "thanh-cong"), ""], ["TC-VCR-2026-000061", "Tăng ca", "08/10 · 18:00 – 20:00 · 2 giờ", nhan("Đã duyệt", "thanh-cong"), ""]])}`, 1)}
    </main>`,

    "123": () => trang(`${tieuDe("Nghỉ phép", nhanSu() ? nut("Ghi nhận nghỉ thay", "chinh", "ghi-nhan-nghi") : "")}
      ${cacThe(nhanSu() ? ["Đơn nghỉ", "Sổ phép", "Loại nghỉ"] : ["Đơn nghỉ", "Sổ phép"])}
      ${noiDungThe(0, `<div class="bo-loc"><label for="lnt" class="an-nhan">Trạng thái</label><select id="lnt" class="o-nhap"><option>Trạng thái: tất cả</option><option>Chờ duyệt</option><option>Đã duyệt</option><option>Đã hủy</option></select>
        <label for="lnl" class="an-nhan">Loại nghỉ</label><select id="lnl" class="o-nhap"><option>Loại nghỉ: tất cả</option></select><label for="lnp" class="an-nhan">Phòng ban</label><select id="lnp" class="o-nhap"><option>Phòng ban: tất cả</option></select></div>
        ${bang(["Số", "Nhân viên", "Loại", "Thời gian", "Số ngày", "Nguồn", "Trạng thái", ""], [
          ["NP-VCR-2026-000112", "Lê Thị Bích Ngọc", "Phép năm", "24/11 – 25/11 (sáng)", "1,5", "Tự lập", nhan("Chờ duyệt", "canh-bao"), ""],
          ["NP-VCR-2026-000109", "Đỗ Quốc Bảo Nguyễn Hoàng Anh", "Ốm đau (bảo hiểm xã hội)", "05/11 – 06/11", "2", "Nhân sự ghi nhận · có giấy ra viện", nhan("Đã duyệt", "thanh-cong"), nhanSu() ? `<button type="button" class="nut chu" data-hanh-dong="huy">Hủy</button>` : ""],
          ["NP-VCR-2026-000101", "Trần Minh Khoa", "Kết hôn", "16/10 – 18/10", "3", "Tự lập", nhan("Đã duyệt", "thanh-cong"), ""],
          ["NP-VCR-2026-000097", "Phạm Gia Huy", "Phép năm", "12/10", "1", "Tự lập", nhan("Bị từ chối", "loi"), ""]], "4 đơn")}`)}
      ${noiDungThe(1, `<div class="bo-loc"><label for="nam-so" class="an-nhan">Năm</label><select id="nam-so" class="o-nhap"><option>Năm 2026</option></select>${nhanSu() ? nut("Điều chỉnh sổ phép", "phu", "dieu-chinh") : ""}</div>
        ${bang(["Nhân viên", "Chế độ", "Ngày/năm", "Tồn năm trước", "Đã cộng", "Đã nghỉ", "Hết hạn", "Còn lại", ""], [
          ["Lê Thị Bích Ngọc", "Bình thường", "12", "1,50 (hết hạn 31/03/2027)", "11,00", "6,00", "0", "6,50", nhanSu() ? `<button type="button" class="nut chu" data-hanh-dong="che-do">Sửa chế độ</button>` : ""],
          ["Phạm Gia Huy", `Chưa thành niên ${nhan("Tự động", "thong-tin")}`, "14", "0", "1,17", "0", "0", "1,17", ""],
          ["Đỗ Quốc Bảo Nguyễn Hoàng Anh", "Bình thường · thâm niên 3 năm", "12", "4,00", "11,00", "3,00", "2,00", "10,00", ""],
          ["Trần Minh Khoa", "Nặng nhọc, độc hại", "14", "0", "12,83", "13,00", "0", nhan("−0,17", "loi"), ""]])}
        <span class="chu-thich">Mỗi đầu tháng cộng (số ngày/năm + thâm niên) / 12. Tháng có ngày công hưởng lương dưới 50% công chuẩn bị trừ lại khi chốt bảng công (Nghị định 145 Điều 66).</span>`)}
      ${nhanSu() ? noiDungThe(2, `<div class="tieu-de"><h2>Loại nghỉ</h2>${nut("Thêm loại nghỉ", "chinh", "loai-nghi")}</div>${bang(["Tên", "Nhóm", "Giới hạn", "Cần tệp", "Nguồn"], [
          ["Phép năm", "Có lương · trừ sổ phép", "Theo sổ phép", "Không", "Theo luật"], ["Kết hôn", "Việc riêng có lương", "3 ngày/lần", "Không", "Theo luật"], ["Con kết hôn", "Việc riêng có lương", "1 ngày/lần", "Không", "Theo luật"],
          ["Tang cha, mẹ, vợ hoặc chồng, con", "Việc riêng có lương", "3 ngày/lần", "Không", "Theo luật"], ["Việc riêng không lương (ông bà, anh chị em…)", "Không lương", "1 ngày/lần", "Không", "Theo luật"],
          ["Không lương theo thỏa thuận", "Không lương", "Không", "Không", "Theo luật"], ["Ốm đau", "Bảo hiểm xã hội", "Không", "Có (nhân sự ghi nhận)", "Theo luật"], ["Thai sản", "Bảo hiểm xã hội", "Không", "Có (nhân sự ghi nhận)", "Theo luật"],
          ["Tai nạn lao động, bệnh nghề nghiệp", "Bảo hiểm xã hội", "Không", "Có (nhân sự ghi nhận)", "Theo luật"], ["Nghỉ sinh nhật", "Có lương", "1 ngày/năm", "Không", `${nhan("Công ty", "thong-tin")} <button type="button" class="nut chu" data-hanh-dong="loai-nghi">Sửa</button>`]])}`) : ""}`),

    "124": () => trang(`${tieuDe("Tăng ca", nhanSu() || truongPhong() ? nut("Lập phiếu tăng ca", "chinh", "tang-ca") : "")}
      ${cacThe(["Phiếu tăng ca", "Tổng giờ theo nhân viên"])}
      ${noiDungThe(0, `<div class="bo-loc"><label for="tct" class="an-nhan">Tháng</label><select id="tct" class="o-nhap"><option>Tháng 11/2026</option></select><label for="tctt" class="an-nhan">Trạng thái</label><select id="tctt" class="o-nhap"><option>Trạng thái: tất cả</option><option>Chờ đồng ý</option><option>Chờ duyệt</option><option>Đã duyệt</option></select></div>
        ${bang(["Số", "Nhân viên", "Ngày", "Giờ", "Loại ngày", "Giờ đăng ký", "Giờ được tính", "Trạng thái"], [
          ["TC-VCR-2026-000077", "Phạm Gia Huy", "20/11/2026", "18:00 – 21:00", "Ngày thường", "3", "—", `${nhan("Bị chặn", "loi")} <span class="chu-thich">Lao động chưa thành niên</span>`],
          ["TC-VCR-2026-000076", "Võ Thị Thanh Hương", "20/11/2026", "18:00 – 21:00", "Ngày thường", "3", "—", nhan("Chờ đồng ý", "trung-tinh")],
          ["TC-VCR-2026-000072", "Trần Minh Khoa", "15/11/2026", "08:00 – 16:00", "Nghỉ hằng tuần", "8", "—", nhan("Chờ duyệt", "canh-bao")],
          ["TC-VCR-2026-000065", "Đỗ Quốc Bảo Nguyễn Hoàng Anh", "06/11/2026", "18:00 – 23:00", "Ngày thường", "5", "4,5 (đêm 1)", nhan("Đã duyệt", "thanh-cong")]], "4 phiếu")}`)}
      ${noiDungThe(1, bang(["Nhân viên", "Tháng 11", "Còn trong tháng", "Năm 2026", "Còn trong năm"], [
        ["Trần Minh Khoa", "36", nhan("4", "canh-bao"), "188", nhan("12", "canh-bao")], ["Đỗ Quốc Bảo Nguyễn Hoàng Anh", "4,5", "35,5", "92", "108"], ["Võ Thị Thanh Hương", "0", "40", "12", "188"]]))}`),

    "125": () => trang(`${tieuDe(`Bảng công tháng 10/2026 ${nhan("Đang xác nhận", "canh-bao")}`, vaiTro !== "chi-xem" ? `${nut("Xuất Excel", "phu", "xu-ly", "Đã tạo tệp bang-cong-2026-10.xlsx.")}${nut("Chốt bảng công", "chinh", "chot")}` : nut("Xuất Excel", "phu", "xu-ly", "Đã tạo tệp bang-cong-2026-10.xlsx."))}
      <div class="the"><dl class="thong-tin-dong"><dt>Hạn xác nhận</dt><dd>03/11/2026 (còn 2 ngày)</dd><dt>Xác nhận</dt><dd>38 / 45 người · 1 giải trình chưa trả lời · 6 chờ</dd><dt>Bảng lương kỳ này</dt><dd>Chưa chốt</dd></dl></div>
      <div class="khoi-canh-bao canh-bao">Còn 1 giải trình chưa trả lời; trả lời xong mới chốt được.</div>
      <div class="bo-loc"><label for="bcp" class="an-nhan">Phòng ban</label><select id="bcp" class="o-nhap"><option>Phòng ban: tất cả</option></select><label for="bcx" class="an-nhan">Xác nhận</label><select id="bcx" class="o-nhap"><option>Xác nhận: tất cả</option><option>Giải trình</option><option>Chờ</option></select></div>
      ${bang(["Nhân viên", "Công chuẩn", "Làm việc", "Lễ", "Phép năm", "Nghỉ có lương khác", "Không lương", "Bảo hiểm xã hội", "Vắng", "Hưởng lương", "Giờ đêm", "Tăng ca (giờ)", "Muộn, sớm", "Xác nhận"], [
        [`<a href="#" data-hanh-dong="dong-bang-cong">Lê Thị Bích Ngọc</a>`, "24,00", "21,44", "0", "2,00", "0", "0", "0", "0", "23,44", "0", "Thường 6 · nghỉ tuần 4", "3 lần · 41 phút", nhan("Đã xác nhận", "thanh-cong")],
        [`<a href="#" data-hanh-dong="dong-bang-cong">Phạm Gia Huy</a>`, "24,00", "22,00", "0", "0", "0", "0", "0", "1,00", "22,00", "0", "0", "0", `${nhan("Giải trình", "loi")}`],
        [`<a href="#" data-hanh-dong="dong-bang-cong">Đỗ Quốc Bảo Nguyễn Hoàng Anh</a>`, "24,00", "20,00", "0", "1,00", "1,00 (kết hôn)", "0", "2,00", "0", "22,00", "12", "Đêm thường 1 · thường 3,5", "1 lần · 9 phút", nhan("Chờ", "trung-tinh")],
        [`<a href="#" data-hanh-dong="dong-bang-cong">Nguyễn Văn Tâm Đức</a> ${nhan("Nghỉ việc 20/10", "thong-tin")}`, "14,00", "13,00", "0", "1,00", "0", "0", "0", "0", "14,00", "64", "0", "0", nhan("Tự xác nhận do hết hạn", "trung-tinh")]], "45 người")}
      <span class="chu-thich">Đã chốt thì dữ liệu tháng 10 bị khóa. Mở lại được khi bảng lương kỳ này chưa chốt; nhập lý do, ghi nhật ký.</span>`)
  };

  const TRANG_THAI = {
    "rong": () => `<div class="trang-thai-trong"><h2>Chưa có dữ liệu</h2><p style="margin:0">${{ "120": "Chưa có ca làm. Bấm \"Thêm ca\" để bắt đầu.", "121": "Chưa có lượt chấm trong tháng. Nhập tệp máy chấm công hoặc chờ người lao động chấm trên ứng dụng.", "122": "Tài khoản của bạn chưa được liên kết với hồ sơ nhân sự ở công ty này.", "123": "Chưa có đơn nghỉ.", "124": "Chưa có phiếu tăng ca trong tháng.", "125": "Tháng này chưa kết thúc hoặc chưa có dữ liệu chấm công." }[ma]}</p></div>`,
    "dang-tai": () => `<div class="the" aria-busy="true"><p style="margin:0">Đang tải…</p></div>`,
    "loi": () => `<div class="khoi-canh-bao loi">Không tải được dữ liệu. <button type="button" class="nut phu">Thử lại</button></div>`,
    "khong-quyen": () => `<div class="trang-thai-trong"><h2>Bạn không có quyền xem trang này</h2><p style="margin:0">Liên hệ quản trị công ty nếu bạn cần quyền này.</p></div>`
  };

  function veTrang() {
    const khongQuyen = !DUOC_XEM[ma].includes(vaiTro);
    const tt = khongQuyen ? "khong-quyen" : trangThai;
    const ten = { "120": "Ca làm và lịch làm việc", "121": "Chấm công", "122": "Chấm công của tôi", "123": "Nghỉ phép", "124": "Tăng ca", "125": "Bảng công tháng" }[ma];
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
  const hoi = (tieuDeChu, cauHoi, chuNut, thongBaoChu, noiDungThem) => {
    const che = moLop(`<div class="hop-thoai" role="dialog" aria-modal="true"><h2>${tieuDeChu}</h2><p style="margin:0">${cauHoi}</p>${noiDungThem || ""}
      <div class="nhom-nut" style="justify-content:flex-end"><button type="button" class="nut phu" data-dong>Hủy</button><button type="button" class="nut nguy-hiem" data-luu>${chuNut}</button></div></div>`, true);
    che.querySelector("[data-luu]").addEventListener("click", () => { che.remove(); thongBao(thongBaoChu); });
  };
  const LOAI_NGHI = ["Phép năm (còn 6,50 ngày)", "Kết hôn (3 ngày)", "Con kết hôn (1 ngày)", "Tang cha, mẹ, vợ hoặc chồng, con (3 ngày)", "Việc riêng không lương (1 ngày)", "Không lương theo thỏa thuận", "Nghỉ sinh nhật (1 ngày/năm)"];
  let maQr = null;

  document.addEventListener("click", e => {
    const the = e.target.closest("[data-the]");
    if (the) {
      document.querySelectorAll("[data-the]").forEach(b => b.classList.toggle("chon", b === the));
      document.querySelectorAll("[data-noi-dung-the]").forEach(k => { k.hidden = k.dataset.noiDungThe !== the.dataset.the; });
      return;
    }
    const n = e.target.closest("[data-hanh-dong]"); if (!n || n.disabled) return;
    const hd = n.dataset.hanhDong;
    if (hd === "xu-ly" || hd === "cham") {
      e.preventDefault(); n.classList.add("dang-xu-ly"); n.disabled = true;
      setTimeout(() => { n.classList.remove("dang-xu-ly"); n.disabled = false; thongBao(n.dataset.thongBao || "Đã lưu."); if (hd === "cham") n.textContent = "Ra ca"; }, 700); return;
    }
    if (hd === "chi-tiet-ngay") {
      const nv = NV[Number(n.dataset.nv)];
      return ngan(`${nv[1]} · ${n.dataset.ngay}/11/2026`, `<dl class="thong-tin-dong"><dt>Ca dự kiến</dt><dd>HC · 08:00 – 17:00 (từ lịch phòng ban)</dd><dt>Giờ vào – ra</dt><dd>08:29 – 17:02</dd><dt>Giờ làm thực tế</dt><dd>7,52 / 8 giờ</dd><dt>Công</dt><dd>0,94</dd><dt>Đi muộn</dt><dd>29 phút (ân hạn 5 phút)</dd><dt>Giờ đêm</dt><dd>0</dd><dt>Tăng ca</dt><dd>Không</dd></dl>
        ${bang(["Thời điểm", "Nguồn", "Chi tiết"], [["08:29", "Ứng dụng", "GPS · Văn phòng Quận 7 · 38 m (độ chính xác 12 m)"], ["17:02", "Máy chấm công", "Tệp vp-q7-tuan45.csv · máy 02"]])}
        ${nhanSu() ? `<div class="khoi-canh-bao thong-tin">Ghi thủ công thêm lượt chấm cho ngày này, bắt buộc nhập lý do. Lượt từ máy, ứng dụng không sửa, không xóa.</div>${truong("tc-vao", "Giờ vào", "time", "")}${truong("tc-ra", "Giờ ra", "time", "")}${vungChu("tc-ly-do", "Lý do (bắt buộc)")}` : ""}`,
        nhanSu() ? "Ghi lượt thủ công" : "Đóng", nhanSu() ? "Đã ghi lượt thủ công; công ngày được tính lại." : "Đã đóng.");
    }
    if (hd === "thu-cong") return ngan("Ghi công thủ công", `${luaChon("tc-nv", "Nhân viên", NV.map(x => `${x[0]} · ${x[1]}`))}${truong("tc-ngay", "Ngày", "date", "2026-11-03")}${truong("tc-v", "Giờ vào", "time", "08:00")}${truong("tc-r", "Giờ ra", "time", "17:00")}${vungChu("tc-ld", "Lý do (bắt buộc)", "Máy chấm công kho mất điện")}`, "Lưu", "Đã ghi lượt thủ công; công ngày được tính lại.");
    if (hd === "nhap-tep") return ngan("Nhập tệp máy chấm công", `<div class="truong"><label for="tep-cc">Tệp CSV hoặc Excel</label><input id="tep-cc" type="file" class="o-nhap" accept=".csv,.xlsx"><span class="chu-thich">Cột: mã chấm công, ngày giờ (hoặc ngày và giờ riêng), mã máy (không bắt buộc). <a href="#">Tải tệp mẫu</a></span></div>
      <div class="khoi-canh-bao canh-bao">Xem trước: 430 dòng · 412 đạt · 18 trùng (bỏ qua) · 0 lỗi.<br>Dòng 77: mã chấm công 1093 chưa gán cho hồ sơ nào. Dòng 210: 31/10/2026 thuộc kỳ đã chốt.</div>`, "Xác nhận nhập 412 lượt", "Đã nhập 412 lượt chấm; công ngày được tính lại.");
    if (hd === "ca") return ngan("Ca làm", `${truong("ca-ma", "Mã ca", "text", "DEM")}${truong("ca-ten", "Tên ca", "text", "Ca đêm kho")}${truong("ca-bd", "Giờ bắt đầu", "time", "22:00")}${truong("ca-kt", "Giờ kết thúc", "time", "06:00", "", "Kết thúc trước giờ bắt đầu: ca qua ngày hôm sau.")}
      ${truong("ca-nghi", "Nghỉ giữa ca: giờ bắt đầu", "time", "02:00")}${truong("ca-phut", "Số phút nghỉ", "number", "45")}<div class="truong"><label><input type="checkbox" checked> Nghỉ giữa ca tính vào giờ làm (ca liên tục)</label></div>
      ${luaChon("ca-he-so", "Hệ số công", ["1", "0,5"])}<div class="khoi-canh-bao thong-tin">Giờ chuẩn 8 giờ, trong đó 8 giờ ban đêm (22–6 giờ, trả thêm ít nhất 30%).</div>`, "Lưu ca", "Đã lưu ca DEM.");
    if (hd === "lich-tuan") return ngan("Lịch tuần", `${truong("lt-ten", "Tên lịch", "text", "Kho ca xoay")}${THU.map((t, i) => luaChon(`lt-${i}`, t, i === 6 ? ["Nghỉ", "HC", "SANG", "DEM", "T7"] : ["SANG", "HC", "DEM", "T7", "Nghỉ"])).join("")}<div class="truong"><label><input type="checkbox"> Đặt làm lịch mặc định của công ty</label></div>`, "Lưu", "Đã lưu lịch tuần.");
    if (hd === "gan-lich") return ngan("Gán lịch tuần", `${luaChon("gl-loai", "Gán cho", ["Phòng ban", "Nhân viên"])}${luaChon("gl-doi-tuong", "Phòng ban", ["Kho Bình Dương", "Phòng Kế toán"])}${truong("gl-tu", "Áp dụng từ ngày", "date", "2026-12-01")}`, "Gán", "Đã gán lịch tuần.");
    if (hd === "nhap-xep-ca") return ngan("Nhập xếp ca từ Excel", `<div class="truong"><label for="tep-xc">Tệp Excel</label><input id="tep-xc" type="file" class="o-nhap" accept=".xlsx"><span class="chu-thich">Cột: mã nhân viên, ngày, mã ca hoặc OFF. <a href="#">Tải tệp mẫu</a></span></div>`, "Xem trước", "Đã đọc 84 dòng, không lỗi. Bấm Lưu xếp ca để ghi.");
    if (hd === "ngay-le") return ngan("Ngày nghỉ riêng của công ty", `${truong("nl-ngay", "Ngày", "date", "2026-06-15")}${truong("nl-ten", "Tên", "text", "Ngày thành lập công ty")}<span class="chu-thich">Ngày nghỉ có hưởng lương; không có ca dự kiến trong ngày này.</span>`, "Lưu", "Đã thêm ngày nghỉ.");
    if (hd === "xoa") return hoi("Xóa ngày nghỉ", "Xóa ngày nghỉ 15/06/2026 (Ngày thành lập công ty)? Công các ngày liên quan sẽ được tính lại.", "Xóa", "Đã xóa ngày nghỉ.");
    if (hd === "dia-diem") return ngan("Địa điểm chấm công", `${truong("dd-ten", "Tên", "text", "Văn phòng Quận 7")}${luaChon("dd-cn", "Chi nhánh", ["VCR-HCM", "VCR-BD", "VCR-HN"])}
      <div class="truong"><label><input type="checkbox" checked> Chấm theo vị trí GPS</label></div>${truong("dd-vd", "Vĩ độ", "text", "10.7296")}${truong("dd-kd", "Kinh độ", "text", "106.7218")}${nut("Lấy vị trí hiện tại của máy này", "phu", "xu-ly", "Đã lấy vị trí: 10.72961, 106.72183 (độ chính xác 15 m).")}${truong("dd-bk", "Bán kính (m)", "number", "150", "", "Từ 50 đến 1000 m.")}
      <div class="truong"><label><input type="checkbox" checked> Chấm qua mạng công ty</label></div>${vungChu("dd-ip", "Dải địa chỉ IP (mỗi dòng một dải, dạng 203.162.10.0/28)", "203.162.10.0/28")}
      <div class="truong"><label><input type="checkbox" checked> Mã QR động</label><span class="chu-thich">Mở "Màn hình mã QR" trên máy tính bảng đặt tại địa điểm; mã đổi mỗi 30 giây.</span></div>`, "Lưu", "Đã lưu địa điểm chấm công.");
    if (hd === "ma-qr") {
      const che = moLop(`<div class="hop-thoai man-hinh-qr" role="dialog" aria-modal="true"><h2>Văn phòng Quận 7 · Quét để chấm công</h2><div class="khung-qr" aria-label="Mã QR chấm công">${Array.from({ length: 121 }, (_, i) => `<span class="${(i * 7 + (Date.now() / 30000 | 0)) % 3 === 0 ? "den" : ""}"></span>`).join("")}</div>
        <p style="margin:0" id="dem-qr">Mã đổi sau 30 giây</p><span class="chu-thich">Mở camera điện thoại, quét mã, đăng nhập VComm rồi bấm Vào ca hoặc Ra ca.</span><div class="nhom-nut" style="justify-content:flex-end"><button type="button" class="nut phu" data-dong>Đóng</button></div></div>`, true);
      let giay = 30; clearInterval(maQr); maQr = setInterval(() => { giay = giay > 1 ? giay - 1 : 30; const o = che.querySelector("#dem-qr"); if (!o) return clearInterval(maQr); o.textContent = `Mã đổi sau ${giay} giây`; }, 1000);
      return;
    }
    if (hd === "giai-trinh") return ngan("Đơn giải trình công", `${truong("gt-ngay", "Ngày", "date", "2026-10-09")}${luaChon("gt-loai", "Loại", ["Quên chấm", "Đi công tác", "Làm việc bên ngoài", "Máy chấm công lỗi", "Khác"])}${truong("gt-vao", "Giờ vào", "time", "07:55")}${truong("gt-ra", "Giờ ra", "time", "17:05")}${vungChu("gt-ly-do", "Lý do (bắt buộc)", "Quên chấm ra ca")}
      <div class="truong"><label for="gt-tep">Tệp đính kèm (không bắt buộc; PDF, JPG, PNG, tối đa 5 MB)</label><input id="gt-tep" type="file" class="o-nhap"></div>`, "Gửi duyệt", "Đã gửi đơn GT-VCR-2026-000045.");
    if (hd === "giai-trinh-bang-cong") return ngan("Giải trình bảng công tháng 10/2026", vungChu("gtbc", "Nội dung (bắt buộc)", "Ngày 09/10 tôi có làm đủ ca, đã gửi đơn giải trình công nhưng chưa được duyệt."), "Gửi", "Đã gửi giải trình cho nhân sự.");
    if (hd === "don-nghi" || hd === "ghi-nhan-nghi") return ngan(hd === "don-nghi" ? "Lập đơn nghỉ" : "Ghi nhận nghỉ thay người lao động", `${hd === "ghi-nhan-nghi" ? luaChon("dn-nv", "Nhân viên", NV.map(x => `${x[0]} · ${x[1]}`)) : ""}
      ${luaChon("dn-loai", "Loại nghỉ", hd === "ghi-nhan-nghi" ? [...LOAI_NGHI, "Ốm đau (bảo hiểm xã hội)", "Thai sản (bảo hiểm xã hội)", "Tai nạn lao động, bệnh nghề nghiệp"] : LOAI_NGHI)}
      ${truong("dn-tu", "Từ ngày", "date", "2026-11-24")}${luaChon("dn-tu-buoi", "Từ buổi", ["Cả ngày", "Buổi sáng", "Buổi chiều"])}${truong("dn-den", "Đến ngày", "date", "2026-11-25")}${luaChon("dn-den-buoi", "Đến buổi", ["Buổi sáng", "Cả ngày"])}
      <div class="khoi-canh-bao thong-tin">Số ngày nghỉ: 1,5 (bỏ ngày nghỉ hằng tuần, ngày lễ; ca nửa ngày tính 0,5). Phép năm còn sau đơn: 5,00 ngày.</div>${vungChu("dn-ly-do", "Lý do", "Việc gia đình")}
      <div class="truong"><label for="dn-tep">Tệp đính kèm${hd === "ghi-nhan-nghi" ? " (bắt buộc với loại bảo hiểm xã hội)" : " (không bắt buộc)"}</label><input id="dn-tep" type="file" class="o-nhap"></div>
      ${hd === "ghi-nhan-nghi" ? `<div class="khoi-canh-bao canh-bao">Nhân sự ghi nhận: có hiệu lực ngay, không qua luồng duyệt, ghi nhật ký thao tác.</div>` : ""}`, hd === "don-nghi" ? "Gửi duyệt" : "Ghi nhận", hd === "don-nghi" ? "Đã gửi đơn NP-VCR-2026-000113." : "Đã ghi nhận nghỉ; công được tính lại.");
    if (hd === "huy") return hoi("Hủy đơn nghỉ", "Hủy đơn NP-VCR-2026-000109 đã duyệt? Công các ngày 05/11, 06/11 được tính lại.", "Hủy đơn", "Đã hủy đơn nghỉ.", vungChu("huy-ly-do", "Lý do (bắt buộc)"));
    if (hd === "dieu-chinh") return ngan("Điều chỉnh sổ phép", `${luaChon("dc-nv", "Nhân viên", NV.map(x => `${x[0]} · ${x[1]}`))}${luaChon("dc-nam", "Năm phát sinh", ["2026", "2025"])}${truong("dc-so", "Số ngày (âm để trừ)", "text", "4,00")}${vungChu("dc-ly-do", "Lý do (bắt buộc)", "Số dư phép năm 2025 chuyển từ hệ thống cũ")}`, "Lưu", "Đã điều chỉnh sổ phép.");
    if (hd === "che-do") return ngan("Chế độ phép năm", `${luaChon("cd-loai", "Điều kiện làm việc", ["Bình thường – 12 ngày", "Người khuyết tật hoặc nặng nhọc, độc hại, nguy hiểm – 14 ngày", "Đặc biệt nặng nhọc, độc hại, nguy hiểm – 16 ngày"], "", "Lao động chưa thành niên tự động 14 ngày theo ngày sinh.")}${truong("cd-tn", "Ngày tính thâm niên", "date", "2025-09-15", "", "Mặc định ngày vào làm. Đủ 5 năm cộng thêm 1 ngày.")}`, "Lưu", "Đã lưu chế độ phép.");
    if (hd === "loai-nghi") return ngan("Loại nghỉ của công ty", `${truong("ln-ten", "Tên", "text", "Nghỉ sinh nhật")}${luaChon("ln-luong", "Hưởng lương", ["Có lương", "Không lương"])}${truong("ln-max", "Số ngày tối đa mỗi năm (không bắt buộc)", "number", "1")}<div class="truong"><label><input type="checkbox"> Cần tệp đính kèm</label></div>`, "Lưu", "Đã lưu loại nghỉ.");
    if (hd === "tang-ca") return ngan("Phiếu tăng ca", `${vaiTro === "nhan-vien" ? "" : luaChon("tc-nhan-vien", "Nhân viên", NV.map(x => `${x[0]} · ${x[1]}`))}
      ${truong("tc-ngay2", "Ngày", "date", "2026-11-20")}${truong("tc-bd", "Giờ bắt đầu", "time", "18:00")}${truong("tc-kt", "Giờ kết thúc", "time", "23:00", "Ngày thường chỉ được tăng ca tối đa 4 giờ (50% của 8 giờ chuẩn).")}
      ${vungChu("tc-cv", "Công việc", "Kiểm kê cuối tháng")}${truong("tc-dd", "Địa điểm", "text", "Kho Bình Dương")}
      <div class="khoi-canh-bao thong-tin">Ngày thường · tháng 11 còn 4 / 40 giờ · năm 2026 còn 12 / 200 giờ. Giờ đêm (22–6 giờ): 1.</div>
      <div class="khoi-canh-bao canh-bao">Không bố trí tăng ca cho lao động nữ mang thai từ tháng thứ 7 (thứ 6 ở vùng cao, vùng sâu, vùng xa, biên giới, hải đảo); nuôi con dưới 12 tháng tuổi chỉ khi người lao động đồng ý (Bộ luật Lao động Điều 137).</div>
      ${vaiTro === "nhan-vien" ? `<span class="chu-thich">Bạn tự lập phiếu nghĩa là đồng ý làm thêm; phiếu được gửi duyệt.</span>` : `<span class="chu-thich">Người lao động nhận thông báo để đồng ý trên ứng dụng; đồng ý xong phiếu mới được gửi duyệt. Người không có tài khoản: nhân sự ghi nhận kèm văn bản đồng ý.</span>`}`,
      vaiTro === "nhan-vien" ? "Gửi duyệt" : "Gửi người lao động đồng ý", "Đã lập phiếu TC-VCR-2026-000078.");
    if (hd === "chot") return hoi("Chốt bảng công tháng 10/2026", "Còn 1 giải trình chưa trả lời nên chưa chốt được. Sau khi chốt: khóa mọi dữ liệu chấm công, nghỉ, tăng ca của tháng 10; trừ phép tháng không đủ 50% công; Kế toán lương nhận bảng công.", "Chốt", "Chưa chốt: còn 1 giải trình chưa trả lời.");
    if (hd === "dong-bang-cong") { e.preventDefault(); return ngan("Phạm Gia Huy · tháng 10/2026", `<div class="khoi-canh-bao loi">Giải trình: "Ngày 21/10 tôi làm đủ ca nhưng máy không nhận vân tay, đề nghị bỏ vắng không phép."</div>${vungChu("tl", "Trả lời (bắt buộc)", "Đã kiểm tra camera, ghi lượt thủ công 21/10. Vui lòng xác nhận lại.")}
      ${bang(["Ngày", "Công", "Ghi chú"], [["20/10", "1", ""], ["21/10", nhan("V", "loi"), "Vắng không phép"], ["22/10", "1", ""]])}`, "Gửi trả lời", "Đã trả lời; người lao động được thông báo xác nhận lại."); }
  });
  document.addEventListener("keydown", e => { if (e.key === "Escape") document.querySelectorAll(".man-che").forEach(c => c.remove()); });

  const kieu = document.createElement("style");
  kieu.textContent = `[data-noi-dung-the] { min-width: 0; display: grid; gap: var(--khoang-3); } [data-noi-dung-the] > * { min-width: 0; } [data-noi-dung-the][hidden] { display: none; }
    .luoi-cong th, .luoi-cong td { padding: 6px; text-align: center; white-space: nowrap; }
    .luoi-cong th[scope=row] { text-align: left; display: grid; min-width: 180px; text-transform: none; letter-spacing: 0; font-size: 14px; color: var(--mau-chu); }
    .ten-dong { font-weight: 700; white-space: normal; }
    .o-cong { min-width: 36px; border-radius: var(--bo-nho); border: 1px solid transparent; font: inherit; font-weight: 700; font-size: 12px; line-height: 20px; cursor: pointer; padding: 2px 4px; }
    .o-cong.thanh-cong { background: var(--mau-thanh-cong-nen); color: var(--mau-thanh-cong); } .o-cong.canh-bao { background: var(--mau-canh-bao-nen); color: var(--mau-canh-bao); }
    .o-cong.loi { background: var(--mau-loi-nen); color: var(--mau-loi); } .o-cong.thong-tin { background: var(--mau-thong-tin-nen); color: var(--mau-thong-tin); }
    .o-cong.trung-tinh { background: var(--mau-nen); color: var(--mau-chu-phu); border-color: var(--mau-vien); }
    .o-ca { min-width: 96px; padding: 4px 6px; }
    .trang-dien-thoai { max-width: 560px; margin: 0 auto; }
    .cham-nhanh { justify-items: start; } .nut-lon { width: 100%; justify-content: center; font-size: 18px; padding: 16px; }
    .lua-chon-gon { display: flex; flex-wrap: wrap; gap: var(--khoang-2); }
    .man-hinh-qr { justify-items: center; text-align: center; }
    .khung-qr { display: grid; grid-template-columns: repeat(11, 20px); gap: 0; padding: var(--khoang-4); background: var(--mau-be-mat); border: 1px solid var(--mau-vien); }
    .khung-qr span { width: 20px; height: 20px; } .khung-qr .den { background: var(--mau-chu); }
    @media (max-width: 767px) { .luoi-cong thead { position: static; width: auto; height: auto; overflow: visible; clip: auto; }
      .khung-bang .luoi-cong, .khung-bang .luoi-cong tbody { display: table-row-group; } .khung-bang .luoi-cong { display: table; }
      .khung-bang .luoi-cong tr { display: table-row; padding: 0; } .khung-bang .luoi-cong td, .khung-bang .luoi-cong th { display: table-cell; width: auto; }
      .khung-bang .luoi-cong td::before { content: none; } .khung-qr { grid-template-columns: repeat(11, 16px); } .khung-qr span { width: 16px; height: 16px; } }`;
  document.head.appendChild(kieu);
  const dk = document.createElement("div");
  dk.className = "dieu-khien";
  dk.innerHTML = `<strong>Bản mẫu</strong><a href="index.html">Mục lục</a>
    <label for="dk-vai-tro">Vai trò</label><select id="dk-vai-tro">${Object.entries(VAI_TRO).map(([k, v]) => `<option value="${k}"${k === vaiTro ? " selected" : ""}>${v}</option>`).join("")}</select>
    <label for="dk-trang-thai">Trạng thái</label><select id="dk-trang-thai">${[["du-lieu", "Có dữ liệu"], ["rong", "Rỗng"], ["dang-tai", "Đang tải"], ["loi", "Lỗi"]].map(([k, v]) => `<option value="${k}"${k === trangThai ? " selected" : ""}>${v}</option>`).join("")}</select>`;
  document.body.appendChild(dk);
  dk.querySelector("#dk-vai-tro").addEventListener("change", e => { vaiTro = e.target.value; ghi("ban-mau-cc-vai-tro", vaiTro); veTrang(); });
  dk.querySelector("#dk-trang-thai").addEventListener("change", e => { trangThai = e.target.value; ghi("ban-mau-cc-trang-thai", trangThai); veTrang(); });
  veTrang();
})();
