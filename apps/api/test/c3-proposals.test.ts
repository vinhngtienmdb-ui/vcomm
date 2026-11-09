// CONG_VIEC_03 lát L10: mẫu đề xuất, đề xuất, đính kèm, in PDF (TIEUCHI_NGHIEMTHU_52 đến 55; KICHBAN_KIEMTHU_129 đến 132).
import type { NestExpressApplication } from "@nestjs/platform-express";
import type { Pool } from "pg";
import { execFileSync } from "node:child_process";
import { existsSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { OutboxService } from "../src/common/outbox.service";
import { testIds } from "../src/database/seed";
import { createTestUser, signIn, type Session } from "./helpers";
import { startTestApplication } from "./setup-database";

let application: NestExpressApplication;
let pool: Pool;
let admin: Session;
let requester: Session;
let approver: Session;
let outsider: Session;
const retail: string = testIds.retailCompany;
const templates: Record<string, { id: string; documentTypeCode: string; version: number }> = {};
const pdfHeader = Buffer.from("%PDF-1.4\n%âãÏÓ\n1 0 obj<<>>endobj\n");

async function policyFor(documentTypeCode: string) {
  const response = await admin.call("post", "/approval-policies", {
    companyId: retail,
    body: {
      documentTypeCode,
      currency: "VND",
      effectiveFrom: "2026-01-01",
      levels: [{ levelNo: 1, minAmount: "0", approver: { type: "user", userId: testIds.purchasingManager }, substitute: { type: "user", userId: testIds.retailAdmin }, dueHours: 8 }],
    },
  });
  expect(response.status).toBe(201);
}

const create = (title: string, templateId: string, values: Record<string, unknown>) => requester.call("post", "/proposals", { companyId: retail, body: { templateId, title, values } });

beforeAll(async () => {
  ({ application, pool } = await startTestApplication());
  admin = await signIn(application, "quantri.vcr@vcomm.test");
  const employeeRole = (await pool.query<{ id: string }>("SELECT id FROM core.roles WHERE code = 'employee' AND company_id IS NULL")).rows[0]!.id;
  for (const [email, name] of [
    ["lap.dexuat@vcomm.test", "Trịnh Thị Đề Xuất"],
    ["nguoi.ngoai@vcomm.test", "Vũ Văn Ngoài"],
  ] as const) {
    const id = await createTestUser(pool, email, name, [{ companyId: retail }]);
    await pool.query("INSERT INTO core.user_role_assignments (user_id, role_id, scope_type, company_id, valid_from) VALUES ($1, $2, 'company', $3, '2026-01-01')", [id, employeeRole, retail]);
  }
  requester = await signIn(application, "lap.dexuat@vcomm.test");
  approver = await signIn(application, "phuc.le@vcomm.test");
  outsider = await signIn(application, "nguoi.ngoai@vcomm.test");
});

afterAll(async () => {
  await application?.close();
  await pool?.end();
});

describe("API_50: mẫu đề xuất", () => {
  it("nhân viên không tạo được mẫu; quản trị tạo 3 mẫu có sẵn kèm loại chứng từ, dãy số", async () => {
    expect((await requester.call("post", "/proposal-templates/defaults", { companyId: retail })).status).toBe(403);
    const created = await admin.call("post", "/proposal-templates/defaults", { companyId: retail });
    expect(created.status).toBe(200);
    expect(created.body.map((item: { code: string }) => item.code)).toEqual(["MS", "PC", "TU"]);
    for (const item of created.body) templates[item.code] = item;
    expect(templates.PC!.documentTypeCode).toBe("platform.proposal_vcr_pc");
    const sequences = await admin.call("get", "/number-sequences", { companyId: retail });
    expect(sequences.body.find((item: { documentTypeCode: string }) => item.documentTypeCode === "platform.proposal_vcr_pc")).toMatchObject({ prefix: "PC", nextNumber: "PC-VCR-2026-000001" });
    // Gọi lại không tạo trùng.
    expect((await admin.call("post", "/proposal-templates/defaults", { companyId: retail })).body).toHaveLength(3);
  });

  it("mẫu sai bị từ chối: trùng mã trường, chọn thiếu lựa chọn, thiếu giá trị duyệt", async () => {
    const wrong = await admin.call("post", "/proposal-templates", {
      companyId: retail,
      body: {
        code: "XX",
        name: "Mẫu sai",
        fields: [
          { key: "a", label: "A", type: "text" },
          { key: "a", label: "A2", type: "select" },
        ],
        amountField: "a",
      },
    });
    expect(wrong.status).toBe(400);
    expect(Object.keys(wrong.body.error.fields).sort()).toEqual(["amountField", "fields.1.key", "fields.1.options"]);
    expect(
      (await admin.call("post", "/proposal-templates", { companyId: retail, body: { code: "PC", name: "Trùng", fields: [{ key: "m", label: "M", type: "money" }], amountField: "m" } })).body.error
        .fields,
    ).toEqual({ code: "Mã mẫu đã có trong công ty." });
  });
});

describe("TIEUCHI_NGHIEMTHU_52: giá trị sai kiểu hoặc thiếu trường bắt buộc", () => {
  it("lưu nháp sai kiểu bị từ chối; gửi thiếu trường bắt buộc bị từ chối, chỉ ra đúng trường", async () => {
    const wrong = await create("Chi tiếp khách", templates.PC!.id, { amount: "mười triệu", payment_method: "Séc", due_date: "2026-13-40" });
    expect(wrong.status).toBe(400);
    expect(wrong.body.error.fields).toEqual({ "values.amount": "Giá trị không hợp lệ.", "values.payment_method": "Giá trị không hợp lệ.", "values.due_date": "Giá trị không hợp lệ." });
    const draft = await create("Chi tiếp khách", templates.PC!.id, { amount: "10000000", payment_method: "Tiền mặt" });
    expect(draft.status).toBe(201);
    expect(draft.body).toMatchObject({ status: "draft", proposalNo: null, amount: "10000000", canEdit: true });
    const submitted = await requester.call("post", `/proposals/${draft.body.id}/submit`, { companyId: retail });
    expect(submitted.status).toBe(400);
    expect(submitted.body.error.fields).toEqual({ "values.recipient": "Vui lòng nhập thông tin này.", "values.reason": "Vui lòng nhập thông tin này." });
  });
});

describe("TIEUCHI_NGHIEMTHU_53: gửi đề xuất nhận số, đi qua chính sách duyệt", () => {
  let proposalId: string;

  it("chưa có chính sách duyệt thì không gửi được và số không bị dùng", async () => {
    const draft = await create("Tạm ứng công tác", templates.TU!.id, { reason: "Công tác Hà Nội", amount: "5000000", repayment_date: "2026-11-30" });
    const failed = await requester.call("post", `/proposals/${draft.body.id}/submit`, { companyId: retail });
    expect(failed.status).toBe(409);
    expect((await requester.call("get", `/proposals/${draft.body.id}`, { companyId: retail })).body.status).toBe("draft");
    await policyFor(templates.TU!.documentTypeCode);
    const ok = await requester.call("post", `/proposals/${draft.body.id}/submit`, { companyId: retail });
    expect(ok.body.proposalNo).toBe("TU-VCR-2026-000001");
  });

  it("phiếu chi gửi duyệt với đúng giá trị; người duyệt duyệt thì đề xuất đã duyệt", async () => {
    await policyFor(templates.PC!.documentTypeCode);
    // VND không có phần lẻ.
    expect((await create("Lẻ", templates.PC!.id, { amount: "12500000.5" })).body.error.fields).toEqual({ "values.amount": "Giá trị không hợp lệ." });
    const draft = await create("Chi tiếp khách quý IV", templates.PC!.id, { recipient: "Nhà hàng Sen", reason: "Tiếp đối tác", amount: "12500000", payment_method: "Chuyển khoản" });
    proposalId = draft.body.id;
    const submitted = await requester.call("post", `/proposals/${proposalId}/submit`, { companyId: retail });
    expect(submitted.status).toBe(200);
    expect(submitted.body).toMatchObject({ status: "pending", proposalNo: "PC-VCR-2026-000001", amount: "12500000", canEdit: false, canWithdraw: true });
    const request = await approver.call("get", `/approval-requests/${submitted.body.approvalRequestId}`);
    expect(request.body).toMatchObject({ documentNo: "PC-VCR-2026-000001", amount: "12500000", documentId: proposalId });
    // Sửa sau khi gửi bị từ chối.
    expect((await requester.call("patch", `/proposals/${proposalId}`, { companyId: retail, body: { templateId: templates.PC!.id, title: "Đổi", values: {} } })).status).toBe(409);
    await approver.call("post", `/approval-requests/${submitted.body.approvalRequestId}/decisions`, { body: { decision: "approved", comment: "Đồng ý" } });
    expect((await requester.call("get", `/proposals/${proposalId}`, { companyId: retail })).body.status).toBe("approved");
    await application.get(OutboxService).dispatchPending();
    expect((await pool.query("SELECT status FROM core.proposals WHERE id = $1", [proposalId])).rows[0].status).toBe("approved");
  });

  it("sửa mẫu sau khi gửi không đổi đề xuất đã gửi", async () => {
    const template = (await admin.call("get", "/proposal-templates?all=true", { companyId: retail })).body.find((item: { code: string }) => item.code === "PC");
    const updated = await admin.call("patch", `/proposal-templates/${template.id}`, {
      companyId: retail,
      body: {
        name: "Phiếu chi (mới)",
        nameEn: "Payment",
        currency: "VND",
        fields: [{ key: "amount", label: "Số tiền chi", type: "money", required: true }],
        amountField: "amount",
        status: "active",
        version: template.version,
      },
    });
    expect(updated.status).toBe(200);
    const proposal = await requester.call("get", `/proposals/${proposalId}`, { companyId: retail });
    expect(proposal.body.template.name).toBe("Phiếu đề nghị chi");
    expect(proposal.body.template.fields).toHaveLength(6);
  });

  it("đề nghị mua sắm: giá trị duyệt là tổng thành tiền; rút được khi chưa ai duyệt", async () => {
    await policyFor(templates.MS!.documentTypeCode);
    const draft = await create("Mua máy in", templates.MS!.id, {
      purpose: "Thay máy in phòng kế toán",
      items: [
        { name: "Máy in laser", quantity: "2", unit: "cái", amount: "8000000" },
        { name: "Hộp mực", quantity: "4", unit: "hộp", amount: "1200000" },
      ],
    });
    expect(draft.body.amount).toBe("9200000");
    const submitted = await requester.call("post", `/proposals/${draft.body.id}/submit`, { companyId: retail });
    expect(submitted.body.status).toBe("pending");
    const withdrawn = await requester.call("post", `/proposals/${draft.body.id}/withdraw`, { companyId: retail });
    expect(withdrawn.body.status).toBe("withdrawn");
    const mine = await requester.call("get", "/proposals?pageSize=50", { companyId: retail });
    expect(mine.body.total).toBe(4);
    expect((await requester.call("get", "/proposals?scope=company", { companyId: retail })).status).toBe(403);
    expect((await admin.call("get", "/proposals?scope=company", { companyId: retail })).body.total).toBe(4);
  });
});

describe("TIEUCHI_NGHIEMTHU_54: tệp đính kèm", () => {
  it("sai loại, quá 10 MB, quá 10 tệp bị từ chối; người ngoài không tải được", async () => {
    const draft = await create("Chi có hóa đơn", templates.PC!.id, { amount: "1000000" });
    const id = draft.body.id;
    const upload = (session: Session, content: Buffer, name: string) => session.call("post", `/proposals/${id}/attachments`, { companyId: retail }).attach("file", content, name);
    expect((await upload(requester, Buffer.from("xin chao"), "ghi-chu.txt")).status).toBe(400);
    // Đổi đuôi nhưng nội dung không phải PDF.
    expect((await upload(requester, Buffer.from("<html>giả</html>"), "hoa-don.pdf")).body.error.fields).toEqual({ file: "Chỉ nhận tệp PDF, JPG, PNG, XLSX, DOCX." });
    const large = await upload(requester, Buffer.concat([pdfHeader, Buffer.alloc(10 * 1024 * 1024)]), "lon.pdf");
    expect(large.status).toBe(400);
    expect(large.body.error.fields.file).toBe("Tệp vượt quá 10 MB.");
    const first = await upload(requester, pdfHeader, "Hóa đơn GTGT số 123.pdf");
    expect(first.status).toBe(201);
    expect(first.body).toMatchObject({ fileName: "Hóa đơn GTGT số 123.pdf", contentType: "application/pdf" });
    expect((await upload(outsider, pdfHeader, "x.pdf")).status).toBe(404);
    for (let index = 2; index <= 10; index += 1) expect((await upload(requester, pdfHeader, `tep-${index}.pdf`)).status).toBe(201);
    expect((await upload(requester, pdfHeader, "tep-11.pdf")).status).toBe(409);
    const downloaded = await requester.call("get", `/attachments/${first.body.id}`, { companyId: retail });
    expect(downloaded.status).toBe(200);
    expect(downloaded.headers["content-disposition"]).toContain("filename*=UTF-8''H%C3%B3a%20%C4%91%C6%A1n");
    expect((await outsider.call("get", `/attachments/${first.body.id}`, { companyId: retail })).status).toBe(404);
    // Người duyệt tải được sau khi gửi; không xóa được tệp khi đã gửi.
    await requester.call("patch", `/proposals/${id}`, {
      companyId: retail,
      body: { templateId: templates.PC!.id, title: "Chi có hóa đơn", values: { recipient: "Công ty A", reason: "Mua văn phòng phẩm", amount: "1000000", payment_method: "Tiền mặt" } },
    });
    expect((await requester.call("post", `/proposals/${id}/submit`, { companyId: retail })).status).toBe(200);
    expect((await approver.call("get", `/attachments/${first.body.id}`, { companyId: retail })).status).toBe(200);
    expect((await requester.call("delete", `/attachments/${first.body.id}`, { companyId: retail })).status).toBe(409);
  });
});

describe("TIEUCHI_NGHIEMTHU_55: in PDF", () => {
  it("PDF có tên công ty, số đề xuất, các trường, bảng chi tiết, các cấp duyệt; tiếng Việt đúng dấu", async () => {
    const list = await requester.call("get", "/proposals?pageSize=50", { companyId: retail });
    const purchase = list.body.data.find((item: { title: string }) => item.title === "Mua máy in");
    const payment = list.body.data.find((item: { title: string }) => item.title === "Chi tiếp khách quý IV");
    for (const item of [purchase, payment]) {
      const pdf = await requester.call("get", `/proposals/${item.id}/pdf`, { companyId: retail }).buffer(true);
      expect(pdf.status).toBe(200);
      expect(pdf.headers["content-type"]).toBe("application/pdf");
      expect((pdf.body as Buffer).subarray(0, 5).toString()).toBe("%PDF-");
    }
    expect((await outsider.call("get", `/proposals/${payment.id}/pdf`, { companyId: retail })).status).toBe(404);
    // Có pdftotext thì đọc chữ trong tệp để kiểm dấu tiếng Việt.
    if (existsSync("/usr/bin/pdftotext")) {
      const folder = mkdtempSync(join(tmpdir(), "de-xuat-"));
      const file = join(folder, "de-xuat.pdf");
      writeFileSync(file, (await requester.call("get", `/proposals/${payment.id}/pdf`, { companyId: retail }).buffer(true)).body as Buffer);
      const text = execFileSync("/usr/bin/pdftotext", ["-layout", file, "-"]).toString();
      for (const expected of [
        "Công ty Cổ phần VComm Bán lẻ Miền Nam",
        "PHIẾU ĐỀ NGHỊ CHI",
        "PC-VCR-2026-000001",
        "Người nhận tiền",
        "Nhà hàng Sen",
        "12.500.000 VND",
        "Các cấp duyệt",
        "Lê Văn Phúc",
        "Đã duyệt",
        "Đồng ý",
      ]) {
        expect(text).toContain(expected);
      }
      const purchaseText = execFileSync("/usr/bin/pdftotext", ["-layout", "-", "-"], {
        input: (await requester.call("get", `/proposals/${purchase.id}/pdf`, { companyId: retail }).buffer(true)).body as Buffer,
      }).toString();
      expect(purchaseText).toContain("Hàng hóa, dịch vụ cần mua");
      expect(purchaseText).toContain("Hộp mực");
    }
  });
});
