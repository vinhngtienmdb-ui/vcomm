"use client";

// Khung cổng cửa hàng liên kết (CONG_VIEC_55): thanh trên (cửa hàng, điểm bán đang chọn, người dùng, đăng xuất), menu theo vai trò,
// vùng thông báo nổi. Trang đăng nhập không dùng khung.
import type { MerchantPortalMe } from "contracts";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";
import { createContext, type ReactNode, useCallback, useContext, useState } from "react";
import { Loaded, MessageView } from "ui/components/StatusViews";
import { apiFetch } from "ui/lib/api";
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

// Menu MAN_HINH_174 đến MAN_HINH_177; thu ngân chỉ thấy quầy. Mục thêm dần theo lát.
const portalMenu = [
  { href: "/counter", key: "counter", ownerOnly: false },
  { href: "/vouchers", key: "vouchers", ownerOnly: true },
  { href: "/reports", key: "reports", ownerOnly: true },
  { href: "/store", key: "store", ownerOnly: true },
] as const;

function Shell({ me, children }: { me: MerchantPortalMe; children: ReactNode }) {
  const t = useTranslations("merchantPortal");
  const pathname = usePathname();
  const [toasts, setToasts] = useState<{ id: number; text: string; kind: string }[]>([]);
  const notify = useCallback((text: string, kind: "thanh-cong" | "loi" = "thanh-cong") => {
    const id = Date.now() + Math.random();
    setToasts((current) => [...current, { id, text, kind }]);
    setTimeout(() => setToasts((current) => current.filter((toast) => toast.id !== id)), 4000);
  }, []);
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

function SignedIn({ children }: { children: ReactNode }) {
  const { state, reload } = usePortalApi<MerchantPortalMe>("/merchant-portal/me");
  return (
    <Loaded state={state} onRetry={() => void reload()}>
      {(me) => <Shell me={me}>{children}</Shell>}
    </Loaded>
  );
}

export function PortalShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  if (pathname === "/dang-nhap") return <>{children}</>;
  return <SignedIn>{children}</SignedIn>;
}
