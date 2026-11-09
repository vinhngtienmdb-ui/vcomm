"use client";

// Khung trang dùng chung ngoài mini app quản trị: thanh trên cùng và vùng nội dung.
import type { MeResponse } from "contracts";
import type { ReactNode } from "react";
import { useApi } from "../lib/use-api";
import { Loaded } from "./StatusViews";
import { TopBar } from "./TopBar";

export function UserShell({ maxWidth = 1200, children }: { maxWidth?: number; children: (me: MeResponse) => ReactNode }) {
  const { state, reload } = useApi<MeResponse>("/me");
  return (
    <Loaded state={state} onRetry={() => void reload()}>
      {(me) => (
        <>
          <TopBar me={me} onCompanyChange={() => void reload()} />
          <main className="noi-dung" style={{ maxWidth, margin: "0 auto", width: "100%" }}>
            {children(me)}
          </main>
        </>
      )}
    </Loaded>
  );
}
