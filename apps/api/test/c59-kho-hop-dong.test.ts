// CONG_VIEC_59 lát L2: kho hợp đồng (TIEUCHI_NGHIEMTHU_429 đến 432; KICHBAN_KIEMTHU_604 đến 608).
import type { NestExpressApplication } from "@nestjs/platform-express";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { Pool } from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { renderPdf } from "../src/common/pdf";
import { testIds } from "../src/database/seed";
import { OfficeContractsService } from "../src/office/contracts/office-contracts.service";
import { OfficeSigningService } from "../src/office/signing/office-signing.service";
import { createTestUser, signIn, type Session } from "./helpers";
import { sentMessages, startTestApplication, testClock } from "./setup-database";

let application: NestExpressApplication;
let pool: Pool;
let signing: OfficeSigningService;
let contracts: OfficeContractsService;
let directory: string;
let admin: Session;
let owner: Session;
let director: Session;
let keeper: Session;
let colleague: Session;
let outsider: Session;
let tradingStaff: Session;
let pdf: Buffer;
const ids: Record<string, string> = {};
const retail = testIds.retailCompany;
const trading = testIds.tradingCompany;

async function user(email: string, name: string, roleCodes: string[], companyId: string = retail): Promise<string> {
  const id = await createTestUser(pool, email, name, [{ companyId }]);
  for (const code of roleCodes) {
    const role = (await pool.query<{ id: string }>("SELECT id FROM core.roles WHERE code = $1 AND (company_id IS NULL OR company_id = $2) ORDER BY company_id NULLS LAST LIMIT 1", [code, companyId]))
      .rows[0]!.id;
    await pool.query("INSERT INTO core.user_role_assignments (user_id, role_id, scope_type, company_id, valid_from) VALUES ($1, $2, 'company', $3, '2026-01-01')", [id, role, companyId]);
  }
  return id;
}

const body = (extra: Record<string, unknown> = {}) => ({
  name: "Mua sữa tươi 2027",
  contractNo: "125/2026/HĐMB",
  typeId: ids.purchaseType,
  partnerIds: [ids.partner],
  value: "4800000000",
  currency: "VND",
  effectiveFrom: "2026-12-01",
  expiresOn: "2027-12-31",
  ...extra,
});

function create(session: Session, data: Record<string, unknown>, withFile = true) {
  const call = session.call("post", "/office/contracts", { companyId: retail }).field("data", JSON.stringify(data));
  return withFile ? call.attach("file", pdf, "hop-dong.pdf") : call;
}

async function identity(session: Session, identityCode: string) {
  const options = await session.call("post", "/office/signing-identities/me/certificates", { companyId: retail, body: { identityCode } });
  await session.call("put", "/office/signing-identities/me", { companyId: retail, body: { identityCode, serialNumber: options.body[0].serialNumber } });
}

beforeAll(async () => {
  directory = mkdtempSync(join(tmpdir(), "ky-so-gia-lap-"));
  process.env.SIGNING_SIMULATOR_DIRECTORY = directory;
  process.env.SIGNING_SIMULATOR_CONFIRM_MILLISECONDS = "0";
  ({ application, pool } = await startTestApplication());
  signing = application.get(OfficeSigningService);
  contracts = application.get(OfficeContractsService);
  pdf = await renderPdf({ content: ["HỢP ĐỒNG MUA BÁN HÀNG HÓA"] });
  ids.department = (await pool.query<{ id: string }>("INSERT INTO core.departments (company_id, code, name) VALUES ($1, 'MH', 'Phòng Mua hàng') RETURNING id", [retail])).rows[0]!.id;
  ids.creatorRole = (
    await pool.query<{ id: string }>("INSERT INTO core.roles (company_id, code, name_vi, name_en) VALUES ($1, 'lap_hop_dong', 'Lập hợp đồng', 'Contract author') RETURNING id", [retail])
  ).rows[0]!.id;
  await pool.query("INSERT INTO core.role_permissions (role_id, permission_code) VALUES ($1, 'office.access'), ($1, 'office.contract.create'), ($1, 'office.signing.use')", [ids.creatorRole]);
  ids.owner = await user("mua.hang.hd@vcomm.test", "Phạm Gia Huy", ["employee", "lap_hop_dong"]);
  ids.director = await user("truong.phong.hd@vcomm.test", "Trần Văn Lâm", ["employee"]);
  ids.keeper = await user("quan.ly.hd@vcomm.test", "Lê Thị Bích Ngọc", ["employee", "office_contract_admin", "office_clerk"]);
  ids.colleague = await user("dong.nghiep.hd@vcomm.test", "Võ Văn Bạn", ["employee"]);
  ids.outsider = await user("nguoi.ngoai.hd@vcomm.test", "Đinh Văn Ngoài", ["employee"]);
  ids.tradingStaff = await user("vct.hd@vcomm.test", "Cao Thị Thương", ["employee", "office_contract_admin"], trading);
  await pool.query("UPDATE core.departments SET manager_user_id = $1 WHERE id = $2", [ids.director, ids.department]);
  await pool.query("UPDATE core.user_company_memberships SET department_id = $1 WHERE user_id = $2", [ids.department, ids.owner]);
  ids.partner = (
    await pool.query<{ id: string }>(
      "INSERT INTO crm.partners (kind, name, tax_code, email, search_text) VALUES ('organization', 'Công ty TNHH Sữa Tươi Thành Hưng', '0309876543', 'kinhdoanh@suathanhhung.test', 'sua tuoi thanh hung') RETURNING id",
    )
  ).rows[0]!.id;
  admin = await signIn(application, "quantri.vcr@vcomm.test");
  owner = await signIn(application, "mua.hang.hd@vcomm.test");
  director = await signIn(application, "truong.phong.hd@vcomm.test");
  keeper = await signIn(application, "quan.ly.hd@vcomm.test");
  colleague = await signIn(application, "dong.nghiep.hd@vcomm.test");
  outsider = await signIn(application, "nguoi.ngoai.hd@vcomm.test");
  tradingStaff = await signIn(application, "vct.hd@vcomm.test");
  const types = await owner.call("get", "/office/contract-types", { companyId: retail });
  expect(types.body.map((type: { name: string }) => type.name)).toEqual(["Mua hàng", "Bán hàng", "Dịch vụ", "Thuê", "Hợp tác", "Bảo mật thông tin", "Khác"]);
  ids.purchaseType = types.body[0].id;
  ids.noValueType = types.body[5].id;
  // Ký số: bộ giả lập, chữ ký số công ty.
  await admin.call("put", "/office/signing-settings", { companyId: retail, body: { provider: "simulator", environment: "test" } });
  const seal = await admin.call("post", "/office/signing-settings/seal-certificates", { companyId: retail, body: { identityCode: "0312345678" } });
  await admin.call("put", "/office/signing-settings/seal", { companyId: retail, body: { identityCode: "0312345678", serialNumber: seal.body[0].serialNumber } });
});

afterAll(async () => {
  testClock.fixed = null;
  await application?.close();
  await pool?.end();
  rmSync(directory, { recursive: true, force: true });
});

describe("CONG_VIEC_59 lát L2: kho hợp đồng", () => {
  it("KICHBAN_KIEMTHU_604: lập, trình, trưởng phòng duyệt, lập phiên ký (chữ ký công ty, đối tác), đã ký; nhãn hiệu lực theo ngày", async () => {
    expect((await create(colleague, body())).status).toBe(403);
    expect((await create(owner, body({ typeId: ids.noValueType }))).body.error.fields.value).toBeTruthy();
    expect((await create(owner, body({ expiresOn: "2026-11-01" }))).status).toBe(400);
    const noFile = await create(owner, body(), false);
    expect(noFile.status).toBe(201);
    expect(noFile.body).toMatchObject({ status: "draft", contractCode: expect.stringMatching(/^HD/), partners: ["Công ty TNHH Sữa Tươi Thành Hưng"], duplicateNo: false });
    expect((await owner.call("post", `/office/contracts/${noFile.body.id}/submit`, { companyId: retail, body: { version: noFile.body.version } })).body.error.fields.file).toBeTruthy();
    const created = await create(owner, body());
    expect(created.body.duplicateNo).toBe(true);
    ids.contract = created.body.id;
    const submitted = await owner.call("post", `/office/contracts/${ids.contract}/submit`, { companyId: retail, body: { version: created.body.version } });
    expect(submitted.body).toMatchObject({ status: "pending", approvalMode: "manager", approvers: [{ fullName: "Trần Văn Lâm" }] });
    // Trưởng phòng là người duyệt nên xem được hợp đồng.
    let detail = (await director.call("get", `/office/contracts/${ids.contract}`, { companyId: retail })).body;
    expect(detail.allowed).toContain("decide");
    detail = (await director.call("post", `/office/contracts/${ids.contract}/decide`, { companyId: retail, body: { decision: "approved", version: detail.version } })).body;
    expect(detail.status).toBe("awaiting_signature");
    detail = (await owner.call("get", `/office/contracts/${ids.contract}`, { companyId: retail })).body;
    expect(detail.allowed).toContain("signing");
    const signers = [
      { kind: "company", signOrder: 1, page: "last", corner: "bottom_right" },
      {
        kind: "partner",
        partnerKind: "organization",
        name: "Công ty TNHH Sữa Tươi Thành Hưng",
        email: "kinhdoanh@suathanhhung.test",
        identity: "0309876543",
        identityCode: "0309876543",
        signOrder: 2,
        page: "last",
        corner: "bottom_left",
      },
    ];
    detail = (await owner.call("post", `/office/contracts/${ids.contract}/signing`, { companyId: retail, body: { dueOn: "2026-12-20", signers, version: detail.version } })).body;
    expect(detail.signingRequestId).toBeTruthy();
    expect(detail.allowed).not.toContain("signing");
    // Văn thư (Quản lý hợp đồng kiêm văn thư) đóng chữ ký công ty; đối tác ký qua đường dẫn.
    let request = (await keeper.call("get", `/office/signing-requests/${detail.signingRequestId}`, { companyId: retail })).body;
    expect(request.sourceType).toBe("contract");
    await keeper.call("post", `/office/signing-requests/${detail.signingRequestId}/sign`, { companyId: retail, body: { signerId: request.mySignerId, version: request.version } });
    await signing.pollAttempts();
    request = (await owner.call("get", `/office/signing-requests/${detail.signingRequestId}`, { companyId: retail })).body;
    expect(request.signers.find((signer: { kind: string }) => signer.kind === "partner").status).toBe("current");
    // Đối tác ký bằng đường dẫn trong thư.
    const link = /\/office\/sign\/([A-Za-z0-9_-]+)/.exec([...sentMessages].reverse().find((message) => message.to === "kinhdoanh@suathanhhung.test")!.body)![1]!;
    await signing.publicSign(link, { ip: null });
    await signing.pollAttempts();
    detail = (await owner.call("get", `/office/contracts/${ids.contract}`, { companyId: retail })).body;
    expect(detail).toMatchObject({ status: "signed", signedOn: expect.any(String), validity: "not_effective" });
    expect(detail.signatureChecks).toHaveLength(2);
    expect(detail.files.find((file: { role: string }) => file.role === "signed")).toBeTruthy();
    expect(detail.events.map((event: { kind: string }) => event.kind)).toEqual(expect.arrayContaining(["created", "submitted", "approved", "signing_started", "signed"]));
    expect(detail.allowed).toEqual(expect.arrayContaining(["end", "appendix", "update_signed", "share"]));
    expect(detail.allowed).not.toContain("edit");
    // Nhãn hiệu lực theo ngày.
    testClock.fixed = new Date("2027-06-01T03:00:00Z");
    expect((await owner.call("get", `/office/contracts/${ids.contract}`, { companyId: retail })).body.validity).toBe("active");
    testClock.fixed = new Date("2027-12-10T03:00:00Z");
    expect((await owner.call("get", `/office/contracts/${ids.contract}`, { companyId: retail })).body.validity).toBe("expiring");
    testClock.fixed = new Date("2028-01-02T03:00:00Z");
    expect((await owner.call("get", `/office/contracts/${ids.contract}`, { companyId: retail })).body.validity).toBe("expired");
    testClock.fixed = null;
  });

  it("KICHBAN_KIEMTHU_606: phụ lục gia hạn: trình, duyệt, nhập bản đã ký cập nhật ngày hết hạn, giá trị, giữ giá trị cũ", async () => {
    let detail = (
      await owner
        .call("post", `/office/contracts/${ids.contract}/appendices`, { companyId: retail })
        .field("data", JSON.stringify({ appendixNo: "01", summary: "Gia hạn 12 tháng", effectiveFrom: "2027-12-31", newExpiresOn: "2028-12-31", newValue: "5000000000" }))
        .attach("file", pdf, "phu-luc.pdf")
    ).body;
    const appendix = detail.appendices[0];
    expect(appendix).toMatchObject({ status: "draft", allowed: expect.arrayContaining(["submit"]) });
    detail = (await owner.call("post", `/office/contracts/${ids.contract}/appendices/${appendix.id}/submit`, { companyId: retail, body: { version: appendix.version } })).body;
    const pending = detail.appendices[0];
    detail = (
      await director.call("post", `/office/contracts/${ids.contract}/appendices/${appendix.id}/decide`, {
        companyId: retail,
        body: { decision: "rejected", note: "Sai giá", version: pending.version },
      })
    ).body;
    expect(detail.appendices[0]).toMatchObject({ status: "rejected", decisionNote: "Sai giá" });
    // Nhập phụ lục 02 đã ký: hợp đồng đổi ngày hết hạn, giá trị.
    detail = (
      await owner
        .call("post", `/office/contracts/${ids.contract}/appendices/import`, { companyId: retail })
        .field("data", JSON.stringify({ appendixNo: "02", summary: "Gia hạn đã ký giấy", effectiveFrom: "2027-12-31", newExpiresOn: "2028-06-30", signedOn: "2026-11-10" }))
        .attach("file", pdf, "phu-luc-02.pdf")
    ).body;
    expect(detail.expiresOn).toBe("2028-06-30");
    expect(detail.value).toBe("4800000000.00");
    expect(detail.appendices.find((item: { appendixNo: string }) => item.appendixNo === "02")).toMatchObject({ status: "signed", previousExpiresOn: "2027-12-31", imported: true });
    const duplicate = await owner
      .call("post", `/office/contracts/${ids.contract}/appendices`, { companyId: retail })
      .field("data", JSON.stringify({ appendixNo: "02", summary: "x", effectiveFrom: "2027-12-31" }));
    expect(duplicate.status).toBe(400);
  });

  it("KICHBAN_KIEMTHU_607: quyền xem: người liên quan, chia sẻ, xem tất cả, hợp đồng mật, công ty khác", async () => {
    expect((await colleague.call("get", `/office/contracts/${ids.contract}`, { companyId: retail })).status).toBe(404);
    expect((await keeper.call("get", `/office/contracts/${ids.contract}`, { companyId: retail })).body.viewReasons).toEqual(["view_all"]);
    expect((await tradingStaff.call("get", `/office/contracts/${ids.contract}`, { companyId: trading })).status).toBe(404);
    const shared = await owner.call("post", `/office/contracts/${ids.contract}/shares`, { companyId: retail, body: { userId: ids.colleague } });
    expect(shared.body.shares.map((person: { fullName: string }) => person.fullName)).toEqual(["Võ Văn Bạn"]);
    const seen = (await colleague.call("get", `/office/contracts/${ids.contract}`, { companyId: retail })).body;
    expect(seen.viewReasons).toEqual(["shared"]);
    expect(seen.allowed).not.toContain("share");
    expect((await colleague.call("get", "/office/contracts", { companyId: retail })).body.items.map((item: { id: string }) => item.id)).toEqual([ids.contract]);
    // Hợp đồng mật: người có quyền xem tất cả không thấy; xem chi tiết ghi nhật ký.
    const secret = await create(owner, body({ name: "Bảo mật dự án sàn mới", contractNo: null, typeId: ids.noValueType, value: null, confidential: true }));
    expect((await keeper.call("get", `/office/contracts/${secret.body.id}`, { companyId: retail })).status).toBe(404);
    expect((await keeper.call("get", "/office/contracts", { companyId: retail })).body.items.map((item: { id: string }) => item.id)).not.toContain(secret.body.id);
    await owner.call("get", `/office/contracts/${secret.body.id}`, { companyId: retail });
    const logs = await pool.query("SELECT 1 FROM core.audit_events WHERE action = 'office.contract.view' AND entity_id = $1", [secret.body.id]);
    expect(logs.rows.length).toBeGreaterThanOrEqual(1);
    // Hợp đồng lao động: chỉ hiện khi có quyền nhân sự, không có lương.
    expect((await keeper.call("get", "/office/contracts", { companyId: retail })).body.laborContracts).toBeNull();
    const adminList = await admin.call("get", "/office/contracts", { companyId: retail });
    expect(Array.isArray(adminList.body.laborContracts)).toBe(true);
    expect(JSON.stringify(adminList.body.laborContracts)).not.toContain("salary");
    expect((await outsider.call("get", "/office/contracts", { companyId: retail })).body.items).toEqual([]);
  });

  it("KICHBAN_KIEMTHU_605: nhập hợp đồng đã ký có chữ ký số được kiểm tra; thanh lý cần biên bản; đã ký không sửa nội dung", async () => {
    const signedFile = (
      await owner
        .call(
          "get",
          `/office/contracts/${ids.contract}/files/${(await owner.call("get", `/office/contracts/${ids.contract}`, { companyId: retail })).body.files.find((file: { role: string }) => file.role === "signed").id}`,
          { companyId: retail },
        )
        .buffer(true)
    ).body as Buffer;
    const imported = await owner
      .call("post", "/office/contracts/import", { companyId: retail })
      .field("data", JSON.stringify(body({ name: "Hợp đồng ký ngoài hệ thống", contractNo: "07/2026/HĐT", signedOn: "2026-11-01", effectiveFrom: "2026-11-01", expiresOn: "2026-11-30" })))
      .attach("file", signedFile, "da-ky.pdf");
    expect(imported.body).toMatchObject({ status: "signed", imported: true });
    expect(imported.body.signatureChecks).toHaveLength(2);
    const update = await owner.call("post", `/office/contracts/${imported.body.id}`, { companyId: retail }).field("data", JSON.stringify({ ...body({ name: "Sửa" }), version: imported.body.version }));
    expect(update.status).toBe(409);
    const noFile = await owner
      .call("post", `/office/contracts/${imported.body.id}/end`, { companyId: retail })
      .field("data", JSON.stringify({ kind: "liquidated", endedOn: "2026-11-30", reason: "Hết hạn", version: imported.body.version }));
    expect(noFile.status).toBe(400);
    const ended = await owner
      .call("post", `/office/contracts/${imported.body.id}/end`, { companyId: retail })
      .field("data", JSON.stringify({ kind: "liquidated", endedOn: "2026-11-30", reason: "Hết hạn", version: imported.body.version }))
      .attach("file", pdf, "bien-ban-thanh-ly.pdf");
    expect(ended.body).toMatchObject({ status: "liquidated", endedOn: "2026-11-30", validity: null });
    expect(ended.body.files.find((file: { role: string }) => file.role === "end")).toBeTruthy();
  });

  it("KICHBAN_KIEMTHU_608: nhắc hạn đúng mốc, mỗi mốc một lần; hợp đồng mật chỉ nhắc người phụ trách", async () => {
    const before = await pool.query("SELECT count(*)::int AS count FROM core.notifications WHERE kind = 'office_contract_expiry'");
    // Hợp đồng chính hết hạn 2028-06-30 sau phụ lục: còn 25 ngày → mốc 30.
    testClock.fixed = new Date("2028-06-05T00:30:00Z");
    expect(await contracts.remindExpiring()).toBeGreaterThanOrEqual(1);
    expect(await contracts.remindExpiring()).toBe(0);
    testClock.fixed = new Date("2028-06-25T00:30:00Z");
    expect(await contracts.remindExpiring()).toBe(1);
    testClock.fixed = new Date("2028-07-01T00:30:00Z");
    expect(await contracts.remindExpiring()).toBe(1);
    testClock.fixed = null;
    const recipients = await pool.query<{ user_id: string; title: string }>(
      "SELECT user_id, title FROM core.notifications WHERE kind = 'office_contract_expiry' AND payload->>'contractId' = $1 ORDER BY created_at",
      [ids.contract],
    );
    expect(recipients.rows.some((row) => row.user_id === ids.owner)).toBe(true);
    expect(recipients.rows.some((row) => row.user_id === ids.keeper)).toBe(true);
    expect(recipients.rows.map((row) => row.title)).toEqual(expect.arrayContaining([expect.stringContaining("đã hết hạn 1 ngày")]));
    const after = await pool.query("SELECT count(*)::int AS count FROM core.notifications WHERE kind = 'office_contract_expiry'");
    expect(after.rows[0].count).toBeGreaterThan(before.rows[0].count);
    const milestones = await pool.query<{ milestone: string }>("SELECT milestone FROM office.contract_reminders WHERE contract_id = $1 ORDER BY sent_at", [ids.contract]);
    expect(milestones.rows.map((row) => row.milestone)).toEqual(["before_30", "before_7", "after_1"]);
  });

  it("hủy hợp đồng chờ ký hủy luôn phiên ký; loại hợp đồng: thêm, trùng tên, chỉ người quản lý", async () => {
    const created = await create(owner, body({ name: "Hủy thử", contractNo: null }));
    let detail = (await owner.call("post", `/office/contracts/${created.body.id}/submit`, { companyId: retail, body: { version: created.body.version } })).body;
    detail = (await director.call("post", `/office/contracts/${created.body.id}/decide`, { companyId: retail, body: { decision: "approved", version: detail.version } })).body;
    detail = (await owner.call("get", `/office/contracts/${created.body.id}`, { companyId: retail })).body;
    // Người ký chưa có tài khoản ký số: không lập được phiên, không để lại phiên treo.
    const failed = await owner.call("post", `/office/contracts/${created.body.id}/signing`, {
      companyId: retail,
      body: { dueOn: "2026-12-20", signers: [{ kind: "user", userId: ids.director, signOrder: 1, page: "last", corner: "bottom_right" }], version: detail.version },
    });
    expect(failed.body.error.message).toContain("chưa khai tài khoản ký số");
    await identity(director, "079090001234");
    detail = (
      await owner.call("post", `/office/contracts/${created.body.id}/signing`, {
        companyId: retail,
        body: { dueOn: "2026-12-20", signers: [{ kind: "user", userId: ids.director, signOrder: 1, page: "last", corner: "bottom_right" }], version: detail.version },
      })
    ).body;
    const cancelled = await owner.call("post", `/office/contracts/${created.body.id}/cancel`, { companyId: retail, body: { reason: "Đổi đối tác", version: detail.version } });
    expect(cancelled.body.status).toBe("cancelled");
    const request = await pool.query<{ status: string }>("SELECT status FROM office.signing_requests WHERE id = $1", [detail.signingRequestId]);
    expect(request.rows[0]!.status).toBe("cancelled");
    expect((await owner.call("post", "/office/contract-types", { companyId: retail, body: { name: "Đại lý", direction: "sale" } })).status).toBe(403);
    expect((await keeper.call("post", "/office/contract-types", { companyId: retail, body: { name: "Đại lý", direction: "sale" } })).body.map((type: { name: string }) => type.name)).toContain(
      "Đại lý",
    );
    expect((await keeper.call("post", "/office/contract-types", { companyId: retail, body: { name: "đại lý", direction: "sale" } })).status).toBe(400);
  });
});
