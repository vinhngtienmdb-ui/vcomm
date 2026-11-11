"use client";

// Màn hình mã QR động đặt tại địa điểm chấm công (MAN_HINH_120, CONG_VIEC_47; QUYTAC_NGHIEPVU_304): mã đổi mỗi 30 giây, tự tải mã mới khi hết hạn.
import type { AttendanceQrResponse } from "contracts";
import { useTranslations } from "next-intl";
import { useParams } from "next/navigation";
import qrcode from "qrcode-generator";
import { useEffect, useState } from "react";
import { apiFetch } from "ui/lib/api";
import { failureOf } from "ui/lib/use-api";

function qrImage(text: string): string {
  const code = qrcode(0, "M");
  code.addData(text);
  code.make();
  return code.createDataURL(8, 8);
}

export default function AttendanceQrPage() {
  const t = useTranslations("attendance");
  const { id } = useParams<{ id: string }>();
  const [qr, setQr] = useState<AttendanceQrResponse | null>(null);
  const [remaining, setRemaining] = useState(0);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    let ticker: ReturnType<typeof setInterval> | undefined;
    let stopped = false;
    const load = async () => {
      try {
        const next = await apiFetch<AttendanceQrResponse>(`/hr/attendance/locations/${id}/qr`);
        if (stopped) return;
        setQr(next);
        setError(null);
        setRemaining(next.expiresInSeconds);
        timer = setTimeout(() => void load(), next.expiresInSeconds * 1000 + 300);
      } catch (failure) {
        if (stopped) return;
        setError(failureOf(failure).message);
        timer = setTimeout(() => void load(), 10_000);
      }
    };
    void load();
    ticker = setInterval(() => setRemaining((value) => Math.max(0, value - 1)), 1000);
    return () => {
      stopped = true;
      clearTimeout(timer);
      clearInterval(ticker);
    };
  }, [id]);
  return (
    <div className="the man-hinh-qr">
      {error && (
        <div className="khoi-canh-bao loi" role="alert">
          {error}
        </div>
      )}
      {qr && (
        <>
          <h1>{t("qrTitle", { name: qr.locationName })}</h1>
          {/* eslint-disable-next-line @next/next/no-img-element -- ảnh dữ liệu tạo tại chỗ */}
          <img className="khung-qr" src={qrImage(`${window.location.origin}/hr${qr.path}`)} alt={t("qrAlt")} />
          <p style={{ margin: 0 }}>{t("qrRefresh", { seconds: remaining })}</p>
          <span className="chu-thich">{t("qrHint")}</span>
        </>
      )}
    </div>
  );
}
