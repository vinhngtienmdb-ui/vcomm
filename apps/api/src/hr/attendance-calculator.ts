// Tính công từng ngày từ ca dự kiến và lượt chấm (CONG_VIEC_47; QUYTAC_NGHIEPVU_302, 305). Hàm thuần, giờ Việt Nam (UTC+7, không đổi giờ mùa hè).
const minute = 60_000;
const hour = 60 * minute;

export type ShiftDefinition = {
  id: string;
  code: string;
  startTime: string; // "HH:MM" hoặc "HH:MM:SS"
  endTime: string;
  breakStart: string | null;
  breakMinutes: number;
  breakPaid: boolean;
  workUnits: number;
};

export type PlannedDay = { date: string; shift: ShiftDefinition | null; holiday: boolean };

export type DayResult = {
  workDate: string;
  dayKind: "workday" | "rest_day" | "holiday";
  shiftId: string | null;
  shiftCode: string | null;
  plannedStart: Date | null;
  plannedEnd: Date | null;
  standardMinutes: number;
  plannedUnits: number;
  firstIn: Date | null;
  lastOut: Date | null;
  punchCount: number;
  workedMinutes: number;
  nightMinutes: number;
  lateMinutes: number;
  earlyMinutes: number;
  workedUnits: number;
  absentUnits: number;
  status: "scheduled" | "present" | "missing_punch" | "absent" | "rest" | "holiday";
};

type Interval = [number, number];

export const vietnamTime = (date: string, time: string) => new Date(`${date}T${time.slice(0, 5)}:00+07:00`);
export const addDays = (date: string, days: number) => {
  const value = new Date(`${date}T00:00:00Z`);
  value.setUTCDate(value.getUTCDate() + days);
  return value.toISOString().slice(0, 10);
};
// Thứ trong tuần: 0 = thứ hai … 6 = chủ nhật.
export const weekdayIndex = (date: string) => (new Date(`${date}T00:00:00Z`).getUTCDay() + 6) % 7;
export const vietnamDateOf = (instant: Date) => new Date(instant.getTime() + 7 * hour).toISOString().slice(0, 10);

const clockMinutes = (time: string) => {
  const [hours, minutes] = time.split(":").map(Number) as [number, number];
  return hours * 60 + minutes;
};

// Khoảng ca trong một ngày: kết thúc trước hoặc bằng giờ bắt đầu là ca qua ngày hôm sau.
export function shiftInterval(date: string, shift: Pick<ShiftDefinition, "startTime" | "endTime">): Interval {
  const start = vietnamTime(date, shift.startTime).getTime();
  let length = clockMinutes(shift.endTime) - clockMinutes(shift.startTime);
  if (length <= 0) length += 24 * 60;
  return [start, start + length * minute];
}

function breakInterval(date: string, shift: ShiftDefinition): Interval | null {
  if (!shift.breakStart || shift.breakMinutes === 0) return null;
  const [start] = shiftInterval(date, shift);
  let offset = clockMinutes(shift.breakStart) - clockMinutes(shift.startTime);
  if (offset < 0) offset += 24 * 60;
  return [start + offset * minute, start + (offset + shift.breakMinutes) * minute];
}

export function shiftLengthMinutes(shift: Pick<ShiftDefinition, "startTime" | "endTime">): number {
  const [start, end] = shiftInterval("2026-01-05", shift);
  return (end - start) / minute;
}

export function standardMinutes(shift: Pick<ShiftDefinition, "startTime" | "endTime" | "breakMinutes" | "breakPaid">): number {
  return shiftLengthMinutes(shift) - (shift.breakPaid ? 0 : shift.breakMinutes);
}

// Nghỉ giữa ca phải nằm trọn trong ca.
export function breakInsideShift(shift: ShiftDefinition): boolean {
  const interval = breakInterval("2026-01-05", shift);
  if (!interval) return true;
  const [start, end] = shiftInterval("2026-01-05", shift);
  return interval[0] >= start && interval[1] <= end;
}

const overlap = (first: Interval, second: Interval) => Math.max(0, Math.min(first[1], second[1]) - Math.max(first[0], second[0]));

// Khung đêm 22–6 giờ (Bộ luật Lao động Điều 106) quanh một ngày.
function nightIntervals(date: string): Interval[] {
  return [-1, 0, 1].map((offset) => {
    const day = addDays(date, offset);
    return [vietnamTime(day, "22:00").getTime(), vietnamTime(addDays(day, 1), "06:00").getTime()] as Interval;
  });
}

// Phút làm trong khoảng, trừ nghỉ giữa ca không tính giờ làm.
function paidMinutes(worked: Interval, pause: Interval | null, breakPaid: boolean): number {
  return (worked[1] - worked[0] - (pause && !breakPaid ? overlap(worked, pause) : 0)) / minute;
}

export function nightMinutesOfShift(date: string, shift: ShiftDefinition): number {
  const interval = shiftInterval(date, shift);
  return nightMinutesIn(date, interval, breakInterval(date, shift), shift.breakPaid);
}

function nightMinutesIn(date: string, worked: Interval, pause: Interval | null, breakPaid: boolean): number {
  let total = 0;
  for (const night of nightIntervals(date)) {
    const part: Interval = [Math.max(worked[0], night[0]), Math.min(worked[1], night[1])];
    if (part[1] > part[0]) total += paidMinutes(part, pause, breakPaid);
  }
  return Math.round(total);
}

// Khoảng nhận lượt chấm của ngày có ca: [bắt đầu − 4 giờ, kết thúc + 8 giờ], không lấn sang khoảng của ca liền sau.
function punchWindows(days: PlannedDay[]): Map<string, Interval> {
  const windows = new Map<string, Interval>();
  days.forEach((day, index) => {
    if (!day.shift || day.holiday) return;
    const [start, end] = shiftInterval(day.date, day.shift);
    let windowEnd = end + 8 * hour;
    const next = days[index + 1];
    if (next?.shift && !next.holiday) windowEnd = Math.min(windowEnd, shiftInterval(next.date, next.shift)[0] - 4 * hour);
    windows.set(day.date, [start - 4 * hour, Math.max(windowEnd, end)]);
  });
  return windows;
}

// Gán lượt chấm cho ngày: ngày có ca trước, lượt còn lại theo ngày dương lịch.
export function assignPunches(days: PlannedDay[], punches: Date[]): Map<string, Date[]> {
  const windows = punchWindows(days);
  const assigned = new Map<string, Date[]>(days.map((day) => [day.date, []]));
  for (const punch of [...punches].sort((first, second) => first.getTime() - second.getTime())) {
    const time = punch.getTime();
    const owner = [...windows.entries()].find(([, window]) => time >= window[0] && time < window[1])?.[0] ?? vietnamDateOf(punch);
    assigned.get(owner)?.push(punch);
  }
  return assigned;
}

const roundUnits = (value: number) => Math.round(value * 100) / 100;

// Công một ngày (QUYTAC_NGHIEPVU_305). today: ngày hiện tại giờ Việt Nam; now: thời điểm hiện tại.
export function calculateDay(day: PlannedDay, punches: Date[], graceMinutes: number, now: Date): DayResult {
  const shift = day.shift;
  const interval = shift ? shiftInterval(day.date, shift) : null;
  const sorted = [...punches].sort((first, second) => first.getTime() - second.getTime());
  const firstIn = sorted[0] ?? null;
  const lastOut = sorted.length >= 2 ? sorted[sorted.length - 1]! : null;
  const base: DayResult = {
    workDate: day.date,
    dayKind: day.holiday ? "holiday" : shift ? "workday" : "rest_day",
    shiftId: shift?.id ?? null,
    shiftCode: shift?.code ?? null,
    plannedStart: interval ? new Date(interval[0]) : null,
    plannedEnd: interval ? new Date(interval[1]) : null,
    standardMinutes: shift ? standardMinutes(shift) : 0,
    plannedUnits: shift ? shift.workUnits : 0,
    firstIn,
    lastOut,
    punchCount: sorted.length,
    workedMinutes: 0,
    nightMinutes: 0,
    lateMinutes: 0,
    earlyMinutes: 0,
    workedUnits: 0,
    absentUnits: 0,
    status: "scheduled",
  };
  if (day.holiday) return { ...base, status: "holiday" };
  if (!shift || !interval) return { ...base, status: "rest" };
  const ended = now.getTime() >= interval[1];
  if (sorted.length === 0) {
    if (!ended) return base;
    return { ...base, status: "absent", absentUnits: shift.workUnits };
  }
  if (!lastOut) return { ...base, status: ended ? "missing_punch" : "scheduled" };

  const grace = graceMinutes * minute;
  let arrive = firstIn!.getTime();
  let leave = lastOut.getTime();
  let lateMinutes = 0;
  let earlyMinutes = 0;
  // Vào muộn, ra sớm không quá ngưỡng ân hạn coi như đúng giờ.
  if (arrive > interval[0]) {
    if (arrive - interval[0] <= grace) arrive = interval[0];
    else lateMinutes = Math.round((arrive - interval[0]) / minute);
  }
  if (leave < interval[1]) {
    if (interval[1] - leave <= grace) leave = interval[1];
    else earlyMinutes = Math.round((interval[1] - leave) / minute);
  }
  const worked: Interval = [Math.max(arrive, interval[0]), Math.min(leave, interval[1])];
  const pause = breakInterval(day.date, shift);
  const workedMinutes = worked[1] > worked[0] ? Math.round(paidMinutes(worked, pause, shift.breakPaid)) : 0;
  const standard = standardMinutes(shift);
  const workedUnits = standard > 0 ? roundUnits(shift.workUnits * Math.min(1, workedMinutes / standard)) : 0;
  return {
    ...base,
    status: "present",
    workedMinutes,
    nightMinutes: worked[1] > worked[0] ? nightMinutesIn(day.date, worked, pause, shift.breakPaid) : 0,
    lateMinutes,
    earlyMinutes,
    workedUnits,
  };
}

// Giờ vào, giờ ra nhập theo ngày công: giờ ra không sau giờ vào, hoặc ca dự kiến qua đêm mà giờ ra không sau giờ bắt đầu ca, thì là ngày hôm sau.
export function punchInstants(day: PlannedDay, checkIn: string | null | undefined, checkOut: string | null | undefined): Date[] {
  const instants: Date[] = [];
  if (checkIn) instants.push(vietnamTime(day.date, checkIn));
  if (checkOut) {
    let out = vietnamTime(day.date, checkOut);
    const overnight = day.shift ? shiftInterval(day.date, day.shift)[1] > vietnamTime(addDays(day.date, 1), "00:00").getTime() : false;
    if ((instants[0] && out <= instants[0]) || (!instants[0] && overnight && checkOut <= day.shift!.startTime.slice(0, 5))) out = vietnamTime(addDays(day.date, 1), checkOut);
    instants.push(out);
  }
  return instants;
}
