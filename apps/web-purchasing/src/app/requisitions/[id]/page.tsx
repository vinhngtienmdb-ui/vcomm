"use client";

// MAN_HINH_39 Chi tiết đề nghị mua (CHUC_NANG_50; API_74): dòng hàng, đã đặt; sửa, gửi duyệt, rút, đóng, lập đơn mua.
import type { RequisitionResponse } from "contracts";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useState } from "react";
import { useAdmin } from "ui/components/AppShell";
import { HistoryLink } from "ui/components/HistoryLink";
import { Loaded } from "ui/components/StatusViews";
import { apiFetch } from "ui/lib/api";
import { formatDate, formatMoney, formatNumber } from "ui/lib/format";
import { failureOf, useApi } from "ui/lib/use-api";
import { itemLabel } from "@/components/ItemPicker";
import { PurchaseStatus } from "@/components/PurchaseStatus";
import { RequisitionDrawer } from "@/components/RequisitionDrawer";

export default function RequisitionPage() {
  const t = useTranslations("requisitions");
  const { id } = useParams<{ id: string }>();
  const { state, reload } = useApi<RequisitionResponse>(`/purchasing/requisitions/${id}`);
  return (
    <>
      <div>
        <Link href="/requisitions">‹ {t("back")}</Link>
      </div>
      <Loaded state={state} onRetry={() => void reload()}>
        {(requisition) => <Detail requisition={requisition} reload={reload} />}
      </Loaded>
    </>
  );
}

function Detail({ requisition, reload }: { requisition: RequisitionResponse; reload: () => Promise<void> }) {
  const t = useTranslations("requisitions");
  const common = useTranslations("common");
  const router = useRouter();
  const { notify } = useAdmin();
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState(false);

  async function act(path: string, body?: unknown) {
    setBusy(true);
    try {
      await apiFetch(`/purchasing/requisitions/${requisition.id}/${path}`, { method: "POST", ...(body ? { body: JSON.stringify(body) } : {}) });
      notify(t("saved"));
      await reload();
    } catch (error) {
      notify(failureOf(error).message, "loi");
    } finally {
      setBusy(false);
    }
  }

  const headings = [t("item"), t("unit"), t("quantity"), t("estimatedUnitPrice"), t("suggestedSupplier"), t("ordered")];
  return (
    <>
      <div className="tieu-de">
        <h1>{requisition.documentNo ?? t("draftNo")}</h1>
        <PurchaseStatus status={requisition.status} />
        <HistoryLink entityId={requisition.id} />
        {requisition.canEdit && (
          <button type="button" className="nut phu" onClick={() => setEditing(true)}>
            {t("edit")}
          </button>
        )}
        {requisition.canEdit && requisition.status === "draft" && (
          <button type="button" className="nut chinh" disabled={busy} onClick={() => void act("submit")}>
            {t("submit")}
          </button>
        )}
        {requisition.canWithdraw && (
          <button type="button" className="nut phu" disabled={busy} onClick={() => void act("withdraw")}>
            {t("withdraw")}
          </button>
        )}
        {requisition.canOrder && (
          <>
            <button type="button" className="nut phu" disabled={busy} onClick={() => void act("close", { version: requisition.version })}>
              {t("close")}
            </button>
            <button type="button" className="nut chinh" onClick={() => router.push(`/orders/new?requisitionId=${requisition.id}`)}>
              {t("createOrder")}
            </button>
          </>
        )}
      </div>
      <section className="the">
        <div className="chu-thich">
          {t("warehouse")}: {requisition.warehouseName} · {t("neededBy")}: {formatDate(requisition.neededBy)} · {t("createdBy")}: {requisition.createdByName}
        </div>
        <div>{requisition.reason}</div>
        <strong>
          {t("estimatedTotal")}: {formatMoney(requisition.estimatedTotal, "VND")}
        </strong>
      </section>
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
            {requisition.lines.map((line) => (
              <tr key={line.id}>
                <td data-nhan={headings[0]}>
                  <span>{itemLabel(line)}</span>
                </td>
                <td data-nhan={headings[1]}>
                  <span>{line.unitName}</span>
                </td>
                <td data-nhan={headings[2]}>
                  <span>{formatNumber(line.quantity)}</span>
                </td>
                <td data-nhan={headings[3]}>
                  <span>{formatMoney(line.estimatedUnitPrice, "VND")}</span>
                </td>
                <td data-nhan={headings[4]}>
                  <span>{line.suggestedSupplierName ?? common("none")}</span>
                </td>
                <td data-nhan={headings[5]}>
                  <span>
                    {formatNumber(line.orderedBaseQuantity)} / {formatNumber(line.baseQuantity)} <span className="chu-thich">{t("baseUnit")}</span>
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {editing && (
        <RequisitionDrawer
          requisition={requisition}
          onClose={() => setEditing(false)}
          onSaved={() => {
            setEditing(false);
            notify(t("saved"));
            void reload();
          }}
        />
      )}
    </>
  );
}
