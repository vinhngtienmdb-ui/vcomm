// CONG_VIEC_52 lát L2: công văn đến, đi theo Nghị định 30 (TIEUCHI_NGHIEMTHU_344 đến 346; KICHBAN_KIEMTHU_503 đến 505, phần công văn của 507).
import type { NestExpressApplication } from "@nestjs/platform-express";
import type { Pool } from "pg";
import { execFileSync } from "node:child_process";
import { existsSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { readSheet } from "read-excel-file/node";
import type { Response as SupertestResponse } from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { OutboxService } from "../src/common/outbox.service";
import { testIds } from "../src/database/seed";
import { createTestUser, signIn, type Session } from "./helpers";
import { startTestApplication } from "./setup-database";

let application: NestExpressApplication;
let pool: Pool;
let admin: Session;
let clerk: Session;
let leader: Session;
let handler: Session;
let drafter: Session;
let signer: Session;
let outsider: Session;
let tradingClerk: Session;
const ids: Record<string, string> = {};
const retail = testIds.retailCompany;
const trading = testIds.tradingCompany;
const pdf = Buffer.from("%PDF-1.4\n%âãÏÓ\n1 0 obj<<>>endobj\n");
// Đọc phản hồi nhị phân (Word, Excel) thành Buffer.
// Supertest không gom thân docx, xlsx: tự gom thành Buffer.
const binary = (response: SupertestResponse, callback: (error: Error | null, body: Buffer) => void) => {
  const chunks: Buffer[] = [];
  const stream = response as unknown as NodeJS.ReadableStream;
  stream.on("data", (chunk: Buffer) => chunks.push(chunk));
  stream.on("end", () => callback(null, Buffer.concat(chunks)));
};
const year = Number(new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Ho_Chi_Minh", year: "numeric" }).format(new Date()));
const today = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Ho_Chi_Minh", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());

async function user(email: string, name: string, companyId: string, roleCodes: string[], departmentId?: string): Promise<string> {
  const id = await createTestUser(pool, email, name, [{ companyId }]);
  for (const code of roleCodes) {
    const role = (await pool.query<{ id: string }>("SELECT id FROM core.roles WHERE code = $1 AND (company_id IS NULL OR company_id = $2) ORDER BY company_id NULLS LAST LIMIT 1", [code, companyId]))
      .rows[0]!.id;
    await pool.query("INSERT INTO core.user_role_assignments (user_id, role_id, scope_type, company_id, valid_from) VALUES ($1, $2, 'company', $3, '2026-01-01')", [id, role, companyId]);
  }
  if (departmentId) await pool.query("UPDATE core.user_company_memberships SET department_id = $1 WHERE user_id = $2", [departmentId, id]);
  return id;
}

const registerIncoming = (session: Session, data: Record<string, unknown>, files = [pdf]) => {
  const call = session.call("post", "/office/incoming", { companyId: retail }).field("data", JSON.stringify(data));
  for (const [index, file] of files.entries()) call.attach("files", file, `cong-van-${index}.pdf`);
  return call;
};
const incomingData = (summary: string, extra: Record<string, unknown> = {}) => ({
  registerId: ids.incomingRegister,
  receivedOn: today,
  sender: "Cục Thuế Thành phố Hồ Chí Minh",
  symbol: "125/TCT-KK",
  documentDate: "2026-11-06",
  documentTypeName: "Công văn",
  summary,
  urgency: "urgent",
  channel: "paper",
  ...extra,
});
const outgoingBody = (extra: Record<string, unknown> = {}) => ({
  registerId: ids.outgoingRegister,
  documentTypeId: ids.officialLetterType,
  departmentId: ids.department,
  summary: "Giải trình hóa đơn điện tử quý 3",
  urgency: "urgent",
  composeMode: "compose",
  recipientLine: "Kính gửi: Cục Thuế Thành phố Hồ Chí Minh.",
  body: [
    { kind: "paragraph", text: "Căn cứ Công văn số 125/TCT-KK ngày 06/11/2026 của Cục Thuế, Công ty giải trình như sau:" },
    { kind: "bullet", text: "Hóa đơn đã lập đúng thời điểm." },
  ],
  signerUserId: ids.signer,
  signerAuthority: "",
  signerTitle: "Giám đốc",
  externalRecipients: ["Như trên", "Ban Giám đốc"],
  internalRecipients: [{ kind: "department", id: ids.department }],
  copies: 3,
  drafterCode: "BN",
  ...extra,
});

beforeAll(async () => {
  ({ application, pool } = await startTestApplication());
  ids.department = (await pool.query<{ id: string }>("INSERT INTO core.departments (company_id, code, name) VALUES ($1, 'KT', 'Phòng Kế toán') RETURNING id", [retail])).rows[0]!.id;
  ids.leaderRole = (await pool.query<{ id: string }>("INSERT INTO core.roles (company_id, code, name_vi, name_en) VALUES ($1, 'lanh_dao', 'Lãnh đạo', 'Leader') RETURNING id", [retail])).rows[0]!.id;
  await pool.query("INSERT INTO core.role_permissions (role_id, permission_code) VALUES ($1, 'office.access'), ($1, 'office.document.direct')", [ids.leaderRole]);
  ids.clerk = await user("van.thu@vcomm.test", "Mai Anh", retail, ["office_clerk"]);
  ids.leader = await user("lanh.dao@vcomm.test", "Nguyễn Văn An", retail, ["employee", "lanh_dao"]);
  ids.handler = await user("xu.ly@vcomm.test", "Lê Thị Bích Ngọc", retail, ["employee"], ids.department);
  ids.drafter = await user("soan.thao@vcomm.test", "Trần Minh Khoa", retail, ["employee"], ids.department);
  ids.signer = await user("nguoi.ky@vcomm.test", "Phạm Văn Ký", retail, ["employee"]);
  ids.outsider = await user("khong.xem@vcomm.test", "Vũ Không Xem", retail, ["employee"]);
  ids.tradingClerk = await user("van.thu.vct@vcomm.test", "Đỗ Văn Thư", trading, ["office_clerk"]);
  admin = await signIn(application, "quantri.vcr@vcomm.test");
  clerk = await signIn(application, "van.thu@vcomm.test");
  leader = await signIn(application, "lanh.dao@vcomm.test");
  handler = await signIn(application, "xu.ly@vcomm.test");
  drafter = await signIn(application, "soan.thao@vcomm.test");
  signer = await signIn(application, "nguoi.ky@vcomm.test");
  outsider = await signIn(application, "khong.xem@vcomm.test");
  tradingClerk = await signIn(application, "van.thu.vct@vcomm.test");
  const options = (await clerk.call("get", "/office/document-options", { companyId: retail })).body;
  ids.incomingRegister = options.registers.find((item: { direction: string; isDefault: boolean }) => item.direction === "incoming" && item.isDefault).id;
  ids.outgoingRegister = options.registers.find((item: { direction: string; isDefault: boolean }) => item.direction === "outgoing" && item.isDefault).id;
  ids.officialLetterType = options.documentTypes.find((item: { name: string }) => item.name === "Công văn").id;
  ids.decisionType = options.documentTypes.find((item: { name: string }) => item.name === "Quyết định").id;
});

afterAll(async () => {
  await application?.close();
  await pool?.end();
});

describe("KICHBAN_KIEMTHU_503: công văn đến", () => {
  it("dữ liệu mặc định: sổ đến, sổ đi, 29 loại văn bản, thông tin thể thức", async () => {
    const options = (await clerk.call("get", "/office/document-options", { companyId: retail })).body;
    expect(options.documentTypes).toHaveLength(29);
    expect(options.documentTypes.find((item: { name: string }) => item.name === "Quyết định")).toMatchObject({ abbreviation: "QĐ", isOfficialLetter: false });
    expect(options.settings).toMatchObject({ companyAbbreviation: "VCR", placeName: "Thành phố Hồ Chí Minh", fontScheme: 13, marginLeft: 30 });
    expect(options.leaders.map((item: { id: string }) => item.id)).toContain(ids.leader);
    expect((await outsider.call("get", "/office/document-settings", { companyId: retail })).status).toBe(403);
  });

  it("vào sổ: số đến theo sổ, theo năm, bắt đầu từ 1, không trùng khi đồng thời; cần bản quét", async () => {
    expect((await registerIncoming(clerk, incomingData("Thiếu tệp"), [])).status).toBe(400);
    expect((await registerIncoming(outsider, incomingData("Không phải văn thư"))).status).toBe(403);
    const first = await registerIncoming(clerk, incomingData("V/v rà soát hóa đơn điện tử quý 3"));
    expect(first.status).toBe(201);
    expect(first.body).toMatchObject({ incomingNo: 1, year, status: "registered", files: [{ fileName: "cong-van-0.pdf" }] });
    ids.incoming = first.body.id;
    const concurrent = await Promise.all([1, 2, 3, 4].map((index) => registerIncoming(clerk, incomingData(`Đồng thời ${index}`, { symbol: `${index}/ABC` }))));
    expect(concurrent.map((item) => item.body.incomingNo).sort()).toEqual([2, 3, 4, 5]);
    const duplicate = await registerIncoming(clerk, incomingData("Trùng ký hiệu"));
    expect(duplicate.body.duplicateOf).toEqual([{ id: ids.incoming, incomingNo: 1 }]);
    const voided = await clerk.call("post", `/office/incoming/${duplicate.body.id}/void`, { companyId: retail, body: { reason: "Vào trùng", version: duplicate.body.version } });
    expect(voided.body).toMatchObject({ status: "voided", incomingNo: 6 });
    const next = await registerIncoming(clerk, incomingData("Sau hủy", { symbol: "7/XYZ" }));
    expect(next.body.incomingNo).toBe(7);
    const otherRegister = (await clerk.call("post", "/office/registers", { companyId: retail, body: { name: "Sổ đơn thư", direction: "incoming" } })).body.find(
      (item: { name: string }) => item.name === "Sổ đơn thư",
    );
    const other = await registerIncoming(clerk, incomingData("Sổ riêng", { registerId: otherRegister.id, symbol: "1/DT" }));
    expect(other.body.incomingNo).toBe(1);
    const nextYear = await registerIncoming(clerk, incomingData("Năm sau", { receivedOn: `${year + 1}-01-02`, symbol: "1/NS" }));
    expect(nextYear.body).toMatchObject({ incomingNo: 1, year: year + 1 });
  });

  it("trình, giao xử lý thành công việc; xong việc thì đã xử lý; hủy việc thì về chờ ý kiến; quyền xem đúng", async () => {
    expect((await outsider.call("get", `/office/incoming/${ids.incoming}`, { companyId: retail })).status).toBe(404);
    expect((await clerk.call("post", `/office/incoming/${ids.incoming}/submit`, { companyId: retail, body: { leaderUserId: ids.outsider, version: 1 } })).status).toBe(400);
    const submitted = await clerk.call("post", `/office/incoming/${ids.incoming}/submit`, { companyId: retail, body: { leaderUserId: ids.leader, note: "Kính trình", version: 1 } });
    expect(submitted.body).toMatchObject({ status: "awaiting_direction", leader: { id: ids.leader } });
    const viewed = await leader.call("get", `/office/incoming/${ids.incoming}`, { companyId: retail });
    expect(viewed.body.allowedActions).toEqual(["direct"]);
    const direct = await leader.call("post", `/office/incoming/${ids.incoming}/direct`, {
      companyId: retail,
      body: { action: "assign", note: "Phòng Kế toán chủ trì giải trình", ownerUserId: ids.handler, collaboratorIds: [ids.drafter], dueAt: "2026-11-15T17:00:00+07:00", version: viewed.body.version },
    });
    expect(direct.body).toMatchObject({ status: "processing", handler: { id: ids.handler } });
    const task = await handler.call("get", `/office/tasks/${direct.body.taskId}`, { companyId: retail });
    expect(task.body).toMatchObject({ incomingDocumentId: ids.incoming, priority: "urgent", assignedBy: { id: ids.leader } });
    expect((await handler.call("get", `/office/incoming/${ids.incoming}`, { companyId: retail })).status).toBe(200);
    const file = (await handler.call("get", `/office/incoming/${ids.incoming}`, { companyId: retail })).body.files[0];
    expect((await handler.call("get", `/office/incoming/${ids.incoming}/files/${file.id}`, { companyId: retail })).status).toBe(200);
    expect((await drafter.call("get", `/office/incoming/${ids.incoming}`, { companyId: retail })).status).toBe(200);
    expect((await outsider.call("get", `/office/incoming/${ids.incoming}/files/${file.id}`, { companyId: retail })).status).toBe(404);

    // Người giao (lãnh đạo) hủy việc thì công văn về chờ ý kiến; giao lại, hoàn thành thì đã xử lý.
    await leader.call("post", `/office/tasks/${task.body.id}/transition`, { companyId: retail, body: { action: "cancel", reason: "Giao lại", version: task.body.version } });
    const back = await leader.call("get", `/office/incoming/${ids.incoming}`, { companyId: retail });
    expect(back.body).toMatchObject({ status: "awaiting_direction", taskId: null });
    const again = await leader.call("post", `/office/incoming/${ids.incoming}/direct`, { companyId: retail, body: { action: "assign", ownerUserId: ids.handler, version: back.body.version } });
    const second = await handler.call("get", `/office/tasks/${again.body.taskId}`, { companyId: retail });
    const done = await handler.call("post", `/office/tasks/${second.body.id}/transition`, { companyId: retail, body: { action: "report_done", version: second.body.version } });
    await leader.call("post", `/office/tasks/${second.body.id}/transition`, { companyId: retail, body: { action: "confirm", version: done.body.version } });
    const processed = await clerk.call("get", `/office/incoming/${ids.incoming}`, { companyId: retail });
    expect(processed.body.status).toBe("processed");
    expect(processed.body.routings.map((item: { action: string }) => item.action)).toEqual(["registered", "submitted", "assigned", "task_cancelled", "assigned", "processed"]);
  });

  it("chuyển lãnh đạo khác, lưu không cần xử lý; người không được trình không cho ý kiến", async () => {
    const created = await registerIncoming(clerk, incomingData("Thông báo đổi biểu phí", { symbol: "1021/VCB" }));
    const submitted = await clerk.call("post", `/office/incoming/${created.body.id}/submit`, { companyId: retail, body: { leaderUserId: ids.leader, version: created.body.version } });
    expect((await admin.call("post", `/office/incoming/${created.body.id}/direct`, { companyId: retail, body: { action: "archive", version: submitted.body.version } })).status).toBe(403);
    const archived = await leader.call("post", `/office/incoming/${created.body.id}/direct`, { companyId: retail, body: { action: "archive", note: "Lưu", version: submitted.body.version } });
    expect(archived.body.status).toBe("archived");
  });
});

describe("KICHBAN_KIEMTHU_504: công văn đi", () => {
  it("chưa có chính sách duyệt: người ký duyệt; văn thư cấp số theo ký hiệu công văn; phát hành cần bản đã ký", async () => {
    expect((await drafter.call("post", "/office/outgoing", { companyId: retail, body: outgoingBody({ signerUserId: ids.tradingClerk }) })).status).toBe(400);
    const created = await drafter.call("post", "/office/outgoing", { companyId: retail, body: outgoingBody({ replyToIncomingId: ids.incoming }) });
    expect(created.status).toBe(201);
    expect(created.body).toMatchObject({ status: "draft", expectedSymbol: "VCR-KT", replyTo: { incomingNo: 1 } });
    ids.outgoing = created.body.id;
    expect((await outsider.call("get", `/office/outgoing/${ids.outgoing}`, { companyId: retail })).status).toBe(404);
    const submitted = await drafter.call("post", `/office/outgoing/${ids.outgoing}/submit`, { companyId: retail, body: { version: created.body.version } });
    expect(submitted.body).toMatchObject({ status: "pending", approvalMode: "signer" });
    expect((await clerk.call("post", `/office/outgoing/${ids.outgoing}/number`, { companyId: retail, body: { version: submitted.body.version } })).status).toBe(409);
    const view = await signer.call("get", `/office/outgoing/${ids.outgoing}`, { companyId: retail });
    expect(view.body.allowedActions).toEqual(["decide"]);
    expect((await signer.call("post", `/office/outgoing/${ids.outgoing}/decide`, { companyId: retail, body: { decision: "rejected", version: view.body.version } })).status).toBe(400);
    const rejected = await signer.call("post", `/office/outgoing/${ids.outgoing}/decide`, { companyId: retail, body: { decision: "rejected", note: "Bổ sung số liệu", version: view.body.version } });
    expect(rejected.body).toMatchObject({ status: "rejected", decisionNote: "Bổ sung số liệu" });
    const resubmitted = await drafter.call("post", `/office/outgoing/${ids.outgoing}/submit`, { companyId: retail, body: { version: rejected.body.version } });
    const approved = await signer.call("post", `/office/outgoing/${ids.outgoing}/decide`, { companyId: retail, body: { decision: "approved", version: resubmitted.body.version } });
    expect(approved.body.status).toBe("awaiting_number");
    expect((await drafter.call("patch", `/office/outgoing/${ids.outgoing}`, { companyId: retail, body: outgoingBody({ version: approved.body.version }) })).status).toBe(409);
    const numbered = await clerk.call("post", `/office/outgoing/${ids.outgoing}/number`, { companyId: retail, body: { version: approved.body.version } });
    expect(numbered.body).toMatchObject({ status: "numbered", outgoingNo: 1, symbol: "01/VCR-KT", issuedOn: today });
    expect((await clerk.call("post", `/office/outgoing/${ids.outgoing}/cancel`, { companyId: retail, body: { reason: "Thử", version: numbered.body.version } })).status).toBe(409);
    const noFile = await clerk.call("post", `/office/outgoing/${ids.outgoing}/issue`, { companyId: retail }).field("version", String(numbered.body.version));
    expect(noFile.status).toBe(400);
    const issued = await clerk.call("post", `/office/outgoing/${ids.outgoing}/issue`, { companyId: retail }).field("version", String(numbered.body.version)).attach("file", pdf, "da-ky.pdf");
    expect(issued.status).toBe(200);
    expect(issued.body).toMatchObject({ status: "issued", signedFiles: [{ fileName: "da-ky.pdf" }] });
    // Người nhận nội bộ (phòng Kế toán) được thông báo và xem được.
    expect((await pool.query("SELECT 1 FROM core.notifications WHERE user_id = $1 AND kind = 'office_document' AND title LIKE '%01/VCR-KT%'", [ids.handler])).rowCount).toBe(1);
    expect((await handler.call("get", `/office/outgoing/${ids.outgoing}`, { companyId: retail })).status).toBe(200);
  });

  it("có chính sách duyệt: đi luồng duyệt chung; văn bản có tên loại dùng ký hiệu loại; gửi công ty khác thành công văn đến chờ vào sổ", async () => {
    const policy = await admin.call("post", "/approval-policies", {
      companyId: retail,
      body: {
        documentTypeCode: "office.outgoing_document",
        currency: "VND",
        effectiveFrom: "2026-01-01",
        levels: [{ levelNo: 1, minAmount: "0", approver: { type: "user", userId: ids.leader }, substitute: { type: "user", userId: testIds.retailAdmin }, dueHours: 8 }],
      },
    });
    expect(policy.status).toBe(201);
    const created = await drafter.call("post", "/office/outgoing", {
      companyId: retail,
      body: outgoingBody({ documentTypeId: ids.decisionType, summary: "Về việc thành lập tổ kiểm kê cuối năm", recipientLine: null, internalRecipients: [{ kind: "company", id: trading }] }),
    });
    expect(created.body.expectedSymbol).toBe("QĐ-VCR");
    const submitted = await drafter.call("post", `/office/outgoing/${created.body.id}/submit`, { companyId: retail, body: { version: created.body.version } });
    expect(submitted.body).toMatchObject({ status: "pending", approvalMode: "policy", approvalRequestId: expect.any(String) });
    expect((await leader.call("get", `/office/outgoing/${created.body.id}`, { companyId: retail })).status).toBe(200);
    await leader.call("post", `/approval-requests/${submitted.body.approvalRequestId}/decisions`, { body: { decision: "approved", comment: "Đồng ý" } });
    await application.get(OutboxService).dispatchPending();
    const approved = await clerk.call("get", `/office/outgoing/${created.body.id}`, { companyId: retail });
    expect(approved.body.status).toBe("awaiting_number");
    const numbered = await clerk.call("post", `/office/outgoing/${created.body.id}/number`, { companyId: retail, body: { version: approved.body.version } });
    expect(numbered.body.symbol).toBe("02/QĐ-VCR");
    await clerk.call("post", `/office/outgoing/${created.body.id}/issue`, { companyId: retail }).field("version", String(numbered.body.version)).attach("file", pdf, "quyet-dinh.pdf");
    const waiting = await tradingClerk.call("get", "/office/incoming?status=awaiting_registration", { companyId: trading });
    expect(waiting.body.data).toHaveLength(1);
    expect(waiting.body.data[0]).toMatchObject({ sender: "VComm Bán lẻ Miền Nam", symbol: "02/QĐ-VCR", incomingNo: null });
    const detail = await tradingClerk.call("get", `/office/incoming/${waiting.body.data[0].id}`, { companyId: trading });
    expect(detail.body).toMatchObject({ allowedActions: ["accept"], files: [{ fileName: "quyet-dinh.pdf" }], sourceCompanyName: "VComm Bán lẻ Miền Nam" });
    const tradingRegister = (await tradingClerk.call("get", "/office/registers", { companyId: trading })).body.find((item: { direction: string }) => item.direction === "incoming");
    const accepted = await tradingClerk.call("post", `/office/incoming/${detail.body.id}/accept`, {
      companyId: trading,
      body: { registerId: tradingRegister.id, receivedOn: today, version: detail.body.version },
    });
    expect(accepted.body).toMatchObject({ status: "registered", incomingNo: 1 });
    // Công ty bán lẻ không thấy công văn đến của công ty thương mại.
    expect((await clerk.call("get", `/office/incoming/${detail.body.id}`, { companyId: retail })).status).toBe(404);
  });

  it("rút, hủy: người soạn hủy nháp; văn thư hủy khi chờ cấp số", async () => {
    const created = await drafter.call("post", "/office/outgoing", { companyId: retail, body: outgoingBody({ summary: "Nháp sẽ hủy" }) });
    expect((await outsider.call("post", `/office/outgoing/${created.body.id}/cancel`, { companyId: retail, body: { reason: "x", version: created.body.version } })).status).toBe(404);
    const cancelled = await drafter.call("post", `/office/outgoing/${created.body.id}/cancel`, { companyId: retail, body: { reason: "Không gửi nữa", version: created.body.version } });
    expect(cancelled.body.status).toBe("cancelled");
    const uploadMode = await drafter.call("post", "/office/outgoing", { companyId: retail, body: outgoingBody({ summary: "Tải dự thảo", composeMode: "upload", body: [] }) });
    expect((await drafter.call("post", `/office/outgoing/${uploadMode.body.id}/submit`, { companyId: retail, body: { version: uploadMode.body.version } })).status).toBe(400);
    const withFile = await drafter.call("post", `/office/outgoing/${uploadMode.body.id}/files`, { companyId: retail }).attach("file", pdf, "du-thao.pdf");
    const submitted = await drafter.call("post", `/office/outgoing/${uploadMode.body.id}/submit`, { companyId: retail, body: { version: withFile.body.version } });
    const withdrawn = await drafter.call("post", `/office/outgoing/${uploadMode.body.id}/withdraw`, { companyId: retail, body: { version: submitted.body.version } });
    expect(withdrawn.body.status).toBe("withdrawn");
  });
});

describe("KICHBAN_KIEMTHU_505: thể thức PDF, Word; xuất sổ", () => {
  it("PDF khổ A4, phông có chân; Word phông Times New Roman, lề, khổ đúng thông tin thể thức", async () => {
    const pdfFile = await signer.call("get", `/office/outgoing/${ids.outgoing}/render?format=pdf`, { companyId: retail }).buffer(true);
    expect(pdfFile.status).toBe(200);
    const pdfBytes = pdfFile.body as Buffer;
    expect(pdfBytes.subarray(0, 4).toString()).toBe("%PDF");
    expect(pdfBytes.toString("latin1")).toContain("/MediaBox [0 0 595.28 841.89]");
    const folder = mkdtempSync(join(tmpdir(), "cong-van-"));
    if (existsSync("/usr/bin/pdftotext") && existsSync("/usr/bin/pdffonts")) {
      writeFileSync(join(folder, "cv.pdf"), pdfBytes);
      const text = execFileSync("/usr/bin/pdftotext", ["-layout", join(folder, "cv.pdf"), "-"]).toString();
      expect(text).toContain("CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM");
      expect(text).toContain("Độc lập - Tự do - Hạnh phúc");
      expect(text).toContain("Số: 01/VCR-KT");
      expect(text).toContain("V/v Giải trình hóa đơn điện tử quý 3");
      expect(text).toContain(`Thành phố Hồ Chí Minh, ngày ${today.slice(8, 10)} tháng ${Number(today.slice(5, 7)) <= 2 ? today.slice(5, 7) : String(Number(today.slice(5, 7)))} năm ${year}`);
      expect(text).toContain("KHẨN");
      expect(text).toContain("Nơi nhận:");
      expect(text).toContain("- Lưu: VT, KT.");
      expect(text).toContain("BN.03");
      expect(text).not.toContain("DỰ THẢO");
      expect(execFileSync("/usr/bin/pdffonts", [join(folder, "cv.pdf")]).toString()).toContain("LiberationSerif");
    }
    const word = await signer.call("get", `/office/outgoing/${ids.outgoing}/render?format=docx`, { companyId: retail }).buffer(true).parse(binary);
    expect(word.status).toBe(200);
    expect((word.body as Buffer).subarray(0, 2).toString()).toBe("PK");
    if (existsSync("/usr/bin/unzip")) {
      writeFileSync(join(folder, "cv.docx"), word.body as Buffer);
      const xml = execFileSync("/usr/bin/unzip", ["-p", join(folder, "cv.docx"), "word/document.xml"]).toString();
      expect(xml).toContain('w:ascii="Times New Roman"');
      // A4 (210 x 297 mm) và lề trên 20, phải 20, dưới 20, trái 30 mm tính bằng twip.
      expect(xml).toMatch(/<w:pgSz w:w="11906" w:h="16838"/);
      expect(xml).toMatch(/w:top="1134" w:right="1134" w:bottom="1134" w:left="1701"/);
      expect(xml).toContain("CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM");
      expect(xml).toContain('<w:sz w:val="26"/>');
    }
  });

  it("đổi phương án cỡ 14 và lề; dự thảo có dòng DỰ THẢO, số để trống", async () => {
    const settings = (await clerk.call("get", "/office/document-settings", { companyId: retail })).body;
    const saved = await clerk.call("put", "/office/document-settings", { companyId: retail, body: { ...settings, fontScheme: 14, marginRight: 15, parentOrgName: "Tập đoàn VComm" } });
    expect(saved.body).toMatchObject({ fontScheme: 14, marginRight: 15 });
    expect((await clerk.call("put", "/office/document-settings", { companyId: retail, body: { ...saved.body, marginLeft: 40 } })).status).toBe(400);
    const draft = await drafter.call("post", "/office/outgoing", {
      companyId: retail,
      body: outgoingBody({ summary: "Dự thảo thử", signerAuthority: "KT.", signerAuthorityOf: "Giám đốc", signerTitle: "Phó giám đốc" }),
    });
    const file = await drafter.call("get", `/office/outgoing/${draft.body.id}/render?format=docx`, { companyId: retail }).buffer(true).parse(binary);
    if (existsSync("/usr/bin/unzip")) {
      const folder = mkdtempSync(join(tmpdir(), "du-thao-"));
      writeFileSync(join(folder, "dt.docx"), file.body as Buffer);
      const xml = execFileSync("/usr/bin/unzip", ["-p", join(folder, "dt.docx"), "word/document.xml"]).toString();
      expect(xml).toContain("DỰ THẢO");
      expect(xml).toContain("TẬP ĐOÀN VCOMM");
      expect(xml).toContain("KT. GIÁM ĐỐC");
      expect(xml).toContain("PHÓ GIÁM ĐỐC");
      expect(xml).toContain('<w:sz w:val="28"/>');
      expect(xml).toMatch(/w:right="850"/);
      expect(xml).toMatch(/Số:\s+\/VCR-KT/);
    }
  });

  it("xuất sổ đến, sổ đi ra Excel đủ cột", async () => {
    const incoming = await clerk.call("get", `/office/registers/${ids.incomingRegister}/export?year=${year}`, { companyId: retail }).buffer(true).parse(binary);
    expect(incoming.status).toBe(200);
    const incomingRows = await readSheet(incoming.body as Buffer);
    expect(incomingRows[0]).toEqual(["Số đến", "Ngày đến", "Nơi gửi", "Số ký hiệu", "Ngày văn bản", "Tên loại và trích yếu", "Độ khẩn", "Người nhận xử lý", "Hạn xử lý", "Ghi chú"]);
    expect(incomingRows[1]![0]).toBe(1);
    expect(incomingRows.find((row) => row[0] === 6)![9]).toContain("Hủy vào sổ");
    const outgoing = await clerk.call("get", `/office/registers/${ids.outgoingRegister}/export?year=${year}`, { companyId: retail }).buffer(true).parse(binary);
    const outgoingRows = await readSheet(outgoing.body as Buffer);
    expect(outgoingRows[0]).toEqual(["Số", "Ký hiệu", "Ngày văn bản", "Tên loại và trích yếu", "Người ký", "Nơi nhận", "Số bản", "Ghi chú"]);
    expect(outgoingRows.slice(1).map((row) => row[1])).toEqual(["01/VCR-KT", "02/QĐ-VCR"]);
    expect((await drafter.call("get", `/office/registers/${ids.outgoingRegister}/export?year=${year}`, { companyId: retail })).status).toBe(403);
  });
});
