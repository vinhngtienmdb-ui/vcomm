"use client";

// MAN_HINH_154 Chi tiết công việc (CHUC_NANG_182; API_184, API_185): thao tác theo trạng thái, việc con, trao đổi, tệp, lịch sử.
import type { OfficeFileItem, OfficeTaskAction, OfficeTaskComment, OfficeTaskEvent, OfficeTaskResponse } from "contracts";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useState } from "react";
import { useAdmin } from "ui/components/AppShell";
import { Drawer } from "ui/components/Dialogs";
import { Field, FormError, useSubmit } from "ui/components/Form";
import { Loaded, MessageView } from "ui/components/StatusViews";
import { apiDownload, apiFetch, apiUpload } from "ui/lib/api";
import { formatDate, formatDateTime } from "ui/lib/format";
import { failureOf, useApi } from "ui/lib/use-api";
import { personLabel } from "@/components/PersonPicker";
import { PriorityText, TaskStatusBadge } from "@/components/TaskBadges";
import { TaskEditor } from "@/components/TaskEditor";

const tabs = ["comments", "children", "files", "history"] as const;

export default function TaskDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { state, reload } = useApi<OfficeTaskResponse>(`/office/tasks/${id}`);
  return (
    <Loaded state={state} onRetry={() => void reload()}>
      {(task) => <TaskDetail task={task} onChanged={() => void reload()} key={task.version} />}
    </Loaded>
  );
}

function TaskDetail({ task, onChanged }: { task: OfficeTaskResponse; onChanged: () => void }) {
  const t = useTranslations("officeTasks");
  const common = useTranslations("common");
  const { notify } = useAdmin();
  const [tab, setTab] = useState<(typeof tabs)[number]>("comments");
  const [editing, setEditing] = useState(false);
  const [addingChild, setAddingChild] = useState(false);
  const [reasonFor, setReasonFor] = useState<"return" | "cancel" | null>(null);
  const [progressOpen, setProgressOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const allowed = new Set(task.allowedActions);
  const transition = async (action: OfficeTaskAction, reason?: string) => {
    setBusy(true);
    try {
      await apiFetch(`/office/tasks/${task.id}/transition`, { method: "POST", body: JSON.stringify({ action, version: task.version, ...(reason ? { reason } : {}) }) });
      notify(t(`done_${action}`));
      onChanged();
    } catch (error) {
      notify(failureOf(error).message, "loi");
    } finally {
      setBusy(false);
    }
  };
  const actionButton = (action: OfficeTaskAction, tone: string) =>
    allowed.has(action) && (
      <button type="button" className={`nut ${tone}`} disabled={busy} onClick={() => (action === "return" || action === "cancel" ? setReasonFor(action) : void transition(action))}>
        {t(`action_${action}`)}
      </button>
    );
  return (
    <>
      <div className="tieu-de">
        <h1>
          {task.title} <TaskStatusBadge status={task.status} overdue={task.overdue} />
        </h1>
        <div className="nhom-nut">
          {actionButton("start", "chinh")}
          {actionButton("report_done", "chinh")}
          {actionButton("confirm", "chinh")}
          {actionButton("return", "phu")}
          {allowed.has("progress") && (
            <button type="button" className="nut phu" onClick={() => setProgressOpen(true)}>
              {t("updateProgress")}
            </button>
          )}
          {allowed.has("edit") && (
            <button type="button" className="nut phu" onClick={() => setEditing(true)}>
              {t("edit")}
            </button>
          )}
          {actionButton("cancel", "nguy-hiem")}
        </div>
      </div>
      {task.statusReason && task.status !== "completed" && <div className="khoi-canh-bao canh-bao">{t("reasonShown", { reason: task.statusReason })}</div>}
      <div className="the">
        <dl className="thong-tin-dong">
          <dt>{t("company")}</dt>
          <dd>{task.companyName}</dd>
          <dt>{t("assignedBy")}</dt>
          <dd>{personLabel(task.assignedBy)}</dd>
          <dt>{t("owner")}</dt>
          <dd>{task.owner ? personLabel(task.owner) : t("unclaimed")}</dd>
          <dt>{t("collaborators")}</dt>
          <dd>{task.collaborators.map(personLabel).join("; ") || "—"}</dd>
          <dt>{t("followers")}</dt>
          <dd>{task.followers.map(personLabel).join("; ") || "—"}</dd>
          <dt>{t("startDate")}</dt>
          <dd>{formatDate(task.startDate)}</dd>
          <dt>{t("dueAt")}</dt>
          <dd>{task.dueAt ? formatDateTime(task.dueAt) : "—"}</dd>
          <dt>{t("priority")}</dt>
          <dd>
            <PriorityText priority={task.priority} />
          </dd>
          <dt>{t("progress")}</dt>
          <dd>{task.progress}%</dd>
          {task.parentId && (
            <>
              <dt>{t("parent")}</dt>
              <dd>
                <Link href={`/tasks/${task.parentId}`}>{t("openParent")}</Link>
              </dd>
            </>
          )}
        </dl>
        {task.description && <p style={{ whiteSpace: "pre-wrap", marginBottom: 0 }}>{task.description}</p>}
      </div>
      <div className="cac-the" role="tablist">
        {tabs
          .filter((item) => item !== "children" || task.parentId === null)
          .map((item) => (
            <button key={item} type="button" role="tab" aria-selected={tab === item} className={tab === item ? "chon" : ""} onClick={() => setTab(item)}>
              {t(`tab_${item}`)}
            </button>
          ))}
      </div>
      {tab === "comments" && <Comments task={task} />}
      {tab === "children" && (
        <div className="the">
          <div className="tieu-de">
            <h2>{t("tab_children")}</h2>
            {allowed.has("add_child") && (
              <button type="button" className="nut phu" onClick={() => setAddingChild(true)}>
                {t("addChild")}
              </button>
            )}
          </div>
          {task.children.length === 0 ? (
            <p className="chu-thich">{t("noChildren")}</p>
          ) : (
            <ul style={{ margin: 0, paddingLeft: "var(--khoang-5)" }}>
              {task.children.map((child) => (
                <li key={child.id}>
                  <Link href={`/tasks/${child.id}`}>{child.title}</Link> · {child.owner?.fullName ?? t("unclaimed")} · {child.dueAt ? formatDateTime(child.dueAt) : "—"}{" "}
                  <TaskStatusBadge status={child.status} overdue={child.overdue} />
                </li>
              ))}
            </ul>
          )}
          <span className="chu-thich">{t("childrenHint")}</span>
        </div>
      )}
      {tab === "files" && <Files task={task} />}
      {tab === "history" && <History task={task} />}
      {editing && (
        <TaskEditor
          task={task}
          onClose={() => setEditing(false)}
          onSaved={() => {
            setEditing(false);
            notify(common("saved"));
            onChanged();
          }}
        />
      )}
      {addingChild && (
        <TaskEditor
          task={null}
          parentId={task.id}
          onClose={() => setAddingChild(false)}
          onSaved={() => {
            setAddingChild(false);
            notify(t("assigned"));
            onChanged();
          }}
        />
      )}
      {reasonFor && <ReasonDrawer action={reasonFor} onClose={() => setReasonFor(null)} onConfirm={(reason) => (setReasonFor(null), void transition(reasonFor, reason))} />}
      {progressOpen && <ProgressDrawer task={task} onClose={() => setProgressOpen(false)} onSaved={() => (setProgressOpen(false), onChanged())} />}
    </>
  );
}

function ReasonDrawer({ action, onClose, onConfirm }: { action: "return" | "cancel"; onClose: () => void; onConfirm: (reason: string) => void }) {
  const t = useTranslations("officeTasks");
  const common = useTranslations("common");
  const [reason, setReason] = useState("");
  return (
    <Drawer title={t(`action_${action}`)} onClose={onClose}>
      <Field id="task-reason" label={t("reason")}>
        <textarea id="task-reason" className="o-nhap" rows={3} maxLength={1000} value={reason} onChange={(event) => setReason(event.target.value)} />
      </Field>
      <div className="nhom-nut">
        <button type="button" className="nut phu" onClick={onClose}>
          {common("cancel")}
        </button>
        <button type="button" className="nut chinh" disabled={!reason.trim()} onClick={() => onConfirm(reason.trim())}>
          {common("confirm")}
        </button>
      </div>
    </Drawer>
  );
}

function ProgressDrawer({ task, onClose, onSaved }: { task: OfficeTaskResponse; onClose: () => void; onSaved: () => void }) {
  const t = useTranslations("officeTasks");
  const common = useTranslations("common");
  const { submitting, formError, run } = useSubmit();
  const [progress, setProgress] = useState(String(task.progress));
  return (
    <Drawer title={t("updateProgress")} onClose={onClose}>
      <FormError text={formError} />
      <Field id="task-progress" label={t("progressPercent")}>
        <input id="task-progress" type="number" min={0} max={100} className="o-nhap" value={progress} onChange={(event) => setProgress(event.target.value)} />
      </Field>
      <div className="nhom-nut">
        <button type="button" className="nut phu" onClick={onClose}>
          {common("cancel")}
        </button>
        <button
          type="button"
          className={`nut chinh${submitting ? " dang-xu-ly" : ""}`}
          disabled={submitting}
          onClick={() =>
            void run(async () => {
              await apiFetch(`/office/tasks/${task.id}/progress`, { method: "POST", body: JSON.stringify({ progress: Number(progress), version: task.version }) });
              onSaved();
            })
          }
        >
          {common("save")}
        </button>
      </div>
    </Drawer>
  );
}

function Comments({ task }: { task: OfficeTaskResponse }) {
  const t = useTranslations("officeTasks");
  const { state, reload } = useApi<OfficeTaskComment[]>(`/office/tasks/${task.id}/comments`);
  const { notify } = useAdmin();
  const [body, setBody] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editBody, setEditBody] = useState("");
  const send = async (method: "POST" | "PATCH" | "DELETE", path: string, payload?: unknown) => {
    try {
      await apiFetch(path, { method, ...(payload ? { body: JSON.stringify(payload) } : {}) });
      await reload();
      return true;
    } catch (error) {
      notify(failureOf(error).message, "loi");
      return false;
    }
  };
  return (
    <div className="the">
      <Loaded state={state} onRetry={() => void reload()}>
        {(comments) =>
          comments.length === 0 ? (
            <p className="chu-thich">{t("noComments")}</p>
          ) : (
            <ol className="dong-thoi-gian">
              {comments.map((comment) => (
                <li key={comment.id} className="xong">
                  <span className="cham">{comment.author.fullName.slice(0, 1)}</span>
                  <div>
                    <strong>
                      {comment.author.fullName} · {formatDateTime(comment.createdAt)}
                    </strong>
                    {comment.editedAt && <span className="chu-thich"> {t("edited")}</span>}
                    {comment.deleted ? (
                      <div className="chu-thich">{t("commentDeleted")}</div>
                    ) : editingId === comment.id ? (
                      <div>
                        <label className="an-nhan" htmlFor={`edit-${comment.id}`}>
                          {t("comment")}
                        </label>
                        <textarea id={`edit-${comment.id}`} className="o-nhap" rows={2} value={editBody} onChange={(event) => setEditBody(event.target.value)} />
                        <div className="nhom-nut">
                          <button type="button" className="nut phu" onClick={() => setEditingId(null)}>
                            {t("cancelEdit")}
                          </button>
                          <button
                            type="button"
                            className="nut chinh"
                            disabled={!editBody.trim()}
                            onClick={() => void send("PATCH", `/office/tasks/${task.id}/comments/${comment.id}`, { body: editBody.trim() }).then((ok) => ok && setEditingId(null))}
                          >
                            {t("saveComment")}
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div style={{ whiteSpace: "pre-wrap" }}>{comment.body}</div>
                    )}
                    {comment.canEdit && editingId !== comment.id && (
                      <div className="nhom-nut">
                        <button type="button" className="nut chu" onClick={() => (setEditingId(comment.id), setEditBody(comment.body ?? ""))}>
                          {t("editComment")}
                        </button>
                        <button type="button" className="nut chu" onClick={() => void send("DELETE", `/office/tasks/${task.id}/comments/${comment.id}`)}>
                          {t("deleteComment")}
                        </button>
                      </div>
                    )}
                  </div>
                </li>
              ))}
            </ol>
          )
        }
      </Loaded>
      {task.status !== "cancelled" && (
        <>
          <Field id="new-comment" label={t("writeComment")}>
            <textarea id="new-comment" className="o-nhap" rows={2} maxLength={5000} value={body} onChange={(event) => setBody(event.target.value)} />
          </Field>
          <div className="nhom-nut">
            <button
              type="button"
              className="nut chinh"
              disabled={!body.trim()}
              onClick={() => void send("POST", `/office/tasks/${task.id}/comments`, { body: body.trim() }).then((ok) => ok && setBody(""))}
            >
              {t("send")}
            </button>
          </div>
        </>
      )}
    </div>
  );
}

function Files({ task }: { task: OfficeTaskResponse }) {
  const t = useTranslations("officeTasks");
  const { state, reload } = useApi<OfficeFileItem[]>(`/office/tasks/${task.id}/files`);
  const { notify } = useAdmin();
  const [uploading, setUploading] = useState(false);
  const closed = task.status === "completed" || task.status === "cancelled";
  const upload = async (file: File | undefined) => {
    if (!file) return;
    const form = new FormData();
    form.append("file", file);
    setUploading(true);
    try {
      await apiUpload(`/office/tasks/${task.id}/files`, form);
      notify(t("fileUploaded"));
      await reload();
    } catch (error) {
      const failure = failureOf(error);
      notify(failure.fields.file ?? failure.message, "loi");
    } finally {
      setUploading(false);
    }
  };
  return (
    <div className="the">
      <div className="tieu-de">
        <h2>{t("tab_files")}</h2>
        {!closed && (
          <label className={`nut phu${uploading ? " dang-xu-ly" : ""}`}>
            {t("uploadFile")}
            <input type="file" className="an-nhan" disabled={uploading} onChange={(event) => void upload(event.target.files?.[0])} />
          </label>
        )}
      </div>
      <span className="chu-thich">{t("fileHint")}</span>
      <Loaded state={state} onRetry={() => void reload()}>
        {(files) =>
          files.length === 0 ? (
            <MessageView text={t("noFiles")} />
          ) : (
            <ul style={{ margin: 0, paddingLeft: "var(--khoang-5)" }}>
              {files.map((file) => (
                <li key={file.id}>
                  <button
                    type="button"
                    className="nut chu"
                    onClick={() => void apiDownload(`/office/tasks/${task.id}/files/${file.id}`, file.fileName).catch((error) => notify(failureOf(error).message, "loi"))}
                  >
                    {file.fileName}
                  </button>{" "}
                  <span className="chu-thich">
                    {Math.max(1, Math.round(file.sizeBytes / 1024))} KB · {file.uploadedBy.fullName} · {formatDateTime(file.createdAt)}
                  </span>
                  {file.canDelete && (
                    <button
                      type="button"
                      className="nut chu"
                      onClick={() =>
                        void apiFetch(`/office/tasks/${task.id}/files/${file.id}`, { method: "DELETE" })
                          .then(() => reload())
                          .catch((error) => notify(failureOf(error).message, "loi"))
                      }
                    >
                      {t("deleteFile")}
                    </button>
                  )}
                </li>
              ))}
            </ul>
          )
        }
      </Loaded>
    </div>
  );
}

function History({ task }: { task: OfficeTaskResponse }) {
  const t = useTranslations("officeTasks");
  const { state, reload } = useApi<OfficeTaskEvent[]>(`/office/tasks/${task.id}/history`);
  return (
    <div className="the">
      <Loaded state={state} onRetry={() => void reload()}>
        {(events) => (
          <ol className="dong-thoi-gian">
            {events.map((event) => (
              <li key={event.id} className="xong">
                <span className="cham">•</span>
                <div>
                  <strong>
                    {formatDateTime(event.createdAt)} · {event.actor?.fullName ?? t("system")}
                  </strong>
                  <div>
                    {t.has(`event_${event.action}`) ? t(`event_${event.action}`) : event.action}
                    {typeof event.details.reason === "string" && ` · ${event.details.reason}`}
                    {typeof event.details.fileName === "string" && ` · ${event.details.fileName}`}
                    {typeof event.details.to === "number" && ` · ${String(event.details.from)}% → ${event.details.to}%`}
                  </div>
                </div>
              </li>
            ))}
          </ol>
        )}
      </Loaded>
    </div>
  );
}
