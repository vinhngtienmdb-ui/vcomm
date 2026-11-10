"use client";

// Danh sách lượt ghé thăm (MAN_HINH_72, thẻ ghé thăm MAN_HINH_37; API_114; QUYTAC_NGHIEPVU_139): ảnh tải qua API có kiểm quyền, vị trí mở Google Maps.
import type { VisitItem } from "contracts";
import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import { selectedCompanyId } from "ui/lib/api";
import { formatDateTime } from "ui/lib/format";

// Ảnh cần header công ty đang chọn nên tải bằng fetch rồi hiện qua đường dẫn tạm.
function VisitPhoto({ visitId, photoId, label }: { visitId: string; photoId: string; label: string }) {
  const [source, setSource] = useState<string | null>(null);
  useEffect(() => {
    let url: string | null = null;
    const headers: Record<string, string> = {};
    const companyId = selectedCompanyId();
    if (companyId) headers["x-company-id"] = companyId;
    void fetch(`/api/v1/crm/visits/${visitId}/photos/${photoId}`, { headers, credentials: "same-origin" })
      .then((response) => (response.ok ? response.blob() : null))
      .then((blob) => {
        if (!blob) return;
        url = URL.createObjectURL(blob);
        setSource(url);
      });
    return () => {
      if (url) URL.revokeObjectURL(url);
    };
  }, [visitId, photoId]);
  return source ? (
    <a href={source} target="_blank" rel="noreferrer">
      {/* eslint-disable-next-line @next/next/no-img-element -- ảnh tải từ API có kiểm quyền, không qua tối ưu ảnh của Next */}
      <img src={source} alt={label} width={96} height={96} style={{ objectFit: "cover", borderRadius: "var(--bo-nho)" }} />
    </a>
  ) : (
    <span className="chu-thich">{label}</span>
  );
}

export function VisitList({ visits, showCustomer }: { visits: VisitItem[]; showCustomer: boolean }) {
  const t = useTranslations("visits");
  return (
    <div style={{ display: "grid", gap: "var(--khoang-3)" }}>
      {visits.map((visit) => (
        <article key={visit.id} className="the" style={{ display: "grid", gap: "var(--khoang-2)" }}>
          <div className="tieu-de" style={{ margin: 0 }}>
            <strong>{showCustomer ? `${visit.partnerCode} · ${visit.partnerName}` : visit.userName}</strong>
            <span className="chu-thich">
              {formatDateTime(visit.visitedAt)}
              {showCustomer ? ` · ${visit.userName}` : ""}
            </span>
          </div>
          <p style={{ margin: 0, whiteSpace: "pre-wrap" }}>{visit.note}</p>
          {visit.photoIds.length > 0 && (
            <div className="nhom-nut">
              {visit.photoIds.map((photoId, index) => (
                <VisitPhoto key={photoId} visitId={visit.id} photoId={photoId} label={t("photo", { number: index + 1 })} />
              ))}
            </div>
          )}
          <a href={`https://www.google.com/maps/search/?api=1&query=${visit.latitude},${visit.longitude}`} target="_blank" rel="noreferrer">
            {t("openMap", { accuracy: Math.round(Number(visit.accuracyMeters)) })}
          </a>
        </article>
      ))}
    </div>
  );
}
