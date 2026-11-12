// Bản mẫu CONG_VIEC_60 (MODULE_11 Điểm thưởng phần 2): dựng MAN_HINH_218 đến 223 và phần sửa MAN_HINH_146 từ dữ liệu giả. Không phải mã sản phẩm.
(function () {
  const TEP = {
    218: ["DOI_SOAT_DIEM_NOI_BO", "Đối soát điểm nội bộ (web Tài chính)"],
    219: ["CHI_TIET_DOI_SOAT_DIEM", "Chi tiết bảng đối soát điểm (web Tài chính)"],
    220: ["QUY_TAC_CHONG_GIAN_LAN", "Quy tắc chống gian lận (web)"],
    221: ["VU_VIEC_GIAN_LAN", "Vụ việc gian lận (web)"],
    222: ["BAO_CAO_LIEN_MINH_GIAN_LAN", "Báo cáo liên minh và gian lận (web)"],
    223: ["THIET_BI_VI_DIEM", "Thiết bị của ví điểm (web)"],
    0: ["SUA_KIEU_CHIA_CHI_PHI", "Sửa MAN_HINH_146: kiểu chia chi phí"],
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
  const KHOA = "ban-mau-lien-minh-diem-trang-thai";
  let trangThai = "du-lieu";
  try {
    trangThai = localStorage.getItem(KHOA) || "du-lieu";
  } catch (e) {
    /* bỏ qua */
  }

  // ---------- Thành phần dùng chung ----------
  const nut = (chu, loai, thongBao) => `<button type="button" class="nut ${loai || "chinh"}" data-thong-bao="${thongBao || ""}">${chu}</button>`;
  const nhan = (chu, loai) => `<span class="nhan-trang-thai ${loai}">${chu}</span>`;
  const hop = (chu, loai) => `<div class="hop-thong-bao ${loai}" role="${loai === "loi" ? "alert" : "status"}">${chu}</div>`;
  const tai = (n) => Array.from({ length: n }, () => `<div class="khung-tai" aria-hidden="true"></div>`).join("") + `<span class="an-nhan">Đang tải…</span>`;
  const truong = (nhanO, giaTri, loi, kieu) => {
    const id = "o-" + Math.random().toString(36).slice(2, 8);
    const o = kieu === "nhieu-dong" ? `<textarea id="${id}" rows="3">${giaTri || ""}</textarea>` : `<input id="${id}" class="o-nhap" value="${giaTri || ""}">`;
    return `<div class="truong-dt"><label for="${id}">${nhanO}</label>${o}${loi ? `<span class="loi">${loi}</span>` : ""}</div>`;
  };
  const chon = (nhanO, cacLuaChon, daChon) => {
    const id = "c-" + Math.random().toString(36).slice(2, 8);
    return `<div class="truong-dt"><label for="${id}">${nhanO}</label><select id="${id}" class="o-nhap">${cacLuaChon
      .map((l) => `<option${l === daChon ? " selected" : ""}>${l}</option>`)
      .join("")}</select></div>`;
  };
  const bang = (cot, dong, soCot) => `<div class="cuon-ngang"><table class="bang-web"><thead><tr>${cot.map((c) => `<th scope="col">${c}</th>`).join("")}</tr></thead>
    <tbody>${dong.map((d) => `<tr>${d.map((o, i) => `<td class="${(soCot || []).includes(i) ? "so" : ""}">${o}</td>`).join("")}</tr>`).join("")}</tbody></table></div>`;
  const theWeb = (cacThe, chonThe) => `<nav class="cac-the-web">${cacThe.map((t) => `<a href="#" class="${t === chonThe ? "chon" : ""}">${t}</a>`).join("")}</nav>`;
  const theoTrangThai = (duLieu, rongThan) => {
    if (trangThai === "dang-tai") return tai(4);
    if (trangThai === "loi") return `${hop("Không tải được dữ liệu. Kiểm tra kết nối mạng rồi thử lại.", "loi")}${nut("Thử lại", "phu")}`;
    if (trangThai === "khong-quyen") return hop("Bạn không có quyền xem màn hình này. Liên hệ quản trị công ty để được cấp quyền.", "canh-bao");
    if (trangThai === "rong" && rongThan) return rongThan;
    return duLieu;
  };

  // ---------- Khung web ----------
  const MENU = {
    finance: [
      ["— Công nợ —", ""],
      ["Phiếu thu, phiếu chi", ""],
      ["Đối soát thu hộ", ""],
      ["Đối soát điểm nội bộ", 218],
    ],
    crm: [
      ["— Điểm thưởng —", ""],
      ["Chương trình điểm", 0],
      ["Ví điểm", 223],
      ["Điều chỉnh điểm", ""],
      ["Cảnh báo bất thường", ""],
      ["Quy tắc chống gian lận", 220],
      ["Vụ việc gian lận", 221],
      ["Báo cáo liên minh, gian lận", 222],
      ["Nghĩa vụ điểm", ""],
    ],
  };
  const web = (app, congTy, than) => {
    const menu = MENU[app];
    const chonMenu = ma === 219 ? 218 : ma;
    return `<div class="khung-web"><header class="thanh-tren"><span class="logo">VComm</span><span>${app === "finance" ? "Tài chính – Kế toán" : "Khách hàng và Đối tác"}</span><span class="gian"></span>
    <button type="button">${congTy} ▾</button><button type="button">Trần Minh Khoa ▾</button></header>
    <div class="than"><nav class="menu" aria-label="Menu">${menu
      .map(([chu, dich]) =>
        chu.startsWith("—") ? `<div class="ten-app">${chu.replaceAll("—", "").trim()}</div>` : `<a href="${dich !== "" ? duongDan(dich) : "#"}" class="${dich === chonMenu ? "chon" : ""}">${chu}</a>`,
      )
      .join("")}</nav><main class="noi-dung">${than}</main></div></div>`;
  };

  // ---------- Màn hình ----------
  const MAN_HINH = {
    218: () =>
      web(
        "finance",
        "VComm Thương mại",
        `<div class="tieu-de"><h1>Đối soát điểm nội bộ</h1></div>
        <div class="luoi-truong">${chon("Tháng", ["10/2026", "09/2026", "08/2026"])}${chon("Trạng thái", ["Tất cả", "Chờ xác nhận", "Khiếu nại", "Không khớp", "Đã bù trừ", "Đã tất toán"])}</div>
        ${hop("Bảng lập tự động lúc 2 giờ ngày 1 hằng tháng cho mỗi công ty con có phát sinh nợ nội bộ do điểm. Công ty con chỉ thấy bảng của mình.", "thong-tin")}
        ${theoTrangThai(
          bang(
            ["Số", "Tháng", "Công ty con", "Phải thu (1368)", "Phải trả (3368)", "Bù trừ", "Còn lại", "Trạng thái"],
            [
              [
                `<a href="${duongDan(219)}">DN-2026-0012</a>`,
                "10/2026",
                "Bán lẻ Miền Nam",
                "48.200.000",
                "31.750.000",
                "31.750.000",
                "16.450.000 (công ty con trả)",
                nhan("Công ty con đã xác nhận", "thong-tin"),
              ],
              ["DN-2026-0013", "10/2026", "Bán lẻ Miền Bắc", "12.400.000", "19.900.000", "12.400.000", "7.500.000 (VComm trả)", nhan("Khiếu nại", "canh-bao")],
              ["DN-2026-0014", "10/2026", "Siêu thị Đà Nẵng", "6.100.000", "2.000.000", "—", "—", nhan("Không khớp", "loi")],
              ["DN-2026-0009", "09/2026", "Bán lẻ Miền Nam", "41.000.000", "28.300.000", "28.300.000", "12.700.000 (công ty con trả)", nhan("Đã tất toán", "thanh-cong")],
            ],
            [3, 4, 5, 6],
          ),
          hop("Chưa có bảng đối soát nào trong tháng này.", "thong-tin"),
        )}`,
      ),
    219: () =>
      web(
        "finance",
        "VComm Thương mại",
        `<div class="tieu-de"><h1>DN-2026-0012 · Bán lẻ Miền Nam · 10/2026</h1>${nhan("Công ty con đã xác nhận", "thong-tin")}</div>
        ${theoTrangThai(
          `${theWeb(["Số liệu", "Chi tiết bút toán điểm", "Lịch sử", "Phiếu thu chi"], "Số liệu")}
        <div class="the-web"><h2>Số liệu theo sổ VComm Thương mại (công ty vận hành sàn)</h2>${bang(
          ["Mục", "Phải thu nội bộ (1368)", "Phải trả nội bộ (3368)"],
          [
            ["Số dư đầu kỳ chưa bù trừ", "0", "0"],
            ["Tích điểm tại quầy công ty con", "52.300.000", "—"],
            ["Trừ lại điểm đã tích (trả hàng)", "−4.100.000", "—"],
            ["Dùng điểm tại quầy công ty con", "—", "33.000.000"],
            ["Hoàn điểm đã dùng (trả hàng)", "—", "−1.250.000"],
            ["Số dư cuối kỳ", "<b>48.200.000</b>", "<b>31.750.000</b>"],
            ["Bù trừ", "31.750.000", "31.750.000"],
            ["Còn lại", "<b>16.450.000</b> · Bán lẻ Miền Nam phải trả", ""],
          ],
          [1, 2],
        )}
          ${hop("Đối chiếu sổ hai bên: khớp. Sổ Bán lẻ Miền Nam: phải trả 3368 = 48.200.000, phải thu 1368 = 31.750.000.", "thanh-cong")}
          <div class="chu-nho">Kiểu chia chi phí trong tháng: nơi tích chịu (giai đoạn 01/10/2026 đến 31/10/2026).</div></div>
        <div class="the-web"><h2>Xác nhận</h2>${bang(
          ["Bên", "Trạng thái", "Người xác nhận", "Thời điểm"],
          [
            ["VComm Thương mại", nhan("Chờ xác nhận", "trung-tinh"), "—", "—"],
            ["Bán lẻ Miền Nam", nhan("Đã xác nhận", "thanh-cong"), "Lê Thu Hà", "03/11/2026 09:12"],
          ],
        )}
          <div class="nhom-nut">${nut("Xác nhận phía VComm Thương mại", "chinh", "Đã xác nhận. Đã ghi bút toán bù trừ 31.750.000 ở hai công ty")}${nut("Khiếu nại", "phu")}${nut("Lập lại bảng", "phu", "Đã lập lại bảng")}</div>
          ${truong("Lý do khiếu nại (1 đến 1.000 ký tự)", "", "", "nhieu-dong")}
          ${hop("Đủ hai bên xác nhận thì hệ thống ghi bút toán bù trừ Nợ 3368 / Có 1368 ở cả hai công ty, ngày 31/10/2026.", "thong-tin")}</div>
        <div class="the-web"><h2>Phiếu thu chi nội bộ (sau khi bù trừ)</h2>${bang(
          ["Số", "Công ty", "Loại", "Số tiền", "Trạng thái"],
          [["—", "—", "—", "—", "Chưa có phiếu"]],
          [3],
        )}<div class="nhom-nut">${nut("Lập phiếu thu nợ nội bộ điểm", "phu", "Đã lập phiếu nháp")}</div>
          <div class="chu-nho">Bán lẻ Miền Nam lập phiếu chi trả nợ nội bộ điểm; VComm Thương mại lập phiếu thu. Tổng phiếu đã ghi sổ không vượt số còn lại 16.450.000.</div></div>
        <div class="the-web"><h2>Ví dụ bảng Không khớp (DN-2026-0014)</h2>${hop("Số liệu hai công ty chưa khớp, chưa xác nhận được.", "loi")}${bang(
          ["Bút toán", "Ngày", "Sổ VComm Thương mại", "Sổ Siêu thị Đà Nẵng"],
          [["Tích điểm BL-2026-004512", "14/10/2026", "1368: 120.000", "Không có bút toán"]],
          [2, 3],
        )}</div>`,
        )}`,
      ),
    220: () =>
      web(
        "crm",
        "VComm Thương mại",
        `<div class="tieu-de"><h1>Quy tắc chống gian lận</h1></div>
        ${theoTrangThai(`${bang(
          ["Quy tắc", "Bật", "Ngưỡng", "Mức xử lý", "Sửa lần cuối"],
          [
            ["Nhiều tài khoản trên một thiết bị", "Bật", "> 3 tài khoản trong 30 ngày", nhan("Chặn giao dịch", "canh-bao"), "05/11/2026 · Trần Minh Khoa"],
            ["Đổi điểm dồn dập", "Bật", "> 5 lần hoặc > — điểm trong 24 giờ; ≥ 80% số dư trong 24 giờ trên thiết bị mới", nhan("Cảnh báo", "thong-tin"), "—"],
            ["Tích rồi trả hàng lặp lại", "Bật", "Trừ lại ≥ 50% điểm đã tích trong 90 ngày, đã tích ≥ 10.000 điểm", nhan("Cảnh báo", "thong-tin"), "—"],
            ["Bất thường theo nhân viên", "Bật", "> 3 chứng từ có tích cho cùng khách trong ngày; số điện thoại khách trùng nhân viên", nhan("Chặn và khóa ví", "loi"), "06/11/2026 · Trần Minh Khoa"],
          ],
        )}
        <div class="the-web"><h2>Sửa: Nhiều tài khoản trên một thiết bị</h2><div class="luoi-truong">
          ${chon("Trạng thái", ["Bật", "Tắt"])}${truong("Số tài khoản tối đa trên một thiết bị", "3")}${truong("Khoảng thời gian (ngày)", "30")}
          ${chon("Mức xử lý", ["Cảnh báo", "Chặn giao dịch", "Chặn và khóa ví"], "Chặn giao dịch")}</div>
          ${hop("Chặn giao dịch: khách thấy “Giao dịch điểm tạm bị chặn để kiểm tra. Vui lòng liên hệ chăm sóc khách hàng.”; đơn tích điểm thì không tích. Quy tắc chỉ xét giao dịch mới, không quét lại quá khứ.", "canh-bao")}
          <div class="nhom-nut">${nut("Lưu", "chinh", "Đã lưu quy tắc")}</div></div>
        <div class="the-web"><h2>Lịch sử sửa</h2>${bang(
          ["Thời điểm", "Người sửa", "Quy tắc", "Thay đổi"],
          [["06/11/2026 10:02", "Trần Minh Khoa", "Bất thường theo nhân viên", "Mức: Cảnh báo → Chặn và khóa ví"]],
        )}</div>`)}`,
      ),
    221: () =>
      web(
        "crm",
        "VComm Thương mại",
        `<div class="tieu-de"><h1>Vụ việc gian lận</h1></div>
        <div class="luoi-truong">${chon("Quy tắc", ["Tất cả", "Nhiều tài khoản trên một thiết bị", "Đổi điểm dồn dập", "Tích rồi trả hàng lặp lại", "Bất thường theo nhân viên"])}${chon("Trạng thái", ["Mới, đang xem xét", "Mới", "Đang xem xét", "Vi phạm", "Không vi phạm", "Tất cả"])}${chon("Mức", ["Tất cả", "Cảnh báo", "Chặn giao dịch", "Chặn và khóa ví"])}</div>
        ${theoTrangThai(
          `${bang(
            ["Số", "Ngày", "Quy tắc", "Đối tượng", "Số lần bắt", "Mức đã áp", "Trạng thái"],
            [
              [
                "<a href='#chi-tiet'>GL-2026-0031</a>",
                "12/11/2026",
                "Nhiều tài khoản trên một thiết bị",
                "Thiết bị 3f9a1c07 · 5 tài khoản",
                "3",
                nhan("Chặn giao dịch", "canh-bao"),
                nhan("Mới", "thong-tin"),
              ],
              ["GL-2026-0030", "12/11/2026", "Bất thường theo nhân viên", "Thu ngân Phạm Văn Long · Bán lẻ Miền Nam", "1", nhan("Chặn và khóa ví", "loi"), nhan("Đang xem xét", "canh-bao")],
              ["GL-2026-0027", "10/11/2026", "Tích rồi trả hàng lặp lại", "Ng*** H*** · 0912***456", "1", nhan("Cảnh báo", "thong-tin"), nhan("Không vi phạm", "trung-tinh")],
            ],
            [4],
          )}
        <div class="the-web" id="chi-tiet"><h2>GL-2026-0031 · Nhiều tài khoản trên một thiết bị</h2>${bang(
          ["Mục", "Giá trị"],
          [
            ["Số liệu lúc bắt", "5 tài khoản trên thiết bị 3f9a1c07 trong 30 ngày (ngưỡng 3)"],
            ["Tài khoản", "Ng*** H***, Tr*** L***, Lê*** M***, Ph*** A***, Võ*** T***"],
            ["Chứng từ liên quan", "DB-2026-001501 (chặn dùng điểm), DB-2026-001503 (chặn dùng điểm), DB-2026-001498 (không tích)"],
            ["Hành động đã thực hiện", "Chặn 2 lần dùng điểm, 1 đơn không tích"],
          ],
        )}
          <div class="nhom-nut">${nut("Nhận xem xét", "phu", "Bạn đang xem xét vụ việc")}</div>
          <div class="luoi-truong">${chon("Kết luận", ["Vi phạm", "Không vi phạm"])}${truong("Ghi chú (1 đến 1.000 ký tự)", "", "", "nhieu-dong")}</div>
          <div class="nhom-nut">${nut("Lưu kết luận", "chinh", "Đã lưu kết luận")}</div>
          <div class="chu-nho">Kết luận không tự mở khóa ví; mở khóa tại Ví điểm.</div></div>`,
          hop("Không có vụ việc nào khớp bộ lọc.", "thong-tin"),
        )}`,
      ),
    222: () =>
      web(
        "crm",
        "VComm Thương mại",
        `<div class="tieu-de"><h1>Báo cáo liên minh và gian lận</h1>${nut("Xuất Excel", "phu", "Đã tạo tệp Excel")}</div>
        ${theWeb(["Liên minh", "Gian lận"], "Liên minh")}
        <div class="luoi-truong">${chon("Năm", ["2026", "2025"])}${chon("Tháng", ["10/2026", "09/2026"])}</div>
        ${theoTrangThai(
          `${bang(
            ["Công ty", "Điểm tích", "Giá trị lô", "Chi phí điểm ghi nhận", "Điểm dùng", "Tiền điểm", "Phải thu", "Phải trả", "Đã bù trừ", "Đã thanh toán", "Còn lại"],
            [
              ["VComm Thương mại", "1.250.000", "1.250.000", "1.250.000", "980.000", "980.000", "54.300.000", "51.650.000", "44.150.000", "12.700.000", "—"],
              ["Bán lẻ Miền Nam", "52.300", "52.300.000", "48.200.000", "33.000", "33.000.000", "31.750.000", "48.200.000", "31.750.000", "0", "16.450.000"],
              ["Bán lẻ Miền Bắc", "12.400", "12.400.000", "12.400.000", "19.900", "19.900.000", "19.900.000", "12.400.000", "—", "—", "Khiếu nại"],
            ],
            [1, 2, 3, 4, 5, 6, 7, 8, 9, 10],
          )}
        <div class="the-web"><h2>Gian lận · 10/2026</h2>${bang(
          ["Quy tắc", "Vụ việc", "Cảnh báo", "Chặn", "Chặn và khóa", "Vi phạm", "Không vi phạm", "Giao dịch bị chặn", "Điểm không tích", "Ví tự khóa"],
          [
            ["Nhiều tài khoản trên một thiết bị", "8", "2", "6", "0", "5", "1", "14", "32.000", "0"],
            ["Đổi điểm dồn dập", "3", "3", "0", "0", "1", "2", "0", "0", "0"],
            ["Tích rồi trả hàng lặp lại", "2", "2", "0", "0", "0", "2", "0", "0", "0"],
            ["Bất thường theo nhân viên", "1", "0", "0", "1", "—", "—", "1", "1.500", "1"],
          ],
          [1, 2, 3, 4, 5, 6, 7, 8, 9],
        )}<div class="chu-nho">Kèm mười tài khoản, thiết bị, thu ngân có nhiều vụ việc nhất.</div></div>`,
          hop("Chưa có số liệu trong tháng này.", "thong-tin"),
        )}`,
      ),
    223: () =>
      web(
        "crm",
        "VComm Thương mại",
        `<div class="tieu-de"><h1>Ví điểm · Nguyễn Thị Hoa · 0912***456</h1>${nhan("Đang khóa", "loi")}</div>
        ${theWeb(["Tóm tắt", "Lô điểm", "Sổ cái", "Lịch sử hạng", "Lịch sử khóa", "Thiết bị", "Vụ việc"], "Thiết bị")}
        ${theoTrangThai(
          `${bang(
            ["Thiết bị (8 ký tự đầu mã băm)", "Lần đầu", "Lần cuối", "Số lần", "Tài khoản khác cùng thiết bị"],
            [
              ["3f9a1c07", "02/11/2026", "12/11/2026 08:41", "37", "4 · Tr*** L***, Lê*** M***, Ph*** A***, Võ*** T***"],
              ["b71e0d55", "15/06/2026", "30/10/2026 21:05", "112", "0"],
            ],
            [3],
          )}
        ${hop("Ví tự khóa ngày 12/11/2026 theo quy tắc Bất thường theo nhân viên (GL-2026-0030). Mở khóa ở thẻ Tóm tắt.", "canh-bao")}
        <div class="chu-nho">Dữ liệu thiết bị giữ 12 tháng kể từ lần cuối. Hệ thống chỉ lưu mã băm, không lưu mã gốc của ứng dụng.</div>`,
          hop("Tài khoản chưa dùng ứng dụng VComm có gửi mã cài đặt.", "thong-tin"),
        )}`,
      ),
    0: () =>
      web(
        "crm",
        "VComm Thương mại",
        `<div class="tieu-de"><h1>Chương trình điểm</h1></div>
        ${theoTrangThai(`${bang(
          ["Từ ngày", "Đến ngày", "Tỷ lệ tích", "Giá trị 1 điểm", "Kiểu chia chi phí", "Trạng thái"],
          [
            ["01/12/2026", "—", "1%", "1 ₫", "Công ty vận hành sàn chịu", nhan("Sắp tới", "thong-tin")],
            ["01/11/2026", "30/11/2026", "2%", "1 ₫", "Nơi tích chịu", nhan("Đang hiệu lực", "thanh-cong")],
          ],
          [2, 3],
        )}
        <div class="the-web"><h2>Sửa giai đoạn sắp tới · từ 01/12/2026</h2><div class="luoi-truong">
          ${chon("Kiểu chia chi phí khi khách tích ở công ty này, dùng ở công ty khác", ["Nơi tích chịu", "Nơi dùng chịu", "Công ty vận hành sàn chịu"], "Công ty vận hành sàn chịu")}</div>
          ${hop("Nơi tích chịu: công ty bán ghi chi phí khi tích, VComm Thương mại trả tiền điểm cho nơi dùng.<br>Nơi dùng chịu: VComm Thương mại ghi chi phí tạm khi tích, nơi dùng tự chịu tiền điểm khi khách dùng.<br>Công ty vận hành sàn chịu: VComm Thương mại ghi mọi chi phí, trả tiền điểm cho nơi dùng.", "thong-tin")}
          ${hop("Lô điểm giữ kiểu của giai đoạn lúc tích. Giai đoạn đã bắt đầu không đổi được kiểu chia chi phí.", "canh-bao")}
          <div class="nhom-nut">${nut("Lưu", "chinh", "Đã lưu giai đoạn")}</div></div>`)}`,
      ),
  };

  // ---------- Dựng trang ----------
  const goc = document.getElementById("ung-dung");
  const dung = () => {
    goc.innerHTML = `<div class="trang-ban-mau"><header><h1>${ma === 0 ? "" : `MAN_HINH_${ma} `}${TEP[ma][1]}</h1><p>CONG_VIEC_60 · dữ liệu giả · <a href="index.html">Danh sách bản mẫu</a></p></header>
      <div class="bang-chon" role="group" aria-label="Trạng thái hiển thị"><span class="nhan-bang">Trạng thái:</span>${TRANG_THAI.map(
        ([k, chu]) => `<button type="button" data-trang-thai="${k}" aria-pressed="${k === trangThai}">${chu}</button>`,
      ).join("")}
        <span class="gian"></span>${Object.keys(TEP)
          .map((m) => `<a href="${duongDan(Number(m))}">${m === "0" ? "Sửa 146" : m}</a>`)
          .join(" · ")}</div>
      ${MAN_HINH[ma]()}</div><div class="thong-bao-noi-dt" role="status" aria-live="polite"></div>`;
  };
  document.addEventListener("click", (e) => {
    const chonTrangThai = e.target.closest("[data-trang-thai]");
    if (chonTrangThai) {
      trangThai = chonTrangThai.dataset.trangThai;
      try {
        localStorage.setItem(KHOA, trangThai);
      } catch (loi) {
        /* bỏ qua */
      }
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
