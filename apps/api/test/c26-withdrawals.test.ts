// CONG_VIEC_26 L3: rút tiền hoa hồng, duyệt chi, thuế thu nhập cá nhân, bảng kê (KICHBAN_KIEMTHU_359).
import type { NestExpressApplication } from "@nestjs/platform-express";
import type { Pool } from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prepareMarketplace, type BuyerCall, type MarketplaceFixture } from "./marketplace-fixture";
import { startTestApplication } from "./setup-database";

let application: NestExpressApplication;
let pool: Pool;
let store: MarketplaceFixture;
let user: BuyerCall;
let userId: string;

const balance = async () => (await user("get", "/buyer/wallet")).body.balance as string;

beforeAll(async () => {
  ({ application, pool } = await startTestApplication());
  store = await prepareMarketplace(application, pool);
  userId = await store.register("0937000001", "Người Nhận Hoa Hồng");
  user = await store.buyerSession("0937000001");
  // Ví có sẵn 6.000.000 (dữ liệu thử; số dư thật do hoa hồng đơn hoàn tất cộng vào).
  await pool.query("INSERT INTO marketplace.wallets (user_id, balance) VALUES ($1, 6000000)", [userId]);
});

afterAll(async () => {
  await application?.close();
  await pool?.end();
});

describe("CONG_VIEC_26 rút tiền hoa hồng", () => {
  it("KICHBAN_KIEMTHU_359: tối thiểu, số dư, tài khoản nhận, một yêu cầu đang chờ, giữ tiền, rút lại và từ chối cộng lại; thuế trên ngưỡng chốt khi duyệt; ghi đã chi; bảng kê; phân quyền", async () => {
    const wallet = (await user("get", "/buyer/wallet")).body;
    expect(wallet.withdrawal).toEqual({ minimumWithdrawal: "100000", taxThreshold: "5000000", taxRate: "10", bankAccount: null, open: null });
    const create = (amount: string) => user("post", "/buyer/withdrawals", { amount });
    expect((await create("50000")).body.error.fields.amount).toBe("Số tiền rút thấp hơn mức tối thiểu.");
    expect((await create("7000000")).body.error.fields.amount).toBe("Số tiền rút vượt số dư ví.");
    expect((await create("12.5")).status).toBe(400);
    expect((await create("6000000")).body.error.message).toBe("Nhập tài khoản ngân hàng nhận tiền trước khi rút.");
    const bankAccount = { bankName: "Vietcombank", accountNumber: "0123456789", accountHolder: "NGUOI NHAN HOA HONG" };
    expect((await user("put", "/buyer/bank-account", bankAccount)).status).toBe(200);

    // Tạo yêu cầu: trừ số dư ngay; thuế dự kiến 10% vì trên 5.000.000.
    const first = await create("6000000");
    expect(first.status, JSON.stringify(first.body)).toBe(201);
    expect(first.body).toMatchObject({ amount: "6000000", taxAmount: "600000", netAmount: "5400000", status: "pending", bankAccount, version: 1 });
    expect(await balance()).toBe("0");
    expect((await create("100000")).body.error.message).toBe("Bạn đang có một yêu cầu rút tiền chưa xử lý xong.");
    expect((await user("get", "/buyer/wallet")).body.withdrawal.open.id).toBe(first.body.id);
    // Rút lại: cộng lại.
    expect((await user("post", `/buyer/withdrawals/${first.body.id}/cancel`, { version: 2 })).status).toBe(409);
    expect((await user("post", `/buyer/withdrawals/${first.body.id}/cancel`, { version: 1 })).body.status).toBe("cancelled");
    expect(await balance()).toBe("6000000");

    // Người dùng thường không có quyền quản trị.
    expect((await user("get", "/marketplace/withdrawals")).status).toBe(403);
    // Từ chối có lý do: cộng lại, báo người dùng.
    const second = (await create("3000000")).body;
    expect(second).toMatchObject({ taxAmount: "0", netAmount: "3000000" });
    expect((await store.call("post", `/marketplace/withdrawals/${second.id}/reject`, { reason: "", version: 1 })).status).toBe(400);
    expect((await user("post", `/marketplace/withdrawals/${second.id}/reject`, { reason: "Sai", version: 1 })).status).toBe(403);
    const rejected = await store.call("post", `/marketplace/withdrawals/${second.id}/reject`, { reason: "Tên chủ tài khoản không khớp", version: 1 });
    expect(rejected.body).toMatchObject({ status: "rejected", rejectReason: "Tên chủ tài khoản không khớp" });
    expect(await balance()).toBe("6000000");

    // Duyệt: chốt thuế theo cài đặt lúc duyệt; sửa cài đặt sau đó không đổi số đã chốt.
    const third = (await create("5500000")).body;
    expect((await store.call("get", "/marketplace/withdrawals?status=pending")).body).toMatchObject({ total: 1, data: [{ id: third.id, userName: "Người Nhận Hoa Hồng", userPhone: "0937000001" }] });
    const approved = await store.call("post", `/marketplace/withdrawals/${third.id}/approve`, { version: 1 });
    expect(approved.body).toMatchObject({ status: "approved", taxAmount: "550000", netAmount: "4950000", version: 2 });
    expect((await store.call("post", `/marketplace/withdrawals/${third.id}/approve`, { version: 2 })).body.error.message).toBe("Yêu cầu rút tiền không còn chờ duyệt.");
    expect((await store.call("put", "/marketplace/commission-settings", { taxThreshold: "1000000", taxRate: "20", minimumWithdrawal: "100000", version: 0 })).status).toBe(200);
    expect((await store.call("get", "/marketplace/withdrawals?status=approved")).body.data[0]).toMatchObject({ taxAmount: "550000", netAmount: "4950000" });
    expect((await user("post", `/buyer/withdrawals/${third.id}/cancel`, { version: 2 })).body.error.message).toBe("Yêu cầu rút tiền không còn chờ duyệt.");
    // Ghi đã chi: ngày không sau hôm nay.
    expect((await store.call("post", `/marketplace/withdrawals/${third.id}/pay`, { bankTransactionNo: "FT001", paidOn: "2999-01-01", version: 2 })).status).toBe(400);
    const paid = await store.call("post", `/marketplace/withdrawals/${third.id}/pay`, { bankTransactionNo: "FT001", paidOn: store.today, version: 2 });
    expect(paid.body).toMatchObject({ status: "paid", bankTransactionNo: "FT001", paidOn: store.today });
    expect((await store.call("post", `/marketplace/withdrawals/${third.id}/pay`, { bankTransactionNo: "FT002", paidOn: store.today, version: 3 })).status).toBe(409);
    expect(await balance()).toBe("500000");

    // Lịch sử ví: trừ, cộng lại, trừ, cộng lại, trừ.
    const history = (await user("get", "/buyer/wallet")).body.transactions.data.map((item: { kind: string; amount: string }) => [item.kind, item.amount]);
    expect(history).toEqual([
      ["withdrawal", "-5500000"],
      ["withdrawal_reversal", "3000000"],
      ["withdrawal", "-3000000"],
      ["withdrawal_reversal", "6000000"],
      ["withdrawal", "-6000000"],
    ]);
    // Bảng kê thuế tháng chi.
    const month = store.today.slice(0, 7);
    expect((await store.call("get", `/marketplace/withdrawals/tax-report?month=${month}`)).body).toEqual({
      month,
      rows: [{ userName: "Người Nhận Hoa Hồng", userPhone: "0937000001", amount: "5500000", taxAmount: "550000", netAmount: "4950000", paidOn: store.today, bankTransactionNo: "FT001" }],
      totalAmount: "5500000",
      totalTax: "550000",
    });
    expect((await store.call("get", "/marketplace/withdrawals/tax-report?month=2026-13")).status).toBe(400);
    const notices = (await pool.query("SELECT kind FROM core.notifications WHERE user_id = $1 ORDER BY created_at", [userId])).rows.map((row) => row.kind);
    expect(notices).toEqual(["marketplace_withdrawal.reject", "marketplace_withdrawal.approve", "marketplace_withdrawal.pay"]);
    const audits = (await pool.query("SELECT action FROM core.audit_events WHERE entity_type = 'marketplace.withdrawals' ORDER BY occurred_at")).rows.map((row) => row.action);
    expect(audits).toEqual(["marketplace.withdrawal.reject", "marketplace.withdrawal.approve", "marketplace.withdrawal.pay"]);
  });
});
