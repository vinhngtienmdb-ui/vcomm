"use client";

// MAN_HINH_302 Cài đặt bán hàng (chủ cửa hàng; CONG_VIEC_74; QUYTAC_NGHIEPVU_611, 613, 615, 619, 620; API_352).
// Mã điểm bán dùng trong số hóa đơn; tài khoản nhận VietQR; giảm giá tối đa của thu ngân; trả hàng; chặn tồn âm; mẫu in.
import type { IposPortalAccess, IposSettingsPage } from "contracts";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { Field, FormError, useSubmit } from "ui/components/Form";
import { Loaded, MessageView } from "ui/components/StatusViews";
import { usePortal } from "@/components/PortalShell";
import { portalFetch, usePortalApi } from "@/lib/portal-api";

function OutletCodes({ page, onSaved }: { page: IposSettingsPage; onSaved: (page: IposSettingsPage) => void }) {
  const t = useTranslations("iposPortal");
  const { notify } = usePortal();
  const [codes, setCodes] = useState<Record<string, string>>(() => Object.fromEntries(page.outlets.map((outlet) => [outlet.id, outlet.code ?? ""])));
  const [saving, setSaving] = useState<string | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const { run } = useSubmit();
  return (
    <section className="the" style={{ display: "grid", gap: "var(--khoang-3)" }}>
      <h2 style={{ margin: 0 }}>{t("outletCodes")}</h2>
      <p className="chu-thich" style={{ margin: 0 }}>
        {t("outletCodesHint")}
      </p>
      <div className="khung-bang">
        <table>
          <thead>
            <tr>
              <th>{t("outlet")}</th>
              <th>{t("outletCode")}</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {page.outlets.map((outlet) => (
              <tr key={outlet.id}>
                <td data-nhan={t("outlet")}>
                  {outlet.name}
                  {!outlet.subscribed && <span className="chu-thich"> · {t("noIposSubscription")}</span>}
                </td>
                <td data-nhan={t("outletCode")}>
                  <input
                    className={`o-nhap${errors[outlet.id] ? " loi" : ""}`}
                    aria-label={`${t("outletCode")} ${outlet.name}`}
                    maxLength={10}
                    value={codes[outlet.id] ?? ""}
                    onChange={(event) => setCodes((current) => ({ ...current, [outlet.id]: event.target.value.toUpperCase().replace(/[^A-Z0-9]/g, "") }))}
                  />
                  {errors[outlet.id] && <span className="loi-o">{errors[outlet.id]}</span>}
                </td>
                <td>
                  <button
                    type="button"
                    className={`nut phu${saving === outlet.id ? " dang-xu-ly" : ""}`}
                    disabled={saving !== null || (codes[outlet.id] ?? "") === (outlet.code ?? "") || (codes[outlet.id] ?? "").length < 2}
                    onClick={() => {
                      setSaving(outlet.id);
                      void run(async () => {
                        try {
                          const saved = await portalFetch<IposSettingsPage>(`/merchant-portal/ipos/outlets/${outlet.id}/code`, { method: "PUT", body: JSON.stringify({ code: codes[outlet.id] }) });
                          setErrors((current) => ({ ...current, [outlet.id]: "" }));
                          notify(t("outletCodeSaved"));
                          onSaved(saved);
                        } catch (error) {
                          setErrors((current) => ({ ...current, [outlet.id]: error instanceof Error ? error.message : "" }));
                        } finally {
                          setSaving(null);
                        }
                      });
                    }}
                  >
                    {t("save")}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function SettingsForm({ page, onSaved }: { page: IposSettingsPage; onSaved: (page: IposSettingsPage) => void }) {
  const t = useTranslations("iposPortal");
  const { notify } = usePortal();
  const { submitting, fields, formError, run, inputClass } = useSubmit();
  const initial = page.settings;
  const [bankBin, setBankBin] = useState(initial.vietqrBankBin ?? "");
  const [accountNo, setAccountNo] = useState(initial.vietqrAccountNo ?? "");
  const [accountName, setAccountName] = useState(initial.vietqrAccountName ?? "");
  const [maxDiscount, setMaxDiscount] = useState(initial.cashierMaxDiscountPercent);
  const [returnDays, setReturnDays] = useState(String(initial.returnDays));
  const [cashierCanReturn, setCashierCanReturn] = useState(initial.cashierCanReturn);
  const [blockNegative, setBlockNegative] = useState(initial.blockNegativeStock);
  const [footer, setFooter] = useState(initial.receiptFooter ?? "");
  const [paperWidth, setPaperWidth] = useState<58 | 80>(initial.paperWidth);
  return (
    <form
      className="the"
      style={{ display: "grid", gap: "var(--khoang-3)" }}
      onSubmit={(event) => {
        event.preventDefault();
        void run(async () => {
          const saved = await portalFetch<IposSettingsPage>("/merchant-portal/ipos/settings", {
            method: "PUT",
            body: JSON.stringify({
              vietqrBankBin: bankBin || null,
              vietqrAccountNo: accountNo || null,
              vietqrAccountName: accountName || null,
              cashierMaxDiscountPercent: maxDiscount,
              returnDays: Number(returnDays) || 0,
              cashierCanReturn,
              blockNegativeStock: blockNegative,
              receiptFooter: footer || null,
              paperWidth,
              version: initial.version,
            }),
          });
          notify(t("settingsSaved"));
          onSaved(saved);
        });
      }}
    >
      <h2 style={{ margin: 0 }}>{t("vietqrAccount")}</h2>
      <p className="chu-thich" style={{ margin: 0 }}>
        {t("vietqrAccountHint")}
      </p>
      <div className="luoi-so">
        <Field id="cd-ngan-hang" label={t("bankBin")} error={fields.vietqrBankBin} hint={t("bankBinHint")}>
          <input id="cd-ngan-hang" className={inputClass("vietqrBankBin")} inputMode="numeric" maxLength={6} value={bankBin} onChange={(event) => setBankBin(event.target.value.replace(/\D/g, ""))} />
        </Field>
        <Field id="cd-so-tai-khoan" label={t("accountNo")} error={fields.vietqrAccountNo}>
          <input id="cd-so-tai-khoan" className={inputClass("vietqrAccountNo")} maxLength={19} value={accountNo} onChange={(event) => setAccountNo(event.target.value.replace(/[^0-9A-Za-z]/g, ""))} />
        </Field>
        <Field id="cd-ten-tai-khoan" label={t("accountName")} error={fields.vietqrAccountName}>
          <input id="cd-ten-tai-khoan" className={inputClass("vietqrAccountName")} maxLength={50} value={accountName} onChange={(event) => setAccountName(event.target.value.toUpperCase())} />
        </Field>
      </div>
      <h2 style={{ margin: 0 }}>{t("sellingRules")}</h2>
      <div className="luoi-so">
        <Field id="cd-giam-toi-da" label={t("cashierMaxDiscount")} error={fields.cashierMaxDiscountPercent} hint={t("cashierMaxDiscountHint")}>
          <input id="cd-giam-toi-da" className={inputClass("cashierMaxDiscountPercent")} inputMode="decimal" value={maxDiscount} onChange={(event) => setMaxDiscount(event.target.value.replace(/[^\d.,]/g, ""))} />
        </Field>
        <Field id="cd-ngay-tra" label={t("returnDays")} error={fields.returnDays}>
          <input id="cd-ngay-tra" className={inputClass("returnDays")} inputMode="numeric" value={returnDays} onChange={(event) => setReturnDays(event.target.value.replace(/\D/g, ""))} />
        </Field>
      </div>
      <label>
        <input type="checkbox" checked={cashierCanReturn} onChange={(event) => setCashierCanReturn(event.target.checked)} /> {t("cashierCanReturn")}
      </label>
      <label>
        <input type="checkbox" checked={blockNegative} onChange={(event) => setBlockNegative(event.target.checked)} /> {t("blockNegativeStock")}
      </label>
      <p className="chu-thich" style={{ margin: 0 }}>
        {t("blockNegativeHint")}
      </p>
      <h2 style={{ margin: 0 }}>{t("receiptTemplate")}</h2>
      <div className="luoi-so">
        <Field id="cd-kho-giay" label={t("paperWidth")}>
          <select id="cd-kho-giay" className="o-nhap" value={paperWidth} onChange={(event) => setPaperWidth(Number(event.target.value) as 58 | 80)}>
            <option value={80}>80 mm</option>
            <option value={58}>58 mm</option>
          </select>
        </Field>
      </div>
      <Field id="cd-loi-chao" label={t("receiptFooter")} error={fields.receiptFooter} hint={t("receiptFooterHint")}>
        <textarea id="cd-loi-chao" className={inputClass("receiptFooter")} rows={2} maxLength={200} value={footer} onChange={(event) => setFooter(event.target.value)} />
      </Field>
      <FormError text={formError} />
      <div className="nhom-nut">
        <button type="submit" className={`nut chinh${submitting ? " dang-xu-ly" : ""}`} disabled={submitting}>
          {t("save")}
        </button>
      </div>
    </form>
  );
}

export default function IposSettingsPageView() {
  const t = useTranslations("iposPortal");
  const access = usePortalApi<IposPortalAccess>("/merchant-portal/ipos/access");
  const { state, reload } = usePortalApi<IposSettingsPage>("/merchant-portal/ipos/settings");
  const [version, setVersion] = useState(0);
  return (
    <Loaded state={access.state} onRetry={() => void access.reload()}>
      {(info) =>
        !info.enabled ? (
          <MessageView text={t("notSubscribed")} />
        ) : (
          <>
            <div className="tieu-de">
              <h1>{t("settingsTitle")}</h1>
            </div>
            <Loaded state={state} onRetry={() => void reload()}>
              {(page) => (
                <div style={{ display: "grid", gap: "var(--khoang-4)" }}>
                  <OutletCodes
                    key={`ma-${version}`}
                    page={page}
                    onSaved={() => {
                      setVersion((current) => current + 1);
                      void reload();
                    }}
                  />
                  <SettingsForm
                    key={`cd-${page.settings.version ?? 0}-${version}`}
                    page={page}
                    onSaved={() => {
                      setVersion((current) => current + 1);
                      void reload();
                    }}
                  />
                </div>
              )}
            </Loaded>
          </>
        )
      }
    </Loaded>
  );
}
