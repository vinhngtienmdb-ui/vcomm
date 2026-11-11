"use client";

// MAN_HINH_159 Đăng, sửa tin (CHUC_NANG_185; API_191): đối tượng, ghim, hẹn giờ, hết hạn, cần xác nhận đã đọc, cho bình luận, tệp đính kèm.
import { postMaximumPinned, type PostAudienceType, type PostOptions, type PostResponse, type SavePostInput } from "contracts";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useAdmin } from "ui/components/AppShell";
import { Drawer } from "ui/components/Dialogs";
import { Field, FormError, useSubmit } from "ui/components/Form";
import { apiFetch, apiUpload } from "ui/lib/api";

// Ô ngày giờ nhập theo giờ Việt Nam; gửi lên kèm múi giờ +07:00.
const toVietnamInput = (iso: string | null) => {
  if (!iso) return "";
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Ho_Chi_Minh", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23" })
      .formatToParts(new Date(iso))
      .map((part) => [part.type, part.value]),
  );
  return `${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}`;
};
const fromVietnamInput = (value: string) => (value ? `${value}:00+07:00` : null);

export function PostEditor({ options, post, onClose }: { options: PostOptions; post: PostResponse | null; onClose: () => void }) {
  const t = useTranslations("officeBulletin");
  const common = useTranslations("common");
  const router = useRouter();
  const { notify } = useAdmin();
  const { submitting, fields, formError, run, inputClass } = useSubmit();
  const published = post !== null && post.state !== "scheduled";
  const [title, setTitle] = useState(post?.title ?? "");
  const [body, setBody] = useState(post?.body ?? "");
  const [audienceType, setAudienceType] = useState<PostAudienceType>(post?.audienceType ?? "company");
  const [branchIds, setBranchIds] = useState<string[]>(post?.branchIds ?? []);
  const [departmentIds, setDepartmentIds] = useState<string[]>(post?.departmentIds ?? []);
  const [pinned, setPinned] = useState(post?.pinned ?? false);
  const [scheduled, setScheduled] = useState(post?.state === "scheduled");
  const [publishAt, setPublishAt] = useState(post?.state === "scheduled" ? toVietnamInput(post.publishAt) : "");
  const [expiresAt, setExpiresAt] = useState(toVietnamInput(post?.expiresAt ?? null));
  const [requiresAcknowledgement, setRequiresAcknowledgement] = useState(post?.requiresAcknowledgement ?? false);
  const [allowComments, setAllowComments] = useState(post?.allowComments ?? true);
  const [files, setFiles] = useState<File[]>([]);
  const pinFull = !post?.pinned && options.pinnedCount >= postMaximumPinned;
  const toggle = (list: string[], id: string, checked: boolean) => (checked ? [...list, id] : list.filter((item) => item !== id));
  const save = () =>
    run(async () => {
      const input: SavePostInput = {
        title,
        body,
        audienceType,
        branchIds: audienceType === "units" ? branchIds : [],
        departmentIds: audienceType === "units" ? departmentIds : [],
        pinned,
        publishAt: scheduled && !published ? fromVietnamInput(publishAt) : null,
        expiresAt: fromVietnamInput(expiresAt),
        requiresAcknowledgement,
        allowComments,
        ...(post ? { version: post.version } : {}),
      };
      const saved = await apiFetch<PostResponse>(post ? `/office/posts/${post.id}` : "/office/posts", { method: post ? "PATCH" : "POST", body: JSON.stringify(input) });
      for (const file of files) {
        const form = new FormData();
        form.append("file", file);
        await apiUpload(`/office/posts/${saved.id}/files`, form);
      }
      notify(post ? common("saved") : saved.state === "scheduled" ? t("scheduledDone") : t("postedDone"));
      if (post) onClose();
      router.push(`/bulletin/${saved.id}`);
      router.refresh();
    });
  return (
    <Drawer title={post ? t("edit") : t("create")} onClose={onClose}>
      <FormError text={formError} />
      <Field id="post-title" label={t("titleLabel")} error={fields.title}>
        <input id="post-title" className={inputClass("title")} maxLength={200} value={title} onChange={(event) => setTitle(event.target.value)} />
      </Field>
      <Field id="post-body" label={t("body")} error={fields.body}>
        <textarea id="post-body" className={inputClass("body")} rows={10} maxLength={20000} value={body} onChange={(event) => setBody(event.target.value)} />
        <span className="chu-thich">{t("bodyHint")}</span>
      </Field>
      <Field id="post-audience" label={t("audience")} error={fields.audienceType}>
        <select id="post-audience" className={inputClass("audienceType")} value={audienceType} onChange={(event) => setAudienceType(event.target.value as PostAudienceType)}>
          <option value="company">{t("audience_company")}</option>
          <option value="units">{t("audience_units")}</option>
          {(options.canPostGroup || post?.audienceType === "group") && <option value="group">{t("audience_group")}</option>}
        </select>
      </Field>
      {audienceType === "units" && (
        <div className="hai-cot">
          <fieldset className="the" style={{ margin: 0 }}>
            <legend>{t("departments")}</legend>
            {options.departments.length === 0 && <span className="chu-thich">{t("noUnits")}</span>}
            {options.departments.map((item) => (
              <label key={item.id} style={{ display: "block" }}>
                <input type="checkbox" checked={departmentIds.includes(item.id)} onChange={(event) => setDepartmentIds(toggle(departmentIds, item.id, event.target.checked))} /> {item.name}
              </label>
            ))}
          </fieldset>
          <fieldset className="the" style={{ margin: 0 }}>
            <legend>{t("branches")}</legend>
            {options.branches.length === 0 && <span className="chu-thich">{t("noUnits")}</span>}
            {options.branches.map((item) => (
              <label key={item.id} style={{ display: "block" }}>
                <input type="checkbox" checked={branchIds.includes(item.id)} onChange={(event) => setBranchIds(toggle(branchIds, item.id, event.target.checked))} /> {item.name}
              </label>
            ))}
          </fieldset>
        </div>
      )}
      {!published && (
        <>
          <label style={{ display: "block", marginBottom: "var(--khoang-2)" }}>
            <input type="checkbox" checked={scheduled} onChange={(event) => setScheduled(event.target.checked)} /> {t("schedule")}
          </label>
          {scheduled && (
            <Field id="post-publish" label={t("publishAt")} error={fields.publishAt}>
              <input id="post-publish" type="datetime-local" className={inputClass("publishAt")} value={publishAt} onChange={(event) => setPublishAt(event.target.value)} />
            </Field>
          )}
        </>
      )}
      <Field id="post-expires" label={t("expiresAt")} error={fields.expiresAt}>
        <input id="post-expires" type="datetime-local" className={inputClass("expiresAt")} value={expiresAt} onChange={(event) => setExpiresAt(event.target.value)} />
      </Field>
      <label style={{ display: "block" }}>
        <input type="checkbox" checked={pinned} disabled={pinFull && !pinned} onChange={(event) => setPinned(event.target.checked)} /> {t("pin")}{" "}
        <span className="chu-thich">{pinFull ? t("pinFull", { maximum: postMaximumPinned }) : t("pinCount", { count: options.pinnedCount, maximum: postMaximumPinned })}</span>
      </label>
      <label style={{ display: "block" }}>
        <input type="checkbox" checked={requiresAcknowledgement} onChange={(event) => setRequiresAcknowledgement(event.target.checked)} /> {t("requiresAcknowledgement")}
      </label>
      <label style={{ display: "block", marginBottom: "var(--khoang-3)" }}>
        <input type="checkbox" checked={allowComments} onChange={(event) => setAllowComments(event.target.checked)} /> {t("allowComments")}
      </label>
      <Field id="post-files" label={t("attachFiles")} error={fields.file}>
        <input id="post-files" type="file" multiple className={inputClass("file")} onChange={(event) => setFiles([...(event.target.files ?? [])])} />
      </Field>
      <div className="nhom-nut">
        <button type="button" className="nut phu" onClick={onClose}>
          {common("cancel")}
        </button>
        <button type="button" className={`nut chinh${submitting ? " dang-xu-ly" : ""}`} disabled={submitting || (scheduled && !published && !publishAt)} onClick={() => void save()}>
          {post ? common("save") : scheduled ? t("scheduleSubmit") : t("publish")}
        </button>
      </div>
    </Drawer>
  );
}
