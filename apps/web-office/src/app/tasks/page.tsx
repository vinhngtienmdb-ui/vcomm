"use client";

// MAN_HINH_153 Danh sách công việc (CHUC_NANG_182; API_184): thẻ Việc của tôi, Tôi giao, Theo dõi, Của công ty; lọc; giao việc.
import { officeTaskPriorities, type OfficeTaskListItem, type PageResponse } from "contracts";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useAdmin } from "ui/components/AppShell";
import { Loaded, MessageView } from "ui/components/StatusViews";
import { formatDateTime } from "ui/lib/format";
import { useApi } from "ui/lib/use-api";
import { PriorityText, TaskStatusBadge } from "@/components/TaskBadges";
import { TaskEditor } from "@/components/TaskEditor";

const views = ["mine", "assigned", "following", "company"] as const;
const statuses = ["open", "new", "in_progress", "pending_confirmation", "completed", "cancelled", "all"] as const;

export default function TasksPage() {
  const t = useTranslations("officeTasks");
  const common = useTranslations("common");
  const router = useRouter();
  const { can, me, notify } = useAdmin();
  const [view, setView] = useState<(typeof views)[number]>("mine");
  const [status, setStatus] = useState<(typeof statuses)[number]>("open");
  const [due, setDue] = useState("");
  const [priority, setPriority] = useState("");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [creating, setCreating] = useState(false);
  const query = new URLSearchParams({ view, status, page: String(page), ...(due ? { due } : {}), ...(priority ? { priority } : {}), ...(search.trim() ? { search: search.trim() } : {}) });
  const { state, reload } = useApi<PageResponse<OfficeTaskListItem>>(`/office/tasks?${query.toString()}`);
  const shownViews = views.filter((item) => item !== "company" || can("office.task.view_all"));
  const headings = [t("titleField"), t("company"), t("owner"), t("dueAt"), t("priority"), t("progress"), t("status")];
  return (
    <>
      <div className="tieu-de">
        <h1>{t("title")}</h1>
        <button type="button" className="nut chinh" onClick={() => setCreating(true)}>
          {t("create")}
        </button>
      </div>
      <div className="cac-the" role="tablist">
        {shownViews.map((item) => (
          <button
            key={item}
            type="button"
            role="tab"
            aria-selected={view === item}
            className={view === item ? "chon" : ""}
            onClick={() => {
              setView(item);
              setPage(1);
            }}
          >
            {t(`view_${item}`)}
          </button>
        ))}
      </div>
      <div className="bo-loc">
        <label className="an-nhan" htmlFor="task-search">
          {common("search")}
        </label>
        <input id="task-search" className="o-nhap" placeholder={t("searchPlaceholder")} value={search} onChange={(event) => (setSearch(event.target.value), setPage(1))} />
        <select className="o-nhap" aria-label={t("status")} value={status} onChange={(event) => (setStatus(event.target.value as (typeof statuses)[number]), setPage(1))}>
          {statuses.map((item) => (
            <option key={item} value={item}>
              {t(`filter_${item}`)}
            </option>
          ))}
        </select>
        <select className="o-nhap" aria-label={t("dueAt")} value={due} onChange={(event) => (setDue(event.target.value), setPage(1))}>
          <option value="">{t("dueAll")}</option>
          <option value="overdue">{t("overdue")}</option>
          <option value="today">{t("dueToday")}</option>
          <option value="week">{t("dueWeek")}</option>
        </select>
        <select className="o-nhap" aria-label={t("priority")} value={priority} onChange={(event) => (setPriority(event.target.value), setPage(1))}>
          <option value="">{t("priorityAll")}</option>
          {officeTaskPriorities.map((item) => (
            <option key={item} value={item}>
              {t(`priority_${item}`)}
            </option>
          ))}
        </select>
      </div>
      {view === "mine" && <div className="khoi-canh-bao thong-tin">{t("mineHint")}</div>}
      <Loaded state={state} onRetry={() => void reload()}>
        {(result) =>
          result.data.length === 0 ? (
            <MessageView text={t("none")} />
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
                  {result.data.map((task) => (
                    <tr key={task.id}>
                      <td data-nhan={headings[0]}>
                        <span>
                          <Link href={`/tasks/${task.id}`}>{task.title}</Link>
                          {task.parentId && <span className="chu-thich"> · {t("subtask")}</span>}
                        </span>
                      </td>
                      <td data-nhan={headings[1]}>
                        <span>{task.companyId === me.currentCompanyId ? "" : <span className="nhan trung-tinh">{task.companyName}</span>}</span>
                      </td>
                      <td data-nhan={headings[2]}>
                        <span>{task.owner?.fullName ?? t("unclaimed")}</span>
                      </td>
                      <td data-nhan={headings[3]}>
                        <span>{task.dueAt ? formatDateTime(task.dueAt) : "—"}</span>
                      </td>
                      <td data-nhan={headings[4]}>
                        <span>
                          <PriorityText priority={task.priority} />
                        </span>
                      </td>
                      <td data-nhan={headings[5]}>
                        <span>{task.progress}%</span>
                      </td>
                      <td data-nhan={headings[6]}>
                        <span>
                          <TaskStatusBadge status={task.status} overdue={task.overdue} />
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <div className="phan-trang">
                <span>{common("total", { count: result.total })}</span>
                <span className="nhom-nut">
                  <button type="button" className="nut phu" disabled={page <= 1} onClick={() => setPage(page - 1)}>
                    {common("previous")}
                  </button>
                  <button type="button" className="nut phu" disabled={page * result.pageSize >= result.total} onClick={() => setPage(page + 1)}>
                    {common("next")}
                  </button>
                </span>
              </div>
            </div>
          )
        }
      </Loaded>
      {creating && (
        <TaskEditor
          task={null}
          onClose={() => setCreating(false)}
          onSaved={(task) => {
            setCreating(false);
            notify(t("assigned"));
            router.push(`/tasks/${task.id}`);
          }}
        />
      )}
    </>
  );
}
