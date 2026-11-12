"use client";

// MAN_HINH_178 Cửa hàng liên kết – danh sách, thêm từ đối tác (CONG_VIEC_55; CHUC_NANG_193; API_206).
import type { AffiliateMerchantDetail, AffiliateMerchantListItem, PageResponse, PartnerListItem } from "contracts";
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
import { defaultTerms, merchantStatusClass, TermsFields, termsBody, type TermsForm } from "@/components/AffiliateTerms";

function CreateDrawer({ onClose }: { onClose: () => void }) {
  const t = useTranslations("affiliate");
  const router = useRouter();
  const { submitting, fields, formError, run, inputClass } = useSubmit();
  const [search, setSearch] = useState("");
  const [found, setFound] = useState<PartnerListItem[] | null>(null);
  const [partner, setPartner] = useState<PartnerListItem | null>(null);
  const [form, setForm] = useState<TermsForm>(defaultTerms());
  return (
    <Drawer title={t("createTitle")} onClose={onClose}>
      <form
        style={{ display: "grid", gap: "var(--khoang-3)" }}
        onSubmit={(event) => {
          event.preventDefault();
          void run(async () => {
            const created = await apiFetch<AffiliateMerchantDetail>("/affiliate/merchants", { method: "POST", body: JSON.stringify({ partnerId: partner?.id ?? "", ...termsBody(form) }) });
            router.push(`/affiliate/merchants/${created.id}`);
          });
        }}
      >
        <Field id="tim-doi-tac" label={t("partner")} error={fields.partnerId} hint={t("partnerHint")}>
          <span style={{ display: "flex", gap: "var(--khoang-2)" }}>
            <input id="tim-doi-tac" className={inputClass("partnerId")} value={search} onChange={(event) => setSearch(event.target.value)} />
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
                  <input type="radio" name="doi-tac" checked={partner?.id === item.id} onChange={() => setPartner(item)} />
                  {item.code} · {item.name} {item.taxCode ? `· ${item.taxCode}` : ""}
                </label>
              ))
            )}
          </div>
        )}
        <TermsFields form={form} setForm={setForm} fields={fields} inputClass={inputClass} />
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

export default function AffiliateMerchantsPage() {
  const t = useTranslations("affiliate");
  const common = useTranslations("common");
  const { can } = useAdmin();
  const [search, setSearch] = useState("");
  const [applied, setApplied] = useState("");
  const [status, setStatus] = useState("");
  const [page, setPage] = useState(1);
  const [creating, setCreating] = useState(false);
  const params = new URLSearchParams({ page: String(page), pageSize: "20", ...(applied ? { search: applied } : {}), ...(status ? { status } : {}) });
  const { state, reload } = useApi<PageResponse<AffiliateMerchantListItem>>(`/affiliate/merchants?${params}`);
  return (
    <>
      <div className="tieu-de">
        <h1>{t("merchantsTitle")}</h1>
        {can("affiliate.manage") && (
          <button type="button" className="nut chinh" onClick={() => setCreating(true)}>
            {t("addMerchant")}
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
        <label className="an-nhan" htmlFor="tim-cua-hang">
          {t("searchMerchant")}
        </label>
        <input id="tim-cua-hang" className="o-nhap" placeholder={t("searchMerchant")} value={search} onChange={(event) => setSearch(event.target.value)} />
        <label className="an-nhan" htmlFor="loc-trang-thai">
          {t("status")}
        </label>
        <select id="loc-trang-thai" className="o-nhap" value={status} onChange={(event) => (setStatus(event.target.value), setPage(1))}>
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
            <MessageView text={t("noMerchants")} />
          ) : (
            <>
              <div className="khung-bang">
                <table>
                  <thead>
                    <tr>
                      {["code", "name", "outlets", "earnPercent", "creditLimit", "status"].map((key) => (
                        <th key={key}>{t(`column_${key}`)}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {result.data.map((item) => (
                      <tr key={item.id}>
                        <td data-nhan={t("column_code")}>
                          <Link href={`/affiliate/merchants/${item.id}`}>{item.code}</Link>
                        </td>
                        <td data-nhan={t("column_name")}>{item.name}</td>
                        <td data-nhan={t("column_outlets")}>{item.outletCount}</td>
                        <td data-nhan={t("column_earnPercent")}>{formatNumber(item.earnPercent, 4)} %</td>
                        <td data-nhan={t("column_creditLimit")}>{formatNumber(item.creditLimit, 0)}</td>
                        <td data-nhan={t("column_status")}>
                          <span className={`nhan ${merchantStatusClass[item.status]}`}>{t(`status_${item.status}`)}</span>
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
