"use client";

// MAN_HINH_171 Trang tuyển dụng công khai – danh sách tin của mọi công ty con (CHUC_NANG_190; API_204; QUYTAC_NGHIEPVU_382).
import type { CareersListResponse } from "contracts";
import { workTypes } from "contracts";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { useState } from "react";
import { Loaded, MessageView } from "ui/components/StatusViews";
import { formatDate } from "ui/lib/format";
import { useApi } from "ui/lib/use-api";
import { CareersFrame, salaryText } from "@/components/CareersFrame";
import { Pager } from "@/components/RecruitmentParts";

export default function CareersPage() {
  const t = useTranslations("careers");
  const [search, setSearch] = useState("");
  const [companyId, setCompanyId] = useState("");
  const [location, setLocation] = useState("");
  const [workType, setWorkType] = useState("");
  const [page, setPage] = useState(1);
  const parameters = new URLSearchParams({ page: String(page), pageSize: "20" });
  if (search.trim()) parameters.set("search", search.trim());
  if (companyId) parameters.set("companyId", companyId);
  if (location) parameters.set("location", location);
  if (workType) parameters.set("workType", workType);
  const { state, reload } = useApi<CareersListResponse>(`/careers/postings?${parameters}`);
  const [filters, setFilters] = useState<Pick<CareersListResponse, "companies" | "locations"> | null>(null);
  if (state.kind === "ready" && !filters) setFilters({ companies: state.data.companies, locations: state.data.locations });
  const change = (setter: (value: string) => void) => (event: { target: { value: string } }) => {
    setter(event.target.value);
    setPage(1);
  };
  return (
    <CareersFrame>
      <div className="tieu-de">
        <h1>{t("title")}</h1>
      </div>
      <div className="bo-loc">
        <label className="an-nhan" htmlFor="tim-tin">
          {t("searchPlaceholder")}
        </label>
        <input id="tim-tin" className="o-nhap" placeholder={t("searchPlaceholder")} value={search} onChange={change(setSearch)} />
        <select className="o-nhap" aria-label={t("company")} value={companyId} onChange={change(setCompanyId)}>
          <option value="">{t("allCompanies")}</option>
          {filters?.companies.map((company) => (
            <option key={company.id} value={company.id}>
              {company.name}
            </option>
          ))}
        </select>
        <select className="o-nhap" aria-label={t("location")} value={location} onChange={change(setLocation)}>
          <option value="">{t("allLocations")}</option>
          {filters?.locations.map((value) => (
            <option key={value} value={value}>
              {value}
            </option>
          ))}
        </select>
        <select className="o-nhap" aria-label={t("workType")} value={workType} onChange={change(setWorkType)}>
          <option value="">{t("allWorkTypes")}</option>
          {workTypes.map((value) => (
            <option key={value} value={value}>
              {t(`workType_${value}`)}
            </option>
          ))}
        </select>
      </div>
      <Loaded state={state} onRetry={() => void reload()}>
        {(result) =>
          result.data.length === 0 ? (
            <MessageView text={t("none")} />
          ) : (
            <>
              {result.data.map((item) => (
                <div key={item.id} className="the">
                  <div className="tieu-de">
                    <h2>
                      <Link href={`/careers/${item.id}`}>{item.title}</Link>
                    </h2>
                    <Link className="nut phu" href={`/careers/${item.id}`}>
                      {t("view")}
                    </Link>
                  </div>
                  <div>
                    {[item.companyName, item.location, t(`workType_${item.workType}`), salaryText(item, t("negotiable"), t("currencyUnit")), t("deadlineOn", { date: formatDate(item.deadline) })].join(
                      " · ",
                    )}
                  </div>
                </div>
              ))}
              <Pager page={page} pageSize={result.pageSize} total={result.total} label={t("total", { count: result.total })} onPage={setPage} />
            </>
          )
        }
      </Loaded>
    </CareersFrame>
  );
}
