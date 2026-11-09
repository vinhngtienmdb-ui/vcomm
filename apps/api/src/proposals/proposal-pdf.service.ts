// In đề xuất PDF theo bố cục chuẩn (CHUC_NANG_29; API_53): thông tin công ty, số đề xuất, các trường, bảng chi tiết, các cấp duyệt.
// Dùng pdfmake với phông Roboto có sẵn trong gói (đủ dấu tiếng Việt); không cho tải tài nguyên ngoài.
import { Inject, Injectable } from "@nestjs/common";
import type { ProposalField } from "contracts";
import { sql } from "drizzle-orm";
import { dirname, join } from "node:path";
import { ApprovalRequestsService } from "../approvals/approval-requests.service";
import { DATABASE, type Database } from "../database/database.module";
import type { Actor } from "../permissions/roles.service";
import { ProposalsService } from "./proposals.service";

// pdfmake 0.3 không kèm khai báo kiểu.
// eslint-disable-next-line @typescript-eslint/no-require-imports
const pdfmake = require("pdfmake") as {
  setFonts(fonts: Record<string, Record<string, string>>): void;
  setUrlAccessPolicy(callback: (url: string) => boolean): void;
  setLocalAccessPolicy(callback: (path: string) => boolean): void;
  createPdf(definition: Record<string, unknown>): { getBuffer(): Promise<Buffer> };
};

const fontDirectory = join(dirname(require.resolve("pdfmake/package.json")), "fonts", "Roboto");
pdfmake.setFonts({
  Roboto: {
    normal: join(fontDirectory, "Roboto-Regular.ttf"),
    bold: join(fontDirectory, "Roboto-Medium.ttf"),
    italics: join(fontDirectory, "Roboto-Italic.ttf"),
    bolditalics: join(fontDirectory, "Roboto-MediumItalic.ttf"),
  },
});
pdfmake.setUrlAccessPolicy(() => false);
pdfmake.setLocalAccessPolicy((path) => path.startsWith(fontDirectory));

const statusText: Record<string, string> = { draft: "Nháp", pending: "Chờ duyệt", approved: "Đã duyệt", rejected: "Bị từ chối", withdrawn: "Đã rút" };
const money = (value: string, currency: string) => `${new Intl.NumberFormat("vi-VN", { maximumFractionDigits: currency === "VND" ? 0 : 2 }).format(Number(value))} ${currency}`;
const date = (value: string | Date | null) =>
  value ? new Intl.DateTimeFormat("vi-VN", { timeZone: "Asia/Ho_Chi_Minh", day: "2-digit", month: "2-digit", year: "numeric" }).format(new Date(value)) : "";
const dateTime = (value: string | null) =>
  value ? new Intl.DateTimeFormat("vi-VN", { timeZone: "Asia/Ho_Chi_Minh", day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" }).format(new Date(value)) : "";

@Injectable()
export class ProposalPdfService {
  constructor(
    @Inject(DATABASE) private readonly database: Database,
    private readonly proposals: ProposalsService,
    private readonly approvals: ApprovalRequestsService,
  ) {}

  async render(actor: Actor, id: string): Promise<{ fileName: string; content: Buffer }> {
    const proposal = await this.proposals.detail(actor, id);
    const company = (
      await this.database.execute<{ legal_name: string; tax_code: string | null; address: string | null }>(sql`
      SELECT legal_name, tax_code, address FROM core.companies WHERE id = ${actor.companyId}`)
    ).rows[0]!;
    const steps = proposal.approvalRequestId ? (await this.approvals.detail(actor.userId, proposal.approvalRequestId)).steps : [];
    const fieldRows = proposal.template.fields
      .filter((field) => field.type !== "lines")
      .map((field) => [{ text: field.label, bold: true }, this.valueText(field, proposal.values[field.key], proposal.currency)]);
    const lineTables = proposal.template.fields
      .filter((field) => field.type === "lines")
      .flatMap((field) => {
        const lines = (proposal.values[field.key] as Record<string, string>[] | undefined) ?? [];
        const columns = field.columns ?? [];
        return [
          { text: field.label, style: "heading" },
          {
            table: {
              headerRows: 1,
              widths: ["auto", ...columns.map(() => "*")],
              body: [
                [{ text: "STT", bold: true }, ...columns.map((column) => ({ text: column.label, bold: true, alignment: column.type === "text" ? "left" : "right" }))],
                ...lines.map((line, index) => [
                  String(index + 1),
                  ...columns.map((column) => ({
                    text: column.type === "money" && line[column.key] ? money(line[column.key]!, proposal.currency) : (line[column.key] ?? ""),
                    alignment: column.type === "text" ? "left" : "right",
                  })),
                ]),
              ],
            },
            layout: "lightHorizontalLines",
          },
        ];
      });
    const definition = {
      pageSize: "A4",
      pageMargins: [40, 40, 40, 50],
      defaultStyle: { font: "Roboto", fontSize: 10 },
      styles: { title: { fontSize: 16, bold: true, alignment: "center", margin: [0, 16, 0, 4] }, heading: { fontSize: 11, bold: true, margin: [0, 14, 0, 6] }, muted: { color: "#475569" } },
      footer: (page: number, pages: number) => ({ text: `${proposal.proposalNo ?? ""} · Trang ${page}/${pages}`, alignment: "right", margin: [40, 10], fontSize: 8, color: "#475569" }),
      content: [
        { text: company.legal_name, bold: true, fontSize: 12 },
        { text: [company.tax_code ? `Mã số thuế: ${company.tax_code}` : "", company.address ? ` · ${company.address}` : ""].join(""), style: "muted" },
        { text: proposal.template.name.toUpperCase(), style: "title" },
        {
          text: `Số: ${proposal.proposalNo ?? "(chưa gửi)"} · Ngày: ${date(proposal.submittedAt ?? proposal.createdAt)} · Trạng thái: ${statusText[proposal.status] ?? proposal.status}`,
          alignment: "center",
          style: "muted",
        },
        { text: "Thông tin đề xuất", style: "heading" },
        {
          table: {
            widths: [150, "*"],
            body: [
              [{ text: "Tiêu đề", bold: true }, proposal.title],
              [{ text: "Người đề xuất", bold: true }, proposal.requestedByName],
              ...fieldRows,
              [
                { text: "Giá trị duyệt", bold: true },
                { text: money(proposal.amount, proposal.currency), bold: true },
              ],
            ],
          },
          layout: "lightHorizontalLines",
        },
        ...lineTables,
        ...(proposal.attachments.length > 0 ? [{ text: "Tệp đính kèm", style: "heading" }, { ul: proposal.attachments.map((item) => item.fileName) }] : []),
        { text: "Các cấp duyệt", style: "heading" },
        steps.length === 0
          ? { text: "Chưa gửi duyệt.", style: "muted" }
          : {
              table: {
                headerRows: 1,
                widths: ["auto", "*", "auto", "auto", "*"],
                body: [
                  ["Cấp", "Người duyệt", "Kết quả", "Thời điểm", "Ý kiến"].map((text) => ({ text, bold: true })),
                  ...steps.map((step) => [
                    String(step.levelNo),
                    step.decidedByName ?? step.assignedUserName ?? step.assignedRoleName ?? "",
                    step.decision === "approved" ? "Đã duyệt" : step.decision === "rejected" ? "Từ chối" : "Chờ duyệt",
                    dateTime(step.decidedAt),
                    step.comment ?? "",
                  ]),
                ],
              },
              layout: "lightHorizontalLines",
            },
      ],
    };
    const content = await pdfmake.createPdf(definition).getBuffer();
    return { fileName: `${(proposal.proposalNo ?? "de-xuat").replace(/[^A-Za-z0-9-]/g, "_")}.pdf`, content: Buffer.from(content) };
  }

  private valueText(field: ProposalField, value: unknown, currency: string): string {
    if (value === undefined || value === null || value === "") return "";
    if (field.type === "money") return money(String(value), currency);
    if (field.type === "date") return date(String(value));
    return String(value);
  }
}
