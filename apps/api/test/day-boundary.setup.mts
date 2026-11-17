// LOI_14: một tệp kiểm thử không được chạy vắt qua 0 giờ giờ Việt Nam (17:00 UTC).
// Dữ liệu dựng sẵn lấy "hôm nay" một lần rồi gửi cho thao tác mà dịch vụ so với ngày hiện tại, theo hai đồng hồ:
// đồng hồ ứng dụng (CLOCK, PermissionService.today()) và giờ PostgreSQL (now(), vietnamToday, giá trị mặc định created_at).
// Giả lập đồng hồ của Node không với tới PostgreSQL, nên tệp bắt đầu sát 0 giờ thì chờ qua 0 giờ rồi mới chạy:
// mọi "hôm nay" trong tệp (mã kiểm thử, ứng dụng, cơ sở dữ liệu) cùng một ngày.
// Chạy trước mỗi tệp kiểm thử (setupFiles), trước cả mã cấp tệp như hằng số ngày của c52-documents; đuôi .mts để dùng await cấp tệp.
import { vietnamDate } from "../src/common/clock.js";

// Dài hơn thời gian chạy của tệp kiểm thử lâu nhất (đo ngày 2026-11-17: tệp lâu nhất dưới 1 phút kể cả dựng cơ sở dữ liệu, cả bộ 814 kiểm thử khoảng 20 phút) với dư địa cho máy CI chậm.
const dayBoundaryGuard = 5 * 60_000;

function waitBeforeMidnight(now: number): number {
  const nextMidnight = Date.parse(`${vietnamDate(new Date(now))}T00:00:00+07:00`) + 86_400_000;
  // Chờ thêm 1 giây để PostgreSQL, có thể lệch đồng hồ đôi chút, cũng đã sang ngày mới.
  return nextMidnight - now < dayBoundaryGuard ? nextMidnight - now + 1_000 : 0;
}

const wait = waitBeforeMidnight(Date.now());
if (wait > 0) {
  console.warn(`LOI_14: còn ${Math.ceil(wait / 1000)} giây đến 0 giờ giờ Việt Nam; chờ sang ngày mới rồi mới chạy tệp kiểm thử.`);
  await new Promise((resolve) => setTimeout(resolve, wait));
}
