"use client";

// Biểu mẫu giao việc, sửa việc, thêm việc con (ngăn kéo bên phải; QUYTAC_NGHIEPVU_356 đến 358).
import { officeTaskPriorities, type OfficePerson, type OfficeTaskPriority, type OfficeTaskResponse } from "contracts";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { Drawer } from "ui/components/Dialogs";
import { Field, FormError, useSubmit } from "ui/components/Form";
import { apiFetch } from "ui/lib/api";
import { PersonPicker } from "./PersonPicker";

// Giờ nhập theo giờ Việt Nam; gửi dạng ISO 8601 có múi giờ +07:00.
const vietnamLocal = (iso: string | null) =>
  iso
    ? new Intl.DateTimeFormat("sv-SE", { timeZone: "Asia/Ho_Chi_Minh", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" }).format(new Date(iso)).replace(" ", "T")
    : "";
const toIso = (local: string) => (local ? `${local}:00+07:00` : null);

export function TaskEditor({ task, parentId, onSaved, onClose }: { task: OfficeTaskResponse | null; parentId?: string; onSaved: (task: OfficeTaskResponse) => void; onClose: () => void }) {
  const t = useTranslations("officeTasks");
  const common = useTranslations("common");
  const { submitting, fields, formError, run, inputClass } = useSubmit();
  const [title, setTitle] = useState(task?.title ?? "");
  const [description, setDescription] = useState(task?.description ?? "");
  const [owner, setOwner] = useState<OfficePerson[]>(task?.owner ? [task.owner] : []);
  const [collaborators, setCollaborators] = useState<OfficePerson[]>(task?.collaborators ?? []);
  const [followers, setFollowers] = useState<OfficePerson[]>(task?.followers ?? []);
  const [startDate, setStartDate] = useState(task?.startDate ?? "");
  const [dueAt, setDueAt] = useState(vietnamLocal(task?.dueAt ?? null));
  const [priority, setPriority] = useState<OfficeTaskPriority>(task?.priority ?? "normal");
  const save = () =>
    run(async () => {
      const body = {
        title,
        description: description || null,
        ownerUserId: owner[0]?.id ?? "",
        collaboratorIds: collaborators.map((person) => person.id),
        followerIds: followers.map((person) => person.id),
        startDate: startDate || null,
        dueAt: toIso(dueAt),
        priority,
        ...(task ? { version: task.version } : parentId ? { parentId } : {}),
      };
      const saved = await apiFetch<OfficeTaskResponse>(task ? `/office/tasks/${task.id}` : "/office/tasks", { method: task ? "PATCH" : "POST", body: JSON.stringify(body) });
      onSaved(saved);
    });
  return (
    <Drawer title={task ? t("edit") : parentId ? t("addChild") : t("create")} onClose={onClose}>
      <FormError text={formError} />
      <Field id="task-title" label={t("titleField")} error={fields.title}>
        <input id="task-title" className={inputClass("title")} value={title} maxLength={200} onChange={(event) => setTitle(event.target.value)} />
      </Field>
      <Field id="task-description" label={t("description")} error={fields.description}>
        <textarea id="task-description" className={inputClass("description")} rows={4} value={description} onChange={(event) => setDescription(event.target.value)} />
      </Field>
      <Field id="task-owner" label={t("owner")} error={fields.ownerUserId}>
        <PersonPicker id="task-owner" value={owner} onChange={setOwner} multiple={false} invalid={Boolean(fields.ownerUserId)} />
      </Field>
      <Field id="task-collaborators" label={t("collaborators")} error={fields.collaboratorIds}>
        <PersonPicker id="task-collaborators" value={collaborators} onChange={setCollaborators} multiple invalid={Boolean(fields.collaboratorIds)} />
      </Field>
      <Field id="task-followers" label={t("followers")} error={fields.followerIds}>
        <PersonPicker id="task-followers" value={followers} onChange={setFollowers} multiple invalid={Boolean(fields.followerIds)} />
      </Field>
      <Field id="task-start" label={t("startDate")} error={fields.startDate}>
        <input id="task-start" type="date" className={inputClass("startDate")} value={startDate} onChange={(event) => setStartDate(event.target.value)} />
      </Field>
      <Field id="task-due" label={t("dueAt")} error={fields.dueAt}>
        <input id="task-due" type="datetime-local" className={inputClass("dueAt")} value={dueAt} onChange={(event) => setDueAt(event.target.value)} />
      </Field>
      <Field id="task-priority" label={t("priority")}>
        <select id="task-priority" className="o-nhap" value={priority} onChange={(event) => setPriority(event.target.value as OfficeTaskPriority)}>
          {officeTaskPriorities.map((item) => (
            <option key={item} value={item}>
              {t(`priority_${item}`)}
            </option>
          ))}
        </select>
      </Field>
      <div className="khoi-canh-bao thong-tin">{t("crossCompanyHint")}</div>
      <div className="nhom-nut">
        <button type="button" className="nut phu" onClick={onClose}>
          {common("cancel")}
        </button>
        <button type="button" className={`nut chinh${submitting ? " dang-xu-ly" : ""}`} disabled={submitting} onClick={() => void save()}>
          {task ? common("save") : t("assign")}
        </button>
      </div>
    </Drawer>
  );
}
