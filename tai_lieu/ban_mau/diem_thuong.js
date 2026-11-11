// Bản mẫu CONG_VIEC_51 (MODULE_11 Điểm thưởng): dựng MAN_HINH_146 đến 152 và phần sửa MAN_HINH_76, 88, 93, 96 từ dữ liệu giả. Không phải mã sản phẩm.
(function () {
  const TEP = {
    146: ["CHUONG_TRINH_DIEM", "Chương trình điểm (web)"],
    147: ["VI_DIEM", "Ví điểm (web)"],
    148: ["DIEU_CHINH_DIEM", "Điều chỉnh điểm (web)"],
    149: ["CANH_BAO_DIEM", "Cảnh báo bất thường (web)"],
    150: ["NGHIA_VU_DIEM", "Nghĩa vụ điểm (web)"],
    151: ["DIEM_CUA_TOI", "Điểm của tôi (ứng dụng)"],
    152: ["HANG_THANH_VIEN", "Hạng thành viên (ứng dụng)"],
    0: ["SUA_DAT_HANG_DUNG_DIEM", "Sửa MAN_HINH_76, 88, 93, 96: dùng điểm, điểm của đơn"],
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
  let trangThai = doc("ban-mau-diem-thuong-trang-thai", "du-lieu");

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
  const theTab = (chonThe) =>
    `<nav class="thanh-the" aria-label="Thanh điều hướng">${["Trang chủ", "Cửa hàng", "Đơn hàng", "Tài khoản"]
      .map((chu) => `<a href="${chu === "Tài khoản" ? duongDan(0) : "#"}" class="${chu === chonThe ? "chon" : ""}">${chu}</a>`)
      .join("")}</nav>`;
  const dienThoai = (chuThich, tieuDe, than, tab, quayLai) => `<section class="dien-thoai" aria-label="${chuThich}">
    <div class="chu-thich-khung">${chuThich}</div>
    <div class="dau">${quayLai ? `<a href="${quayLai}" aria-label="Quay lại">‹</a>` : ""}<span>${tieuDe}</span></div>
    <div class="cuon">${than}</div>${tab ? theTab(tab) : ""}</section>`;
  const theoTrangThai = (duLieu, rongThan) => {
    if (trangThai === "dang-tai") return tai(3);
    if (trangThai === "loi") return loiTai;
    if (trangThai === "khong-quyen") return hop("Tài khoản của bạn không dùng được chức năng này.", "canh-bao");
    if (trangThai === "rong" && rongThan) return rongThan;
    return duLieu;
  };

  // ---------- Web ----------
  const MENU_WEB = [
    ["Người mua", ""],
    ["Đơn VComm", 0],
    ["Đăng bán", ""],
    ["Cài đặt bán hàng", ""],
    ["— Điểm thưởng —", ""],
    ["Chương trình điểm", 146],
    ["Ví điểm", 147],
    ["Điều chỉnh điểm", 148],
    ["Cảnh báo bất thường", 149],
    ["Nghĩa vụ điểm", 150],
  ];
  const web = (than) => `<div class="khung-web"><header class="thanh-tren"><span class="logo">VComm</span><span>Khách hàng và Đối tác</span><span class="gian"></span>
    <button type="button">VComm Thương mại ▾</button><button type="button">Trần Minh Khoa ▾</button></header>
    <div class="than"><nav class="menu" aria-label="Khách hàng và Đối tác"><div class="ten-app">Sàn VComm</div>${MENU_WEB.map(([chu, dich]) =>
      chu.startsWith("—") ? `<div class="ten-app">${chu.replaceAll("—", "").trim()}</div>` : `<a href="${dich !== "" ? duongDan(dich) : "#"}" class="${dich === ma ? "chon" : ""}">${chu}</a>`,
    ).join("")}</nav><main class="noi-dung">${than}</main></div></div>`;
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

  // ---------- Màn hình ----------
  const MAN_HINH = {
    146: () =>
      web(`<div class="tieu-de"><h1>Chương trình điểm</h1>${nut("Thêm giai đoạn", "chinh")}</div>${theWeb(["Giai đoạn", "Bảng hạng"], "Giai đoạn")}
      ${webTheoTrangThai(
        `${bang(
          ["Từ ngày", "Đến ngày", "Tỷ lệ tích", "Giá trị 1 điểm", "Đổi tối đa", "Đổi tối thiểu", "Hạn dùng", "Trần mỗi đơn", "Trần mỗi tháng", "Trạng thái"],
          [
            ["01/12/2026", "—", "1%", "1 ₫", "50% tiền hàng", "1.000 điểm", "12 tháng", "—", "—", nhan("Sắp tới", "thong-tin")],
            ["01/11/2026", "30/11/2026", "2%", "1 ₫", "30% tiền hàng", "1.000 điểm", "12 tháng", "200.000", "1.000.000", nhan("Đang hiệu lực", "thanh-cong")],
            ["01/10/2026", "31/10/2026", "1%", "1 ₫", "50% tiền hàng", "1.000 điểm", "12 tháng", "—", "—", nhan("Đã kết thúc", "trung-tinh")],
          ],
          [2, 3, 7, 8],
        )}
      <div class="the-web"><h2>Sửa giai đoạn sắp tới · từ 01/12/2026</h2>
        <div class="luoi-truong">${truong("Từ ngày", "25/11/2026", "Giai đoạn chồng lấn với giai đoạn khác.")}${truong("Đến ngày (để trống: không thời hạn)", "")}
          ${truong("Tỷ lệ tích (% giá trị tích, 0 đến 100)", "1")}${truong("Giá trị một điểm (đồng)", "1")}
          ${truong("Đổi tối đa (% tiền hàng gồm thuế)", "50")}${truong("Đổi tối thiểu mỗi lần (điểm)", "1.000")}
          ${truong("Hạn dùng (tháng, 1 đến 60)", "12")}${truong("Trần điểm mỗi đơn (để trống: không trần)", "")}${truong("Trần điểm mỗi người mỗi tháng (để trống: không trần)", "")}</div>
        ${hop("Ví dụ: đơn 500.000 ₫, hạng Bạc (hệ số 1,2) → 500.000 × 1% × 1,2 ÷ 1 = 6.000 điểm, trị giá 6.000 ₫ khi đổi.", "thong-tin")}
        <div class="nhom-nut">${nut("Lưu", "chinh", "Đã lưu giai đoạn")}${nut("Xóa giai đoạn", "nguy-hiem", "Đã xóa giai đoạn chưa bắt đầu")}</div></div>
      <div class="the-web"><h2>Giai đoạn đang hiệu lực · 01/11/2026 đến 30/11/2026</h2>
        ${hop("Giai đoạn đã bắt đầu, chỉ sửa được ngày kết thúc (không trước hôm nay). Đơn đã đặt giữ tham số lúc đặt.", "canh-bao")}
        <div class="luoi-truong">${truong("Đến ngày", "30/11/2026")}</div><div class="nhom-nut">${nut("Lưu ngày kết thúc", "chinh", "Đã lưu")}</div></div>
      <div class="the-web"><h2>Bảng hạng</h2>
        ${bang(
          ["Thứ tự", "Tên hạng", "Tên tiếng Anh", "Chi tiêu tối thiểu một năm (₫)", "Hệ số tích (1 đến 5)"],
          [
            [
              "1",
              "<input class='o-nhap' value='Thành viên' aria-label='Tên hạng 1'>",
              "<input class='o-nhap' value='Member' aria-label='Tên tiếng Anh hạng 1'>",
              "0 (hạng thấp nhất)",
              "<input class='o-nhap' value='1' aria-label='Hệ số hạng 1' style='width:70px'>",
            ],
            [
              "2",
              "<input class='o-nhap' value='Bạc' aria-label='Tên hạng 2'>",
              "<input class='o-nhap' value='Silver' aria-label='Tên tiếng Anh hạng 2'>",
              "<input class='o-nhap' value='5.000.000' aria-label='Mức hạng 2' style='width:130px'>",
              "<input class='o-nhap' value='1,2' aria-label='Hệ số hạng 2' style='width:70px'>",
            ],
            [
              "3",
              "<input class='o-nhap' value='Vàng' aria-label='Tên hạng 3'>",
              "<input class='o-nhap' value='Gold' aria-label='Tên tiếng Anh hạng 3'>",
              "<input class='o-nhap' value='20.000.000' aria-label='Mức hạng 3' style='width:130px'>",
              "<input class='o-nhap' value='1,5' aria-label='Hệ số hạng 3' style='width:70px'>",
            ],
            [
              "4",
              "<input class='o-nhap' value='Kim cương' aria-label='Tên hạng 4'>",
              "<input class='o-nhap' value='Diamond' aria-label='Tên tiếng Anh hạng 4'>",
              "<input class='o-nhap' value='50.000.000' aria-label='Mức hạng 4' style='width:130px'>",
              "<input class='o-nhap' value='2' aria-label='Hệ số hạng 4' style='width:70px'>",
            ],
          ],
        )}
        ${hop("Mức chi tiêu tăng dần theo thứ tự. Đổi bảng hạng: hạng người mua tính lại ngay; đơn đã đặt giữ hệ số lúc đặt.", "thong-tin")}
        <div class="nhom-nut">${nut("Thêm hạng", "phu")}${nut("Lưu bảng hạng", "chinh", "Đã lưu bảng hạng, đã tính lại hạng người mua")}</div></div>`,
        `<div class="the-web"><p style="margin:0">Chưa có giai đoạn nào. Khi chưa có giai đoạn đang hiệu lực, người mua không tích và không đổi được điểm.</p>${nut("Thêm giai đoạn", "chinh")}</div>`,
      )}`),

    147: () =>
      web(`<div class="tieu-de"><h1>Ví điểm</h1></div>
      <div class="luoi-truong">${truong("Tìm số điện thoại, tên", "")}${chon("Hạng", ["Mọi hạng", "Thành viên", "Bạc", "Vàng", "Kim cương"])}${chon("Tình trạng", ["Mọi ví", "Đang khóa"])}</div>
      ${webTheoTrangThai(
        `${bang(
          ["Người mua", "Số điện thoại", "Hạng", "Số dư (điểm)", "Sắp hết hạn 30 ngày", "Chi tiêu năm nay (₫)", "Tình trạng"],
          [
            ["<a href='#'>Nguyễn Thị Phương Thảo</a>", "0912 345 678", "Vàng", "48.250", "3.000", "21.400.000", nhan("Hoạt động", "thanh-cong")],
            ["<a href='#'>Phạm Văn Đức</a>", "0987 111 222", "Thành viên", "120.000", "0", "1.200.000", nhan("Đang khóa", "loi")],
            ["<a href='#'>Trịnh Gia Hân</a>", "0909 888 777", "Bạc", "6.000", "0", "5.300.000", nhan("Hoạt động", "thanh-cong")],
          ],
          [3, 4, 5],
        )}
      <div class="the-web"><div class="tieu-de"><h2>Nguyễn Thị Phương Thảo · 0912 345 678</h2>${nhan("Vàng", "thong-tin")}</div>
        <div class="luoi-truong"><div><div class="chu-nho">Số dư</div><div class="so-lon">48.250 điểm</div><div class="chu-nho">≈ 48.250 ₫ theo giai đoạn hiện hành</div></div>
          <div><div class="chu-nho">Chi tiêu năm 2026</div><div class="chu-dam">21.400.000 ₫</div></div><div><div class="chu-nho">Chi tiêu năm 2025</div><div class="chu-dam">8.100.000 ₫ (Bạc)</div></div></div>
        ${theWeb(["Sổ cái", "Lô điểm", "Lịch sử hạng", "Lịch sử khóa"], "Sổ cái")}
        ${bang(
          ["Thời điểm", "Loại", "Điểm", "Số dư sau", "Đơn hoặc phiếu", "Lô"],
          [
            ["10/11/2026 14:02", "Dùng cho đơn", "<span class='so-am'>−10.000</span>", "48.250", "DB-2026-001455", "L-0391, L-0410"],
            ["08/11/2026 09:00", "Tích theo đơn", "<span class='so-duong'>+6.450</span>", "58.250", "DB-2026-001201", "L-0455"],
            ["01/11/2026 00:10", "Hết hạn", "<span class='so-am'>−1.200</span>", "51.800", "—", "L-0102"],
            ["20/10/2026 16:30", "Điều chỉnh cộng", "<span class='so-duong'>+5.000</span>", "53.000", "DD-2026-000012", "L-0410"],
          ],
          [2, 3],
        )}
        <h3>Lô điểm còn lại</h3>
        ${bang(
          ["Lô", "Nguồn", "Ngày cộng", "Hạn dùng", "Điểm cộng", "Còn lại", "Giá trị 1 điểm lúc cộng"],
          [
            ["L-0391", "Đơn DB-2026-000880", "05/12/2025", "05/12/2026 " + nhan("Sắp hết hạn", "canh-bao"), "3.000", "3.000", "1 ₫"],
            ["L-0455", "Đơn DB-2026-001201", "08/11/2026", "08/11/2027", "6.450", "6.450", "1 ₫"],
          ],
          [4, 5],
        )}
        <h3>Khóa ví điểm</h3>${truong("Lý do (1 đến 500 ký tự)", "", "", "nhieu-dong")}
        ${hop("Ví khóa: không tích, không đổi điểm; đơn đã đặt vẫn hoàn điểm khi hủy, trả hàng; điểm vẫn hết hạn.", "thong-tin")}
        <div class="nhom-nut">${nut("Khóa ví điểm", "nguy-hiem", "Đã khóa ví điểm")}${nut("Lập phiếu điều chỉnh", "phu")}</div></div>`,
        `<div class="the-web"><p style="margin:0">Không có người mua nào khớp điều kiện tìm.</p></div>`,
      )}`),

    148: () =>
      web(`<div class="tieu-de"><h1>Điều chỉnh điểm</h1>${nut("Lập phiếu", "chinh")}</div>${theWeb(["Tất cả", "Nháp", "Chờ duyệt", "Đã ghi sổ", "Bị từ chối"], "Tất cả")}
      ${webTheoTrangThai(
        `${bang(
          ["Số phiếu", "Người mua", "Loại", "Điểm", "Giá trị (₫)", "Lý do", "Người lập", "Trạng thái"],
          [
            ["DD-2026-000014", "Trịnh Gia Hân", "Cộng", "20.000", "20.000", "Bù điểm đơn lỗi giao chậm", "Trần Minh Khoa", nhan("Chờ duyệt", "canh-bao")],
            ["DD-2026-000013", "Phạm Văn Đức", "Trừ", "100.000", "100.000", "Thu hồi điểm tích từ đơn gian lận", "Trần Minh Khoa", nhan("Đã ghi sổ", "thanh-cong")],
            ["DD-2026-000012", "Nguyễn Thị Phương Thảo", "Cộng", "5.000", "5.000", "Tặng điểm khách khiếu nại", "Lê Hoàng Phúc", nhan("Đã ghi sổ", "thanh-cong")],
          ],
          [3, 4],
        )}
      <div class="the-web"><h2>Lập phiếu điều chỉnh</h2>
        <div class="luoi-truong">${truong("Người mua (số điện thoại)", "0909 888 777")}${chon("Loại", ["Cộng điểm", "Trừ điểm"])}${truong("Số điểm (1 đến 10.000.000)", "20.000")}</div>
        ${truong("Lý do (1 đến 500 ký tự)", "Bù điểm đơn lỗi giao chậm", "", "nhieu-dong")}
        ${hop("Giá trị gửi duyệt = 20.000 điểm × 1 ₫ = 20.000 ₫. Phiếu đi qua luồng duyệt của công ty; người lập không tự duyệt. Cộng điểm tạo lô hạn 12 tháng.", "thong-tin")}
        <div class="nhom-nut">${nut("Lưu nháp", "phu", "Đã lưu nháp")}${nut("Gửi duyệt", "chinh", "Đã gửi duyệt DD-2026-000014")}</div></div>
      <div class="the-web"><div class="tieu-de"><h2>DD-2026-000013 · Trừ 100.000 điểm · Phạm Văn Đức</h2>${nhan("Chờ ghi sổ", "loi")}</div>
        ${hop("Số dư điểm không đủ để ghi điều chỉnh trừ (số dư lúc duyệt 80.000 điểm). Rút phiếu và lập lại với số điểm phù hợp.", "loi")}
        <div class="nhom-nut">${nut("Rút phiếu", "phu", "Đã rút phiếu")}</div></div>`,
        `<div class="the-web"><p style="margin:0">Chưa có phiếu điều chỉnh nào.</p></div>`,
      )}`),

    149: () =>
      web(`<div class="tieu-de"><h1>Cảnh báo bất thường</h1></div>
      ${hop("Tính trong 90 ngày gần nhất. Chỉ cảnh báo, không tự chặn; xử lý bằng khóa ví điểm hoặc phiếu điều chỉnh.", "thong-tin")}
      ${theWeb(["Trùng thông tin nhận hàng", "Hủy, trả hàng nhiều", "Đổi điểm dồn dập"], "Trùng thông tin nhận hàng")}
      ${webTheoTrangThai(
        `${bang(
          ["Thông tin trùng", "Số người mua", "Người mua", "Số đơn", "Điểm đã tích"],
          [
            ["Số nhận 0977 000 111", "4", "<a href='" + duongDan(147) + "'>Phạm Văn Đức</a>, Phạm Văn Đạt, Phạm Thị Duyên, Lê Văn Định", "23", "214.000"],
            ["12 nguyễn trãi, phường bến thành, thành phố hồ chí minh", "3", "<a href='" + duongDan(147) + "'>Trịnh Gia Hân</a>, Trịnh Minh, Gia Hân", "9", "31.500"],
          ],
          [1, 3, 4],
        )}
      <div class="the-web"><h2>Hủy, trả hàng nhiều (mẫu)</h2>${bang(["Người mua", "Số đơn", "Hủy", "Có hàng trả", "Tỷ lệ"], [["Lê Văn Định", "8", "3", "2", "62,5%"]], [1, 2, 3, 4])}</div>
      <div class="the-web"><h2>Đổi điểm dồn dập (mẫu)</h2>${bang(["Người mua", "Ngày", "Số đơn dùng điểm", "Tổng điểm dùng"], [["Phạm Văn Đức", "09/11/2026", "6", "60.000"]], [2, 3])}</div>`,
        `<div class="the-web"><p style="margin:0">Không có cảnh báo nào trong 90 ngày gần nhất.</p></div>`,
      )}`),

    150: () =>
      web(`<div class="tieu-de"><h1>Nghĩa vụ điểm</h1></div>
      <div class="luoi-truong">${chon("Năm", ["2026", "2025"])}</div>
      ${webTheoTrangThai(
        `<div class="luoi-truong"><div class="the-web"><div class="chu-nho">Số dư nghĩa vụ hiện tại</div><div class="so-lon">12.480.300 điểm</div><div class="chu-nho">Giá trị lúc tích 12.480.300 ₫ · tài khoản 3388</div></div>
        <div class="the-web"><div class="chu-nho">Sắp hết hạn 30 ngày</div><div class="so-lon">412.000 điểm</div></div></div>
      ${bang(
        ["Tháng", "Phát hành (điểm)", "Đã dùng", "Hết hạn", "Điều chỉnh", "Số dư cuối (điểm)", "Giá trị số dư lúc tích (₫)"],
        [
          ["11/2026", "1.240.000", "−380.000", "−21.000", "+5.000", "12.480.300", "12.480.300"],
          ["10/2026", "2.105.000", "−640.500", "−8.200", "−100.000", "11.636.300", "11.636.300"],
          ["09/2026", "1.980.000", "−512.000", "0", "0", "10.280.000", "10.280.000"],
        ],
        [1, 2, 3, 4, 5, 6],
      )}
      ${hop("Số liệu lấy từ sổ cái điểm; khớp số dư tài khoản 3388 vai trò nghĩa vụ điểm khi công ty đã khởi tạo kế toán.", "thong-tin")}`,
        `<div class="the-web"><p style="margin:0">Chưa phát sinh điểm trong năm này.</p></div>`,
      )}`),

    151: () => `<div class="day-dien-thoai">${dienThoai(
      "MAN_HINH_151 · Điểm của tôi",
      "Điểm của tôi",
      theoTrangThai(
        `
      <div class="the-diem"><div class="chu-nho">Số dư</div><div class="so-lon">48.250 điểm</div><div class="chu-nho">≈ 48.250 ₫ · 1 điểm = 1 ₫ đến 30/11/2026</div>
        <a href="${duongDan(152)}">Hạng Vàng · hệ số tích ×1,5 ›</a></div>
      ${hop("3.000 điểm hết hạn ngày 05/12/2026. Dùng điểm khi đặt hàng để không bị mất.", "canh-bao")}
      <div class="the-dt"><div class="chu-dam">Lịch sử</div>
        ${[
          ["Dùng cho đơn DB-2026-001455", "10/11/2026", "−10.000", "so-am"],
          ["Tích từ đơn DB-2026-001201", "08/11/2026 · hạn 08/11/2027", "+6.450", "so-duong"],
          ["Điểm hết hạn", "01/11/2026", "−1.200", "so-am"],
          ["VComm tặng điểm", "20/10/2026 · hạn 20/10/2027", "+5.000", "so-duong"],
          ["Hoàn điểm đơn đã hủy DB-2026-001100", "15/10/2026", "+2.000", "so-duong"],
        ]
          .map(([chu, ngay, so, lop]) => `<div class="dong"><div class="gian"><div>${chu}</div><div class="chu-nho">${ngay}</div></div><div class="chu-dam ${lop}">${so}</div></div>`)
          .join("")}
        ${nut("Xem thêm", "phu", "", "rong")}</div>
      <div class="chu-nho">Điểm không đổi ra tiền mặt, không chuyển cho người khác. Mỗi đơn dùng điểm tối đa theo chương trình đang áp dụng.</div>`,
        `<div class="the-diem"><div class="chu-nho">Số dư</div><div class="so-lon">0 điểm</div></div><div class="the-dt">Bạn chưa có điểm. Đơn hàng hoàn tất sẽ được tích điểm.${nut("Mua sắm ngay", "chinh", "", "rong")}</div>`,
      ),
      "Tài khoản",
      duongDan(0),
    )}
      ${dienThoai(
        "Ví điểm bị khóa",
        "Điểm của tôi",
        `<div class="the-diem"><div class="chu-nho">Số dư</div><div class="so-lon">120.000 điểm</div></div>
        ${hop("Ví điểm đang bị khóa. Bạn tạm thời không tích và không dùng được điểm. Liên hệ VComm để được hỗ trợ.", "loi")}`,
        "Tài khoản",
        duongDan(0),
      )}</div>`,

    152: () =>
      `<div class="day-dien-thoai">${dienThoai(
        "MAN_HINH_152 · Hạng thành viên",
        "Hạng thành viên",
        theoTrangThai(
          `
      <div class="the-dt"><div class="chu-nho">Hạng hiện tại</div><div class="so-lon">Vàng</div><div class="chu-nho">Hệ số tích điểm ×1,5 · giữ đến hết 31/12/2027</div></div>
      <div class="the-dt"><div class="dong"><div class="gian chu-dam">Chi tiêu năm 2026</div><div class="chu-dam">21.400.000 ₫</div></div>
        <div class="tien-do" role="img" aria-label="Đã chi tiêu 21,4 triệu trên 50 triệu"><span style="width:43%"></span></div>
        <div class="chu-nho">Chi tiêu thêm 28.600.000 ₫ trong năm 2026 để lên hạng Kim cương.</div>
        <div class="chu-nho">Năm 2025: 8.100.000 ₫ (Bạc)</div></div>
      <div class="the-dt"><div class="chu-dam">Các hạng</div><div class="bang-hang">
        <div><b>Thành viên</b>từ 0 ₫<br>×1</div><div><b>Bạc</b>từ 5 triệu<br>×1,2</div><div class="dat"><b>Vàng</b>từ 20 triệu<br>×1,5</div><div><b>Kim cương</b>từ 50 triệu<br>×2</div></div>
        <div class="chu-nho">Chi tiêu tính theo giá trị đơn hoàn tất trong năm dương lịch. Hạng là hạng cao hơn giữa chi tiêu năm trước và năm nay; ngày 1/1 xét lại.</div></div>`,
          null,
        ),
        "Tài khoản",
        duongDan(151),
      )}</div>`,

    0: () => `<h2>Ứng dụng</h2><div class="day-dien-thoai">
      ${dienThoai(
        "Sửa MAN_HINH_93 · Đặt hàng: dùng điểm",
        "Đặt hàng",
        `
        <div class="the-dt"><div class="chu-dam">Giao đến</div><div class="chu-nho">Nguyễn Thị Phương Thảo · 0912 345 678 · 12 Lê Lợi, Phường Sài Gòn, Thành phố Hồ Chí Minh</div></div>
        <div class="the-dt"><div class="dong"><div class="gian">Nồi chiên không dầu 5,2 lít × 1</div><div>1.690.000 ₫</div></div></div>
        <div class="the-dt"><div class="dong"><div class="gian chu-dam">Dùng điểm</div><label class="dong"><input type="checkbox" checked> Dùng</label></div>
          <div class="chu-nho">Số dư 48.250 điểm · dùng tối đa 48.250 điểm (giới hạn 30% tiền hàng = 507.000 ₫) · tối thiểu 1.000 điểm</div>
          ${truong("Số điểm dùng", "48.250")}<div class="dong"><div class="gian chu-nho">1 điểm = 1 ₫</div><a href="#">Dùng tối đa</a></div></div>
        <div class="the-dt">
          <div class="dong"><div class="gian">Tiền hàng</div><div>1.690.000 ₫</div></div>
          <div class="dong"><div class="gian">Phí giao hàng</div><div>0 ₫</div></div>
          <div class="dong"><div class="gian">Trừ điểm (48.250 điểm)</div><div class="so-am">−48.250 ₫</div></div>
          <div class="dong"><div class="gian chu-dam">Tổng thanh toán</div><div class="so-lon">1.641.750 ₫</div></div>
          <div class="chu-nho">Dự kiến tích 49.252 điểm khi đơn hoàn tất (tích 2%, hạng Vàng ×1,5).</div></div>
        ${hop("Số điểm dùng không hợp lệ (dưới mức tối thiểu, vượt số dư hoặc vượt giới hạn của đơn).", "loi")}
        ${nut("Đặt hàng · thanh toán khi nhận hàng", "chinh", "Đã đặt đơn DB-2026-001460", "rong")}`,
        null,
        "#",
      )}
      ${dienThoai(
        "Sửa MAN_HINH_96 · Chi tiết đơn",
        "Đơn DB-2026-001455",
        `
        <div class="the-dt">${nhan("Đã hủy", "trung-tinh")}<div class="chu-nho">Hủy bởi bạn · 11/11/2026 08:15</div></div>
        <div class="the-dt">
          <div class="dong"><div class="gian">Tổng tiền</div><div>1.690.000 ₫</div></div>
          <div class="dong"><div class="gian">Trừ điểm (10.000 điểm)</div><div class="so-am">−10.000 ₫</div></div>
          <div class="dong"><div class="gian">Đã hoàn điểm</div><div class="so-duong">+10.000 điểm</div></div>
          <div class="chu-nho">Điểm hoàn về đúng hạn dùng cũ; điểm đã hết hạn được thêm 30 ngày.</div></div>
        <div class="the-dt"><div class="dong"><div class="gian">Đơn DB-2026-001201 · Hoàn tất</div></div><div class="chu-nho">Đã tích 6.450 điểm · hạn 08/11/2027</div></div>`,
        null,
        "#",
      )}
      ${dienThoai(
        "Sửa MAN_HINH_76 · Tài khoản",
        "Tài khoản",
        `
        <div class="the-dt"><div class="chu-dam">Nguyễn Thị Phương Thảo</div><div class="chu-nho">0912 345 678</div></div>
        <a class="the-diem" href="${duongDan(151)}" style="text-decoration:none"><div class="chu-nho">Điểm thưởng · hạng Vàng</div><div class="so-lon">48.250 điểm ›</div></a>
        <div class="the-dt"><a href="#">Ví hoa hồng</a><a href="#">Sổ địa chỉ</a><a href="#">Tài khoản hoàn tiền</a></div>`,
        "Tài khoản",
      )}</div>
      <h2>Web</h2>${web(`<div class="tieu-de"><h1>Đơn DB-2026-001455</h1>${nhan("Chờ giao", "thong-tin")}</div>
        <div class="the-web"><h2>Điểm thưởng (sửa MAN_HINH_88)</h2>${bang(
          ["Mục", "Giá trị"],
          [
            ["Giai đoạn lúc đặt", "01/11/2026 đến 30/11/2026 · tích 2% · 1 điểm = 1 ₫"],
            ["Hạng lúc đặt", "Vàng · hệ số 1,5"],
            ["Điểm đã dùng", "10.000 điểm = 10.000 ₫"],
            ["Điểm đã hoàn", "0"],
            ["Điểm dự kiến tích", "50.400"],
            ["Điểm đã tích", "— (chờ hoàn tất)"],
            ["Lý do không tích", "—"],
          ],
        )}
          <div class="chu-nho">Tổng thanh toán 1.690.000 ₫ − điểm 10.000 ₫ = tiền thu hộ 1.680.000 ₫.</div></div>`)}`,
  };

  // ---------- Dựng trang ----------
  const goc = document.getElementById("ung-dung");
  const dung = () => {
    goc.innerHTML = `<div class="trang-ban-mau"><header><h1>${ma === 0 ? "" : `MAN_HINH_${ma} `}${TEP[ma][1]}</h1><p>CONG_VIEC_51 · dữ liệu giả · <a href="index.html">Danh sách bản mẫu</a></p></header>
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
      ghi("ban-mau-diem-thuong-trang-thai", trangThai);
      dung();
      return;
    }
    const hanhDong = e.target.closest("[data-thong-bao]");
    if (hanhDong && hanhDong.dataset.thongBao) {
      // Nút có trạng thái đang xử lý, không gửi lặp (danh sách rà soát mục 10).
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
