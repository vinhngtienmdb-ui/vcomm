"use client";

// MAN_HINH_21 Đề xuất (CHUC_NANG_28; API_50, API_51): đề xuất của tôi hoặc toàn công ty (người quản lý mẫu); lập đề xuất theo mẫu.
import type { MeResponse, PageResponse, ProposalListItem, ProposalTemplateResponse } from "contracts";
import { proposalStatuses } from "contracts";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { useState } from "react";
import { Drawer } from "@/components/Dialogs";
import { proposalStatusTone } from "@/components/ProposalContent";
import { Loaded, MessageView } from "@/components/StatusViews";
import { UserShell } from "@/components/UserShell";
import { formatDateTime, formatMoney } from "@/lib/format";
import { useApi } from "@/lib/use-api";

export default function ProposalsPage() {
  return <UserShell>{(me) => <Proposals me={me} />}</UserShell>;
}

function Proposals({ me }: { me: MeResponse }) {
  const t = useTranslations("proposals");
  const common = useTranslations("common");
  const canSeeCompany = me.permissions.includes("platform.proposal_template.manage");
  const [scope, setScope] = useState<"mine" | "company">("mine");
  const [status, setStatus] = useState("");
  const [page, setPage] = useState(1);
  const [choosing, setChoosing] = useState(false);
  const parameters = new URLSearchParams({ scope, page: String(page), pageSize: "20" });
  if (status) parameters.set("status", status);
  const { state, reload } = useApi<PageResponse<ProposalListItem>>(`/proposals?${parameters}`);
  const headings = [t("number"), t("titleField"), t("template"), t("amount"), t("status"), t("requestedBy"), t("createdAt")];

  return (
    <>
      <div className="tieu-de">
        <h1>{t("title")}</h1>
        <button type="button" className="nut chinh" onClick={() => setChoosing(true)}>
          {t("add")}
        </button>
      </div>
      <div className="bo-loc">
        {canSeeCompany && (
          <div className="cac-the" role="tablist">
            {(["mine", "company"] as const).map((key) => (
              <button
                key={key}
                type="button"
                role="tab"
                aria-selected={scope === key}
                className={scope === key ? "chon" : ""}
                onClick={() => {
                  setScope(key);
                  setPage(1);
                }}
              >
                {t(key)}
              </button>
            ))}
          </div>
        )}
        <label className="an-nhan" htmlFor="loc-trang-thai">
          {t("statusFilter")}
        </label>
        <select
          id="loc-trang-thai"
          className="o-nhap"
          style={{ width: "auto" }}
          value={status}
          onChange={(event) => {
            setStatus(event.target.value);
            setPage(1);
          }}
        >
          <option value="">{`${t("statusFilter")}: ${common("all")}`}</option>
          {proposalStatuses.map((value) => (
            <option key={value} value={value}>
              {t(`status_${value}`)}
            </option>
          ))}
        </select>
      </div>
      <Loaded state={state} onRetry={() => void reload()}>
        {(result) =>
          result.data.length === 0 ? (
            <MessageView text={status ? common("noResult") : t("none")} />
          ) : (
            <div className="khung-bang">
              <table>
                <thead>
                  <tr>
                    {headings.map((heading) => (
                      <th key={heading} scope="col">
                        {heading}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {result.data.map((item) => (
                    <tr key={item.id}>
                      <td data-nhan={headings[0]}>
                        <Link href={`/de-xuat/${item.id}`}>{item.proposalNo ?? t("status_draft")}</Link>
                      </td>
                      <td data-nhan={headings[1]}>
                        <span>{item.title}</span>
                      </td>
                      <td data-nhan={headings[2]}>
                        <span>{item.templateName}</span>
                      </td>
                      <td data-nhan={headings[3]}>
                        <span style={{ whiteSpace: "nowrap" }}>{formatMoney(item.amount, item.currency)}</span>
                      </td>
                      <td data-nhan={headings[4]}>
                        <span className={`nhan ${proposalStatusTone[item.status]}`}>{t(`status_${item.status}`)}</span>
                      </td>
                      <td data-nhan={headings[5]}>
                        <span>{item.requestedByName}</span>
                      </td>
                      <td data-nhan={headings[6]}>
                        <span>{formatDateTime(item.createdAt)}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <div className="phan-trang">
                <span>{common("total", { count: result.total })}</span>
                <span className="nhom-nut">
                  <button type="button" className="nut phu" disabled={page <= 1} onClick={() => setPage(page - 1)}>
                    ‹ {common("previous")}
                  </button>
                  <button type="button" className="nut phu" disabled={page * result.pageSize >= result.total} onClick={() => setPage(page + 1)}>
                    {common("next")} ›
                  </button>
                </span>
              </div>
            </div>
          )
        }
      </Loaded>
      {choosing && <TemplatePicker onClose={() => setChoosing(false)} />}
    </>
  );
}

function TemplatePicker({ onClose }: { onClose: () => void }) {
  const t = useTranslations("proposals");
  const { state, reload } = useApi<ProposalTemplateResponse[]>("/proposal-templates");
  return (
    <Drawer title={t("chooseTemplate")} onClose={onClose}>
      <Loaded state={state} onRetry={() => void reload()}>
        {(templates) =>
          templates.length === 0 ? (
            <p style={{ margin: 0 }}>{t("noTemplate")}</p>
          ) : (
            <div style={{ display: "grid", gap: "var(--khoang-2)" }}>
              {templates.map((template) => (
                <Link key={template.id} className="the" href={`/de-xuat/moi?mau=${template.id}`} style={{ textDecoration: "none", color: "inherit" }}>
                  <strong>{template.name}</strong>
                  {template.description && <span className="chu-thich">{template.description}</span>}
                  {!template.hasPolicy && <span className="nhan canh-bao">{t("noPolicy")}</span>}
                </Link>
              ))}
            </div>
          )
        }
      </Loaded>
    </Drawer>
  );
}
