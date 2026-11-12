// Dữ liệu dùng chung cho kiểm thử giao dịch với đối tác liên minh (CONG_VIEC_65 lát L2 trở đi): công ty vận hành sàn đã khởi tạo kế toán,
// giai đoạn điểm (1 điểm = 1 đồng, hạn 12 tháng), hợp đồng đang hoạt động với tỷ lệ đổi ra 10 điểm = 1 đơn vị (8 đồng/đơn vị), đổi vào 1 đơn vị = 12 điểm (11 đồng/đơn vị),
// bộ giả lập có hai thành viên giả, người mua đã liên kết thành viên.
import type { NestExpressApplication } from "@nestjs/platform-express";
import { createHash, randomUUID } from "node:crypto";
import type { Pool } from "pg";
import request from "supertest";
import { expect } from "vitest";
import { DATABASE, type Database } from "../src/database/database.module";
import { testIds } from "../src/database/seed";
import { creditLot } from "../src/loyalty/ledger.service";
import { lockAccount } from "../src/loyalty/tiers";
import { PermissionService } from "../src/permissions/permission.service";
import { signIn, type Session } from "./helpers";
import type { BuyerCall } from "./marketplace-fixture";

process.env.LOYALTY_PARTNER_SIMULATOR = "on";

export const operator: string = testIds.retailCompany;
export const noLimit = { minPoints: null, maxPoints: null, customerDailyPoints: null, customerMonthlyPoints: null, partnerMonthlyPoints: null };
export type Buyer = { id: string; call: BuyerCall };
// [điểm VComm, đơn vị đối tác, đơn giá] của tỷ lệ đổi ra, đổi vào.
type Rates = { outbound: [number, number, string]; inbound: [number, number, string] };

export interface PartnerFixture {
  admin: Session;
  call: (method: "get" | "post" | "put" | "delete", path: string, body?: object) => request.Test;
  today: string;
  contractId: string;
  partnerId: string;
  register: (phone: string, name: string) => Promise<Buyer>;
  link: (buyer: Buyer, contractId: string, memberNumber: string) => Promise<void>;
  grantPoints: (userId: string, points: number, pointValue?: number, validityMonths?: number) => Promise<void>;
  setSimulatorOtp: (code: string) => Promise<void>;
  createContract: (name: string, taxCode: string, overrides?: object, rates?: Rates) => Promise<{ contractId: string; partnerId: string }>;
}

export async function preparePartners(application: NestExpressApplication, pool: Pool): Promise<PartnerFixture> {
  const http = () => request(application.getHttpServer());
  const hash = (code: string) => createHash("sha256").update(code).digest("hex");
  const today = application.get(PermissionService).today();
  const groupAdmin = await signIn(application, "quantri.tapdoan@vcomm.test");
  expect((await groupAdmin.call("put", "/marketplace/operator-company", { companyId: operator, body: { companyId: operator } })).status).toBe(200);
  const admin = await signIn(application, "quantri.vcr@vcomm.test");
  const call = (method: "get" | "post" | "put" | "delete", path: string, body?: object) => admin.call(method, path, { companyId: operator, ...(body ? { body } : {}) });
  expect((await call("post", "/finance/ledger/setup")).status).toBe(201);
  const phase = { startsOn: today, endsOn: null, earnPercent: "1", pointValue: "1", redeemMaxPercent: "50", redeemMinPoints: 10, validityMonths: 12, orderCapPoints: null, monthlyCapPoints: null };
  expect((await call("post", "/loyalty/phases", phase)).status).toBe(201);

  const register = async (phone: string, name: string): Promise<Buyer> => {
    expect((await http().post("/api/v1/buyer/register/otp").send({ phone })).status).toBe(204);
    await pool.query("UPDATE core.otp_codes SET code_hash = $1 WHERE phone = $2 AND consumed_at IS NULL", [hash("246810"), `+84${phone.slice(1)}`]);
    const created = await http().post("/api/v1/buyer/register").send({ phone, code: "246810", fullName: name, password: "MatKhauNguoiMua@2026" });
    expect(created.status, JSON.stringify(created.body)).toBe(200);
    const login = await http().post("/api/v1/buyer/login").send({ phone, password: "MatKhauNguoiMua@2026" });
    const token = login.body.tokens.accessToken as string;
    const buyerCall: BuyerCall = (method, path, body) => {
      const pending = http()[method](`/api/v1${path}`).set("authorization", `Bearer ${token}`).set("accept-language", "vi");
      return body ? pending.send(body) : pending;
    };
    return { id: created.body.user.id as string, call: buyerCall };
  };
  // Mã OTP bộ giả lập ghi log; kiểm thử đặt mã đã biết cho mã tham chiếu mới nhất.
  const setSimulatorOtp = async (code: string) => {
    await pool.query("UPDATE loyalty.partner_simulator_otps SET code_hash = $1 WHERE reference = (SELECT reference FROM loyalty.partner_simulator_otps ORDER BY created_at DESC LIMIT 1)", [
      hash(code),
    ]);
  };
  const link = async (buyer: Buyer, contractId: string, memberNumber: string) => {
    const requested = await buyer.call("post", `/buyer/loyalty/partners/${contractId}/link`, { memberNumber });
    expect(requested.status, JSON.stringify(requested.body)).toBe(201);
    await setSimulatorOtp("482190");
    expect((await buyer.call("post", `/buyer/loyalty/partner-links/${requested.body.requestId}/verify`, { otp: "482190" })).status).toBe(200);
  };
  const grantPoints = async (userId: string, points: number, pointValue = 1, validityMonths = 12) => {
    await application.get<Database>(DATABASE).transaction(async (transaction) => {
      await lockAccount(transaction, userId);
      await creditLot(transaction, { userId, kind: "adjust_add", sourceType: "adjustment", sourceId: randomUUID(), companyId: operator, points, pointValue, day: today, validityMonths });
    });
  };
  const createContract = async (name: string, taxCode: string, overrides: object = {}, rates: Rates = { outbound: [10, 1, "8"], inbound: [12, 1, "11"] }) => {
    const partnerId = (await pool.query<{ id: string }>("INSERT INTO crm.partners (kind, name, tax_code, search_text) VALUES ('organization', $1, $2, lower($1)) RETURNING id", [name, taxCode]))
      .rows[0]!.id;
    const created = await call("post", "/loyalty/partners", {
      partnerId,
      programName: `${name} Rewards`,
      unitNameVi: "điểm PN",
      unitNameEn: "PN points",
      contractNo: `HDLM-${taxCode}`,
      effectiveFrom: today,
      effectiveTo: null,
      outboundEnabled: true,
      inboundEnabled: true,
      giftEnabled: true,
      paymentMode: "prepaid",
      creditLimit: null,
      paymentTermDays: 15,
      taxPercent: "10",
      connector: "simulator",
      memberPattern: "^[0-9]{10}$",
      limits: { outbound: { ...noLimit, minPoints: 100, maxPoints: 50000, customerDailyPoints: 60000, customerMonthlyPoints: 100000 }, inbound: noLimit, gift: noLimit },
      ...overrides,
    });
    expect(created.status, JSON.stringify(created.body)).toBe(201);
    const contractId = created.body.id as string;
    expect(
      (
        await call("post", `/loyalty/partners/${contractId}/rates`, {
          direction: "outbound",
          startsOn: today,
          endsOn: null,
          vcommPoints: rates.outbound[0],
          partnerUnits: rates.outbound[1],
          unitPrice: rates.outbound[2],
        })
      ).status,
    ).toBe(201);
    expect(
      (
        await call("post", `/loyalty/partners/${contractId}/rates`, {
          direction: "inbound",
          startsOn: today,
          endsOn: null,
          vcommPoints: rates.inbound[0],
          partnerUnits: rates.inbound[1],
          unitPrice: rates.inbound[2],
        })
      ).status,
    ).toBe(201);
    expect((await call("post", `/loyalty/partners/${contractId}/activate`, { version: created.body.version })).status).toBe(201);
    for (const [memberNumber, fullName, balanceUnits] of [
      ["9704123456", "Nguyễn Thị Thảo", 12400],
      ["9704998877", "Lê Văn Bình", 350],
      ["9704555666", "Phạm Văn Dũng", 5000],
    ] as const) {
      expect((await call("post", `/loyalty/partners/${contractId}/simulator/members`, { memberNumber, fullName, phone: "0912345678", balanceUnits })).status).toBe(201);
    }
    return { contractId, partnerId };
  };
  const { contractId, partnerId } = await createContract("Ngân hàng Phương Nam", "0300000101");
  return { admin, call, today, contractId, partnerId, register, link, grantPoints, setSimulatorOtp, createContract };
}

// Dòng bút toán theo vai trò định khoản: [vai trò, Nợ, Có].
export async function journalLines(pool: Pool, sourceType: string, sourceId: string): Promise<[string, number, number][]> {
  const rows = await pool.query<{ role: string; debit: number; credit: number }>(
    `SELECT r.role, l.debit::float AS debit, l.credit::float AS credit FROM accounting.journals j JOIN accounting.journal_lines l ON l.journal_id = j.id
     JOIN accounting.posting_rules r ON r.company_id = j.company_id AND r.account_id = l.account_id AND r.role IN
       ('loyalty_partner_receivable', 'loyalty_partner_payable', 'loyalty_partner_revenue', 'loyalty_partner_tax', 'loyalty_liability', 'loyalty_expense')
     WHERE j.source_type = $1 AND j.source_id = $2 AND j.company_id = $3 ORDER BY l.line_no`,
    [sourceType, sourceId, operator],
  );
  return rows.rows.map((row) => [row.role, row.debit, row.credit]);
}
