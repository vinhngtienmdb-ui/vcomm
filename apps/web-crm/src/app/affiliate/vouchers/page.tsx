"use client";

// MAN_HINH_179 Voucher liên kết (CONG_VIEC_55; CHUC_NANG_195; API_210): mọi voucher (lọc loại, trạng thái), tạo voucher công ty phát hành, gửi duyệt, rút,
// tạm dừng, tiếp tục. Voucher cửa hàng gửi lên được duyệt trong Hộp duyệt theo chính sách duyệt của công ty.
import type { AffiliateMerchantListItem, AffiliateVoucherItem, PageResponse } from "contracts";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { useAdmin } from "ui/components/AppShell";
import { Drawer } from "ui/components/Dialogs";
import { Field, FormError, useSubmit } from "ui/components/Form";
import { Loaded, MessageView } from "ui/components/StatusViews";
import { discountText, voucherStatusClass } from "ui/lib/affiliate-voucher";
import { apiFetch } from "ui/lib/api";
import { formatDate, formatNumber, vietnamToday } from "ui/lib/format";
import { useApi } from "ui/lib/use-api";

const digits = (value: string) => value.replace(/[^\d]/g, "");

function CompanyVoucherForm({ voucher, onClose, onSaved }: { voucher: AffiliateVoucherItem | null; onClose: () => void; onSaved: (submitted: boolean) => void }) {
  const t = useTranslations("affiliateVoucher");
  const { submitting, fields, formError, run, inputClass } = useSubmit();
  const merchants = useApi<PageResponse<AffiliateMerchantListItem>>("/affiliate/merchants?pageSize=100&status=active");
  const today = vietnamToday();
  const [form, setForm] = useState({
    titleVi: voucher?.titleVi ?? "",
    titleEn: voucher?.titleEn ?? "",
    discountKind: voucher?.discountKind ?? "amount",
    discountValue: voucher?.discountValue ?? "",
    maxDiscount: voucher?.discountKind === "percent" ? voucher.maxDiscount : "",
    minBill: voucher?.minBill ?? "0",
    totalQuantity: String(voucher?.totalQuantity ?? 1000),
    perBuyerLimit: String(voucher?.perBuyerLimit ?? 1),
    claimFrom: voucher?.claimFrom ?? today,
    claimTo: voucher?.claimTo ?? today,
    validDays: String(voucher?.validDays ?? 14),
  });
  const [merchantIds, setMerchantIds] = useState<string[]>(voucher?.merchantIds ?? []);
  const set = (key: keyof typeof form, value: string) => setForm({ ...form, [key]: value });
  const input = (key: keyof typeof form, type = "text", hint?: string) => (
    <Field id={`v-${key}`} label={t(`field_${key}`)} error={fields[key]} {...(hint ? { hint } : {})}>
      <input id={`v-${key}`} type={type} className={inputClass(key)} value={form[key]} onChange={(event) => set(key, event.target.value)} />
    </Field>
  );
  const save = (submit: boolean) =>
    void run(async () => {
      const body = {
        titleVi: form.titleVi,
        titleEn: form.titleEn,
        discountKind: form.discountKind,
        discountValue: digits(form.discountValue),
        maxDiscount: form.discountKind === "percent" ? digits(form.maxDiscount) || null : null,
        minBill: digits(form.minBill) || "0",
        totalQuantity: Number(form.totalQuantity),
        perBuyerLimit: Number(form.perBuyerLimit),
        claimFrom: form.claimFrom,
        claimTo: form.claimTo,
        validDays: Number(form.validDays),
        merchantIds,
        ...(voucher ? { version: voucher.version } : {}),
      };
      const saved = await apiFetch<AffiliateVoucherItem>(voucher ? `/affiliate/vouchers/${voucher.id}` : "/affiliate/vouchers", { method: voucher ? "PUT" : "POST", body: JSON.stringify(body) });
      if (submit) await apiFetch(`/affiliate/vouchers/${saved.id}/submit`, { method: "POST", body: JSON.stringify({ version: saved.version }) });
      onSaved(submit);
    });
  return (
    <Drawer title={voucher ? t("editTitle", { code: voucher.code }) : t("createCompanyTitle")} onClose={onClose}>
      <form style={{ display: "grid", gap: "var(--khoang-3)" }} onSubmit={(event) => (event.preventDefault(), save(false))}>
        <p className="chu-thich">{t("companyHint")}</p>
        {input("titleVi")}
        {input("titleEn")}
        <Field id="v-discountKind" label={t("field_discountKind")}>
          <select id="v-discountKind" className="o-nhap" value={form.discountKind} onChange={(event) => set("discountKind", event.target.value)}>
            <option value="amount">{t("kind_amount")}</option>
            <option value="percent">{t("kind_percent")}</option>
          </select>
        </Field>
        {input("discountValue", "text", form.discountKind === "percent" ? t("percentHint") : undefined)}
        {form.discountKind === "percent" && input("maxDiscount")}
        {input("minBill")}
        {input("totalQuantity", "number")}
        {input("perBuyerLimit", "number")}
        {input("claimFrom", "date")}
        {input("claimTo", "date")}
        {input("validDays", "number", t("validDaysHint"))}
        <fieldset className="truong" style={{ border: 0, padding: 0, margin: 0 }}>
          <legend style={{ fontWeight: 700, fontSize: 13 }}>{t("field_merchantIds")}</legend>
          <span className="chu-thich">{t("merchantIdsHint")}</span>
          {merchants.state.kind === "ready" &&
            merchants.state.data.data.map((merchant) => (
              <label key={merchant.id} style={{ display: "flex", gap: "var(--khoang-2)" }}>
                <input
                  type="checkbox"
                  checked={merchantIds.includes(merchant.id)}
                  onChange={(event) => setMerchantIds(event.target.checked ? [...merchantIds, merchant.id] : merchantIds.filter((id) => id !== merchant.id))}
                />
                {merchant.code} · {merchant.name}
              </label>
            ))}
          {fields.merchantIds && <span className="loi-o">{fields.merchantIds}</span>}
        </fieldset>
        <FormError text={formError} />
        <div className="nhom-nut">
          <button type="button" className="nut phu" onClick={onClose}>
            {t("cancel")}
          </button>
          <button type="submit" className="nut phu" disabled={submitting}>
            {t("saveDraft")}
          </button>
          <button type="button" className={`nut chinh${submitting ? " dang-xu-ly" : ""}`} disabled={submitting} onClick={() => save(true)}>
            {t("saveSubmit")}
          </button>
        </div>
      </form>
    </Drawer>
  );
}

function Actions({ voucher, canManage, onDone, onEdit }: { voucher: AffiliateVoucherItem; canManage: boolean; onDone: (message: string) => void; onEdit: () => void }) {
  const t = useTranslations("affiliateVoucher");
  const { submitting, formError, run } = useSubmit();
  if (!canManage) return null;
  const act = (action: string) =>
    void run(async () => {
      await apiFetch(`/affiliate/vouchers/${voucher.id}/${action}`, { method: "POST", body: JSON.stringify({ version: voucher.version }) });
      onDone(t(`done_${action}`));
    });
  const own = voucher.issuer === "company";
  return (
    <span className="nhom-nut">
      {own && ["draft", "rejected", "withdrawn"].includes(voucher.status) && (
        <>
          <button type="button" className="nut phu" onClick={onEdit}>
            {t("edit")}
          </button>
          <button type="button" className="nut chinh" disabled={submitting} onClick={() => act("submit")}>
            {t("submit")}
          </button>
        </>
      )}
      {own && voucher.status === "pending" && (
        <button type="button" className="nut phu" disabled={submitting} onClick={() => act("withdraw")}>
          {t("withdraw")}
        </button>
      )}
      {voucher.status === "approved" && voucher.displayStatus !== "ended" && (
        <button type="button" className="nut phu" disabled={submitting} onClick={() => act("pause")}>
          {t("pause")}
        </button>
      )}
      {voucher.status === "paused" && (
        <button type="button" className="nut phu" disabled={submitting} onClick={() => act("resume")}>
          {t("resume")}
        </button>
      )}
      <FormError text={formError} />
    </span>
  );
}

export default function AffiliateVouchersPage() {
  const t = useTranslations("affiliateVoucher");
  const common = useTranslations("common");
  const { can, notify } = useAdmin();
  const [issuer, setIssuer] = useState("");
  const [status, setStatus] = useState("");
  const [page, setPage] = useState(1);
  const [editing, setEditing] = useState<AffiliateVoucherItem | "new" | null>(null);
  const params = new URLSearchParams({ page: String(page), pageSize: "20", ...(issuer ? { issuer } : {}), ...(status ? { status } : {}) });
  const { state, reload } = useApi<PageResponse<AffiliateVoucherItem>>(`/affiliate/vouchers?${params}`);
  const done = (message: string) => {
    notify(message);
    void reload();
  };
  return (
    <>
      <div className="tieu-de">
        <h1>{t("companyTitle")}</h1>
        {can("affiliate.manage") && (
          <button type="button" className="nut chinh" onClick={() => setEditing("new")}>
            {t("createCompany")}
          </button>
        )}
      </div>
      <div className="khoi-canh-bao thong-tin">{t("inboxHint")}</div>
      <div className="bo-loc">
        <label htmlFor="loc-loai" className="an-nhan">
          {t("field_issuer")}
        </label>
        <select id="loc-loai" className="o-nhap" value={issuer} onChange={(event) => (setIssuer(event.target.value), setPage(1))}>
          <option value="">{t("allIssuers")}</option>
          {(["merchant_points", "merchant_free", "company"] as const).map((value) => (
            <option key={value} value={value}>
              {t(`issuer_${value}`)}
            </option>
          ))}
        </select>
        <label htmlFor="loc-trang-thai" className="an-nhan">
          {t("status")}
        </label>
        <select id="loc-trang-thai" className="o-nhap" value={status} onChange={(event) => (setStatus(event.target.value), setPage(1))}>
          <option value="">{t("allStatuses")}</option>
          {(["draft", "pending", "scheduled", "active", "paused", "ended", "rejected", "withdrawn"] as const).map((value) => (
            <option key={value} value={value}>
              {t(`status_${value}`)}
            </option>
          ))}
        </select>
      </div>
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
                      {["code", "title", "issuedBy", "issuer", "discount", "claimPeriod", "claimed", "used", "status"].map((key) => (
                        <th key={key}>{t(`column_${key}`)}</th>
                      ))}
                      <th />
                    </tr>
                  </thead>
                  <tbody>
                    {result.data.map((voucher) => (
                      <tr key={voucher.id}>
                        <td data-nhan={t("column_code")}>{voucher.code}</td>
                        <td data-nhan={t("column_title")}>{voucher.titleVi}</td>
                        <td data-nhan={t("column_issuedBy")}>{voucher.merchantName ?? t("issuedByCompany")}</td>
                        <td data-nhan={t("column_issuer")}>
                          {t(`issuer_${voucher.issuer}`)}
                          {voucher.pointsPrice ? ` (${t("points", { points: formatNumber(voucher.pointsPrice, 0) })})` : ""}
                        </td>
                        <td data-nhan={t("column_discount")}>{discountText(t, voucher)}</td>
                        <td data-nhan={t("column_claimPeriod")}>
                          {formatDate(voucher.claimFrom)} – {formatDate(voucher.claimTo)}
                        </td>
                        <td data-nhan={t("column_claimed")}>
                          {formatNumber(voucher.claimedCount, 0)} / {formatNumber(voucher.totalQuantity, 0)}
                        </td>
                        <td data-nhan={t("column_used")}>{formatNumber(voucher.usedCount, 0)}</td>
                        <td data-nhan={t("column_status")}>
                          <span className={`nhan ${voucherStatusClass[voucher.displayStatus]}`}>{t(`status_${voucher.displayStatus}`)}</span>
                        </td>
                        <td data-nhan="">
                          <Actions voucher={voucher} canManage={can("affiliate.manage")} onDone={done} onEdit={() => setEditing(voucher)} />
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
      {editing && (
        <CompanyVoucherForm
          voucher={editing === "new" ? null : editing}
          onClose={() => setEditing(null)}
          onSaved={(submitted) => {
            setEditing(null);
            done(t(submitted ? "done_submit" : "saved"));
          }}
        />
      )}
    </>
  );
}
