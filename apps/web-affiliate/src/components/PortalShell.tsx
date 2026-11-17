"use client";

// Khung cổng cửa hàng liên kết (CONG_VIEC_55): thanh trên (cửa hàng, điểm bán đang chọn, người dùng, đăng xuất), menu theo vai trò,
// vùng thông báo nổi. Trang đăng nhập không dùng khung.
import type { MerchantPortalMe, MerchantPortalSecurity } from "contracts";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";
import { createContext, type ReactNode, useCallback, useContext, useEffect, useState } from "react";
import { Loaded, LoadingView, MessageView } from "ui/components/StatusViews";
import { apiFetch, ApiFailure } from "ui/lib/api";
import { formatDate } from "ui/lib/format";
import { loginPath, rememberMerchant, selectedMerchantId, usePortalApi } from "@/lib/portal-api";

type Membership = MerchantPortalMe["memberships"][number];

interface PortalContextValue {
  me: MerchantPortalMe;
  membership: Membership;
  notify: (text: string, kind?: "thanh-cong" | "loi") => void;
}

const PortalContext = createContext<PortalContextValue | null>(null);

export function usePortal(): PortalContextValue {
  const value = useContext(PortalContext);
  if (!value) throw new Error("usePortal chỉ dùng bên trong PortalShell.");
  return value;
}

// Menu MAN_HINH_174 đến MAN_HINH_177, MAN_HINH_232 (CONG_VIEC_67); thu ngân chỉ thấy quầy. Mục thêm dần theo lát.
const portalMenu = [
  { href: "/counter", key: "counter", ownerOnly: false },
  { href: "/vouchers", key: "vouchers", ownerOnly: true },
  { href: "/reports", key: "reports", ownerOnly: true },
  // CONG_VIEC_73 MAN_HINH_282: tiền thu hộ qua ứng dụng VComm.
  { href: "/payouts", key: "payouts", ownerOnly: true },
  { href: "/store", key: "store", ownerOnly: true },
  { href: "/connection", key: "connection", ownerOnly: true },
] as const;

function Shell({ me, security, children }: { me: MerchantPortalMe; security: MerchantPortalSecurity; children: ReactNode }) {
  const t = useTranslations("merchantPortal");
  const pathname = usePathname();
  const [toasts, setToasts] = useState<{ id: number; text: string; kind: string }[]>([]);
  const notify = useCallback((text: string, kind: "thanh-cong" | "loi" = "thanh-cong") => {
    const id = Date.now() + Math.random();
    setToasts((current) => [...current, { id, text, kind }]);
    setTimeout(() => setToasts((current) => current.filter((toast) => toast.id !== id)), 4000);
  }, []);
  const errors = useTranslations("errors");
  // Kết quả liên kết Zalo (quay về từ nhà cung cấp kèm ?lienKet= hoặc ?loi=).
  useEffect(() => {
    const search = new URLSearchParams(window.location.search);
    const linked = search.get("lienKet");
    const failed = search.get("loi");
    if (linked) notify(t("zaloLinked"));
    if (failed) notify(errors.has(failed as "notFound") ? errors(failed as "notFound") : errors("oauthFailed"), "loi");
    if (linked || failed) window.history.replaceState(null, "", window.location.pathname);
  }, [notify, t, errors]);
  if (me.memberships.length === 0) return <MessageView text={t("noMembership")} />;
  const stored = selectedMerchantId();
  const membership = me.memberships.find((item) => item.merchantId === stored) ?? me.memberships[0]!;
  if (membership.merchantId !== stored) rememberMerchant(membership.merchantId);
  async function logout() {
    try {
      await apiFetch("/auth/logout", { method: "POST" });
    } finally {
      window.location.replace(loginPath);
    }
  }
  return (
    <PortalContext.Provider value={{ me, membership, notify }}>
      <header className="thanh-tren">
        <span className="logo">{t("brand")}</span>
        {me.memberships.length > 1 ? (
          <>
            <label htmlFor="chon-cua-hang" className="an-nhan">
              {t("merchant")}
            </label>
            <select
              id="chon-cua-hang"
              value={membership.merchantId}
              onChange={(event) => {
                rememberMerchant(event.target.value);
                window.location.reload();
              }}
              style={{ background: "rgba(255,255,255,.14)", color: "#fff", border: 0, borderRadius: 999, padding: "4px 12px", font: "inherit", fontSize: 13 }}
            >
              {me.memberships.map((item) => (
                <option key={item.merchantId} value={item.merchantId} style={{ color: "#0F172A" }}>
                  {item.merchantName}
                </option>
              ))}
            </select>
          </>
        ) : (
          <span style={{ fontSize: 13 }}>{membership.merchantName}</span>
        )}
        <span className="gian" />
        <span style={{ fontSize: 13 }}>
          {me.fullName} ({t(`role_${membership.role}`)})
        </span>
        <a href="/api/v1/auth/oauth/zalo/start?mode=link&app=merchant">{t("zaloLink")}</a>
        <button type="button" onClick={() => void logout()}>
          {t("logout")}
        </button>
      </header>
      <div className="than">
        <nav className="menu" aria-label={t("menuTitle")}>
          <div className="ten-app">{t("menuTitle")}</div>
          {portalMenu
            .filter((item) => !item.ownerOnly || membership.role === "owner")
            .map((item) => (
              <Link key={item.href} href={item.href} className={pathname === item.href || pathname.startsWith(`${item.href}/`) ? "chon" : ""}>
                {t(`menu_${item.key}`)}
              </Link>
            ))}
        </nav>
        <main className="noi-dung">
          {membership.merchantStatus !== "active" && <div className="khoi-canh-bao canh-bao">{t(`merchantNotActive_${membership.merchantStatus}`)}</div>}
          {/* CONG_VIEC_72 (QUYTAC_NGHIEPVU_571): dải nhắc thiết lập bảo mật trong thời hạn chuyển đổi. */}
          {security.status === "optional" && (
            <div className="khoi-canh-bao canh-bao" style={{ display: "flex", flexWrap: "wrap", gap: "var(--khoang-3)", alignItems: "center" }}>
              <span style={{ flex: "1 1 240px" }}>{t("securityBanner", { date: formatDate(security.transitionEndsOn), days: security.daysLeft })}</span>
              <Link className="nut phu" href="/bao-mat">
                {t("securityBannerAction")}
              </Link>
            </div>
          )}
          {children}
        </main>
      </div>
      <div className="vung-thong-bao" role="status" aria-live="polite">
        {toasts.map((toast) => (
          <div key={toast.id} className={`thong-bao-noi ${toast.kind}`}>
            {toast.text}
          </div>
        ))}
      </div>
    </PortalContext.Provider>
  );
}

// Trạng thái bảo mật trước khi vào cổng (CONG_VIEC_72): chờ mã thì về nhập mã, chưa thiết lập mà bắt buộc thì sang thiết lập.
function SignedIn({ children }: { children: ReactNode }) {
  const common = useTranslations("common");
  const [security, setSecurity] = useState<MerchantPortalSecurity | null>(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    apiFetch<MerchantPortalSecurity>("/merchant-portal/security")
      .then((loaded) => {
        if (loaded.status === "mfa_pending") window.location.replace(`${loginPath}?buoc=ma`);
        else if (loaded.status === "required" || loaded.status === "blocked") window.location.replace("/merchant/bao-mat");
        else setSecurity(loaded);
      })
      .catch((error) => {
        if (error instanceof ApiFailure && error.status === 401) window.location.replace(loginPath);
        else setFailed(true);
      });
  }, []);
  if (failed) return <MessageView text={common("loadError")} onRetry={() => window.location.reload()} />;
  if (!security) return <LoadingView />;
  return <Member security={security}>{children}</Member>;
}

function Member({ security, children }: { security: MerchantPortalSecurity; children: ReactNode }) {
  const { state, reload } = usePortalApi<MerchantPortalMe>("/merchant-portal/me");
  return (
    <Loaded state={state} onRetry={() => void reload()}>
      {(me) => (
        <Shell me={me} security={security}>
          {children}
        </Shell>
      )}
    </Loaded>
  );
}

// Trang ngoài khung: đăng nhập, thiết lập bảo mật (MAN_HINH_273), quên mật khẩu (MAN_HINH_274).
const outsidePages = ["/dang-nhap", "/bao-mat", "/quen-mat-khau"];

export function PortalShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  if (outsidePages.includes(pathname)) return <>{children}</>;
  return <SignedIn>{children}</SignedIn>;
}
