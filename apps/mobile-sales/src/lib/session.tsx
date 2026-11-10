// Phiên đăng nhập của ứng dụng: người dùng, công ty đang chọn, quyền (QUYTAC_NGHIEPVU_136).
import type { AppLoginResponse, MeResponse } from "contracts";
import { createContext, type ReactNode, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { api, loadStoredSession, setSignedOutHandler, storeCompany, storeTokens } from "./api";

type Stage = "loading" | "signedOut" | "mfa" | "mfaEnroll" | "ready";
type Session = {
  stage: Stage;
  me: MeResponse | null;
  can: (permission: string) => boolean;
  login: (identifier: string, password: string) => Promise<void>;
  verifyMfa: (code: string, backup: boolean) => Promise<void>;
  switchCompany: (companyId: string) => Promise<void>;
  logout: () => Promise<void>;
};

const SessionContext = createContext<Session | null>(null);

export function SessionProvider({ children }: { children: ReactNode }) {
  const [stage, setStage] = useState<Stage>("loading");
  const [me, setMe] = useState<MeResponse | null>(null);

  const loadMe = useCallback(async () => {
    const loaded = await api<MeResponse>("/me");
    if (loaded.currentCompanyId) await storeCompany(loaded.currentCompanyId);
    setMe(loaded);
    setStage("ready");
  }, []);

  useEffect(() => {
    setSignedOutHandler(() => {
      setMe(null);
      setStage("signedOut");
    });
    void (async () => {
      if (!(await loadStoredSession())) return setStage("signedOut");
      await loadMe().catch(() => setStage("signedOut"));
    })();
  }, [loadMe]);

  const value = useMemo<Session>(
    () => ({
      stage,
      me,
      can: (permission) => me?.permissions.includes(permission) ?? false,
      login: async (identifier, password) => {
        const result = await api<AppLoginResponse>("/auth/app/login", { method: "POST", json: { identifier, password } });
        await storeTokens(result.tokens);
        if (result.mfaRequired) return setStage(result.mfaEnrolled ? "mfa" : "mfaEnroll");
        await loadMe();
      },
      verifyMfa: async (code, backup) => {
        await api("/auth/mfa/verify", { method: "POST", json: backup ? { backupCode: code } : { code } });
        await loadMe();
      },
      switchCompany: async (companyId) => {
        await storeCompany(companyId);
        await loadMe();
      },
      logout: async () => {
        await api("/auth/logout", { method: "POST" }).catch(() => undefined);
        await storeTokens(null);
        await storeCompany(null);
        setMe(null);
        setStage("signedOut");
      },
    }),
    [stage, me, loadMe],
  );
  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession(): Session {
  const session = useContext(SessionContext);
  if (!session) throw new Error("SessionProvider");
  return session;
}
