"use client";

// Nút xuất Excel: tải tệp cùng bộ lọc đang xem; lỗi (ví dụ quá 20.000 dòng) hiện thông báo nổi.
import { useTranslations } from "next-intl";
import { useState } from "react";
import { useAdmin } from "ui/components/AppShell";
import { apiDownload } from "ui/lib/api";
import { failureOf } from "ui/lib/use-api";

export function ExportButton({ path, fileName }: { path: string; fileName: string }) {
  const t = useTranslations("analytics");
  const { notify } = useAdmin();
  const [busy, setBusy] = useState(false);
  return (
    <button
      type="button"
      className={`nut phu${busy ? " dang-xu-ly" : ""}`}
      disabled={busy}
      onClick={async () => {
        setBusy(true);
        try {
          await apiDownload(path, fileName);
          notify(t("exported", { fileName }));
        } catch (error) {
          notify(failureOf(error).message, "loi");
        } finally {
          setBusy(false);
        }
      }}
    >
      {t("export")}
    </button>
  );
}
