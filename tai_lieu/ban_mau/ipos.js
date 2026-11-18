// Bản mẫu CONG_VIEC_74 iPOS: chuyển màn hình và trạng thái. Dữ liệu giả.
(function () {
  function hienMan(ma) {
    document.querySelectorAll('.ipos-man').forEach(function (m) { m.classList.toggle('hien', m.id === ma); });
    document.querySelectorAll('[data-den]').forEach(function (n) { n.setAttribute('aria-current', n.getAttribute('data-den') === ma ? 'true' : 'false'); });
    try { history.replaceState(null, '', '#' + ma); } catch (e) { /* bỏ qua */ }
  }
  document.addEventListener('click', function (e) {
    var nut = e.target.closest('[data-den]');
    if (nut) { e.preventDefault(); hienMan(nut.getAttribute('data-den')); }
  });
  function apTrangThai(tt) {
    document.body.setAttribute('data-trang-thai', tt);
    document.querySelectorAll('[data-tt]').forEach(function (el) {
      el.hidden = el.getAttribute('data-tt').split(/\s+/).indexOf(tt) < 0;
    });
  }
  var chon = document.getElementById('chon-trang-thai');
  if (chon) {
    chon.addEventListener('change', function () { apTrangThai(chon.value); });
  }
  apTrangThai(document.body.getAttribute('data-trang-thai') || 'du-lieu');
  var dau = (location.hash || '').slice(1);
  var dauTien = document.querySelector('.ipos-man');
  hienMan(dau && document.getElementById(dau) ? dau : (dauTien ? dauTien.id : ''));
})();
