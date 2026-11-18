// CONG_VIEC_72 lát L5: đổi điểm ra đối tác liên minh theo thời hạn chuyển đổi (KICHBAN_KIEMTHU_743; QUYTAC_NGHIEPVU_569; API_307).
import type { NestExpressApplication } from "@nestjs/platform-express";
import type { Pool } from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { preparePartners, type PartnerFixture } from "./c65-fixture";
import { startTestApplication, testClock } from "./setup-database";

let application: NestExpressApplication;
let pool: Pool;
let partners: PartnerFixture;
const at = (iso: string) => {
  testClock.fixed = new Date(iso);
};

beforeAll(async () => {
  ({ application, pool } = await startTestApplication());
  partners = await preparePartners(application, pool);
  await pool.query("UPDATE core.authentication_settings SET transition_starts_on = '2026-11-18', buyer_transition_days = 30");
});

afterAll(async () => {
  testClock.fixed = null;
  await application?.close();
  await pool?.end();
});

describe("CONG_VIEC_72 lát L5 đổi điểm đối tác theo thời hạn", () => {
  it("KICHBAN_KIEMTHU_743: đổi ra đối tác liên minh: trong hạn khách chưa kích hoạt không cần mã; hết hạn bắt buộc kích hoạt Smart OTP", async () => {
    const buyer = await partners.register("0912172001", "Khách Đổi Điểm");
    await partners.link(buyer, partners.contractId, "9704555666");
    await partners.grantPoints(buyer.id, 10000);
    const body = { contractId: partners.contractId, direction: "outbound", partnerUnits: 100 };
    at("2026-11-20T03:00:00Z");
    expect((await buyer.call("post", "/buyer/loyalty/partner-exchanges/quote", body)).body).toMatchObject({ smartOtpRequired: false, smartOtpActive: false });
    at("2026-12-18T03:00:00Z");
    expect((await buyer.call("post", "/buyer/loyalty/partner-exchanges/quote", body)).body).toMatchObject({ smartOtpRequired: true, smartOtpActive: false });
    const refused = await buyer.call("post", "/buyer/loyalty/partner-exchanges", body);
    expect(refused.status).toBe(409);
    expect(refused.body.error.message).toBe("Kích hoạt Smart OTP để đổi điểm ra đối tác.");
    testClock.fixed = null;
  });

});
