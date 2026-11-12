"use client";

// MAN_HINH_175 Voucher của cửa hàng (chủ cửa hàng; CONG_VIEC_55; CHUC_NANG_195; API_210): danh sách theo trạng thái, tạo, sửa, gửi duyệt, rút, tạm dừng, tiếp tục.
import type { AffiliateVoucherItem, PageResponse } from "contracts";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { FormError, useSubmit } from "ui/components/Form";
import { Loaded, MessageView } from "ui/components/StatusViews";
import { formatDate, formatNumber } from "ui/lib/format";
import { usePortal } from "@/components/PortalShell";
import { VoucherForm } from "@/components/VoucherForm";
import { discountText, voucherStatusClass } from "ui/lib/affiliate-voucher";
import { portalFetch, usePortalApi } from "@/lib/portal-api";

function Actions({ voucher, onDone, onEdit }: { voucher: AffiliateVoucherItem; onDone: (message: string) => void; onEdit: () => void }) {
  const t = useTranslations("affiliateVoucher");
  const { submitting, formError, run } = useSubmit();
  const act = (action: string) =>
    void run(async () => {
      await portalFetch(`/merchant-portal/vouchers/${voucher.id}/${action}`, { method: "POST", body: JSON.stringify({ version: voucher.version }) });
      onDone(t(`done_${action}`));
    });
  const editable = ["draft", "rejected", "withdrawn"].includes(voucher.status);
  return (
    <span className="nhom-nut">
      {editable && (
        <>
          <button type="button" className="nut phu" onClick={onEdit}>
            {t("edit")}
          </button>
          <button type="button" className="nut chinh" disabled={submitting} onClick={() => act("submit")}>
            {t("submit")}
          </button>
        </>
      )}
      {voucher.status === "pending" && (
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

export default function VouchersPage() {
  const t = useTranslations("affiliateVoucher");
  const { notify } = usePortal();
  const [status, setStatus] = useState("");
  const [editing, setEditing] = useState<AffiliateVoucherItem | "new" | null>(null);
  const { state, reload } = usePortalApi<PageResponse<AffiliateVoucherItem>>(`/merchant-portal/vouchers?pageSize=100${status ? `&status=${status}` : ""}`);
  const done = (message: string) => {
    notify(message);
    void reload();
  };
  return (
    <>
      <div className="tieu-de">
        <h1>{t("merchantTitle")}</h1>
        <button type="button" className="nut chinh" onClick={() => setEditing("new")}>
          {t("create")}
        </button>
      </div>
      <div className="bo-loc">
        <label htmlFor="loc-trang-thai" className="an-nhan">
          {t("status")}
        </label>
        <select id="loc-trang-thai" className="o-nhap" value={status} onChange={(event) => setStatus(event.target.value)}>
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
            <div className="khung-bang">
              <table>
                <thead>
                  <tr>
                    {["code", "title", "issuer", "discount", "claimPeriod", "claimed", "used", "status"].map((key) => (
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
                        <Actions voucher={voucher} onDone={done} onEdit={() => setEditing(voucher)} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )
        }
      </Loaded>
      {editing && (
        <VoucherForm
          voucher={editing === "new" ? null : editing}
          onClose={() => setEditing(null)}
          onSaved={(_saved, submitted) => {
            setEditing(null);
            done(t(submitted ? "done_submit" : "saved"));
          }}
        />
      )}
    </>
  );
}
