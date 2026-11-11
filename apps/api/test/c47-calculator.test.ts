// CONG_VIEC_47 lát L0: tính công ngày (QUYTAC_NGHIEPVU_302, 305; TIEUCHI_NGHIEMTHU_296; KICHBAN_KIEMTHU_446).
import { describe, expect, it } from "vitest";
import { assignPunches, calculateDay, nightMinutesOfShift, standardMinutes, vietnamTime, type PlannedDay, type ShiftDefinition } from "../src/hr/attendance-calculator";

const office: ShiftDefinition = { id: "hc", code: "HC", startTime: "08:00", endTime: "17:00", breakStart: "12:00", breakMinutes: 60, breakPaid: false, workUnits: 1 };
const night: ShiftDefinition = { id: "dem", code: "DEM", startTime: "22:00", endTime: "06:00", breakStart: "02:00", breakMinutes: 45, breakPaid: true, workUnits: 1 };
const saturday: ShiftDefinition = { id: "t7", code: "T7", startTime: "08:00", endTime: "12:00", breakStart: null, breakMinutes: 0, breakPaid: false, workUnits: 0.5 };
const later = new Date("2026-12-01T00:00:00+07:00");
const at = (date: string, time: string) => vietnamTime(date, time);
const day = (shift: ShiftDefinition | null, date = "2026-11-02", holiday = false): PlannedDay => ({ date, shift, holiday });

describe("CONG_VIEC_47 tính công ngày", () => {
  it("giờ chuẩn và giờ đêm của ca", () => {
    expect(standardMinutes(office)).toBe(480);
    expect(standardMinutes(night)).toBe(480);
    expect(nightMinutesOfShift("2026-11-02", night)).toBe(480);
    expect(nightMinutesOfShift("2026-11-02", office)).toBe(0);
  });

  it("đủ công khi vào trước, ra sau giờ ca", () => {
    const result = calculateDay(day(office), [at("2026-11-02", "07:58"), at("2026-11-02", "12:03"), at("2026-11-02", "17:10")], 5, later);
    expect(result).toMatchObject({ status: "present", workedMinutes: 480, workedUnits: 1, lateMinutes: 0, earlyMinutes: 0, punchCount: 3 });
  });

  it("đi muộn quá ân hạn: công theo giờ thực tế, ghi số phút", () => {
    const result = calculateDay(day(office), [at("2026-11-02", "08:29"), at("2026-11-02", "17:02")], 5, later);
    expect(result).toMatchObject({ lateMinutes: 29, workedMinutes: 451, workedUnits: 0.94 });
  });

  it("đi muộn trong ân hạn coi như đúng giờ; về sớm ghi số phút", () => {
    expect(calculateDay(day(office), [at("2026-11-02", "08:04"), at("2026-11-02", "17:00")], 5, later)).toMatchObject({ lateMinutes: 0, workedMinutes: 480 });
    expect(calculateDay(day(office), [at("2026-11-02", "08:00"), at("2026-11-02", "16:30")], 5, later)).toMatchObject({ earlyMinutes: 30, workedMinutes: 450, workedUnits: 0.94 });
  });

  it("ca nửa ngày tính 0,5 công", () => {
    expect(calculateDay(day(saturday, "2026-11-07"), [at("2026-11-07", "07:55"), at("2026-11-07", "12:01")], 5, later)).toMatchObject({ workedUnits: 0.5, plannedUnits: 0.5 });
  });

  it("thiếu lượt, vắng, ngày lễ, ngày nghỉ, chưa hết ca", () => {
    expect(calculateDay(day(office), [at("2026-11-02", "07:58")], 5, later)).toMatchObject({ status: "missing_punch", workedUnits: 0 });
    expect(calculateDay(day(office), [], 5, later)).toMatchObject({ status: "absent", absentUnits: 1 });
    expect(calculateDay(day(office, "2026-11-02", true), [], 5, later)).toMatchObject({ status: "holiday", dayKind: "holiday", plannedUnits: 1, absentUnits: 0 });
    expect(calculateDay(day(null), [], 5, later)).toMatchObject({ status: "rest", dayKind: "rest_day" });
    expect(calculateDay(day(office), [], 5, at("2026-11-02", "10:00"))).toMatchObject({ status: "scheduled", absentUnits: 0 });
  });

  it("ca đêm qua ngày: lượt sáng hôm sau thuộc ca hôm trước, giờ đêm đủ 8 giờ", () => {
    const days = [day(night, "2026-11-02"), day(night, "2026-11-03"), day(null, "2026-11-04")];
    const punches = [at("2026-11-02", "21:55"), at("2026-11-03", "06:05"), at("2026-11-03", "21:50"), at("2026-11-04", "06:02")];
    const assigned = assignPunches(days, punches);
    expect(assigned.get("2026-11-02")!.map((punch) => punch.toISOString())).toEqual([at("2026-11-02", "21:55").toISOString(), at("2026-11-03", "06:05").toISOString()]);
    expect(assigned.get("2026-11-03")).toHaveLength(2);
    expect(assigned.get("2026-11-04")).toHaveLength(0);
    expect(calculateDay(days[0]!, assigned.get("2026-11-02")!, 5, later)).toMatchObject({ workedMinutes: 480, nightMinutes: 480, workedUnits: 1 });
  });
});
