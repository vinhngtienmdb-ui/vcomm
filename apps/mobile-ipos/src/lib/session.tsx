// Trạng thái thiết bị và phiên của ứng dụng iPOS (QUYTAC_NGHIEPVU_606, 607): chưa ghép → ghép thiết bị; đã ghép, chưa đăng nhập → PIN hoặc OTP;
// đăng nhập chưa có PIN → đặt PIN; sẵn sàng. Không thao tác 15 phút thì khóa màn hình (thu hồi phiên, đăng nhập lại bằng PIN).
import type { IposDeviceInfo, IposLoginResult, IposMe, IposPairResult } from "contracts";
import { createContext, type ReactNode, useCallback, useContext, useEffect, useRef, useState } from "react";
import { api, loadStored, setSignedOutHandler, storeDeviceKey, storeTokens } from "./api";

const idleLockMinutes = 15;

type Stage = "loading" | "unpaired" | "signedOut" | "needPin" | "ready";

interface SessionValue {
  stage: Stage;
  device: IposDeviceInfo | null;
  me: IposMe | null;
  notice: string | null;
  pair: (code: string) => Promise<void>;
  loginOtp: (phone: string, code: string) => Promise<void>;
  loginPin: (memberId: string, pin: string) => Promise<void>;
  setPin: (pin: string) => Promise<void>;
  lock: () => Promise<void>;
  reloadDevice: () => Promise<void>;
  touch: () => void;
}

const SessionContext = createContext<SessionValue | null>(null);

export function useSession(): SessionValue {
  const value = useContext(SessionContext);
  if (!value) throw new Error("useSession chỉ dùng bên trong SessionProvider.");
  return value;
}

export function SessionProvider({ children, onNotice }: { children: ReactNode; onNotice?: (reason: "session" | "device") => string }) {
  const [stage, setStage] = useState<Stage>("loading");
  const [device, setDevice] = useState<IposDeviceInfo | null>(null);
  const [me, setMe] = useState<IposMe | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const idleTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const reloadDevice = useCallback(async () => {
    try {
      setDevice(await api<IposDeviceInfo>("/ipos/pos/device", { withSession: false }));
    } catch {
      // Thiết bị bị thu hồi thì bộ xử lý đăng xuất đã đưa về màn hình ghép.
    }
  }, []);

  const afterLogin = useCallback(async (result: IposLoginResult) => {
    await storeTokens(result.tokens);
    const current = await api<IposMe>("/ipos/pos/me");
    setMe(current);
    setDevice(current.device);
    setNotice(null);
    setStage(current.member.hasPin ? "ready" : "needPin");
  }, []);

  useEffect(() => {
    setSignedOutHandler((reason) => {
      setMe(null);
      setNotice(onNotice ? onNotice(reason) : null);
      setStage(reason === "device" ? "unpaired" : "signedOut");
      if (reason === "session") void reloadDevice();
    });
    void (async () => {
      const stored = await loadStored();
      if (!stored.device) return setStage("unpaired");
      if (stored.session) {
        try {
          const current = await api<IposMe>("/ipos/pos/me");
          setMe(current);
          setDevice(current.device);
          return setStage(current.member.hasPin ? "ready" : "needPin");
        } catch {
          // Phiên cũ hết hạn: đăng nhập lại.
        }
      }
      await reloadDevice();
      setStage((current) => (current === "loading" ? "signedOut" : current));
    })();
  }, [onNotice, reloadDevice]);

  const lock = useCallback(async () => {
    try {
      await api("/ipos/pos/auth/lock", { method: "POST" });
    } catch {
      // Mất mạng vẫn khóa trên máy; phiên tự hết hạn ở máy chủ.
    }
    await storeTokens(null);
    setMe(null);
    setStage("signedOut");
    await reloadDevice();
  }, [reloadDevice]);

  const touch = useCallback(() => {
    if (idleTimer.current) clearTimeout(idleTimer.current);
    if (stage === "ready" || stage === "needPin") idleTimer.current = setTimeout(() => void lock(), idleLockMinutes * 60_000);
  }, [lock, stage]);

  useEffect(() => {
    touch();
    return () => {
      if (idleTimer.current) clearTimeout(idleTimer.current);
    };
  }, [touch]);

  const value: SessionValue = {
    stage,
    device,
    me,
    notice,
    pair: async (code) => {
      const result = await api<IposPairResult>("/ipos/devices/pair", { method: "POST", json: { code, model: null, appVersion: "0.1.0" }, withSession: false });
      await storeDeviceKey(result.deviceKey);
      await storeTokens(null);
      setDevice(result.device);
      setNotice(null);
      setStage("signedOut");
    },
    loginOtp: async (phone, code) => afterLogin(await api<IposLoginResult>("/ipos/pos/auth/login", { method: "POST", json: { phone, code }, withSession: false })),
    loginPin: async (memberId, pin) => afterLogin(await api<IposLoginResult>("/ipos/pos/auth/pin-login", { method: "POST", json: { memberId, pin }, withSession: false })),
    setPin: async (pin) => {
      await api("/ipos/pos/auth/pin", { method: "POST", json: { pin } });
      const current = await api<IposMe>("/ipos/pos/me");
      setMe(current);
      setDevice(current.device);
      setStage("ready");
    },
    lock,
    reloadDevice,
    touch,
  };
  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}
