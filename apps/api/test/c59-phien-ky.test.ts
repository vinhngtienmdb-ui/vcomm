// CONG_VIEC_59 lát L1: cài đặt ký số, tài khoản ký số, phiên ký nhiều người, đối tác ký qua đường dẫn, kiểm tra chữ ký
// (TIEUCHI_NGHIEMTHU_422 đến 428; KICHBAN_KIEMTHU_597 đến 603).
import type { NestExpressApplication } from "@nestjs/platform-express";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { Pool } from "pg";
import supertest from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { renderPdf } from "../src/common/pdf";
import { testIds } from "../src/database/seed";
import { OfficeSigningService } from "../src/office/signing/office-signing.service";
import { verifyPdfSignatures } from "../src/office/signing/pdf-verification";
import { createTestUser, signIn, type Session } from "./helpers";
import { sentMessages, startTestApplication, testClock } from "./setup-database";

let application: NestExpressApplication;
let pool: Pool;
let signing: OfficeSigningService;
let directory: string;
let admin: Session;
let groupAdmin: Session;
let creator: Session;
let deputy: Session;
let director: Session;
let clerk: Session;
let outsider: Session;
let pdf: Buffer;
const ids: Record<string, string> = {};
const retail = testIds.retailCompany;

async function user(email: string, name: string, roleCodes: string[]): Promise<string> {
  const id = await createTestUser(pool, email, name, [{ companyId: retail }]);
  for (const code of roleCodes) {
    const role = (await pool.query<{ id: string }>("SELECT id FROM core.roles WHERE code = $1 AND company_id IS NULL LIMIT 1", [code])).rows[0]!.id;
    await pool.query("INSERT INTO core.user_role_assignments (user_id, role_id, scope_type, company_id, valid_from) VALUES ($1, $2, 'company', $3, '2026-01-01')", [id, role, retail]);
  }
  return id;
}

async function identity(session: Session, identityCode: string) {
  const options = await session.call("post", "/office/signing-identities/me/certificates", { companyId: retail, body: { identityCode } });
  expect(options.status).toBe(200);
  return session.call("put", "/office/signing-identities/me", { companyId: retail, body: { identityCode, serialNumber: options.body[0].serialNumber } });
}

const partner = (extra: Record<string, unknown> = {}) => ({
  kind: "partner",
  partnerKind: "organization",
  name: "Công ty TNHH Sữa Tươi Thành Hưng",
  email: "kinhdoanh@suathanhhung.test",
  identity: "0309876543",
  identityCode: "0309876543",
  signOrder: 4,
  page: "last",
  corner: "bottom_left",
  ...extra,
});

function createRequest(session: Session, data: Record<string, unknown>) {
  return session.call("post", "/office/signing-requests", { companyId: retail }).field("data", JSON.stringify(data)).attach("file", pdf, "hop-dong-mua-sua.pdf");
}

const lastLink = (email: string): string => {
  const message = [...sentMessages].reverse().find((item) => item.to === email);
  return /\/office\/sign\/([A-Za-z0-9_-]+)/.exec(message?.body ?? "")![1]!;
};

beforeAll(async () => {
  directory = mkdtempSync(join(tmpdir(), "ky-so-gia-lap-"));
  process.env.SIGNING_SIMULATOR_DIRECTORY = directory;
  process.env.SIGNING_SIMULATOR_CONFIRM_MILLISECONDS = "0";
  ({ application, pool } = await startTestApplication());
  signing = application.get(OfficeSigningService);
  pdf = await renderPdf({ content: ["HỢP ĐỒNG MUA BÁN HÀNG HÓA", { text: "Trang 2", pageBreak: "before" }] });
  ids.creator = await user("mua.hang.ky@vcomm.test", "Phạm Gia Huy", ["employee"]);
  ids.deputy = await user("pho.giam.doc@vcomm.test", "Trần Văn Lâm", ["employee"]);
  ids.director = await user("giam.doc.ky@vcomm.test", "Nguyễn Văn An", ["employee"]);
  ids.clerk = await user("van.thu.ky@vcomm.test", "Mai Anh", ["employee", "office_clerk"]);
  ids.outsider = await user("nguoi.ngoai.ky@vcomm.test", "Lê Văn Ngoài", ["employee"]);
  admin = await signIn(application, "quantri.vcr@vcomm.test");
  groupAdmin = await signIn(application, "quantri.tapdoan@vcomm.test");
  creator = await signIn(application, "mua.hang.ky@vcomm.test");
  deputy = await signIn(application, "pho.giam.doc@vcomm.test");
  director = await signIn(application, "giam.doc.ky@vcomm.test");
  clerk = await signIn(application, "van.thu.ky@vcomm.test");
  outsider = await signIn(application, "nguoi.ngoai.ky@vcomm.test");
});

afterAll(async () => {
  testClock.fixed = null;
  await application?.close();
  await pool?.end();
  rmSync(directory, { recursive: true, force: true });
});

describe("CONG_VIEC_59 lát L1: ký số", () => {
  it("KICHBAN_KIEMTHU_597: cài nhà cung cấp, chữ ký số công ty phải trùng mã số thuế; nhân viên không cài được", async () => {
    expect((await creator.call("put", "/office/signing-settings", { companyId: retail, body: { provider: "simulator", environment: "test" } })).status).toBe(403);
    expect((await admin.call("put", "/office/signing-settings", { companyId: retail, body: { provider: "simulator", environment: "production" } })).body.error.message).toContain("môi trường thử");
    const saved = await admin.call("put", "/office/signing-settings", { companyId: retail, body: { provider: "simulator", environment: "test", credentials: { appId: "bi-mat" } } });
    expect(saved.status).toBe(200);
    expect(saved.body).toMatchObject({ configured: true, provider: "simulator", hasCredentials: true, seal: null, companyTaxCode: "0312345678" });
    expect(JSON.stringify(saved.body)).not.toContain("bi-mat");
    const wrong = await admin.call("post", "/office/signing-settings/seal-certificates", { companyId: retail, body: { identityCode: "0109876543" } });
    const mismatch = await admin.call("put", "/office/signing-settings/seal", { companyId: retail, body: { identityCode: "0109876543", serialNumber: wrong.body[0].serialNumber } });
    expect(mismatch.body.error.message).toContain("mã số thuế");
    const right = await admin.call("post", "/office/signing-settings/seal-certificates", { companyId: retail, body: { identityCode: "0312345678" } });
    const seal = await admin.call("put", "/office/signing-settings/seal", { companyId: retail, body: { identityCode: "0312345678", serialNumber: right.body[0].serialNumber } });
    expect(seal.body.seal).toMatchObject({ identityCode: "0312345678" });
  });

  it("KICHBAN_KIEMTHU_598: khai tài khoản ký số; chứng thư hết hạn không chọn được", async () => {
    const expired = await deputy.call("post", "/office/signing-identities/me/certificates", { companyId: retail, body: { identityCode: "079090000111" } });
    expect(expired.body[0].usable).toBe(false);
    expect((await deputy.call("put", "/office/signing-identities/me", { companyId: retail, body: { identityCode: "079090000111", serialNumber: expired.body[0].serialNumber } })).status).toBe(409);
    const chosen = await identity(deputy, "079090005678");
    expect(chosen.body.identity).toMatchObject({ identityCode: "079090005678", usable: true });
    expect((await deputy.call("get", "/office/signing-identities/me", { companyId: retail })).body.identity.identities).toEqual(["CCCD:079090005678"]);
  });

  it("KICHBAN_KIEMTHU_600: phiên ký bốn người theo thứ tự (người dùng, người dùng, chữ ký công ty, đối tác) đến khi đã ký xong", async () => {
    const created = await createRequest(creator, {
      title: "Hợp đồng mua sữa tươi 2027",
      note: "Kính trình ký",
      dueOn: "2026-12-31",
      signers: [
        { kind: "user", userId: ids.deputy, signOrder: 1, page: "last", corner: "bottom_left" },
        { kind: "user", userId: ids.director, signOrder: 2, page: "last", corner: "bottom_right" },
        { kind: "company", signOrder: 3, page: "last", corner: "bottom_right" },
        partner(),
      ],
    });
    expect(created.status).toBe(201);
    ids.request = created.body.id;
    expect(created.body).toMatchObject({ status: "draft", allowed: expect.arrayContaining(["edit", "send", "cancel"]) });
    expect(created.body.requestNo).toMatch(/^KS/);
    // Giám đốc chưa khai tài khoản ký số: chưa gửi được.
    const blocked = await creator.call("post", `/office/signing-requests/${ids.request}/send`, { companyId: retail, body: { version: created.body.version } });
    expect(blocked.body.error.message).toContain("chưa khai tài khoản ký số");
    await identity(director, "079090001234");
    const sent = await creator.call("post", `/office/signing-requests/${ids.request}/send`, { companyId: retail, body: { version: created.body.version } });
    expect(sent.body.status).toBe("signing");
    expect(sent.body.signers.map((signer: { status: string }) => signer.status)).toEqual(["current", "waiting", "waiting", "waiting"]);
    // Người không liên quan không xem được; người ký sau chưa ký được.
    expect((await outsider.call("get", `/office/signing-requests/${ids.request}`, { companyId: retail })).status).toBe(404);
    const early = await director.call("get", `/office/signing-requests/${ids.request}`, { companyId: retail });
    expect(early.body.mySignerId).toBeNull();
    expect((await deputy.call("get", "/office/signing-requests?tab=to_sign", { companyId: retail })).body.items.map((item: { id: string }) => item.id)).toContain(ids.request);

    // Người ký 1.
    let detail = (await deputy.call("get", `/office/signing-requests/${ids.request}`, { companyId: retail })).body;
    detail = (await deputy.call("post", `/office/signing-requests/${ids.request}/sign`, { companyId: retail, body: { signerId: detail.mySignerId, version: detail.version } })).body;
    expect(detail.signers[0].lastAttempt.status).toBe("pending");
    // Đang có lần ký chờ: lần ký khác của cùng phiên bị chặn.
    expect(await signing.pollAttempts()).toBe(1);
    detail = (await director.call("get", `/office/signing-requests/${ids.request}`, { companyId: retail })).body;
    expect(detail.signers.map((signer: { status: string }) => signer.status)).toEqual(["signed", "current", "waiting", "waiting"]);
    expect(detail.currentFile.signatureCount).toBe(1);
    // Người ký 2.
    detail = (await director.call("post", `/office/signing-requests/${ids.request}/sign`, { companyId: retail, body: { signerId: detail.mySignerId, version: detail.version } })).body;
    await signing.pollAttempts();
    // Bước chữ ký công ty: văn thư có quyền đóng thấy ở thẻ Chờ tôi ký.
    const clerkList = (await clerk.call("get", "/office/signing-requests?tab=to_sign", { companyId: retail })).body.items;
    expect(clerkList.find((item: { id: string }) => item.id === ids.request)).toMatchObject({ companySealTurn: true });
    detail = (await clerk.call("get", `/office/signing-requests/${ids.request}`, { companyId: retail })).body;
    expect(detail.allowed).toContain("sign");
    detail = (await clerk.call("post", `/office/signing-requests/${ids.request}/sign`, { companyId: retail, body: { signerId: detail.mySignerId, version: detail.version } })).body;
    await signing.pollAttempts();
    detail = (await creator.call("get", `/office/signing-requests/${ids.request}`, { companyId: retail })).body;
    expect(detail.signers[2]).toMatchObject({ status: "signed", signedBy: { fullName: "Mai Anh" } });
    expect(detail.signers[3].status).toBe("current");
    expect(detail.allowed).toEqual(expect.arrayContaining(["remind", "resend", "cancel"]));

    // Đối tác: thư có đường dẫn; trang ký không đăng nhập.
    const token = lastLink("kinhdoanh@suathanhhung.test");
    const view = await supertest(application.getHttpServer()).get(`/api/v1/public/signing/${token}`);
    expect(view.status).toBe(200);
    expect(view.body).toMatchObject({ companyName: "VComm Bán lẻ Miền Nam", title: "Hợp đồng mua sữa tươi 2027", state: "ready", partnerIdentity: "0309876543" });
    const file = await supertest(application.getHttpServer()).get(`/api/v1/public/signing/${token}/file`);
    expect(file.headers["content-type"]).toContain("application/pdf");
    const started = await supertest(application.getHttpServer()).post(`/api/v1/public/signing/${token}/sign`);
    expect(started.body.state).toBe("awaiting_confirmation");
    await signing.pollAttempts();
    const done = await supertest(application.getHttpServer()).get(`/api/v1/public/signing/${token}`);
    expect(done.body.state).toBe("signed");
    // Đường dẫn đã dùng không ký lại được.
    expect((await supertest(application.getHttpServer()).post(`/api/v1/public/signing/${token}/sign`)).status).toBe(404);

    detail = (await creator.call("get", `/office/signing-requests/${ids.request}`, { companyId: retail })).body;
    expect(detail.status).toBe("completed");
    expect(detail.events.map((event: { kind: string }) => event.kind)).toContain("completed");
    const signedFile = await creator.call("get", `/office/signing-requests/${ids.request}/file`, { companyId: retail }).buffer(true);
    const root = signing.simulator().authority().certificatePem;
    const checks = verifyPdfSignatures(signedFile.body as Buffer, [root]);
    expect(checks.map((check) => check.conclusion)).toEqual(["valid", "valid", "valid", "valid"]);
    expect(checks.map((check) => check.signer?.commonName)).toEqual(["NGƯỜI KÝ GIẢ LẬP 079090005678", "NGƯỜI KÝ GIẢ LẬP 079090001234", "TỔ CHỨC GIẢ LẬP 0312345678", "TỔ CHỨC GIẢ LẬP 0309876543"]);
    const completedEvents = await pool.query("SELECT 1 FROM core.outbox_events WHERE event_type = 'office.signing.completed' AND aggregate_id = $1", [ids.request]);
    expect(completedEvents.rows.length).toBe(1);
  });

  it("KICHBAN_KIEMTHU_603: kiểm tra chữ ký: chưa tin cậy khi chưa thêm gốc, hợp lệ khi đã thêm gốc tin cậy (phạm vi tập đoàn); tệp sửa thì không hợp lệ", async () => {
    const signedFile = (await creator.call("get", `/office/signing-requests/${ids.request}/file`, { companyId: retail }).buffer(true)).body as Buffer;
    const before = await creator.call("post", "/office/signature-verifications", { companyId: retail }).attach("file", signedFile, "da-ky.pdf");
    expect(before.body.signatures.map((item: { conclusion: string }) => item.conclusion)).toEqual(["untrusted", "untrusted", "untrusted", "untrusted"]);
    expect(before.body.revocationChecked).toBe(false);
    const rootPem = Buffer.from(signing.simulator().authority().certificatePem);
    expect((await admin.call("post", "/office/trusted-roots", { companyId: retail }).attach("file", rootPem, "goc.pem")).status).toBe(403);
    const added = await groupAdmin.call("post", "/office/trusted-roots", { companyId: retail }).attach("file", rootPem, "goc.pem");
    expect(added.status).toBe(201);
    const after = await creator.call("post", "/office/signature-verifications", { companyId: retail }).attach("file", signedFile, "da-ky.pdf");
    expect(after.body.signatures.every((item: { conclusion: string }) => item.conclusion === "valid")).toBe(true);
    expect(after.body.signatures.map((item: { coversWholeFile: boolean }) => item.coversWholeFile)).toEqual([false, false, false, true]);
    const tampered = Buffer.from(signedFile);
    tampered[300] = tampered[300]! ^ 1;
    const broken = await creator.call("post", "/office/signature-verifications", { companyId: retail }).attach("file", tampered, "sua.pdf");
    expect(broken.body.signatures[0].conclusion).toBe("invalid");
    expect((await creator.call("post", "/office/signature-verifications", { companyId: retail }).attach("file", Buffer.from("khong phai pdf"), "a.pdf")).status).toBe(400);
  });

  it("KICHBAN_KIEMTHU_602: đối tác ký bằng chứng thư không trùng mã số thuế đã khai thì bị loại; gửi lại thư làm đường dẫn cũ hết dùng", async () => {
    const created = await createRequest(creator, { title: "Phụ lục giá", dueOn: "2026-12-31", signers: [partner({ signOrder: 1, identityCode: "0301112223" })] });
    const sent = await creator.call("post", `/office/signing-requests/${created.body.id}/send`, { companyId: retail, body: { version: created.body.version } });
    const firstToken = lastLink("kinhdoanh@suathanhhung.test");
    await supertest(application.getHttpServer()).post(`/api/v1/public/signing/${firstToken}/sign`);
    await signing.pollAttempts();
    const view = await supertest(application.getHttpServer()).get(`/api/v1/public/signing/${firstToken}`);
    expect(view.body).toMatchObject({ state: "ready", lastFailure: "Chứng thư không trùng thông tin bên ký đã khai." });
    const resent = await creator.call("post", `/office/signing-requests/${created.body.id}/resend`, { companyId: retail, body: { signerId: sent.body.signers[0].id, version: sent.body.version } });
    expect(resent.status).toBe(200);
    expect((await supertest(application.getHttpServer()).get(`/api/v1/public/signing/${firstToken}`)).status).toBe(404);
    const secondToken = lastLink("kinhdoanh@suathanhhung.test");
    expect(secondToken).not.toBe(firstToken);
    // Đối tác từ chối: phiên bị từ chối, người lập sao chép thành phiên mới.
    expect((await supertest(application.getHttpServer()).post(`/api/v1/public/signing/${secondToken}/reject`).send({ reason: "Sai đơn giá" })).status).toBe(204);
    const rejected = (await creator.call("get", `/office/signing-requests/${created.body.id}`, { companyId: retail })).body;
    expect(rejected).toMatchObject({ status: "rejected", endReason: "Sai đơn giá", allowed: ["copy"] });
    expect((await supertest(application.getHttpServer()).get(`/api/v1/public/signing/${secondToken}`)).body.state).toBe("rejected");
    const copied = await creator.call("post", `/office/signing-requests/${created.body.id}/copy`, { companyId: retail });
    expect(copied.body).toMatchObject({ status: "draft", copiedFromId: created.body.id, title: "Phụ lục giá" });
  });

  it("KICHBAN_KIEMTHU_601: từ chối, nhắc một lần mỗi ngày, hủy, hết hạn; người ký từ chối trên ứng dụng thì ký lại được", async () => {
    await identity(outsider, "079090000000");
    const created = await createRequest(creator, {
      title: "Biên bản bàn giao",
      dueOn: "2026-12-20",
      signers: [
        { kind: "user", userId: ids.outsider, signOrder: 1, page: "first", corner: "top_right" },
        { kind: "user", userId: ids.deputy, signOrder: 1, page: "first", corner: "top_left" },
      ],
    });
    let detail = (await creator.call("post", `/office/signing-requests/${created.body.id}/send`, { companyId: retail, body: { version: created.body.version } })).body;
    expect(detail.signers.map((signer: { status: string }) => signer.status)).toEqual(["current", "current"]);
    detail = (await creator.call("post", `/office/signing-requests/${created.body.id}/remind`, { companyId: retail, body: { version: detail.version } })).body;
    expect((await creator.call("post", `/office/signing-requests/${created.body.id}/remind`, { companyId: retail, body: { version: detail.version } })).body.error.message).toContain("một lần");
    // Mã định danh tận cùng 000: người ký từ chối trên ứng dụng.
    let mine = (await outsider.call("get", `/office/signing-requests/${created.body.id}`, { companyId: retail })).body;
    await outsider.call("post", `/office/signing-requests/${created.body.id}/sign`, { companyId: retail, body: { signerId: mine.mySignerId, version: mine.version } });
    await signing.pollAttempts();
    mine = (await outsider.call("get", `/office/signing-requests/${created.body.id}`, { companyId: retail })).body;
    expect(mine.signers[0]).toMatchObject({ status: "current", lastAttempt: { status: "rejected" } });
    expect(mine.allowed).toContain("sign");
    const rejected = await outsider.call("post", `/office/signing-requests/${created.body.id}/reject`, { companyId: retail, body: { reason: "Không đúng nội dung", version: mine.version } });
    expect(rejected.body).toMatchObject({ status: "rejected", endReason: "Không đúng nội dung" });

    const second = await createRequest(creator, { title: "Hủy thử", dueOn: "2026-12-20", signers: [{ kind: "user", userId: ids.deputy, signOrder: 1, page: "last", corner: "bottom_right" }] });
    const cancelled = await creator.call("post", `/office/signing-requests/${second.body.id}/cancel`, { companyId: retail, body: { reason: "Lập nhầm", version: second.body.version } });
    expect(cancelled.body.status).toBe("cancelled");

    const third = await createRequest(creator, { title: "Hết hạn thử", dueOn: "2026-12-20", signers: [{ kind: "user", userId: ids.deputy, signOrder: 1, page: "last", corner: "bottom_right" }] });
    await creator.call("post", `/office/signing-requests/${third.body.id}/send`, { companyId: retail, body: { version: third.body.version } });
    testClock.fixed = new Date("2026-12-18T02:00:00Z");
    expect((await signing.expireAndRemind()).reminded).toBeGreaterThanOrEqual(1);
    testClock.fixed = new Date("2026-12-21T02:00:00Z");
    expect((await signing.expireAndRemind()).expired).toBeGreaterThanOrEqual(1);
    testClock.fixed = null;
    expect((await creator.call("get", `/office/signing-requests/${third.body.id}`, { companyId: retail })).body.status).toBe("expired");
  });

  it("rà soát độc lập: chữ ký cũ chưa kiểm được không làm kẹt phiên; PDF đặt mật khẩu bị chặn khi lập; tài khoản cá nhân không nhận chứng thư tổ chức", async () => {
    // Bản đã ký ở KICHBAN_KIEMTHU_600, đổi thuật toán băm khai trong chữ ký sang SHA-224 (chưa hỗ trợ kiểm tra): chữ ký cũ "chưa kiểm được".
    const signedFile = (await creator.call("get", `/office/signing-requests/${ids.request}/file`, { companyId: retail }).buffer(true)).body as Buffer;
    const latin = signedFile.toString("latin1").replace(/0609608648016503040201/gi, "0609608648016503040204");
    const oldSignatures = Buffer.from(latin, "latin1");
    expect(verifyPdfSignatures(oldSignatures, []).map((check) => check.conclusion)).toEqual(["unsupported", "unsupported", "unsupported", "unsupported"]);
    const created = await creator
      .call("post", "/office/signing-requests", { companyId: retail })
      .field("data", JSON.stringify({ title: "Ký bổ sung tệp đã có chữ ký", dueOn: "2026-12-31", signers: [{ kind: "user", userId: ids.deputy, signOrder: 1, page: "first", corner: "top_left" }] }))
      .attach("file", oldSignatures, "da-co-chu-ky.pdf");
    expect(created.status, JSON.stringify(created.body)).toBe(201);
    const sent = await creator.call("post", `/office/signing-requests/${created.body.id}/send`, { companyId: retail, body: { version: created.body.version } });
    const detail = (await deputy.call("get", `/office/signing-requests/${created.body.id}`, { companyId: retail })).body;
    await deputy.call("post", `/office/signing-requests/${created.body.id}/sign`, { companyId: retail, body: { signerId: detail.mySignerId, version: detail.version } });
    expect(sent.body.status).toBe("signing");
    await signing.pollAttempts();
    const done = (await creator.call("get", `/office/signing-requests/${created.body.id}`, { companyId: retail })).body;
    expect(done.status, JSON.stringify(done.signers[0].lastAttempt)).toBe("completed");

    // Tệp khai mã hóa (trailer có /Encrypt): báo lỗi ngay khi lập phiên.
    const encrypted = Buffer.from(pdf.toString("latin1").replace(/trailer\s*<</, "trailer\n<<\n/Encrypt 1 0 R"), "latin1");
    const blocked = await creator
      .call("post", "/office/signing-requests", { companyId: retail })
      .field("data", JSON.stringify({ title: "Tệp có mật khẩu", dueOn: "2026-12-31", signers: [{ kind: "company", signOrder: 1, page: "last", corner: "bottom_right" }] }))
      .attach("file", encrypted, "mat-khau.pdf");
    expect(blocked.status).toBe(400);
    expect(blocked.body.error.fields.file).toBe("Tệp PDF đặt mật khẩu, không ký được.");

    // Nhân viên khai mã số thuế công ty làm tài khoản cá nhân: bị từ chối (chỉ dùng qua bước chữ ký công ty).
    const options = await outsider.call("post", "/office/signing-identities/me/certificates", { companyId: retail, body: { identityCode: "0312345678" } });
    const organization = await outsider.call("put", "/office/signing-identities/me", { companyId: retail, body: { identityCode: "0312345678", serialNumber: options.body[0].serialNumber } });
    expect(organization.status).toBe(409);
    expect(organization.body.error.message).toContain("chứng thư cá nhân");
  });

  it("người ký ở công ty khác trong tập đoàn ký được bằng tài khoản ký số cùng nhà cung cấp; người ngoài không xem được; gửi lại thư tối đa 5 lần một ngày", async () => {
    const trading = testIds.tradingCompany;
    const tradingSignerId = await createTestUser(pool, "giam.doc.vct.ky@vcomm.test", "Đỗ Văn Thương", [{ companyId: trading }]);
    const employeeRole = (await pool.query<{ id: string }>("SELECT id FROM core.roles WHERE code = 'employee' AND company_id IS NULL")).rows[0]!.id;
    await pool.query("INSERT INTO core.user_role_assignments (user_id, role_id, scope_type, company_id, valid_from) VALUES ($1, $2, 'company', $3, '2026-01-01')", [
      tradingSignerId,
      employeeRole,
      trading,
    ]);
    const tradingSigner = await signIn(application, "giam.doc.vct.ky@vcomm.test");
    // Công ty VCT cùng dùng bộ giả lập; người ký khai tài khoản ký số ở công ty mình.
    await groupAdmin.call("put", "/office/signing-settings", { companyId: trading, body: { provider: "simulator", environment: "test" } });
    const options = await tradingSigner.call("post", "/office/signing-identities/me/certificates", { companyId: trading, body: { identityCode: "079090004321" } });
    await tradingSigner.call("put", "/office/signing-identities/me", { companyId: trading, body: { identityCode: "079090004321", serialNumber: options.body[0].serialNumber } });
    const created = await createRequest(creator, {
      title: "Biên bản đối chiếu công nợ nội bộ",
      dueOn: "2026-12-31",
      signers: [{ kind: "user", userId: tradingSignerId, signOrder: 1, page: "last", corner: "bottom_right" }, partner({ signOrder: 2 })],
    });
    expect(created.status, JSON.stringify(created.body)).toBe(201);
    const sent = await creator.call("post", `/office/signing-requests/${created.body.id}/send`, { companyId: retail, body: { version: created.body.version } });
    expect(sent.body.status, JSON.stringify(sent.body)).toBe("signing");
    // Thông báo gắn với công ty người ký là thành viên để mở được.
    const notice = await pool.query<{ company_id: string }>("SELECT company_id FROM core.notifications WHERE user_id = $1 AND kind = 'office_signing' ORDER BY created_at DESC LIMIT 1", [
      tradingSignerId,
    ]);
    expect(notice.rows[0]?.company_id).toBe(trading);
    const toSign = await tradingSigner.call("get", "/office/signing-requests?tab=to_sign", { companyId: trading });
    expect(toSign.body.items.map((item: { id: string }) => item.id)).toContain(created.body.id);
    const detail = (await tradingSigner.call("get", `/office/signing-requests/${created.body.id}`, { companyId: trading })).body;
    expect(detail).toMatchObject({ companyName: expect.any(String), mySignerId: expect.any(String) });
    // Người khác ở VCT (không phải người ký) không thấy phiên.
    const tradingOther = await createTestUser(pool, "nhan.vien.vct.ky@vcomm.test", "Hồ Văn Khác", [{ companyId: trading }]);
    await pool.query("INSERT INTO core.user_role_assignments (user_id, role_id, scope_type, company_id, valid_from) VALUES ($1, $2, 'company', $3, '2026-01-01')", [
      tradingOther,
      employeeRole,
      trading,
    ]);
    const other = await signIn(application, "nhan.vien.vct.ky@vcomm.test");
    expect((await other.call("get", `/office/signing-requests/${created.body.id}`, { companyId: trading })).status).toBe(404);
    const signedNow = await tradingSigner.call("post", `/office/signing-requests/${created.body.id}/sign`, { companyId: trading, body: { signerId: detail.mySignerId, version: detail.version } });
    expect(signedNow.status, JSON.stringify(signedNow.body)).toBe(200);
    await signing.pollAttempts();
    let request = (await creator.call("get", `/office/signing-requests/${created.body.id}`, { companyId: retail })).body;
    expect(request.signers.map((signer: { status: string }) => signer.status)).toEqual(["signed", "current"]);
    // Gửi lại thư cho đối tác: 5 lần trong 24 giờ, lần thứ 6 bị chặn.
    const partnerId = request.signers[1].id;
    for (let count = 0; count < 5; count += 1) {
      request = (await creator.call("post", `/office/signing-requests/${created.body.id}/resend`, { companyId: retail, body: { signerId: partnerId, version: request.version } })).body;
      expect(request.status).toBe("signing");
    }
    const limited = await creator.call("post", `/office/signing-requests/${created.body.id}/resend`, { companyId: retail, body: { signerId: partnerId, version: request.version } });
    expect(limited.status).toBe(409);
    expect(limited.body.error.message).toContain("5 lần");
  });

  it("lập phiên kiểm tra dữ liệu: tệp không phải PDF, hạn quá 60 ngày, người ký trùng", async () => {
    const notPdf = await creator
      .call("post", "/office/signing-requests", { companyId: retail })
      .field("data", JSON.stringify({ title: "x", dueOn: "2026-12-31", signers: [{ kind: "company", signOrder: 1, page: "last", corner: "bottom_right" }] }))
      .attach("file", Buffer.from("abc"), "a.pdf");
    expect(notPdf.status).toBe(400);
    const tooLate = await createRequest(creator, { title: "x", dueOn: "2027-06-30", signers: [{ kind: "company", signOrder: 1, page: "last", corner: "bottom_right" }] });
    expect(tooLate.body.error.fields.dueOn).toContain("60 ngày");
    const duplicate = await createRequest(creator, {
      title: "x",
      dueOn: "2026-12-31",
      signers: [
        { kind: "user", userId: ids.deputy, signOrder: 1, page: "last", corner: "bottom_right" },
        { kind: "user", userId: ids.deputy, signOrder: 2, page: "last", corner: "bottom_right" },
      ],
    });
    expect(duplicate.status).toBe(400);
  });
});
