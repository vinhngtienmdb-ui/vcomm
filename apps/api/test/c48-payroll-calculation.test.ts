// CONG_VIEC_48 lát L1: hàm tính dòng lương (TIEUCHI_NGHIEMTHU_305 đến 307; KICHBAN_KIEMTHU_456 đến 459). Số liệu theo đặc tả mục 12 và bản mẫu MAN_HINH_127, 128.
import { describe, expect, it } from "vitest";
import { calculateLine, overtimeGroups, type CalculationInput, type OvertimeGroup } from "../src/hr/payroll-calculation";

const parameters: CalculationInput["parameters"] = {
  baseSalary: "2530000",
  insuranceReference: null,
  regionMinimums: ["5310000", "4730000", "4140000", "3700000"],
  employeeSocialRate: "0.08",
  employeeHealthRate: "0.015",
  employeeUnemploymentRate: "0.01",
  employerRetirementRate: "0.14",
  employerSicknessRate: "0.03",
  employerHealthRate: "0.03",
  employerUnemploymentRate: "0.01",
  socialCapMultiplier: "20",
  healthCapMultiplier: "20",
  unemploymentCapMultiplier: "20",
  personalDeduction: "15500000",
  dependentDeduction: "6200000",
  flatWithholdingRate: "0.1",
  unpaidDaysThreshold: 14,
  taxBrackets: [
    { upperBound: "10000000", rate: "0.05" },
    { upperBound: "30000000", rate: "0.1" },
    { upperBound: "60000000", rate: "0.2" },
    { upperBound: "100000000", rate: "0.3" },
    { upperBound: null, rate: "0.35" },
  ],
};
const company: CalculationInput["company"] = {
  unionFeeEnabled: true,
  unionFeeRate: "0.02",
  accidentRate: "0.005",
  withholdingThreshold: "2000000",
  fallbackStandardDays: 26,
  overtimeWeekdayRate: "1.5",
  overtimeWeeklyRestRate: "2",
  overtimeHolidayRate: "3",
  nightRate: "0.3",
  nightOvertimeRate: "0.2",
};
const noOvertime = Object.fromEntries(overtimeGroups.map((group) => [group, "0"])) as Record<OvertimeGroup, string>;
const timesheet = (paidDays: string, extra: Partial<NonNullable<CalculationInput["timesheet"]>> = {}) => ({
  standardDays: "25",
  paidDays,
  unpaidDays: "0",
  nightHours: "0",
  overtimeHours: noOvertime,
  settledLeaveDays: "0",
  ...extra,
});
const employee = (extra: Partial<CalculationInput["employee"]> = {}): CalculationInput["employee"] => ({
  vietnamese: true,
  regionMinimum: "5310000",
  insuranceSalary: null,
  insuranceEligible: true,
  socialExempt: false,
  healthExempt: false,
  unemploymentExempt: false,
  taxMethod: "progressive",
  hasCommitment: false,
  hasTaxCode: true,
  dependents: 0,
  ...extra,
});
const input = (extra: Partial<CalculationInput>): CalculationInput => ({
  parameters,
  company,
  salarySegments: [{ salary: "30000000", days: 30 }],
  allowances: [],
  employee: employee(),
  timesheet: timesheet("25"),
  adjustments: [],
  ...extra,
});
const plain = (result: ReturnType<typeof calculateLine>) =>
  Object.fromEntries(Object.entries(result).map(([key, value]) => [key, typeof value === "bigint" ? Number(value) : value])) as Record<string, unknown>;

describe("KICHBAN_KIEMTHU_456: lương thời gian, phụ cấp, hợp đồng đổi giữa tháng", () => {
  it("ví dụ đặc tả mục 12: 30 triệu, đủ công, 1 người phụ thuộc", () => {
    const result = plain(calculateLine(input({ employee: employee({ insuranceSalary: "30000000", dependents: 1 }) })));
    expect(result).toMatchObject({
      timePay: 30000000,
      employeeSocial: 2400000,
      employeeHealth: 450000,
      employeeUnemployment: 300000,
      assessableIncome: 5150000,
      personalIncomeTax: 257500,
      netPay: 26592500,
      employerSocial: 5250000,
      employerHealth: 900000,
      employerUnemployment: 300000,
      unionFee: 600000,
      employerCost: 37050000,
      warnings: [],
    });
  });

  it("phụ cấp miễn đến mức, theo ngày công hoặc không; dòng chưa có loại cảnh báo", () => {
    const allowances = [
      { name: "Ăn trưa", amount: "730000", type: { name: "Ăn trưa", taxMode: "exempt_up_to" as const, exemptLimit: "730000", prorated: true, overtimeBase: false } },
      { name: "Điện thoại", amount: "300000", type: { name: "Điện thoại", taxMode: "taxable" as const, exemptLimit: null, prorated: false, overtimeBase: false } },
    ];
    const half = plain(calculateLine(input({ salarySegments: [{ salary: "16500000", days: 30 }], allowances, timesheet: timesheet("12.5") })));
    expect(half).toMatchObject({ timePay: 8250000, allowancePay: 365000 + 300000, allowanceExempt: 365000 });
    const legacy = plain(calculateLine(input({ allowances: [{ name: "Cũ", amount: "500000", type: null }] })));
    expect(legacy).toMatchObject({ allowancePay: 500000, allowanceExempt: 0 });
    expect(legacy.warnings).toContain("allowanceTypeMissing");
  });

  it("phụ lục tăng lương giữa tháng: bình quân theo ngày lịch", () => {
    const result = plain(
      calculateLine(
        input({
          salarySegments: [
            { salary: "15000000", days: 15 },
            { salary: "16500000", days: 15 },
          ],
        }),
      ),
    );
    expect(result.monthlySalary).toBe(15750000);
    expect(result.timePay).toBe(15750000);
  });

  it("vào làm giữa tháng: lương theo ngày công hưởng lương; chưa có bảng công thì cảnh báo chặn", () => {
    const probation = plain(
      calculateLine(input({ salarySegments: [{ salary: "6375000", days: 28 }], employee: employee({ insuranceEligible: false, taxMethod: "flat", hasTaxCode: false }), timesheet: timesheet("24") })),
    );
    expect(probation).toMatchObject({ timePay: 6120000, employeeSocial: 0, personalIncomeTax: 612000, netPay: 5508000, employerCost: 6120000 });
    expect(probation.warnings).toEqual(["probationNoInsurance", "missingTaxCode", "flatWithholding"]);
    expect(calculateLine(input({ timesheet: null })).warnings).toContain("timesheetMissing");
  });
});

describe("KICHBAN_KIEMTHU_457: làm thêm giờ, làm đêm, phần miễn thuế", () => {
  it("ví dụ MAN_HINH_128: 8 giờ ngày thường, đơn giá 82.500", () => {
    const allowances = [
      { name: "Ăn trưa", amount: "730000", type: { name: "Ăn trưa", taxMode: "exempt_up_to" as const, exemptLimit: "730000", prorated: true, overtimeBase: false } },
      { name: "Điện thoại", amount: "300000", type: { name: "Điện thoại", taxMode: "taxable" as const, exemptLimit: null, prorated: false, overtimeBase: false } },
    ];
    const result = plain(
      calculateLine(
        input({
          salarySegments: [{ salary: "16500000", days: 30 }],
          allowances,
          employee: employee({ insuranceSalary: "16500000", dependents: 1 }),
          timesheet: timesheet("25", { overtimeHours: { ...noOvertime, weekday: "8" } }),
          adjustments: [{ kind: "deduction", taxable: false, amount: "2000000" }],
        }),
      ),
    );
    expect(result).toMatchObject({
      overtimePay: 990000,
      overtimeExempt: 330000,
      grossIncome: 18520000,
      taxableIncome: 17460000,
      employeeSocial: 1320000,
      employeeHealth: 247500,
      employeeUnemployment: 165000,
      personalIncomeTax: 0,
      netPay: 14787500,
      employerSocial: 2887500,
      employerHealth: 495000,
      employerUnemployment: 165000,
      unionFee: 330000,
      employerCost: 22397500,
    });
    expect(result.explanation).toMatchObject({ hourlyRate: "82500" });
  });

  it("làm thêm ban đêm, ngày nghỉ, ngày lễ theo Nghị định 145 Điều 57; giờ làm đêm thêm 30% miễn thuế", () => {
    // Đơn giá 20 000 đồng/giờ: 4 000 000 / (25 × 8).
    const hours = { weekday: "1", weekdayNight: "1", weekdayNightAfterDay: "1", weeklyRest: "1", weeklyRestNight: "1", holiday: "1", holidayNight: "1" };
    const result = plain(calculateLine(input({ salarySegments: [{ salary: "4000000", days: 30 }], timesheet: timesheet("25", { overtimeHours: hours, nightHours: "10" }) })));
    // 150% + 200% + 210% + 200% + 270% + 300% + 390% = 1720% của 20 000.
    expect(result.overtimePay).toBe(344000);
    expect(result.overtimeExempt).toBe(344000 - 7 * 20000);
    expect(result.nightPremium).toBe(60000);
    expect(result.taxableIncome).toBe(4000000 + 7 * 20000);
  });

  it("phụ cấp tính vào đơn giá làm thêm", () => {
    const allowances = [{ name: "Trách nhiệm", amount: "1000000", type: { name: "Trách nhiệm", taxMode: "taxable" as const, exemptLimit: null, prorated: true, overtimeBase: true } }];
    const result = plain(calculateLine(input({ salarySegments: [{ salary: "4000000", days: 30 }], allowances, timesheet: timesheet("25", { overtimeHours: { ...noOvertime, weekday: "2" } }) })));
    expect(result.overtimePay).toBe(2 * 25000 * 1.5);
  });
});

describe("KICHBAN_KIEMTHU_458: bảo hiểm, mức trần, trường hợp không đóng", () => {
  it("mức trần: xã hội, y tế 20 × 2.530.000; thất nghiệp 20 × lương tối thiểu vùng", () => {
    const result = plain(calculateLine(input({ salarySegments: [{ salary: "150000000", days: 30 }], employee: employee({ insuranceSalary: "150000000", regionMinimum: "4140000" }) })));
    expect(result).toMatchObject({ socialBase: 50600000, healthBase: 50600000, unemploymentBase: 82800000, employeeSocial: 4048000, employeeUnemployment: 828000, unionFee: 1012000 });
  });

  it("nghỉ không lương từ 14 ngày, người nước ngoài, miễn đóng, thiếu vùng, dưới lương tối thiểu", () => {
    expect(calculateLine(input({ employee: employee({ insuranceSalary: "22000000" }), timesheet: timesheet("10", { unpaidDays: "15" }) })).socialBase).toBe(0n);
    expect(calculateLine(input({ employee: employee({ insuranceSalary: "22000000" }), timesheet: timesheet("10", { unpaidDays: "15" }) })).warnings).toContain("unpaidDaysNoInsurance");
    expect(calculateLine(input({ employee: employee({ insuranceSalary: "22000000" }), timesheet: timesheet("12", { unpaidDays: "13" }) })).socialBase).toBe(22000000n);
    const foreigner = calculateLine(input({ employee: employee({ insuranceSalary: "22000000", vietnamese: false }) }));
    expect([foreigner.socialBase, foreigner.unemploymentBase]).toEqual([22000000n, 0n]);
    const exempt = calculateLine(input({ employee: employee({ insuranceSalary: "22000000", socialExempt: true }) }));
    expect([exempt.socialBase, exempt.healthBase, exempt.unionFee]).toEqual([0n, 22000000n, 0n]);
    expect(calculateLine(input({ employee: employee({ insuranceSalary: "22000000", regionMinimum: null }) })).warnings).toContain("branchRegionMissing");
    expect(calculateLine(input({ employee: employee({ insuranceSalary: "5000000" }) })).warnings).toContain("insuranceBelowMinimum");
    expect(calculateLine(input({})).warnings).toContain("missingInsuranceSalary");
    expect(calculateLine(input({ company: { ...company, unionFeeEnabled: false }, employee: employee({ insuranceSalary: "22000000" }) })).unionFee).toBe(0n);
  });
});

describe("KICHBAN_KIEMTHU_459: thuế lũy tiến, khấu trừ 10%, cam kết", () => {
  it("lũy tiến qua nhiều bậc", () => {
    // Thu nhập tính thuế 84.500.000: 500.000 + 2.000.000 + 6.000.000 + 7.350.000 = 15.850.000.
    const result = calculateLine(input({ salarySegments: [{ salary: "100000000", days: 30 }] }));
    expect(result.assessableIncome).toBe(84500000n);
    expect(result.personalIncomeTax).toBe(15850000n);
    expect(result.explanation.taxBrackets).toHaveLength(4);
  });

  it("khấu trừ 10% từ ngưỡng; dưới ngưỡng hoặc có cam kết thì không", () => {
    const flat = (salary: string, hasCommitment = false) =>
      calculateLine(input({ salarySegments: [{ salary, days: 30 }], employee: employee({ taxMethod: "flat", hasCommitment }) })).personalIncomeTax;
    expect(flat("2000000")).toBe(200000n);
    expect(flat("1999999")).toBe(0n);
    expect(flat("8000000", true)).toBe(0n);
  });

  it("khoản cộng thêm không chịu thuế, khấu trừ; thực lĩnh âm là cảnh báo chặn", () => {
    const result = calculateLine(
      input({
        adjustments: [
          { kind: "addition", taxable: false, amount: "1000000" },
          { kind: "addition", taxable: true, amount: "2000000" },
          { kind: "deduction", taxable: false, amount: "500000" },
        ],
      }),
    );
    expect([result.grossIncome, result.taxableIncome, result.deductions]).toEqual([33000000n, 32000000n, 500000n]);
    expect(calculateLine(input({ adjustments: [{ kind: "deduction", taxable: false, amount: "99000000" }] })).warnings).toContain("negativeNet");
  });
});
