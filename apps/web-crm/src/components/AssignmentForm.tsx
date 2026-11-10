"use client";

// Biểu mẫu phiếu giao khách (MAN_HINH_65; CHUC_NANG_97; API_110): nhân viên nhận, lý do, chọn khách theo tìm kiếm.
import type { CustomerAssignmentOptionsResponse, CustomerAssignmentResponse, PageResponse, PartnerListItem } from "contracts";
import { useTranslations } from "next-intl";
import { type FormEvent, useEffect, useState } from "react";
import { Field, FormError, useSubmit } from "ui/components/Form";
import { apiFetch } from "ui/lib/api";
import { useApi } from "ui/lib/use-api";

type Picked = { id: string; code: string; name: string; ownerUserName: string | null };

export function AssignmentForm({ current, onSaved, onCancel }: { current: CustomerAssignmentResponse | null; onSaved: (saved: CustomerAssignmentResponse) => void; onCancel: () => void }) {
  const t = useTranslations("customerAssignments");
  const common = useTranslations("common");
  const options = useApi<CustomerAssignmentOptionsResponse>("/crm/customer-assignment-options");
  const [targetUserId, setTargetUserId] = useState(current?.targetUserId ?? "");
  const [reason, setReason] = useState(current?.reason ?? "");
  const [picked, setPicked] = useState<Picked[]>(current?.lines.map((line) => ({ id: line.partnerId, code: line.code, name: line.name, ownerUserName: line.currentOwnerName })) ?? []);
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [currentOwner, setCurrentOwner] = useState("");
  const { submitting, fields, formError, run, inputClass } = useSubmit();

  useEffect(() => {
    const timer = setTimeout(() => setSearch(searchInput.trim()), 300);
    return () => clearTimeout(timer);
  }, [searchInput]);
  const parameters = new URLSearchParams({ role: "customer", status: "active", pageSize: "20" });
  if (search) parameters.set("search", search);
  if (currentOwner) parameters.set("owner", currentOwner);
  const found = useApi<PageResponse<PartnerListItem>>(`/crm/partners?${parameters}`);
  const users = options.state.kind === "ready" ? options.state.data.users : [];
  // Lỗi từng khách trả theo vị trí trong lần gửi gần nhất: đổi về mã khách để không lệch khi bỏ khách.
  const [sentIds, setSentIds] = useState<string[]>([]);
  const errorOf = (partnerId: string) => {
    const index = sentIds.indexOf(partnerId);
    return index < 0 ? undefined : fields[`partnerIds.${index}`];
  };

  function submit(event: FormEvent) {
    event.preventDefault();
    void run(async () => {
      const partnerIds = picked.map((item) => item.id);
      setSentIds(partnerIds);
      const body = { targetUserId, reason, partnerIds, ...(current ? { version: current.version } : {}) };
      const saved = await apiFetch<CustomerAssignmentResponse>(current ? `/crm/customer-assignments/${current.id}` : "/crm/customer-assignments", {
        method: current ? "PATCH" : "POST",
        body: JSON.stringify(body),
      });
      onSaved(saved);
    });
  }

  // Không phải trưởng phòng, không có quyền giao khách: báo rõ thay vì để biểu mẫu trống.
  if (options.state.kind === "forbidden") return <div className="khoi-canh-bao canh-bao">{t("noAuthority")}</div>;
  return (
    <form onSubmit={submit} noValidate className="the" style={{ display: "grid", gap: "var(--khoang-4)" }}>
      <Field id="gk-nhan" label={`${t("target")} *`} error={fields.targetUserId}>
        <select id="gk-nhan" className={inputClass("targetUserId")} value={targetUserId} onChange={(event) => setTargetUserId(event.target.value)}>
          <option value="">{t("chooseTarget")}</option>
          {users.map((user) => (
            <option key={user.id} value={user.id}>
              {user.fullName}
            </option>
          ))}
        </select>
      </Field>
      <Field id="gk-ly-do" label={`${t("reason")} *`} error={fields.reason}>
        <textarea id="gk-ly-do" className={inputClass("reason")} rows={2} maxLength={500} value={reason} onChange={(event) => setReason(event.target.value)} />
      </Field>
      <div style={{ display: "grid", gap: "var(--khoang-2)" }}>
        <strong>{t("picked", { count: picked.length })}</strong>
        {fields.partnerIds && <span className="loi-o">{fields.partnerIds}</span>}
        {picked.length === 0 ? (
          <span className="chu-thich">{t("nonePicked")}</span>
        ) : (
          <ul style={{ margin: 0, paddingLeft: "var(--khoang-4)" }}>
            {picked.map((item) => (
              <li key={item.id}>
                <span className={errorOf(item.id) ? "loi-o" : undefined}>
                  {item.code} · {item.name} · {item.ownerUserName ?? t("noOwner")}
                </span>{" "}
                <button type="button" className="nut phu" onClick={() => setPicked(picked.filter((other) => other.id !== item.id))}>
                  {t("remove")}
                </button>
                {errorOf(item.id) && <div className="loi-o">{errorOf(item.id)}</div>}
              </li>
            ))}
          </ul>
        )}
      </div>
      <div style={{ display: "grid", gap: "var(--khoang-2)" }}>
        <label htmlFor="gk-tim">{t("findCustomers")}</label>
        <label className="an-nhan" htmlFor="gk-loc-phu-trach">
          {t("currentOwner")}
        </label>
        <select id="gk-loc-phu-trach" className="o-nhap" value={currentOwner} onChange={(event) => setCurrentOwner(event.target.value)}>
          <option value="">{`${t("currentOwner")}: ${common("all")}`}</option>
          {users.map((user) => (
            <option key={user.id} value={user.id}>
              {user.fullName}
            </option>
          ))}
        </select>
        <input id="gk-tim" className="o-nhap" type="search" placeholder={t("searchHint")} value={searchInput} onChange={(event) => setSearchInput(event.target.value)} />
        {found.state.kind === "ready" &&
          (found.state.data.data.length === 0 ? (
            <span className="chu-thich">{common("noResult")}</span>
          ) : (
            <ul style={{ margin: 0, paddingLeft: "var(--khoang-4)" }}>
              {found.state.data.data
                .filter((item) => !picked.some((other) => other.id === item.id))
                .map((item) => (
                  <li key={item.id}>
                    {item.code} · {item.name} · {item.ownerUserName ?? t("noOwner")}{" "}
                    <button
                      type="button"
                      className="nut phu"
                      disabled={picked.length >= 500}
                      onClick={() => setPicked([...picked, { id: item.id, code: item.code, name: item.name, ownerUserName: item.ownerUserName }])}
                    >
                      {t("add")}
                    </button>
                  </li>
                ))}
            </ul>
          ))}
      </div>
      <FormError text={formError} />
      <div className="nhom-nut">
        <button type="submit" className="nut chinh" disabled={submitting}>
          {common("save")}
        </button>
        <button type="button" className="nut phu" onClick={onCancel}>
          {common("cancel")}
        </button>
      </div>
    </form>
  );
}
