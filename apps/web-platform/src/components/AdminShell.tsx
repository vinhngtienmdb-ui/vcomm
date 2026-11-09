"use client";

// Khung mini app Quản trị hệ thống: ThanhTrenCung, MenuMiniApp, vùng ThongBaoNoi (tài liệu 15 mục 6).
import type { MeResponse } from "contracts";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { createContext, type ReactNode, useCallback, useContext, useState } from "react";
import { rememberCompany } from "@/lib/api";
import { useApi } from "@/lib/use-api";
import { Loaded } from "./StatusViews";
import { TopBar } from "./TopBar";

interface AdminContextValue {
  me: MeResponse;
  can: (permission: string) => boolean;
  notify: (text: string, kind?: "thanh-cong" | "loi") => void;
}

const AdminContext = createContext<AdminContextValue | null>(null);

export function useAdmin(): AdminContextValue {
  const value = useContext(AdminContext);
  if (!value) throw new Error("useAdmin chỉ dùng bên trong AdminShell.");
  return value;
}

// Mục menu đã xây; các mục khác thêm ở lát sau.
export const adminMenu = [
  { href: "/platform/companies", key: "companies", permission: "platform.company.manage" },
  { href: "/platform/branches", key: "branches", permission: "platform.branch.manage" },
  { href: "/platform/departments", key: "departments", permission: "platform.department.manage" },
  { href: "/platform/users", key: "users", permission: "platform.user.view" },
  { href: "/platform/roles", key: "roles", permission: "platform.role.manage" },
  { href: "/platform/approval-policies", key: "approvalPolicies", permission: "platform.approval_policy.manage" },
] as const;

export function AdminShell({ children }: { children: ReactNode }) {
  const t = useTranslations("menu");
  const pathname = usePathname();
  const { state, reload } = useApi<MeResponse>("/me");
  const [companyKey, setCompanyKey] = useState(0);
  const [toasts, setToasts] = useState<{ id: number; text: string; kind: string }[]>([]);

  const notify = useCallback((text: string, kind: "thanh-cong" | "loi" = "thanh-cong") => {
    const id = Date.now() + Math.random();
    setToasts((current) => [...current, { id, text, kind }]);
    setTimeout(() => setToasts((current) => current.filter((toast) => toast.id !== id)), 4000);
  }, []);

  return (
    <Loaded state={state} onRetry={() => void reload()}>
      {(me) => {
        if (me.currentCompanyId) rememberCompany(me.currentCompanyId);
        const granted = new Set(me.permissions);
        const can = (permission: string) => granted.has(permission);
        return (
          <AdminContext.Provider value={{ me, can, notify }}>
            <TopBar
              me={me}
              onCompanyChange={() => {
                void reload();
                setCompanyKey((key) => key + 1);
              }}
            />
            <div className="than">
              <nav className="menu" aria-label={t("title")}>
                <div className="ten-app">{t("title")}</div>
                {adminMenu
                  .filter((item) => can(item.permission))
                  .map((item) => (
                    <Link key={item.href} href={item.href} className={pathname.startsWith(item.href) ? "chon" : ""}>
                      {t(item.key)}
                    </Link>
                  ))}
              </nav>
              <main className="noi-dung" key={companyKey}>
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
          </AdminContext.Provider>
        );
      }}
    </Loaded>
  );
}
