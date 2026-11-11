// Tính một dòng lương (CONG_VIEC_48; QUYTAC_NGHIEPVU_317 đến 321). Hàm thuần, không đọc cơ sở dữ liệu.
// Tiền tính bằng số nguyên đồng (bigint); số thập phân (tỷ lệ, ngày công, giờ) đổi sang bigint nhân 10 000, không dùng số thực dấu phẩy động.

const scale = 10_000n;

// "0.015" → 150n (nhân 10 000); "16500000" → 165000000000n.
export function scaled(value: string | number): bigint {
  const text = String(value).trim();
  const negative = text.startsWith("-");
  const [whole, fraction = ""] = text.replace("-", "").split(".");
  const result = BigInt(whole || "0") * scale + BigInt((fraction + "0000").slice(0, 4));
  return negative ? -result : result;
}

// Chia làm tròn nửa lên (số âm làm tròn theo trị tuyệt đối).
export function divideRound(numerator: bigint, denominator: bigint): bigint {
  if (denominator === 0n) return 0n;
  const negative = numerator < 0n !== denominator < 0n;
  const absoluteNumerator = numerator < 0n ? -numerator : numerator;
  const absoluteDenominator = denominator < 0n ? -denominator : denominator;
  const result = (absoluteNumerator * 2n + absoluteDenominator) / (absoluteDenominator * 2n);
  return negative ? -result : result;
}

// Tiền (đồng, làm tròn đến đồng) từ chuỗi numeric.
export const money = (value: string | number): bigint => divideRound(scaled(value), scale);
const minimum = (left: bigint, right: bigint) => (left < right ? left : right);
const maximum = (left: bigint, right: bigint) => (left > right ? left : right);
// Tiền × tỷ lệ (tỷ lệ đã nhân 10 000).
const applyRate = (amount: bigint, rate: bigint) => divideRound(amount * rate, scale);

export interface ParameterSet {
  baseSalary: string;
  insuranceReference: string | null;
  regionMinimums: [string, string, string, string];
  employeeSocialRate: string;
  employeeHealthRate: string;
  employeeUnemploymentRate: string;
  employerRetirementRate: string;
  employerSicknessRate: string;
  employerHealthRate: string;
  employerUnemploymentRate: string;
  socialCapMultiplier: string;
  healthCapMultiplier: string;
  unemploymentCapMultiplier: string;
  personalDeduction: string;
  dependentDeduction: string;
  flatWithholdingRate: string;
  unpaidDaysThreshold: number;
  taxBrackets: { upperBound: string | null; rate: string }[];
}
export interface CompanySettingSet {
  unionFeeEnabled: boolean;
  unionFeeRate: string;
  accidentRate: string;
  withholdingThreshold: string;
  fallbackStandardDays: number;
  overtimeWeekdayRate: string;
  overtimeWeeklyRestRate: string;
  overtimeHolidayRate: string;
  nightRate: string;
  nightOvertimeRate: string;
}
// Bảy nhóm giờ làm thêm của bảng công tháng (CONG_VIEC_47 QUYTAC_NGHIEPVU_311).
export const overtimeGroups = ["weekday", "weekdayNight", "weekdayNightAfterDay", "weeklyRest", "weeklyRestNight", "holiday", "holidayNight"] as const;
export type OvertimeGroup = (typeof overtimeGroups)[number];
export interface TimesheetFigures {
  // Công chuẩn cả tháng; ngày công hưởng lương (làm việc, phép, lễ, nghỉ có lương); số ngày không làm việc, không hưởng lương (bảo hiểm xã hội và không lương, vắng).
  standardDays: string;
  paidDays: string;
  unpaidDays: string;
  nightHours: string;
  overtimeHours: Record<OvertimeGroup, string>;
  // Ngày phép chưa nghỉ được thanh toán khi nghỉ việc (Bộ luật Lao động Điều 113 khoản 3).
  settledLeaveDays: string;
}
export interface AllowanceInput {
  name: string;
  amount: string;
  // null: dòng phụ cấp lập trước CONG_VIEC_48, chưa có loại.
  type: { name: string; taxMode: "taxable" | "exempt" | "exempt_up_to"; exemptLimit: string | null; prorated: boolean; overtimeBase: boolean } | null;
}
export interface AdjustmentInput {
  kind: "addition" | "deduction";
  taxable: boolean;
  amount: string;
}
export interface EmployeeInput {
  vietnamese: boolean;
  regionMinimum: string | null;
  insuranceSalary: string | null;
  // Hợp đồng trong tháng cho phép đóng bảo hiểm (không phải thử việc riêng, thời hạn từ 1 tháng).
  insuranceEligible: boolean;
  socialExempt: boolean;
  healthExempt: boolean;
  unemploymentExempt: boolean;
  taxMethod: "progressive" | "flat";
  hasCommitment: boolean;
  hasTaxCode: boolean;
  dependents: number;
}
export interface CalculationInput {
  parameters: ParameterSet;
  company: CompanySettingSet;
  // Mỗi đoạn: mức lương tháng của hợp đồng (sau phụ lục) và số ngày lịch trong tháng (QUYTAC_NGHIEPVU_317).
  salarySegments: { salary: string; days: number }[];
  allowances: AllowanceInput[];
  employee: EmployeeInput;
  // null: chưa có bảng công tháng; tính ước tính đủ công theo ngày công chuẩn dự phòng.
  timesheet: TimesheetFigures | null;
  adjustments: AdjustmentInput[];
}

export const blockingWarnings = ["timesheetMissing", "branchRegionMissing", "negativeNet"] as const;
export type PayrollWarning =
  | (typeof blockingWarnings)[number]
  | "allowanceTypeMissing"
  | "missingInsuranceSalary"
  | "insuranceBelowMinimum"
  | "unpaidDaysNoInsurance"
  | "probationNoInsurance"
  | "missingTaxCode"
  | "flatWithholding";

export interface CalculationResult {
  monthlySalary: bigint;
  standardDays: string;
  paidDays: string;
  timePay: bigint;
  allowancePay: bigint;
  allowanceExempt: bigint;
  overtimePay: bigint;
  overtimeExempt: bigint;
  nightPremium: bigint;
  settledLeavePay: bigint;
  additions: bigint;
  additionsExempt: bigint;
  deductions: bigint;
  grossIncome: bigint;
  taxableIncome: bigint;
  socialBase: bigint;
  healthBase: bigint;
  unemploymentBase: bigint;
  employeeSocial: bigint;
  employeeHealth: bigint;
  employeeUnemployment: bigint;
  employerSocial: bigint;
  employerHealth: bigint;
  employerUnemployment: bigint;
  unionFee: bigint;
  familyDeduction: bigint;
  assessableIncome: bigint;
  personalIncomeTax: bigint;
  netPay: bigint;
  employerCost: bigint;
  warnings: PayrollWarning[];
  explanation: Record<string, unknown>;
}

const text = (value: bigint) => value.toString();
// Số thập phân nhân 10 000 về chuỗi gọn: 250000n → "25".
export function decimalText(value: bigint): string {
  const negative = value < 0n;
  const absolute = negative ? -value : value;
  const whole = absolute / scale;
  const fraction = (absolute % scale).toString().padStart(4, "0").replace(/0+$/, "");
  return `${negative ? "-" : ""}${whole}${fraction ? `.${fraction}` : ""}`;
}

export function calculateLine(input: CalculationInput): CalculationResult {
  const { parameters, company, employee } = input;
  const warnings: PayrollWarning[] = [];
  const explanation: Record<string, unknown> = {};

  // Lương tháng bình quân theo số ngày lịch của từng đoạn hợp đồng trong tháng (ngày ngoài hợp đồng đã không có trong ngày công hưởng lương).
  const segmentDays = input.salarySegments.reduce((total, segment) => total + segment.days, 0);
  const monthlySalary =
    segmentDays === 0
      ? 0n
      : divideRound(
          input.salarySegments.reduce((total, segment) => total + money(segment.salary) * BigInt(segment.days), 0n),
          BigInt(segmentDays),
        );
  explanation.salarySegments = input.salarySegments;

  let timesheet = input.timesheet;
  if (!timesheet) {
    warnings.push("timesheetMissing");
    const days = String(company.fallbackStandardDays);
    timesheet = {
      standardDays: days,
      paidDays: days,
      unpaidDays: "0",
      nightHours: "0",
      overtimeHours: Object.fromEntries(overtimeGroups.map((group) => [group, "0"])) as Record<OvertimeGroup, string>,
      settledLeaveDays: "0",
    };
  }
  let standardDays = scaled(timesheet.standardDays);
  if (standardDays <= 0n) standardDays = scaled(company.fallbackStandardDays);
  const paidDays = scaled(timesheet.paidDays);
  const timePay = divideRound(monthlySalary * paidDays, standardDays);

  // Phụ cấp theo loại (QUYTAC_NGHIEPVU_314).
  let allowancePay = 0n;
  let allowanceExempt = 0n;
  let overtimeBaseAllowances = 0n;
  const allowanceLines: Record<string, string | boolean | null>[] = [];
  for (const allowance of input.allowances) {
    const type = allowance.type ?? { name: null, taxMode: "taxable" as const, exemptLimit: null, prorated: true, overtimeBase: false };
    if (!allowance.type && !warnings.includes("allowanceTypeMissing")) warnings.push("allowanceTypeMissing");
    const full = money(allowance.amount);
    const paid = type.prorated ? divideRound(full * paidDays, standardDays) : paidDays > 0n ? full : 0n;
    const exempt = type.taxMode === "exempt" ? paid : type.taxMode === "exempt_up_to" ? minimum(paid, money(type.exemptLimit ?? "0")) : 0n;
    if (type.overtimeBase) overtimeBaseAllowances += full;
    allowancePay += paid;
    allowanceExempt += exempt;
    allowanceLines.push({ name: allowance.name, type: type.name, amount: text(full), paid: text(paid), exempt: text(exempt), prorated: type.prorated });
  }
  explanation.allowances = allowanceLines;

  // Làm thêm giờ, làm đêm (QUYTAC_NGHIEPVU_318). Đơn giá giờ giữ 4 chữ số thập phân.
  const hourlyScaled = divideRound((monthlySalary + overtimeBaseAllowances) * scale * scale, standardDays * 8n);
  const weekday = scaled(company.overtimeWeekdayRate);
  const weeklyRest = scaled(company.overtimeWeeklyRestRate);
  const holiday = scaled(company.overtimeHolidayRate);
  const night = scaled(company.nightRate);
  const nightOvertime = scaled(company.nightOvertimeRate);
  // Nghị định 145/2020/NĐ-CP Điều 57: làm thêm vào ban đêm = hệ số làm thêm + làm đêm + 20% đơn giá ban ngày của ngày đó.
  const groupRates: Record<OvertimeGroup, bigint> = {
    weekday,
    weekdayNight: weekday + night + nightOvertime,
    weekdayNightAfterDay: weekday + night + applyRate(nightOvertime, weekday),
    weeklyRest,
    weeklyRestNight: weeklyRest + night + applyRate(nightOvertime, weeklyRest),
    holiday,
    holidayNight: holiday + night + applyRate(nightOvertime, holiday),
  };
  let overtimePay = 0n;
  let overtimeNormal = 0n;
  const overtimeLines: Record<string, string>[] = [];
  for (const group of overtimeGroups) {
    const hours = scaled(timesheet.overtimeHours[group] ?? "0");
    if (hours === 0n) continue;
    const pay = divideRound(hours * hourlyScaled * groupRates[group], scale * scale * scale);
    const normal = divideRound(hours * hourlyScaled, scale * scale);
    overtimePay += pay;
    overtimeNormal += normal;
    overtimeLines.push({ group, hours: decimalText(hours), rate: decimalText(groupRates[group]), pay: text(pay) });
  }
  // Phần trả cao hơn giờ làm bình thường được miễn thuế.
  const overtimeExempt = maximum(0n, overtimePay - overtimeNormal);
  const nightPremium = divideRound(scaled(timesheet.nightHours) * hourlyScaled * night, scale * scale * scale);
  const settledLeavePay = divideRound(monthlySalary * scaled(timesheet.settledLeaveDays), standardDays);
  explanation.hourlyRate = decimalText(hourlyScaled);
  explanation.overtime = overtimeLines;
  explanation.nightHours = timesheet.nightHours;

  let additions = 0n;
  let additionsExempt = 0n;
  let deductions = 0n;
  for (const adjustment of input.adjustments) {
    const amount = money(adjustment.amount);
    if (adjustment.kind === "addition") {
      additions += amount;
      if (!adjustment.taxable) additionsExempt += amount;
    } else deductions += amount;
  }

  const grossIncome = timePay + allowancePay + overtimePay + nightPremium + settledLeavePay + additions;
  const taxableIncome = maximum(0n, grossIncome - allowanceExempt - overtimeExempt - nightPremium - additionsExempt);

  // Bảo hiểm (QUYTAC_NGHIEPVU_319).
  let socialBase = 0n;
  let healthBase = 0n;
  let unemploymentBase = 0n;
  const insuranceSalary = employee.insuranceSalary === null ? null : money(employee.insuranceSalary);
  const skipForUnpaid = scaled(timesheet.unpaidDays) >= scaled(parameters.unpaidDaysThreshold);
  if (!employee.insuranceEligible) warnings.push("probationNoInsurance");
  else if (skipForUnpaid) warnings.push("unpaidDaysNoInsurance");
  else if (insuranceSalary === null) warnings.push("missingInsuranceSalary");
  else {
    const reference = money(parameters.insuranceReference ?? parameters.baseSalary);
    if (!employee.socialExempt) socialBase = minimum(insuranceSalary, applyRate(reference, scaled(parameters.socialCapMultiplier)));
    if (!employee.healthExempt) healthBase = minimum(insuranceSalary, applyRate(money(parameters.baseSalary), scaled(parameters.healthCapMultiplier)));
    if (employee.vietnamese && !employee.unemploymentExempt) {
      if (employee.regionMinimum === null) warnings.push("branchRegionMissing");
      else unemploymentBase = minimum(insuranceSalary, applyRate(money(employee.regionMinimum), scaled(parameters.unemploymentCapMultiplier)));
    }
    if (employee.regionMinimum !== null && insuranceSalary < money(employee.regionMinimum)) warnings.push("insuranceBelowMinimum");
  }
  const employeeSocial = applyRate(socialBase, scaled(parameters.employeeSocialRate));
  const employeeHealth = applyRate(healthBase, scaled(parameters.employeeHealthRate));
  const employeeUnemployment = applyRate(unemploymentBase, scaled(parameters.employeeUnemploymentRate));
  const employerSocial = applyRate(socialBase, scaled(parameters.employerRetirementRate) + scaled(parameters.employerSicknessRate) + scaled(company.accidentRate));
  const employerHealth = applyRate(healthBase, scaled(parameters.employerHealthRate));
  const employerUnemployment = applyRate(unemploymentBase, scaled(parameters.employerUnemploymentRate));
  const unionFee = company.unionFeeEnabled ? applyRate(socialBase, scaled(company.unionFeeRate)) : 0n;
  const employeeInsurance = employeeSocial + employeeHealth + employeeUnemployment;

  // Thuế thu nhập cá nhân (QUYTAC_NGHIEPVU_320).
  let familyDeduction = 0n;
  let assessableIncome = 0n;
  let personalIncomeTax = 0n;
  const brackets: Record<string, string>[] = [];
  if (!employee.hasTaxCode) warnings.push("missingTaxCode");
  if (employee.taxMethod === "flat") {
    warnings.push("flatWithholding");
    assessableIncome = taxableIncome;
    if (!employee.hasCommitment && taxableIncome >= money(company.withholdingThreshold)) personalIncomeTax = applyRate(taxableIncome, scaled(parameters.flatWithholdingRate));
  } else {
    familyDeduction = money(parameters.personalDeduction) + money(parameters.dependentDeduction) * BigInt(employee.dependents);
    assessableIncome = maximum(0n, taxableIncome - employeeInsurance - familyDeduction);
    let lower = 0n;
    let taxScaled = 0n;
    for (const bracket of parameters.taxBrackets) {
      const upper = bracket.upperBound === null ? null : money(bracket.upperBound);
      const portion = maximum(0n, minimum(assessableIncome, upper ?? assessableIncome) - lower);
      if (portion > 0n) {
        taxScaled += portion * scaled(bracket.rate);
        brackets.push({ from: text(lower), to: upper === null ? "" : text(upper), rate: bracket.rate, tax: text(divideRound(portion * scaled(bracket.rate), scale)) });
      }
      if (upper === null || assessableIncome <= upper) break;
      lower = upper;
    }
    personalIncomeTax = divideRound(taxScaled, scale);
  }
  explanation.taxBrackets = brackets;

  const netPay = grossIncome - employeeInsurance - personalIncomeTax - deductions;
  if (netPay < 0n) warnings.push("negativeNet");
  const employerCost = grossIncome + employerSocial + employerHealth + employerUnemployment + unionFee;
  return {
    monthlySalary,
    standardDays: decimalText(standardDays),
    paidDays: decimalText(paidDays),
    timePay,
    allowancePay,
    allowanceExempt,
    overtimePay,
    overtimeExempt,
    nightPremium,
    settledLeavePay,
    additions,
    additionsExempt,
    deductions,
    grossIncome,
    taxableIncome,
    socialBase,
    healthBase,
    unemploymentBase,
    employeeSocial,
    employeeHealth,
    employeeUnemployment,
    employerSocial,
    employerHealth,
    employerUnemployment,
    unionFee,
    familyDeduction,
    assessableIncome,
    personalIncomeTax,
    netPay,
    employerCost,
    warnings,
    explanation,
  };
}
