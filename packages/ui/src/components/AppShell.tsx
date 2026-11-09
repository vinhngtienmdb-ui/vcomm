"use client";

// Khung mini app quản trị: ThanhTrenCung, MenuMiniApp, vùng ThongBaoNoi (tài liệu 15 mục 6). Mỗi mini app truyền menu của mình.
import type { MeResponse } from "contracts";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { createContext, type ReactNode, useCallback, useContext, useState } from "react";
import { rememberCompany } from "../lib/api";
import { useApi } from "../lib/use-api";
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
  if (!value) throw new Error("useAdmin chỉ dùng bên trong AppShell.");
  return value;
}

export interface AppMenuItem {
  href: string;
  label: string;
  permission: string;
}

export function AppShell({ title, menu, children }: { title: string; menu: AppMenuItem[]; children: ReactNode }) {
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
              <nav className="menu" aria-label={title}>
                <div className="ten-app">{title}</div>
                {menu
                  .filter((item) => can(item.permission))
                  .map((item) => (
                    <Link key={item.href} href={item.href} className={pathname.startsWith(item.href) ? "chon" : ""}>
                      {item.label}
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
