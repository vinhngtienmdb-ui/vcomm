"use client";

// MAN_HINH_72 Ghé thăm khách (CHUC_NANG_103; API_114; QUYTAC_NGHIEPVU_139): lọc nhân viên, khoảng ngày; xem mọi lượt của công ty.
import type { PageResponse, VisitItem, VisitStaffOptionsResponse } from "contracts";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { Loaded, MessageView } from "ui/components/StatusViews";
import { useApi } from "ui/lib/use-api";
import { VisitList } from "@/components/VisitList";

export default function VisitsPage() {
  const t = useTranslations("visits");
  const common = useTranslations("common");
  const [userId, setUserId] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [page, setPage] = useState(1);
  const parameters = new URLSearchParams({ page: String(page), pageSize: "20" });
  if (userId) parameters.set("userId", userId);
  if (from) parameters.set("from", from);
  if (to) parameters.set("to", to);
  const { state, reload } = useApi<PageResponse<VisitItem>>(`/crm/visits?${parameters}`);
  // Danh sách nhân viên của công ty để lọc (QUYTAC_NGHIEPVU_279: xem mọi lượt của công ty).
  const staff = useApi<VisitStaffOptionsResponse>("/crm/visit-options");
  const filtered = Boolean(userId || from || to);
  return (
    <>
      <div className="tieu-de">
        <h1>{t("title")}</h1>
      </div>
      <div className="chu-thich">{t("hint")}</div>
      <div className="bo-loc">
        {staff.state.kind === "ready" && (
          <>
            <label className="an-nhan" htmlFor="gt-nhan-vien">
              {t("staff")}
            </label>
            <select
              id="gt-nhan-vien"
              className="o-nhap"
              style={{ width: "auto" }}
              value={userId}
              onChange={(event) => {
                setUserId(event.target.value);
                setPage(1);
              }}
            >
              <option value="">{`${t("staff")}: ${common("all")}`}</option>
              {staff.state.data.users.map((user) => (
                <option key={user.id} value={user.id}>
                  {user.fullName}
                </option>
              ))}
            </select>
          </>
        )}
        <label htmlFor="gt-tu">{t("from")}</label>
        <input id="gt-tu" type="date" className="o-nhap" style={{ width: "auto" }} value={from} onChange={(event) => setFrom(event.target.value)} />
        <label htmlFor="gt-den">{t("to")}</label>
        <input id="gt-den" type="date" className="o-nhap" style={{ width: "auto" }} value={to} onChange={(event) => setTo(event.target.value)} />
      </div>
      <Loaded state={state} onRetry={() => void reload()}>
        {(result) =>
          result.data.length === 0 ? (
            <MessageView text={filtered ? common("noResult") : t("none")} />
          ) : (
            <>
              <VisitList visits={result.data} showCustomer />
              <div className="phan-trang">
                <span>{common("total", { count: result.total })}</span>
                <span className="nhom-nut">
                  <button type="button" className="nut phu" disabled={page <= 1} onClick={() => setPage(page - 1)}>
                    ‹ {common("previous")}
                  </button>
                  <button type="button" className="nut phu" disabled={page * result.pageSize >= result.total} onClick={() => setPage(page + 1)}>
                    {common("next")} ›
                  </button>
                </span>
              </div>
            </>
          )
        }
      </Loaded>
    </>
  );
}
