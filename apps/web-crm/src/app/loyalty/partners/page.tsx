"use client";

// MAN_HINH_258 Đối tác liên minh – danh sách, thêm hợp đồng từ đối tác (CONG_VIEC_65; CHUC_NANG_236; API_301).
import type { PageResponse, PartnerContractDetail, PartnerContractListItem, PartnerListItem } from "contracts";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { useAdmin } from "ui/components/AppShell";
import { Drawer } from "ui/components/Dialogs";
import { Field, FormError, useSubmit } from "ui/components/Form";
import { Loaded, MessageView } from "ui/components/StatusViews";
import { apiFetch } from "ui/lib/api";
import { formatNumber } from "ui/lib/format";
import { useApi } from "ui/lib/use-api";
import { defaultPartnerForm, partnerBody, partnerStatusClass, PartnerTermsFields, type PartnerForm } from "@/components/LoyaltyPartnerForm";

function CreateDrawer({ onClose }: { onClose: () => void }) {
  const t = useTranslations("loyaltyPartner");
  const router = useRouter();
  const { submitting, fields, formError, run, inputClass } = useSubmit();
  const [search, setSearch] = useState("");
  const [found, setFound] = useState<PartnerListItem[] | null>(null);
  const [partner, setPartner] = useState<PartnerListItem | null>(null);
  const [form, setForm] = useState<PartnerForm>(defaultPartnerForm());
  return (
    <Drawer title={t("createTitle")} onClose={onClose}>
      <form
        style={{ display: "grid", gap: "var(--khoang-3)" }}
        onSubmit={(event) => {
          event.preventDefault();
          void run(async () => {
            const created = await apiFetch<PartnerContractDetail>("/loyalty/partners", { method: "POST", body: JSON.stringify({ partnerId: partner?.id ?? "", ...partnerBody(form) }) });
            router.push(`/loyalty/partners/${created.id}`);
          });
        }}
      >
        <Field id="tim-doi-tac-lm" label={t("partner")} error={fields.partnerId} hint={t("partnerHint")}>
          <span style={{ display: "flex", gap: "var(--khoang-2)" }}>
            <input id="tim-doi-tac-lm" className={inputClass("partnerId")} value={search} onChange={(event) => setSearch(event.target.value)} />
            <button
              type="button"
              className="nut phu"
              onClick={() =>
                void apiFetch<PageResponse<PartnerListItem>>(`/crm/partners?pageSize=10&search=${encodeURIComponent(search.trim())}`).then(
                  (result) => setFound(result.data.filter((item) => !item.internalCompanyId)),
                  () => setFound([]),
                )
              }
            >
              {t("find")}
            </button>
          </span>
        </Field>
        {found && (
          <div className="the" style={{ gap: "var(--khoang-1)" }}>
            {found.length === 0 ? (
              <span className="chu-thich">{t("noPartnerFound")}</span>
            ) : (
              found.map((item) => (
                <label key={item.id} style={{ display: "flex", gap: "var(--khoang-2)" }}>
                  <input type="radio" name="doi-tac-lm" checked={partner?.id === item.id} onChange={() => setPartner(item)} />
                  {item.code} · {item.name} {item.taxCode ? `· ${item.taxCode}` : ""}
                </label>
              ))
            )}
          </div>
        )}
        <PartnerTermsFields form={form} setForm={setForm} fields={fields} inputClass={inputClass} />
        <FormError text={formError} />
        <div className="nhom-nut">
          <button type="button" className="nut phu" onClick={onClose}>
            {t("cancel")}
          </button>
          <button type="submit" className={`nut chinh${submitting ? " dang-xu-ly" : ""}`} disabled={submitting || !partner}>
            {t("create")}
          </button>
        </div>
      </form>
    </Drawer>
  );
}

export default function LoyaltyPartnersPage() {
  const t = useTranslations("loyaltyPartner");
  const common = useTranslations("common");
  const { can } = useAdmin();
  const [search, setSearch] = useState("");
  const [applied, setApplied] = useState("");
  const [status, setStatus] = useState("");
  const [page, setPage] = useState(1);
  const [creating, setCreating] = useState(false);
  const params = new URLSearchParams({ page: String(page), pageSize: "20", ...(applied ? { search: applied } : {}), ...(status ? { status } : {}) });
  const { state, reload } = useApi<PageResponse<PartnerContractListItem>>(`/loyalty/partners?${params}`);
  return (
    <>
      <div className="tieu-de">
        <h1>{t("title")}</h1>
        {can("loyalty.partner.manage") && (
          <button type="button" className="nut chinh" onClick={() => setCreating(true)}>
            {t("addPartner")}
          </button>
        )}
      </div>
      <form
        className="bo-loc"
        onSubmit={(event) => {
          event.preventDefault();
          setApplied(search.trim());
          setPage(1);
        }}
      >
        <label className="an-nhan" htmlFor="tim-lien-minh">
          {t("search")}
        </label>
        <input id="tim-lien-minh" className="o-nhap" placeholder={t("search")} value={search} onChange={(event) => setSearch(event.target.value)} />
        <label className="an-nhan" htmlFor="loc-trang-thai-lm">
          {t("status")}
        </label>
        <select id="loc-trang-thai-lm" className="o-nhap" value={status} onChange={(event) => (setStatus(event.target.value), setPage(1))}>
          <option value="">{t("allStatuses")}</option>
          {(["draft", "active", "suspended", "terminated"] as const).map((value) => (
            <option key={value} value={value}>
              {t(`status_${value}`)}
            </option>
          ))}
        </select>
        <button type="submit" className="nut phu">
          {t("find")}
        </button>
      </form>
      <Loaded state={state} onRetry={() => void reload()}>
        {(result) =>
          result.data.length === 0 ? (
            <MessageView text={t("empty")} />
          ) : (
            <>
              <div className="khung-bang">
                <table>
                  <thead>
                    <tr>
                      {["code", "partner", "program", "directions", "paymentMode", "creditLimit", "status"].map((key) => (
                        <th key={key}>{t(`column_${key}`)}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {result.data.map((item) => (
                      <tr key={item.id}>
                        <td data-nhan={t("column_code")}>
                          <Link href={`/loyalty/partners/${item.id}`}>{item.code}</Link>
                        </td>
                        <td data-nhan={t("column_partner")}>{item.partnerName}</td>
                        <td data-nhan={t("column_program")}>
                          {item.programName} ({item.unitNameVi})
                        </td>
                        <td data-nhan={t("column_directions")}>{item.directions.map((direction) => t(`direction_${direction}`)).join(", ")}</td>
                        <td data-nhan={t("column_paymentMode")}>{t(`paymentMode_${item.paymentMode}`)}</td>
                        <td data-nhan={t("column_creditLimit")}>{item.creditLimit ? formatNumber(item.creditLimit, 0) : "—"}</td>
                        <td data-nhan={t("column_status")}>
                          <span className={`nhan ${partnerStatusClass[item.status]}`}>{t(`status_${item.status}`)}</span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
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
            </>
          )
        }
      </Loaded>
      {creating && <CreateDrawer onClose={() => setCreating(false)} />}
    </>
  );
}
