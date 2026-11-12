"use client";

// MAN_HINH_36 Danh sách đối tác (CHUC_NANG_46, 47; API_71): tìm không dấu theo tên, mã, mã số thuế, điện thoại; lọc loại, vai trò với công ty đang chọn, trạng thái.
import { partnerKinds, type PageResponse, type PartnerListItem } from "contracts";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useAdmin } from "ui/components/AppShell";
import { HistoryLink } from "ui/components/HistoryLink";
import { Loaded, MessageView } from "ui/components/StatusViews";
import { useApi } from "ui/lib/use-api";
import { PartnerDrawer } from "@/components/PartnerDrawer";

export default function PartnersPage() {
  const t = useTranslations("partners");
  const common = useTranslations("common");
  const router = useRouter();
  const { can, notify } = useAdmin();
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [kind, setKind] = useState("");
  const [role, setRole] = useState("");
  const [source, setSource] = useState("");
  const [status, setStatus] = useState("");
  const [page, setPage] = useState(1);
  const [adding, setAdding] = useState(false);

  // Tìm sau khi ngừng gõ 300 ms.
  useEffect(() => {
    const timer = setTimeout(() => {
      setSearch(searchInput.trim());
      setPage(1);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchInput]);

  const parameters = new URLSearchParams({
    page: String(page),
    pageSize: "20",
  });
  if (search) parameters.set("search", search);
  if (kind) parameters.set("kind", kind);
  if (role) parameters.set("role", role);
  if (source) parameters.set("source", source);
  if (status) parameters.set("status", status);
  const { state, reload } = useApi<PageResponse<PartnerListItem>>(`/crm/partners?${parameters}`);
  const headings = [t("code"), t("name"), t("kind"), t("identity"), t("phone"), t("role"), t("owner"), t("status")];
  const filter = (id: string, label: string, value: string, onChange: (value: string) => void, options: { value: string; label: string }[]) => (
    <>
      <label className="an-nhan" htmlFor={id}>
        {label}
      </label>
      <select
        id={id}
        className="o-nhap"
        style={{ width: "auto" }}
        value={value}
        onChange={(event) => {
          onChange(event.target.value);
          setPage(1);
        }}
      >
        <option value="">{`${label}: ${common("all")}`}</option>
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </>
  );

  return (
    <>
      <div className="tieu-de">
        <h1>{t("title")}</h1>
        <HistoryLink entityType="partner" />
        {can("crm.partner.manage") && (
          <button type="button" className="nut chinh" onClick={() => setAdding(true)}>
            {t("add")}
          </button>
        )}
      </div>
      <div className="chu-thich">{t("hint")}</div>
      <div className="bo-loc">
        <label className="an-nhan" htmlFor="tim-doi-tac">
          {common("search")}
        </label>
        <input id="tim-doi-tac" className="o-nhap" type="search" placeholder={t("searchHint")} value={searchInput} onChange={(event) => setSearchInput(event.target.value)} style={{ maxWidth: 360 }} />
        {filter(
          "loc-loai",
          t("kind"),
          kind,
          setKind,
          partnerKinds.map((item) => ({
            value: item,
            label: t(`kind_${item}`),
          })),
        )}
        {filter(
          "loc-vai-tro",
          t("role"),
          role,
          setRole,
          (["customer", "supplier", "internal"] as const).map((item) => ({
            value: item,
            label: t(`role_${item}`),
          })),
        )}
        {filter(
          "loc-nguon",
          t("source"),
          source,
          setSource,
          (["web", "open_api"] as const).map((item) => ({
            value: item,
            label: t(`source_${item}`),
          })),
        )}
        {filter("loc-trang-thai", t("status"), status, setStatus, [
          { value: "active", label: t("active") },
          { value: "inactive", label: t("inactive") },
        ])}
      </div>
      <Loaded state={state} onRetry={() => void reload()}>
        {(result) =>
          result.data.length === 0 ? (
            <MessageView text={search || kind || role || source || status ? common("noResult") : t("none")} />
          ) : (
            <div className="khung-bang">
              <table>
                <thead>
                  <tr>
                    {headings.map((heading, index) => (
                      <th key={index} scope="col">
                        {heading}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {result.data.map((item) => (
                    <tr key={item.id}>
                      <td data-nhan={headings[0]}>
                        <Link href={`/partners/${item.id}`}>{item.code}</Link>
                      </td>
                      <td data-nhan={headings[1]}>
                        <span>
                          {item.name}
                          {item.shortName && <span className="chu-thich"> · {item.shortName}</span>}
                          {item.createdViaOpenApi && <span className="nhan thong-tin"> {t("createdViaOpenApi")}</span>}
                        </span>
                      </td>
                      <td data-nhan={headings[2]}>
                        <span>{t(`kind_${item.kind}`)}</span>
                      </td>
                      <td data-nhan={headings[3]}>
                        <span>{item.taxCode ?? item.citizenIdMasked ?? common("none")}</span>
                      </td>
                      <td data-nhan={headings[4]}>
                        <span>{item.phone ?? common("none")}</span>
                      </td>
                      <td data-nhan={headings[5]}>
                        <span className="nhom-nut">
                          {item.internalCompanyId && <span className="nhan thong-tin">{t("internal")}</span>}
                          {item.isCustomer && <span className="nhan thanh-cong">{t("role_customer")}</span>}
                          {item.isSupplier && <span className="nhan canh-bao">{t("role_supplier")}</span>}
                        </span>
                      </td>
                      <td data-nhan={headings[6]}>
                        <span>{item.ownerUserName ?? common("none")}</span>
                      </td>
                      <td data-nhan={headings[7]}>
                        <span className={`nhan ${item.status === "active" ? "thanh-cong" : "trung-tinh"}`}>{t(item.status)}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
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
            </div>
          )
        }
      </Loaded>
      {adding && (
        <PartnerDrawer
          partner={null}
          onClose={() => setAdding(false)}
          onSaved={(saved) => {
            setAdding(false);
            notify(t("saved"));
            router.push(`/partners/${saved.id}`);
          }}
        />
      )}
    </>
  );
}
