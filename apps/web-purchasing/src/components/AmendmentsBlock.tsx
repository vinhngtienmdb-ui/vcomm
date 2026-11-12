"use client";

// MAN_HINH_111 (sửa, CONG_VIEC_56; CHUC_NANG_199): danh sách tờ khai bổ sung của tờ khai đã ghi sổ, nút khai bổ sung cho người quản lý nhập khẩu.
import type { ImportAmendmentListItem } from "contracts";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { useAdmin } from "ui/components/AppShell";
import { formatDate, formatMoney } from "ui/lib/format";
import { useApi } from "ui/lib/use-api";
import { DeclarationStatus } from "@/components/DeclarationStatus";

export function AmendmentsBlock({ declarationId, currency }: { declarationId: string; currency: string }) {
  const t = useTranslations("importAmendments");
  const { can } = useAdmin();
  const { state } = useApi<ImportAmendmentListItem[]>(`/purchasing/import-amendments?declarationId=${declarationId}`);
  const items = state.kind === "ready" ? state.data : [];
  return (
    <section className="the" style={{ display: "grid", gap: "var(--khoang-2)" }}>
      <div className="nhom-nut">
        <strong>{t("section")}</strong>
        {can("purchasing.import.manage") && (
          <Link className="nut phu" href={`/import-amendments/new?declarationId=${declarationId}`}>
            {t("add")}
          </Link>
        )}
      </div>
      {items.length === 0 ? (
        <span className="chu-thich">{t("none")}</span>
      ) : (
        <ul style={{ margin: 0, paddingInlineStart: "var(--khoang-4)" }}>
          {items.map((item) => (
            <li key={item.id}>
              <Link href={`/import-amendments/${item.id}`}>{item.amendmentNo}</Link> · {formatDate(item.registeredOn)} · <DeclarationStatus status={item.status} />
              {/* Chênh lệch chốt khi ghi sổ. */}
              {item.status === "posted" && ` · ${t("difference")} ${formatMoney(item.totalDifference, currency)}`}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
