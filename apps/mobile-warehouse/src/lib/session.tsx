// Phiên đăng nhập ứng dụng kho và nơi làm việc (công ty, kho) đang chọn (QUYTAC_NGHIEPVU_280).
import type { AppLoginResponse, LocationResponse, MeResponse, WarehouseResponse } from "contracts";
import { createContext, type ReactNode, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { api, ApiFailure, loadStoredSession, setCompanyHeader, setSignedOutHandler, storeTokens } from "./api";
import { readValue, writeValue } from "./storage";

type Stage = "loading" | "offline" | "signedOut" | "mfa" | "mfaEnroll" | "ready";
// Kho đang làm việc kèm vị trí đang dùng (để nhận mã vị trí khi quét).
export type Workplace = { warehouse: WarehouseResponse; locations: LocationResponse[] };
type Session = {
  stage: Stage;
  me: MeResponse | null;
  workplace: Workplace | null;
  signIn: (identifier: string, password: string) => Promise<void>;
  verifyMfa: (code: string, backup: boolean) => Promise<void>;
  chooseCompany: (companyId: string) => Promise<void>;
  chooseWarehouse: (warehouse: WarehouseResponse | null) => Promise<void>;
  retry: () => Promise<void>;
  logout: () => Promise<void>;
  can: (permission: string) => boolean;
};

const workplaceKey = "kho.noi-lam-viec";
const SessionContext = createContext<Session | null>(null);

async function loadLocations(warehouse: WarehouseResponse): Promise<LocationResponse[]> {
  if (!warehouse.usesLocations) return [];
  return (await api<LocationResponse[]>(`/inventory/warehouses/${warehouse.id}/locations`)).filter((location) => location.status === "active");
}

export function SessionProvider({ children }: { children: ReactNode }) {
  const [stage, setStage] = useState<Stage>("loading");
  const [me, setMe] = useState<MeResponse | null>(null);
  const [workplace, setWorkplace] = useState<Workplace | null>(null);

  // Nạp người dùng; công ty, kho đã chọn trên máy được dùng lại nếu còn quyền.
  const reload = useCallback(async () => {
    const saved = JSON.parse((await readValue(workplaceKey)) ?? "{}") as { companyId?: string; warehouseId?: string };
    setCompanyHeader(saved.companyId ?? null);
    let loaded = await api<MeResponse>("/me").catch((failure: unknown) => {
      if (failure instanceof ApiFailure && failure.status === 403 && saved.companyId) return null;
      throw failure;
    });
    if (!loaded) {
      setCompanyHeader(null);
      loaded = await api<MeResponse>("/me");
    }
    setCompanyHeader(loaded.currentCompanyId);
    setMe(loaded);
    let chosen: Workplace | null = null;
    if (saved.warehouseId && saved.companyId === loaded.currentCompanyId && loaded.permissions.includes("inventory.access")) {
      const warehouses = await api<WarehouseResponse[]>("/inventory/warehouses").catch(() => []);
      const warehouse = warehouses.find((item) => item.id === saved.warehouseId && item.canOperate && item.status === "active");
      if (warehouse) chosen = { warehouse, locations: await loadLocations(warehouse) };
    }
    setWorkplace(chosen);
    setStage("ready");
  }, []);

  useEffect(() => {
    setSignedOutHandler(() => {
      setMe(null);
      setWorkplace(null);
      setStage("signedOut");
    });
    void (async () => {
      if (!(await loadStoredSession())) return setStage("signedOut");
      await reload().catch((failure: unknown) => setStage(failure instanceof ApiFailure && failure.status === 401 ? "signedOut" : "offline"));
    })();
  }, [reload]);

  const value = useMemo<Session>(
    () => ({
      stage,
      me,
      workplace,
      signIn: async (identifier, password) => {
        const result = await api<AppLoginResponse>("/auth/warehouse-app/login", { method: "POST", json: { identifier, password } });
        await storeTokens(result.tokens);
        // Tài khoản bắt buộc xác thực hai lớp phải nhập mã như web; chưa đăng ký thì đăng ký trên web.
        if (result.mfaRequired) return setStage(result.mfaEnrolled ? "mfa" : "mfaEnroll");
        await reload();
      },
      verifyMfa: async (code, backup) => {
        await api("/auth/mfa/verify", { method: "POST", json: backup ? { backupCode: code } : { code } });
        await reload();
      },
      chooseCompany: async (companyId) => {
        await writeValue(workplaceKey, JSON.stringify({ companyId }));
        setCompanyHeader(companyId);
        setMe(await api<MeResponse>("/me"));
        setWorkplace(null);
      },
      chooseWarehouse: async (warehouse) => {
        await writeValue(workplaceKey, JSON.stringify({ companyId: me?.currentCompanyId, warehouseId: warehouse?.id }));
        setWorkplace(warehouse ? { warehouse, locations: await loadLocations(warehouse) } : null);
      },
      retry: async () => {
        setStage("loading");
        await reload().catch((failure: unknown) => setStage(failure instanceof ApiFailure && failure.status === 401 ? "signedOut" : "offline"));
      },
      logout: async () => {
        await api("/auth/logout", { method: "POST" }).catch(() => undefined);
        await storeTokens(null);
        setMe(null);
        setWorkplace(null);
        setStage("signedOut");
      },
      can: (permission) => me?.permissions.includes(permission) ?? false,
    }),
    [stage, me, workplace, reload],
  );
  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession(): Session {
  const session = useContext(SessionContext);
  if (!session) throw new Error("SessionProvider");
  return session;
}
