// Bản mẫu MODULE_12 Cửa hàng liên kết (CONG_VIEC_55): thanh trên, menu, chuyển thẻ, thông báo. Không phải mã sản phẩm.
(function () {
  const body = document.body;
  const ma = body.dataset.manHinh;
  const khu = body.dataset.khu; // "cong" (cổng cửa hàng) hoặc "crm" (web quản trị)
  const TEP = {
    174: "QUAY_TICH_DOI_DIEM",
    175: "VOUCHER_CUA_HANG",
    176: "BAO_CAO_DOI_SOAT_CUA_HANG",
    177: "CUA_HANG_CUA_TOI",
    178: "CUA_HANG_LIEN_KET",
    179: "VOUCHER_LIEN_KET",
    180: "DOI_SOAT_LIEN_KET",
    181: "CUA_HANG_LIEN_KET_UNG_DUNG",
  };
  const duongDan = (m) => `MAN_HINH_${m}_${TEP[m]}.html`;
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

  const vaiTro = doc("ban-mau-c55-vai-tro", "chu");
  if (khu === "cong") {
    const menu = [
      ["174", "Quầy tích đổi điểm"],
      ["175", "Voucher"],
      ["176", "Báo cáo và đối soát"],
      ["177", "Cửa hàng của tôi"],
    ].filter(([m]) => vaiTro === "chu" || m === "174");
    document.getElementById("thanh-tren").outerHTML = `<header class="thanh-tren"><span class="logo">VComm Liên kết</span>
      <span>Cà phê Hạt Nâu · Điểm bán Lê Lợi</span><span class="gian"></span>
      <button type="button">Thông báo</button><span>${vaiTro === "chu" ? "Trần Minh Khoa (chủ cửa hàng)" : "Lê Thu Hà (thu ngân)"} ▾</span></header>`;
    document.getElementById("menu").outerHTML = `<nav class="menu" aria-label="Cổng cửa hàng"><div class="ten-app">Cổng cửa hàng</div>${menu
      .map(([m, t]) => `<a href="${duongDan(m)}" class="${m === ma ? "chon" : ""}">${t}</a>`)
      .join("")}</nav>`;
    if (vaiTro !== "chu" && ma !== "174") {
      document.querySelector(".noi-dung").innerHTML = `<div class="khoi-canh-bao loi">Bạn không có quyền xem màn hình này. Thu ngân chỉ dùng Quầy tích đổi điểm.</div>`;
    }
  }
  if (khu === "crm") {
    const menu = [
      ["178", "Cửa hàng liên kết"],
      ["179", "Voucher liên kết"],
      ["180", "Đối soát và giao dịch"],
    ];
    document.getElementById("thanh-tren").outerHTML = `<header class="thanh-tren"><span class="logo">VComm</span><a href="index.html">Trang chủ</a><span class="gian"></span>
      <button type="button">VComm Sàn ▾</button><a href="#">Hộp duyệt <span class="huy-hieu">2</span></a><button type="button">Thông báo</button><span>Nguyễn Thị Hồng Nhung ▾</span></header>`;
    document.getElementById("menu").outerHTML = `<nav class="menu" aria-label="Khách hàng và đối tác"><div class="ten-app">Khách hàng và đối tác</div>
      <a href="#">Đối tác</a><a href="#">Điểm thưởng</a><div class="ten-app" style="margin-top:var(--khoang-3)">Cửa hàng liên kết</div>${menu
        .map(([m, t]) => `<a href="${duongDan(m)}" class="${m === ma ? "chon" : ""}">${t}</a>`)
        .join("")}</nav>`;
  }

  // Chuyển thẻ: nút trong .cac-the có data-the trỏ tới phần tử data-noi-dung-the.
  document.querySelectorAll(".cac-the").forEach((nhom) => {
    nhom.addEventListener("click", (su) => {
      const nut = su.target.closest("button[data-the]");
      if (!nut) return;
      nhom.querySelectorAll("button").forEach((b) => b.classList.toggle("chon", b === nut));
      const vung = nhom.parentElement;
      vung.querySelectorAll("[data-noi-dung-the]").forEach((p) => {
        p.hidden = p.dataset.noiDungThe !== nut.dataset.the;
      });
    });
  });

  // Thông báo nổi cho nút thao tác.
  const vung = document.createElement("div");
  vung.className = "vung-thong-bao";
  vung.setAttribute("role", "status");
  body.appendChild(vung);
  body.addEventListener("click", (su) => {
    const nut = su.target.closest("[data-thong-bao]");
    if (!nut || !nut.dataset.thongBao) return;
    const o = document.createElement("div");
    o.className = "thong-bao-noi " + (nut.dataset.loai || "thanh-cong");
    o.textContent = nut.dataset.thongBao;
    vung.appendChild(o);
    setTimeout(() => o.remove(), 3500);
  });

  // Bảng điều khiển bản mẫu: vai trò cổng cửa hàng.
  if (khu === "cong") {
    const dk = document.createElement("div");
    dk.className = "dieu-khien";
    dk.innerHTML = `<label for="dk-vai-tro">Vai trò</label><select id="dk-vai-tro"><option value="chu">Chủ cửa hàng</option><option value="thu-ngan">Thu ngân</option></select><a href="index.html">Mục lục</a>`;
    body.appendChild(dk);
    const chon = dk.querySelector("select");
    chon.value = vaiTro;
    chon.addEventListener("change", () => {
      ghi("ban-mau-c55-vai-tro", chon.value);
      location.reload();
    });
  }
})();
