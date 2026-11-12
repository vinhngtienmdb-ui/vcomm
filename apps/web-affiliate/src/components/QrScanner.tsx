"use client";

// Đọc mã QR từ camera trình duyệt bằng thư viện jsQR (người dùng duyệt 2026-11-11; CONG_VIEC_55, QUYTAC_NGHIEPVU_396).
// Không gửi hình ảnh đi đâu; chỉ giải mã khung hình tại máy. Máy quét cầm tay gõ chuỗi vào ô nhập kèm Enter.
import jsQR from "jsqr";
import { useTranslations } from "next-intl";
import { useEffect, useRef, useState } from "react";

export function QrScanner({ onCode }: { onCode: (code: string) => void }) {
  const t = useTranslations("merchantPortal");
  const video = useRef<HTMLVideoElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const [failed, setFailed] = useState(false);
  const [typed, setTyped] = useState("");
  // Giữ hàm nhận mã mới nhất mà không khởi động lại camera mỗi lần trang vẽ lại.
  const handler = useRef(onCode);
  useEffect(() => {
    handler.current = onCode;
  }, [onCode]);

  useEffect(() => {
    let stream: MediaStream | null = null;
    let frame = 0;
    let stopped = false;
    const tick = () => {
      if (stopped) return;
      const element = video.current;
      const board = canvas.current;
      if (element && board && element.readyState === element.HAVE_ENOUGH_DATA) {
        board.width = element.videoWidth;
        board.height = element.videoHeight;
        const context = board.getContext("2d", { willReadFrequently: true });
        if (context) {
          context.drawImage(element, 0, 0, board.width, board.height);
          const found = jsQR(context.getImageData(0, 0, board.width, board.height).data, board.width, board.height, { inversionAttempts: "dontInvert" });
          if (found?.data) {
            stopped = true;
            handler.current(found.data);
            return;
          }
        }
      }
      frame = requestAnimationFrame(tick);
    };
    navigator.mediaDevices
      ?.getUserMedia({ video: { facingMode: "environment" } })
      .then((media) => {
        stream = media;
        if (video.current) {
          video.current.srcObject = media;
          void video.current.play();
          frame = requestAnimationFrame(tick);
        }
      })
      .catch(() => setFailed(true));
    if (!navigator.mediaDevices) setFailed(true);
    return () => {
      stopped = true;
      cancelAnimationFrame(frame);
      stream?.getTracks().forEach((track) => track.stop());
    };
  }, []);

  return (
    <div style={{ display: "grid", gap: "var(--khoang-2)" }}>
      {failed ? (
        <div className="khoi-canh-bao canh-bao">{t("cameraUnavailable")}</div>
      ) : (
        <video ref={video} muted playsInline style={{ width: "100%", maxHeight: 280, objectFit: "cover", borderRadius: "var(--bo-vua)", background: "var(--mau-chu)" }} />
      )}
      <canvas ref={canvas} hidden />
      <form
        style={{ display: "flex", gap: "var(--khoang-2)" }}
        onSubmit={(event) => {
          event.preventDefault();
          if (typed.trim()) onCode(typed.trim());
        }}
      >
        <label htmlFor="ma-may-quet" className="an-nhan">
          {t("scannerInput")}
        </label>
        <input id="ma-may-quet" className="o-nhap" placeholder={t("scannerInput")} value={typed} onChange={(event) => setTyped(event.target.value)} />
        <button type="submit" className="nut phu">
          {t("use")}
        </button>
      </form>
    </div>
  );
}
