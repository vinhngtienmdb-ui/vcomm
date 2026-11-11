// CONG_VIEC_26 L5 (THAY_DOI_17): phí rút tiền theo lần rút trong tháng và theo số tiền; trừ vào thực nhận, chốt khi duyệt, hạch toán 711 (KICHBAN_KIEMTHU_362).
import type { NestExpressApplication } from "@nestjs/platform-express";
import type { Pool } from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prepareMarketplace, retail, type BuyerCall, type MarketplaceFixture } from "./marketplace-fixture";
import { startTestApplication } from "./setup-database";

let application: NestExpressApplication;
let pool: Pool;
let store: MarketplaceFixture;
let user: BuyerCall;

// Lần 3 trở đi trong tháng: 5.000. Theo số tiền: từ 0 phí cố định 2.000; từ 1.000.000 thu 0,1% (tối thiểu 1.500, tối đa 5.000).
const fees = {
  byCount: [{ fromCount: 3, fee: "5000" }],
  byAmount: [
    { fromAmount: "0", fixedFee: "2000", percent: "0", minimumFee: "0", maximumFee: null },
    { fromAmount: "1000000", fixedFee: "0", percent: "0.1", minimumFee: "1500", maximumFee: "5000" },
  ],
};
const settings = (withdrawalFees: unknown, version: number) =>
  store.call("put", "/marketplace/commission-settings", { taxThreshold: "5000000", taxRate: "10", minimumWithdrawal: "100000", withdrawalFees, version });

beforeAll(async () => {
  ({ application, pool } = await startTestApplication());
  store = await prepareMarketplace(application, pool);
  expect((await store.call("post", "/finance/ledger/setup")).status).toBe(201);
  const userId = await store.register("0935000001", "Người Rút Có Phí");
  user = await store.buyerSession("0935000001");
  await pool.query("INSERT INTO marketplace.wallets (user_id, balance) VALUES ($1, 10000000)", [userId]);
  expect((await user("put", "/buyer/bank-account", { bankName: "ACB", accountNumber: "5566778899", accountHolder: "NGUOI RUT CO PHI" })).status).toBe(200);
});

afterAll(async () => {
  await application?.close();
  await pool?.end();
});

describe("CONG_VIEC_26 phí rút tiền", () => {
  it("KICHBAN_KIEMTHU_362: cấu hình hai bảng phí; phí theo lần (không đếm yêu cầu bị từ chối) cộng phí theo số tiền (tối thiểu, tối đa); dự kiến khi gửi, chốt khi duyệt; Có 711; không tự duyệt; ngày chi không trước ngày duyệt", async () => {
    // Cấu hình sai bị từ chối: trùng mức, tối đa nhỏ hơn tối thiểu, số quá lớn.
    expect((await settings({ byCount: [fees.byCount[0], fees.byCount[0]], byAmount: [] }, 0)).status).toBe(400);
    expect((await settings({ byCount: [], byAmount: [{ ...fees.byAmount[1], maximumFee: "1000" }] }, 0)).status).toBe(400);
    expect((await settings({ byCount: [{ fromCount: 1, fee: "99999999999999" }], byAmount: [] }, 0)).status).toBe(400);
    const saved = await settings(fees, 0);
    expect(saved.status, JSON.stringify(saved.body)).toBe(200);
    expect(saved.body.commissionSettings.withdrawalFees).toEqual(fees);
    // Không gửi bảng phí thì giữ nguyên.
    expect(
      (await store.call("put", "/marketplace/commission-settings", { taxThreshold: "5000000", taxRate: "10", minimumWithdrawal: "100000", version: 1 })).body.commissionSettings.withdrawalFees,
    ).toEqual(fees);
    expect((await user("get", "/buyer/wallet")).body.withdrawal).toMatchObject({ withdrawalFees: fees, withdrawalsThisMonth: 0 });

    // Lần 1, 500.000: phí cố định 2.000.
    const first = (await user("post", "/buyer/withdrawals", { amount: "500000" })).body;
    expect(first).toMatchObject({ taxAmount: "0", feeAmount: "2000", netAmount: "498000" });
    const firstApproved = (await store.call("post", `/marketplace/withdrawals/${first.id}/approve`, { version: 1 })).body;
    expect(firstApproved).toMatchObject({ status: "approved", feeAmount: "2000", netAmount: "498000" });
    // Ngày chi trước ngày duyệt bị từ chối.
    const yesterday = new Date(new Date(`${store.today}T00:00:00Z`).getTime() - 86_400_000).toISOString().slice(0, 10);
    expect((await store.call("post", `/marketplace/withdrawals/${first.id}/pay`, { bankTransactionNo: "FT1", paidOn: yesterday, version: 2 })).status).toBe(400);
    expect((await store.call("post", `/marketplace/withdrawals/${first.id}/pay`, { bankTransactionNo: "FT1", paidOn: store.today, version: 2 })).status).toBe(200);

    // Lần 2, 2.000.000: 0,1% = 2.000 (trên tối thiểu 1.500); bị từ chối nên không đếm.
    const second = (await user("post", "/buyer/withdrawals", { amount: "2000000" })).body;
    expect(second).toMatchObject({ feeAmount: "2000", netAmount: "1998000" });
    expect((await store.call("post", `/marketplace/withdrawals/${second.id}/reject`, { reason: "Kiểm tra lại", version: 1 })).status).toBe(200);
    expect((await user("get", "/buyer/wallet")).body.withdrawal.withdrawalsThisMonth).toBe(1);

    // Vẫn là lần 2: 8.000.000, 0,1% = 8.000 chặn tối đa 5.000; thuế 10% = 800.000; thực nhận 7.195.000.
    const third = (await user("post", "/buyer/withdrawals", { amount: "8000000" })).body;
    expect(third).toMatchObject({ taxAmount: "800000", feeAmount: "5000", netAmount: "7195000" });
    // Kế toán sửa bảng phí trước khi duyệt: số chốt theo bảng lúc duyệt.
    expect((await settings({ byCount: fees.byCount, byAmount: [fees.byAmount[0]] }, 2)).status).toBe(200);
    const thirdApproved = (await store.call("post", `/marketplace/withdrawals/${third.id}/approve`, { version: 1 })).body;
    expect(thirdApproved).toMatchObject({ taxAmount: "800000", feeAmount: "2000", netAmount: "7198000" });
    expect((await settings(fees, 3)).status).toBe(200);
    expect((await store.call("get", "/marketplace/withdrawals?status=approved")).body.data[0]).toMatchObject({ feeAmount: "2000" });
    expect((await store.call("post", `/marketplace/withdrawals/${third.id}/pay`, { bankTransactionNo: "FT3", paidOn: store.today, version: 2 })).status).toBe(200);
    const lines = await pool.query(
      `SELECT a.code, l.debit::float AS debit, l.credit::float AS credit FROM accounting.journals j JOIN accounting.journal_lines l ON l.journal_id = j.id JOIN accounting.accounts a ON a.id = l.account_id
       WHERE j.source_type = 'marketplace_withdrawal' AND j.source_id = $1 ORDER BY l.line_no`,
      [third.id],
    );
    const regime = (await pool.query("SELECT accounting_regime FROM core.companies WHERE id = $1", [retail])).rows[0].accounting_regime as string;
    expect(lines.rows.map((row) => [row.code, row.debit, row.credit])).toEqual([
      ["3388", 8000000, 0],
      [regime === "TT133" ? "1121" : "112", 0, 7198000],
      ["3335", 0, 800000],
      ["711", 0, 2000],
    ]);

    // Lần 3, 1.000.000: phí theo lần 5.000 + 0,1% = 1.000 nâng lên tối thiểu 1.500 = 6.500.
    expect((await user("get", "/buyer/wallet")).body.withdrawal.withdrawalsThisMonth).toBe(2);
    const fourth = (await user("post", "/buyer/withdrawals", { amount: "1000000" })).body;
    expect(fourth).toMatchObject({ feeAmount: "6500", netAmount: "993500" });
    expect((await user("post", `/buyer/withdrawals/${fourth.id}/cancel`, { version: 1 })).status).toBe(200);
    // Phí không được hết số tiền rút.
    expect((await settings({ byCount: [{ fromCount: 1, fee: "200000" }], byAmount: [] }, 4)).status).toBe(200);
    expect((await user("post", "/buyer/withdrawals", { amount: "150000" })).body.error.fields.amount).toBe("Thuế và phí vượt số tiền rút. Vui lòng rút số tiền lớn hơn.");

    // Người duyệt không tự xử lý yêu cầu của chính mình.
    const adminId = (await pool.query("SELECT user_id FROM core.user_identities WHERE provider = 'password' AND provider_subject = 'quantri.vcr@vcomm.test'")).rows[0].user_id;
    await pool.query("INSERT INTO marketplace.wallets (user_id, balance) VALUES ($1, 0)", [adminId]);
    const own = (
      await pool.query("INSERT INTO marketplace.withdrawals (company_id, user_id, amount, bank_name, account_number, account_holder) VALUES ($1, $2, 300000, 'ACB', '1', 'QUAN TRI') RETURNING id", [
        retail,
        adminId,
      ])
    ).rows[0].id;
    expect((await store.call("post", `/marketplace/withdrawals/${own}/approve`, { version: 1 })).body.error.message).toBe(
      "Không được tự duyệt, từ chối hoặc ghi đã chi yêu cầu rút tiền của chính mình.",
    );
  });
});
