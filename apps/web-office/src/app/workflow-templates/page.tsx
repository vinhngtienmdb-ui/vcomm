"use client";

// MAN_HINH_155 Mẫu quy trình, danh sách (CHUC_NANG_183; API_186): tên, phiên bản đang dùng, phiên đang chạy, trạng thái; thêm mẫu.
import type { WorkflowTemplateListItem, WorkflowTemplateResponse } from "contracts";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useAdmin } from "ui/components/AppShell";
import { Loaded, MessageView } from "ui/components/StatusViews";
import { apiFetch } from "ui/lib/api";
import { failureOf, useApi } from "ui/lib/use-api";

const statusTone = { draft: "trung-tinh", active: "thanh-cong", inactive: "canh-bao" } as const;

export default function WorkflowTemplatesPage() {
  const t = useTranslations("officeWorkflows");
  const router = useRouter();
  const { notify } = useAdmin();
  const { state, reload } = useApi<WorkflowTemplateListItem[]>("/office/workflow-templates");
  const [busy, setBusy] = useState(false);
  const headings = [t("templateName"), t("activeVersion"), t("runningCount"), t("status")];
  // Mẫu mới có một bước do người khởi tạo làm; người thiết kế sửa tiếp ở trình thiết kế.
  const create = async () => {
    setBusy(true);
    try {
      const created = await apiFetch<WorkflowTemplateResponse>("/office/workflow-templates", {
        method: "POST",
        body: JSON.stringify({
          name: t("newTemplateName"),
          definition: {
            fields: [],
            firstStepKey: "buoc_1",
            steps: [{ key: "buoc_1", name: t("newStepName"), days: 1, assignee: { type: "initiator" }, outcomes: [t("defaultOutcome")], otherwise: ["end"] }],
          },
        }),
      });
      router.push(`/workflow-templates/${created.id}`);
    } catch (error) {
      notify(failureOf(error).message, "loi");
      setBusy(false);
    }
  };
  return (
    <>
      <div className="tieu-de">
        <h1>{t("templatesTitle")}</h1>
        <button type="button" className={`nut chinh${busy ? " dang-xu-ly" : ""}`} disabled={busy} onClick={() => void create()}>
          {t("createTemplate")}
        </button>
      </div>
      <Loaded state={state} onRetry={() => void reload()}>
        {(templates) =>
          templates.length === 0 ? (
            <MessageView text={t("noTemplates")} />
          ) : (
            <div className="khung-bang">
              <table>
                <thead>
                  <tr>
                    {headings.map((heading) => (
                      <th key={heading} scope="col">
                        {heading}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {templates.map((template) => (
                    <tr key={template.id}>
                      <td data-nhan={headings[0]}>
                        <Link href={`/workflow-templates/${template.id}`}>{template.name}</Link>
                      </td>
                      <td data-nhan={headings[1]}>
                        <span>
                          {template.activeVersionNo ?? "—"}
                          {template.hasDraft && <span className="chu-thich"> · {t("hasDraft")}</span>}
                        </span>
                      </td>
                      <td data-nhan={headings[2]}>
                        <span>{template.runningCount}</span>
                      </td>
                      <td data-nhan={headings[3]}>
                        <span className={`nhan ${statusTone[template.status]}`}>{t(`templateStatus_${template.status}`)}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )
        }
      </Loaded>
    </>
  );
}
