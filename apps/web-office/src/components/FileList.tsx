"use client";

// Danh sách tệp tải xuống được (công văn).
import type { OfficeFileItem } from "contracts";
import { useAdmin } from "ui/components/AppShell";
import { apiDownload } from "ui/lib/api";
import { formatDateTime } from "ui/lib/format";
import { failureOf } from "ui/lib/use-api";

export function FileList({ files, basePath }: { files: OfficeFileItem[]; basePath: string }) {
  const { notify } = useAdmin();
  return (
    <ul style={{ margin: 0, paddingLeft: "var(--khoang-5)" }}>
      {files.map((file) => (
        <li key={file.id}>
          <button type="button" className="nut chu" onClick={() => void apiDownload(`${basePath}/${file.id}`, file.fileName).catch((error) => notify(failureOf(error).message, "loi"))}>
            {file.fileName}
          </button>{" "}
          <span className="chu-thich">
            {Math.max(1, Math.round(file.sizeBytes / 1024))} KB · {file.uploadedBy.fullName} · {formatDateTime(file.createdAt)}
          </span>
        </li>
      ))}
    </ul>
  );
}
