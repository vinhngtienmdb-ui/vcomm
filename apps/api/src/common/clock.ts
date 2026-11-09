// Đồng hồ hệ thống thay được trong kiểm thử (KICHBAN_KIEMTHU_60).
export const CLOCK = Symbol("CLOCK");

export interface Clock {
  now(): Date;
}

export const systemClock: Clock = { now: () => new Date() };

const vietnamDateFormat = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Ho_Chi_Minh", year: "numeric", month: "2-digit", day: "2-digit" });

// Ngày theo giờ Việt Nam, dạng YYYY-MM-DD; ngày hiệu lực của quyền tính theo ngày này (QUYTAC_NGHIEPVU_15).
export function vietnamDate(moment: Date): string {
  return vietnamDateFormat.format(moment);
}
