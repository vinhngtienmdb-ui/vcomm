"use client";

// MAN_HINH_81 Đội kinh doanh (CHUC_NANG_109, 110; API_120; QUYTAC_NGHIEPVU_148 đến 152):
// cây phòng ban của công ty vận hành sàn, loại đơn vị, quản lý, thành viên và chức danh; gắn loại, chuyển đơn vị, bổ nhiệm, bỏ quản lý.
import { salesUnitTypes, type MarketplaceSettingsResponse, type SalesTeamMember, type SalesTeamResponse, type SalesTeamUnit } from "contracts";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { useState } from "react";
import { useAdmin } from "ui/components/AppShell";
import { FormError } from "ui/components/Form";
import { Loaded, MessageView } from "ui/components/StatusViews";
import { apiFetch } from "ui/lib/api";
import { failureOf, useApi } from "ui/lib/use-api";

// Sắp phòng ban theo cây: cha trước, con thụt vào.
function ordered(units: SalesTeamUnit[]): Array<{ unit: SalesTeamUnit; depth: number }> {
  const result: Array<{ unit: SalesTeamUnit; depth: number }> = [];
  const ids = new Set(units.map((unit) => unit.id));
  const visit = (parentId: string | null, depth: number) => {
    for (const unit of units.filter((candidate) => (parentId === null ? !candidate.parentId || !ids.has(candidate.parentId) : candidate.parentId === parentId))) {
      result.push({ unit, depth });
      visit(unit.id, depth + 1);
    }
  };
  visit(null, 0);
  return result;
}

function MemberRow({ member, units, canManage, onAction }: { member: SalesTeamMember; units: SalesTeamUnit[]; canManage: boolean; onAction: (path: string, method: string, body: object) => void }) {
  const t = useTranslations("salesTeam");
  const [target, setTarget] = useState("");
  const unit = units.find((candidate) => candidate.id === member.departmentId);
  return (
    <li style={{ display: "grid", gap: "var(--khoang-1)" }}>
      <span>
        <Link href={`/buyers/${member.userId}`}>{member.fullName}</Link> · {member.phone} · <span className="nhan trung-tinh">{t(`title_${member.title}`)}</span>{" "}
        <span className="chu-thich">{t("customers", { count: member.customerCount })}</span>
      </span>
      {canManage && (
        <span className="nhom-nut" style={{ flexWrap: "wrap" }}>
          {unit?.managerUserId !== member.userId && (
            <button type="button" className="nut phu" onClick={() => onAction(`/marketplace/sales-units/${member.departmentId}/manager`, "PUT", { userId: member.userId })}>
              {t("appoint")}
            </button>
          )}
          <label className="an-nhan" htmlFor={`chuyen-${member.userId}`}>
            {t("moveTo")}
          </label>
          <select id={`chuyen-${member.userId}`} className="o-nhap" style={{ width: "auto" }} value={target} onChange={(event) => setTarget(event.target.value)}>
            <option value="">{t("moveTo")}…</option>
            {units
              .filter((candidate) => candidate.type && candidate.id !== member.departmentId)
              .map((candidate) => (
                <option key={candidate.id} value={candidate.id}>
                  {candidate.name}
                </option>
              ))}
          </select>
          <button
            type="button"
            className="nut phu"
            disabled={!target}
            onClick={() => onAction(`/marketplace/buyers/${member.userId}/sales-move`, "POST", { departmentId: target, version: member.version })}
          >
            {t("move")}
          </button>
        </span>
      )}
    </li>
  );
}

export default function SalesTeamPage() {
  const t = useTranslations("salesTeam");
  const { notify } = useAdmin();
  const settings = useApi<MarketplaceSettingsResponse>("/marketplace/settings");
  const { state, reload } = useApi<SalesTeamResponse>("/marketplace/sales-team");
  const [error, setError] = useState<string | null>(null);
  const canManage = settings.state.kind === "ready" && settings.state.data.canManage;

  async function act(path: string, method: string, body: object) {
    setError(null);
    try {
      await apiFetch(path, { method, body: JSON.stringify(body) });
      notify(t("saved"));
      await reload();
      await settings.reload();
    } catch (failure) {
      setError(failureOf(failure).message);
    }
  }

  return (
    <>
      <div className="tieu-de">
        <h1>{t("title")}</h1>
      </div>
      <div className="chu-thich">{t("hint")}</div>
      <FormError text={error} />
      <Loaded state={state} onRetry={() => void reload()}>
        {(team) =>
          team.units.length === 0 ? (
            <MessageView text={t("noUnits")} />
          ) : (
            <div style={{ display: "grid", gap: "var(--khoang-3)" }}>
              {ordered(team.units).map(({ unit, depth }) => {
                const members = team.members.filter((member) => member.departmentId === unit.id);
                return (
                  <div key={unit.id} className="the" style={{ marginLeft: `calc(var(--khoang-4) * ${Math.min(depth, 4)})`, display: "grid", gap: "var(--khoang-2)" }}>
                    <div style={{ display: "flex", gap: "var(--khoang-2)", alignItems: "center", flexWrap: "wrap" }}>
                      <strong>{unit.name}</strong>
                      <span className="chu-thich">{unit.code}</span>
                      {canManage ? (
                        <>
                          <label className="an-nhan" htmlFor={`loai-${unit.id}`}>
                            {t("unitType")}
                          </label>
                          <select
                            id={`loai-${unit.id}`}
                            className="o-nhap"
                            style={{ width: "auto" }}
                            value={unit.type ?? ""}
                            onChange={(event) => void act(`/marketplace/sales-units/${unit.id}`, "PUT", { type: event.target.value || null })}
                          >
                            <option value="">{t("type_none")}</option>
                            {salesUnitTypes.map((type) => (
                              <option key={type} value={type}>
                                {t(`type_${type}`)}
                              </option>
                            ))}
                          </select>
                        </>
                      ) : (
                        <span className="nhan trung-tinh">{t(`type_${unit.type ?? "none"}`)}</span>
                      )}
                    </div>
                    {unit.type && (
                      <>
                        <div style={{ display: "flex", gap: "var(--khoang-2)", alignItems: "center", flexWrap: "wrap" }}>
                          <span className="chu-thich">{t("manager")}:</span>
                          <span>{unit.managerName ?? t("noManager")}</span>
                          {canManage && unit.managerUserId && (
                            <button type="button" className="nut phu" onClick={() => void act(`/marketplace/sales-units/${unit.id}/manager`, "PUT", { userId: null })}>
                              {t("removeManager")}
                            </button>
                          )}
                        </div>
                        <span className="chu-thich">{t("members", { count: members.length })}</span>
                        {members.length === 0 ? (
                          <span className="chu-thich">{t("noMembers")}</span>
                        ) : (
                          <ul style={{ margin: 0, paddingLeft: "var(--khoang-4)", display: "grid", gap: "var(--khoang-2)" }}>
                            {members.map((member) => (
                              <MemberRow key={member.userId} member={member} units={team.units} canManage={canManage} onAction={(path, method, body) => void act(path, method, body)} />
                            ))}
                          </ul>
                        )}
                      </>
                    )}
                  </div>
                );
              })}
            </div>
          )
        }
      </Loaded>
    </>
  );
}
