"use client";

// MAN_HINH_60 Đối soát thu hộ (CHUC_NANG_88, 89, 91; API_102, API_103): thẻ bảng đối soát (lọc, nhập tệp), thẻ đơn vị thu hộ.
import { collectionStatementStatuses, collectorKinds, type CollectionStatementsResponse, type CollectorItem, type CollectorKind, type CollectorsResponse, type FinancePartnerOption } from "contracts";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { type FormEvent, useState } from "react";
import { CollectionImportDrawer } from "@/components/CollectionImportDrawer";
import { CollectionStatusBadge } from "@/components/CollectionStatusBadge";
import { PartnerPicker } from "@/components/PartnerPicker";
import { useAdmin } from "ui/components/AppShell";
import { Drawer } from "ui/components/Dialogs";
import { Field, FormError, useSubmit } from "ui/components/Form";
import { HistoryLink } from "ui/components/HistoryLink";
import { Loaded, MessageView } from "ui/components/StatusViews";
import { apiFetch } from "ui/lib/api";
import { formatDate, formatNumber } from "ui/lib/format";
import { useApi } from "ui/lib/use-api";

export default function CollectionStatementsPage() {
  const t = useTranslations("collections");
  const [tab, setTab] = useState<"statements" | "collectors">("statements");
  const collectors = useApi<CollectorsResponse>("/finance/collectors");
  return (
    <>
      <div className="tieu-de">
        <h1>{t("title")}</h1>
        <HistoryLink entityType={tab === "statements" ? "collection_statement" : "collector"} />
      </div>
      <div className="cac-the" role="tablist">
        {(["statements", "collectors"] as const).map((key) => (
          <button key={key} type="button" role="tab" aria-selected={tab === key} className={tab === key ? "chon" : ""} onClick={() => setTab(key)}>
            {t(`tab_${key}`)}
          </button>
        ))}
      </div>
      <Loaded state={collectors.state} onRetry={() => void collectors.reload()}>
        {(result) => (tab === "statements" ? <Statements collectors={result} /> : <Collectors collectors={result} onChanged={() => void collectors.reload()} />)}
      </Loaded>
    </>
  );
}

function Statements({ collectors }: { collectors: CollectorsResponse }) {
  const t = useTranslations("collections");
  const common = useTranslations("common");
  const router = useRouter();
  const [filter, setFilter] = useState({ collectorId: "", status: "", from: "", to: "" });
  const [page, setPage] = useState(1);
  const [importing, setImporting] = useState(false);
  const query = new URLSearchParams({ page: String(page), ...Object.fromEntries(Object.entries(filter).filter(([, value]) => value)) });
  const { state, reload } = useApi<CollectionStatementsResponse>(`/finance/collection-statements?${query.toString()}`);
  const update = (key: keyof typeof filter, value: string) => (setFilter({ ...filter, [key]: value }), setPage(1));
  const headings = [t("statementDate"), t("collector"), t("statementNo"), t("totalCollected"), t("totalFee"), t("netAmount"), t("status")];
  return (
    <>
      <div className="bo-loc">
        <label className="an-nhan" htmlFor="ds-loc-don-vi">
          {t("collector")}
        </label>
        <select id="ds-loc-don-vi" className="o-nhap" style={{ width: "auto" }} value={filter.collectorId} onChange={(event) => update("collectorId", event.target.value)}>
          <option value="">{t("allCollectors")}</option>
          {collectors.collectors.map((item) => (
            <option key={item.id} value={item.id}>
              {item.partnerName}
            </option>
          ))}
        </select>
        <label className="an-nhan" htmlFor="ds-loc-trang-thai">
          {t("status")}
        </label>
        <select id="ds-loc-trang-thai" className="o-nhap" style={{ width: "auto" }} value={filter.status} onChange={(event) => update("status", event.target.value)}>
          <option value="">{t("allStatuses")}</option>
          {collectionStatementStatuses.map((status) => (
            <option key={status} value={status}>
              {t(`status_${status}`)}
            </option>
          ))}
        </select>
        <label htmlFor="ds-tu-ngay">{t("from")}</label>
        <input id="ds-tu-ngay" type="date" className="o-nhap" style={{ width: "auto" }} value={filter.from} onChange={(event) => update("from", event.target.value)} />
        <label htmlFor="ds-den-ngay">{t("to")}</label>
        <input id="ds-den-ngay" type="date" className="o-nhap" style={{ width: "auto" }} value={filter.to} onChange={(event) => update("to", event.target.value)} />
        {collectors.canManage && (
          <button type="button" className="nut chinh" disabled={!collectors.collectors.some((item) => item.status === "active")} onClick={() => setImporting(true)}>
            {t("import")}
          </button>
        )}
      </div>
      {collectors.canManage && collectors.collectors.length === 0 && <p className="chu-thich">{t("noCollectorsHint")}</p>}
      <Loaded state={state} onRetry={() => void reload()}>
        {(result) =>
          result.data.length === 0 ? (
            <MessageView text={t("noStatements")} />
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
                        <span>{formatDate(item.statementDate)}</span>
                      </td>
                      <td data-nhan={headings[1]}>
                        <span>
                          {item.collectorName}
                          <span className="chu-thich"> · {t(`kind_${item.collectorKind}`)}</span>
                        </span>
                      </td>
                      <td data-nhan={headings[2]}>
                        <span>
                          <Link href={`/collection-statements/${item.id}`}>{item.statementNo}</Link>
                          {item.documentNo && <span className="chu-thich"> · {item.documentNo}</span>}
                        </span>
                      </td>
                      <td data-nhan={headings[3]}>
                        <span style={{ whiteSpace: "nowrap" }}>{formatNumber(item.totalCollected)}</span>
                      </td>
                      <td data-nhan={headings[4]}>
                        <span style={{ whiteSpace: "nowrap" }}>{formatNumber(item.totalFee)}</span>
                      </td>
                      <td data-nhan={headings[5]}>
                        <span style={{ whiteSpace: "nowrap" }}>{formatNumber(item.netAmount)}</span>
                      </td>
                      <td data-nhan={headings[6]}>
                        <span className="nhom-nut">
                          <CollectionStatusBadge status={item.status} />
                          {item.errorCount > 0 && <span className="nhan loi">{t("errorCount", { count: item.errorCount })}</span>}
                        </span>
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
      {importing && <CollectionImportDrawer collectors={collectors.collectors} onClose={() => setImporting(false)} onImported={(result) => router.push(`/collection-statements/${result.id}`)} />}
    </>
  );
}

function Collectors({ collectors, onChanged }: { collectors: CollectorsResponse; onChanged: () => void }) {
  const t = useTranslations("collections");
  const [editing, setEditing] = useState<CollectorItem | "new" | null>(null);
  const headings = [t("partner"), t("kind"), t("collectorStatus"), ""];
  return (
    <>
      {collectors.canSetup && (
        <div className="bo-loc">
          <button type="button" className="nut chinh" onClick={() => setEditing("new")}>
            {t("addCollector")}
          </button>
        </div>
      )}
      <p className="chu-thich">{t("collectorHint")}</p>
      {collectors.collectors.length === 0 ? (
        <MessageView text={t("noCollectors")} />
      ) : (
        <div className="khung-bang">
          <table>
            <thead>
              <tr>
                {headings.map((heading, index) => (
                  <th key={index} scope="col">
                    {heading}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {collectors.collectors.map((item) => (
                <tr key={item.id}>
                  <td data-nhan={headings[0]}>
                    <span>
                      {item.partnerName}
                      <span className="chu-thich"> · {item.partnerCode}</span>
                    </span>
                  </td>
                  <td data-nhan={headings[1]}>
                    <span>{t(`kind_${item.kind}`)}</span>
                  </td>
                  <td data-nhan={headings[2]}>
                    <span className={`nhan ${item.status === "active" ? "thanh-cong" : "trung-tinh"}`}>{t(`collectorStatus_${item.status}`)}</span>
                  </td>
                  <td data-nhan={headings[3]}>
                    {collectors.canSetup && (
                      <button type="button" className="nut phu" onClick={() => setEditing(item)}>
                        {t("edit")}
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {editing && <CollectorEditor item={editing === "new" ? null : editing} onClose={() => setEditing(null)} onSaved={() => (setEditing(null), onChanged())} />}
    </>
  );
}

function CollectorEditor({ item, onClose, onSaved }: { item: CollectorItem | null; onClose: () => void; onSaved: () => void }) {
  const t = useTranslations("collections");
  const common = useTranslations("common");
  const { notify } = useAdmin();
  const [partner, setPartner] = useState<FinancePartnerOption | null>(item ? { id: item.partnerId, code: item.partnerCode, name: item.partnerName } : null);
  const [kind, setKind] = useState<CollectorKind>(item?.kind ?? "cod");
  const [active, setActive] = useState(item ? item.status === "active" : true);
  const { submitting, fields, formError, run, inputClass } = useSubmit();
  function submit(event: FormEvent) {
    event.preventDefault();
    if (!partner) return;
    void run(async () => {
      await apiFetch(item ? `/finance/collectors/${item.id}` : "/finance/collectors", {
        method: item ? "PUT" : "POST",
        body: JSON.stringify({ partnerId: partner.id, kind, status: active ? "active" : "inactive", version: item?.version ?? null }),
      });
      notify(t("collectorSaved"));
      onSaved();
    });
  }
  return (
    <Drawer title={item ? t("editCollector") : t("addCollector")} onClose={onClose}>
      <form onSubmit={submit} style={{ display: "grid", gap: "var(--khoang-3)" }}>
        <Field id="dv-doi-tac" label={t("partner")} hint={t("partnerHint")} error={fields.partnerId}>
          <div style={{ display: "grid", gap: "var(--khoang-2)" }}>
            {partner && (
              <strong>
                {partner.name}
                <span className="chu-thich"> · {partner.code}</span>
              </strong>
            )}
            {!item && <PartnerPicker id="dv-doi-tac" side="receivable" onPick={setPartner} invalid={Boolean(fields.partnerId)} />}
          </div>
        </Field>
        <Field id="dv-loai" label={t("kind")} error={fields.kind}>
          <select id="dv-loai" className={inputClass("kind")} value={kind} onChange={(event) => setKind(event.target.value as CollectorKind)}>
            {collectorKinds.map((value) => (
              <option key={value} value={value}>
                {t(`kind_${value}`)}
              </option>
            ))}
          </select>
        </Field>
        <label>
          <input type="checkbox" checked={active} onChange={(event) => setActive(event.target.checked)} /> {t("collectorStatus_active")}
        </label>
        <FormError text={formError} />
        <div className="nhom-nut" style={{ justifyContent: "flex-end" }}>
          <button type="button" className="nut phu" onClick={onClose}>
            {common("cancel")}
          </button>
          <button type="submit" className="nut chinh" disabled={submitting || !partner}>
            {common("save")}
          </button>
        </div>
      </form>
    </Drawer>
  );
}
