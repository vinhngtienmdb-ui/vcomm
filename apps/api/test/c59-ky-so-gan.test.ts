// CONG_VIEC_59 lát L3: ký số công văn đi, hợp đồng lao động (CHUC_NANG_213; TIEUCHI_NGHIEMTHU_433; KICHBAN_KIEMTHU_609).
import type { NestExpressApplication } from "@nestjs/platform-express";
import { messages } from "i18n";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { Pool } from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { LocalFileStorage } from "../src/common/file-storage";
import { OutboxService } from "../src/common/outbox.service";
import { renderPdf } from "../src/common/pdf";
import { testIds } from "../src/database/seed";
import { OfficeSigningService } from "../src/office/signing/office-signing.service";
import { createTestUser, signIn, type Session } from "./helpers";
import { sentMessages, startTestApplication, testStorage } from "./setup-database";

let application: NestExpressApplication;
let pool: Pool;
let signing: OfficeSigningService;
let outbox: OutboxService;
let directory: string;
let admin: Session;
let clerk: Session;
let drafter: Session;
let signer: Session;
let hrStaff: Session;
let director: Session;
let worker: Session;
let pdf: Buffer;
const ids: Record<string, string> = {};
const retail = testIds.retailCompany;
const branch = testIds.headOfficeBranch;
const message = (key: keyof (typeof messages)["vi"]["errors"]) => messages.vi.errors[key];
const signatureCount = (content: Buffer) => content.toString("latin1").split("/ByteRange").length - 1;

async function user(email: string, name: string, roleCodes: string[]): Promise<string> {
  const id = await createTestUser(pool, email, name, [{ companyId: retail }]);
  for (const code of roleCodes) {
    const role = (await pool.query<{ id: string }>("SELECT id FROM core.roles WHERE code = $1 AND company_id IS NULL", [code])).rows[0]!.id;
    await pool.query("INSERT INTO core.user_role_assignments (user_id, role_id, scope_type, company_id, valid_from) VALUES ($1, $2, 'company', $3, '2026-01-01')", [id, role, retail]);
  }
  return id;
}

async function identity(session: Session, identityCode: string) {
  const options = await session.call("post", "/office/signing-identities/me/certificates", { companyId: retail, body: { identityCode } });
  await session.call("put", "/office/signing-identities/me", { companyId: retail, body: { identityCode, serialNumber: options.body[0].serialNumber } });
}

// Người đang đến lượt ký phần của mình rồi hệ thống hỏi kết quả ở nhà cung cấp.
async function signMyTurn(session: Session, requestId: string) {
  const request = (await session.call("get", `/office/signing-requests/${requestId}`, { companyId: retail })).body;
  expect(request.mySignerId, JSON.stringify(request)).toBeTruthy();
  const started = await session.call("post", `/office/signing-requests/${requestId}/sign`, { companyId: retail, body: { signerId: request.mySignerId, version: request.version } });
  expect(started.status, JSON.stringify(started.body)).toBeLessThan(300);
  await signing.pollAttempts();
}

async function employee(name: string, identityNumber: string, extra: Record<string, unknown> = {}) {
  const created = await hrStaff.call("post", "/hr/employees", {
    companyId: retail,
    body: {
      fullName: name,
      gender: "female",
      birthDate: "1996-03-01",
      identityNumber,
      residence: "Thành phố Hồ Chí Minh",
      hireDate: "2025-01-01",
      departmentId: ids.department,
      branchId: branch,
      jobTitle: "Nhân viên bán hàng",
      ...extra,
    },
  });
  expect(created.status, JSON.stringify(created.body)).toBe(201);
  return created.body.id as string;
}

// Hợp đồng lao động đã duyệt (chưa có chính sách duyệt thì duyệt ngay khi gửi).
async function approvedContract(employeeId: string) {
  const created = await hrStaff.call("post", "/hr/contracts", {
    companyId: retail,
    body: {
      employeeId,
      kind: "fixed_term",
      effectiveDate: "2026-12-01",
      endDate: "2027-11-30",
      jobTitle: "Nhân viên bán hàng",
      departmentId: ids.department,
      branchId: branch,
      salary: "12000000",
      allowances: [],
      signerName: "Trần Văn Lâm",
      signerTitle: "Giám đốc",
    },
  });
  expect(created.status, JSON.stringify(created.body)).toBe(201);
  const submitted = await hrStaff.call("post", `/hr/contracts/${created.body.id}/submit`, { companyId: retail });
  expect(submitted.body.status, JSON.stringify(submitted.body)).toBe("approved");
  return created.body.id as string;
}

const startHrSigning = (contractId: string, data: Record<string, unknown>) =>
  hrStaff
    .call("post", `/hr/contracts/${contractId}/digital-signing`, { companyId: retail })
    .field("data", JSON.stringify({ companySignerUserId: ids.director, dueOn: "2026-12-20", ...data }))
    .attach("file", pdf, "hop-dong-lao-dong.pdf");

beforeAll(async () => {
  directory = mkdtempSync(join(tmpdir(), "ky-so-gia-lap-"));
  process.env.SIGNING_SIMULATOR_DIRECTORY = directory;
  process.env.SIGNING_SIMULATOR_CONFIRM_MILLISECONDS = "0";
  ({ application, pool } = await startTestApplication());
  signing = application.get(OfficeSigningService);
  outbox = application.get(OutboxService);
  pdf = await renderPdf({ content: ["HỢP ĐỒNG LAO ĐỘNG"] });
  ids.department = (await pool.query<{ id: string }>("INSERT INTO core.departments (company_id, code, name) VALUES ($1, 'BH', 'Phòng Bán hàng') RETURNING id", [retail])).rows[0]!.id;
  await user("van.thu.ks@vcomm.test", "Mai Văn Thư", ["office_clerk"]);
  await user("soan.thao.ks@vcomm.test", "Trần Minh Soạn", ["employee"]);
  ids.signer = await user("nguoi.ky.ks@vcomm.test", "Phạm Văn Ký", ["employee"]);
  await user("nhan.su.ks@vcomm.test", "Lê Thị Nhân", ["employee", "hr_staff"]);
  ids.director = await user("giam.doc.ks@vcomm.test", "Trần Văn Lâm", ["employee"]);
  ids.worker = await user("nhan.vien.ks@vcomm.test", "Nguyễn Thị Hoa", ["employee"]);
  admin = await signIn(application, "quantri.vcr@vcomm.test");
  clerk = await signIn(application, "van.thu.ks@vcomm.test");
  drafter = await signIn(application, "soan.thao.ks@vcomm.test");
  signer = await signIn(application, "nguoi.ky.ks@vcomm.test");
  hrStaff = await signIn(application, "nhan.su.ks@vcomm.test");
  director = await signIn(application, "giam.doc.ks@vcomm.test");
  worker = await signIn(application, "nhan.vien.ks@vcomm.test");
  await admin.call("put", "/office/signing-settings", { companyId: retail, body: { provider: "simulator", environment: "test" } });
  const seal = await admin.call("post", "/office/signing-settings/seal-certificates", { companyId: retail, body: { identityCode: "0312345678" } });
  await admin.call("put", "/office/signing-settings/seal", { companyId: retail, body: { identityCode: "0312345678", serialNumber: seal.body[0].serialNumber } });
  await identity(signer, "079090001357");
  await identity(director, "079090002222");
  await identity(worker, "079096000444");
  const options = (await clerk.call("get", "/office/document-options", { companyId: retail })).body;
  ids.outgoingRegister = options.registers.find((item: { direction: string; isDefault: boolean }) => item.direction === "outgoing" && item.isDefault).id;
  ids.officialLetterType = options.documentTypes.find((item: { name: string }) => item.name === "Công văn").id;
});

afterAll(async () => {
  await application?.close();
  await pool?.end();
  rmSync(directory, { recursive: true, force: true });
});

describe("CONG_VIEC_59 lát L3: gắn ký số", () => {
  it("KICHBAN_KIEMTHU_609: công văn đi đã cấp số ký số (người ký, chữ ký công ty) rồi phát hành không cần bản quét", async () => {
    const created = await drafter.call("post", "/office/outgoing", {
      companyId: retail,
      body: {
        registerId: ids.outgoingRegister,
        documentTypeId: ids.officialLetterType,
        departmentId: ids.department,
        summary: "Thông báo lịch giao hàng Tết",
        urgency: "normal",
        composeMode: "compose",
        recipientLine: "Kính gửi: Các nhà cung cấp.",
        body: [{ kind: "paragraph", text: "Công ty thông báo lịch giao hàng dịp Tết Nguyên đán như sau." }],
        signerUserId: ids.signer,
        signerAuthority: "",
        signerTitle: "Giám đốc",
        externalRecipients: ["Như trên"],
        internalRecipients: [],
        copies: 2,
        drafterCode: "TS",
      },
    });
    expect(created.status, JSON.stringify(created.body)).toBe(201);
    const id = created.body.id as string;
    const submitted = await drafter.call("post", `/office/outgoing/${id}/submit`, { companyId: retail, body: { version: created.body.version } });
    const approved = await signer.call("post", `/office/outgoing/${id}/decide`, { companyId: retail, body: { decision: "approved", version: submitted.body.version } });
    // Chưa cấp số thì chưa ký số được.
    const early = await clerk.call("post", `/office/outgoing/${id}/digital-signing`, { companyId: retail }).field("data", JSON.stringify({ dueOn: "2026-12-20", version: approved.body.version }));
    expect(early.status).toBe(409);
    let detail = (await clerk.call("post", `/office/outgoing/${id}/number`, { companyId: retail, body: { version: approved.body.version } })).body;
    expect(detail.allowedActions).toEqual(expect.arrayContaining(["issue", "digital_sign"]));
    expect(detail.signing).toBeNull();
    // Người không phải văn thư không lập được.
    expect((await drafter.call("post", `/office/outgoing/${id}/digital-signing`, { companyId: retail }).field("data", JSON.stringify({ dueOn: "2026-12-20", version: detail.version }))).status).toBe(
      403,
    );
    const started = await clerk.call("post", `/office/outgoing/${id}/digital-signing`, { companyId: retail }).field("data", JSON.stringify({ dueOn: "2026-12-20", version: detail.version }));
    expect(started.status, JSON.stringify(started.body)).toBe(200);
    detail = started.body;
    expect(detail.signing).toMatchObject({ status: "signing", requestNo: expect.stringMatching(/^KS/) });
    expect(detail.allowedActions).not.toContain("issue");
    expect(detail.allowedActions).not.toContain("digital_sign");
    // Phiên đang ký: chưa phát hành được, kể cả bằng bản quét.
    const blocked = await clerk.call("post", `/office/outgoing/${id}/issue`, { companyId: retail }).field("version", String(detail.version)).attach("file", pdf, "ban-quet.pdf");
    expect(blocked.status).toBe(409);
    expect(blocked.body.error.message).toBe(message("officeOutgoingSigning"));
    const request = (await clerk.call("get", `/office/signing-requests/${detail.signing.id}`, { companyId: retail })).body;
    expect(request).toMatchObject({ sourceType: "outgoing", sourceId: id });
    expect(request.signers.map((item: { kind: string; signOrder: number }) => [item.kind, item.signOrder])).toEqual([
      ["user", 1],
      ["company", 2],
    ]);
    // Người ký của công văn ký, văn thư đóng chữ ký công ty.
    await signMyTurn(signer, detail.signing.id);
    await signMyTurn(clerk, detail.signing.id);
    detail = (await clerk.call("get", `/office/outgoing/${id}`, { companyId: retail })).body;
    expect(detail.signing.status).toBe("completed");
    expect(detail.allowedActions).toContain("issue");
    expect(detail.allowedActions).not.toContain("digital_sign");
    // Phát hành không cần tệp: bản ký số là bản phát hành.
    // LOI_10, LOI_11 (sửa trong CONG_VIEC_59): phát hành ghi tệp qua đúng quy tắc khóa của lưu trữ cục bộ (chỉ chữ thường, số, "/", "-").
    const storageDirectory = mkdtempSync(join(tmpdir(), "luu-tru-cuc-bo-"));
    const previousDirectory = process.env.STORAGE_DIRECTORY;
    process.env.STORAGE_DIRECTORY = storageDirectory;
    const local = new LocalFileStorage();
    const memoryPut = testStorage.put;
    testStorage.put = async function (key: string, content: Buffer) {
      await local.put(key, content);
      return memoryPut.call(this, key, content);
    };
    let issued;
    try {
      issued = await clerk.call("post", `/office/outgoing/${id}/issue`, { companyId: retail }).field("version", String(detail.version));
    } finally {
      testStorage.put = memoryPut;
      process.env.STORAGE_DIRECTORY = previousDirectory;
      rmSync(storageDirectory, { recursive: true, force: true });
    }
    expect(issued.status, JSON.stringify(issued.body)).toBe(200);
    expect(issued.body.status).toBe("issued");
    expect(issued.body.signedFiles).toHaveLength(1);
    const file = await clerk.call("get", `/office/outgoing/${id}/files/${issued.body.signedFiles[0].id}`, { companyId: retail }).buffer(true);
    expect(signatureCount(file.body as Buffer)).toBe(2);
  });

  it("KICHBAN_KIEMTHU_609: hợp đồng lao động ký số: người lao động có tài khoản ký trong hệ thống; xong thì Nhân sự chuyển đã ký với bản đã ký", async () => {
    const employeeId = await employee("Nguyễn Thị Hoa", "079096000444", { userId: ids.worker });
    const contractId = await approvedContract(employeeId);
    const info = (await hrStaff.call("get", `/hr/contracts/${contractId}/digital-signing`, { companyId: retail })).body;
    expect(info).toMatchObject({ employeeSignsAs: "user", employeeName: "Nguyễn Thị Hoa", canStart: true, signing: null });
    // Người không có quyền quản lý hợp đồng lao động không xem, không lập được.
    expect((await worker.call("get", `/hr/contracts/${contractId}/digital-signing`, { companyId: retail })).status).toBe(403);
    expect(
      (await hrStaff.call("post", `/hr/contracts/${contractId}/digital-signing`, { companyId: retail }).field("data", JSON.stringify({ companySignerUserId: ids.director, dueOn: "2026-12-20" })))
        .status,
    ).toBe(400);
    const started = await startHrSigning(contractId, {});
    expect(started.status, JSON.stringify(started.body)).toBe(201);
    expect(started.body).toMatchObject({ canStart: false, signing: { status: "signing" } });
    const requestId = started.body.signing.id as string;
    // Đang ký số thì không xác nhận ký thủ công, không lập phiên thứ hai.
    const manual = await hrStaff.call("post", `/hr/contracts/${contractId}/sign`, { companyId: retail }).field("signDate", "2026-11-12").attach("file", pdf, "ban-quet.pdf");
    expect(manual.body.error?.message).toBe(message("hrDigitalSigningActive"));
    expect((await startHrSigning(contractId, {})).body.error.message).toBe(message("hrDigitalSigningActive"));
    const request = (await hrStaff.call("get", `/office/signing-requests/${requestId}`, { companyId: retail })).body;
    expect(request).toMatchObject({ sourceType: "hr_contract", sourceId: contractId });
    expect(request.signers.map((item: { kind: string; user: { fullName: string } | null }) => [item.kind, item.user?.fullName])).toEqual([
      ["user", "Trần Văn Lâm"],
      ["user", "Nguyễn Thị Hoa"],
    ]);
    await signMyTurn(director, requestId);
    await signMyTurn(worker, requestId);
    await outbox.dispatchPending();
    const contract = (await hrStaff.call("get", `/hr/contracts/${contractId}`, { companyId: retail })).body;
    expect(contract).toMatchObject({ status: "signed", hasSignedFile: true, signDate: expect.any(String) });
    const audit = await pool.query("SELECT 1 FROM core.audit_events WHERE action = 'contract.digital_signed' AND entity_id = $1", [contractId]);
    expect(audit.rowCount).toBe(1);
  });

  it("KICHBAN_KIEMTHU_609: người lao động chưa có tài khoản ký số ký qua đường dẫn (thư điện tử, số định danh từ hồ sơ); hủy hợp đồng thì hủy phiên", async () => {
    const employeeId = await employee("Võ Thị Lan", "079096000555", { personalEmail: "lan.vo@canhan.test" });
    const contractId = await approvedContract(employeeId);
    const info = (await hrStaff.call("get", `/hr/contracts/${contractId}/digital-signing`, { companyId: retail })).body;
    expect(info).toMatchObject({ employeeSignsAs: "partner", employeeEmail: "lan.vo@canhan.test", identityLast4: "0555" });
    const started = await startHrSigning(contractId, {});
    expect(started.status, JSON.stringify(started.body)).toBe(201);
    const requestId = started.body.signing.id as string;
    const request = (await hrStaff.call("get", `/office/signing-requests/${requestId}`, { companyId: retail })).body;
    expect(request.signers[1]).toMatchObject({ kind: "partner", partner: { name: "Võ Thị Lan", email: "lan.vo@canhan.test", kind: "individual" } });
    await signMyTurn(director, requestId);
    const link = /\/office\/sign\/([A-Za-z0-9_-]+)/.exec([...sentMessages].reverse().find((item) => item.to === "lan.vo@canhan.test")!.body)![1]!;
    await signing.publicSign(link, { ip: null });
    await signing.pollAttempts();
    await outbox.dispatchPending();
    expect((await hrStaff.call("get", `/hr/contracts/${contractId}`, { companyId: retail })).body.status).toBe("signed");

    // Hợp đồng khác của người khác: hủy khi đang ký số thì phiên ký bị hủy theo.
    const otherEmployee = await employee("Đặng Văn Minh", "079096000666", { personalEmail: "minh.dang@canhan.test" });
    const other = await approvedContract(otherEmployee);
    const otherRequest = (await startHrSigning(other, {})).body.signing.id as string;
    const cancelled = await hrStaff.call("post", `/hr/contracts/${other}/cancel`, { companyId: retail, body: { reason: "Người lao động không nhận việc" } });
    expect(cancelled.body.status).toBe("cancelled");
    expect((await hrStaff.call("get", `/office/signing-requests/${otherRequest}`, { companyId: retail })).body).toMatchObject({ status: "cancelled" });
  });
});
