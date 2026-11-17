// Phiên đăng nhập của ứng dụng VComm: tài khoản người mua (QUYTAC_NGHIEPVU_147).
import type { AppLoginResponse, BuyerMeResponse, DeviceVerificationMethod, SmartOtpActivationResponse } from "contracts";
import { createContext, type ReactNode, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { api, ApiFailure, loadStoredSession, setSignedOutHandler, storeTokens } from "./api";

// offline: khởi động không gọi được máy chủ (mất mạng, máy chủ bận); giữ phiên, cho thử lại.
// device: đăng nhập trên thiết bị mới, chờ xác nhận bằng Smart OTP (CONG_VIEC_72; QUYTAC_NGHIEPVU_565).
type Stage = "loading" | "offline" | "signedOut" | "mfa" | "mfaEnroll" | "device" | "ready";
type Session = {
  stage: Stage;
  deviceMethod: DeviceVerificationMethod | null;
  verifyDevice: (body: { smartOtp: string } | { smsCode: string }) => Promise<void>;
  me: BuyerMeResponse | null;
  // Đăng ký, đăng nhập bằng mật khẩu hoặc OTP đều trả phiên dạng token.
  // Trả phản hồi đăng nhập để màn hình đăng ký lấy khóa Smart OTP kích hoạt kèm (CONG_VIEC_72).
  signIn: (path: string, body: object) => Promise<AppLoginResponse & { smartOtpActivation?: SmartOtpActivationResponse | null }>;
  verifyMfa: (code: string, backup: boolean) => Promise<void>;
  reload: () => Promise<void>;
  retry: () => Promise<void>;
  setMe: (me: BuyerMeResponse) => void;
  logout: () => Promise<void>;
};

const SessionContext = createContext<Session | null>(null);

export function SessionProvider({ children }: { children: ReactNode }) {
  const [stage, setStage] = useState<Stage>("loading");
  const [deviceMethod, setDeviceMethod] = useState<DeviceVerificationMethod | null>(null);
  const [me, setMe] = useState<BuyerMeResponse | null>(null);

  const reload = useCallback(async () => {
    setMe(await api<BuyerMeResponse>("/buyer/me"));
    setStage("ready");
  }, []);

  useEffect(() => {
    setSignedOutHandler(() => {
      setMe(null);
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
      signIn: async (path, body) => {
        const result = await api<AppLoginResponse & { smartOtpActivation?: SmartOtpActivationResponse | null }>(path, { method: "POST", json: body });
        await storeTokens(result.tokens);
        // Tài khoản nhân viên bắt buộc xác thực hai lớp vẫn phải nhập mã như web.
        if (result.mfaRequired) {
          setStage(result.mfaEnrolled ? "mfa" : "mfaEnroll");
          return result;
        }
        if (result.deviceVerificationRequired) {
          setDeviceMethod(result.verificationMethod ?? null);
          setStage("device");
          return result;
        }
        await reload();
        return result;
      },
      deviceMethod,
      verifyDevice: async (body) => {
        await api("/buyer/login/device-verification", { method: "POST", json: body });
        setDeviceMethod(null);
        await reload();
      },
      verifyMfa: async (code, backup) => {
        await api("/auth/mfa/verify", { method: "POST", json: backup ? { backupCode: code } : { code } });
        await reload();
      },
      reload,
      retry: async () => {
        setStage("loading");
        await reload().catch((failure: unknown) => setStage(failure instanceof ApiFailure && failure.status === 401 ? "signedOut" : "offline"));
      },
      setMe,
      logout: async () => {
        await api("/auth/logout", { method: "POST" }).catch(() => undefined);
        await storeTokens(null);
        setMe(null);
        setStage("signedOut");
      },
    }),
    [stage, me, reload, deviceMethod],
  );
  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession(): Session {
  const session = useContext(SessionContext);
  if (!session) throw new Error("SessionProvider");
  return session;
}
