"use client";

// MAN_HINH_05 Trang chủ mini app (CHUC_NANG_14, CHUC_NANG_11).
import type { HomeResponse, MeResponse } from "contracts";
import { useLocale, useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { TopBar } from "@/components/TopBar";
import { apiFetch, ApiFailure, rememberCompany } from "@/lib/api";

type State = { kind: "loading" } | { kind: "error" } | { kind: "ready"; me: MeResponse; home: HomeResponse };

const initials = (name: string) =>
  name
    .split(/\s+/)
    .slice(0, 2)
    .map((word) => word[0])
    .join("")
    .toUpperCase();

export default function HomePage() {
  const t = useTranslations("home");
  const locale = useLocale();
  const router = useRouter();
  const [state, setState] = useState<State>({ kind: "loading" });
  const [notice, setNotice] = useState<string | null>(null);

  const load = useCallback(async () => {
    setState({ kind: "loading" });
    try {
      const [me, home] = await Promise.all([apiFetch<MeResponse>("/me"), apiFetch<HomeResponse>("/home")]);
      if (me.currentCompanyId) rememberCompany(me.currentCompanyId);
      setState({ kind: "ready", me, home });
    } catch (error) {
      if (error instanceof ApiFailure && error.status === 401) {
        router.replace("/dang-nhap");
        return;
      }
      setState({ kind: "error" });
    }
  }, [router]);

  useEffect(() => {
    void load();
  }, [load]);

  if (state.kind === "loading") {
    return (
      <main className="noi-dung" aria-busy="true" style={{ maxWidth: 1200, margin: "0 auto" }}>
        <div className="the">{Array.from({ length: 6 }, (_, index) => <div key={index} className="xuong" />)}</div>
      </main>
    );
  }
  if (state.kind === "error") {
    return (
      <main className="noi-dung" style={{ maxWidth: 1200, margin: "0 auto" }}>
        <div className="trang-thai-trong">
          <p style={{ margin: 0 }}>{t("loadError")}</p>
          <button type="button" className="nut phu" onClick={() => void load()}>
            {t("retry")}
          </button>
        </div>
      </main>
    );
  }

  const { me, home } = state;
  return (
    <>
      <TopBar me={me} onCompanyChange={() => void load()} />
      <main className="noi-dung" style={{ maxWidth: 1200, margin: "0 auto" }}>
        <div className="tieu-de">
          <h1>{t("greeting", { name: me.user.fullName })}</h1>
        </div>
        {notice && (
          <div className="khoi-canh-bao thong-tin" role="status">
            {notice}
          </div>
        )}
        {home.apps.length === 0 ? (
          <div className="trang-thai-trong">
            <div className="hinh" />
            <p style={{ margin: 0 }}>{t("noApps")}</p>
          </div>
        ) : (
          <div className="luoi-app">
            {home.apps.map((app) => {
              const name = locale === "en" ? app.nameEn : app.nameVi;
              return (
                <button
                  key={app.code}
                  type="button"
                  className="o-app"
                  style={{ font: "inherit", textAlign: "left", cursor: "pointer" }}
                  // Mini app chưa xây ở lát này: báo rõ thay vì mở trang lỗi.
                  onClick={() => setNotice(t("comingLater", { name }))}
                >
                  <span className="bieu-tuong">{initials(name)}</span>
                  <strong>{name}</strong>
                  {app.pendingCount > 0 ? <span className="huy-hieu">{t("pending", { count: app.pendingCount })}</span> : <span className="chu-thich">{t("noPending")}</span>}
                </button>
              );
            })}
          </div>
        )}
        <section className="the">
          <h2>{t("pendingApprovals")}</h2>
          <p className="chu-thich" style={{ margin: 0 }}>
            {t("noPendingApprovals")}
          </p>
        </section>
      </main>
    </>
  );
}
