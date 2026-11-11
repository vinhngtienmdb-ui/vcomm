"use client";

// Số giấy tờ dạng che kèm nút "Hiện" (QUYTAC_NGHIEPVU_295): giá trị đầy đủ chỉ giữ trong bộ nhớ của trang, mỗi lần hiện máy chủ ghi nhật ký.
import type { RevealField, RevealResponse } from "contracts";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { useAdmin } from "ui/components/AppShell";
import { apiFetch } from "ui/lib/api";
import { failureOf } from "ui/lib/use-api";

export function RevealValue({ masked, field, path, allowed }: { masked: string | null; field: RevealField; path: string; allowed: boolean }) {
  const t = useTranslations("hr");
  const { notify } = useAdmin();
  const [value, setValue] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  if (masked === null) return <>—</>;
  if (value !== null) return <>{value}</>;
  return (
    <span className="nhom-nut">
      <span>{masked}</span>
      {allowed && (
        <button
          type="button"
          className={`nut phu${busy ? " dang-xu-ly" : ""}`}
          style={{ minHeight: 0, padding: "0 var(--khoang-2)" }}
          disabled={busy}
          onClick={() => {
            setBusy(true);
            apiFetch<RevealResponse>(path, { method: "POST", body: JSON.stringify({ field }) })
              .then((result) => {
                setValue(result.value ?? "—");
                notify(t("revealed"));
              })
              .catch((error: unknown) => notify(failureOf(error).message, "loi"))
              .finally(() => setBusy(false));
          }}
        >
          {t("reveal")}
        </button>
      )}
    </span>
  );
}
